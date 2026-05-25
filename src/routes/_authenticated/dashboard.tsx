import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listMyStudies, createStudy } from "@/lib/studies.functions";
import { createTestInterview } from "@/lib/test-interview.functions";
import { generateSynthesis } from "@/lib/synthesis.functions";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Meus estudos — Lente" }] }),
  component: Dashboard,
});

function Dashboard() {
  const fetchStudies = useServerFn(listMyStudies);
  const createFn = useServerFn(createStudy);
  const testFn = useServerFn(createTestInterview);
  const synthFn = useServerFn(generateSynthesis);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["studies"],
    queryFn: () => fetchStudies(),
  });

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  const create = useMutation({
    mutationFn: async () => createFn({ data: { title } }),
    onSuccess: ({ study }) => {
      qc.invalidateQueries({ queryKey: ["studies"] });
      setOpen(false); setTitle("");
      navigate({ to: "/studies/$id", params: { id: study.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runTest = useMutation({
    mutationFn: async () => {
      const seed = await testFn();
      const t = toast.loading("Validando síntese com IA…");
      try {
        const result = await synthFn({ data: { study_id: seed.study_id } });
        toast.success(`Pipeline OK: ${result.insight_count} insights e ${result.recommendation_count} recomendações.`, { id: t });
      } catch (e) {
        toast.error(`Síntese falhou: ${(e as Error).message}`, { id: t });
      }
      return seed;
    },
    onSuccess: (seed) => {
      qc.invalidateQueries({ queryKey: ["studies"] });
      navigate({ to: "/studies/$id/synthesis", params: { id: seed.study_id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="jps-eyebrow">Pesquisas</p>
          <h1 className="mt-2 text-4xl">Meus estudos</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => runTest.mutate()}
            disabled={runTest.isPending}
            title="Cria um estudo demo com entrevista simulada e roda a síntese completa."
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {runTest.isPending ? "Gerando…" : "Entrevista de teste"}
          </button>
          <button onClick={() => setOpen(true)} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Novo estudo
          </button>
        </div>
      </div>


      {open && (
        <div className="mt-8 rounded-lg border border-border bg-card p-6">
          <h2 className="text-xl">Novo estudo</h2>
          <input
            autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Título do estudo (ex.: Percepção de marca — Q3)"
            className="mt-4 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="mt-4 flex gap-2 justify-end">
            <button onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm hover:bg-accent">Cancelar</button>
            <button
              disabled={!title.trim() || create.isPending}
              onClick={() => create.mutate()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {create.isPending ? "Criando..." : "Criar"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-10">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : data?.studies.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <p className="text-muted-foreground">Nenhum estudo ainda.</p>
            <p className="mt-1 text-sm text-muted-foreground">Crie seu primeiro estudo para começar.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {data?.studies.map((s) => (
              <li key={s.id}>
                <Link to="/studies/$id" params={{ id: s.id }} className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-accent/40">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-medium">{s.title}</h3>
                    {s.business_goal && <p className="truncate text-sm text-muted-foreground">{s.business_goal}</p>}
                  </div>
                  <span className="shrink-0 rounded-full border border-border px-2.5 py-0.5 text-xs capitalize text-muted-foreground">
                    {s.status === "draft" ? "rascunho" : s.status === "published" ? "publicado" : "encerrado"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
