import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { startInterview, getNextStep, createAnswer, processAnswer, finishInterview } from "@/lib/interview.functions";
import { PipelineStatus } from "@/components/interview/PipelineStatus";
import { toast } from "sonner";

export const Route = createFileRoute("/r_/$slug/run")({
  head: () => ({ meta: [{ title: "Entrevista — Lente" }] }),
  component: RunPage,
});

function RunPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate({ to: "/login", search: { returnTo: `/r/${slug}/run` } });
    }
  }, [loading, isAuthenticated, navigate, slug]);

  if (loading || !isAuthenticated) {
    return <div className="mx-auto max-w-2xl px-6 py-20 text-sm text-muted-foreground">Carregando…</div>;
  }
  return <RunInner slug={slug} />;
}

function RunInner({ slug }: { slug: string }) {
  const qc = useQueryClient();
  const startFn = useServerFn(startInterview);
  const nextFn = useServerFn(getNextStep);
  const createAns = useServerFn(createAnswer);
  const processAns = useServerFn(processAnswer);
  const finishFn = useServerFn(finishInterview);

  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [step, setStep] = useState<any>(null);
  const [stepLoading, setStepLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await startFn({ data: { slug } });
        setInterviewId(r.interview_id);
        await loadNext(r.interview_id);
      } catch (e) {
        toast.error((e as Error).message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const loadNext = async (id: string) => {
    setStepLoading(true);
    try {
      const r = await nextFn({ data: { interview_id: id } });
      setStep(r.next);
      if (r.next.type === "processing") {
        // poll once after 2s
        setTimeout(() => loadNext(id), 2500);
      }
    } finally {
      setStepLoading(false);
    }
  };

  const handleRecorded = async (blob: Blob) => {
    if (!interviewId || !step) return;
    try {
      const created = await createAns({
        data: {
          interview_id: interviewId,
          question_id: step.question_id,
          question_text: step.text,
          is_followup: step.type === "followup",
          parent_answer_id: step.parent_answer_id ?? null,
        },
      });
      const { error: upErr } = await supabase.storage.from("interview-videos").upload(created.path, blob, {
        contentType: blob.type || "video/webm",
        upsert: true,
      });
      if (upErr) throw new Error(upErr.message);
      const r = await processAns({ data: { answer_id: created.answer_id } });
      setStep(r.next);
      if (r.next.type === "done") toast.success("Entrevista concluída.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (!interviewId || !step || stepLoading) {
    return <div className="mx-auto max-w-2xl px-6 py-20 text-sm text-muted-foreground">Preparando…</div>;
  }

  if (step.type === "done") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-3xl font-semibold">Obrigado!</h1>
        <p className="mt-3 text-sm text-muted-foreground">Sua entrevista foi concluída. Você pode fechar esta página.</p>
        <Link to="/r/$slug" params={{ slug }} className="mt-8 inline-block text-sm text-primary underline">Voltar</Link>
      </div>
    );
  }

  if (step.type === "processing") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12 space-y-6">
        <PipelineStatus interviewId={interviewId} variant="respondent" />
        <div className="text-sm text-muted-foreground">Processando última resposta…</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 space-y-6">
      <PipelineStatus interviewId={interviewId} variant="respondent" />
      <div>
        {step.type === "followup" && (
          <p className="text-xs uppercase tracking-widest text-primary">Pergunta de aprofundamento</p>
        )}
        <h2 className="mt-3 text-2xl font-semibold leading-snug">{step.text}</h2>
        {step.intent && <p className="mt-2 text-sm text-muted-foreground">{step.intent}</p>}
        <div className="mt-8">
          <Recorder key={`${step.question_id}-${step.type}-${step.parent_answer_id ?? "root"}`} onRecorded={handleRecorded} />
        </div>
      </div>
    </div>
  );
}

function Recorder({ onRecorded }: { onRecorded: (b: Blob) => void | Promise<void> }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "ready" | "recording" | "uploading">("idle");
  const [elapsed, setElapsed] = useState(0);

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast.error("Selecione um arquivo de vídeo válido.");
      return;
    }
    const MAX = 500 * 1024 * 1024; // 500MB
    if (file.size > MAX) {
      toast.error("Arquivo muito grande (máx. 500MB).");
      return;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setState("uploading");
    try {
      await onRecorded(file);
    } catch (err) {
      toast.error((err as Error).message);
      setState("idle");
    }
  };

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (state === "recording") {
      const t0 = Date.now();
      timer = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 250);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [state]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const askCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play();
      }
      setState("ready");
    } catch (e) {
      toast.error("Não foi possível acessar câmera/microfone.");
    }
  };

  const start = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";
    const rec = new MediaRecorder(streamRef.current, { mimeType: mime });
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setState("uploading");
      try { await onRecorded(blob); } finally {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
    rec.start(500);
    recorderRef.current = rec;
    setElapsed(0);
    setState("recording");
  };

  const stop = () => {
    recorderRef.current?.stop();
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <video ref={videoRef} className="aspect-video w-full rounded-md bg-black" playsInline />
      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {state === "recording" && `Gravando · ${elapsed}s`}
          {state === "ready" && "Pronto. Clique em Gravar quando estiver pronto."}
          {state === "idle" && "Conceda acesso à câmera e microfone."}
          {state === "uploading" && "Enviando…"}
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleFilePick}
          />
          {(state === "idle" || state === "ready") && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Enviar vídeo
            </button>
          )}
          {state === "idle" && (
            <button onClick={askCamera} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              Ativar câmera
            </button>
          )}
          {state === "ready" && (
            <button onClick={start} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              Gravar
            </button>
          )}
          {state === "recording" && (
            <button onClick={stop} className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground">
              Parar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
