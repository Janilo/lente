# Auditoria de Arquitetura — Lente

> Base: `Janilo/lente` (branch atual). Stack: TanStack Start · React 19 · Vite · Cloudflare Workers · Supabase · Zod · Tailwind 4 · shadcn.
> Referência: Matt Pocock, "Software Fundamentals Matter More Than Ever" (https://www.youtube.com/watch?v=v4F1gFy-hqg).
> Escopo: arquitetura (módulos, fatias, interfaces, testes). **NÃO** é a auditoria de design system — essa é `AUDITORIA.md`.
> Método: cada afirmação cita `arquivo:linha` real. Números de linha conferidos na leitura; se um trecho tiver se movido, localize pela citação.

---

## Sumário executivo

| Princípio | Nota | Veredito em 1 linha |
|---|---|---|
| 1 · Linguagem ubíqua (DDD) | ✅ forte | Vocabulário do domínio é único e consistente do schema à rota; split PT-BR-UI / inglês-código é disciplinado, com desvios mínimos. |
| 2 · Fatias verticais | 🟡 parcial | `*.functions.ts` são fatias reais (DB + Zod + regra + fronteira `createServerFn`), mas 3 fatias se cruzam via import e reforçam a fatia "interview" como núcleo gravitacional. |
| 3 · TDD | 🔴 fraco | **Zero** teste e **nenhum** runner configurado; a lógica de decisão mais valiosa (`computeNextStep`) não tem rede de segurança. |
| 4 · Módulos profundos | 🟡 parcial | Há módulos profundos exemplares (`ai.server`, união discriminada de `computeNextStep`), mas `interview.functions.ts` (650 linhas, 12 exports) é um módulo raso de superfície larga. |
| 5 · Ocultação de informação | 🟡 parcial | `supabaseAdmin` (service-role) vaza para 18 arquivos, autorização é copiada ~26×, erros são `throw new Error("string")` sem tipo, e a arquitetura não tem documento vivo. |

**Tese.** Contra a visão do Pocock, a Lente parte de uma base **acima da média para código gerado por IA**: a fronteira `createServerFn` + `inputValidator` Zod + middleware de auth é um contrato tático explícito, os resultados de domínio são **uniões discriminadas** (`{ type: "question" | "followup" | "processing" | "done" }`), os componentes são agrupados por feature, e há tratamento sério de LGPD. Isso é o "sargento" bem-comandado. O que falta é o **estrategista** nos pontos que a IA não fecha sozinha: (a) a rede de testes que transforma a interface no contrato executável que a IA precisa satisfazer — hoje inexistente; (b) o combate à entropia de superfície, onde a fatia `interview` cresceu para um balde de 12 responsabilidades; e (c) a ocultação de informação da camada de dados e autorização, hoje repetida à mão em cada fatia. São exatamente os fundamentos que "importam mais" quando a IA gera volume rápido: sem eles, cada nova serverFn amplia a superfície de confiança e o custo de mudança.

---

## A arquitetura em uma tela

Estrutura real, sem invenção:

```
src/
├─ routes/                         TanStack file-based routing
│  ├─ __root.tsx                   shell: <head>, SEO/OG/JSON-LD, providers
│  ├─ _authenticated.tsx          AuthGate (client-side redirect p/ /login)
│  ├─ _authenticated/*             telas de app (dashboard, studies.$id.*, admin.*, qualificacao)
│  ├─ r_.$slug(.run).tsx           entrevista pública do respondente
│  └─ api/public/telegram/…        rota de API (webhook)
│
├─ lib/                            *** as FATIAS VERTICAIS ***
│  ├─ *.functions.ts               fatia = createServerFn (fronteira) + Zod + regra + acesso a dados
│  │                               studies · interview · interview-upload · interview-enrichment
│  │                               synthesis · screener · qualification · recruitment · respondents
│  │                               respondent-pool · respondent-detail · compensation · admin · …
│  ├─ *.server.ts                  ADAPTERS de infra (só servidor): ai · stt · hubspot · telegram
│  └─ (utils, config, lgpd, export-synthesis, error-*)
│
├─ integrations/supabase/          client (RLS) · client.server (service-role) · auth-middleware · auth-attacher · types
│
├─ components/
│  ├─ ui/                          shadcn primitives
│  ├─ brand/                       SiteHeader, wordmark, footer
│  └─ interview/ · study/          componentes agrupados por feature
│
├─ server.ts / start.ts            entry do Worker + middleware global (attachSupabaseAuth, errorMiddleware)
└─ supabase/migrations/*.sql       schema (fonte da linguagem ubíqua)
```

Camadas, de fora para dentro:

```
┌──────────────────────────────────────────────────────────────┐
│ Rota (_authenticated/studies.$id.interviews.tsx)              │  React 19 + TanStack Query
│   useServerFn(getInterviewDetail)                             │
└───────────────┬──────────────────────────────────────────────┘
                │ RPC (fetch + Bearer via attachSupabaseAuth)
┌───────────────▼──────────────────────────────────────────────┐
│ FATIA  src/lib/interview.functions.ts                         │
│   createServerFn(GET)                                         │
│     .middleware([requireSupabaseAuth])   ← autentica          │
│     .inputValidator(z.object(...).parse) ← valida (contrato)  │
│     .handler → autoriza + regra + dados                       │
└───────┬──────────────────────────────┬──────────────────────┘
        │ supabase (RLS, do usuário)    │ supabaseAdmin (service-role, sem RLS)
┌───────▼──────────┐          ┌─────────▼───────────┐   ┌────────────────────┐
│ Postgres + RLS   │          │ Postgres (bypass)   │   │ ADAPTERS *.server  │
│                  │          │ Storage / Auth admin│   │ ai · stt · hubspot │
└──────────────────┘          └─────────────────────┘   └────────────────────┘
```

O padrão de fatia é sólido e repetido com disciplina. Amostra canônica: `studies.functions.ts:6-17` (`listMyStudies`), `screener.functions.ts:9-23` (`listScreenerQuestions`), `qualification.functions.ts:6-45` (`getQualificationData`). Cada rota consome a fatia de mesmo nome (ex.: `routes/_authenticated/qualificacao.tsx:7` importa `@/lib/qualification.functions`).

---

## 1 — Linguagem ubíqua (DDD / Eric Evans)

**Veredito: ✅ forte.**

Os substantivos do domínio atravessam schema → serverFn → rota → componente **sem sinônimos** para o mesmo conceito. Evidência do schema (fonte da verdade), em `supabase/migrations/*.sql`:

```
studies · questions · answers · interviews · consents · insights · recommendations ·
interview_insights · screener_questions · screener_submissions · respondent_profile ·
respondent_tags · tag_dimensions · tag_values · study_invitations · compensation_log ·
telegram_sessions · profiles · user_roles · app_settings
```

Esses mesmos termos reaparecem literalmente nas fatias e nas rotas:
- `study` / `interview` / `answer` / `question` — `interview.functions.ts` inteiro (`.from("studies")`, `.from("interviews")`, `.from("answers")`, `.from("questions")`).
- `insight` / `recommendation` — `interview.functions.ts:499-501` (`from("insights")`, `from("recommendations")`).
- `screener` — arquivo e tabela homônimos (`screener.functions.ts` ↔ `screener_questions`).
- `followup` — conceito de primeira classe e coerente do banco (`answers.is_followup`, `studies.max_followups`) ao tipo de retorno (`type: "followup"`, `interview.functions.ts:140`), aos totais (`followups_done_for_current`, `:253`) e ao estado de UI (`followupState`, `:481`).
- `qualification` / `screener` / `recruitment` / `synthesis` — cada um com sua fatia dedicada e nome estável.

**Split PT-BR-na-UI × inglês-no-código — disciplinado.** Identificadores, tabelas e colunas são inglês; textos de usuário e prompts de IA são PT-BR. A fronteira é limpa: `qualification.functions.ts` (código inglês) serve a rota `qualificacao.tsx` (título "Complete seu perfil — Lente", `:10`); os prompts de IA são PT-BR dentro de funções inglesas (`maybeGenerateFollowup`, `interview.functions.ts:190`). Os erros voltados ao usuário também são PT-BR ("Estudo não encontrado ou não publicado.", `:21`).

**Desvios (menores, não bloqueiam a nota):**
1. **`respondent` no singular/plural.** A tabela de perfil de respondente é **singular** `respondent_profile` (migrations), mas as fatias usam plural: `respondents.functions.ts`, `respondent-pool.functions.ts`. A rota admin usa PT-BR `admin.respondentes.$id.tsx`, e a rota de owner usa inglês `studies.$id.respondents.tsx`. É legível, mas o mesmo conceito ("respondente") aparece em três grafias (`respondent_profile`, `respondents`, `respondentes`). Vale fixar: tabela e fatia no mesmo número gramatical.
2. **`insights` tem dois sentidos.** Existe `insights` (nível de estudo, `interview.functions.ts:500`) e `interview_insights` (nível de entrevista, `:597`). São entidades distintas de propósito, mas o termo nu "insight" é sobrecarregado; um glossário evita que a IA (ou um humano) misture os dois ao gerar código novo.

**Recomendação (P2, F-A5 abaixo):** um `GLOSSARY.md` curto — 20 linhas mapeando cada substantivo ao seu grão (estudo vs entrevista vs resposta vs respondente) e fixando singular/plural — dá à IA a "linguagem ubíqua" por escrito, que é justamente o artefato que o Pocock defende para o estrategista deixar ao tático.

---

## 2 — Fatias verticais (vertical slices / tracer bullets)

**Veredito: 🟡 parcial (forte na forma, com vazamentos pontuais).**

As `*.functions.ts` **são** fatias verticais no sentido do Pocock: cada uma corta todas as camadas para um pedaço fino do domínio — valida entrada (Zod), autoriza, executa regra, toca dados, e expõe a fronteira `createServerFn`. Comprovado em `studies.functions.ts`, `screener.functions.ts`, `qualification.functions.ts`, `synthesis.functions.ts`. E o mapeamento fatia→rota é 1:1 na maioria (a rota importa a fatia homônima). Isso é exatamente "tracer bullet": funcionalidade fina que já funciona ponta a ponta.

**Onde as fatias sangram uma na outra (o que baixa a nota):**

1. **Import estático cruzado `respondents → interview`.** `respondents.functions.ts:5`:
   ```ts
   import { scoreAnswerInternal } from "@/lib/interview.functions";
   ```
   `scoreAnswerInternal` (pontuação de qualidade de resposta por IA) vive dentro da fatia `interview` (`interview.functions.ts:524`) mas é consumido pela fatia `respondents`. É lógica de "qualidade de resposta" — um subdomínio próprio — hospedada na fatia errada.

2. **Import estático cruzado `interview-upload → interview-enrichment`.** `interview-upload.functions.ts:12`:
   ```ts
   import { enrichInterviewInternal } from "./interview-enrichment.functions";
   ```
   Aqui o acoplamento é mais defensável (enriquecimento é um passo do pipeline), mas note que **a mesma dependência é feita por import dinâmico** em `interview.functions.ts:354` (`await import("./interview-enrichment.functions")`). Duas fatias dependem de uma terceira por dois mecanismos diferentes — inconsistência que confunde quem lê o grafo.

3. **Imports dinâmicos como "junta" de pipeline.** `interview.functions.ts:320` (`await import("./stt.server")`) e `:354` (enrichment) escondem arestas do grafo de dependência. São provavelmente intencionais (lazy-load de infra pesada no Worker), mas deveriam estar **documentados** como fronteira de pipeline, senão parecem acoplamento acidental.

O efeito líquido: a fatia `interview` virou o **centro gravitacional** — outras fatias importam dela e ela importa de outras. Isso é o oposto do ideal de fatias independentes ("tracer bullets" que não se enredam).

**Correção (ver F-A1):** promover "qualidade de resposta" e "pipeline de entrevista" a fatias/módulos explícitos e padronizar como as fatias se compõem (um único mecanismo, documentado).

---

## 3 — TDD (loops de feedback pequenos)

**Veredito: 🔴 fraco — o princípio mais fraco do repo, como esperado.**

- **Runner de teste: não existe.** `package.json` não tem `vitest`/`jest`/`@testing-library`/`playwright` em `devDependencies`, e não há script `test` (só `dev`, `build`, `build:dev`, `preview`, `lint`, `format`).
- **Arquivos de teste: zero.** Nenhum `*.test.ts(x)` ou `*.spec.ts(x)` sob `src/`. (Um único `*.test.ts` aparece na máquina, mas é de **outro** repositório — `site/` — não da Lente.)

Isso é precisamente o buraco que o Pocock diz que importa mais na era da IA: **o teste na interface é o contrato que a IA precisa satisfazer.** Sem ele, cada refatoração de `computeNextStep` (o coração da entrevista) é feita no escuro, e uma IA pedida para "mexer no fluxo de follow-up" não tem oráculo para saber se quebrou.

**Alvo nº 1 de TDD — `computeNextStep` (`interview.functions.ts:106-178`).** É quase uma função pura de decisão: recebe o estado das respostas e devolve uma **união discriminada** (`question` | `processing` | `followup` | `done`). Casos que se escrevem em minutos e cobrem o núcleo do produto:
- estudo sem respostas → `{ type: "question", position: 1 }`
- resposta ainda `uploading`/`transcribing` → `{ type: "processing" }`
- resposta `failed` de follow-up → re-pergunta (`{ type: "followup" }`, ramo `:139`)
- follow-ups no limite `max_followups` → pula e vai para a próxima pergunta (`:150`)
- todas as perguntas `ready` → `{ type: "done" }`

**Bloqueio prático a remover primeiro:** hoje `computeNextStep` **lê do banco por dentro** (`supabaseAdmin.from(...)`, `:107-119`), então não é testável sem mockar o Supabase. A jogada de maior alavancagem é **extrair a decisão pura** — `decideNextStep({ interview, questions, answers, maxFollowups, askFollowup })` — recebendo dados já buscados e a decisão de follow-up como função injetada. Aí `computeNextStep` vira uma casca fina de I/O sobre uma função 100% testável. Isso combina os princípios 3 e 4: nasce um **módulo profundo** (decisão) e um **alvo de teste trivial** ao mesmo tempo. Detalhe em **F-A2**.

**Segundos alvos, também quase-puros e sem I/O:** `normalizeWords` / `normalizeForMatch` / `locateQuoteClip` em `synthesis.functions.ts:17-55+` (resolução de clipe por palavra — heurística ms-vs-s, janela deslizante). Já são funções puras; só falta o arquivo de teste.

---

## 4 — Módulos profundos (Ousterhout)

**Veredito: 🟡 parcial — convive o exemplar e o balde.**

**Módulos profundos (bom — interface simples sobre implementação poderosa):**
- **`ai.server.ts` (13 linhas).** Esconde toda a escolha de provider de IA atrás de `aiChatUrl()`. Trocar Google/OpenRouter/OpenAI é só setar `AI_GATEWAY_URL` — o call site não muda (`ai.server.ts:6-13`). Caixa cinza perfeita: quem chama só vê a URL.
- **Retorno em união discriminada de `computeNextStep`.** A interface para o cliente é um enum de 4 estados; por trás há busca de perguntas, filtro de respostas por status, decisão de follow-up por IA e fallback de re-pergunta. O consumidor (`r_.$slug.run.tsx`) só faz `switch (next.type)`. Interface estreita, implementação profunda.
- **Proxy lazy de `supabaseAdmin` (`client.server.ts:36-41`).** Esconde a inicialização preguiçosa e a validação de env atrás de um objeto que "só é" um client. Boa ocultação de implementação.

**Módulo raso (o principal débito de design — interface tão larga quanto a implementação):**
- **`interview.functions.ts` — 650 linhas, 12 exports.** É o maior arquivo de lógica do repo e um **grab-bag**: mistura pelo menos seis responsabilidades sem interface comum:
  1. leitura de estudo público (`getStudyBySlug`, `:11`)
  2. ciclo de vida da entrevista (`startInterview`/`finishInterview`, `:30`, `:362`)
  3. máquina de decisão (`computeNextStep`/`getNextStep`, `:106`, `:229`)
  4. CRUD/pipeline de resposta (`createAnswer`/`processAnswer`, `:269`, `:298`)
  5. orquestração de transcrição (`import("./stt.server")`, `:320`)
  6. **pontuação de qualidade por IA** (`scoreAnswerInternal`, `:524`) — subdomínio inteiro dentro do arquivo
  7. **tabelas do pesquisador** (`listStudyInterviews`, `getInterviewDetail`, `listStudyInterviewsTable`, `:374`, `:407`, `:571`) — outro subdomínio (leitura/relatório) colado no de escrita/pipeline.

  Pela lei de Ousterhout, o custo de um módulo é a largura da sua interface. Aqui a interface (12 exports heterogêneos) é quase tão complexa quanto a implementação — é um **módulo raso**: quem consome precisa entender o arquivo inteiro para saber onde mexer, e a fatia `respondents` teve que importar `scoreAnswerInternal` de dentro dele (§2).

**Recomendação — dividir em módulos mais profundos (F-A1):**
```
interview.functions.ts        → só ciclo de vida + pipeline do respondente
  (getStudyBySlug, startInterview, createAnswer, processAnswer, finishInterview, getNextStep)
interview-decision.ts         → decideNextStep puro + computeNextStep casca (alvo de TDD, §3)
answer-quality.ts             → scoreAnswerInternal (consumido por respondents/interview)
study-interviews.read.ts      → listStudyInterviews, getInterviewDetail, listStudyInterviewsTable
```
Cada peça ganha interface estreita e propósito único; o consumidor passa a entender só a caixa que usa.

---

## 5 — Ocultação de informação & consciência de design de sistema

**Veredito: 🟡 parcial.**

1. **`supabaseAdmin` (service-role, ignora RLS) vaza para 18 arquivos.** Contagem por grep de `import ... supabaseAdmin ... client.server`: 18 arquivos, incluindo praticamente toda fatia de negócio (`interview`, `synthesis`, `respondents`, `screener`, `qualification`, `recruitment`, `compensation`, `admin`, `respondent-pool`, `respondent-detail`, `interview-upload`, `interview-enrichment`, `telegram`, `hubspot.server`, `stt.server`, e a rota `telegram/webhook`). O próprio arquivo avisa: *"SECURITY: Only use this for trusted server-side operations"* (`client.server.ts:34`). Cada import amplia a **superfície de confiança**: é um cliente que **contorna toda a RLS**, espalhado por 18 pontos, cada um responsável por reimplementar à mão a checagem que a RLS daria de graça. Isso é o inverso da ocultação de informação — o detalhe mais perigoso da camada de dados (o bypass) é o mais exposto.

2. **Autorização feita à mão e duplicada ~26×.** O padrão dono/respondente é copiado como código inline em 12 arquivos (grep de `respondent_id !== userId` / `owner_id !== userId` / `"Acesso negado."` → 26 ocorrências). Exemplos idênticos:
   - `interview.functions.ts:235` — `if (!iv || iv.respondent_id !== userId) throw new Error("Acesso negado.");`
   - `interview.functions.ts:283`, `:368`, `:380` — o mesmo, repetido.
   - `respondents.functions.ts:17`, `screener.functions.ts:14` — variações de "buscar estudo, comparar `owner_id`".
   Existe até uma tentativa de fatorar isso — `assertOwner(study_id, userId)` em `synthesis.functions.ts:7` — mas ela é **privada da fatia synthesis** e não foi reusada em lugar nenhum. A regra de negócio "quem pode ver esta entrevista/estudo" está espalhada, então uma mudança de política (ex.: admin também vê) exige editar ~12 arquivos, e é fácil um novo endpoint esquecer a checagem.

3. **Erros são `throw new Error("string em PT-BR")` — sem módulo de erro tipado.** ~177 ocorrências de `throw new Error(` em 30 arquivos; 19 só em `interview.functions.ts`. Mistura três naturezas em um tipo só: falha de autorização (`"Acesso negado."`), estado de domínio (`"Estudo não encontrado ou não publicado."`) e erro de infra (`throw new Error(error.message)` do Postgres). O cliente não consegue distinguir 403 de 404 de 500 sem casar strings, e as mensagens PT-BR viram, na prática, uma API de erro não-tipada. Um módulo `errors.ts` com `class ForbiddenError/NotFoundError/DomainError` (mapeadas a status HTTP no boundary) esconderia essa complexidade e daria ao cliente um contrato estável.

4. **Sem mapa vivo da arquitetura.** Não há `README.md` no repo. Existe `AUDITORIA.md` (só design system) e `.lovable/plan.md`, mas **nenhum documento descreve os módulos, as fatias ou o grafo de dependências**. Vários arquivos-chave são marcados *"automatically generated. Do not edit"* (`client.server.ts:1`, `auth-middleware.ts:1`, `client.ts:1`) — ou seja, parte da infra de segurança é gerada e não deve ser editada à mão, o que **reforça** a necessidade de um mapa que diga o que é canônico, o que é gerado, e como as fatias se compõem. O Pocock chama isso de "system design awareness": manter um mapa dos módulos. Hoje o mapa vive só na cabeça de quem escreveu.

**O que já está bem ocultado (crédito):** a autenticação (`requireSupabaseAuth`, `auth-middleware.ts`) é um módulo profundo real — uma linha `.middleware([requireSupabaseAuth])` esconde extração de Bearer, validação de claims e injeção de `{ supabase, userId }` no contexto. O provider de IA idem (§4). O problema é que a **autorização** (nível de recurso) não recebeu o mesmo tratamento que a **autenticação** (nível de request).

---

## Achados priorizados

Prioridade: **P0** = risco arquitetural / acoplamento perigoso · **P1** = módulo/testabilidade · **P2** = manutenção/consistência.

---

### F-A0 · Autorização de recurso duplicada em ~12 fatias, sem módulo (P0)

**Arquivos:** `interview.functions.ts:235,283,368,380,418,462` · `respondents.functions.ts:17` · `screener.functions.ts:14` · `synthesis.functions.ts:9` · e +8 (grep: 26 ocorrências de "Acesso negado." em 12 arquivos).
**Sintoma:** a política "quem pode ler/escrever este estudo/entrevista" é reimplementada inline em cada handler. Já há um `assertOwner` privado em `synthesis.functions.ts:7` que ninguém mais usa. Mudar a política (admin enxerga tudo, colaboradores, etc.) exige editar ~12 arquivos; um endpoint novo pode esquecer a checagem e vazar dados.
**Princípio ferido:** ocultação de informação (5); módulo profundo (4).
**Correção (passos):**
1. Criar `src/lib/authz.ts` com asserts que **retornam o recurso** (evita segunda busca) e lançam erro tipado:
   ```ts
   // src/lib/authz.ts
   import { supabaseAdmin } from "@/integrations/supabase/client.server";
   import { ForbiddenError, NotFoundError } from "./errors";

   export async function assertStudyOwner(studyId: string, userId: string) {
     const { data } = await supabaseAdmin
       .from("studies").select("id, owner_id, title").eq("id", studyId).maybeSingle();
     if (!data) throw new NotFoundError("Estudo não encontrado.");
     if (data.owner_id !== userId) throw new ForbiddenError();
     return data;
   }
   export async function assertInterviewRespondent(interviewId: string, userId: string) { /* … */ }
   export async function assertInterviewViewer(interviewId: string, userId: string) {
     // respondente OU dono do estudo (hoje inline em getInterviewPipelineStatus:460-462)
   }
   ```
2. Substituir os blocos inline por chamadas ao módulo. Ex. em `interview.functions.ts:234-235`:
   ```diff
   - const { data: iv } = await supabase.from("interviews").select("id, study_id, respondent_id").eq("id", data.interview_id).maybeSingle();
   - if (!iv || iv.respondent_id !== userId) throw new Error("Acesso negado.");
   + const iv = await assertInterviewRespondent(data.interview_id, userId);
   ```
3. Migrar o `assertOwner` local de `synthesis.functions.ts:7` para o novo módulo e apagar a cópia.
**Aceite:** grep por `!== userId` em `src/lib` retorna **zero** (fora de `authz.ts`); toda serverFn autenticada obtém autorização por uma chamada nomeada; a política de "admin vê tudo" muda em **um** lugar.

---

### F-A1 · `interview.functions.ts` é um módulo raso de 650 linhas / 12 exports (P1)

**Arquivo:** `interview.functions.ts` (todo) · consumido por acoplamento de dentro em `respondents.functions.ts:5`.
**Sintoma:** seis responsabilidades num arquivo (ciclo de vida, decisão, CRUD de resposta, transcrição, **qualidade por IA**, **tabelas do pesquisador**). Interface larga = módulo raso (§4). Forçou `respondents` a importar `scoreAnswerInternal` de dentro da fatia `interview` (§2).
**Princípio ferido:** módulos profundos (4); fatias verticais (2).
**Correção (split, sem mudar comportamento):**
```
interview.functions.ts     → ciclo de vida + pipeline do respondente
answer-quality.ts          → scoreAnswerInternal   (respondents e interview passam a importar daqui)
interview-decision.ts      → decideNextStep (puro) + computeNextStep (casca) — ver F-A2
study-interviews.read.ts   → listStudyInterviews, getInterviewDetail, listStudyInterviewsTable
```
Mover `scoreAnswerInternal` (`:524`) para `answer-quality.ts` **também apaga o import cruzado** de `respondents.functions.ts:5`.
**Aceite:** nenhum arquivo de fatia passa de ~250 linhas; `respondents.functions.ts` não importa mais de `interview.functions.ts`; cada arquivo novo tem um propósito descritível em uma frase.

---

### F-A2 · Extrair a decisão pura de `computeNextStep` e testá-la (P1)

**Arquivo:** `interview.functions.ts:106-178`.
**Sintoma:** o coração da entrevista (união discriminada de 4 estados) faz I/O de banco por dentro (`:107-119`), então é intestável sem mock, e não há **nenhum** teste (§3).
**Princípio ferido:** TDD (3); módulos profundos (4).
**Correção:**
1. Extrair a decisão pura:
   ```ts
   // interview-decision.ts
   type NextStep = { type: "done" } | { type: "processing" }
     | { type: "question"; question_id: string; text: string; intent: string; position: number }
     | { type: "followup"; question_id: string; text: string; intent: string; parent_answer_id: string | null; position: number };

   export async function decideNextStep(input: {
     interviewStatus: string;
     questions: Q[]; answers: A[]; maxFollowups: number;
     askFollowup: (ctx: FollowupCtx) => Promise<string | null>;   // injeta a IA
   }): Promise<NextStep> { /* move o corpo :110-177 para cá, sem tocar em supabase */ }
   ```
2. `computeNextStep` vira casca: busca `interview`/`questions`/`answers`/`study` (mantém `:107-119`) e chama `decideNextStep({ …, askFollowup: maybeGenerateFollowup })`.
3. Adicionar runner + primeiro teste:
   ```diff
   // package.json
   -    "format": "prettier --write ."
   +    "format": "prettier --write .",
   +    "test": "vitest run",
   +    "test:watch": "vitest"
   // devDependencies
   +    "vitest": "^2.1.0"
   ```
   ```ts
   // interview-decision.test.ts — 5 casos do §3
   const noFollowup = async () => null;
   test("sem respostas → primeira pergunta", async () => {
     const r = await decideNextStep({ interviewStatus: "in_progress",
       questions: [{ id: "q1", text: "…", intent: "", position: 1 }], answers: [],
       maxFollowups: 2, askFollowup: noFollowup });
     expect(r).toEqual({ type: "question", question_id: "q1", text: "…", intent: "", position: 1 });
   });
   // + processing / followup-refazido / limite de followups / done
   ```
**Aceite:** `npm run test` existe e passa; `decideNextStep` não importa `supabaseAdmin`; os 5 ramos de decisão têm teste; a IA (ou um humano) consegue refatorar o fluxo de follow-up com rede.

---

### F-A3 · Módulo de erros tipados no lugar de `throw new Error("string")` (P1)

**Arquivos:** ~177 `throw new Error(` em 30 arquivos (19 em `interview.functions.ts`).
**Sintoma:** autorização, "não encontrado" e erro de infra colapsam no mesmo tipo `Error`; o cliente não distingue 403/404/500 sem casar strings PT-BR. As mensagens viraram uma API de erro implícita e não-tipada.
**Princípio ferido:** ocultação de informação (5).
**Correção:**
```ts
// src/lib/errors.ts
export class AppError extends Error { constructor(msg: string, readonly status: number) { super(msg); } }
export class ForbiddenError extends AppError { constructor(m = "Acesso negado.") { super(m, 403); } }
export class NotFoundError extends AppError { constructor(m = "Não encontrado.") { super(m, 404); } }
export class DomainError   extends AppError { constructor(m: string) { super(m, 422); } }
```
Mapear `AppError.status` no boundary (`start.ts` `errorMiddleware`, hoje só trata `statusCode`, `:10`). Migrar incrementalmente, começando pelas fatias já tocadas em F-A0/F-A1.
**Aceite:** falhas de autorização/domínio usam classes tipadas com status; o `errorMiddleware` converte `AppError` no HTTP correto; nenhuma **nova** serverFn usa `throw new Error("…")` para controle de fluxo.

---

### F-A4 · Reduzir a superfície de `supabaseAdmin` (bypass de RLS) (P0)

**Arquivos:** 18 imports de `supabaseAdmin` (grep). Casos onde há `context.supabase` (client com RLS do usuário) disponível **e mesmo assim** se usa `supabaseAdmin`, misturando os dois no mesmo handler: `interview.functions.ts` (usa `supabase` p/ `interviews` mas `supabaseAdmin` p/ `answers`/`questions`), `respondents.functions.ts:15`, `screener.functions.ts` (mistura `supabase` e `supabaseAdmin`).
**Sintoma:** o cliente service-role que **ignora toda a RLS** é o detalhe mais perigoso da camada de dados e é o mais espalhado. Cada handler que o usa reassume a responsabilidade de autorizar à mão (ver F-A0). Misturar `supabase` (RLS) e `supabaseAdmin` (bypass) no mesmo handler torna difícil auditar qual query está protegida.
**Princípio ferido:** ocultação de informação / superfície de confiança (5).
**Correção (defensável, incremental):**
1. Onde a query é do próprio usuário e existe RLS, **preferir `context.supabase`** (deixa o Postgres autorizar) e reservar `supabaseAdmin` para o que a RLS legitimamente não cobre (Storage assinado, `auth.admin`, agregações cross-usuário do pesquisador).
2. Encapsular os usos legítimos de admin atrás de funções nomeadas de intenção — `signedVideoUrl(path)`, `adminGetUserEmail(userId)` — em vez de espalhar `supabaseAdmin.storage`/`.auth.admin` pelas fatias. Assim o "poder perigoso" fica atrás de uma interface estreita.
3. Documentar a regra (ver F-A5): *"`supabaseAdmin` só para operações que a RLS não cobre; leitura do próprio usuário vai por `context.supabase`."*
**Aceite:** nenhum handler mistura `supabase` e `supabaseAdmin` para a **mesma** tabela sem comentário justificando; usos de admin restam concentrados em helpers nomeados; a contagem de arquivos que importam `supabaseAdmin` cai.

**Status — Parte A aplicada (passo 2):** os poderes que a RLS legitimamente **não** cobre — `auth.admin.getUserById` e Storage signed URLs — foram concentrados em `src/lib/admin-ops.server.ts` atrás de funções de intenção: `adminGetUserEmail(userId)`, `adminGetUserContact(userId)` (e-mail + `full_name` do metadata numa só chamada), `signedVideoUrl(path)` e `signedVideoUrls(paths)`. Depois do refactor, `auth.admin.getUserById` e `createSignedUrl*` aparecem em **um único arquivo** (grep); antes estavam espalhados por 6 fatias (`admin`, `respondents`, `respondent-pool`, `synthesis`, `interview`, `hubspot`). Comportamento preservado (mesmos `null`-em-erro/miss). Verificado: lint 0 erros, `build` ok, testes 7/7, `tsc` limpo nos arquivos tocados.
**Parte B adiada (passo 1):** trocar leituras do próprio usuário de `supabaseAdmin.from(...)` para `context.supabase` (deixar o Postgres autorizar) exige revisão das políticas RLS granulares (respondente/pesquisador/admin por tabela) **com** teste de integração contra o banco — que este repo ainda não tem. Fazer isso às cegas arriscaria negar acessos legítimos ou (pior) mascarar uma falha de autorização. Fica para quando houver ambiente de teste de RLS; até lá a Parte A já reduz a superfície perigosa (o "poder" agora tem uma porta estreita e nomeada).

---

### F-A5 · Documentar a arquitetura: glossário + mapa de módulos (P2)

**Arquivos:** repo sem `README.md`; `AUDITORIA.md` é só DS; infra crítica marcada "auto-generated / Do not edit" (`client.server.ts:1`, `auth-middleware.ts:1`).
**Sintoma:** o mapa dos módulos/fatias e o glossário do domínio existem só na cabeça dos autores — exatamente o que o Pocock diz para materializar, ainda mais quando a IA gera código novo contra esse mapa.
**Princípio ferido:** system design awareness (5); linguagem ubíqua (1).
**Correção:** um `ARCHITECTURE.md` curto com (a) o diagrama de camadas desta auditoria; (b) a regra de fatia (`*.functions.ts` = fatia; `*.server.ts` = adapter); (c) a regra de `supabaseAdmin` vs `context.supabase` (F-A4); (d) quais arquivos são gerados e como; e um `GLOSSARY.md` de 20 linhas fixando grão e número gramatical dos substantivos (estudo/entrevista/resposta/respondente/insight-de-estudo vs insight-de-entrevista — §1).
**Aceite:** um dev (ou a IA) novo consegue, só lendo os dois arquivos, dizer onde adicionar um endpoint, qual client usar e como nomear a entidade.

---

### F-A6 · Padronizar a composição entre fatias (P2)

**Arquivos:** `interview-upload.functions.ts:12` (import estático de enrichment) vs `interview.functions.ts:354` (import **dinâmico** do mesmo enrichment) vs `:320` (import dinâmico de `stt.server`).
**Sintoma:** a mesma dependência de pipeline é resolvida por dois mecanismos (estático e dinâmico) sem regra explícita; o grafo de dependência fica ilegível e o import dinâmico parece acoplamento acidental.
**Princípio ferido:** fatias verticais (2); consciência de design (5).
**Correção:** decidir e documentar (em `ARCHITECTURE.md`) quando usar import dinâmico (ex.: só para lazy-load de infra pesada no Worker) e aplicar de forma consistente; ou expor os passos de pipeline (`enrichInterviewInternal`, `transcribeAudio`) por um módulo "pipeline" com fronteira única.
**Aceite:** um único critério, escrito, para import estático vs dinâmico entre fatias; enrichment é importado do mesmo jeito nos dois call sites.

---

## O que já está certo (não regredir)

- **Fronteira serverFn tipada e uniforme.** `createServerFn` + `.middleware([requireSupabaseAuth])` + `.inputValidator(z…parse)` em toda fatia é um contrato tático explícito — o "sargento" bem-comandado do Pocock. Manter esse esqueleto em toda serverFn nova.
- **Resultados de domínio em união discriminada.** `computeNextStep` retornando `{ type: "question" | "followup" | "processing" | "done" }` (`interview.functions.ts`) é design de dados que força o cliente a tratar todos os estados. Padrão a replicar.
- **Middleware de autenticação como módulo profundo.** `requireSupabaseAuth` (`auth-middleware.ts`) esconde Bearer + claims + injeção de contexto atrás de uma linha. Excelente ocultação.
- **Adapter de IA agnóstico de provider.** `ai.server.ts` — trocar de LLM sem tocar em código de negócio. Manter todos os `*.server.ts` como adapters finos.
- **Componentes agrupados por feature** (`components/{interview,study,brand}`) — coesão por domínio, não por tipo.
- **LGPD de primeira classe** — `consents` idempotente (`interview.functions.ts:70`), rota `my-privacy`, `lgpd.ts`, e-mail de respondente restrito a admin (`respondents.functions.ts`). Não regredir.
- **Boundary de erro resiliente** — `server.ts` normaliza o 500 que o h3 engole silenciosamente; página de erro com marca. Bom instinto de robustez.
- **Validação de entrada com limites** (`.max()` em todos os campos Zod) — reduz superfície de abuso na fronteira pública.

---

## Checklist de verificação

- [ ] **Autorização atrás de módulo** (`authz.ts`): grep `!== userId` em `src/lib` = 0 fora de `authz.ts` (F-A0).
- [x] **`interview.functions.ts` dividido** em 4 fatias (runner 264 · `answer-pipeline` 138 · `interview-status` 109 · `study-interviews.read` 234 linhas); sem import cruzado `respondents → interview` (F-A1).
- [ ] **Runner de teste existe** (`vitest`) e `npm run test` passa (F-A2/F-A3).
- [ ] **`decideNextStep` puro e testado** nos 5 ramos; não importa `supabaseAdmin` (F-A2).
- [ ] **Erros tipados** (`AppError` + status) mapeados no boundary; controle de fluxo não usa `throw new Error("string")` em código novo (F-A3).
- [x] **`supabaseAdmin` contido (Parte A)**: `auth.admin` + Storage signed URLs concentrados em `admin-ops.server.ts` (helpers nomeados); só aparecem em 1 arquivo agora (F-A4). — [ ] **Parte B** (trocar leitura do próprio usuário para `context.supabase`) adiada até haver teste de RLS.
- [ ] **`ARCHITECTURE.md` + `GLOSSARY.md`** presentes; regra de client e grão dos substantivos escritos (F-A5).
- [ ] **Composição entre fatias padronizada** (import estático vs dinâmico documentado) (F-A6).
- [ ] `npm run build` e typecheck passam após os refactors.
