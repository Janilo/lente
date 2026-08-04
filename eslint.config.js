import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // `.claude` guarda os worktrees que as sessões de agente criam DENTRO do repo.
  // Sem ignorá-lo, `eslint .` varre uma cópia inteira do projeto e o trabalho em
  // andamento de outra sessão passa a reprovar o lint desta. Medido no `farol`
  // em 03/ago/2026: o contador saltou de 6 para 12 sem nenhuma mudança de código.
  { ignores: ["dist", ".output", ".vinxi", ".claude"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Lovable/Supabase codebase with pervasive `any` at untyped data boundaries —
      // keep it visible as a warning instead of blocking CI on a large type refactor.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  eslintPluginPrettier,
);
