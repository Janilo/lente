
## 1. Upload da entrevista completa (pesquisador)

**Nova rota:** `/_authenticated/studies/$id/interviews/upload`

Formulário com:
- Vídeo (mp4/webm/mov, até ~500 MB)
- Dados básicos do respondente "externo" (nome, e-mail opcional, cidade, estado, faixa etária, cargo, setor) — gravados como metadados na própria entrevista, **sem** criar usuário no Supabase Auth
- Botão "Enviar e processar"

**Fluxo:**
1. Cria registro em `interviews` marcado como `source = 'upload'`, com `respondent_id` = dono do estudo (placeholder) e metadados em uma nova coluna `external_respondent jsonb`.
2. Faz upload do vídeo para `interview-videos/{interview_id}/full.{ext}`.
3. Server fn `processUploadedInterview` (POST, dono do estudo):
   - Baixa o vídeo, transcreve via `stt.server.ts` (já existe — Eleven/AssemblyAI).
   - Chama Lovable AI (`google/gemini-2.5-pro`) com a transcrição + lista de perguntas do estudo, retornando JSON via tool-calling: para cada pergunta `{question_id, answer_transcript, start_seconds, end_seconds}`.
   - Cria uma linha em `answers` por pergunta com `transcript`, `status='ready'`, `is_followup=false`, `video_path` apontando para o vídeo completo + faixa de tempo (novos campos `start_seconds`, `end_seconds`).
   - Dispara o pipeline de enriquecimento (passo 2 abaixo) e marca `interviews.status='completed'`.

**Permissão:** qualquer dono do estudo. Tamanho/tipo validados client-side e via política de storage.

---

## 2. Painel estruturado do estudo

**Rota substitui o conteúdo atual de:** `/_authenticated/studies/$id/interviews`

Tabela com uma linha por entrevista, colunas (PT-BR):
- **ID** (#sequencial dentro do estudo)
- **Iniciada em** (started_at)
- **Tempo ativo** (duração — soma de `duration_seconds` ou `finished_at - started_at`)
- **Progresso** (Concluída / Em andamento / Falhou)
- **Qualidade** (Excelente/Boa/Média/Baixa — derivado do média de `answers.quality_score`)
- **Segmentos** (chips coloridos, ex: "Price & Value Focused", "Young Adults (18-24)")
- **Resumo em bullets** (3-5 bullets curtos)
- **Tagline** (uma linha resumindo o respondente)
- **Tags** (chips com termos-chave — cidade, perfil, etc.)
- **Q1, Q2, …** uma coluna por pergunta do estudo, mostrando o resumo curto da resposta (com tooltip/expand para a transcrição completa)

Tabela com:
- Filtros por coluna (texto/chip simples — usando os `Filter` icons como na figura, com `Input` por coluna)
- Scroll horizontal, header sticky, link na linha → detalhe atual da entrevista
- Botão **"Enviar entrevista"** levando à rota de upload
- Botão **"Reprocessar IA"** por linha (opcional, fora do auto)

---

## 3. Geração automática por IA (ao concluir entrevista)

Nova função em `src/lib/synthesis.functions.ts` (ou novo `interview-enrichment.functions.ts`):

`enrichInterview(interview_id)` — invocada automaticamente quando:
- Última resposta vira `ready` em `processAnswer` e `computeNextStep` retorna `done`
- Final de `processUploadedInterview`

Faz **uma** chamada Lovable AI (`google/gemini-2.5-pro`, tool-calling) recebendo todas as transcrições + perguntas + perfil do respondente, e retornando JSON:

```json
{
  "quality": "excellent|good|average|low",
  "segments": ["..."],
  "tags": ["..."],
  "bullet_summary": ["...", "..."],
  "tagline": "...",
  "answer_summaries": [{ "question_id": "...", "summary": "..." }]
}
```

Salvo em nova tabela `interview_insights` (1-para-1 com interview).

---

## Detalhes técnicos

### Migrações
- `ALTER TABLE interviews ADD COLUMN source text NOT NULL DEFAULT 'live'` (live | upload)
- `ALTER TABLE interviews ADD COLUMN external_respondent jsonb` (nome, email, city, state, age_range, occupation, industry)
- `ALTER TABLE answers ADD COLUMN start_seconds numeric, ADD COLUMN end_seconds numeric` (faixa do vídeo único, opcional)
- Nova tabela `public.interview_insights`:
  - `interview_id uuid PK references interviews`
  - `quality text`, `segments text[]`, `tags text[]`, `bullet_summary text[]`, `tagline text`, `answer_summaries jsonb`, `model text`, `created_at`, `updated_at`
  - RLS: dono do estudo lê/escreve (via join com `interviews`/`studies`)
- Política de storage `interview-videos`: permitir INSERT do dono do estudo no path `{interview_id}/*` quando interview existe e é do estudo dele.

### Server functions novas (`src/lib/interview.functions.ts` + nova `interview-enrichment.functions.ts`)
- `createUploadedInterview({study_id, external_respondent})` → retorna `interview_id` + storage path para upload direto via SDK
- `processUploadedInterview({interview_id, video_ext})` → STT + segmentação por IA + cria `answers`
- `enrichInterview({interview_id})` → gera/atualiza `interview_insights`
- `listStudyInterviewsTable({study_id})` → estende o atual `listStudyInterviews` retornando perguntas do estudo, insights e summaries (uma chamada para popular a tabela)

### Componentes
- `src/components/study/InterviewsTable.tsx` — tabela com colunas dinâmicas (Q1..Qn) e filtros por coluna
- `src/components/study/UploadInterviewForm.tsx` — formulário de upload + barra de progresso
- Chips reutilizando o componente `Badge`

### Fora de escopo (não fazer agora)
- Editor manual dos insights gerados (só reprocessamento)
- Exportar CSV/Excel da tabela
- Vídeo completo "fatiado" em players por pergunta (só transcrição segmentada; o player do detalhe continua usando o vídeo completo com tempo inicial quando houver `start_seconds`)
- Mudanças no fluxo de entrevista ao vivo (respondent-side) além do gancho de enriquecimento ao final
