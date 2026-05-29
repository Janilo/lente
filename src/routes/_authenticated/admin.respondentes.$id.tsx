import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { adminGetRespondentDetail } from "@/lib/respondent-detail.functions";

export const Route = createFileRoute("/_authenticated/admin/respondentes/$id")({
 head: () => ({ meta: [{ title: "Ficha do respondente — Admin · Lente"}] }),
 component: RespondentDetailPage,
});

const STATUS_INVITE: Record<string, string> = {
 queued: "Na fila",
 sent: "Enviado",
 accepted: "Aceito",
 declined: "Recusado",
 expired: "Expirado",
};

const STATUS_INTERVIEW: Record<string, string> = {
 in_progress: "Em andamento",
 completed: "Concluída",
 abandoned: "Abandonada",
};

const STATUS_COMP: Record<string, string> = {
 pending: "Pendente",
 paid: "Pago",
 cancelled: "Cancelado",
};

function fmtDate(d?: string | null) {
 return d ? new Date(d).toLocaleDateString("pt-BR") : "—";
}
function fmtDateTime(d?: string | null) {
 return d ? new Date(d).toLocaleString("pt-BR") : "—";
}
function fmtMoney(v: number, currency = "BRL") {
 try {
 return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v);
 } catch {
 return `${currency} ${v.toFixed(2)}`;
 }
}

function RespondentDetailPage() {
 const { isAdmin, loading } = useIsAdmin();
 const navigate = useNavigate();
 const { id } = Route.useParams();

 useEffect(() => {
 if (!loading && !isAdmin) navigate({ to: "/dashboard"});
 }, [loading, isAdmin, navigate]);

 const fetchFn = useServerFn(adminGetRespondentDetail);
 const q = useQuery({
 queryKey: ["respondent-detail", id],
 queryFn: () => fetchFn({ data: { id } }),
 enabled: isAdmin,
 });

 if (loading || q.isLoading) {
 return <div className="mx-auto max-w-5xl px-6 py-12 text-sm text-muted-foreground">Carregando…</div>;
 }
 if (!isAdmin) return null;
 if (q.error) {
 return (
 <div className="mx-auto max-w-5xl px-6 py-12">
 <Link to="/admin/analytics"className="text-sm text-muted-foreground hover:text-foreground">← Admin</Link>
 <p className="mt-4 text-sm text-destructive">{(q.error as any)?.message ?? "Erro ao carregar ficha."}</p>
 </div>
 );
 }

 const d = q.data!;
 const p = d.profile;
 const paidTotal = d.compensation
 .filter((c) => c.status === "paid"&& c.currency === "BRL")
 .reduce((acc, c) => acc + c.amount, 0);
 const pendingTotal = d.compensation
 .filter((c) => c.status === "pending"&& c.currency === "BRL")
 .reduce((acc, c) => acc + c.amount, 0);
 const completedCount = d.interviews.filter((i) => i.status === "completed").length;

 return (
 <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
 <div>
 <Link to="/admin/analytics"className="text-sm text-muted-foreground hover:text-foreground">← Admin</Link>
 <h1 className="mt-2 text-3xl">{p.full_name ?? "(sem nome)"}</h1>
 <p className="mt-1 text-sm text-muted-foreground">
 {[p.email, p.phone, p.occupation, p.company, [p.city, p.state].filter(Boolean).join("/")].filter(Boolean).join("· ") || "—"}
 </p>
 </div>

 <div className="grid gap-3 sm:grid-cols-4">
 <Stat label="Convites"value={String(d.invitations.length)} />
 <Stat label="Entrevistas concluídas"value={String(completedCount)} />
 <Stat label="Pago (BRL)"value={fmtMoney(paidTotal)} />
 <Stat label="Pendente (BRL)"value={fmtMoney(pendingTotal)} />
 </div>

 <Section title="Perfil">
 <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 text-sm">
 <Info label="Faixa etária"value={p.age_range} />
 <Info label="Gênero"value={p.gender} />
 <Info label="Educação"value={p.education} />
 <Info label="Renda"value={p.income_range} />
 <Info label="Tamanho da empresa"value={p.company_size} />
 <Info label="LinkedIn"value={p.linkedin_url} link />
 <Info label="Origem"value={p.source} />
 <Info label="Cadastrado em"value={fmtDate(p.created_at)} />
 </div>
 {p.notes && (
 <div className="mt-3 rounded-md bg-muted/50 p-3 text-sm whitespace-pre-wrap">{p.notes}</div>
 )}
 </Section>

 <Section title={`Tags (${d.tags.length})`}>
 {d.tags.length === 0 ? (
 <Empty>Sem tags atribuídas.</Empty>
 ) : (
 <div className="flex flex-wrap gap-1.5">
 {d.tags.map((t) => (
 <span key={t.tag_value_id} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs">
 <span className="text-muted-foreground">{t.dimension}:</span>
 <span>{t.label}</span>
 </span>
 ))}
 </div>
 )}
 </Section>

 <Section title={`Convites (${d.invitations.length})`}>
 {d.invitations.length === 0 ? (
 <Empty>Nenhum convite registrado.</Empty>
 ) : (
 <Table headers={["Data", "Estudo", "Canal", "Status", "Enviado em"]}>
 {d.invitations.map((i) => (
 <tr key={i.id} className="border-t border-border">
 <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(i.created_at)}</td>
 <td className="px-3 py-2">{i.study_title}</td>
 <td className="px-3 py-2 text-xs">{i.channel}</td>
 <td className="px-3 py-2 text-xs">{STATUS_INVITE[i.status] ?? i.status}</td>
 <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDateTime(i.sent_at)}</td>
 </tr>
 ))}
 </Table>
 )}
 </Section>

 <Section title={`Entrevistas (${d.interviews.length})`}>
 {d.interviews.length === 0 ? (
 <Empty>Nenhuma entrevista registrada.</Empty>
 ) : (
 <Table headers={["Data", "Estudo", "Status", "Origem", "Qualidade"]}>
 {d.interviews.map((i) => (
 <tr key={i.id} className="border-t border-border">
 <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(i.started_at)}</td>
 <td className="px-3 py-2">
 <Link
 to="/studies/$id/interviews"
 params={{ id: i.study_id }}
 className="hover:underline"
 >
 {i.study_title}
 </Link>
 </td>
 <td className="px-3 py-2 text-xs">{STATUS_INTERVIEW[i.status] ?? i.status}</td>
 <td className="px-3 py-2 text-xs text-muted-foreground">{i.source}</td>
 <td className="px-3 py-2 text-xs">
 {i.quality ? `${i.quality.avg.toFixed(1)} (${i.quality.count})` : "—"}
 </td>
 </tr>
 ))}
 </Table>
 )}
 </Section>

 <Section
 title={`Compensação (${d.compensation.length})`}
 action={
 <Link to="/admin/compensacao"className="text-xs text-muted-foreground hover:text-foreground">
 Gerenciar →
 </Link>
 }
 >
 {d.compensation.length === 0 ? (
 <Empty>Nenhum registro de compensação.</Empty>
 ) : (
 <Table headers={["Data", "Estudo", "Valor", "Método", "Status", "Pago em"]}>
 {d.compensation.map((c) => (
 <tr key={c.id} className="border-t border-border">
 <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(c.created_at)}</td>
 <td className="px-3 py-2 text-xs">{c.study_title ?? "—"}</td>
 <td className="px-3 py-2 font-medium">{fmtMoney(c.amount, c.currency)}</td>
 <td className="px-3 py-2 text-xs">{c.method}</td>
 <td className="px-3 py-2 text-xs">{STATUS_COMP[c.status] ?? c.status}</td>
 <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(c.paid_at)}</td>
 </tr>
 ))}
 </Table>
 )}
 </Section>
 </div>
 );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
 return (
 <section className="space-y-3">
 <div className="flex items-center justify-between">
 <h2 className="text-lg font-medium">{title}</h2>
 {action}
 </div>
 {children}
 </section>
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

function Info({ label, value, link }: { label: string; value?: string | null; link?: boolean }) {
 return (
 <div className="flex justify-between gap-3 border-b border-border/40 py-1.5">
 <span className="text-muted-foreground">{label}</span>
 {value ? (
 link ? (
 <a href={value} target="_blank"rel="noreferrer"className="truncate hover:underline">{value}</a>
 ) : (
 <span className="truncate">{value}</span>
 )
 ) : (
 <span className="text-muted-foreground">—</span>
 )}
 </div>
 );
}

function Empty({ children }: { children: React.ReactNode }) {
 return <p className="text-sm text-muted-foreground italic">{children}</p>;
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
 return (
 <div className="overflow-x-auto rounded-sm border border-border">
 <table className="w-full text-sm">
 <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
 <tr>
 {headers.map((h) => (
 <th key={h} className="px-3 py-2">{h}</th>
 ))}
 </tr>
 </thead>
 <tbody>{children}</tbody>
 </table>
 </div>
 );
}
