import { guard, json } from "./_lib/guard";

export const config = { runtime: "edge" };

// Safari asks this before loading a page in its iframe: many sites (Google,
// GitHub, YouTube…) forbid being embedded, which would otherwise show a blank
// page. Only response headers are read; the page body is never returned.

const PRIVATE_HOST = /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|.*\.local$|.*\.internal$)/i;

function embeddable(headers: Headers): boolean {
  const xfo = headers.get("x-frame-options")?.toLowerCase() ?? "";
  if (xfo.includes("deny") || xfo.includes("sameorigin")) return false;
  const csp = headers.get("content-security-policy") ?? "";
  const fa = csp
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.toLowerCase().startsWith("frame-ancestors"));
  if (!fa) return true;
  // Only an explicit wildcard lets any site (including this one) embed it.
  return fa.split(/\s+/).slice(1).includes("*");
}

export default async function handler(req: Request): Promise<Response> {
  const blocked = guard(req, "GET");
  if (blocked) return blocked;

  let target: URL;
  try {
    target = new URL(new URL(req.url).searchParams.get("url") ?? "");
  } catch {
    return json(400, { error: "Invalid URL" });
  }
  if (!/^https?:$/.test(target.protocol) || PRIVATE_HOST.test(target.hostname)) return json(400, { error: "URL not allowed" });

  try {
    const res = await fetch(target, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" },
      signal: AbortSignal.timeout(6000)
    });
    await res.body?.cancel();
    return json(200, { embeddable: embeddable(res.headers), status: res.status }, "public, s-maxage=86400, stale-while-revalidate=604800");
  } catch {
    // Unreachable: let the browser try, it will show its own error.
    return json(200, { embeddable: true, unreachable: true }, "public, s-maxage=300");
  }
}
