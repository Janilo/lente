import { execSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Stack local do Supabase para a suíte de RLS.
//
// Descoberta, nesta ordem:
//   1. variáveis de ambiente API_URL / ANON_KEY / SERVICE_ROLE_KEY
//      (nomes que `supabase status -o env` imprime);
//   2. `supabase status -o env` executado daqui (dev local e CI).
//
// Sem stack, a suíte inteira é PULADA (dev sem Docker continua com `pnpm test`
// verde). No CI o job seta REQUIRE_RLS_STACK=1: stack ausente vira erro, para
// um esquecimento de setup não passar como verde silencioso.

export type StackEnv = { url: string; anonKey: string; serviceKey: string };

export const PASSWORD = "lente-rls-test";

// Personas do supabase/seed.sql (UUIDs fixos).
export const USERS = {
  admin: { id: "00000000-0000-4000-8000-00000000ad01", email: "janilo@pereirasaraiva.com" },
  ana: { id: "a1a1a1a1-0000-4000-8000-000000000001", email: "ana@lente.test" },
  bruno: { id: "b2b2b2b2-0000-4000-8000-000000000002", email: "bruno@lente.test" },
  rita: { id: "c3c3c3c3-0000-4000-8000-000000000003", email: "rita@lente.test" },
  rafael: { id: "d4d4d4d4-0000-4000-8000-000000000004", email: "rafael@lente.test" },
} as const;

// Fixtures do seed referenciadas pelos testes.
export const FIX = {
  studyA: "aaaaaaaa-0000-4000-8000-000000000001",
  studyB1: "bbbbbbbb-0000-4000-8000-000000000001",
  studyB2: "bbbbbbbb-0000-4000-8000-000000000002",
  interviewA1: "22222222-0000-4000-8000-000000000001",
  interviewB1: "22222222-0000-4000-8000-000000000002",
  answerA1: "33333333-0000-4000-8000-000000000001",
  answerA2: "33333333-0000-4000-8000-000000000002",
  answerB1: "33333333-0000-4000-8000-000000000003",
  respondentRita: "88888888-0000-4000-8000-000000000001",
  respondentRafael: "88888888-0000-4000-8000-000000000002",
  insightA: "44444444-0000-4000-8000-000000000001",
} as const;

function fromProcess(): StackEnv | null {
  const url = process.env.API_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && anonKey && serviceKey ? { url, anonKey, serviceKey } : null;
}

function fromCli(): StackEnv | null {
  let out: string;
  try {
    out = execSync("supabase status -o env", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return null;
  }
  const grab = (key: string) => out.match(new RegExp(`^${key}="?([^"\\r\\n]+)"?`, "m"))?.[1];
  const url = grab("API_URL") ?? grab("SUPABASE_URL");
  const anonKey = grab("ANON_KEY") ?? grab("SUPABASE_ANON_KEY");
  const serviceKey = grab("SERVICE_ROLE_KEY") ?? grab("SUPABASE_SERVICE_ROLE_KEY");
  return url && anonKey && serviceKey ? { url, anonKey, serviceKey } : null;
}

let resolved: StackEnv | null | undefined;

export function localStack(): StackEnv | null {
  if (resolved === undefined) {
    resolved = fromProcess() ?? fromCli();
    if (!resolved) {
      if (process.env.REQUIRE_RLS_STACK) {
        throw new Error(
          "Stack local do Supabase não encontrada e REQUIRE_RLS_STACK está setado. Rode `supabase start` antes de `pnpm test:rls`.",
        );
      }
      console.warn("[rls] stack local não encontrada — suíte pulada. Rode `supabase start`.");
    }
  }
  return resolved;
}

const NO_SESSION = { auth: { persistSession: false, autoRefreshToken: false } } as const;

export function anonClient(env: StackEnv): SupabaseClient {
  return createClient(env.url, env.anonKey, NO_SESSION);
}

// Service-role: só para MONTAR/limpar cenário nos testes — nunca para o assert
// em si (o ponto da suíte é o que anon/authenticated conseguem fazer).
export function serviceClient(env: StackEnv): SupabaseClient {
  return createClient(env.url, env.serviceKey, NO_SESSION);
}

export async function signIn(env: StackEnv, email: string): Promise<SupabaseClient> {
  const client = createClient(env.url, env.anonKey, NO_SESSION);
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`login de ${email} falhou: ${error.message}`);
  return client;
}
