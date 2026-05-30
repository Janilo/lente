import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
 head: () => ({
 meta: [
 { title: "Criar conta — Lente"},
 { name: "description", content: "Crie sua conta Lente em segundos e comece a rodar entrevistas em vídeo com follow-ups adaptativos e síntese automática."},
 { property: "og:title", content: "Criar conta — Lente"},
 { property: "og:description", content: "Cadastre-se na Lente para rodar entrevistas em vídeo com síntese automática de insights."},
 { property: "og:url", content: "https://lente.pereirasaraiva.com/signup"},
 ],
 links: [{ rel: "canonical", href: "https://lente.pereirasaraiva.com/signup"}],
 }),
 validateSearch: z.object({ returnTo: z.string().optional() }),
 component: SignupPage,
});

function SignupPage() {
 const navigate = useNavigate();
 const { returnTo } = Route.useSearch();
 const target = returnTo || "/dashboard";
 // After signup, route through qualification so the respondent gets auto-tagged.
 // Researchers can hit "Pular por agora"on the form.
 const postSignupTarget = `/qualificacao?returnTo=${encodeURIComponent(target)}`;
 const { isAuthenticated, loading } = useAuth();
 const [fullName, setFullName] = useState("");
 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [busy, setBusy] = useState(false);

 useEffect(() => {
 if (!loading && isAuthenticated) navigate({ to: postSignupTarget });
 }, [loading, isAuthenticated, navigate, postSignupTarget]);

 const handleEmail = async (e: React.FormEvent) => {
 e.preventDefault();
 setBusy(true);
 const { error } = await supabase.auth.signUp({
 email, password,
 options: {
 emailRedirectTo: `${window.location.origin}${postSignupTarget}`,
 data: { full_name: fullName },
 },
 });
 setBusy(false);
 if (error) { toast.error(error.message); return; }
 toast.success("Conta criada. Verifique seu e-mail para confirmar.");
 };

 const handleGoogle = async () => {
 const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + postSignupTarget });
 if (result.error) toast.error(result.error.message);
 };

 return (
 <div className="mx-auto flex max-w-md flex-col px-6 py-20">
 <p className="jps-eyebrow">Comece agora</p>
 <h1 className="mt-3 text-4xl">Criar conta</h1>
 <p className="mt-2 text-sm text-muted-foreground">Comece a conduzir entrevistas em vídeo.</p>
 <button onClick={handleGoogle} className="mt-8 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-accent">
 Continuar com Google
 </button>
 <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
 <div className="h-px flex-1 bg-border"/> ou <div className="h-px flex-1 bg-border"/>
 </div>
 <form onSubmit={handleEmail} className="space-y-3">
 <input required placeholder="Nome completo"value={fullName} onChange={(e) => setFullName(e.target.value)}
 className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"/>
 <input type="email"required placeholder="email@exemplo.com"value={email} onChange={(e) => setEmail(e.target.value)}
 className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"/>
 <input type="password"required minLength={6} placeholder="senha (mín. 6 caracteres)"value={password} onChange={(e) => setPassword(e.target.value)}
 className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"/>
 <button disabled={busy} type="submit"className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
 {busy ? "Criando...": "Criar conta"}
 </button>
 </form>
 <p className="mt-6 text-sm text-muted-foreground">
 Já tem conta? <Link to="/login"search={{ returnTo }} className="text-primary underline">Entrar</Link>
 </p>
 <p className="mt-4 text-xs text-muted-foreground">
 Ao criar uma conta você concorda com os{" "}
 <Link to="/termos" className="underline underline-offset-2 hover:text-foreground">Termos de Uso</Link>{" "}
 e a{" "}
 <Link to="/privacidade" className="underline underline-offset-2 hover:text-foreground">Política de Privacidade</Link>.
 </p>
 </div>
 );
}
