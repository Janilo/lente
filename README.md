# lente

Plataforma de pesquisa por entrevistas: o pesquisador cria **estudos** (roteiro + screener), coleta **entrevistas** — upload de vídeo com transcrição (STT) e segmentação por IA por pergunta, ou a entrevista pública do próprio respondente — e gera **síntese** dos achados. Deploy em `lente.pereirasaraiva.com`.

> Arquitetura, glossário do domínio e achados: [`ARCHITECTURE.md`](./ARCHITECTURE.md) · [`GLOSSARIO.md`](./GLOSSARIO.md) · [`AUDITORIA-ARQUITETURA.md`](./AUDITORIA-ARQUITETURA.md).

## Stack

- **App**: TanStack Start (React 19) + Vite, rodando em **Cloudflare Workers** (nitro). Entry do Worker: `src/server.ts`.
- **Dados**: Supabase (Postgres + RLS + Storage + Auth). Service-role só no servidor, via `supabaseAdmin`.
- **IA**: provider OpenAI-compatível (Google AI Studio / Gemini) — STT, segmentação da entrevista por pergunta e enriquecimento. Adapters em `src/lib/*.server.ts`.
- **Integrações**: Telegram (sessões de respondente), HubSpot (leads). Import/export de documento: jspdf · mammoth · unpdf.
- **Qualidade**: vitest (`pnpm run test`), testes de RLS (`pnpm run test:rls`), eslint + prettier (`pnpm run lint`) — rodam no CI.

## Comandos

```sh
pnpm dev          # dev server
pnpm run test     # vitest (unidade)
pnpm run lint     # eslint + prettier
pnpm build        # build de produção (regenera src/routeTree.gen.ts)
```

CI (`.github/workflows/ci.yml`): lint + test em todo PR e push na `main`. Deploy (`.github/workflows/deploy.yml`): build + publish no Cloudflare. Variáveis de ambiente: ver `.env.example`.

## Mapa do código (resumo)

```
src/
  routes/
    _authenticated/        telas de app (dashboard, studies.$id.*, admin.*, qualificacao)
    r_.$slug(.run).tsx     entrevista pública do respondente
    api/public/telegram/   webhook do Telegram
  lib/
    *.functions.ts         fatias verticais: studies · interview · synthesis ·
                           screener · qualification · recruitment · respondents · ...
    *.server.ts            adapters de infra: ai · stt · telegram · hubspot
    authz.ts               asserts de posse de recurso (caller passa o próprio client)
    admin-ops.server.ts    superfície service-role concentrada (auth.admin / storage)
    errors.ts · config.ts · lgpd.ts
  integrations/supabase/   client (RLS) · client.server (service-role) · auth-middleware
```
