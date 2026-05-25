import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  listScreenerQuestions,
  upsertScreenerQuestion,
  deleteScreenerQuestion,
} from "@/lib/screener.functions";

type ScreenerType = "single_choice" | "multi_choice" | "short_text";

type ScreenerQuestion = {
  id: string;
  study_id: string;
  position: number;
  text: string;
  type: ScreenerType;
  options: string[];
  qualifies: boolean;
  qualifying_options: number[];
};

export function ScreenerBuilder({ studyId }: { studyId: string }) {
  const listFn = useServerFn(listScreenerQuestions);
  const upsertFn = useServerFn(upsertScreenerQuestion);
  const deleteFn = useServerFn(deleteScreenerQuestion);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["screener", studyId],
    queryFn: () => listFn({ data: { study_id: studyId } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["screener", studyId] });

  const add = useMutation({
    mutationFn: async () =>
      upsertFn({
        data: {
          study_id: studyId,
          position: data?.questions.length ?? 0,
          text: "Nova pergunta de triagem",
          type: "single_choice",
          options: ["Opção A", "Opção B"],
          qualifies: false,
          qualifying_options: [],
        },
      }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => deleteFn({ data: { id, study_id: studyId } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-lg border border-border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl">Perguntas de triagem</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Exibidas antes do consentimento. Use para filtrar respondentes ou apenas registrar perfil.
          </p>
        </div>
        <button
          onClick={() => add.mutate()}
          disabled={add.isPending}
          className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
        >
          {add.isPending ? "Adicionando..." : "Adicionar pergunta"}
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (data?.questions.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma pergunta de triagem. Sem triagem, todos seguem direto para o consentimento.</p>
      ) : (
        <ol className="space-y-4">
          {(data!.questions as ScreenerQuestion[]).map((q, idx) => (
            <ScreenerItem
              key={q.id}
              index={idx}
              question={q}
              onSave={(patch) =>
                upsertFn({ data: { ...q, ...patch, study_id: studyId } }).then(invalidate).catch((e: Error) => toast.error(e.message))
              }
              onDelete={() => remove.mutate(q.id)}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function ScreenerItem({
  index,
  question,
  onSave,
  onDelete,
}: {
  index: number;
  question: ScreenerQuestion;
  onSave: (patch: Partial<ScreenerQuestion>) => void;
  onDelete: () => void;
}) {
  const [text, setText] = useState(question.text);
  const [type, setType] = useState<ScreenerType>(question.type);
  const [options, setOptions] = useState<string[]>(question.options ?? []);
  const [qualifies, setQualifies] = useState(question.qualifies);
  const [qualifying, setQualifying] = useState<number[]>(question.qualifying_options ?? []);

  const commit = (patch: Partial<ScreenerQuestion> = {}) =>
    onSave({ text, type, options, qualifies, qualifying_options: qualifying, ...patch });

  const setOpt = (i: number, v: string) => {
    const next = [...options];
    next[i] = v;
    setOptions(next);
  };
  const addOpt = () => {
    const next = [...options, `Opção ${String.fromCharCode(65 + options.length)}`];
    setOptions(next);
    commit({ options: next });
  };
  const removeOpt = (i: number) => {
    const next = options.filter((_, j) => j !== i);
    const nextQual = qualifying.filter((q) => q !== i).map((q) => (q > i ? q - 1 : q));
    setOptions(next);
    setQualifying(nextQual);
    commit({ options: next, qualifying_options: nextQual });
  };
  const toggleQualifying = (i: number) => {
    const next = qualifying.includes(i) ? qualifying.filter((q) => q !== i) : [...qualifying, i];
    setQualifying(next);
    commit({ qualifying_options: next });
  };

  return (
    <li className="rounded-md border border-border bg-background p-4 space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Triagem {index + 1}</span>
        <button onClick={onDelete} className="hover:text-destructive">Remover</button>
      </div>

      <textarea
        value={text}
        rows={2}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== question.text && commit()}
        className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs">
          <span className="text-muted-foreground">Tipo</span>
          <select
            value={type}
            onChange={(e) => {
              const t = e.target.value as ScreenerType;
              setType(t);
              commit({ type: t, options: t === "short_text" ? [] : options });
            }}
            className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
          >
            <option value="single_choice">Múltipla escolha (uma resposta)</option>
            <option value="multi_choice">Múltipla escolha (várias)</option>
            <option value="short_text">Texto curto</option>
          </select>
        </label>
        <label className="text-xs flex items-center gap-2 sm:mt-5">
          <input
            type="checkbox"
            checked={qualifies}
            onChange={(e) => {
              setQualifies(e.target.checked);
              commit({ qualifies: e.target.checked });
            }}
          />
          <span>Esta pergunta qualifica o respondente</span>
        </label>
      </div>

      {type !== "short_text" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Alternativas {qualifies && "— marque as que qualificam"}
          </p>
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              {qualifies && (
                <input
                  type="checkbox"
                  checked={qualifying.includes(i)}
                  onChange={() => toggleQualifying(i)}
                  title="Aprova respondente"
                />
              )}
              <input
                value={opt}
                onChange={(e) => setOpt(i, e.target.value)}
                onBlur={() => opt !== question.options[i] && commit()}
                className="flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm"
              />
              <button onClick={() => removeOpt(i)} className="text-xs text-muted-foreground hover:text-destructive">
                Remover
              </button>
            </div>
          ))}
          <button onClick={addOpt} className="text-xs text-muted-foreground hover:text-foreground">
            + Adicionar alternativa
          </button>
        </div>
      )}

      {qualifies && type === "short_text" && (
        <p className="text-xs text-muted-foreground">
          Qualquer resposta não-vazia aprova o respondente.
        </p>
      )}
    </li>
  );
}
