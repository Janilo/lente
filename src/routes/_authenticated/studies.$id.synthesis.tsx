import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listSynthesis, generateSynthesis } from "@/lib/synthesis.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/studies/$id/synthesis")({
  head: () => ({ meta: [{ title: "Síntese — Lente" }] }),
  component: SynthesisPage,
});

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
      toast.success(`Síntese gerada: ${r.insight_count} insights, ${r.recommendation_count} recomendações.`);
      qc.invalidateQueries({ queryKey: ["synthesis", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="mx-auto max-w-4xl px-6 py-12 text-sm text-muted-foreground">Carregando…</div>;

  const insights = data?.insights ?? [];
  const recs = data?.recommendations ?? [];
  const priorityLabel = (p: number | null) => (p === 1 ? "Alta" : p === 2 ? "Média" : p === 3 ? "Baixa" : "—");
  const priorityCls = (p: number | null) =>
    p === 1 ? "bg-destructive/10 text-destructive" : p === 2 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground";

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link to="/studies/$id" params={{ id }} className="text-sm text-muted-foreground hover:text-foreground">← Voltar ao estudo</Link>
          <h1 className="mt-3 text-3xl">Síntese e recomendações</h1>
          <p className="text-sm text-muted-foreground mt-1">A IA analisa todas as transcrições prontas e extrai temas e ações.</p>
        </div>
        <button onClick={() => gen.mutate()} disabled={gen.isPending}
          className="mt-8 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {gen.isPending ? "Sintetizando..." : insights.length > 0 ? "Regenerar síntese" : "Gerar síntese"}
        </button>
      </div>

      {insights.length === 0 && recs.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhuma síntese ainda. Clique em "Gerar síntese" depois que as entrevistas tiverem transcrições prontas.
        </div>
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="text-xl">Insights ({insights.length})</h2>
            <ul className="space-y-3">
              {insights.map((ins) => {
                const evidence = (ins.evidence as Array<{ quote: string; interview_index: number }> | null) ?? [];
                return (
                  <li key={ins.id} className="rounded-lg border border-border bg-card p-5">
                    <div className="text-base font-medium">{ins.theme}</div>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{ins.summary}</p>
                    {evidence.length > 0 && (
                      <ul className="mt-3 space-y-2">
                        {evidence.map((e, i) => (
                          <li key={i} className="border-l-2 border-primary/40 pl-3 text-sm italic text-muted-foreground">
                            "{e.quote}" <span className="not-italic text-xs">— Entrevista {e.interview_index}</span>
                          </li>
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
                <li key={r.id} className="rounded-lg border border-border bg-card p-5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-base font-medium">{r.title}</div>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${priorityCls(r.priority)}`}>
                      Prioridade {priorityLabel(r.priority)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{r.rationale}</p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
