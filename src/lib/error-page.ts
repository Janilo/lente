// Standalone HTML error page (rendered outside the React tree).
// Colors mirror the Lente design tokens defined in src/styles.css:
//   --lente-paper #F7F9F8, --lente-ink #0E1A18, --lente-mute #6B7773,
//   --lente-stone #D7DEDC, --lente-teal #0E6B5E, --lente-teal-deep #08504A,
//   --lente-white #FFFFFF. Radius 4px matches --radius.
export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Esta página não carregou</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 "Inter Tight", Inter, system-ui, -apple-system, sans-serif; background: #F7F9F8; color: #0E1A18; display: grid; place-items: center; min-height: 100dvh; margin: 0; padding: 1.5rem; letter-spacing: -0.005em; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; font-weight: 600; letter-spacing: -0.015em; }
      p { color: #6B7773; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 4px; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; transition: background-color 150ms ease, opacity 150ms ease; }
      .primary { background: #0E6B5E; color: #FFFFFF; }
      .primary:hover { background: #08504A; }
      .secondary { background: #FFFFFF; color: #0E1A18; border-color: #D7DEDC; }
      .secondary:hover { opacity: 0.85; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Esta página não carregou</h1>
      <p>Algo deu errado do nosso lado. Você pode tentar novamente ou voltar ao início.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Tentar novamente</button>
        <a class="secondary" href="/">Voltar ao início</a>
      </div>
    </div>
  </body>
</html>`;
}
