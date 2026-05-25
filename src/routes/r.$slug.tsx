import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getStudyBySlug, startInterview } from "@/lib/interview.functions";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/r/$slug")({
  head: () => ({ meta: [{ title: "Entrevista — Lente" }] }),
  component: PublicStudyPage,
});

function PublicStudyPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();
  const fetchStudy = useServerFn(getStudyBySlug);
  const startFn = useServerFn(startInterview);

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-study", slug],
    queryFn: () => fetchStudy({ data: { slug } }),
  });

  const start = useMutation({
    mutationFn: () => startFn({ data: { slug } }),
    onSuccess: (r) => navigate({ to: "/r/$slug/run", params: { slug } }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="mx-auto max-w-2xl px-6 py-20 text-sm text-muted-foreground">Carregando…</div>;
  if (error) return <div className="mx-auto max-w-2xl px-6 py-20 text-sm text-destructive">{(error as Error).message}</div>;
  if (!data) return null;

  const { study, questionCount } = data;
  const returnTo = `/r/${slug}/run`;

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Você foi convidado para uma entrevista</p>
      <h1 className="mt-3 text-4xl font-semibold leading-tight">{study.title}</h1>
      {study.context && <p className="mt-6 whitespace-pre-wrap text-base text-muted-foreground">{study.context}</p>}
      {study.target_audience && (
        <p className="mt-4 text-sm text-muted-foreground"><strong className="text-foreground">Público:</strong> {study.target_audience}</p>
      )}
      <p className="mt-6 text-sm text-muted-foreground">{questionCount} pergunta(s). Suas respostas serão gravadas em vídeo.</p>

      <div className="mt-10">
        {loading ? (
          <div className="text-sm text-muted-foreground">…</div>
        ) : isAuthenticated ? (
          <button
            disabled={start.isPending}
            onClick={() => start.mutate()}
            className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {start.isPending ? "Iniciando…" : "Iniciar entrevista"}
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">Crie uma conta ou entre para participar.</p>
            <div className="flex gap-3">
              <Link
                to="/signup"
                search={{ returnTo }}
                className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
              >
                Criar conta
              </Link>
              <Link
                to="/login"
                search={{ returnTo }}
                className="rounded-md border border-border bg-card px-6 py-3 text-sm font-medium hover:bg-accent"
              >
                Entrar
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
