import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listStudyInterviewsTable } from "@/lib/interview.functions";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/studies/$id/interviews")({
  head: () => ({ meta: [{ title: "Entrevistas — Lente" }] }),
  component: InterviewsTable,
});

type RawRow = Awaited<ReturnType<typeof listStudyInterviewsTable>>["rows"][number];
type AnswerSummary = { question_id: string; summary: string };
type Insights = (Omit<NonNullable<RawRow["insights"]>, "answer_summaries"> & { answer_summaries: AnswerSummary[] }) | null;
type Row = Omit<RawRow, "insights"> & { insights: Insights };

const STATUS_LABEL: Record<string, string> = {
  completed: "Concluída",
  in_progress: "Em andamento",
  abandoned: "Abandonada",
};

function qualityLabel(score: number | null, fallback: string | null | undefined): string {
  if (fallback) {
    const map: Record<string, string> = { excellent: "Excelente", good: "Boa", average: "Média", low: "Baixa" };
    return map[fallback] ?? fallback;
  }
  if (score == null) return "—";
  if (score >= 85) return "Excelente";
  if (score >= 70) return "Boa";
  if (score >= 50) return "Média";
  return "Baixa";
}

function formatDuration(sec: number): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}min ${s}s` : `${s}s`;
}

function InterviewsTable() {
  const { id } = Route.useParams();
  const fetchList = useServerFn(listStudyInterviewsTable);
  const { data, isLoading } = useQuery({
    queryKey: ["study-interviews-table", id],
    queryFn: () => fetchList({ data: { study_id: id } }),
  });

  const [filters, setFilters] = useState<Record<string, string>>({});

  const filteredRows = useMemo<Row[]>(() => {
    if (!data) return [];
    const rows = data.rows as unknown as Row[];
    return rows.filter((row) => {
      for (const [key, val] of Object.entries(filters)) {
        if (!val) continue;
        const needle = val.toLowerCase();
        const haystack = rowFieldText(row, key, data.questions).toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [data, filters]);

  if (isLoading) return <div className="mx-auto max-w-7xl px-6 py-12 text-sm text-muted-foreground">Carregando…</div>;
  if (!data) return <div className="mx-auto max-w-7xl px-6 py-12">Sem dados.</div>;

  const setFilter = (k: string, v: string) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-12 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link to="/studies/$id" params={{ id }} className="text-sm text-muted-foreground hover:text-foreground">← Voltar ao estudo</Link>
          <h1 className="mt-3 text-3xl">Entrevistas — {data.study.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data.rows.length} {data.rows.length === 1 ? "entrevista" : "entrevistas"}
            {filteredRows.length !== data.rows.length && ` · ${filteredRows.length} após filtros`}
          </p>
        </div>
        <Link to="/studies/$id/interviews/upload" params={{ id }}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          + Enviar entrevista
        </Link>
      </div>

      <div className="rounded-sm border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <Th label="ID" w="w-20" />
                <Th label="Iniciada em" w="w-44" />
                <Th label="Tempo ativo" w="w-32" />
                <Th label="Progresso" w="w-36" />
                <Th label="Qualidade" w="w-32" />
                <Th label="Respondente" w="w-48" />
                <Th label="Segmentos" w="w-56" />
                <Th label="Resumo em bullets" w="w-96" />
                <Th label="Tagline" w="w-72" />
                <Th label="Tags" w="w-56" />
                {data.questions.map((q, i) => (
                  <Th key={q.id} label={`Q${i + 1}: ${q.text}`} w="w-80" />
                ))}
              </tr>
              <tr className="bg-background/60 border-t border-border">
                <FilterCell />
                <FilterCell value={filters["started_at"]} onChange={(v) => setFilter("started_at", v)} />
                <FilterCell />
                <FilterCell value={filters["status"]} onChange={(v) => setFilter("status", v)} placeholder="ex: Concluída" />
                <FilterCell value={filters["quality"]} onChange={(v) => setFilter("quality", v)} placeholder="ex: Excelente" />
                <FilterCell value={filters["respondent"]} onChange={(v) => setFilter("respondent", v)} placeholder="nome / cidade" />
                <FilterCell value={filters["segments"]} onChange={(v) => setFilter("segments", v)} />
                <FilterCell value={filters["bullets"]} onChange={(v) => setFilter("bullets", v)} />
                <FilterCell value={filters["tagline"]} onChange={(v) => setFilter("tagline", v)} />
                <FilterCell value={filters["tags"]} onChange={(v) => setFilter("tags", v)} />
                {data.questions.map((q) => (
                  <FilterCell key={q.id}
                    value={filters[`q:${q.id}`]}
                    onChange={(v) => setFilter(`q:${q.id}`, v)} />
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr><td colSpan={10 + data.questions.length} className="p-8 text-center text-sm text-muted-foreground">
                  Nenhuma entrevista encontrada.
                </td></tr>
              ) : filteredRows.map((row) => (
                <RowItem key={row.id} row={row} questions={data.questions} studyId={id} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({ label, w }: { label: string; w?: string }) {
  return (
    <th className={`px-3 py-2.5 text-xs font-medium text-muted-foreground border-b border-border ${w ?? ""}`}>
      {label}
    </th>
  );
}

function FilterCell({ value, onChange, placeholder }: { value?: string; onChange?: (v: string) => void; placeholder?: string }) {
  if (!onChange) return <td className="px-3 py-1.5 border-b border-border" />;
  return (
    <td className="px-3 py-1.5 border-b border-border">
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "filtrar…"}
        className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
      />
    </td>
  );
}

function RowItem({ row, questions, studyId }: { row: Row; questions: { id: string; text: string; position: number }[]; studyId: string }) {
  const insights = row.insights;
  const answerSummary = (qid: string) => insights?.answer_summaries?.find((s) => s.question_id === qid)?.summary ?? "—";
  const respondentLabel = [row.respondent_name, [row.respondent_city, row.respondent_state].filter(Boolean).join("/")].filter(Boolean).join(" · ");

  return (
    <tr className="border-b border-border hover:bg-muted/20">
      <td className="px-3 py-3 align-top">
        <Link to="/studies/$id/interviews/$interviewId" params={{ id: studyId, interviewId: row.id }}
          className="text-primary hover:underline font-medium">
          #{row.sequence}
        </Link>
        {row.source === "upload" && <div className="text-[10px] text-muted-foreground mt-0.5">upload</div>}
      </td>
      <td className="px-3 py-3 align-top text-xs">{new Date(row.started_at).toLocaleString("pt-BR")}</td>
      <td className="px-3 py-3 align-top">{formatDuration(row.active_seconds)}</td>
      <td className="px-3 py-3 align-top">{STATUS_LABEL[row.status] ?? row.status}</td>
      <td className="px-3 py-3 align-top">{qualityLabel(row.avg_quality_score, insights?.quality ?? null)}</td>
      <td className="px-3 py-3 align-top text-xs">{respondentLabel || "—"}</td>
      <td className="px-3 py-3 align-top">
        <div className="flex flex-wrap gap-1">
          {(insights?.segments ?? []).map((s, i) => <Badge key={i} variant="secondary" className="text-[10px]">{s}</Badge>)}
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        {insights?.bullet_summary?.length ? (
          <ul className="space-y-0.5 text-xs leading-relaxed">
            {insights.bullet_summary.map((b, i) => <li key={i}>– {b}</li>)}
          </ul>
        ) : <span className="text-xs text-muted-foreground">—</span>}
      </td>
      <td className="px-3 py-3 align-top text-xs italic">{insights?.tagline || "—"}</td>
      <td className="px-3 py-3 align-top">
        <div className="flex flex-wrap gap-1">
          {(insights?.tags ?? []).map((t, i) => <Badge key={i} variant="outline" className="text-[10px]">{t}</Badge>)}
        </div>
      </td>
      {questions.map((q) => (
        <td key={q.id} className="px-3 py-3 align-top text-xs">
          {answerSummary(q.id)}
        </td>
      ))}
    </tr>
  );
}

function rowFieldText(
  row: Row,
  key: string,
  questions: { id: string; text: string; position: number }[],
): string {
  const insights = row.insights;
  switch (key) {
    case "started_at": return new Date(row.started_at).toLocaleString("pt-BR");
    case "status": return STATUS_LABEL[row.status] ?? row.status;
    case "quality": return qualityLabel(row.avg_quality_score, insights?.quality ?? null);
    case "respondent": return [row.respondent_name, row.respondent_city, row.respondent_state].filter(Boolean).join(" ");
    case "segments": return (insights?.segments ?? []).join(" ");
    case "bullets": return (insights?.bullet_summary ?? []).join(" ");
    case "tagline": return insights?.tagline ?? "";
    case "tags": return (insights?.tags ?? []).join(" ");
  }
  if (key.startsWith("q:")) {
    const qid = key.slice(2);
    return insights?.answer_summaries?.find((s) => s.question_id === qid)?.summary ?? "";
  }
  // ensure questions parameter is referenced for type-safety
  void questions;
  return "";
}
