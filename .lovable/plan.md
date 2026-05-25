## Objetivo

Adicionar uma chamada secundária no `BrandFooter` que leva o visitante para o formulário externo já existente em `https://pereirasaraiva.com/respondentes`. Sem nova página interna, sem formulário, sem integração HubSpot.

## Mudança

**`src/components/brand/BrandFooter.tsx`** (única edição)

- Acrescentar um bloco secundário acima/junto do rodapé existente com:
  - Eyebrow curto: "Participe"
  - Título: "Quer participar como respondente?"
  - Link/botão: "Cadastre-se aqui" → `https://pereirasaraiva.com/respondentes`
- O link usa `<a href="..." target="_blank" rel="noopener noreferrer">` (sai do app).
- Estilo segue os tokens editoriais já usados no footer; sem cores novas, sem alterar layout existente.

## Fora de escopo

- Não cria `src/routes/respondentes.tsx`.
- Não cria `src/lib/respondents-signup.functions.ts`.
- Não conecta HubSpot nem solicita secrets.
- Nenhuma alteração em fluxo de entrevista, auth, schema ou outras rotas.
