import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listStudyRespondents, exportInterviewRawData, deleteRespondentData } from "@/lib/respondents.functions";
import { getInterviewDetail } from "@/lib/interview.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/studies/$id/respondents")({
  head: () => ({ meta: [{ title: "Respondentes — Lente" }] }),
  component: RespondentsPanel,
});

function RespondentsPanel() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const fetchList = useServerFn(listStudyRespondents);
  const exportFn = useServerFn(exportInterviewRawData);
  const deleteFn = useServerFn(deleteRespondentData);
  const [openInterview, setOpenInterview] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["study-respondents", id],
    queryFn: () => fetchList({ data: { study_id: id } }),
  });

  const handleExport = async (interview_id: string, label: string) => {
    try {
      const result = await exportFn({ data: { interview_id } });
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `entrevista-${label}-${interview_id.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Dados exportados. URLs de vídeo válidas por 1h.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const del = useMutation({
    mutationFn: (interview_id: string) => deleteFn({ data: { interview_id } }),
    onSuccess: () => {
      toast.success("Dados apagados.");
      qc.invalidateQueries({ queryKey: ["study-respondents", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="mx-auto max-w-6xl px-6 py-12 text-sm text-muted-foreground">Carregando…</div>;
  if (!data) return null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 space-y-6">
      <div>
        <Link to="/studies/$id" params={{ id }} className="text-sm text-muted-foreground hover:text-foreground">← Voltar ao estudo</Link>
        <h1 className="mt-3 text-3xl">Respondentes — {data.study.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.respondents.length} {data.respondents.length === 1 ? "respondente" : "respondentes"} · {data.study.total_questions} pergunta(s) no questionário
        </p>
      </div>

      <div className="rounded-md border border-border bg-amber-50/50 dark:bg-amber-950/20 p-4 text-xs text-muted-foreground">
        <strong className="text-foreground">Aviso LGPD:</strong> os dados pessoais abaixo (nome, email, gravações, transcrições) só podem ser usados para a finalidade declarada no termo aceito pelo respondente. Não os compartilhe sem base legal. Você pode atender pedidos de exclusão pelo botão "Apagar dados".
      </div>

      {data.respondents.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhum respondente ainda.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Respondente</th>
                <th className="px-4 py-3 text-left">Cadastrado</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Etapas</th>
                <th className="px-4 py-3 text-left">Qualidade</th>
                <th className="px-4 py-3 text-left">Consentimento</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.respondents.map((r) => (
                <tr key={r.interview_id} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.full_name || "Sem nome"}</div>
                    <div className="text-xs text-muted-foreground">{r.email || "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.signup_at ? new Date(r.signup_at).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-semibold ${r.status === "completed" ? "bg-[color:var(--lente-teal-soft)] text-[color:var(--lente-teal-ink)] dark:bg-[color:var(--lente-teal-deep)] dark:text-[color:var(--lente-teal-soft)]" : "bg-[color:var(--lente-amber-soft)] text-[color:#7A5A1A] dark:bg-[color:var(--lente-amber)]/20 dark:text-[color:var(--lente-amber-soft)]"}`}>
                      {r.status === "completed" ? "Concluída" : "Em andamento"}
                    </span>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Início: {new Date(r.started_at).toLocaleString("pt-BR")}
                    </div>
                    {r.finished_at && <div className="text-xs text-muted-foreground">Fim: {new Date(r.finished_at).toLocaleString("pt-BR")}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs">{r.answered_questions}/{r.total_questions}</td>
                  <td className="px-4 py-3">
                    {r.avg_quality === null ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <span className={`text-sm font-medium ${r.avg_quality >= 70 ? "text-emerald-700 dark:text-emerald-400" : r.avg_quality >= 40 ? "text-amber-700 dark:text-amber-400" : "text-destructive"}`}>
                        {r.avg_quality}/100
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {r.consent_accepted_at ? (
                      <>
                        ✓ {r.consent_version}
                        <div>{new Date(r.consent_accepted_at).toLocaleString("pt-BR")}</div>
                      </>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex flex-col gap-1 items-end">
                      <button onClick={() => setOpenInterview(r.interview_id)} className="text-xs text-primary hover:underline">Ver detalhes</button>
                      <button onClick={() => handleExport(r.interview_id, r.full_name || "respondente")} className="text-xs text-muted-foreground hover:text-foreground">Baixar dados (JSON)</button>
                      <button
                        onClick={() => { if (confirm("Apagar permanentemente todos os dados deste respondente (vídeos, transcrições, entrevista)?")) del.mutate(r.interview_id); }}
                        className="text-xs text-destructive hover:underline"
                      >
                        Apagar dados
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openInterview && <RespondentDetailDrawer interviewId={openInterview} onClose={() => setOpenInterview(null)} />}
    </div>
  );
}

function RespondentDetailDrawer({ interviewId, onClose }: { interviewId: string; onClose: () => void }) {
  const fetchDetail = useServerFn(getInterviewDetail);
  const { data, isLoading } = useQuery({
    queryKey: ["interview-detail", interviewId],
    queryFn: () => fetchDetail({ data: { interview_id: interviewId } }),
  });

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="mx-auto max-w-3xl my-12 rounded-lg border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">Detalhes da entrevista</h2>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Fechar</button>
        </div>
        <div className="p-6 space-y-6">
          {isLoading || !data ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : (
            <>
              <div className="text-sm">
                <div className="text-muted-foreground">{data.interview.study_title}</div>
                <div>Status: {data.interview.status === "completed" ? "Concluída" : "Em andamento"}</div>
              </div>
              <ol className="space-y-4">
                {data.answers.map((a, idx) => (
                  <li key={a.id} className="rounded-md border border-border p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        {a.is_followup ? "Follow-up" : `Pergunta ${idx + 1}`}
                      </div>
                      <div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("pt-BR")}</div>
                    </div>
                    <p className="mt-2 text-sm font-medium">{a.question_text}</p>
                    {a.video_url ? (
                      <video src={a.video_url} controls className="mt-3 w-full rounded-md bg-black aspect-video" />
                    ) : (
                      <div className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">Vídeo indisponível</div>
                    )}
                    <div className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">Transcrição</div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{a.transcript || <span className="text-muted-foreground italic">Sem transcrição (status: {a.status})</span>}</p>
                    {/* quality score: optionally rendered if backend provides it */}
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
