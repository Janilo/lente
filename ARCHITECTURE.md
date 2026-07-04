# Arquitetura do Lente

> O mapa vivo (item F-A5 da `AUDITORIA-ARQUITETURA.md`). Lendo este arquivo e o
> [`GLOSSARY.md`](./GLOSSARY.md), um dev (ou uma IA) novo deve saber: onde
> adicionar um endpoint, qual client de dados usar e como nomear a entidade.

## Stack

TanStack Start (React 19) + Vite · Cloudflare Workers · Supabase (Postgres/RLS,
Storage, Auth) · adapters de IA/STT/HubSpot/Telegram · vitest + eslint (CI roda
`pnpm run lint` e `pnpm run test` em todo PR).

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
├─ server.ts / start.ts            entry do Worker + middlewares globais
└─ supabase/migrations/*.sql       schema — fonte da verdade da linguagem ubíqua
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

- **`context.supabase`** (do usuário, respeita RLS) — preferir para leitura e
  escrita do próprio usuário. O Postgres autoriza.
- **`supabaseAdmin`** (service-role, bypassa RLS) — **só** para o que a RLS não
  cobre: Storage assinado, `auth.admin`, agregações cross-usuário do
  pesquisador, pipelines internos (STT/enrichment). Poderes perigosos ficam
  atrás de funções nomeadas em `admin-ops.server.ts` (`signedVideoUrl`,
  `adminGetUserEmail`, …) — não espalhe `supabaseAdmin.storage`/`.auth.admin`
  pelas fatias.
- Não misture os dois clients para a MESMA tabela num handler sem comentário
  justificando.

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

## Pendências conhecidas (da auditoria)

- **F-A4 Parte B**: trocar leituras do próprio usuário de `supabaseAdmin` para
  `context.supabase` exige teste de integração de RLS — adiado até existir esse
  ambiente.
