
## 1) Substituir "Status do pipeline" por barra de progresso (lado respondente)

Hoje `src/routes/r_.$slug.run.tsx` mostra o `PipelineStatus` (4 etapas técnicas: upload → transcrição → follow-up → síntese) — informação operacional que faz sentido para o pesquisador, não para quem está respondendo.

Mudanças:

- Criar `src/components/interview/InterviewProgress.tsx`: uma barra fina (componente `Progress` do shadcn) + rótulo "Pergunta X de N · M de aprofundamento" e marcador discreto quando a etapa atual é follow-up.
- Em `r_.$slug.run.tsx`, substituir os dois usos de `<PipelineStatus variant="respondent" />` (telas de pergunta e de processing) por `<InterviewProgress />`.
- Manter `PipelineStatus` intacto para o pesquisador (`studies.$id.interviews.$interviewId.tsx`).

Fonte dos números: o `next` já devolve `position` da pergunta atual; o total de perguntas pode vir de uma extensão pequena em `getNextStep` (devolver `{ next, totals: { question_count, current_position, followups_for_current, max_followups } }`) ou via um campo adicional em `getInterviewPipelineStatus`. Vou estender `getNextStep` — é o que o run page já chama.

## 2) Pedir câmera apenas na primeira pergunta

Hoje `Recorder` é re-montado a cada pergunta (graças à `key={...}` em `r_.$slug.run.tsx`), o que descarta o `MediaStream` e força "Ativar câmera" toda vez. Além disso, no fim de cada gravação o `onstop` faz `streamRef.current?.getTracks().forEach(t => t.stop())`.

Mudanças em `r_.$slug.run.tsx`:

- Içar o `MediaStream` para o componente pai (`RunInner`) num `useRef`, junto com um único `<video>` preview persistente.
- Remover a `key` que força remount do Recorder; em vez disso, passar a pergunta atual como prop e resetar só o estado de gravação (`chunks`, `elapsed`, `state`) quando a pergunta muda.
- No `onstop` do `MediaRecorder`, NÃO parar as tracks; apenas zerar `chunksRef` e voltar `state` para `ready`.
- Parar as tracks só no unmount do `RunInner` (fim da entrevista ou saída da página) e quando `step.type === "done"`.
- Continuar oferecendo o botão "Enviar vídeo" (upload de arquivo) como alternativa; nesse caso a câmera continua ativa para a próxima pergunta de vídeo.

Resultado: o respondente concede permissão uma única vez e o preview da câmera fica visível durante toda a entrevista.

## 3) Erro da API de transcrição — diagnóstico

O painel mostra "3 de 5 transcritas · 2 com falha". Olhando o histórico:

- Originalmente o STT era ElevenLabs e quebrou por falta de crédito.
- Mudamos para AssemblyAI. A primeira tentativa foi com `speech_model: "universal"` (singular) → a AssemblyAI rejeitou com 400 `"speech_models" must be a non-empty list containing one or more of: "universal-3-pro", "universal-2"`.
- A correção atual em `src/lib/stt.server.ts` já envia `speech_models: ["universal-3-pro"]` no corpo (forma de lista, como a API exige).

Conclusão: as 2 falhas registradas são das tentativas anteriores à correção (a coluna `answers.error_message` guarda a última mensagem). Nada está quebrado agora — basta:

- Confirmar que a chave `ASSEMBLYAI_API_KEY` está setada (já estava, pois a chamada chegou a retornar 400, não 401).
- "Re-tentar" as 2 respostas falhas: o `computeNextStep` já trata `status='failed'` re-pedindo a pergunta ao respondente. Na próxima visita à entrevista o respondente é convidado a regravar essas 2 perguntas e a transcrição roda no modelo correto.

Se quiser, posso adicionar um botão "Tentar transcrever novamente" no painel do pesquisador (reprocessa o vídeo já gravado em vez de pedir nova gravação) — me confirma e incluo no escopo.

## Detalhes técnicos

- `getNextStep` passa a retornar também `totals` (consulta `questions` count + `answers` para a pergunta atual). Sem mudança no contrato `next`.
- `InterviewProgress` usa `Progress` (`src/components/ui/progress.tsx`) com `value = (current_position - 1 + done_fraction) / total * 100`.
- Tracks da câmera: ciclo de vida controlado por `useEffect(() => () => stopStream(), [])` no `RunInner`.

## Arquivos tocados

- `src/components/interview/InterviewProgress.tsx` (novo)
- `src/routes/r_.$slug.run.tsx` (substituir status + içar stream)
- `src/lib/interview.functions.ts` (adicionar `totals` ao retorno de `getNextStep`)

Nenhuma mudança em `stt.server.ts` (já corrigido), nem na variante "researcher" do `PipelineStatus`.
