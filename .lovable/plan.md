## Problema

Quando o entrevistado clica em "Concluir resposta" sem ter falado, o áudio é enviado mas a transcrição volta vazia. O `processAnswer` salva o answer como `status: "ready"` com `transcript: ""`. Em seguida, `computeNextStep` faz o filtro `a.status === "ready" && a.transcript` — como o transcript é string vazia (falsy), considera que ainda está em processamento e devolve `{ type: "processing" }`. O front fica re-polando a cada 2.5s e oscilando entre "Processando…" e a próxima tela, sem nunca avançar.

Além disso, hoje nada impede o usuário de finalizar com 0–1s de gravação.

## Solução

Tratar resposta vazia como falha recuperável e avisar o entrevistado para repetir a pergunta. Sem mudar o pipeline de STT nem o esquema.

### 1) Backend — `src/lib/interview.functions.ts`

No `processAnswer`, após `transcribeAudio`:
- Se `transcript.trim()` estiver vazio (ou abaixo de ~2 caracteres), **não** salvar como `ready`. Marcar como:
  ```
  status: "failed",
  error_message: "Nenhuma fala detectada no vídeo."
  ```
  e **não** disparar `scoreAnswerInternal`.
- Retornar `{ next, empty: true }` para o cliente saber que precisa avisar e re-perguntar.

Isso já se encaixa no `computeNextStep` atual:
- Para **pergunta principal** falhada: `forQ` (que filtra `status !== "failed"`) fica vazio → devolve a mesma pergunta novamente.
- Para **follow-up** falhado: já existe o branch que detecta `lastForQ.status === "failed" && lastForQ.is_followup` e re-pergunta o mesmo follow-up. 

Nenhuma migração necessária — `failed` já é estado válido.

### 2) Frontend — `src/routes/r_.$slug.run.tsx`

**a)** Em `handleRecorded`, após `processAns`, se `r.empty === true`:
- `toast.warning("Não captamos nenhuma fala. Por favor, repita a resposta.")`
- Não exibir "Entrevista concluída".
- Chamar `loadNext(interviewId)` normalmente (que vai trazer a mesma pergunta de volta, com `totals` consistentes pois a tentativa falhou não conta como follow-up feito — `getNextStep` já filtra `a.status !== "failed"` em `followups_done_for_current`).

**b)** Prevenção no `Recorder`:
- Definir `MIN_RECORDING_SECONDS = 2`.
- O botão "Concluir resposta" fica desabilitado (com tooltip "Aguarde alguns segundos…") enquanto `elapsed < MIN_RECORDING_SECONDS`.
- Após esse limite, fica habilitado normalmente. (Não bloqueia gravação silenciosa, só clique-acidental imediato — a detecção real de "falou nada" continua sendo a do STT no backend.)

### 3) Sem alterações em

- `InterviewProgress.tsx` (já lida bem com re-tentativa pois totals são recomputados).
- `stt.server.ts`.
- Pipeline de câmera persistente.
- Auth / RLS / migrations.

## Arquivos a editar

- `src/lib/interview.functions.ts` — branch de transcript vazio em `processAnswer`, devolver `empty` no retorno.
- `src/routes/r_.$slug.run.tsx` — toast + re-load em `empty`, gate de 2s no botão "Concluir resposta".
