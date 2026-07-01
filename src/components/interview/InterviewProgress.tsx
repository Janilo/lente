import { Progress } from "@/components/ui/progress";

type Totals = {
  question_count: number;
  current_position: number | null;
  followups_done_for_current: number;
  max_followups: number;
  is_followup: boolean;
};

export function InterviewProgress({
  totals,
  processing,
}: {
  totals: Totals | null | undefined;
  processing?: boolean;
}) {
  const total = totals?.question_count ?? 0;
  const pos = totals?.current_position ?? null;

  // Primary bar: progress across main questions.
  // Does NOT advance during followups of the current question.
  const completed = Math.max(0, (pos ?? (processing ? total : 0)) - 1);
  const primaryValue = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  const primaryLabel =
    total === 0
      ? "Preparando entrevista…"
      : processing && pos == null
        ? "Processando…"
        : `Pergunta ${pos ?? "—"} de ${total}`;

  // Secondary bar: followups for the current main question.
  const maxFu = totals?.max_followups ?? 0;
  const doneFu = totals?.followups_done_for_current ?? 0;
  const showSecondary = maxFu > 0 && pos != null && !processing;
  const currentFuIndex = totals?.is_followup ? doneFu + 1 : doneFu;
  const secondaryValue = maxFu > 0 ? Math.min(100, Math.round((currentFuIndex / maxFu) * 100)) : 0;
  const secondaryLabel = totals?.is_followup
    ? `Aprofundamento ${currentFuIndex} de ${maxFu}`
    : doneFu > 0
      ? `${doneFu} de ${maxFu} aprofundamentos`
      : `Sem aprofundamento (até ${maxFu})`;

  return (
    <div className="rounded-sm border border-border bg-card p-4 space-y-4">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium">{primaryLabel}</p>
          {processing && pos != null && (
            <p className="text-xs text-muted-foreground">Processando resposta…</p>
          )}
        </div>
        <Progress value={primaryValue} className="mt-2 h-2" />
      </div>

      {showSecondary && (
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs text-muted-foreground">{secondaryLabel}</p>
          </div>
          <Progress value={secondaryValue} className="mt-1.5 h-1 bg-muted" />
        </div>
      )}
    </div>
  );
}
