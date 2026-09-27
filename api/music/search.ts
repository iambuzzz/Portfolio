import { guard, json } from "../_lib/guard";

export const config = { runtime: "edge" };

// YouTube Data API proxy for the Spotify app.
//   GET /api/music/search?q=faded  → search (100 quota units)
//   GET /api/music/search          → trending music in India (1 unit)
// Responses are cached on Vercel's CDN, so repeated queries cost nothing.

const YT = "https://www.googleapis.com/youtube/v3";

interface YtVideo {
  id: string;
  snippet: { title: string; channelTitle: string; thumbnails: Record<string, { url: string }> };
  contentDetails?: { duration: string };
  status?: { embeddable: boolean };
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

// ISO 8601 duration (PT3M42S) → seconds
const seconds = (iso = "") => {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return m ? +(m[1] ?? 0) * 3600 + +(m[2] ?? 0) * 60 + +(m[3] ?? 0) : 0;
};

const toTrack = (v: YtVideo) => ({
  id: v.id,
  title: decode(v.snippet.title),
  channel: decode(v.snippet.channelTitle).replace(/ - Topic$/, ""),
  thumbnail: (v.snippet.thumbnails.high ?? v.snippet.thumbnails.medium ?? v.snippet.thumbnails.default).url,
  duration: seconds(v.contentDetails?.duration)
});

async function videos(key: string, params: Record<string, string>): Promise<YtVideo[]> {
  const qs = new URLSearchParams({ key, part: "snippet,contentDetails,status", ...params });
  const res = await fetch(`${YT}/videos?${qs}`);
  if (!res.ok) throw new Error(`videos ${res.status}`);
  const data = (await res.json()) as { items: YtVideo[] };
  return data.items.filter((v) => v.status?.embeddable !== false);
}

export default async function handler(req: Request): Promise<Response> {
  const blocked = guard(req, "GET");
  if (blocked) return blocked;

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return json(503, { error: "Music search is not configured." });

  const q = new URL(req.url).searchParams.get("q")?.trim().toLowerCase().slice(0, 100) ?? "";

  try {
    if (!q) {
      const items = await videos(key, { chart: "mostPopular", videoCategoryId: "10", regionCode: "IN", maxResults: "30" });
      return json(200, { tracks: items.map(toTrack) }, "public, s-maxage=21600, stale-while-revalidate=86400");
    }

    const sqs = new URLSearchParams({
      key,
      part: "id",
      type: "video",
      q,
      maxResults: "20",
      videoEmbeddable: "true",
      videoCategoryId: "10",
      safeSearch: "moderate"
    });
    const sres = await fetch(`${YT}/search?${sqs}`);
    if (sres.status === 403) return json(429, { error: "Daily search limit reached. Try again tomorrow." }, "public, s-maxage=600");
    if (!sres.ok) throw new Error(`search ${sres.status}`);
    const ids = ((await sres.json()) as { items: { id: { videoId: string } }[] }).items.map((i) => i.id.videoId);
    const items = ids.length ? await videos(key, { id: ids.join(",") }) : [];
    // Keep YouTube's relevance order
    const byId = new Map(items.map((v) => [v.id, v]));
    const tracks = ids.map((id) => byId.get(id)).filter(Boolean).map((v) => toTrack(v as YtVideo));
    return json(200, { tracks }, "public, s-maxage=86400, stale-while-revalidate=604800");
  } catch (err) {
    return json(502, { error: `YouTube request failed (${(err as Error).message})` });
  }
}
