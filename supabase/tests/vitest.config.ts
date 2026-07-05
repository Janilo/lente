import { defineConfig } from "vitest/config";

// Suíte de integração de RLS — roda contra a stack local (`supabase start`),
// via `pnpm test:rls`. Fica fora do `pnpm test` de propósito: os arquivos
// *.rls.ts não casam com o include padrão do vitest, então a suíte de unidade
// continua rodando sem Docker.
export default defineConfig({
  test: {
    include: ["**/*.rls.ts"],
    // Os arquivos compartilham o MESMO banco seedado; cenários descartáveis de
    // um arquivo não podem interferir nas contagens do outro.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
