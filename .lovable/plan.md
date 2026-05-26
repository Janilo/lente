
## O que será enviado ao HubSpot

### 1) Pesquisador (cadastro via `/signup` sem `returnTo=/r/...`)
Upsert de **Contato** no HubSpot por e-mail, com:
- `email`
- `firstname` / `lastname` (derivados de `full_name`)
- `lente_role = "researcher"` (propriedade custom)
- `lente_signup_source = "lente_app"`
- `lifecyclestage = "lead"`

Adicionalmente, cria uma **Nota** associada ao contato:
> "Novo pesquisador cadastrado em Lente — {data}."

### 2) Respondente (cadastro vindo de um link de estudo `/r/{slug}` ou ao iniciar a entrevista)
Upsert de **Contato** por e-mail, com:
- `email`, `firstname`, `lastname`
- `lente_role = "respondent"`
- `lente_signup_source = "lente_app"`
- `lente_last_study_title` = título do estudo
- `lente_last_study_slug` = slug
- `lifecyclestage = "lead"`

Cria uma **Nota** associada:
> "Respondente cadastrado para o estudo '{título}' ({slug}) em {data}."

Se o mesmo e-mail já existir como pesquisador, mantém o contato e apenas acrescenta a nota + atualiza `lente_last_study_*` (não sobrescreve `lente_role`).

---

## Como será implementado

### Server function única `syncHubspotContact`
Arquivo novo: `src/lib/hubspot.functions.ts` + helper server-only `src/lib/hubspot.server.ts`.

Entrada (Zod):
```
{ email, full_name?, role: "researcher" | "respondent",
  study?: { id, title, slug } }
```

Comportamento:
1. Chama o gateway `https://connector-gateway.lovable.dev/hubspot/crm/v3/objects/contacts/{email}?idProperty=email` (GET) para descobrir se contato já existe.
2. Se não existe → `POST /crm/v3/objects/contacts` com as propriedades acima.
   Se existe → `PATCH /crm/v3/objects/{id}` (não rebaixa `lente_role` de researcher para respondent).
3. Cria nota: `POST /crm/v3/objects/notes` com `hs_note_body` + `hs_timestamp`, e associa ao contato (`/crm/v3/objects/notes/{noteId}/associations/contacts/{contactId}/note_to_contact`).
4. Erros do HubSpot são logados mas **não bloqueiam** o cadastro/início de entrevista (chamada fire-and-forget no servidor com try/catch).

Autenticação: headers `Authorization: Bearer ${LOVABLE_API_KEY}` + `X-Connection-Api-Key: ${HUBSPOT_API_KEY}` (segredos já disponíveis).

### Pontos de gatilho
- **`src/routes/signup.tsx`**: após `supabase.auth.signUp` bem-sucedido e após retorno do Google (no `useEffect` de `isAuthenticated`), chama `syncHubspotContact` com `role = "researcher"` se `returnTo` não começa com `/r/`, senão `"respondent"` (e tenta achar o estudo pelo slug do `returnTo`).
- **`src/lib/interview.functions.ts` → `startInterview`**: ao iniciar a entrevista (já é server fn autenticada e conhece o estudo), dispara `syncHubspotContact` com `role = "respondent"` e dados do estudo. Isso garante cobertura mesmo quando o respondente entra via Google (sem passar pelo handler do `/signup`) ou já tinha conta.

### Propriedades custom no HubSpot
Na primeira execução, o helper tenta criar (idempotente, ignora 409) as propriedades em `contacts`:
- `lente_role` (enumeration: researcher, respondent)
- `lente_signup_source` (single-line text)
- `lente_last_study_title` (single-line text)
- `lente_last_study_slug` (single-line text)

Via `POST /crm/v3/properties/contacts`. Se a criação falhar por permissão, os campos custom são omitidos do payload e seguimos só com os padrões (`email`, `firstname`, `lastname`, `lifecyclestage`) + nota.

### Fora de escopo
- Criação de Deals/Companies no HubSpot.
- Sincronização retroativa de usuários já existentes (só novos a partir da implementação).
- Webhook do HubSpot de volta para o app.
- UI no painel para ver status da sincronização (apenas logs do servidor).

---

## Confirmações antes de implementar
1. OK criar as propriedades custom `lente_role`, `lente_signup_source`, `lente_last_study_title`, `lente_last_study_slug` no seu HubSpot?
2. OK marcar todos os contatos como `lifecyclestage = lead`, ou prefere outro estágio (ex.: `subscriber`)?
