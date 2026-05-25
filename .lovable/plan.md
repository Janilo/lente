# Correção do 404 ao iniciar entrevista

## Causa
As rotas estão nomeadas `r_.$slug.tsx` e `r_.$slug.run.tsx`. A convenção `_` do TanStack significa "não aninhar no layout", então as URLs reais são `/r/$slug` e `/r/$slug/run` (sem underscore). Porém, vários pontos do código navegam para strings literais com `/r_/...`, que o TanStack trata como URL crua e não casa com nenhuma rota → 404.

Além disso, o `NotFoundComponent` no `__root.tsx` tem um `<Link to="/">` fixo, levando qualquer 404 para a home do entrevistador.

## Mudanças

**1. `src/routes/r_.$slug.tsx`**
- Trocar `to: "/r_/$slug/run"` por `to: "/r/$slug/run"` no `onSuccess` do `useMutation`.
- Trocar `returnTo = \`/r_/${slug}/run\`` por `\`/r/${slug}/run\``.

**2. `src/routes/r_.$slug.run.tsx`**
- Trocar `returnTo: \`/r_/${slug}/run\`` por `\`/r/${slug}/run\`` no redirect de login.
- Na tela de "Obrigado!" (fim da entrevista), trocar o `<Link to="/">` por `<Link to="/r/$slug" params={{ slug }}>` para manter o respondente em contexto.

**3. `src/routes/__root.tsx`**
- Melhorar o `NotFoundComponent`: detectar se a URL atual começa com `/r/` ou `/r_/`, extrair o slug, e renderizar um botão "Voltar à entrevista" apontando para `/r/$slug`. Caso contrário, manter o link para `/`.

## Fora de escopo
Apenas correção de navegação. Sem mudanças em schema, server functions ou lógica de negócio.
