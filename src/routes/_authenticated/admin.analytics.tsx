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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">← Voltar</Link>
          <h1 className="mt-2 text-4xl">Administração</h1>
          <p className="mt-1 text-sm text-muted-foreground">Painel restrito ao administrador da plataforma.</p>
        </div>
        <Link
          to="/admin/recrutamento"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Recrutamento →
        </Link>
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

// ---------- Tags Tab ----------
function TagsTab() {
  const list = useServerFn(adminListTagDimensions);
  const create = useServerFn(adminCreateTagValue);
  const update = useServerFn(adminUpdateTagValue);
  const del = useServerFn(adminDeleteTagValue);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin", "tag-dims"], queryFn: () => list() });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "tag-dims"] });

  const createMut = useMutation({
    mutationFn: (vars: { dimension_id: string; slug: string; label: string }) => create({ data: vars }),
    onSuccess: () => { toast.success("Valor adicionado"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: (vars: { id: string; label: string }) => update({ data: vars }),
    onSuccess: () => { toast.success("Atualizado"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removido"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground py-6">Carregando…</p>;

  return (
    <div className="py-6 space-y-8">
      <p className="text-sm text-muted-foreground">
        As 5 dimensões são fixas. Cadastre os valores que ficam disponíveis para classificar respondentes (ex: em <em>Setor</em>: Varejo, SaaS, Financeiro…).
      </p>
      {(data?.dimensions ?? []).map((dim) => (
        <DimensionEditor
          key={dim.id}
          dimension={dim}
          onCreate={(slug, label) => createMut.mutate({ dimension_id: dim.id, slug, label })}
          onUpdate={(id, label) => updateMut.mutate({ id, label })}
          onDelete={(id) => { if (confirm("Remover este valor? Respondentes perderão essa tag.")) deleteMut.mutate(id); }}
        />
      ))}
    </div>
  );
}

function DimensionEditor({
  dimension,
  onCreate,
  onUpdate,
  onDelete,
}: {
  dimension: { id: string; label: string; description: string | null; values: { id: string; slug: string; label: string }[] };
  onCreate: (slug: string, label: string) => void;
  onUpdate: (id: string, label: string) => void;
  onDelete: (id: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [slug, setSlug] = useState("");

  const submit = () => {
    if (!label.trim() || !slug.trim()) { toast.error("Preencha slug e rótulo"); return; }
    onCreate(slug.trim().toLowerCase(), label.trim());
    setLabel(""); setSlug("");
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div>
        <h3 className="text-lg">{dimension.label}</h3>
        {dimension.description && <p className="text-xs text-muted-foreground mt-1">{dimension.description}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        {dimension.values.length === 0 && (
          <span className="text-xs text-muted-foreground italic">Nenhum valor cadastrado.</span>
        )}
        {dimension.values.map((v) => (
          <TagValueChip key={v.id} value={v} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 pt-3 border-t border-border">
        <input
          placeholder="Rótulo (ex: Varejo)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        />
        <input
          placeholder="Slug (ex: varejo)"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm font-mono"
        />
        <button
          onClick={submit}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
        >Adicionar</button>
      </div>
    </div>
  );
}

function TagValueChip({
  value,
  onUpdate,
  onDelete,
}: {
  value: { id: string; slug: string; label: string };
  onUpdate: (id: string, label: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value.label);
  if (editing) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1 text-xs">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="bg-transparent outline-none w-32"
          autoFocus
        />
        <button onClick={() => { onUpdate(value.id, draft); setEditing(false); }} className="text-primary">✓</button>
        <button onClick={() => { setDraft(value.label); setEditing(false); }} className="text-muted-foreground">✕</button>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs">
      <span>{value.label}</span>
      <span className="text-muted-foreground font-mono opacity-60">{value.slug}</span>
      <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-foreground">✎</button>
      <button onClick={() => onDelete(value.id)} className="text-muted-foreground hover:text-destructive">×</button>
    </span>
  );
}

// ---------- Pool Tab ----------
function PoolTab() {
  const listDims = useServerFn(adminListTagDimensions);
  const listPool = useServerFn(adminListRespondentPool);
  const assign = useServerFn(adminAssignTag);
  const unassign = useServerFn(adminUnassignTag);
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const dimsQ = useQuery({ queryKey: ["admin", "tag-dims"], queryFn: () => listDims() });
  const poolQ = useQuery({
    queryKey: ["admin", "pool", appliedSearch, selectedTags],
    queryFn: () => listPool({ data: { search: appliedSearch, tagValueIds: selectedTags, onlyActive: true } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "pool"] });
  const assignMut = useMutation({
    mutationFn: (vars: { respondent_id: string; tag_value_id: string }) => assign({ data: vars }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const unassignMut = useMutation({
    mutationFn: (vars: { respondent_id: string; tag_value_id: string }) => unassign({ data: vars }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleTag = (id: string) => setSelectedTags((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const allValues = useMemo(() => {
    const out: { id: string; label: string; dimension: string }[] = [];
    for (const d of dimsQ.data?.dimensions ?? []) {
      for (const v of d.values) out.push({ id: v.id, label: v.label, dimension: d.label });
    }
    return out;
  }, [dimsQ.data]);

  return (
    <div className="py-6 space-y-5">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground">Buscar (nome, e-mail, cargo, empresa)</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") setAppliedSearch(search); }}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={() => setAppliedSearch(search)}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >Buscar</button>
        {(appliedSearch || selectedTags.length > 0) && (
          <button
            onClick={() => { setSearch(""); setAppliedSearch(""); setSelectedTags([]); }}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
          >Limpar</button>
        )}
      </div>

      <div className="space-y-2">
        {(dimsQ.data?.dimensions ?? []).map((dim) => dim.values.length > 0 && (
          <div key={dim.id} className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs uppercase tracking-wide text-muted-foreground w-32 shrink-0">{dim.label}</span>
            {dim.values.map((v) => {
              const on = selectedTags.includes(v.id);
              return (
                <button
                  key={v.id}
                  onClick={() => toggleTag(v.id)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-accent"}`}
                >{v.label}</button>
              );
            })}
          </div>
        ))}
        {allValues.length === 0 && (
          <p className="text-xs text-muted-foreground italic">Cadastre valores de tag em "Tags" para filtrar o pool.</p>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        {poolQ.isLoading ? "Carregando…" : `${poolQ.data?.respondents.length ?? 0} respondente(s)`}
        {selectedTags.length > 0 && ` · com TODAS as ${selectedTags.length} tags selecionadas`}
      </div>

      <div className="space-y-3">
        {(poolQ.data?.respondents ?? []).map((r) => (
          <RespondentCard
            key={r.id}
            respondent={r}
            allValues={allValues}
            onAssign={(tag_value_id) => assignMut.mutate({ respondent_id: r.id, tag_value_id })}
            onUnassign={(tag_value_id) => unassignMut.mutate({ respondent_id: r.id, tag_value_id })}
          />
        ))}
        {!poolQ.isLoading && (poolQ.data?.respondents ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhum respondente encontrado.</p>
        )}
      </div>
    </div>
  );
}

function RespondentCard({
  respondent,
  allValues,
  onAssign,
  onUnassign,
}: {
  respondent: {
    id: string; full_name: string | null; email: string | null; phone: string | null;
    city: string | null; state: string | null; occupation: string | null; company: string | null;
    source: string | null; studies_count: number; completed_count: number;
    last_participation_at: string | null; avg_quality_score: number | string | null;
    tags: { tag_value_id: string; label: string; dimension: string }[];
  };
  allValues: { id: string; label: string; dimension: string }[];
  onAssign: (tag_value_id: string) => void;
  onUnassign: (tag_value_id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const assignedIds = new Set(respondent.tags.map((t) => t.tag_value_id));
  const available = allValues.filter((v) => !assignedIds.has(v.id));

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-base font-medium">{respondent.full_name ?? "(sem nome)"}</div>
          <div className="text-xs text-muted-foreground">
            {[respondent.email, respondent.phone, respondent.occupation, respondent.company, [respondent.city, respondent.state].filter(Boolean).join("/")].filter(Boolean).join(" · ") || "—"}
          </div>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span><strong className="text-foreground">{respondent.studies_count}</strong> estudos</span>
          <span><strong className="text-foreground">{respondent.completed_count}</strong> concluídas</span>
          {respondent.avg_quality_score != null && (
            <span>Qualidade <strong className="text-foreground">{Number(respondent.avg_quality_score).toFixed(1)}</strong></span>
          )}
          {respondent.last_participation_at && (
            <span>Última: {new Date(respondent.last_participation_at).toLocaleDateString("pt-BR")}</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        {respondent.tags.map((t) => (
          <span key={t.tag_value_id} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs">
            <span className="text-muted-foreground">{t.dimension}:</span>
            <span>{t.label}</span>
            <button onClick={() => onUnassign(t.tag_value_id)} className="text-muted-foreground hover:text-destructive">×</button>
          </span>
        ))}
        {!adding ? (
          <button
            onClick={() => setAdding(true)}
            disabled={available.length === 0}
            className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs hover:bg-accent disabled:opacity-40"
          >+ tag</button>
        ) : (
          <select
            autoFocus
            defaultValue=""
            onChange={(e) => { if (e.target.value) { onAssign(e.target.value); setAdding(false); } }}
            onBlur={() => setAdding(false)}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          >
            <option value="">Escolher tag…</option>
            {available.map((v) => (
              <option key={v.id} value={v.id}>{v.dimension}: {v.label}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

