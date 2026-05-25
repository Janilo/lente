// Speech-to-text provider abstraction.
// Provider is selected via the STT_PROVIDER env var:
//   - "elevenlabs" (default) → requires ELEVENLABS_API_KEY
//   - "assemblyai"           → requires ASSEMBLYAI_API_KEY
//   - "google"               → requires GOOGLE_SPEECH_API_KEY (Google Cloud API key with Speech-to-Text enabled)

export type SttResult = { transcript: string; words: unknown | null };

export async function transcribeAudio(file: Blob): Promise<SttResult> {
  const provider = (process.env.STT_PROVIDER ?? "elevenlabs").toLowerCase();
  switch (provider) {
    case "assemblyai":
      return transcribeAssemblyAI(file);
    case "google":
    case "google-speech":
    case "gcp":
      return transcribeGoogle(file);
    case "elevenlabs":
    case "":
      return transcribeElevenLabs(file);
    default:
      throw new Error(`STT_PROVIDER inválido: "${provider}". Use elevenlabs, assemblyai ou google.`);
  }
}

// ───────────────────────────── ElevenLabs ─────────────────────────────
async function transcribeElevenLabs(file: Blob): Promise<SttResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY não configurada.");

  const form = new FormData();
  form.append("file", file, "answer.webm");
  form.append("model_id", "scribe_v2");
  form.append("language_code", "por");
  form.append("diarize", "false");

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`ElevenLabs: ${res.status} ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  return { transcript: (json.text ?? "").trim(), words: json.words ?? null };
}

// ───────────────────────────── AssemblyAI ─────────────────────────────
async function transcribeAssemblyAI(file: Blob): Promise<SttResult> {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) throw new Error("ASSEMBLYAI_API_KEY não configurada.");

  // 1. Upload raw bytes
  const buf = await file.arrayBuffer();
  const upRes = await fetch("https://api.assemblyai.com/v2/upload", {
    method: "POST",
    headers: { authorization: apiKey, "content-type": "application/octet-stream" },
    body: buf,
  });
  if (!upRes.ok) throw new Error(`AssemblyAI upload: ${upRes.status} ${(await upRes.text()).slice(0, 200)}`);
  const { upload_url } = (await upRes.json()) as { upload_url: string };

  // 2. Create transcript
  const createRes = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: { authorization: apiKey, "content-type": "application/json" },
    body: JSON.stringify({ audio_url: upload_url, language_code: "pt" }),
  });
  if (!createRes.ok) throw new Error(`AssemblyAI create: ${createRes.status} ${(await createRes.text()).slice(0, 200)}`);
  const created = (await createRes.json()) as { id: string };

  // 3. Poll until done (max ~5min)
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2500));
    const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${created.id}`, {
      headers: { authorization: apiKey },
    });
    if (!pollRes.ok) throw new Error(`AssemblyAI poll: ${pollRes.status}`);
    const t = (await pollRes.json()) as { status: string; text?: string; words?: unknown; error?: string };
    if (t.status === "completed") return { transcript: (t.text ?? "").trim(), words: t.words ?? null };
    if (t.status === "error") throw new Error(`AssemblyAI: ${t.error ?? "erro desconhecido"}`);
  }
  throw new Error("AssemblyAI: timeout aguardando transcrição.");
}

// ───────────────────────────── Google Cloud Speech-to-Text ─────────────────────────────
// Uses the synchronous recognize endpoint with an API key. Requires audio
// under ~10MB / ~1min. For longer audio, switch to longRunningRecognize +
// GCS upload (não implementado aqui).
async function transcribeGoogle(file: Blob): Promise<SttResult> {
  const apiKey = process.env.GOOGLE_SPEECH_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_SPEECH_API_KEY não configurada.");

  const buf = new Uint8Array(await file.arrayBuffer());
  // Base64 encode in chunks to avoid stack overflow on large buffers.
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  const audioB64 = btoa(bin);

  const body = {
    config: {
      encoding: "WEBM_OPUS",
      sampleRateHertz: 48000,
      languageCode: "pt-BR",
      enableAutomaticPunctuation: true,
      enableWordTimeOffsets: true,
    },
    audio: { content: audioB64 },
  };

  const res = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Google Speech: ${res.status} ${txt.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    results?: Array<{ alternatives?: Array<{ transcript?: string; words?: unknown }> }>;
  };
  const results = json.results ?? [];
  const transcript = results
    .map((r) => r.alternatives?.[0]?.transcript ?? "")
    .join(" ")
    .trim();
  const words = results.flatMap((r) => (r.alternatives?.[0]?.words as unknown[]) ?? []);
  return { transcript, words: words.length ? words : null };
}
