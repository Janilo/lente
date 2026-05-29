import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, Loader2, X, Circle } from "lucide-react";
import { getInterviewPipelineStatus } from "@/lib/interview.functions";

type StepState = "pending"| "active"| "done"| "failed"| "disabled";

function StepIcon({ state }: { state: StepState }) {
 if (state === "active") return <Loader2 className="h-4 w-4 animate-spin text-primary"/>;
 if (state === "done") return <Check className="h-4 w-4 text-primary"/>;
 if (state === "failed") return <X className="h-4 w-4 text-destructive"/>;
 return <Circle className="h-4 w-4 text-muted-foreground/40"/>;
}

function Step({
 title, sub, state,
}: { title: string; sub?: string; state: StepState }) {
 const titleCls =
 state === "disabled"? "text-muted-foreground/60"
 : state === "failed"? "text-destructive"
 : "text-foreground";
 return (
 <div className="flex items-start gap-3 py-2">
 <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background">
 <StepIcon state={state} />
 </div>
 <div className="min-w-0 flex-1">
 <div className={`text-sm font-medium ${titleCls}`}>{title}</div>
 {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
 </div>
 </div>
 );
}

export function PipelineStatus({
 interviewId,
 variant,
}: {
 interviewId: string;
 variant: "respondent"| "researcher";
}) {
 const fetchFn = useServerFn(getInterviewPipelineStatus);
 const { data } = useQuery({
 queryKey: ["pipeline-status", interviewId],
 queryFn: () => fetchFn({ data: { interview_id: interviewId } }),
 refetchInterval: (q) => {
 const d = q.state.data;
 if (!d) return 2500;
 const busy =
 d.answers.uploading > 0 ||
 d.answers.transcribing > 0 ||
 d.followup.state === "deciding"||
 d.interview_status === "in_progress";
 return busy ? 2500 : false;
 },
 });

 // Upload step
 const uploadState: StepState =
 !data ? "pending"
 : data.answers.uploading > 0 ? "active"
 : data.last_answer?.status === "failed"? "failed"
 : data.answers.total > 0 ? "done"
 : "pending";

 // Transcription step
 const transcribeState: StepState =
 !data ? "pending"
 : data.answers.transcribing > 0 ? "active"
 : data.answers.failed > 0 ? "failed"
 : data.answers.ready > 0 ? "done"
 : "pending";

 // Followup step
 const fu = data?.followup.state ?? "idle";
 const followupState: StepState =
 fu === "deciding"? "active"
 : fu === "ready"|| fu === "skipped"? "done"
 : fu === "exhausted"? "done"
 : "pending";

 // Synthesis step
 const synthDone = !!data?.synthesis.last_generated_at;
 const synthState: StepState =
 variant === "respondent"? "disabled"
 : synthDone ? "done"
 : "pending";

 const uploadSub = data
 ? `${data.answers.total} resposta${data.answers.total === 1 ? "": "s"} enviada${data.answers.total === 1 ? "": "s"}`
 : undefined;
 const transcribeSub = data
 ? `${data.answers.ready} de ${data.answers.total} transcrita${data.answers.total === 1 ? "": "s"}${data.answers.failed > 0 ? ` · ${data.answers.failed} com falha` : ""}`
 : undefined;
 const fuSub =
 fu === "deciding"? "Avaliando se vale aprofundar…"
 : fu === "ready"? "Pergunta de aprofundamento gerada"
 : fu === "skipped"? "Sem follow-up — seguindo adiante"
 : fu === "exhausted"? "Limite de follow-ups atingido"
 : "Aguardando a próxima resposta";
 const synthSub =
 variant === "respondent"
 ? "Disponível após o pesquisador gerar"
 : synthDone
 ? `Gerada em ${new Date(data!.synthesis.last_generated_at!).toLocaleString("pt-BR")}`
 : "Síntese ainda não gerada";

 const lastError =
 data?.last_answer?.status === "failed"? data.last_answer.error_message : null;

 return (
 <div className="rounded-sm border border-border bg-card p-5">
 <div className="flex items-center justify-between gap-3">
 <div>
 <p className="text-xs uppercase tracking-widest text-muted-foreground">Status do pipeline</p>
 <h3 className="text-sm font-medium mt-1">Processamento da entrevista</h3>
 </div>
 </div>

 <div className="mt-3 divide-y divide-border/60">
 <Step title="Upload do vídeo"sub={uploadSub} state={uploadState} />
 <Step title="Transcrição (ElevenLabs)"sub={transcribeSub} state={transcribeState} />
 <Step title="Follow-up (Gemini)"sub={fuSub} state={followupState} />
 <Step title="Síntese pronta"sub={synthSub} state={synthState} />
 </div>

 {lastError && (
 <div className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
 Última falha: {lastError}
 </div>
 )}

 {variant === "researcher"&& data && (
 <div className="mt-4">
 <Link
 to="/studies/$id/synthesis"
 params={{ id: data.study_id }}
 className="text-xs text-primary underline"
 >
 {synthDone ? "Ver síntese": "Ir para síntese"}
 </Link>
 </div>
 )}
 </div>
 );
}
