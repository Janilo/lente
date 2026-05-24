# Novas formas de montar o roteiro

Hoje, no editor do estudo (`/studies/$id`), o roteiro só pode ser construído pergunta por pergunta. Vou adicionar duas opções extras logo acima da lista atual, sem remover o fluxo manual.

## Opções na UI

Na seção "Roteiro de perguntas", três botões:
1. **+ Adicionar pergunta** (atual)
2. **Importar de arquivo** (novo)
3. **Gerar com IA** (novo)

### 1. Importar de arquivo
- Aceita `.txt`, `.md`, `.csv`, `.docx`, `.pdf`.
- Parsing:
  - `.txt`/`.md`/`.csv`: uma pergunta por linha (ignora vazias e cabeçalhos óbvios).
  - `.docx`/`.pdf`: extração de texto via server function, depois quebra por linha/numeração (`1.`, `-`, `•`).
- Pré-visualização das perguntas extraídas em um modal, com opção de editar/remover antes de confirmar.
- Ao confirmar: append ao final do roteiro existente (não substitui), preservando ordem.
- Server function `parseQuestionsFromFile` (recebe `study_id` + arquivo via FormData) → retorna `string[]` de perguntas-candidatas. Inserção continua usando o `upsertQuestion` existente em lote.

### 2. Gerar com IA
- Botão abre um modal com:
  - Resumo do contexto atual do estudo (título, objetivo de negócio, contexto, público).
  - Campo opcional "instruções extras" (ex: "foque em jornada de compra", "máx 8 perguntas").
  - Slider de quantidade alvo (5–15, default 8).
- Server function `generateQuestionScript`:
  - Usa Lovable AI Gateway, modelo `google/gemini-3-flash-preview`.
  - Tool calling para output estruturado: `{ questions: [{ text, intent }], clarifications: [string] }`.
  - System prompt: pesquisador qualitativo sênior; gerar perguntas abertas, não-enviesadas, em português, ordenadas do mais amplo ao mais específico, cada uma com `intent` curta.
  - Se o contexto for insuficiente, retorna `clarifications` com até 3 perguntas para o pesquisador antes de gerar.
- Fluxo no modal:
  - 1ª chamada → se vier `clarifications`, mostra inputs para responder; ao enviar, refaz a chamada incluindo as respostas no prompt.
  - Quando vier `questions`, mostra preview editável (mesma UI do import). Confirmar → append ao roteiro.
- Tratamento de erros 429/402 com toast amigável (rate limit / créditos).

## Backend

Novos server functions em `src/lib/studies.functions.ts` (ou novo `src/lib/script-builder.functions.ts` para não inflar):
- `parseQuestionsFromFile({ study_id, fileBase64, mimeType, fileName })` — autenticado, valida ownership do estudo.
- `generateQuestionScript({ study_id, extraInstructions?, targetCount?, clarificationAnswers? })` — autenticado, valida ownership, chama Lovable AI.
- `bulkAddQuestions({ study_id, questions: {text, intent?}[] })` — insere em ordem após a última `position` existente.

Sem mudanças de schema — as tabelas `questions` e `studies` já suportam tudo.

## Frontend

- Novo componente `src/components/study/ScriptBuilderActions.tsx` com os 3 botões + modais (`Dialog` do shadcn).
- Modal de preview reutilizável `QuestionsPreviewDialog` para os dois fluxos novos (lista editável de perguntas candidatas com remover/editar/confirmar).
- Integra no `studies.$id.tsx` substituindo o botão único atual.

## Dependências

- Parser `.docx`: `mammoth` (puro JS, roda no Worker).
- Parser `.pdf`: `pdf-parse` tende a falhar no Worker; vou usar `unpdf` (edge-compatible) ou cair em mensagem "PDF não suportado, cole o texto" se houver problema. Decido na implementação após teste rápido.

## Detalhes técnicos

- Upload: arquivo lido no client como base64 e enviado via JSON ao server fn (limitando a ~2MB) — evita FormData multipart com TanStack server fn.
- Toda chamada de IA é server-side; `LOVABLE_API_KEY` já está configurada.
- Preview sempre permite edição antes de salvar — nada vai direto pro banco sem confirmação.

## Fora de escopo

- Não vou substituir o editor manual atual, só somar opções.
- Não vou tocar no fluxo público de entrevista (Fase 2).
- Não vou regenerar/sobrescrever perguntas existentes — append apenas.