# Glossário do domínio — Lente

> Item F-A5 da auditoria: o grão e o nome canônico de cada substantivo, para
> código novo (humano ou IA) não criar sinônimo. Regra geral: **código e schema
> em inglês; UI e prompts em PT-BR** — a fronteira é a tela.

| Termo (código/schema)                                       | Grão                  | O que é                                                                                                                                                                                             |
| ----------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **study** (`studies`)                                       | raiz                  | a pesquisa do pesquisador: roteiro, screener, convites, síntese                                                                                                                                     |
| **question** (`questions`)                                  | estudo                | pergunta do roteiro (posição + intent); base do runner                                                                                                                                              |
| **interview** (`interviews`)                                | estudo × respondente  | uma sessão de entrevista; `status: in_progress → completed`                                                                                                                                         |
| **answer** (`answers`)                                      | entrevista × pergunta | resposta em vídeo/texto; `is_followup` marca desdobramento                                                                                                                                          |
| **followup**                                                | resposta              | pergunta de aprofundamento gerada por IA; limitada por `studies.max_followups`                                                                                                                      |
| **respondent**                                              | pessoa                | quem responde. Tabela de perfil: `respondent_profile` (**singular**, legado); fatias: `respondents.*`, `respondent-pool.*` (**plural** — padrão para código novo); rota PT-BR: `admin.respondentes` |
| **insight** (`insights`)                                    | **estudo**            | achado da síntese do estudo (com `recommendations`)                                                                                                                                                 |
| **interview_insight** (`interview_insights`)                | **entrevista**        | enriquecimento de UMA entrevista: quality/tags/segments/tagline/resumos                                                                                                                             |
| **screener** (`screener_questions`, `screener_submissions`) | estudo                | triagem de candidatos antes da entrevista                                                                                                                                                           |
| **qualification**                                           | respondente           | perfil/tags que o respondente preenche uma vez (`respondent_tags`, `tag_dimensions`, `tag_values`)                                                                                                  |
| **recruitment** / **invitation** (`study_invitations`)      | estudo × respondente  | convite do pool para participar                                                                                                                                                                     |
| **synthesis**                                               | estudo                | análise agregada das entrevistas → gera `insights`                                                                                                                                                  |
| **compensation** (`compensation_log`)                       | respondente           | recompensa por participação                                                                                                                                                                         |
| **consent** (`consents`)                                    | entrevista            | consentimento LGPD, idempotente; ver `lgpd.ts` e rota `my-privacy`                                                                                                                                  |

## As duas armadilhas de nome

1. **"insight" sozinho é ambíguo** — diga _insight de estudo_ (`insights`) ou
   _insight de entrevista_ (`interview_insights`). São entidades distintas de
   propósito; não misture ao gerar código.
2. **"respondent" muda de número** — `respondent_profile` (tabela, singular) é
   legado; em código novo use **plural** (`respondents…`), e `respondentes` só
   em URL/texto PT-BR.
