import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  adminGetOverview,
  adminListStudies,
  adminListUsers,
  adminListRespondents,
  adminListCtaClicks,
  adminGetSettings,
  adminUpdateSettings,
  adminSetCanPublish,
} from "@/lib/admin.functions";
import {
  adminListTagDimensions,
  adminCreateTagValue,
  adminUpdateTagValue,
  adminDeleteTagValue,
  adminListRespondentPool,
  adminAssignTag,
  adminUnassignTag,
} from "@/lib/respondent-pool.functions";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  head: () => ({ meta: [{ title: "Admin — Lente" }] }),
  component: AdminAnalyticsPage,
});

function AdminAnalyticsPage() {
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/dashboard" });
  }, [loading, isAdmin, navigate]);

  if (loading) return <div className="mx-auto max-w-6xl px-6 py-12 text-sm text-muted-foreground">Carregando…</div>;
  if (!isAdmin) return null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <div>
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">← Voltar</Link>
        <h1 className="mt-2 text-4xl">Administração</h1>
        <p className="mt-1 text-sm text-muted-foreground">Painel restrito ao administrador da plataforma.</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="pool">Pool</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
          <TabsTrigger value="studies">Estudos</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="respondents">Respondentes (legado)</TabsTrigger>
          <TabsTrigger value="ctas">Cliques CTA</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="pool"><PoolTab /></TabsContent>
        <TabsContent value="tags"><TagsTab /></TabsContent>
        <TabsContent value="studies"><StudiesTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="respondents"><RespondentsTab /></TabsContent>
        <TabsContent value="ctas"><CtaTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab() {
  const fn = useServerFn(adminGetOverview);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "overview"], queryFn: () => fn() });
  if (isLoading) return <p className="text-sm text-muted-foreground py-6">Carregando…</p>;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 py-6">
      <StatCard label="Estudos" value={data?.totalStudies ?? 0} />
      <StatCard label="Usuários" value={data?.totalUsers ?? 0} />
      <StatCard label="Entrevistas" value={data?.totalInterviews ?? 0} />
      <StatCard label="Cliques CTA" value={data?.totalCtaClicks ?? 0} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-medium">{value}</div>
    </div>
  );
}

function StudiesTab() {
  const fn = useServerFn(adminListStudies);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "studies"], queryFn: () => fn() });
  if (isLoading) return <p className="text-sm text-muted-foreground py-6">Carregando…</p>;
  return (
    <div className="overflow-x-auto py-6">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr><Th>Título</Th><Th>Dono</Th><Th>E-mail</Th><Th>Status</Th><Th>Entrevistas</Th><Th>Criado</Th></tr>
        </thead>
        <tbody>
          {(data?.studies ?? []).map((s) => (
            <tr key={s.id} className="border-t border-border">
              <Td>{s.title}</Td>
              <Td>{s.owner_name ?? "—"}</Td>
              <Td>{s.owner_email ?? "—"}</Td>
              <Td>{s.status}</Td>
              <Td>{s.interviews_count}</Td>
              <Td>{new Date(s.created_at).toLocaleDateString("pt-BR")}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UsersTab() {
  const list = useServerFn(adminListUsers);
  const setPub = useServerFn(adminSetCanPublish);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin", "users"], queryFn: () => list() });

  const mut = useMutation({
    mutationFn: (vars: { user_id: string; can_publish: boolean }) => setPub({ data: vars }),
    onSuccess: () => { toast.success("Permissão atualizada"); qc.invalidateQueries({ queryKey: ["admin", "users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground py-6">Carregando…</p>;
  return (
    <div className="overflow-x-auto py-6">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr><Th>Nome</Th><Th>E-mail</Th><Th>Roles</Th><Th>Cadastro</Th><Th>Pode publicar</Th></tr>
        </thead>
        <tbody>
          {(data?.users ?? []).map((u) => (
            <tr key={u.id} className="border-t border-border">
              <Td>{u.full_name ?? "—"}</Td>
              <Td>{u.email ?? "—"}</Td>
              <Td>{u.roles.join(", ") || "—"}</Td>
              <Td>{new Date(u.created_at).toLocaleDateString("pt-BR")}</Td>
              <Td>
                <Switch
                  checked={!!u.can_publish}
                  onCheckedChange={(checked) => mut.mutate({ user_id: u.id, can_publish: checked })}
                />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const AGE_RANGES = ["", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

function RespondentsTab() {
  const fn = useServerFn(adminListRespondents);
  const [filters, setFilters] = useState({
    name: "", email: "", city: "", state: "",
    age_range: "", occupation: "", industry: "", research_interest: "",
  });
  const [applied, setApplied] = useState(filters);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "respondents", applied],
    queryFn: () => fn({ data: applied }),
  });

  const update = (k: keyof typeof filters, v: string) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div className="py-6 space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <FilterInput label="Nome" value={filters.name} onChange={(v) => update("name", v)} />
        <FilterInput label="E-mail" value={filters.email} onChange={(v) => update("email", v)} />
        <FilterInput label="Cidade" value={filters.city} onChange={(v) => update("city", v)} />
        <FilterInput label="Estado" value={filters.state} onChange={(v) => update("state", v)} />
        <div>
          <label className="text-xs text-muted-foreground">Faixa etária</label>
          <select
            value={filters.age_range}
            onChange={(e) => update("age_range", e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          >
            {AGE_RANGES.map((r) => <option key={r} value={r}>{r || "Todas"}</option>)}
          </select>
        </div>
        <FilterInput label="Cargo / Ocupação" value={filters.occupation} onChange={(v) => update("occupation", v)} />
        <FilterInput label="Setor / Indústria" value={filters.industry} onChange={(v) => update("industry", v)} />
        <FilterInput label="Área de interesse" value={filters.research_interest} onChange={(v) => update("research_interest", v)} />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setApplied(filters)}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
        >Aplicar filtros</button>
        <button
          onClick={() => { const empty = { name: "", email: "", city: "", state: "", age_range: "", occupation: "", industry: "", research_interest: "" }; setFilters(empty); setApplied(empty); }}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
        >Limpar</button>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <Th>Nome</Th><Th>E-mail</Th><Th>Cidade</Th><Th>Estado</Th>
                <Th>Faixa</Th><Th>Ocupação</Th><Th>Indústria</Th><Th>Interesses</Th><Th>Entrev.</Th>
              </tr>
            </thead>
            <tbody>
              {(data?.respondents ?? []).map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <Td>{r.full_name ?? "—"}</Td>
                  <Td>{r.email ?? "—"}</Td>
                  <Td>{r.city ?? "—"}</Td>
                  <Td>{r.state ?? "—"}</Td>
                  <Td>{r.age_range ?? "—"}</Td>
                  <Td>{r.occupation ?? "—"}</Td>
                  <Td>{r.industry ?? "—"}</Td>
                  <Td>{(r.research_interests ?? []).join(", ") || "—"}</Td>
                  <Td>{r.interviews_count}</Td>
                </tr>
              ))}
              {(data?.respondents ?? []).length === 0 && (
                <tr><td colSpan={9} className="py-4 text-center text-muted-foreground">Nenhum respondente encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
      />
    </div>
  );
}

function CtaTab() {
  const fn = useServerFn(adminListCtaClicks);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "ctas"], queryFn: () => fn() });
  if (isLoading) return <p className="text-sm text-muted-foreground py-6">Carregando…</p>;
  return (
    <div className="overflow-x-auto py-6">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr><Th>Quando</Th><Th>CTA</Th><Th>Destino</Th><Th>Referrer</Th></tr>
        </thead>
        <tbody>
          {(data?.clicks ?? []).map((c) => (
            <tr key={c.id} className="border-t border-border">
              <Td>{new Date(c.created_at).toLocaleString("pt-BR")}</Td>
              <Td>{c.cta_id}</Td>
              <Td className="truncate max-w-xs">{c.href}</Td>
              <Td className="truncate max-w-xs">{c.referrer ?? "—"}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SettingsTab() {
  const get = useServerFn(adminGetSettings);
  const update = useServerFn(adminUpdateSettings);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin", "settings"], queryFn: () => get() });
  const [provider, setProvider] = useState<"elevenlabs" | "assemblyai">("elevenlabs");

  useEffect(() => { if (data?.stt_provider) setProvider(data.stt_provider); }, [data?.stt_provider]);

  const save = useMutation({
    mutationFn: () => update({ data: { stt_provider: provider } }),
    onSuccess: () => { toast.success("Configuração salva"); qc.invalidateQueries({ queryKey: ["admin", "settings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground py-6">Carregando…</p>;

  return (
    <div className="py-6 max-w-md space-y-4">
      <h2 className="text-lg">Transcrição (STT)</h2>
      <p className="text-xs text-muted-foreground">A mudança entra em vigor em até 60 segundos (cache do servidor).</p>
      <div>
        <label className="text-sm">Provedor</label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as "elevenlabs" | "assemblyai")}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="elevenlabs">ElevenLabs (scribe_v2)</option>
          <option value="assemblyai">AssemblyAI (universal-3-pro)</option>
        </select>
      </div>
      <button
        onClick={() => save.mutate()}
        disabled={save.isPending || provider === data?.stt_provider}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {save.isPending ? "Salvando…" : "Salvar"}
      </button>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 font-medium">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}
