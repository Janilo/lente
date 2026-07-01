import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  createUploadedInterview,
  processUploadedInterview,
} from "@/lib/interview-upload.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/studies/$id/interviews/upload")({
  head: () => ({ meta: [{ title: "Enviar entrevista — Lente" }] }),
  component: UploadInterview,
});

const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

function UploadInterview() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const create = useServerFn(createUploadedInterview);
  const process = useServerFn(processUploadedInterview);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    city: "",
    state: "",
    age_range: "",
    occupation: "",
    industry: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string>("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Selecione um vídeo.");
      return;
    }
    if (!form.full_name.trim()) {
      toast.error("Informe o nome do respondente.");
      return;
    }
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (!["mp4", "webm", "mov", "m4v", "mkv"].includes(ext)) {
      toast.error("Formato suportado: mp4, webm, mov, m4v, mkv.");
      return;
    }

    setBusy(true);
    try {
      setStage("Preparando entrevista…");
      const { interview_id, path } = await create({
        data: { study_id: id, external_respondent: form, video_ext: ext },
      });

      setStage("Enviando vídeo…");
      const { error: upErr } = await supabase.storage
        .from("interview-videos")
        .upload(path, file, { upsert: true, contentType: file.type || `video/${ext}` });
      if (upErr) throw new Error(upErr.message);

      setStage("Transcrevendo e estruturando respostas (pode levar alguns minutos)…");
      await process({ data: { interview_id, video_ext: ext } });

      toast.success("Entrevista processada.");
      navigate({
        to: "/studies/$id/interviews/$interviewId",
        params: { id, interviewId: interview_id },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload.");
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 space-y-6">
      <div>
        <Link
          to="/studies/$id/interviews"
          params={{ id }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Entrevistas do estudo
        </Link>
        <h1 className="mt-3 text-3xl">Enviar entrevista completa</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Suba um vídeo único da entrevista. A IA transcreve e organiza as respostas conforme o
          roteiro do estudo.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6 rounded-sm border border-border bg-card p-6">
        <section className="grid gap-4 md:grid-cols-2">
          <Field label="Nome do respondente *">
            <input
              required
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="E-mail (opcional)">
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Cidade">
            <input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Estado">
            <input
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Faixa etária">
            <select
              value={form.age_range}
              onChange={(e) => setForm({ ...form, age_range: e.target.value })}
              className="input"
            >
              <option value="">—</option>
              {AGE_RANGES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cargo / ocupação">
            <input
              value={form.occupation}
              onChange={(e) => setForm({ ...form, occupation: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Setor / indústria">
            <input
              value={form.industry}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
              className="input"
            />
          </Field>
        </section>

        <Field label="Vídeo da entrevista * (mp4, webm, mov, m4v, mkv — até 1 GB)">
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/x-matroska,.mp4,.webm,.mov,.m4v,.mkv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
          />
          {file && (
            <p className="mt-2 text-xs text-muted-foreground">
              {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB
            </p>
          )}
        </Field>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{stage}</p>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Processando…" : "Enviar e processar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
