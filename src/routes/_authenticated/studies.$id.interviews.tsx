import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listStudyInterviews } from "@/lib/interview.functions";

export const Route = createFileRoute("/_authenticated/studies/$id/interviews")({
  head: () => ({ meta: [{ title: "Entrevistas — Lente" }] }),
  component: InterviewsList,
});

function InterviewsList() {
  const { id } = Route.useParams();
  const fetchList = useServerFn(listStudyInterviews);
  const { data, isLoading } = useQuery({
    queryKey: ["study-interviews", id],
    queryFn: () => fetchList({ data: { study_id: id } }),
  });

  if (isLoading) return <div className="mx-auto max-w-4xl px-6 py-12 text-sm text-muted-foreground">Carregando…</div>;
  if (!data) return <div className="mx-auto max-w-4xl px-6 py-12">Sem dados.</div>;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 space-y-6">
      <div>
        <Link to="/studies/$id" params={{ id }} className="text-sm text-muted-foreground hover:text-foreground">← Voltar ao estudo</Link>
        <h1 className="mt-3 text-3xl">Entrevistas — {data.study.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{data.interviews.length} {data.interviews.length === 1 ? "entrevista" : "entrevistas"}</p>
      </div>

      {data.interviews.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhuma entrevista ainda. Publique o estudo e compartilhe o link.
        </div>
      ) : (
        <ul className="space-y-3">
          {data.interviews.map((iv) => (
            <li key={iv.id}>
              <Link
                to="/studies/$id/interviews/$interviewId"
                params={{ id, interviewId: iv.id }}
                className="block rounded-lg border border-border bg-card p-4 hover:bg-accent transition"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-sm font-medium">
                      {iv.status === "completed" ? "Concluída" : "Em andamento"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Iniciada em {new Date(iv.started_at).toLocaleString("pt-BR")}
                      {iv.finished_at && ` · Finalizada em ${new Date(iv.finished_at).toLocaleString("pt-BR")}`}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {iv.ready_count}/{iv.answer_count} respostas processadas
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
