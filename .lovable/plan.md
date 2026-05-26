## Visão geral

Nova rota protegida `/admin/analytics` acessível apenas pelo e-mail `janilo@pereirasaraiva.com`. A página reúne, em abas, as funções operacionais que você pediu: estudos da plataforma, usuários cadastrados, respondentes (com filtros) e configurações (STT + liberação de publicação).

## Mudanças no banco

1. **Tabela `app_settings`** (chave-valor, single-row para config global)
   - `stt_provider` (`elevenlabs` | `assemblyai`), default `elevenlabs`
   - RLS: leitura/escrita só para o admin (via função `is_admin()`).

2. **Coluna `can_publish boolean default false` em `profiles`**
   - Só o admin pode mudar.
   - RLS de `studies`: trocar `status` para `published` exige `can_publish = true` OU ser admin. (Atualiza policy de UPDATE.)

3. **Colunas em `profiles`** para perfil de respondente (preenchidas no signup/perfil do respondente — formulário fora deste escopo será no próximo pedido):
   - `city text`, `state text`, `age_range text`, `occupation text`, `industry text`, `research_interests text[]`
   - Todos nullable para não quebrar perfis existentes.

4. **Função SQL `is_admin()`** — `SECURITY DEFINER`, retorna `true` se o e-mail do `auth.uid()` for `janilo@pereirasaraiva.com`. Usada nas RLS e nas server fns.

## Backend (server functions em `src/lib/admin.functions.ts`)

Todas com `requireSupabaseAuth` + checagem `is_admin()` no handler (rejeita 403 caso contrário). Usam `supabaseAdmin` para leituras agregadas.

- `adminListStudies()` — todos os estudos com dono, status, contagem de entrevistas.
- `adminListUsers()` — todos os profiles + e-mail (via `auth.admin.listUsers`) + roles + `can_publish` + data de cadastro.
- `adminListRespondents({ filters })` — respondentes (profiles com pelo menos 1 interview) com os campos de filtro abaixo.
- `adminListCtaClicks()` — bonus: total + últimos 50 eventos de `cta_click_events` (já existe).
- `adminGetSettings()` / `adminUpdateSettings({ stt_provider })`.
- `adminSetUserPublishPermission({ user_id, can_publish })`.

### Filtros de respondentes (server-side, todos opcionais)
nome (ilike), e-mail (ilike), cidade, estado, faixa etária, cargo/ocupação, setor/indústria, área de interesse (contém qualquer da lista).

## STT dinâmico

`src/lib/stt.server.ts`: antes de escolher o provedor, lê `app_settings.stt_provider` via `supabaseAdmin`; se não houver linha, cai no `process.env.STT_PROVIDER` (compatibilidade). Cache em memória de 60s para não bater no banco a cada transcrição.

## Frontend

- **`src/routes/_authenticated/admin.analytics.tsx`** — gate por e-mail no `beforeLoad` (`supabase.auth.getUser()`, redireciona `/dashboard` se não for admin). Layout com `Tabs`:
  - **Visão geral**: cards com totais (estudos, usuários, respondentes, cliques no CTA).
  - **Estudos**: tabela com título, dono, status, entrevistas, data.
  - **Usuários**: tabela com nome, e-mail, role, cadastro, switch `can_publish`.
  - **Respondentes**: barra de filtros (inputs + selects) + tabela paginada com os campos pedidos. Botão de export CSV.
  - **Configurações**: select de provedor STT (ElevenLabs / AssemblyAI) com save.

- **Link no header** (`BrandHeader`) visível apenas quando o usuário logado é o admin.

- **Bloqueio de publicação no UI**: na página de edição do estudo, se `can_publish=false` e usuário não é admin, o controle de status fica desabilitado com tooltip explicando ("Solicite liberação ao administrador").

## Fora de escopo (próximos passos)

- Formulário para o respondente preencher cidade/estado/idade/etc no signup ou em `/my-privacy`. Por ora as colunas existem e os filtros funcionam, mas só trazem resultados quando esses dados começarem a ser coletados.
- Página de auditoria detalhada por ação administrativa.

## Detalhes técnicos

- Email check via JWT claim `email` em `is_admin()` SQL e no handler (`context.claims.email`).
- Reaproveita `supabaseAdmin` para evitar 1000-row limit em listagens (paginação no UI).
- Toast com `sonner` para feedback de salvamento.
- Sem cores novas; usa tokens do `src/styles.css`.
