// Speech-to-text provider abstraction.
// Provider is selected via the STT_PROVIDER env var:
//   - "elevenlabs" (default) → requires ELEVENLABS_API_KEY
//   - "assemblyai"           → requires ASSEMBLYAI_API_KEY

export type SttResult = { transcript: string; words: unknown | null };

export async function transcribeAudio(file: Blob): Promise<SttResult> {
  const provider = (process.env.STT_PROVIDER ?? "elevenlabs").toLowerCase();
  switch (provider) {
    case "assemblyai":
      return transcribeAssemblyAI(file);
    case "elevenlabs":
    case "":
      return transcribeElevenLabs(file);
    default:
      throw new Error(`STT_PROVIDER inválido: "${provider}". Use elevenlabs ou assemblyai.`);
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
