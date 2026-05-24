import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  parseQuestionsFromFile,
  generateQuestionScript,
  bulkAddQuestions,
} from "@/lib/script-builder.functions";

type Candidate = { text: string; intent: string };

export function ScriptBuilderActions({
  studyId,
  onAddManual,
  isAddingManual,
}: {
  studyId: string;
  onAddManual: () => void;
  isAddingManual: boolean;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [aiOpen, setAiOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const qc = useQueryClient();

  const parseFn = useServerFn(parseQuestionsFromFile);
  const bulkAdd = useServerFn(bulkAddQuestions);

  const importing = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 5 * 1024 * 1024) throw new Error("Arquivo grande demais (máx 5MB).");
      const buf = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ""),
      );
      return parseFn({
        data: {
          study_id: studyId,
          file_name: file.name,
          mime_type: file.type || "application/octet-stream",
          file_base64: base64,
        },
      });
    },
    onSuccess: (res) => {
      setCandidates(res.questions.map((t: string) => ({ text: t, intent: "" })));
      setPreviewOpen(true);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saving = useMutation({
    mutationFn: async () =>
      bulkAdd({ data: { study_id: studyId, questions: candidates.filter((c) => c.text.trim()) } }),
    onSuccess: (res) => {
      toast.success(`${res.inserted} pergunta(s) adicionada(s)`);
      setPreviewOpen(false);
      setCandidates([]);
      qc.invalidateQueries({ queryKey: ["study", studyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onAddManual}
          disabled={isAddingManual}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
        >
          + Adicionar pergunta
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={importing.isPending}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
        >
          {importing.isPending ? "Lendo arquivo..." : "Importar de arquivo"}
        </button>
        <button
          onClick={() => setAiOpen(true)}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
        >
          Gerar com IA
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,.csv,.docx,.pdf,text/plain,text/markdown,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importing.mutate(f);
            e.target.value = "";
          }}
        />
      </div>

      <PreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        candidates={candidates}
        setCandidates={setCandidates}
        onConfirm={() => saving.mutate()}
        saving={saving.isPending}
      />

      <AIGenerateDialog
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        studyId={studyId}
        onReady={(qs) => {
          setCandidates(qs);
          setAiOpen(false);
          setPreviewOpen(true);
        }}
      />
    </>
  );
}

function PreviewDialog({
  open,
  onClose,
  candidates,
  setCandidates,
  onConfirm,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  candidates: Candidate[];
  setCandidates: (c: Candidate[]) => void;
  onConfirm: () => void;
  saving: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Revisar perguntas</DialogTitle>
          <DialogDescription>
            Edite, remova e confirme. As perguntas serão adicionadas ao final do roteiro.
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-2">
          {candidates.map((c, idx) => (
            <li key={idx} className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Pergunta {idx + 1}</span>
                <button
                  onClick={() => setCandidates(candidates.filter((_, i) => i !== idx))}
                  className="hover:text-destructive"
                >
                  Remover
                </button>
              </div>
              <textarea
                value={c.text}
                rows={2}
                onChange={(e) => {
                  const next = [...candidates];
                  next[idx] = { ...next[idx], text: e.target.value };
                  setCandidates(next);
                }}
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <input
                value={c.intent}
                placeholder="Intenção (opcional)"
                onChange={(e) => {
                  const next = [...candidates];
                  next[idx] = { ...next[idx], intent: e.target.value };
                  setCandidates(next);
                }}
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-muted-foreground"
              />
            </li>
          ))}
          {candidates.length === 0 && (
            <li className="text-sm text-muted-foreground">Nenhuma pergunta restante.</li>
          )}
        </ol>
        <DialogFooter>
          <button onClick={onClose} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={saving || candidates.length === 0}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Adicionando..." : `Adicionar ${candidates.length}`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AIGenerateDialog({
  open,
  onClose,
  studyId,
  onReady,
}: {
  open: boolean;
  onClose: () => void;
  studyId: string;
  onReady: (qs: Candidate[]) => void;
}) {
  const [extra, setExtra] = useState("");
  const [count, setCount] = useState(8);
  const [clarifications, setClarifications] = useState<string[] | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const genFn = useServerFn(generateQuestionScript);

  const run = useMutation({
    mutationFn: async () => {
      const clarification_answers =
        clarifications?.map((q, i) => ({ question: q, answer: answers[i] ?? "" })) ?? [];
      return genFn({
        data: {
          study_id: studyId,
          extra_instructions: extra,
          target_count: count,
          clarification_answers,
        },
      });
    },
    onSuccess: (res) => {
      if (res.mode === "clarifications") {
        setClarifications(res.clarifications);
        setAnswers(new Array(res.clarifications.length).fill(""));
      } else {
        onReady(res.questions);
        reset();
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = () => {
    setExtra("");
    setCount(8);
    setClarifications(null);
    setAnswers([]);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Gerar roteiro com IA</DialogTitle>
          <DialogDescription>
            A IA usa o contexto do estudo (objetivo, contexto e público) para propor perguntas.
          </DialogDescription>
        </DialogHeader>

        {!clarifications ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Instruções extras (opcional)</label>
              <textarea
                rows={3}
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                placeholder="Ex: foque na jornada de compra e em alternativas consideradas"
                className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Quantidade de perguntas: {count}</label>
              <input
                type="range"
                min={3}
                max={15}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="mt-1.5 w-full"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Para gerar um bom roteiro, preciso saber:
            </p>
            {clarifications.map((q, i) => (
              <div key={i}>
                <label className="text-sm font-medium">{q}</label>
                <textarea
                  rows={2}
                  value={answers[i] ?? ""}
                  onChange={(e) => {
                    const next = [...answers];
                    next[i] = e.target.value;
                    setAnswers(next);
                  }}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <button
            onClick={() => {
              reset();
              onClose();
            }}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
          >
            Cancelar
          </button>
          <button
            onClick={() => run.mutate()}
            disabled={run.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {run.isPending ? "Gerando..." : clarifications ? "Gerar com respostas" : "Gerar roteiro"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
