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

type Question = { text: string; intent: string };
type Block = { title: string; objective: string; questions: Question[] };
type Script = { header: string; blocks: Block[]; final_notes: string };

const emptyScript = (): Script => ({
  header: "",
  blocks: [{ title: "Perguntas", objective: "", questions: [] }],
  final_notes: "",
});


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
  const [script, setScript] = useState<Script>(emptyScript());
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
      setScript({ ...res.script, final_notes: "" });
      setPreviewOpen(true);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const flatten = (s: Script): Question[] => {
    const out: Question[] = [];
    for (const b of s.blocks) {
      const ctx = [b.title?.trim(), b.objective?.trim()].filter(Boolean).join(" · ");
      for (const q of b.questions) {
        const t = q.text.trim();
        if (!t) continue;
        const intent = [ctx, q.intent?.trim()].filter(Boolean).join(" — ");
        out.push({ text: t, intent });
      }
    }
    const notes = s.final_notes?.trim();
    if (notes) {
      out.push({ text: "Observações finais", intent: notes });
    }
    return out;

  };

  const saving = useMutation({
    mutationFn: async () => {
      const questions = flatten(script);
      if (questions.length === 0) throw new Error("Adicione ao menos uma pergunta.");
      return bulkAdd({ data: { study_id: studyId, questions } });
    },
    onSuccess: (res) => {
      toast.success(`${res.inserted} pergunta(s) adicionada(s)`);
      setPreviewOpen(false);
      setScript(emptyScript());
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
        script={script}
        setScript={setScript}
        totalQuestions={flatten(script).length}
        onConfirm={() => saving.mutate()}
        saving={saving.isPending}
      />

      <AIGenerateDialog
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        studyId={studyId}
        onReady={(qs) => {
          setScript({
            header: "",
            blocks: [{ title: "Roteiro gerado", objective: "", questions: qs }],
            final_notes: "",
          });

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
  script,
  setScript,
  totalQuestions,
  onConfirm,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  script: Script;
  setScript: (s: Script) => void;
  totalQuestions: number;
  onConfirm: () => void;
  saving: boolean;
}) {
  const updateBlock = (bi: number, patch: Partial<Block>) => {
    const next = { ...script, blocks: script.blocks.map((b, i) => (i === bi ? { ...b, ...patch } : b)) };
    setScript(next);
  };
  const updateQuestion = (bi: number, qi: number, patch: Partial<Question>) => {
    const blocks = script.blocks.map((b, i) =>
      i === bi
        ? { ...b, questions: b.questions.map((q, j) => (j === qi ? { ...q, ...patch } : q)) }
        : b,
    );
    setScript({ ...script, blocks });
  };
  const removeQuestion = (bi: number, qi: number) => {
    const blocks = script.blocks.map((b, i) =>
      i === bi ? { ...b, questions: b.questions.filter((_, j) => j !== qi) } : b,
    );
    setScript({ ...script, blocks });
  };
  const addQuestion = (bi: number) => {
    const blocks = script.blocks.map((b, i) =>
      i === bi ? { ...b, questions: [...b.questions, { text: "", intent: "" }] } : b,
    );
    setScript({ ...script, blocks });
  };
  const removeBlock = (bi: number) => {
    setScript({ ...script, blocks: script.blocks.filter((_, i) => i !== bi) });
  };
  const addBlock = () => {
    setScript({
      ...script,
      blocks: [...script.blocks, { title: "Novo bloco", objective: "", questions: [{ text: "", intent: "" }] }],
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Revisar roteiro</DialogTitle>
          <DialogDescription>
            Confira a estrutura identificada: blocos, objetivos e perguntas. Edite o que precisar antes de adicionar ao roteiro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Cabeçalho (referência — não é salvo)</label>
            <input
              value={script.header}
              onChange={(e) => setScript({ ...script, header: e.target.value })}
              placeholder="Título ou descrição do roteiro"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          {script.blocks.map((block, bi) => (
            <div key={bi} className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <input
                    value={block.title}
                    onChange={(e) => updateBlock(bi, { title: e.target.value })}
                    placeholder="Título do bloco"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-medium"
                  />
                  <input
                    value={block.objective}
                    onChange={(e) => updateBlock(bi, { objective: e.target.value })}
                    placeholder="Objetivo do bloco (opcional)"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-muted-foreground"
                  />
                </div>
                <button
                  onClick={() => removeBlock(bi)}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Remover bloco
                </button>
              </div>

              <ol className="space-y-2">
                {block.questions.map((q, qi) => (
                  <li key={qi} className="rounded-md border border-border bg-background p-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Pergunta {qi + 1}</span>
                      <button onClick={() => removeQuestion(bi, qi)} className="hover:text-destructive">
                        Remover
                      </button>
                    </div>
                    <textarea
                      value={q.text}
                      rows={2}
                      onChange={(e) => updateQuestion(bi, qi, { text: e.target.value })}
                      placeholder="Texto da pergunta"
                      className="mt-2 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                    />
                    <input
                      value={q.intent}
                      placeholder="Intenção (opcional)"
                      onChange={(e) => updateQuestion(bi, qi, { intent: e.target.value })}
                      className="mt-2 w-full rounded-md border border-input bg-card px-3 py-2 text-xs text-muted-foreground"
                    />
                  </li>
                ))}
              </ol>

              <button
                onClick={() => addQuestion(bi)}
                className="rounded-md border border-dashed border-border px-3 py-1.5 text-xs hover:bg-accent"
              >
                + Adicionar pergunta neste bloco
              </button>
            </div>
          ))}

          <button
            onClick={addBlock}
            className="w-full rounded-md border border-dashed border-border px-3 py-2 text-sm hover:bg-accent"
          >
            + Adicionar bloco
          </button>
        </div>

        <DialogFooter className="mt-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={saving || totalQuestions === 0}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Adicionando..." : `Adicionar ${totalQuestions} pergunta(s)`}
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
  onReady: (qs: Question[]) => void;
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
        onReady(res.questions.map((q) => ({ text: q.text, intent: q.intent ?? "" })));
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
