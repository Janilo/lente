import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
 head: () => ({
 meta: [
 { title: "Entrar — Lente"},
 { name: "description", content: "Acesse sua conta Lente para acompanhar estudos, entrevistas e sínteses de pesquisa qualitativa em vídeo."},
 { property: "og:title", content: "Entrar — Lente"},
 { property: "og:description", content: "Acesse sua conta Lente para acompanhar estudos e sínteses de pesquisa."},
 { property: "og:url", content: "https://lente.pereirasaraiva.com/login"},
 ],
 links: [{ rel: "canonical", href: "https://lente.pereirasaraiva.com/login"}],
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
 if (error) { toast.error(error.message); return; }
 navigate({ to: target });
 };

 const handleGoogle = async () => {
 const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + target });
 if (result.error) toast.error(result.error.message);
 };

 return (
 <div className="mx-auto flex max-w-md flex-col px-6 py-20">
 <p className="jps-eyebrow">Acesso</p>
 <h1 className="mt-3 text-4xl">Entrar</h1>
 <p className="mt-2 text-sm text-muted-foreground">Acesse seus estudos.</p>
 <button onClick={handleGoogle} className="mt-8 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-accent">
 Continuar com Google
 </button>
 <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
 <div className="h-px flex-1 bg-border"/> ou <div className="h-px flex-1 bg-border"/>
 </div>
 <form onSubmit={handleEmail} className="space-y-3">
 <input type="email"required placeholder="email@exemplo.com"value={email} onChange={(e) => setEmail(e.target.value)}
 className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"/>
 <div className="relative">
 <input
 type={showPassword ? "text": "password"}
 required
 placeholder="senha"
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm"
 />
 <button
 type="button"
 onClick={() => setShowPassword((v) => !v)}
 aria-label={showPassword ? "Ocultar senha": "Mostrar senha"}
 className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
 >
 {showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
 </button>
 </div>
 <div className="flex justify-end">
 <Link to="/forgot-password"className="text-xs text-muted-foreground hover:text-foreground underline">
 Esqueci a senha
 </Link>
 </div>
 <button disabled={busy} type="submit"className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
 {busy ? "Entrando...": "Entrar"}
 </button>
 </form>
 <p className="mt-6 text-sm text-muted-foreground">
 Não tem conta? <Link to="/signup"search={{ returnTo }} className="text-primary underline">Criar conta</Link>
 </p>
 </div>
 );
}
