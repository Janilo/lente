import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { startInterview, getNextStep, createAnswer, processAnswer } from "@/lib/interview.functions";
import { InterviewProgress } from "@/components/interview/InterviewProgress";
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

type Totals = {
  question_count: number;
  current_position: number | null;
  followups_done_for_current: number;
  max_followups: number;
  is_followup: boolean;
};

function RunInner({ slug }: { slug: string }) {
  const startFn = useServerFn(startInterview);
  const nextFn = useServerFn(getNextStep);
  const createAns = useServerFn(createAnswer);
  const processAns = useServerFn(processAnswer);

  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [step, setStep] = useState<any>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [stepLoading, setStepLoading] = useState(false);

  // Persistent camera stream across questions
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camState, setCamState] = useState<"idle" | "ready">("idle");

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamState("idle");
  };

  const askCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => {});
      }
      setCamState("ready");
    } catch {
      toast.error("Não foi possível acessar câmera/microfone.");
    }
  };

  useEffect(() => () => stopStream(), []);

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
      setTotals(r.totals as Totals);
      if (r.next.type === "processing") {
        setTimeout(() => loadNext(id), 2500);
      }
      if (r.next.type === "done") {
        stopStream();
      }
    } finally {
      setStepLoading(false);
    }
  };

  // Re-attach stream to video element whenever it remounts (e.g. step type changes)
  useEffect(() => {
    if (videoRef.current && streamRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {});
    }
  }, [step]);

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
      if ((r as any).empty) {
        toast.warning("Não captamos nenhuma fala. Por favor, repita a resposta.");
        await loadNext(interviewId);
        return;
      }
      setStep(r.next);
      if (r.next.type === "done") {
        stopStream();
        toast.success("Entrevista concluída.");
      } else {
        // refresh totals after a new answer
        await loadNext(interviewId);
      }
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
        <InterviewProgress totals={totals} processing />
        <div className="text-sm text-muted-foreground">Processando última resposta…</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 space-y-6">
      <InterviewProgress totals={totals} />
      <div>
        {step.type === "followup" && (
          <p className="text-xs uppercase tracking-widest text-primary">Pergunta de aprofundamento</p>
        )}
        <h2 className="mt-3 text-2xl font-semibold leading-snug">{step.text}</h2>
        {step.intent && <p className="mt-2 text-sm text-muted-foreground">{step.intent}</p>}
        <div className="mt-8">
          <Recorder
            questionKey={`${step.question_id}-${step.type}-${step.parent_answer_id ?? "root"}`}
            videoRef={videoRef}
            stream={streamRef.current}
            camState={camState}
            onAskCamera={askCamera}
            onRecorded={handleRecorded}
          />
        </div>
      </div>
    </div>
  );
}

const PREROLL_SECONDS = 3;
const MIN_RECORDING_SECONDS = 2;


function Recorder({
  questionKey,
  videoRef,
  stream,
  camState,
  onAskCamera,
  onRecorded,
}: {
  questionKey: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  camState: "idle" | "ready";
  onAskCamera: () => void;
  onRecorded: (b: Blob) => void | Promise<void>;
}) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "preroll" | "recording" | "uploading">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [preroll, setPreroll] = useState(PREROLL_SECONDS);

  const start = () => {
    if (!stream) return;
    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";
    const rec = new MediaRecorder(stream, { mimeType: mime });
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      chunksRef.current = [];
      setState("uploading");
      try { await onRecorded(blob); } catch (err) {
        toast.error((err as Error).message);
        setState("idle");
      }
      // NOTE: do NOT stop the stream — keep the camera alive across questions.
    };
    rec.start(500);
    recorderRef.current = rec;
    setElapsed(0);
    setState("recording");
  };

  // Reset and auto-start preroll whenever the question changes (camera must be ready).
  useEffect(() => {
    chunksRef.current = [];
    setElapsed(0);
    if (camState === "ready" && stream) {
      setPreroll(PREROLL_SECONDS);
      setState("preroll");
    } else {
      setState("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionKey]);

  // When the camera becomes ready on the very first question, kick off the preroll.
  useEffect(() => {
    if (state === "idle" && camState === "ready" && stream) {
      setPreroll(PREROLL_SECONDS);
      setState("preroll");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camState, stream]);

  // Preroll countdown
  useEffect(() => {
    if (state !== "preroll") return;
    if (preroll <= 0) {
      start();
      return;
    }
    const t = setTimeout(() => setPreroll((p) => p - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, preroll]);

  // Recording timer
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (state === "recording") {
      const t0 = Date.now();
      timer = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 250);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [state]);

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast.error("Selecione um arquivo de vídeo válido.");
      return;
    }
    const MAX = 500 * 1024 * 1024;
    if (file.size > MAX) {
      toast.error("Arquivo muito grande (máx. 500MB).");
      return;
    }
    // Abort any in-flight recording before uploading a file.
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.ondataavailable = null;
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    setState("uploading");
    try {
      await onRecorded(file);
    } catch (err) {
      toast.error((err as Error).message);
      setState("idle");
    }
  };

  const finish = () => {
    recorderRef.current?.stop();
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="relative">
        <video ref={videoRef} className="aspect-video w-full rounded-md bg-black" playsInline autoPlay muted />
        {state === "recording" && (
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
            Gravando · {fmt(elapsed)}
          </div>
        )}
        {state === "preroll" && (
          <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/50">
            <div className="text-center text-white">
              <p className="text-sm uppercase tracking-widest opacity-80">Gravando em</p>
              <p className="text-6xl font-semibold tabular-nums">{preroll}</p>
            </div>
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {state === "idle" && camState === "idle" && "Conceda acesso à câmera e microfone para começar."}
          {state === "idle" && camState === "ready" && "Preparando próxima pergunta…"}
          {state === "preroll" && "Prepare-se para responder. A gravação começa em instantes."}
          {state === "recording" && "Responda quando estiver pronto e clique em Concluir resposta."}
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
          {(state === "idle" || state === "preroll") && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Enviar vídeo
            </button>
          )}
          {state === "idle" && camState === "idle" && (
            <button onClick={onAskCamera} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              Ativar câmera
            </button>
          )}
          {state === "recording" && (
            <button onClick={finish} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              Concluir resposta
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
