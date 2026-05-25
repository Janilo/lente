
## 1) Barra de progresso dividida

Reescrever `src/components/interview/InterviewProgress.tsx` para mostrar **duas barras empilhadas**:

- **Barra primária (perguntas principais)** — mais grossa (`h-2`).
  - Rótulo: `Pergunta X de N`.
  - Valor: `((X − 1) / N) * 100`. **Não avança** durante os aprofundamentos da pergunta X — só muda quando a entrevista passa para a pergunta principal X+1.
- **Barra secundária (aprofundamentos)** — mais fina (`h-1`, tom mais suave).
  - Só aparece quando `max_followups > 0`.
  - Rótulo: `Aprofundamento k de M` (ou `Sem aprofundamento` quando `k = 0`).
  - Valor: `(followups_done_for_current / max_followups) * 100`. Reseta a cada nova pergunta principal.

Ajuste em `src/lib/interview.functions.ts` no objeto `totals` devolvido por `getNextStep` para garantir que `current_position` aponte sempre para a pergunta raiz em curso (não incrementa em follow-ups) e que `followups_done_for_current` zere quando a raiz muda.

Nenhuma mudança no contrato `next`, nem em `PipelineStatus`.

## 2) Gravação contínua sem clicar a cada pergunta

Hoje, a cada pergunta, o respondente precisa clicar **Gravar** e depois **Parar/Enviar**. Vou unificar isso em `src/routes/r_.$slug.run.tsx` (componente `Recorder` + `RunInner`):

- Quando uma nova pergunta aparece e a câmera já está ativa, **iniciar a gravação automaticamente** após um pequeno preroll visual (contagem regressiva de 2–3s mostrando "Gravando em 3… 2… 1…"). Isso dá tempo do respondente ler a pergunta antes da fala.
- Substituir os dois botões por um único botão **"Concluir resposta"** (ou "Próxima pergunta") visível durante a gravação. Ao clicar, o `MediaRecorder` para, o blob é enviado e a próxima pergunta carrega.
- Assim que a próxima pergunta chega (`step` muda e não é `processing`/`done`), o ciclo recomeça: preroll → gravação automática → botão "Concluir resposta".
- Manter o botão **"Enviar vídeo"** (upload de arquivo) como alternativa, visível apenas durante o preroll/idle.
- Na **primeira pergunta**, manter o fluxo atual de "Ativar câmera" — só depois que o stream é concedido o preroll inicia.
- O stream da câmera continua persistente entre perguntas (já implementado).
- Indicador visual: badge vermelho "● Gravando · 0:12" no canto do vídeo durante a gravação; barra do preroll antes.

Sem auto-stop por silêncio nesta iteração — o respondente decide quando terminar. Se você quiser auto-stop por X segundos de silêncio, posso adicionar depois.

## Arquivos tocados

- `src/components/interview/InterviewProgress.tsx` (reescrita do JSX, mesmas props).
- `src/lib/interview.functions.ts` (ajuste fino em `totals`).
- `src/routes/r_.$slug.run.tsx` (auto-start com preroll, botão único "Concluir resposta", indicador de gravação).

Fora de escopo: STT, autenticação, `PipelineStatus`, câmera persistente (já feito).
