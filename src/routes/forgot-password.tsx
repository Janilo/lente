import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
 head: () => ({ meta: [{ title: "Esqueci a senha — Lente"}] }),
 component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
 const [email, setEmail] = useState("");
 const [busy, setBusy] = useState(false);
 const [sent, setSent] = useState(false);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setBusy(true);
 const { error } = await supabase.auth.resetPasswordForEmail(email, {
 redirectTo: `${window.location.origin}/reset-password`,
 });
 setBusy(false);
 if (error) { toast.error(error.message); return; }
 setSent(true);
 };

 return (
 <div className="mx-auto flex max-w-md flex-col px-6 py-20">
 <p className="jps-eyebrow">Recuperar acesso</p>
 <h1 className="mt-3 text-4xl">Esqueci a senha</h1>
 <p className="mt-2 text-sm text-muted-foreground">
 Informe seu email e enviaremos um link para você criar uma nova senha.
 </p>

 {sent ? (
 <div className="mt-8 rounded-md border border-border bg-card p-4 text-sm">
 Se existir uma conta com <strong>{email}</strong>, você receberá em instantes um email com o link para redefinir sua senha. Verifique também a caixa de spam.
 </div>
 ) : (
 <form onSubmit={handleSubmit} className="mt-8 space-y-3">
 <input
 type="email"
 required
 placeholder="email@exemplo.com"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
 />
 <button
 disabled={busy}
 type="submit"
 className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
 >
 {busy ? "Enviando...": "Enviar link"}
 </button>
 </form>
 )}

 <p className="mt-6 text-sm text-muted-foreground">
 <Link to="/login"className="text-primary underline">Voltar para o login</Link>
 </p>
 </div>
 );
}
