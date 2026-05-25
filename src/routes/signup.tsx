import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { BrandHeader } from "@/components/brand/BrandHeader";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Criar conta — Lente" }] }),
  validateSearch: z.object({ returnTo: z.string().optional() }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { returnTo } = Route.useSearch();
  const target = returnTo || "/dashboard";
  const { isAuthenticated, loading } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) navigate({ to: target });
  }, [loading, isAuthenticated, navigate, target]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}${target}`,
        data: { full_name: fullName },
      },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Conta criada. Verifique seu e-mail para confirmar.");
  };

  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + target });
    if (result.error) toast.error(result.error.message);
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-6 py-20">
      <h1 className="text-4xl">Criar conta</h1>
      <p className="mt-2 text-sm text-muted-foreground">Comece a conduzir entrevistas em vídeo.</p>
      <button onClick={handleGoogle} className="mt-8 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-accent">
        Continuar com Google
      </button>
      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" /> ou <div className="h-px flex-1 bg-border" />
      </div>
      <form onSubmit={handleEmail} className="space-y-3">
        <input required placeholder="Nome completo" value={fullName} onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <input type="email" required placeholder="email@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <input type="password" required minLength={6} placeholder="senha (mín. 6 caracteres)" value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <button disabled={busy} type="submit" className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {busy ? "Criando..." : "Criar conta"}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        Já tem conta? <Link to="/login" className="text-primary underline">Entrar</Link>
      </p>
    </div>
  );
}
