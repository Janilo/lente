import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { listSynthesis, generateSynthesis } from "@/lib/synthesis.functions";
import { exportSynthesisPDF } from "@/lib/export-synthesis";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/studies/$id/synthesis")({
  head: () => ({ meta: [{ title: "Síntese — Lente" }] }),
  component: SynthesisPage,
});

type Evidence = {
  quote: string;
  interview_index?: number | null;
  question_text?: string | null;
  video_url?: string | null;
  clip_start?: number | null;
  clip_end?: number | null;
};

function fmtTime(s: number | null | undefined): string {
  if (s == null || !isFinite(s)) return "—";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function EvidenceClip({ ev }: { ev: Evidence }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [open, setOpen] = useState(false);

  // Seek + auto-stop at clip_end
  useEffect(() => {
    if (!open) return;
    const v = ref.current;
    if (!v) return;
    const start = ev.clip_start ?? 0;
    const end = ev.clip_end ?? null;
    const onLoaded = () => {
      try {
        v.currentTime = start;
      } catch {
        /* noop */
      }
    };
    const onTime = () => {
      if (end != null && v.currentTime >= end) v.pause();
    };
    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("timeupdate", onTime);
    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("timeupdate", onTime);
    };
  }, [open, ev.clip_start, ev.clip_end]);

  return (
    <li className="border-l-2 border-primary/40 pl-3">
      <p className="text-sm italic text-muted-foreground leading-snug">"{ev.quote}"</p>
      <div className="mt-1.5 flex items-center gap-3 flex-wrap">
        <span className="text-xs text-muted-foreground font-mono">
          {ev.interview_index != null ? `Entrevista ${ev.interview_index}` : "—"}
          {ev.clip_start != null && (
            <>
              {" "}
              · {fmtTime(ev.clip_start)}
              {ev.clip_end != null ? `–${fmtTime(ev.clip_end)}` : ""}
            </>
          )}
        </span>
        {ev.video_url ? (
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
          >
            {open ? "Fechar clipe" : "▶ Tocar clipe"}
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">sem vídeo</span>
        )}
      </div>
      {open && ev.video_url && (
        <video
          ref={ref}
          src={ev.video_url}
          controls
          autoPlay
          className="mt-2 w-full max-w-md rounded-md border border-border bg-black"
        />
      )}
    </li>
  );
}

function SynthesisPage() {
  const { id } = Route.useParams();
  const fetchFn = useServerFn(listSynthesis);
  const genFn = useServerFn(generateSynthesis);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["synthesis", id],
    queryFn: () => fetchFn({ data: { study_id: id } }),
  });

  const gen = useMutation({
    mutationFn: async () => genFn({ data: { study_id: id } }),
    onSuccess: (r) => {
      toast.success(
        `Síntese gerada: ${r.insight_count} insights, ${r.recommendation_count} recomendações.`,
      );
      qc.invalidateQueries({ queryKey: ["synthesis", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading)
    return (
      <div className="mx-auto max-w-4xl px-6 py-12 text-sm text-muted-foreground">Carregando…</div>
    );

  const insights = data?.insights ?? [];
  const recs = data?.recommendations ?? [];
  const priorityLabel = (p: number | null) =>
    p === 1 ? "Alta" : p === 2 ? "Média" : p === 3 ? "Baixa" : "—";
  const priorityCls = (p: number | null) =>
    p === 1
      ? "bg-[color:var(--lente-danger)]/10 text-[color:var(--lente-danger)]"
      : p === 2
        ? "bg-[color:var(--lente-amber-soft)] text-[color:var(--lente-amber-ink)]"
        : "bg-muted text-muted-foreground";

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            to="/studies/$id"
            params={{ id }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Voltar ao estudo
          </Link>
          <h1 className="mt-3 text-3xl">Síntese e recomendações</h1>
          <p className="text-sm text-muted-foreground mt-1">
            A IA analisa todas as transcrições prontas e extrai temas, com clipes em vídeo ancorando
            cada citação.
          </p>
        </div>
        <div className="mt-8 flex flex-wrap gap-2">
          {insights.length > 0 && data?.study && (
            <button
              onClick={() => {
                try {
                  exportSynthesisPDF({
                    study: data.study,
                    interview_count: data.interview_count ?? 0,
                    insights: insights as unknown as Parameters<
                      typeof exportSynthesisPDF
                    >[0]["insights"],
                    recommendations: recs as unknown as Parameters<
                      typeof exportSynthesisPDF
                    >[0]["recommendations"],
                  });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Falha ao gerar PDF");
                }
              }}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Exportar PDF
            </button>
          )}
          <button
            onClick={() => gen.mutate()}
            disabled={gen.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4 text-[color:var(--lente-coral)]" />
            {gen.isPending
              ? "Sintetizando…"
              : insights.length > 0
                ? "Regenerar síntese"
                : "Gerar síntese"}
          </button>
        </div>
      </div>

      {insights.length === 0 && recs.length === 0 ? (
        <div className="rounded-sm border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhuma síntese ainda. Clique em "Gerar síntese"depois que as entrevistas tiverem
          transcrições prontas.
        </div>
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="text-xl">Insights ({insights.length})</h2>
            <ul className="space-y-3">
              {insights.map((ins) => {
                const evidence = (ins.evidence as unknown as Evidence[] | null) ?? [];
                return (
                  <li key={ins.id} className="rounded-sm border border-border bg-card p-5">
                    <div className="text-base font-medium text-[color:var(--lente-coral-deep)] dark:text-[color:var(--lente-coral)]">
                      {ins.theme}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      {ins.summary}
                    </p>
                    {evidence.length > 0 && (
                      <ul className="mt-3 space-y-3">
                        {evidence.map((e, i) => (
                          <EvidenceClip key={i} ev={e} />
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl">Recomendações ({recs.length})</h2>
            <ul className="space-y-3">
              {recs.map((r) => (
                <li key={r.id} className="rounded-sm border border-border bg-card p-5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-base font-medium">{r.title}</div>
                    <span
                      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-semibold ${priorityCls(r.priority)}`}
                    >
                      Prioridade {priorityLabel(r.priority)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {r.rationale}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
