import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getStudy, updateStudy, upsertQuestion, deleteQuestion } from "@/lib/studies.functions";
import { toast } from "sonner";
import { ScriptBuilderActions } from "@/components/study/ScriptBuilderActions";

const PUBLISHED_ORIGIN = "https://lentejps.lovable.app";

function getRespondentOrigin() {
  if (typeof window === "undefined") return PUBLISHED_ORIGIN;
  const host = window.location.hostname;
  if (host.includes("lovableproject.com") || host.includes("id-preview--") || host.includes("-preview--")) {
    return PUBLISHED_ORIGIN;
  }
  return window.location.origin;
}

export const Route = createFileRoute("/_authenticated/studies/$id")({
  head: () => ({ meta: [{ title: "Editar estudo — Lente" }] }),
  component: StudyEditor,
});

function StudyEditor() {
  const { id } = Route.useParams();
  const fetchStudy = useServerFn(getStudy);
  const updateFn = useServerFn(updateStudy);
  const upsertQ = useServerFn(upsertQuestion);
  const deleteQ = useServerFn(deleteQuestion);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["study", id],
    queryFn: () => fetchStudy({ data: { id } }),
  });

  const [form, setForm] = useState({
    title: "", business_goal: "", context: "", target_audience: "",
    max_followups: 2, status: "draft" as "draft" | "published" | "closed",
  });

  useEffect(() => {
    if (data?.study) {
      setForm({
        title: data.study.title ?? "",
        business_goal: data.study.business_goal ?? "",
        context: data.study.context ?? "",
        target_audience: data.study.target_audience ?? "",
        max_followups: data.study.max_followups ?? 2,
        status: data.study.status as "draft" | "published" | "closed",
      });
    }
  }, [data?.study]);

  const save = useMutation({
    mutationFn: async () => updateFn({ data: { id, ...form } }),
    onSuccess: () => { toast.success("Estudo salvo"); qc.invalidateQueries({ queryKey: ["study", id] }); qc.invalidateQueries({ queryKey: ["studies"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addQ = useMutation({
    mutationFn: async () => upsertQ({ data: { study_id: id, position: (data?.questions.length ?? 0), text: "Nova pergunta", intent: "" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const editQ = useMutation({
    mutationFn: async (q: { id: string; position: number; text: string; intent: string }) =>
      upsertQ({ data: { id: q.id, study_id: id, position: q.position, text: q.text, intent: q.intent } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeQ = useMutation({
    mutationFn: async (qid: string) => deleteQ({ data: { id: qid, study_id: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="mx-auto max-w-4xl px-6 py-12 text-sm text-muted-foreground">Carregando…</div>;
  if (!data?.study) return <div className="mx-auto max-w-4xl px-6 py-12">Estudo não encontrado.</div>;

  const publicLink = `${getRespondentOrigin()}/r/${data.study.public_slug}`;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 space-y-10">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">← Meus estudos</Link>
          <h1 className="mt-3 text-4xl">{form.title || "Sem título"}</h1>
        </div>
        <Link to="/studies/$id/interviews" params={{ id }}
          className="mt-8 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
          Ver entrevistas
        </Link>
        <Link to="/studies/$id/respondents" params={{ id }}
          className="mt-8 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
          Respondentes
        </Link>
        <Link to="/studies/$id/synthesis" params={{ id }}
          className="mt-8 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          Síntese e recomendações
        </Link>
      </div>



      <section className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-xl">Contexto do estudo</h2>
        <Field label="Título">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </Field>
        <Field label="Objetivo de negócio" hint="O que você quer aprender ou decidir com esta pesquisa.">
          <textarea rows={3} value={form.business_goal} onChange={(e) => setForm({ ...form, business_goal: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </Field>
        <Field label="Contexto da marca / produto" hint="O que o entrevistado e a IA precisam saber para interpretar bem as respostas.">
          <textarea rows={4} value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </Field>
        <Field label="Público-alvo">
          <input value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Profundidade dos follow-ups" hint="Quantas perguntas de aprofundamento a IA pode fazer por pergunta (0–5).">
            <input type="number" min={0} max={5} value={form.max_followups}
              onChange={(e) => setForm({ ...form, max_followups: Math.max(0, Math.min(5, Number(e.target.value))) })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="draft">Rascunho</option>
              <option value="published">Publicado (link ativo)</option>
              <option value="closed">Encerrado</option>
            </select>
          </Field>
        </div>
        <div className="flex justify-end">
          <button onClick={() => save.mutate()} disabled={save.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {save.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-xl">Roteiro de perguntas</h2>
          <ScriptBuilderActions
            studyId={id}
            onAddManual={() => addQ.mutate()}
            isAddingManual={addQ.isPending}
          />
        </div>
        {data.questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Adicione perguntas para guiar a entrevista. A IA poderá complementar com follow-ups.</p>
        ) : (
          <ol className="space-y-3">
            {data.questions.map((q, idx) => (
              <li key={q.id} className="rounded-md border border-border bg-background p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Pergunta {idx + 1}</span>
                  <button onClick={() => removeQ.mutate(q.id)} className="hover:text-destructive">Remover</button>
                </div>
                <textarea defaultValue={q.text} rows={2}
                  onBlur={(e) => e.target.value !== q.text && editQ.mutate({ id: q.id, position: q.position, text: e.target.value, intent: q.intent ?? "" })}
                  className="mt-2 w-full rounded-md border border-input bg-card px-3 py-2 text-sm" />
                <input defaultValue={q.intent ?? ""} placeholder="Intenção (opcional) — o que esta pergunta deve revelar"
                  onBlur={(e) => e.target.value !== (q.intent ?? "") && editQ.mutate({ id: q.id, position: q.position, text: q.text, intent: e.target.value })}
                  className="mt-2 w-full rounded-md border border-input bg-card px-3 py-2 text-xs text-muted-foreground" />
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-xl">Link da entrevista</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {form.status === "published"
            ? "Compartilhe este link com seus entrevistados."
            : "Publique o estudo para ativar o link."}
        </p>
        <div className="mt-4 flex items-center gap-2">
          <input readOnly value={publicLink} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground" />
          <button onClick={() => { navigator.clipboard.writeText(publicLink); toast.success("Copiado"); }}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">Copiar</button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          O respondente acessa o link publicado, cria conta ou entra, grava as respostas em vídeo e a IA transcreve e faz follow-ups automaticamente.
        </p>
      </section>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
