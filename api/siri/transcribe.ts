import { GROQ_API_URL, groqKey, guard, json } from "../_lib/guard";

export const config = { runtime: "edge" };

const MAX_BYTES = 4 * 1024 * 1024; // ~2 minutes of webm/opus

export default async function handler(req: Request): Promise<Response> {
  const blocked = guard(req);
  if (blocked) return blocked;

  const key = groqKey();
  if (!key) return json(503, { error: "Siri is not configured." });

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return json(400, { error: "Expected multipart form data" });
  }
  if (!(file instanceof Blob)) return json(400, { error: "Missing audio file" });
  if (file.size > MAX_BYTES) return json(413, { error: "Recording too long" });

  const form = new FormData();
  form.append("file", file, "audio.webm");
  form.append("model", "whisper-large-v3-turbo");

  const res = await fetch(`${GROQ_API_URL}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form
  });
  if (!res.ok) return json(502, { error: `Transcription failed (${res.status})` });

  const data = (await res.json()) as { text?: string };
  return json(200, { text: data.text ?? "" });
}
