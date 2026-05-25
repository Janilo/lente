import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getInterviewDetail } from "@/lib/interview.functions";

export const Route = createFileRoute("/_authenticated/studies/$id/interviews/$interviewId")({
  head: () => ({ meta: [{ title: "Entrevista — Lente" }] }),
  component: InterviewDetail,
});

function InterviewDetail() {
  const { id, interviewId } = Route.useParams();
  const fetchDetail = useServerFn(getInterviewDetail);
  const { data, isLoading } = useQuery({
    queryKey: ["interview-detail", interviewId],
    queryFn: () => fetchDetail({ data: { interview_id: interviewId } }),
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d) return false;
      const pending = d.answers.some((a) => a.status === "uploading" || a.status === "transcribing");
      return pending ? 5000 : false;
    },
  });

  if (isLoading) return <div className="mx-auto max-w-4xl px-6 py-12 text-sm text-muted-foreground">Carregando…</div>;
  if (!data) return <div className="mx-auto max-w-4xl px-6 py-12">Entrevista não encontrada.</div>;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 space-y-6">
      <div>
        <Link to="/studies/$id/interviews" params={{ id }} className="text-sm text-muted-foreground hover:text-foreground">← Todas as entrevistas</Link>
        <h1 className="mt-3 text-3xl">{data.interview.study_title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {data.interview.status === "completed" ? "Concluída" : "Em andamento"} ·
          Iniciada em {new Date(data.interview.started_at).toLocaleString("pt-BR")}
        </p>
      </div>

      {data.answers.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhuma resposta gravada ainda.
        </div>
      ) : (
        <ol className="space-y-6">
          {data.answers.map((a, idx) => (
            <li key={a.id} className="rounded-lg border border-border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-xs text-muted-foreground">
                  Resposta {idx + 1}{a.is_followup && " · follow-up"}
                </div>
                <StatusPill status={a.status} />
              </div>
              <div className="text-sm font-medium">{a.question_text}</div>

              {a.video_url ? (
                <video controls src={a.video_url} className="w-full rounded-md bg-black aspect-video" />
              ) : (
                <div className="text-xs text-muted-foreground">Vídeo indisponível.</div>
              )}

              {a.status === "ready" && a.transcript && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Transcrição</div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{a.transcript}</p>
                </div>
              )}
              {a.status === "failed" && (
                <div className="text-xs text-destructive">Falha: {a.error_message ?? "erro desconhecido"}</div>
              )}
              {(a.status === "uploading" || a.status === "transcribing") && (
                <div className="text-xs text-muted-foreground">Processando transcrição…</div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ready: { label: "pronta", cls: "bg-primary/10 text-primary" },
    transcribing: { label: "transcrevendo", cls: "bg-muted text-muted-foreground" },
    uploading: { label: "enviando", cls: "bg-muted text-muted-foreground" },
    failed: { label: "falhou", cls: "bg-destructive/10 text-destructive" },
  };
  const m = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return <span className={`rounded-full px-2 py-0.5 text-xs ${m.cls}`}>{m.label}</span>;
}
