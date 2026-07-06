# Arquitetura do Lente

> O mapa vivo (item F-A5 da `AUDITORIA-ARQUITETURA.md`). Lendo este arquivo e o
> [`GLOSSARIO.md`](./GLOSSARIO.md), um dev (ou uma IA) novo deve saber: onde
> adicionar um endpoint, qual client de dados usar e como nomear a entidade.

## Stack

TanStack Start (React 19) + Vite · Cloudflare Workers · Supabase (Postgres/RLS,
Storage, Auth) · adapters de IA/STT/HubSpot/Telegram · vitest + eslint (CI roda
`pnpm run lint` e `pnpm run test` em todo PR, mais o job `rls`: stack local do
Supabase + `pnpm test:rls`).

## O mapa

```
src/
├─ routes/                         TanStack file-based routing
│  ├─ __root.tsx                   shell: <head>, SEO/OG/JSON-LD, providers
│  ├─ _authenticated/*             telas do pesquisador (dashboard, studies.$id.*, admin.*)
│  ├─ r_.$slug(.run).tsx           entrevista pública do respondente
│  └─ api/public/telegram/…        webhook (rota de API)
│
├─ lib/                            *** as FATIAS VERTICAIS ***
│  ├─ *.functions.ts               FATIA: createServerFn + Zod + autorização + regra + dados
│  ├─ *.server.ts                  ADAPTER de infra (só servidor): ai · stt · hubspot · telegram · admin-ops
│  ├─ interview-decision.ts        núcleo PURO do runner (sem I/O; testado)
│  ├─ authz.ts                     asserts de dono/participante (assertStudyOwner, …)
│  └─ errors.ts · lgpd.ts · utils.ts · config.ts
│
├─ integrations/supabase/          client (RLS) · client.server (service-role) · auth-middleware · types
├─ components/{ui,brand,interview,study}
└─ server.ts / start.ts            entry do Worker + middlewares globais

supabase/
├─ migrations/20260628151355_…sql  ESPELHO da produção — fonte da verdade da linguagem ubíqua
├─ seed.sql                        personas e fixtures da suíte de RLS (só stack local)
└─ tests/*.rls.ts                  testes de integração de RLS (pnpm test:rls)
```

Camadas, de fora para dentro:

```
Rota (React + TanStack Query) ── useServerFn(...) ──▶ RPC com Bearer (attachSupabaseAuth)
        │
FATIA  src/lib/<nome>.functions.ts
  createServerFn().middleware([requireSupabaseAuth])  ← autentica
    .inputValidator(z.object({...}).parse)            ← valida o contrato
    .handler(...)                                     ← autoriza (authz.ts) + regra + dados
        │                                   │
  context.supabase (RLS, do usuário)   supabaseAdmin (service-role)   *.server.ts (adapters)
```

## As regras

### 1 · Fatia é `*.functions.ts`; adapter é `*.server.ts`

- **Endpoint novo** entra na fatia do conceito (ex.: algo de estudo →
  `studies.functions.ts`); conceito novo ganha fatia nova homônima à entidade.
  O esqueleto é sempre o mesmo: `createServerFn` + `.middleware([requireSupabaseAuth])` +
  `.inputValidator(z…parse)` + handler que **autoriza antes de tocar dados**
  (helpers de `authz.ts` — não escreva `!== userId` inline).
- **Rota↔fatia é 1:1** — a rota importa a fatia de mesmo nome e não contém regra
  de negócio.
- **Adapter** (`*.server.ts`) esconde UMA infra externa atrás de interface
  pequena e não conhece as fatias. Trocar de provider não pode tocar fatia.
- Resultado de domínio com estados → **união discriminada**
  (ex.: `NextStep = { type: "question" | "followup" | "processing" | "done" }`),
  nunca flags soltas.

### 2 · Qual client de dados usar

- **`context.supabase`** (do usuário, respeita RLS) — **é o padrão dos
  handlers** (F-A4-B aplicado): fetch de autorização, leituras e escritas
  cobertas por policy vão pelo client do usuário. O Postgres autoriza, e a
  suíte `supabase/tests/` prova cada policy.
- **`supabaseAdmin`** (service-role, bypassa RLS) — **só** para o que a RLS não
  cobre, sempre com comentário no ponto de uso. O resíduo mapeado: pipelines
  que rodam sem usuário (STT/score/enrichment, webhook do Telegram), Storage
  assinado e `auth.admin` (via `admin-ops.server.ts`), leituras cross-usuário
  do pesquisador (`profiles`/e-mail de respondentes, diretório de
  respondentes), metadados de estudo para o respondente (título em
  `/my-privacy`, config no painel de status, questions no export — decisão
  F-RLS-2) e o apagão LGPD (`consents` é append-only para usuários).
- Não misture os dois clients para a MESMA tabela num handler sem comentário
  justificando.
- **Policy que precisa de "estudo publicado" usa `study_is_published(uuid)`**
  (SECURITY DEFINER — F-RLS-2): `EXISTS` direto em `studies` roda sob a RLS de
  quem consulta (anon/respondente não enxergam studies) e vira letra morta.
  Leitura pública de perguntas/screener não existe via API — o runner e a
  página do slug leem via serverFn com service-role, por decisão.

### 3 · Composição entre fatias: import estático; dinâmico é exceção (F-A6)

- Entre módulos do próprio `src/` o import é **estático, sempre** — o grafo de
  dependências das fatias tem que ser legível no topo do arquivo (o bundle do
  Worker é um só; lazy-load interno não paga nada).
- `await import(...)` é reservado para **dependência de terceiros pesada em
  caminho raro** — hoje: `mammoth`/`unpdf` no `script-builder.functions.ts`.
- Passos de pipeline compartilhados (`transcribeAudio`, `enrichInterviewInternal`,
  `scoreAnswerInternal`, `computeNextStep`) são funções exportadas e importadas
  estaticamente pelos consumidores (`answer-pipeline`, `interview-upload`,
  webhook do Telegram).
- Fatia não importa fatia em ciclo; a direção hoje é
  `answer-pipeline → interview.functions` (runner) e todos → adapters.

### 4 · Arquivos marcados "automatically generated"

`integrations/supabase/{client.ts, client.server.ts, auth-middleware.ts}`
nasceram do scaffold (Lovable) com o aviso "do not edit". O scaffold não roda
mais; esses arquivos são **código nosso** e mudam por PR normal como qualquer
infra — mas são fundação de segurança: mudanças ali pedem revisão com atenção
dobrada.

## Banco local e testes de RLS

As policies de RLS são a fronteira de segurança real do produto (PII de
respondente, LGPD) — e são testadas de verdade, não por leitura de código:

```sh
supabase start     # Postgres+Auth+PostgREST+Storage locais; aplica migration + seed
pnpm test:rls      # suíte supabase/tests/*.rls.ts (vitest, config própria)
```

- **A migration `20260628151355_lente_initial_schema.sql` é um ESPELHO da
  produção** (extraído do catálogo em 05/07/2026) e usa a mesma version da
  migration remota — nunca roda contra a produção. As 18 migrations da era
  Lovable descreviam o projeto antigo (apagado) e foram removidas. Mudou o
  schema na produção? Regenere o espelho e ajuste a suíte no mesmo PR.
- **`supabase/seed.sql`** cria as personas (admin, ana/bruno pesquisadores,
  rita/rafael respondentes — senha `lente-rls-test`) e um cenário mínimo com
  dados cruzados entre donos. UUIDs fixos exportados em `supabase/tests/stack.ts`.
- **Roles são concedidas, nunca automáticas** (F-SEC-1, migration
  `20260705090500`): o cadastro cria só o profile. Para promover um
  pesquisador, o admin roda
  `insert into public.user_roles (user_id, role) values ('<user_id>', 'researcher');`
  — e a policy "Researcher can view all respondent profiles" passa a valer
  para ele. Respondente não precisa de role.
- **A suíte prova o que cada papel consegue ler/escrever** — anon, respondente,
  pesquisador, dono, admin — tabela a tabela, mais storage
  (`interview-videos`), a RPC `delete_respondent_data` e a view
  `respondent_stats` (security_invoker). Sem Docker, `pnpm test` (unidade)
  continua verde: a suíte RLS só roda via `pnpm test:rls`; no CI o job `rls`
  exige a stack (`REQUIRE_RLS_STACK=1`).
- Policy nova ou alterada ⇒ teste novo na suíte, no mesmo PR.

## Pendências conhecidas (da auditoria)

- Nenhuma. O último item (F-A4 Parte B) foi aplicado em jul/2026: as fatias
  operam com o client do usuário onde a RLS cobre, e todo uso remanescente de
  `supabaseAdmin` carrega um comentário justificando (mapa do resíduo na regra
  2 acima).
