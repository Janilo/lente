import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  adminListCompensation,
  adminListRespondentsForCompensation,
  adminListStudiesForCompensation,
  adminCreateCompensation,
  adminUpdateCompensationStatus,
  adminDeleteCompensation,
} from "@/lib/compensation.functions";

export const Route = createFileRoute("/_authenticated/admin/compensacao")({
  head: () => ({ meta: [{ title: "Compensação — Admin · Lente" }] }),
  component: CompensationPage,
});

const METHODS: Array<{ value: "pix" | "transfer" | "voucher" | "gift" | "other"; label: string }> = [
  { value: "pix", label: "PIX" },
  { value: "transfer", label: "Transferência" },
  { value: "voucher", label: "Voucher" },
  { value: "gift", label: "Brinde" },
  { value: "other", label: "Outro" },
];

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  cancelled: "Cancelado",
};

function formatBRL(value: number, currency = "BRL") {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function CompensationPage() {
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/dashboard" });
  }, [loading, isAdmin, navigate]);

  const listFn = useServerFn(adminListCompensation);
  const respondentsFn = useServerFn(adminListRespondentsForCompensation);
  const studiesFn = useServerFn(adminListStudiesForCompensation);
  const createFn = useServerFn(adminCreateCompensation);
  const updateStatusFn = useServerFn(adminUpdateCompensationStatus);
  const deleteFn = useServerFn(adminDeleteCompensation);

  const log = useQuery({
    queryKey: ["admin-compensation"],
    queryFn: () => listFn(),
    enabled: isAdmin,
  });
  const respondents = useQuery({
    queryKey: ["admin-compensation-respondents"],
    queryFn: () => respondentsFn(),
    enabled: isAdmin,
  });
  const studies = useQuery({
    queryKey: ["admin-compensation-studies"],
    queryFn: () => studiesFn(),
    enabled: isAdmin,
  });

  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid" | "cancelled">("all");

  const filtered = useMemo(() => {
    const entries = log.data?.entries ?? [];
    if (statusFilter === "all") return entries;
    return entries.filter((e: any) => e.status === statusFilter);
  }, [log.data, statusFilter]);

  // form state
  const [form, setForm] = useState({
    respondent_id: "",
    study_id: "",
    amount: "",
    currency: "BRL",
    method: "pix" as (typeof METHODS)[number]["value"],
    status: "pending" as "pending" | "paid" | "cancelled",
    reference: "",
    notes: "",
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const amount = Number(form.amount);
      if (!form.respondent_id) throw new Error("Selecione um respondente.");
      if (!Number.isFinite(amount) || amount < 0) throw new Error("Valor inválido.");
      return createFn({
        data: {
          respondent_id: form.respondent_id,
          study_id: form.study_id || null,
          amount,
          currency: form.currency.toUpperCase(),
          method: form.method,
          status: form.status,
          reference: form.reference || null,
          notes: form.notes || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Registro adicionado.");
      setForm((f) => ({ ...f, amount: "", reference: "", notes: "" }));
      qc.invalidateQueries({ queryKey: ["admin-compensation"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar."),
  });

  const statusMut = useMutation({
    mutationFn: (args: { id: string; status: "pending" | "paid" | "cancelled" }) =>
      updateStatusFn({ data: args }),
    onSuccess: () => {
      toast.success("Status atualizado.");
      qc.invalidateQueries({ queryKey: ["admin-compensation"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar."),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Registro removido.");
      qc.invalidateQueries({ queryKey: ["admin-compensation"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao remover."),
  });

  if (loading) return <div className="mx-auto max-w-6xl px-6 py-12 text-sm text-muted-foreground">Carregando…</div>;
  if (!isAdmin) return null;

  const totals = log.data?.totals ?? { pending: 0, paid: 0, cancelled: 0, total_paid_brl: 0 };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <div>
        <Link to="/admin/analytics" className="text-sm text-muted-foreground hover:text-foreground">← Admin</Link>
        <h1 className="mt-2 text-4xl">Log de compensação</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registre e acompanhe pagamentos feitos aos respondentes por participação.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Pendentes" value={String(totals.pending)} />
        <Stat label="Pagos" value={String(totals.paid)} />
        <Stat label="Cancelados" value={String(totals.cancelled)} />
        <Stat label="Total pago (BRL)" value={formatBRL(totals.total_paid_brl)} />
      </div>

      <section className="rounded-sm border border-border bg-card p-5 space-y-4">
        <h2 className="text-lg font-medium">Novo registro</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Respondente *">
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.respondent_id}
              onChange={(e) => setForm({ ...form, respondent_id: e.target.value })}
            >
              <option value="">Selecione…</option>
              {(respondents.data?.respondents ?? []).map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.full_name ?? r.email ?? r.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estudo (opcional)">
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.study_id}
              onChange={(e) => setForm({ ...form, study_id: e.target.value })}
            >
              <option value="">—</option>
              {(studies.data?.studies ?? []).map((s: any) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </Field>
          <Field label="Valor *">
            <input
              type="number"
              min={0}
              step="0.01"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="50.00"
            />
          </Field>
          <Field label="Moeda">
            <input
              maxLength={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm uppercase"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
            />
          </Field>
          <Field label="Método">
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value as any })}
            >
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Status inicial">
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as any })}
            >
              <option value="pending">Pendente</option>
              <option value="paid">Pago</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </Field>
          <Field label="Referência (ID/transação)">
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="E2E ou ID PIX"
            />
          </Field>
          <Field label="Observações">
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {createMut.isPending ? "Salvando…" : "Registrar"}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Registros</h2>
          <div className="flex gap-1">
            {(["all", "pending", "paid", "cancelled"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-md px-3 py-1 text-xs ${
                  statusFilter === s
                    ? "bg-foreground text-background"
                    : "border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "all" ? "Todos" : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        {log.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum registro.</p>
        ) : (
          <div className="overflow-x-auto rounded-sm border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Respondente</th>
                  <th className="px-3 py-2">Estudo</th>
                  <th className="px-3 py-2">Valor</th>
                  <th className="px-3 py-2">Método</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e: any) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-3 py-2">
                      {e.respondent?.full_name ?? e.respondent?.email ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {e.study?.title ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {formatBRL(Number(e.amount), e.currency)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {METHODS.find((m) => m.value === e.method)?.label ?? e.method}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-sm px-2 py-0.5 text-xs font-semibold ${
                          e.status === "paid"
                            ? "bg-[color:var(--lente-teal-soft)] text-[color:var(--lente-teal-ink)] dark:bg-[color:var(--lente-teal-deep)] dark:text-[color:var(--lente-teal-soft)]"
                            : e.status === "pending"
                              ? "bg-[color:var(--lente-amber-soft)] text-[color:#7A5A1A] dark:bg-[color:var(--lente-amber)]/20 dark:text-[color:var(--lente-amber-soft)]"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {STATUS_LABEL[e.status] ?? e.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-1">
                        {e.status !== "paid" && (
                          <button
                            onClick={() => statusMut.mutate({ id: e.id, status: "paid" })}
                            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                          >
                            Marcar pago
                          </button>
                        )}
                        {e.status !== "pending" && (
                          <button
                            onClick={() => statusMut.mutate({ id: e.id, status: "pending" })}
                            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                          >
                            Reabrir
                          </button>
                        )}
                        {e.status !== "cancelled" && (
                          <button
                            onClick={() => statusMut.mutate({ id: e.id, status: "cancelled" })}
                            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                          >
                            Cancelar
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (confirm("Remover este registro?")) deleteMut.mutate(e.id);
                          }}
                          className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-medium">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
