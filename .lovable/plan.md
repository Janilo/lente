## Objetivo

1. Ao importar um arquivo, identificar a estrutura real do roteiro (cabeçalho, blocos, objetivos de bloco, perguntas) — não tratar cada linha como pergunta.
2. No popup de revisão, permitir editar a estrutura e **adicionar manualmente novas perguntas** (além das que vieram do arquivo), removendo o teto rígido de 50.

## Mudanças

### Backend — `src/lib/script-builder.functions.ts`

- `parseQuestionsFromFile`: continua extraindo o texto bruto do arquivo (.txt/.md/.csv/.docx/.pdf), mas em vez de cortar linha-a-linha, manda o texto para o Lovable AI Gateway (`google/gemini-3-flash-preview`) com um tool-call estruturado pedindo:
  ```
  {
    header: string,              // título/resumo do roteiro (opcional)
    blocks: [{
      title: string,             // nome do bloco (ex: "Aquecimento")
      objective: string,         // objetivo do bloco (opcional)
      questions: [{ text, intent }]
    }]
  }
  ```
  Prompt instrui o modelo a distinguir cabeçalho, objetivos de bloco e perguntas; ignorar instruções para o entrevistador; preservar a ordem original. Fallback para o split por linha atual se a IA falhar ou não retornar perguntas.
- `bulkAddQuestions`: aceita até 200 perguntas (em vez de 50) e aceita um campo opcional `block_title` por pergunta — concatenado no `intent` final como `"[Bloco] · intenção"` para não exigir mudança de schema.

### Frontend — `src/components/study/ScriptBuilderActions.tsx`

- Novo tipo `ParsedScript` com `header`, `blocks[]`. Estado do preview vira essa estrutura em vez de uma lista plana.
- `PreviewDialog` reescrito:
  - Campo de cabeçalho editável (apenas referência visual, não é salvo como pergunta).
  - Cada bloco: título e objetivo editáveis, lista de perguntas (text + intent), botões "Remover pergunta", "+ Adicionar pergunta neste bloco", "Remover bloco".
  - Botão "+ Adicionar bloco" no final.
  - Botão "+ Adicionar pergunta avulsa" para casos sem bloco.
  - Confirmação achata a estrutura em `{ text, intent: "Bloco · objetivo · intenção" }` e chama `bulkAddQuestions`.
- Resultado da geração por IA (`AIGenerateDialog`) é convertido para a mesma estrutura (um único bloco "Roteiro gerado") para reusar o mesmo preview.

### Sem mudanças

- Schema do banco, rotas, autenticação, fluxo de geração por IA permanecem iguais.
- Limite de tamanho de arquivo (5MB) e formatos aceitos não mudam.

## Notas técnicas

- A chamada à IA dentro de `parseQuestionsFromFile` reusa o mesmo padrão de `generateQuestionScript` (mesmo gateway, mesmo tratamento de 429/402).
- Texto extraído é truncado em ~30k caracteres antes de mandar pra IA para evitar contexto excessivo.
- Se o arquivo for muito simples (uma pergunta por linha), a IA ainda funciona — devolve um único bloco sem objetivo.
