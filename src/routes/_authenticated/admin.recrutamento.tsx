import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { adminListTagDimensions } from "@/lib/respondent-pool.functions";
import {
 adminListStudiesForRecruitment,
 adminListRecruitmentPool,
 adminCreateInvitations,
} from "@/lib/recruitment.functions";

export const Route = createFileRoute("/_authenticated/admin/recrutamento")({
 head: () => ({ meta: [{ title: "Recrutamento — Admin · Lente"}] }),
 validateSearch: z.object({ study_id: z.string().uuid().optional() }),
 component: RecruitmentPage,
});

function RecruitmentPage() {
 const { isAdmin, loading } = useIsAdmin();
 const navigate = useNavigate();
 const { study_id: initialStudyId } = Route.useSearch();

 useEffect(() => {
 if (!loading && !isAdmin) navigate({ to: "/dashboard"});
 }, [loading, isAdmin, navigate]);

 if (loading) return <div className="mx-auto max-w-6xl px-6 py-12 text-sm text-muted-foreground">Carregando…</div>;
 if (!isAdmin) return null;

 return (
 <div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
 <div>
 <Link to="/admin/analytics"className="text-sm text-muted-foreground hover:text-foreground">← Admin</Link>
 <h1 className="mt-2 text-4xl">Recrutamento</h1>
 <p className="mt-1 text-sm text-muted-foreground">
 Filtre o pool por perfil e envie convites em lote para um estudo específico.
 </p>
 </div>
 <RecruitmentBoard initialStudyId={initialStudyId} />
 </div>
 );
}

function RecruitmentBoard({ initialStudyId }: { initialStudyId?: string }) {
 const studiesFn = useServerFn(adminListStudiesForRecruitment);
 const dimsFn = useServerFn(adminListTagDimensions);
 const poolFn = useServerFn(adminListRecruitmentPool);
 const inviteFn = useServerFn(adminCreateInvitations);
 const qc = useQueryClient();

 const [studyId, setStudyId] = useState<string | "">(initialStudyId ?? "");
 const [search, setSearch] = useState("");
 const [tagValueIds, setTagValueIds] = useState<string[]>([]);
 const [excludeAlreadyInvited, setExcludeAlreadyInvited] = useState(true);
 const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
 const [channel, setChannel] = useState<"manual"| "whatsapp"| "email"| "link">("manual");
 const [message, setMessage] = useState("");

 const studies = useQuery({ queryKey: ["admin", "recruitment", "studies"], queryFn: () => studiesFn() });
 const dims = useQuery({ queryKey: ["admin", "tag-dims"], queryFn: () => dimsFn() });

 useEffect(() => {
 if (!studyId && studies.data?.studies?.[0]) setStudyId(studies.data.studies[0].id);
 }, [studies.data, studyId]);

 const pool = useQuery({
 queryKey: ["admin", "recruitment", "pool", studyId, search, tagValueIds, excludeAlreadyInvited],
 queryFn: () =>
 poolFn({
 data: {
 study_id: studyId as string,
 search,
 tagValueIds,
 excludeAlreadyInvited,
 },
 }),
 enabled: !!studyId,
 });

 const currentStudy = useMemo(
 () => studies.data?.studies.find((s) => s.id === studyId),
 [studies.data, studyId],
 );

 const inviteUrl = currentStudy ? `${window.location.origin}/r/${currentStudy.public_slug}` : "";

 const invite = useMutation({
 mutationFn: () =>
 inviteFn({
 data: {
 study_id: studyId as string,
 respondent_ids: Array.from(selectedIds),
 channel,
 message: message.trim() || null,
 },
 }),
 onSuccess: (res) => {
 toast.success(`${res.created} convite(s) registrado(s).`);
 setSelectedIds(new Set());
 qc.invalidateQueries({ queryKey: ["admin", "recruitment", "pool", studyId] });
 },
 onError: (e: Error) => toast.error(e.message),
 });

 const toggle = (id: string) => {
 setSelectedIds((prev) => {
 const next = new Set(prev);
 if (next.has(id)) next.delete(id);
 else next.add(id);
 return next;
 });
 };
 const toggleAll = () => {
 if (!pool.data) return;
 const all = pool.data.respondents.filter((r) => !r.invitation).map((r) => r.id);
 if (selectedIds.size === all.length) setSelectedIds(new Set());
 else setSelectedIds(new Set(all));
 };

 const composeWhatsappLink = (phone: string | null | undefined) => {
 if (!phone || !currentStudy) return null;
 const clean = phone.replace(/\D/g, "");
 if (clean.length < 8) return null;
 const text = encodeURIComponent(
 `${message.trim() || `Olá! Você foi convidado para participar de uma pesquisa em vídeo: ${currentStudy.title}.`}\n\n${inviteUrl}`,
 );
 return `https://wa.me/${clean}?text=${text}`;
 };
 const composeMailto = (email: string | null | undefined) => {
 if (!email || !currentStudy) return null;
 const subject = encodeURIComponent(`Convite — ${currentStudy.title}`);
 const body = encodeURIComponent(
 `${message.trim() || "Olá! Você foi convidado para participar de uma pesquisa em vídeo."}\n\n${inviteUrl}`,
 );
 return `mailto:${email}?subject=${subject}&body=${body}`;
 };

 return (
 <div className="space-y-6">
 {/* Study + invite settings */}
 <div className="rounded-sm border border-border bg-card p-5 space-y-4">
 <div className="grid gap-4 sm:grid-cols-2">
 <label className="block space-y-1">
 <span className="text-xs text-muted-foreground">Estudo</span>
 <select
 value={studyId}
 onChange={(e) => setStudyId(e.target.value)}
 className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
 >
 <option value="">— selecionar —</option>
 {studies.data?.studies.map((s) => (
 <option key={s.id} value={s.id}>
 [{s.status}] {s.title}
 </option>
 ))}
 </select>
 </label>
 <label className="block space-y-1">
 <span className="text-xs text-muted-foreground">Canal</span>
 <select
 value={channel}
 onChange={(e) => setChannel(e.target.value as typeof channel)}
 className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
 >
 <option value="manual">Manual (apenas registrar)</option>
 <option value="whatsapp">WhatsApp (gera link)</option>
 <option value="email">Email (gera mailto)</option>
 <option value="link">Link público (copiar)</option>
 </select>
 </label>
 </div>
 {currentStudy && (
 <div className="text-xs text-muted-foreground font-mono break-all">
 Link público: {inviteUrl}
 <button
 type="button"
 onClick={() => {
 navigator.clipboard.writeText(inviteUrl);
 toast.success("Link copiado.");
 }}
 className="ml-2 underline"
 >
 copiar
 </button>
 </div>
 )}
 <label className="block space-y-1">
 <span className="text-xs text-muted-foreground">Mensagem personalizada (opcional)</span>
 <textarea
 value={message}
 onChange={(e) => setMessage(e.target.value)}
 maxLength={2000}
 rows={2}
 placeholder="Olá! Você foi convidado para participar de uma pesquisa em vídeo…"
 className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
 />
 </label>
 </div>

 {/* Filters */}
 <div className="rounded-sm border border-border bg-card p-5 space-y-4">
 <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
 <input
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder="Buscar por nome, email, cargo, empresa…"
 className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
 />
 <label className="flex items-center gap-2 text-xs text-muted-foreground">
 <input
 type="checkbox"
 checked={excludeAlreadyInvited}
 onChange={(e) => setExcludeAlreadyInvited(e.target.checked)}
 />
 Esconder já convidados
 </label>
 </div>
 <div className="flex flex-wrap gap-2">
 {(dims.data?.dimensions ?? []).flatMap((d) =>
 d.values.map((v) => {
 const on = tagValueIds.includes(v.id);
 return (
 <button
 key={v.id}
 onClick={() =>
 setTagValueIds((prev) => (on ? prev.filter((x) => x !== v.id) : [...prev, v.id]))
 }
 className={`rounded-full border px-3 py-1 text-xs transition-colors ${
 on
 ? "border-primary bg-primary text-primary-foreground"
 : "border-border bg-background hover:border-primary/40"
 }`}
 >
 {d.label}: {v.label}
 </button>
 );
 }),
 )}
 </div>
 </div>

 {/* Pool */}
 <div className="rounded-sm border border-border bg-card overflow-hidden">
 <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
 <div className="text-sm">
 <span className="font-medium">{pool.data?.respondents.length ?? 0}</span> respondente(s)
 {pool.data && (
 <span className="text-muted-foreground"> · {pool.data.invited_count} já convidado(s) neste estudo</span>
 )}
 </div>
 <div className="flex items-center gap-3">
 <button onClick={toggleAll} className="text-xs text-muted-foreground hover:text-foreground">
 {selectedIds.size > 0 ? "Limpar seleção": "Selecionar todos elegíveis"}
 </button>
 <button
 disabled={selectedIds.size === 0 || invite.isPending || !studyId}
 onClick={() => invite.mutate()}
 className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
 >
 {invite.isPending
 ? "Registrando…"
 : `Convidar ${selectedIds.size} respondente(s)`}
 </button>
 </div>
 </div>

 {pool.isLoading ? (
 <div className="p-8 text-sm text-muted-foreground">Carregando…</div>
 ) : pool.data?.respondents.length === 0 ? (
 <div className="p-8 text-sm text-muted-foreground">
 Nenhum respondente encontrado com esses filtros.
 </div>
 ) : (
 <ul className="divide-y divide-border">
 {pool.data?.respondents.map((r) => {
 const selected = selectedIds.has(r.id);
 const wa = composeWhatsappLink(r.phone);
 const mailto = composeMailto(r.email);
 return (
 <li key={r.id} className="flex flex-wrap items-start gap-4 px-5 py-3 hover:bg-accent/30">
 <label className="flex items-center pt-1">
 <input
 type="checkbox"
 checked={selected}
 disabled={!!r.invitation}
 onChange={() => toggle(r.id)}
 />
 </label>
 <div className="min-w-0 flex-1">
 <div className="flex flex-wrap items-center gap-2">
 <span className="font-medium">{r.full_name ?? "(sem nome)"}</span>
 {r.invitation && (
 <span className="rounded-sm bg-accent/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent">
 {r.invitation.status} · {r.invitation.channel}
 </span>
 )}
 {r.studies_count > 0 && (
 <span className="text-[10px] font-mono text-muted-foreground">
 {r.studies_count} estudo(s) · {r.completed_count} concluído(s)
 {r.avg_quality_score != null && ` · qualidade ${Number(r.avg_quality_score).toFixed(1)}`}
 </span>
 )}
 </div>
 <div className="mt-1 text-xs text-muted-foreground">
 {[r.occupation, r.company, r.city && (r.state ? `${r.city}/${r.state}` : r.city)].filter(Boolean).join("· ") || "—"}
 </div>
 {r.tags.length > 0 && (
 <div className="mt-1.5 flex flex-wrap gap-1">
 {r.tags.map((t, i) => (
 <span key={i} className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
 {t.dimension}: {t.label}
 </span>
 ))}
 </div>
 )}
 <div className="mt-1 text-[11px] text-muted-foreground font-mono">
 {r.email ?? "—"} {r.phone ? `· ${r.phone}` : ""}
 </div>
 </div>
 <div className="flex flex-col gap-1 text-xs">
 {wa && (
 <a href={wa} target="_blank"rel="noopener noreferrer"className="text-primary hover:underline">
 WhatsApp →
 </a>
 )}
 {mailto && (
 <a href={mailto} className="text-primary hover:underline">
 Email →
 </a>
 )}
 </div>
 </li>
 );
 })}
 </ul>
 )}
 </div>
 </div>
 );
}
