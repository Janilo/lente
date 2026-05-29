import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listMyInterviews, exportInterviewRawData, deleteRespondentData } from "@/lib/respondents.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/my-privacy")({
 head: () => ({ meta: [{ title: "Minha privacidade — Lente"}] }),
 component: MyPrivacyPage,
});

function MyPrivacyPage() {
 const qc = useQueryClient();
 const listFn = useServerFn(listMyInterviews);
 const exportFn = useServerFn(exportInterviewRawData);
 const deleteFn = useServerFn(deleteRespondentData);

 const { data, isLoading } = useQuery({
 queryKey: ["my-interviews"],
 queryFn: () => listFn(),
 });

 const handleExport = async (interview_id: string) => {
 try {
 const result = await exportFn({ data: { interview_id } });
 const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json"});
 const url = URL.createObjectURL(blob);
 const a = document.createElement("a");
 a.href = url;
 a.download = `meus-dados-${interview_id.slice(0, 8)}.json`;
 a.click();
 URL.revokeObjectURL(url);
 } catch (e) {
 toast.error((e as Error).message);
 }
 };

 const del = useMutation({
 mutationFn: (interview_id: string) => deleteFn({ data: { interview_id } }),
 onSuccess: () => { toast.success("Seus dados foram apagados."); qc.invalidateQueries({ queryKey: ["my-interviews"] }); },
 onError: (e: Error) => toast.error(e.message),
 });

 return (
 <div className="mx-auto max-w-3xl px-6 py-12 space-y-6">
 <div>
 <Link to="/dashboard"className="text-sm text-muted-foreground hover:text-foreground">← Voltar</Link>
 <h1 className="mt-3 text-3xl">Minha privacidade</h1>
 <p className="mt-2 text-sm text-muted-foreground">
 Aqui você acessa e controla os dados que você forneceu como entrevistado. Conforme a LGPD, você pode baixar seus dados ou solicitar exclusão a qualquer momento.
 </p>
 </div>

 {isLoading ? (
 <div className="text-sm text-muted-foreground">Carregando…</div>
 ) : !data || data.interviews.length === 0 ? (
 <div className="rounded-sm border border-border bg-card p-8 text-center text-sm text-muted-foreground">
 Você ainda não participou de nenhuma entrevista.
 </div>
 ) : (
 <ul className="space-y-3">
 {data.interviews.map((iv) => (
 <li key={iv.id} className="rounded-sm border border-border bg-card p-4">
 <div className="flex items-start justify-between gap-3 flex-wrap">
 <div>
 <div className="font-medium">{iv.study_title}</div>
 <div className="text-xs text-muted-foreground mt-1">
 {iv.status === "completed"? "Concluída": "Em andamento"} · iniciada em {new Date(iv.started_at).toLocaleString("pt-BR")}
 </div>
 </div>
 <div className="flex gap-2">
 <button onClick={() => handleExport(iv.id)} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">
 Baixar meus dados
 </button>
 <button
 onClick={() => { if (confirm("Apagar permanentemente todos os seus dados desta entrevista? Esta ação não pode ser desfeita.")) del.mutate(iv.id); }}
 className="rounded-md border border-destructive/40 text-destructive px-3 py-1.5 text-xs hover:bg-destructive/10"
 >
 Apagar
 </button>
 </div>
 </div>
 </li>
 ))}
 </ul>
 )}
 </div>
 );
}
