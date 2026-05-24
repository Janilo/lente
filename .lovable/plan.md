# Plataforma de Pesquisa Qualitativa em Vídeo

App onde pesquisadores criam estudos (contexto + questionário) e entrevistados respondem em vídeo, com a IA conduzindo follow-ups adaptativos. No final, o sistema transcreve, sintetiza padrões entre entrevistados, gera clipes de vídeo das citações que sustentam cada conclusão e produz recomendações de negócio.

## Stack
- **Lovable Cloud** (auth email+senha + Google, Postgres, Storage)
- **Lovable AI** (`google/gemini-3-flash-preview` para follow-ups; `gemini-2.5-pro` para síntese)
- **ElevenLabs Scribe** (transcrição com diarização e timestamps por palavra → essencial para os cortes)
- **MediaRecorder API** no navegador para gravar webcam/áudio

## Fluxo principal

### 1. Pesquisador (área autenticada)
- Cria um **Estudo**: título, objetivo de negócio, contexto da marca/produto, público-alvo
- Adiciona **perguntas** do roteiro (ordem, tipo, intenção)
- Configura nível de aprofundamento dos follow-ups (1–3 por pergunta)
- Gera **link público** do estudo para compartilhar com entrevistados

### 2. Entrevistado
- Acessa link, faz login rápido, dá consentimento de gravação
- Teste de câmera/microfone
- Para cada pergunta: vê a pergunta, grava resposta em vídeo
- Ao parar a gravação: vídeo é enviado ao Storage e transcrito; IA decide se faz follow-up ou avança
- Tela final de agradecimento

### 3. Análise (pesquisador)
- Dashboard do estudo: entrevistas concluídas, status de processamento
- Por entrevistado: transcrição completa + player do vídeo sincronizado
- **Síntese cross-entrevistas**: temas recorrentes, divergências, citações-chave
- **Clipes**: para cada insight, links com timestamp inicial/final apontando o trecho do vídeo
- **Recomendações de negócio** baseadas nos achados + contexto do estudo
- Exportação: PDF do relatório, CSV das transcrições

## Modelo de dados (Cloud)
- `profiles` (id, full_name, role: researcher/respondent)
- `user_roles` (tabela separada, enum researcher/respondent — padrão de segurança)
- `studies` (id, owner_id, title, context, business_goal, status, public_slug)
- `questions` (id, study_id, order, text, intent, max_followups)
- `interviews` (id, study_id, respondent_id, status, started_at, finished_at)
- `answers` (id, interview_id, question_id, parent_answer_id [follow-up], video_path, duration, transcript, words_json [timestamps])
- `insights` (id, study_id, theme, summary, evidence_json [referências a answers + start/end])
- `recommendations` (id, study_id, title, rationale, supporting_insights[])
- Storage bucket `interview-videos` (privado, signed URLs)

## Backend (server functions TanStack)

- `createStudy`, `updateStudy`, `addQuestion` — autenticadas
- `getStudyByPublicSlug` — pública (para entrevistado abrir)
- `startInterview`, `submitAnswer` (recebe path do vídeo no Storage e dispara transcrição)
- `transcribeAnswer` — chama ElevenLabs Scribe (`scribe_v2`, diarize+timestamps), salva `transcript` e `words_json`
- `generateFollowup` — Lovable AI: recebe contexto + pergunta + resposta transcrita; decide próxima pergunta ou null
- `synthesizeStudy` — Lovable AI Pro: lê todas transcrições + contexto, gera insights + evidências (com referências a answers e ranges de timestamp) + recomendações
- `getInterviewClip` — gera URL assinada do vídeo + range de tempo

## Telas
1. `/` landing
2. `/login` / `/signup` (email+senha, Google)
3. `/dashboard` lista de estudos do pesquisador
4. `/studies/new` e `/studies/$id/edit` (contexto + perguntas)
5. `/studies/$id` dashboard do estudo (entrevistas, síntese, recomendações)
6. `/studies/$id/insights/$insightId` detalhe com player + clipes
7. `/r/$slug` portal público do entrevistado (consentimento → teste AV → entrevista → fim)
8. `/r/$slug/interview` tela de gravação pergunta-por-pergunta

## Entregas faseadas
Para evitar mudanças grandes demais de uma vez:

**Fase 1 — Fundação**: Cloud + auth (email+Google), schema, criação/edição de estudos e perguntas, dashboard básico.

**Fase 2 — Captura**: portal público, gravação de vídeo no navegador, upload pro Storage, transcrição via ElevenLabs, follow-ups adaptativos da IA.

**Fase 3 — Análise**: síntese cross-entrevistas, clipes com timestamps, recomendações de negócio, exportação PDF/CSV.

## O que vou precisar do usuário
- Confirmar nome do produto / identidade visual desejada (ou posso propor)
- Chave **ELEVENLABS_API_KEY** (peço via formulário seguro quando chegarmos na Fase 2)
- Google sign-in: vou habilitar via broker da Lovable, sem configuração manual

## Notas técnicas
- Tabela `user_roles` separada (nunca em `profiles`) com função `has_role()` SECURITY DEFINER para RLS
- Vídeos privados; acesso apenas por signed URL gerada no backend
- Transcrição roda em server function (chave ElevenLabs no servidor)
- Clipes são "virtuais": player carrega vídeo completo e dá seek/loop ao range — sem reencode
- `synthesizeStudy` é caro/lento: executar sob demanda, com status "processing" persistido

Quero começar pela **Fase 1** assim que aprovado.