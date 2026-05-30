# Auditoria Lente — Tarefas de correção

> Pacote de handoff para implementação via **Claude Code** no repositório real.
> Base: `Janilo/lente@c556952` (branch `main`). Stack: TanStack Start · React · Tailwind 4 · shadcn · Supabase.
> Idioma do produto: **PT-BR**. Sistema visual: **J P Saraiva DS** (variante Lente).

## Como usar este documento

Cada tarefa é independente e tem: **arquivo**, **o que mudar**, **diff** e **critério de aceite**.
Os números de linha são aproximados (`~`) — localize pelo trecho citado, não pela linha.
Prioridade: **P0** (bug visível, minutos) → **P1** (sistema/UX) → **P2** (manutenção).

Sugestão de ordem de commits:
1. `fix(brand): P0 — Fraunces nos ledes + cor de texto accent`
2. `refactor(ui): P1 — adotar Button/Input, hover escurece, raio único`
3. `fix(a11y): P1 — labels de formulário + foco âmbar`
4. `chore(ui): P2 — limpeza dark mode, wordmark, loading/empty`

---

## Contexto do design system (fonte da verdade)

O produto herda os princípios do **J P Saraiva DS**. Regras relevantes aos achados:

- **Tipografia:** Display/UI em **Inter Tight**; momentos de marca (ledes, hero) em **Fraunces** itálico. `--font-display` está mapeado para Inter Tight de propósito; a serifada é `--font-serif`.
- **Cor — regra 60/20/20:** off-white domina; um estrutural; um accent. Accent (`--lente-teal-soft #E7F2EF`) é **fill**, nunca cor de texto.
- **Cantos:** a marca é **quadrada**. `radius-sm = 2px`. Só círculos para retratos.
- **Hover:** opacidade 0.85 **ou um passo mais escuro**. **Nunca clarear.**
- **Foco:** contorno **âmbar** 2px, offset 2px.
- **Voz:** banido o padrão antitético "Não X — é Y" / "não apenas X, mas Y".

Tokens disponíveis em `src/styles.css` (`:root`): `--lente-teal`, `--lente-teal-deep`, `--lente-teal-soft`, `--lente-teal-ink`, `--lente-coral*`, `--lente-amber`, `--lente-amber-soft`, `--lente-amber-ink`, etc. **Não inventar tokens novos.**

---

# P0 — Bugs visíveis

## F-01 · Itálico editorial renderiza em Inter Tight, não em Fraunces

**Problema:** os `<em>` da landing usam `className="font-display italic"`, mas `--font-display` é Inter Tight. A assinatura serifada da marca não aparece.

**Arquivo:** `src/styles.css` — adicionar utility dentro de `@layer base`, após `.jps-cta:hover`.

```css
/* Lede de marca: ênfase serifada itálica sob a manchete */
.lede-em {
  font-family: var(--font-serif);
  font-style: italic;
  font-variation-settings: "opsz" 72, "SOFT" 0, "WONK" 0;
  color: var(--lente-teal);
}
```

**Arquivo:** `src/routes/index.tsx` — trocar a classe nos **5** `<em>`:

```diff
- <em className="font-display italic text-primary">{"\u00A0"}se aprofundam</em> sozinhas.
+ <em className="lede-em">{"\u00A0"}se aprofundam</em> sozinhas.
```

Aplicar em: `se aprofundam` (~24), `com evidência em vídeo` (~63), `passo de verificação bancária` (~88), `com fonte clicável` (~192).

**Arquivo:** `src/routes/exemplo.tsx` — mesmos `<em>`: `acionáveis` (~178), `com fonte clicável` (~240), `suas próprias entrevistas` (~280).

**Aceite:** os ledes renderizam em Fraunces itálico (serifada), distinta do corpo em Inter Tight.

---

## F-02 · `text-accent` aplicado como cor de texto = menta ilegível

**Problema:** `--accent` (`#E7F2EF`) é fundo. Usado como texto sobre branco fica abaixo de contraste AA.

**Arquivo:** `src/routes/index.tsx`

```diff
@@ Método — numeral 01/02/03 (~238) @@
- <div className="font-display text-4xl text-accent">{s.n}</div>
+ <div className="font-display text-4xl text-primary">{s.n}</div>

@@ eyebrows do preview (~85, ~146) @@
- <p className="jps-eyebrow text-accent">Tema recorrente</p>
+ <p className="jps-eyebrow text-primary">Tema recorrente</p>
- <p className="jps-eyebrow text-accent">Recomendação</p>
+ <p className="jps-eyebrow text-primary">Recomendação</p>
```

**Arquivo:** `src/routes/exemplo.tsx`

```diff
@@ confidenceColor (~72) @@
  theme.confidence === "média"
-   ? "bg-accent/15 text-accent"
+   ? "bg-[color:var(--lente-amber-soft)] text-[color:var(--lente-amber-ink)]"
    : "bg-muted text-muted-foreground";

@@ eyebrow Recomendação (~205) @@
- <p className="jps-eyebrow text-accent">Recomendação</p>
+ <p className="jps-eyebrow text-primary">Recomendação</p>
```

Os badges "Exemplo · dados ilustrativos" (~117, ~131) usam `text-accent` sobre `bg-accent/15` → trocar por `text-[color:var(--lente-teal-ink)]`.

**Aceite:** nenhum texto usa `text-accent`. Todo texto sobre branco passa AA (≥ 4.5:1 para corpo).

---

# P1 — Sistema & consistência

## F-03 · Adotar a biblioteca shadcn nas rotas

**Problema:** `Button`/`Input`/`Card`/`Badge` existem mas as rotas reescrevem botões à mão — pelo menos 5 tamanhos diferentes (`px-5 py-3`, `px-4 py-2`, `px-3 py-2`, `px-4 py-2.5`, `px-5 py-2.5`).

**Arquivo:** `src/components/ui/button.tsx` — adicionar variante `cta` que absorve `.jps-cta`:

```diff
@@ buttonVariants → variants.variant @@
- default: "bg-primary text-primary-foreground hover:bg-primary/90",
+ default:
+   "bg-primary text-primary-foreground hover:bg-[color:var(--lente-teal-deep)]",
+ cta:
+   "bg-primary text-primary-foreground uppercase tracking-[0.18em] text-xs font-semibold hover:bg-[color:var(--lente-teal-deep)]",
```

**Rotas — substituir `<Link className="rounded-md bg-primary …">` por `<Button asChild>`.** Exemplo no HERO de `src/routes/index.tsx` (~31):

```diff
+ import { Button } from "@/components/ui/button";
...
- <Link to="/exemplo" className="rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground">
-   Ver síntese de exemplo →
- </Link>
+ <Button asChild variant="cta" size="lg">
+   <Link to="/exemplo">Ver síntese de exemplo →</Link>
+ </Button>
```

Aplicar o mesmo padrão em: `dashboard.tsx`, `login.tsx` (botão Google + submit), `studies.$id.tsx`, `studies.$id.synthesis.tsx`, e os CTAs restantes de `index.tsx`/`exemplo.tsx`.

**Aceite:** nenhum `<button>`/`<Link>` cru aplica `bg-primary` direto via `className`. Todos passam por `<Button>`.

---

## F-04 · Raio de canto único (2px), não 2px+4px misturados

**Problema:** componentes shadcn usam `rounded-sm` (2px); botões manuais usam `rounded-md` (`--radius` = 4px). Convivem na mesma tela.

**Arquivo:** `src/styles.css`

```diff
- --radius: 4px;
+ --radius: 2px;   /* marca quadrada — radius-sm e radius-md convergem */
```

Depois, varrer as rotas e trocar `rounded-md` → `rounded-sm` nos elementos de UI (botões, inputs, cards). Inputs podem ficar em 4px se preferir manter o token de input — decidir um valor e documentar.

**Aceite:** `Button` e botões vizinhos têm o mesmo raio. Sem mistura visível 2px/4px.

---

## F-05 · Hover escurece, nunca clareia

**Problema:** `hover:bg-primary/90` reduz opacidade e, sobre papel claro, clareia o teal. O DS proíbe.

**Arquivo:** `src/components/ui/button.tsx` — (coberto no diff de F-03; `default` → `hover:bg-[color:var(--lente-teal-deep)]`).

**Arquivo:** `src/components/ui/badge.tsx`

```diff
- default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
+ default: "border-transparent bg-primary text-primary-foreground hover:bg-[color:var(--lente-teal-deep)]",
```

Varrer rotas por `hover:bg-primary/` e `hover:bg-accent` em elementos teal e aplicar o mesmo princípio (passo mais escuro).

**Aceite:** nenhum hover de elemento teal clareia. Todos vão para `teal-deep` ou escurecem.

---

## F-06 · Larguras de coluna consistentes (header alinha ao conteúdo)

**Problema:** header usa `max-w-6xl px-8`; rotas misturam `max-w-4xl`/`5xl`/`6xl` com `px-6`. O wordmark não alinha com a borda do conteúdo em nenhuma rota interna.

**Recomendação:** definir 2–3 larguras nomeadas e um gutter único. Em `src/styles.css`:

```css
:root {
  --w-app: 64rem;   /* telas de app (dashboard, landing) */
  --w-doc: 56rem;   /* telas densas (studies, synthesis) */
  --gutter: 1.5rem; /* px-6 */
}
```

Alinhar o header (`__root.tsx`) à mesma régua da rota que ele encima, ou fixar o header em `--w-app` e padronizar as rotas de app em `--w-app`.

**Aceite:** em qualquer rota interna, a borda esquerda do wordmark no header alinha com a borda esquerda do conteúdo.

---

## F-07 · Remover padrão de frase antitético (voz do DS)

**Arquivo:** `src/routes/index.tsx` (~92) e `src/routes/exemplo.tsx` (~35)

```diff
- A objeção não é segurança — é falta de contexto sobre por que o
- dado é pedido naquele momento.
+ A objeção é de contexto: falta explicar por que o dado é pedido
+ naquele momento do fluxo.

@@ index.tsx — h2 do preview (~62) @@
- Uma síntese <em>com evidência em vídeo</em>, não um relatório de PDF.
+ Uma síntese <em>com evidência em vídeo</em>: cada insight abre o clipe original.
```

**Aceite:** nenhuma frase de marketing usa o pivô "não X — é Y".

---

## F-08 · Inputs com `<label>` associado (a11y)

**Problema:** login tem só `placeholder`; `Field` em `studies.$id.tsx` usa `<label>` sem `htmlFor`/`id`.

**Arquivo:** `src/routes/login.tsx`

```diff
@@ campo de e-mail @@
+ <label htmlFor="login-email" className="sr-only">E-mail</label>
- <input type="email" required placeholder="email@exemplo.com" ...
+ <input id="login-email" type="email" required autoComplete="email" placeholder="email@exemplo.com" ...

@@ campo de senha @@
+ <label htmlFor="login-password" className="sr-only">Senha</label>
- <input type={showPassword ? "text" : "password"} required ...
+ <input id="login-password" autoComplete="current-password" type={showPassword ? "text" : "password"} required ...
```

No helper `Field` (`studies.$id.tsx`): gerar um `id` e ligar `label htmlFor={id}` + `id={id}` no input, ou migrar para `<Label>`/`<Input>` do kit.

**Aceite:** todo input tem rótulo programaticamente associado (leitor de tela anuncia o campo). Lighthouse a11y sem erros de label.

---

## F-09 · Foco em âmbar, não em teal

**Problema:** componentes usam `focus-visible:ring-ring` (teal). DS especifica contorno âmbar. Anel teal sobre botão teal tem pouca separação.

**Arquivo:** `src/styles.css` — adicionar token e classe utilitária:

```css
:root { --ring-focus: var(--lente-amber); }
```

**Arquivo:** `src/components/ui/button.tsx` e demais primitivos — trocar:

```diff
- focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
+ focus-visible:ring-2 focus-visible:ring-[color:var(--lente-amber)] focus-visible:ring-offset-2
```

**Aceite:** foco de teclado mostra contorno âmbar 2px com offset, visível sobre fundos teal e claros.

---

# P2 — Polimento & manutenção

## F-10 · Remover classes `dark:` mortas

**Problema:** `badge.tsx` tem variantes `dark:` mas não há bloco `.dark{}` em `styles.css` — são inertes.

**Arquivo:** `src/components/ui/badge.tsx` — remover os fragmentos `dark:*` de `success`, `warning`, `ai`:

```diff
  success:
-   "border-transparent bg-[color:var(--lente-teal-soft)] text-[color:var(--lente-teal-ink)] dark:bg-[color:var(--lente-teal-deep)] dark:text-[color:var(--lente-teal-soft)]",
+   "border-transparent bg-[color:var(--lente-teal-soft)] text-[color:var(--lente-teal-ink)]",
```

**Decisão alternativa:** se dark mode for feature desejada, implementar `.dark{}` + toggle e manter as classes. Não deixar no meio.

**Aceite:** nenhuma classe `dark:` sem `.dark{}` correspondente.

---

## F-11 · Uma fonte de verdade para o wordmark

**Problema:** wordmark existe como componente (`LenteWordmark.tsx`, SVG com `<text>`) e como arquivos estáticos (`assets/brand/wordmark-lente.svg`, `-on-teal`). Divergem com o tempo; o `<text>` inline depende da fonte carregada.

**Recomendação:** escolher uma fonte. Preferir o componente `LenteWordmark` como API única e gerar os SVGs estáticos a partir dele (ou vice-versa). Documentar qual é canônico no DS.

**Aceite:** um único caminho para renderizar o wordmark; o outro é derivado ou removido.

---

## F-12 · Loading/empty consistentes

**Problema:** rótulos e reticências divergentes ("Carregando…", "Sintetizando...", "Entrando..."); empty states ora tracejados (dashboard) ora sólidos (synthesis).

**Arquivo:** `src/routes/login.tsx` (~88) e demais ocorrências de `...`:

```diff
- {busy ? "Entrando..." : "Entrar"}
+ {busy ? "Entrando…" : "Entrar"}
```

Trocar todo `...` ASCII por `…` (U+2026). Padronizar copy de loading e criar um par `<Skeleton>`/`<EmptyState>` reutilizável (borda tracejada como padrão único).

**Aceite:** reticências unificadas em `…`; estados vazios usam o mesmo componente.

---

## F-13 · Alinhamento por flex, não por `mt-8` mágico

**Problema:** em `studies.$id.tsx`, os 4 links de navegação recebem `mt-8` individual para casar com o `h1`. Quebra se o título for a duas linhas.

**Recomendação:** separar título e barra de ações em duas linhas, ou usar `flex items-end`/`items-baseline` no container em vez de margens mágicas por item.

**Aceite:** com título de 1 ou 2 linhas, a barra de navegação permanece alinhada sem números mágicos.

---

## F-14 · Contraste do texto pequeno `muted-foreground`

**Problema:** footer e legendas `font-mono` em 10–11px usam `muted-foreground` (`--lente-mute #6B7773`) — no limite do AA para texto pequeno.

**Recomendação:** nos textos ≤ 11px, usar `--lente-slate` (`#3C4744`) em vez de `--lente-mute`, ou subir o corpo mínimo para 12px.

**Aceite:** todo texto pequeno passa AA.

---

# O que já está certo (não regredir)

- **Tokens em camadas:** primitivos Lente → semânticos → shadcn. Manter a derivação.
- **SEO/OG/JSON-LD** completos em `__root.tsx`.
- **Gravação de entrevista resiliente** (`r_.$slug.run.tsx`): câmera persistente, preroll 3s, mínimo 2s, fallback de upload, guarda de 500MB.
- **A11y pontual:** headings `sr-only`, `aria-label` no toggle de senha e no recorder. Estender aos formulários (F-08).
- **Cópia on-voice** e tratamento de **LGPD** (`my-privacy`, `lgpd.ts`).

---

# Checklist de verificação final

- [ ] Ledes em Fraunces itálico (F-01)
- [ ] Nenhum `text-accent` em texto; AA em todo texto (F-02, F-14)
- [ ] Rotas usam `<Button>`/`<Input>`; sem `bg-primary` cru (F-03)
- [ ] Raio único; nenhum hover clareia (F-04, F-05)
- [ ] Header alinha ao conteúdo (F-06)
- [ ] Sem padrão antitético na cópia (F-07)
- [ ] Todo input com label associado; foco âmbar (F-08, F-09)
- [ ] Sem `dark:` mortas; wordmark único; reticências `…` (F-10, F-11, F-12)
- [ ] Sem alinhamento por `mt-*` mágico (F-13)
- [ ] `bun run build` e typecheck passam
