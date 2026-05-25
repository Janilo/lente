# Plano

## 1. Bug Chrome — "Iniciar entrevista" só muda a URL

**Diagnóstico:** Em `src/routes/r_.$slug.tsx`, o botão navega para `/r/$slug/run`. Como `r.$slug.tsx` foi renomeado para `r_.$slug.tsx`, o arquivo filho `r.$slug.run.tsx` virou rota órfã que ainda funciona no Safari, mas no Chrome o build em cache pode estar servindo a árvore antiga (Service Worker / cache HTTP agressivo). Além disso, o `r.$slug.run.tsx` ainda está com `createFileRoute("/r/$slug/run")` sem um pai explícito, o que é frágil.

**Correção:**
- Renomear `src/routes/r.$slug.run.tsx` → `src/routes/r_.$slug.run.tsx` e atualizar `createFileRoute("/r_/$slug/run")` para deixar a hierarquia consistente.
- Atualizar a navegação em `r_.$slug.tsx` para `to: "/r_/$slug/run"`.
- Manter o link público `/r/$slug` funcionando via redirect: criar um `src/routes/r.$slug.tsx` minimalista que apenas faz `redirect({ to: "/r_/$slug", params: { slug } })` em `beforeLoad`, para que links já compartilhados continuem válidos.
- Adicionar `<meta http-equiv="Cache-Control" content="no-cache">` no `__root.tsx` head para mitigar cache agressivo no Chrome.

## 2. "Esqueceu a senha?" no login

- Adicionar link "Esqueceu a senha?" em `src/routes/login.tsx`.
- Criar `src/routes/forgot-password.tsx`: input de email → `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`.
- Criar `src/routes/reset-password.tsx`: rota pública, detecta `type=recovery` no hash, mostra form de nova senha → `supabase.auth.updateUser({ password })`.
- Estilo consistente com `login.tsx` / `signup.tsx`.

## 3. Painel de respondentes (perfil do pesquisador, conformidade LGPD)

### Decisões do produto (já confirmadas)
- Mostrar **email + nome** do respondente.
- **Consentimento LGPD via checkbox** antes de iniciar a entrevista, com registro auditável.
- **Qualidade da resposta = score IA (0–100) por pergunta** comparando a resposta à intenção da pergunta.

### Banco de dados (1 migração)
- Tabela `consents`: `id`, `interview_id`, `user_id`, `study_id`, `consent_version` (texto), `accepted_at`, `ip_address`, `user_agent`. RLS: respondente insere o próprio; dono do estudo lê os de suas pesquisas; ninguém deleta (apenas via processo de exclusão de dados).
- Adicionar coluna `quality_score INT` (0–100) e `quality_reasoning TEXT` em `answers`.
- View `respondent_panel` (security_invoker=on) consolidando por entrevista: `interview_id`, `study_id`, `respondent_id`, email + full_name (via join com `auth.users` e `profiles`), `started_at`, `finished_at`, `status`, contagem de respostas/total de perguntas, score médio de qualidade, `consent_accepted_at`. Acessível apenas pelo dono do estudo (via política na função de leitura, não na view).
- Função RPC `delete_respondent_data(p_interview_id uuid)` SECURITY DEFINER: apaga answers (vídeos + linhas), interview e consent referentes ao respondente (executado pelo próprio respondente ou pelo dono do estudo). Para vídeos no storage, fazer remove em lote.

### Server functions (novas em `src/lib/respondents.functions.ts`)
- `listStudyRespondents({ study_id })` — dono do estudo lista todos respondentes com agregados.
- `getRespondentDetail({ interview_id })` — detalhe por entrevista, incluindo respostas, transcrições, scores, links assinados de vídeo.
- `scoreAnswerQuality({ answer_id })` — chama Lovable AI Gateway (google/gemini-2.5-flash) com prompt: transcrição + texto/intenção da pergunta → JSON `{ score: 0-100, reasoning }`. Grava em `answers.quality_score` e `quality_reasoning`. Dispara automaticamente quando uma resposta vira `ready`.
- `exportInterviewRawData({ interview_id })` — gera ZIP server-side (ou JSON + URLs assinadas dos vídeos) com: metadados da entrevista, consentimento (versão, timestamp, IP, user-agent), perguntas, respostas com transcrição/score, URLs temporárias dos vídeos (válidas 1h). Retorna como download.
- `deleteRespondentData({ interview_id })` — wrapper da RPC, com confirmação.

### UI
- **Consentimento (em `r_.$slug.tsx`):** antes de habilitar "Iniciar entrevista", checkbox obrigatório com texto LGPD claro (gravação de vídeo, transcrição por IA, retenção, contatos do controlador, direito de exclusão). Ao iniciar, inserir linha em `consents`. Versão do termo = constante `LGPD_CONSENT_V1`.
- **Novo painel:** `src/routes/_authenticated/studies.$id.respondents.tsx`
  - Tabela: Nome, Email, Cadastrado em, Status, Etapas (X/Y respondidas), Score médio de qualidade, Consentimento (✓ + data), Ações.
  - Ações por linha: "Ver detalhes" → drawer com perguntas, respostas (player de vídeo via signed URL), transcrição, score IA + raciocínio. Botão "Baixar dados brutos (ZIP)". Botão "Apagar dados deste respondente" (LGPD – direito ao esquecimento) com confirmação.
  - Aviso no topo: dados pessoais — uso restrito ao pesquisador, conforme termo aceito pelo respondente.
- **Link** para o painel no header de `studies.$id.tsx` ("Respondentes").
- **Página self-service** `src/routes/_authenticated/my-privacy.tsx`: respondente vê suas entrevistas, baixa seus dados, solicita exclusão.

### Conformidade LGPD — garantias implementadas
- Base legal: consentimento explícito, versionado, auditável (IP + user-agent + timestamp).
- Finalidade: declarada no termo.
- Minimização: pesquisador só vê dados do próprio estudo (RLS).
- Direito de acesso: respondente baixa próprios dados em `/my-privacy`.
- Direito de exclusão: respondente e pesquisador podem apagar (RPC remove vídeos + linhas).
- Segurança: vídeos via signed URL (1h), bucket privado, RLS em todas as tabelas.

## Detalhes técnicos

- **Score IA:** modelo `google/gemini-2.5-flash` (rápido/barato), prompt em PT-BR, output JSON via `response_format`. Trigger: após `answers.status = 'ready'`, server-fn `scoreAnswerQuality` rodada em background (chamada do cliente após o polling detectar `ready`).
- **Export ZIP:** usar `jszip` no Worker (compatível). Vídeos referenciados por signed URL (não embutidos no ZIP para evitar timeout).
- **Cache Chrome:** adicionar `Cache-Control: no-store` no SSR do `__root.tsx` apenas se o renomeio de rota não resolver sozinho.

## Arquivos afetados (resumo)
- Criar: `src/routes/forgot-password.tsx`, `src/routes/reset-password.tsx`, `src/routes/_authenticated/studies.$id.respondents.tsx`, `src/routes/_authenticated/my-privacy.tsx`, `src/routes/r.$slug.tsx` (redirect), `src/lib/respondents.functions.ts`, `src/components/interview/ConsentCheckbox.tsx`, `src/components/respondents/RespondentDetail.tsx`.
- Renomear: `src/routes/r.$slug.run.tsx` → `src/routes/r_.$slug.run.tsx`.
- Editar: `src/routes/login.tsx` (link forgot), `src/routes/r_.$slug.tsx` (consentimento + nova nav), `src/routes/_authenticated/studies.$id.tsx` (link Respondentes), `src/lib/interview.functions.ts` (gravar consent + trigger score).
- Migração SQL: tabela `consents`, colunas em `answers`, view `respondent_panel`, RPC `delete_respondent_data`, RLS.
