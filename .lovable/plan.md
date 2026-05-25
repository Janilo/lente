## Correção do erro AssemblyAI

A API do AssemblyAI está rejeitando a requisição porque o campo `speech_models` está sendo enviado vazio (ou ausente). Hoje, em `src/lib/stt.server.ts`, o body da chamada `POST /v2/transcript` é:

```json
{ "audio_url": "...", "language_code": "pt" }
```

### Mudança

Adicionar `speech_model: "universal"` ao body (campo singular aceito pela API do AssemblyAI, equivalente ao modelo `universal-2`/`universal-3-pro`).

Arquivo: `src/lib/stt.server.ts`, função `transcribeAssemblyAI`, passo 2 (create transcript):

```ts
body: JSON.stringify({
  audio_url: upload_url,
  language_code: "pt",
  speech_model: "universal",
}),
```

Isso resolve o 400 sem alterar mais nada do fluxo. As respostas que ficaram com `status = failed` continuarão sendo re-perguntadas automaticamente graças à lógica de recuperação já implementada em `computeNextStep`.