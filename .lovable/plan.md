## Objetivo

Manter exatamente o conteúdo atual do cabeçalho global (wordmark "Lente" + eyebrow "por J P Saraiva" + links de navegação + Admin condicional), mas aplicar o estilo visual do header de `pereirasaraiva.com` mostrado na referência.

## Estilo de referência (pereirasaraiva.com)

- Fundo cream/stone sólido (token `--background` / `--muted` já existem em `src/styles.css`), sem blur.
- Wordmark à esquerda em serifa (Fraunces) na cor roxa da marca (`--primary` = `#4A1942`), peso regular, tamanho calmo (~22–24px).
- Links de nav centralizados/à direita, em sans, **UPPERCASE**, `letter-spacing` largo (~0.18em), tamanho ~12–13px, cor `--muted-foreground` no estado normal e `--foreground` no hover. Sem fundo/hover-bg.
- CTA à direita: botão retangular sólido roxo (`--primary`), texto em uppercase tracking largo, com seta `→` ao final. Cantos quase retos (segue `--radius: 4px` já definido).
- Linha divisória sutil embaixo (border-bottom usando `--border`).
- Altura confortável (~72–80px), padding horizontal generoso.

## Arquivos afetados

- `src/routes/__root.tsx` — substituir o markup do `Header()` interno (que é o que aparece globalmente) pelo novo layout. **Sem mudar lógica**: mesmas condições `loading` / `isAuthenticated`, mesmos destinos de `Link`, mesmo `signOut`.
- `src/components/brand/BrandHeader.tsx` — alinhar o mesmo tratamento visual (wordmark serif roxo + link Admin em uppercase tracking) para manter consistência onde ele é usado.
- `src/styles.css` — adicionar **apenas** uma utility classe opcional `.jps-navlink` (uppercase + tracking + tamanho + cor) para reuso. Sem novas cores; tudo via tokens existentes.

## Mapeamento dos itens atuais

- Logo: `Lente` (Fraunces) + eyebrow `por J P Saraiva` permanece, mas eyebrow vira opcional/oculto em telas menores como já está. Visualmente o destaque principal é o wordmark, como na referência onde aparece só "J P Saraiva".
- Nav autenticada: `Dashboard`, `Minha privacidade`, `Sair` → renderizados como `.jps-navlink`.
- Nav anônima: `Entrar` como `.jps-navlink` + `Criar conta` como CTA roxo com seta `→` (equivalente ao "AGENDAR →").
- `Admin` (no `BrandHeader` via `useIsAdmin`) também vira `.jps-navlink`.

## Fora de escopo

- Não mexer em rotas, dados, auth, server functions.
- Não trocar fontes/tokens de cor — só usar os já existentes.
- Não alterar o `BrandFooter`.
