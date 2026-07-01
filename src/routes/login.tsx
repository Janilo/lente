import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Lente" },
      {
        name: "description",
        content:
          "Acesse sua conta Lente para acompanhar estudos, entrevistas e sínteses de pesquisa qualitativa em vídeo.",
      },
      { property: "og:title", content: "Entrar — Lente" },
      {
        property: "og:description",
        content: "Acesse sua conta Lente para acompanhar estudos e sínteses de pesquisa.",
      },
      { property: "og:url", content: "https://lente.pereirasaraiva.com/login" },
      { property: "og:image", content: "/og-social.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "/og-social.png" },
    ],
    links: [{ rel: "canonical", href: "https://lente.pereirasaraiva.com/login" }],
  }),
  validateSearch: z.object({ returnTo: z.string().optional() }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { returnTo } = Route.useSearch();
  const target = returnTo || "/dashboard";
  const { isAuthenticated, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) navigate({ to: target });
  }, [loading, isAuthenticated, navigate, target]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: target });
  };

  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + target },
    });
    if (error) toast.error(error.message);
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-6 py-20">
      <p className="jps-eyebrow">Acesso</p>
      <h1 className="mt-3 text-4xl">Entrar</h1>
      <p className="mt-2 text-sm text-muted-foreground">Acesse seus estudos.</p>
      <Button onClick={handleGoogle} variant="outline" size="lg" className="mt-8 w-full">
        Continuar com Google
      </Button>
      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" /> ou <div className="h-px flex-1 bg-border" />
      </div>
      <form onSubmit={handleEmail} className="space-y-3">
        <div>
          <label htmlFor="login-email" className="sr-only">
            E-mail
          </label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            placeholder="email@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lente-amber)] focus-visible:ring-offset-2"
          />
        </div>
        <div className="relative">
          <label htmlFor="login-password" className="sr-only">
            Senha
          </label>
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-sm border border-input bg-background px-3 py-2 pr-10 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lente-amber)] focus-visible:ring-offset-2"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Esqueci a senha
          </Link>
        </div>
        <Button disabled={busy} type="submit" variant="cta" size="lg" className="w-full">
          {busy ? "Entrando…" : "Entrar"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        Não tem conta?{" "}
        <Link to="/signup" search={{ returnTo }} className="text-primary underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
