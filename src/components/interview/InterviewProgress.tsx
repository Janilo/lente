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
  const pos = totals?.current_position ?? (processing ? total : 0);
  const completedQuestions = Math.max(0, (pos ?? 0) - 1);
  const value =
    total > 0
      ? Math.min(100, Math.round(((completedQuestions + (processing ? 1 : 0)) / total) * 100))
      : 0;

  const label =
    total === 0
      ? "Preparando entrevista…"
      : processing
        ? "Processando sua resposta…"
        : `Pergunta ${pos ?? "—"} de ${total}`;

  const sub =
    totals?.is_followup
      ? `Aprofundamento ${totals.followups_done_for_current + 1} (até ${totals.max_followups})`
      : totals && totals.followups_done_for_current > 0
        ? `Após ${totals.followups_done_for_current} aprofundamento${totals.followups_done_for_current === 1 ? "" : "s"}`
        : null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">{label}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <Progress value={value} className="mt-3 h-1.5" />
    </div>
  );
}
