import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { getTelegramWebhookStatus, registerTelegramWebhook } from "@/lib/telegram.functions";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export const Route = createFileRoute("/_authenticated/admin/integracoes")({
  head: () => ({ meta: [{ title: "Integrações — Admin — Lente" }] }),
  component: AdminIntegracoesPage,
});

function AdminIntegracoesPage() {
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/dashboard" });
  }, [loading, isAdmin, navigate]);

  if (loading) return <div className="mx-auto max-w-3xl px-6 py-12 text-sm text-muted-foreground">Carregando…</div>;
  if (!isAdmin) return null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 space-y-8">
      <div>
        <Link to="/admin/analytics" className="text-sm text-muted-foreground hover:text-foreground">← Admin</Link>
        <h1 className="mt-2 text-4xl">Integrações</h1>
        <p className="mt-1 text-sm text-muted-foreground">Conexões externas do lente.</p>
      </div>

      <TelegramWebhookCard />
    </div>
  );
}

function TelegramWebhookCard() {
  const status = useServerFn(getTelegramWebhookStatus);
  const register = useServerFn(registerTelegramWebhook);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "telegram-webhook"],
    queryFn: () => status(),
    retry: false,
  });

  const reg = useMutation({
    mutationFn: () => register(),
    onSuccess: () => {
      toast.success("Webhook do Telegram registrado ✓");
      qc.invalidateQueries({ queryKey: ["admin", "telegram-webhook"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-sm border border-border bg-card p-6 space-y-4">
      <div>
        <h2 className="text-lg">Bot do Telegram</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Registra o webhook do bot para apontar pro domínio de produção. Rode uma vez depois de
          configurar o secret <code>TELEGRAM_API_KEY</code> no Worker — ou se trocar o token/domínio.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Verificando status…</p>
      ) : error ? (
        <div className="rounded-sm border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {(error as Error).message}
          <div className="mt-1 text-xs text-muted-foreground">
            Confirme que o secret <code>TELEGRAM_API_KEY</code> está configurado no Worker do lente.
          </div>
        </div>
      ) : data ? (
        <div className="rounded-sm border border-border bg-background p-4 text-sm space-y-1.5">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${data.matches ? "bg-emerald-500" : "bg-amber-500"}`}
            />
            <span className="font-medium">
              {data.matches ? "Ativo e correto" : data.currentUrl ? "Aponta pra outro endereço" : "Não registrado"}
            </span>
          </div>
          {data.currentUrl && <div className="text-xs text-muted-foreground break-all">Atual: {data.currentUrl}</div>}
          {!data.matches && <div className="text-xs text-muted-foreground break-all">Esperado: {data.expectedUrl}</div>}
          {data.pendingUpdates > 0 && (
            <div className="text-xs text-amber-600">{data.pendingUpdates} atualização(ões) pendente(s) na fila</div>
          )}
          {data.lastErrorMessage && (
            <div className="text-xs text-destructive">Último erro reportado pelo Telegram: {data.lastErrorMessage}</div>
          )}
        </div>
      ) : null}

      <button
        onClick={() => reg.mutate()}
        disabled={reg.isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {reg.isPending ? "Registrando…" : data?.matches ? "Re-registrar webhook" : "Registrar webhook"}
      </button>
    </div>
  );
}
