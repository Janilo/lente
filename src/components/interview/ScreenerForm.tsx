import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { getPublicScreener, submitScreener, getMyScreenerSubmission } from "@/lib/screener.functions";

type ScreenerType = "single_choice" | "multi_choice" | "short_text";
type PublicQuestion = { id: string; position: number; text: string; type: ScreenerType; options: string[] };

export function ScreenerForm({
  slug,
  onQualified,
}: {
  slug: string;
  onQualified: () => void;
}) {
  const fetchScreener = useServerFn(getPublicScreener);
  const fetchSubmission = useServerFn(getMyScreenerSubmission);
  const submitFn = useServerFn(submitScreener);

  const screenerQuery = useQuery({
    queryKey: ["public-screener", slug],
    queryFn: () => fetchScreener({ data: { slug } }),
  });
  const submissionQuery = useQuery({
    queryKey: ["screener-submission", slug],
    queryFn: () => fetchSubmission({ data: { slug } }),
  });

  const [answers, setAnswers] = useState<Record<string, string | number[]>>({});

  const questions = useMemo(
    () => (screenerQuery.data?.questions ?? []) as PublicQuestion[],
    [screenerQuery.data?.questions],
  );

  const submit = useMutation({
    mutationFn: async () => {
      const responses = questions.map((q) => ({
        question_id: q.id,
        answer: answers[q.id] ?? (q.type === "short_text" ? "" : []),
      }));
      return submitFn({ data: { slug, responses } });
    },
    onSuccess: (res) => {
      if (res.submission.qualified) {
        toast.success("Você passou na triagem");
        onQualified();
      } else {
        submissionQuery.refetch();
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const existing = submissionQuery.data?.submission;
  const hasNoQuestions = !screenerQuery.isLoading && questions.length === 0;
  const alreadyQualified = !!existing?.qualified;

  useEffect(() => {
    if (hasNoQuestions || alreadyQualified) onQualified();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasNoQuestions, alreadyQualified]);

  if (screenerQuery.isLoading || submissionQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando triagem…</p>;
  }

  if (hasNoQuestions || alreadyQualified) return null;

  if (existing && !existing.qualified) {
    return (
      <div className="rounded-md border border-border bg-card p-6 space-y-3">
        <h2 className="text-lg font-medium">Obrigado pelo interesse</h2>
        <p className="text-sm text-muted-foreground">
          Pelas suas respostas, este estudo não é compatível com seu perfil no momento. Agradecemos o tempo dedicado.
        </p>
      </div>
    );
  }

  const allAnswered = questions.every((q) => {
    const a = answers[q.id];
    if (q.type === "short_text") return typeof a === "string" && a.trim().length > 0;
    return Array.isArray(a) && a.length > 0;
  });

  return (
    <div className="rounded-md border border-border bg-card p-6 space-y-5">
      <div>
        <h2 className="text-lg font-medium">Antes de começar, algumas perguntas rápidas</h2>
        <p className="mt-1 text-xs text-muted-foreground">Triagem de perfil. Suas respostas ajudam a saber se este estudo se aplica a você.</p>
      </div>
      <div className="space-y-5">
        {questions.map((q, idx) => (
          <QuestionField
            key={q.id}
            index={idx}
            question={q}
            value={answers[q.id]}
            onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
          />
        ))}
      </div>
      <button
        disabled={!allAnswered || submit.isPending}
        onClick={() => submit.mutate()}
        className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {submit.isPending ? "Enviando…" : "Enviar respostas"}
      </button>
    </div>
  );
}

function QuestionField({
  index,
  question,
  value,
  onChange,
}: {
  index: number;
  question: PublicQuestion;
  value: string | number[] | undefined;
  onChange: (v: string | number[]) => void;
}) {
  if (question.type === "short_text") {
    return (
      <div>
        <label className="text-sm font-medium">{index + 1}. {question.text}</label>
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
    );
  }
  const picked = Array.isArray(value) ? value : [];
  const multi = question.type === "multi_choice";
  return (
    <div>
      <p className="text-sm font-medium">{index + 1}. {question.text}</p>
      <div className="mt-2 space-y-2">
        {question.options.map((opt, i) => {
          const selected = picked.includes(i);
          return (
            <label
              key={i}
              className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm cursor-pointer ${
                selected ? "border-primary bg-accent" : "border-border bg-background hover:bg-accent"
              }`}
            >
              <input
                type={multi ? "checkbox" : "radio"}
                name={question.id}
                checked={selected}
                onChange={() => {
                  if (multi) {
                    onChange(selected ? picked.filter((p) => p !== i) : [...picked, i]);
                  } else {
                    onChange([i]);
                  }
                }}
              />
              <span>{opt}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
