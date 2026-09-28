import { GROQ_API_URL, groqKey, guard, json } from "../_lib/guard";
import { MESSAGES_LIMITS, MESSAGES_SYSTEM_PROMPT } from "../../src/data/messages";

export const config = { runtime: "edge" };

// Tried in order until one succeeds. Update here when Groq retires a model.
const CHAT_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"];

// Chat bubbles are plain text: turn any markdown the model slips in into text.
const plain = (t: string) =>
  t
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, (_, label, url) => (label === url ? url : `${label}: ${url}`))
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

type Turn = { role: "user" | "assistant"; content: string };

export default async function handler(req: Request): Promise<Response> {
  const blocked = guard(req);
  if (blocked) return blocked;

  const key = groqKey();
  if (!key) return json(503, { error: "Messages AI is not configured." });

  // The browser sends only the recent conversation; the prompt lives here.
  let history: unknown;
  try {
    ({ history } = await req.json());
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  if (!Array.isArray(history) || !history.length) return json(400, { error: "Missing history" });
  const raw = history[history.length - 1] as Partial<Turn> | undefined;
  if (typeof raw?.content === "string" && raw.content.length > MESSAGES_LIMITS.maxChars) return json(413, { error: "Message too long" });
  const turns: Turn[] = history
    .slice(-MESSAGES_LIMITS.maxTurns)
    .filter((t): t is Turn => !!t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
    .map((t) => ({ role: t.role, content: t.content.slice(0, MESSAGES_LIMITS.maxChars) }));
  const last = turns[turns.length - 1];
  if (!last || last.role !== "user" || !last.content.trim()) return json(400, { error: "Last turn must be the visitor's" });

  let lastError = "";
  for (const model of CHAT_MODELS) {
    try {
      const res = await fetch(`${GROQ_API_URL}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: MESSAGES_SYSTEM_PROMPT }, ...turns],
          temperature: 0.5,
          reasoning_effort: model.startsWith("qwen") ? "none" : "low",
          max_tokens: 700
        })
      });
      if (res.ok) {
        const data = await res.json();
        const reply = plain(String(data?.choices?.[0]?.message?.content ?? ""));
        if (reply) return json(200, { reply });
        lastError = `${model}: empty reply`;
      } else lastError = `${model}: ${res.status}`;
    } catch (err) {
      lastError = `${model}: ${(err as Error).message}`;
    }
  }
  return json(502, { error: `All models failed (${lastError})` });
}
