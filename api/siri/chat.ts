import { GROQ_API_URL, groqKey, guard, json } from "../_lib/guard";

export const config = { runtime: "edge" };

// Tried in order until one succeeds. Update here when Groq retires a model.
const CHAT_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

const MAX_MESSAGES = 16;
const MAX_CHARS = 12_000;

export default async function handler(req: Request): Promise<Response> {
  const blocked = guard(req);
  if (blocked) return blocked;

  const key = groqKey();
  if (!key) return json(503, { error: "Siri is not configured." });

  let body: { messages?: unknown; tools?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const { messages, tools } = body;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return json(400, { error: "Invalid messages" });
  }
  if (JSON.stringify(messages).length > MAX_CHARS) {
    return json(413, { error: "Request too large" });
  }

  let lastError = "";
  for (const model of CHAT_MODELS) {
    const payload: Record<string, unknown> = {
      model,
      messages,
      temperature: 0.1,
      max_tokens: 1024
    };
    if (Array.isArray(tools) && tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = "auto";
    }

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
