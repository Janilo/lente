import { jsPDF } from "jspdf";

type Evidence = {
  quote: string;
  interview_index?: number | null;
  question_text?: string | null;
  clip_start?: number | null;
  clip_end?: number | null;
};

type Insight = {
  theme: string;
  summary: string;
  evidence: unknown;
};

type Recommendation = {
  title: string;
  rationale: string;
  priority: number | null;
};

type ExportData = {
  study: { title: string; business_goal: string | null; context: string | null; target_audience: string | null };
  interview_count: number;
  insights: Insight[];
  recommendations: Recommendation[];
};

// Lente teal — keep aligned with the design system primary tone.
const TEAL: [number, number, number] = [14, 107, 94];
const INK: [number, number, number] = [5, 47, 42];
const MUTED: [number, number, number] = [110, 120, 118];
const RULE: [number, number, number] = [220, 224, 222];

const PAGE_W = 210; // A4 mm
const PAGE_H = 297;
const MARGIN_X = 18;
const MARGIN_TOP = 22;
const MARGIN_BOTTOM = 18;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

function fmtTime(s: number | null | undefined): string {
  if (s == null || !isFinite(s)) return "";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function priorityLabel(p: number | null): string {
  return p === 1 ? "Alta" : p === 2 ? "Média" : p === 3 ? "Baixa" : "—";
}

class Doc {
  pdf: jsPDF;
  y: number;
  pageNum = 1;
  studyTitle: string;

  constructor(studyTitle: string) {
    this.pdf = new jsPDF({ unit: "mm", format: "a4" });
    this.studyTitle = studyTitle;
    this.y = MARGIN_TOP;
    this.drawHeader();
    this.drawFooter();
  }

  private drawHeader() {
    this.pdf.setFont("helvetica", "bold");
    this.pdf.setTextColor(...TEAL);
    this.pdf.setFontSize(11);
    this.pdf.text("Lente", MARGIN_X, 12);
    this.pdf.setFont("helvetica", "normal");
    this.pdf.setTextColor(...MUTED);
    this.pdf.setFontSize(8);
    const right = this.studyTitle.length > 80 ? this.studyTitle.slice(0, 77) + "…" : this.studyTitle;
    this.pdf.text(right, PAGE_W - MARGIN_X, 12, { align: "right" });
    this.pdf.setDrawColor(...RULE);
    this.pdf.setLineWidth(0.2);
    this.pdf.line(MARGIN_X, 14.5, PAGE_W - MARGIN_X, 14.5);
  }

  private drawFooter() {
    this.pdf.setFont("helvetica", "normal");
    this.pdf.setTextColor(...MUTED);
    this.pdf.setFontSize(8);
    this.pdf.text(`Página ${this.pageNum}`, PAGE_W - MARGIN_X, PAGE_H - 8, { align: "right" });
    this.pdf.text("Gerado pela Lente · pereirasaraiva.com", MARGIN_X, PAGE_H - 8);
  }

  ensureSpace(needed: number) {
    if (this.y + needed > PAGE_H - MARGIN_BOTTOM) {
      this.pdf.addPage();
      this.pageNum++;
      this.y = MARGIN_TOP;
      this.drawHeader();
      this.drawFooter();
    }
  }

  eyebrow(text: string) {
    this.ensureSpace(7);
    this.pdf.setFont("helvetica", "bold");
    this.pdf.setFontSize(8);
    this.pdf.setTextColor(...TEAL);
    this.pdf.text(text.toUpperCase(), MARGIN_X, this.y);
    this.y += 5;
  }

  title(text: string, size = 22) {
    this.pdf.setFont("helvetica", "bold");
    this.pdf.setFontSize(size);
    this.pdf.setTextColor(...INK);
    const lines = this.pdf.splitTextToSize(text, CONTENT_W) as string[];
    const h = lines.length * size * 0.42;
    this.ensureSpace(h + 2);
    this.pdf.text(lines, MARGIN_X, this.y);
    this.y += h + 2;
  }

  h2(text: string) {
    this.title(text, 16);
  }

  body(text: string, opts: { italic?: boolean; muted?: boolean; size?: number } = {}) {
    const size = opts.size ?? 10;
    this.pdf.setFont("helvetica", opts.italic ? "italic" : "normal");
    this.pdf.setFontSize(size);
    this.pdf.setTextColor(...(opts.muted ? MUTED : INK));
    const lines = this.pdf.splitTextToSize(text, CONTENT_W) as string[];
    const lh = size * 0.45;
    for (const line of lines) {
      this.ensureSpace(lh + 1);
      this.pdf.text(line, MARGIN_X, this.y);
      this.y += lh;
    }
  }

  indentedQuote(quote: string, meta: string) {
    const size = 10;
    this.pdf.setFont("helvetica", "italic");
    this.pdf.setFontSize(size);
    this.pdf.setTextColor(...INK);
    const lines = this.pdf.splitTextToSize(`"${quote}"`, CONTENT_W - 6) as string[];
    const lh = size * 0.45;
    const blockH = lines.length * lh + 5;
    this.ensureSpace(blockH);
    // Left rule
    this.pdf.setDrawColor(...TEAL);
    this.pdf.setLineWidth(0.6);
    this.pdf.line(MARGIN_X, this.y - 3, MARGIN_X, this.y - 3 + blockH - 1);
    for (const line of lines) {
      this.pdf.text(line, MARGIN_X + 4, this.y);
      this.y += lh;
    }
    // Meta line
    this.pdf.setFont("helvetica", "normal");
    this.pdf.setFontSize(8);
    this.pdf.setTextColor(...MUTED);
    this.pdf.text(meta, MARGIN_X + 4, this.y);
    this.y += 4;
  }

  rule() {
    this.ensureSpace(4);
    this.pdf.setDrawColor(...RULE);
    this.pdf.setLineWidth(0.2);
    this.pdf.line(MARGIN_X, this.y, PAGE_W - MARGIN_X, this.y);
    this.y += 4;
  }

  gap(mm: number) {
    this.y += mm;
  }

  priorityPill(p: number | null) {
    const label = `Prioridade ${priorityLabel(p)}`;
    this.pdf.setFont("helvetica", "bold");
    this.pdf.setFontSize(8);
    const w = this.pdf.getTextWidth(label) + 4;
    const x = PAGE_W - MARGIN_X - w;
    const yTop = this.y - 4;
    const fill: [number, number, number] = p === 1 ? [217, 97, 79] : p === 2 ? TEAL : [180, 185, 183];
    this.pdf.setFillColor(...fill);
    this.pdf.roundedRect(x, yTop, w, 5.5, 1, 1, "F");
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.text(label, x + 2, yTop + 3.8);
  }

  save(filename: string) {
    this.pdf.save(filename);
  }
}

export function exportSynthesisPDF(data: ExportData) {
  const doc = new Doc(data.study.title);

  // Cover-ish header
  doc.eyebrow("Síntese · Lente");
  doc.title(data.study.title, 22);
  doc.body(
    `${data.insights.length} insights · ${data.recommendations.length} recomendações · ${data.interview_count} entrevistas`,
    { muted: true, size: 9 },
  );
  doc.gap(4);

  if (data.study.business_goal) {
    doc.eyebrow("Objetivo de negócio");
    doc.body(data.study.business_goal);
    doc.gap(2);
  }
  if (data.study.context) {
    doc.eyebrow("Contexto");
    doc.body(data.study.context);
    doc.gap(2);
  }
  if (data.study.target_audience) {
    doc.eyebrow("Público-alvo");
    doc.body(data.study.target_audience);
    doc.gap(2);
  }
  doc.rule();

  // Insights
  doc.gap(2);
  doc.h2(`Insights (${data.insights.length})`);
  doc.gap(2);
  for (let i = 0; i < data.insights.length; i++) {
    const ins = data.insights[i];
    doc.eyebrow(`Insight ${i + 1}`);
    doc.title(ins.theme, 13);
    doc.gap(1);
    doc.body(ins.summary);
    doc.gap(2);
    const evidence = (ins.evidence as Evidence[] | null) ?? [];
    if (evidence.length > 0) {
      doc.eyebrow("Evidências");
      for (const ev of evidence) {
        const parts: string[] = [];
        if (ev.interview_index != null) parts.push(`Entrevista ${ev.interview_index}`);
        if (ev.clip_start != null) {
          parts.push(
            ev.clip_end != null
              ? `${fmtTime(ev.clip_start)}–${fmtTime(ev.clip_end)}`
              : fmtTime(ev.clip_start),
          );
        }
        doc.indentedQuote(ev.quote, parts.join(" · ") || "—");
        doc.gap(1);
      }
    }
    doc.gap(3);
    doc.rule();
    doc.gap(2);
  }

  // Recommendations
  if (data.recommendations.length > 0) {
    doc.h2(`Recomendações (${data.recommendations.length})`);
    doc.gap(2);
    for (let i = 0; i < data.recommendations.length; i++) {
      const r = data.recommendations[i];
      doc.eyebrow(`Recomendação ${i + 1}`);
      doc.title(r.title, 13);
      doc.priorityPill(r.priority);
      doc.gap(1);
      doc.body(r.rationale);
      doc.gap(3);
      doc.rule();
      doc.gap(2);
    }
  }

  const safe = data.study.title.replace(/[^a-z0-9-_ ]/gi, "").slice(0, 60).trim() || "sintese";
  doc.save(`Lente — ${safe}.pdf`);
}
