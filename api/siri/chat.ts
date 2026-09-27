import { GROQ_API_URL, groqKey, guard, json } from "../_lib/guard";
import { SIRI_SYSTEM_PROMPT, SIRI_TOOLS } from "../../src/data/siri";

export const config = { runtime: "edge" };

// Tried in order until one succeeds. Update here when Groq retires a model.
const CHAT_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];

const MAX_CHARS = 500;

export default async function handler(req: Request): Promise<Response> {
  const blocked = guard(req);
  if (blocked) return blocked;

  const key = groqKey();
  if (!key) return json(503, { error: "Siri is not configured." });

  // The browser only sends the visitor's question; the prompt and tools live
  // here so the key can't be used as a general-purpose chatbot.
  let text: unknown;
  try {
    ({ text } = await req.json());
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  if (typeof text !== "string" || !text.trim()) return json(400, { error: "Missing text" });
  if (text.length > MAX_CHARS) return json(413, { error: "Question too long" });

  const messages = [
    { role: "system", content: SIRI_SYSTEM_PROMPT },
    { role: "user", content: text.trim() }
  ];

  let lastError = "";
  for (const model of CHAT_MODELS) {
    const payload = {
      model,
      messages,
      tools: SIRI_TOOLS,
      tool_choice: "auto",
      temperature: 0.2,
      // gpt-oss reasons before answering; keep it short so Siri replies fast.
      reasoning_effort: "low",
      max_tokens: 700
    };

    try {
      const res = await fetch(`${GROQ_API_URL}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) return json(200, await res.json());
      lastError = `${model}: ${res.status}`;
    } catch (err) {
      lastError = `${model}: ${(err as Error).message}`;
    }
  }

  return json(502, { error: `All models failed (${lastError})` });
}
