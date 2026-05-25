# Painel de status do pipeline

Hoje o estado do processamento aparece só via toasts efêmeros (`/r/$slug/run`) e como pílulas por resposta (detalhe da entrevista do pesquisador). Vamos consolidar tudo num painel persistente, igual nos dois lados, com atualização por polling.

## O que o painel mostra

Quatro etapas, na ordem do pipeline:

```text
①  Upload do vídeo            (cliente → storage)
②  Transcrição (ElevenLabs)   (status = transcribing → ready)
③  Follow-up (Gemini)         (computeNextStep gerou follow-up? / SKIP / sem follow-ups restantes)
④  Síntese pronta             (insights/recommendations existem para o estudo)
```

Cada etapa tem um de quatro estados visuais: `pendente`, `em andamento` (com spinner), `concluído` (check) e `falhou` (com mensagem). O painel mostra também a contagem de respostas processadas (`X de Y prontas`) e a duração da etapa atual.

## Onde aparece

**Respondente — `/r/$slug/run`** (versão compacta, lateral/topo):
- ① upload e ② transcrição refletem a resposta que acabou de ser enviada.
- ③ follow-up acende enquanto `computeNextStep` decide; vira "concluído" assim que o próximo step retorna `question` ou `done`.
- ④ síntese aparece desabilitada com legenda "disponível após o pesquisador gerar" — o respondente não dispara síntese.

**Pesquisador — `/studies/$id/interviews/$interviewId`** (versão completa, no topo):
- ①–③ agregam o estado de todas as respostas da entrevista (qualquer uma em `transcribing` → ② em andamento).
- ④ consulta `insights`/`recommendations` do estudo: "Síntese pronta · gerada em DD/MM" com link para `/studies/$id/synthesis`, ou "Síntese não gerada" com botão de ir até a página.

## Como atualiza

Polling com `useQuery` + `refetchInterval` dinâmico:
- 2,5s enquanto houver etapa em andamento.
- `false` (para o polling) quando tudo está `ready`/`done` e nada está pendente.

Reaproveita o padrão já existente em `studies.$id.interviews.$interviewId.tsx` (linhas 17–22).

## Mudanças no código

### Backend (1 server function nova, sem migration)

`src/lib/interview.functions.ts`:
- `getInterviewPipelineStatus({ interview_id })` — protegido por `requireSupabaseAuth`, autorizado tanto para `respondent_id = userId` quanto para o `owner_id` do estudo. Retorna:
  ```ts
  {
    answers: { total, uploading, transcribing, ready, failed },
    last_answer: { id, status, error_message, updated_at } | null,
    followup: { state: "idle" | "deciding" | "ready" | "skipped" | "exhausted" },
    synthesis: { has_insights: boolean, has_recommendations: boolean, last_generated_at: string | null },
  }
  ```
- `followup.state` é derivado: se `computeNextStep` retornaria `followup` → `ready`; se a última resposta está `ready` e ainda não há novo step decidido (ex.: chamada Gemini em voo no servidor) → `deciding`; se já passou para próxima pergunta → `skipped`; se atingiu `max_followups` → `exhausted`.

Observação: a chamada Gemini é síncrona dentro do `processAnswer`/`getNextStep` atuais, então `deciding` na prática é o intervalo curto entre o `ready` da transcrição e o próximo `getNextStep`. Não precisa adicionar fila — só refletir o estado computado.

### Frontend (1 componente compartilhado + 2 integrações)

- `src/components/interview/PipelineStatus.tsx` — componente único com prop `variant: "respondent" | "researcher"`. Renderiza as 4 etapas, recebe o resultado de `getInterviewPipelineStatus` e o `interview_id`. Faz seu próprio `useQuery` com polling.
- `src/routes/r.$slug.run.tsx` — monta `<PipelineStatus variant="respondent" interviewId={...} />` acima do `Recorder`. Remove os toasts redundantes ("Transcrevendo…") já cobertos pelo painel; mantém apenas erros.
- `src/routes/_authenticated/studies.$id.interviews.$interviewId.tsx` — monta `<PipelineStatus variant="researcher" interviewId={...} />` no topo, antes da lista de respostas. Mantém as `StatusPill` por resposta.

### Design

Lista vertical em card, cada linha com ícone circular (estado), título, sublegenda (ex.: "3 de 5 prontas", "Gerado há 12s", mensagem de erro). Usa tokens do design system (`primary`, `muted-foreground`, `destructive`). Spinner para `em andamento`, check para `concluído`, ponto cinza para `pendente`, X vermelho para `falhou`.

## Fora de escopo

- Realtime via Supabase (preterido pelo polling, conforme escolha).
- Notificações push / e-mail quando a síntese fica pronta.
- Histórico de tentativas de retry.
- Mudanças na lógica de geração de follow-up ou síntese.
