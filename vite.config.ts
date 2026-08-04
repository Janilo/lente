/// <reference types="vitest/config" />
// A referência acima ensina o `test:` lá embaixo ao tipo `UserConfig` do vite —
// sem ela o tsc reprova com "'test' does not exist in type 'UserConfig'".
// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import path from "node:path";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  // Force-enable the Nitro Cloudflare-module deploy build outside the Lovable
  // sandbox (CI). Mirrors the config Lovable applies in-sandbox: outputs the
  // Worker to dist/server + dist/client and emits a wrangler deploy config.
  nitro: {
    preset: "cloudflare-module",
    output: { dir: "dist", serverDir: "dist/server", publicDir: "dist/client" },
    cloudflare: { nodeCompat: true, deployConfig: true },
  },
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    // `.claude` guarda os worktrees que as sessões de agente criam DENTRO do
    // repo — sem excluí-lo o vitest varre uma cópia inteira do projeto e cada
    // teste roda duas vezes. No `farol`, em 03/ago/2026, o placar deu 338 testes
    // onde havia 169; pior que o número, o worktree de outra sessão passa a
    // reprovar a suíte desta.
    test: {
      exclude: ["**/node_modules/**", "**/dist/**", "**/.claude/**"],
    },
    resolve: {
      alias: {
        "entities/lib/decode.js": path.resolve(__dirname, "node_modules/entities/lib/decode.js"),
        "entities/lib/encode.js": path.resolve(__dirname, "node_modules/entities/lib/encode.js"),
        entities: path.resolve(__dirname, "node_modules/entities"),
      },
    },
  },
});
