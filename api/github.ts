import { guard, json } from "./_lib/guard";
import { profile } from "../src/data/profile";

export const config = { runtime: "edge" };

// GitHub stats for the desktop widget, cached on Vercel's CDN for an hour so
// all visitors share one response (unauthenticated GitHub allows 60 req/hour
// per IP). Optional GITHUB_TOKEN raises the limit further.
export default async function handler(req: Request): Promise<Response> {
  const blocked = guard(req, "GET");
  if (blocked) return blocked;

  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "portfolio" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const user = profile.handle;
  const [u, r] = await Promise.all([
    fetch(`https://api.github.com/users/${user}`, { headers }),
    fetch(`https://api.github.com/users/${user}/repos?sort=pushed&per_page=4`, { headers })
  ]);
  if (!u.ok || !r.ok) return json(502, { error: "GitHub unavailable" }, "public, s-maxage=300");

  const me = (await u.json()) as { avatar_url: string; public_repos: number; followers: number };
  const repos = (await r.json()) as { name: string; html_url: string; language: string | null; pushed_at: string }[];
  return json(
    200,
    {
      avatar: me.avatar_url,
      repos: me.public_repos,
      followers: me.followers,
      recent: repos.map((x) => ({ name: x.name, url: x.html_url, language: x.language, pushed: x.pushed_at }))
    },
    "public, s-maxage=3600, stale-while-revalidate=86400"
  );
}
