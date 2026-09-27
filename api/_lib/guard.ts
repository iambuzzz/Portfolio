// Shared protections for the Groq proxy: same-origin only, per-IP rate limit.
// The limiter is in-memory, so it is per edge instance (best effort). Swap in
// Upstash Redis if the site ever gets abused.

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 12;
const hits = new Map<string, number[]>();

export const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });

export function guard(req: Request): Response | null {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  // Browsers always send Origin on cross-site POSTs; reject other sites.
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return json(403, { error: "Forbidden" });
  }

  const ip =
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) {
    return json(429, { error: "Too many requests, try again in a minute." });
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();

  return null;
}

export function groqKey(): string | null {
  return process.env.GROQ_API_KEY || null;
}

export const GROQ_API_URL = "https://api.groq.com/openai/v1";
