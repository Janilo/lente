import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Redefinir senha — Lente" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  // Supabase coloca o token recovery no hash. O cliente processa
  // automaticamente via onAuthStateChange("PASSWORD_RECOVERY").
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // Caso o evento já tenha ocorrido antes do listener:
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Senha precisa ter ao menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha atualizada.");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-6 py-20">
      <p className="jps-eyebrow">Nova senha</p>
      <h1 className="mt-3 text-4xl">Redefinir senha</h1>

      {!ready ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Validando seu link… Se esta página não avançar em alguns segundos, o link pode ter
          expirado.
          <br />
          <Link to="/forgot-password" className="mt-3 inline-block text-primary underline">
            Pedir novo link
          </Link>
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-3">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              placeholder="Nova senha (mín. 6 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              required
              minLength={6}
              placeholder="Confirmar nova senha"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? "Ocultar senha" : "Mostrar senha"}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <button
            disabled={busy}
            type="submit"
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Salvando…" : "Salvar nova senha"}
          </button>
        </form>
      )}
    </div>
  );
}
