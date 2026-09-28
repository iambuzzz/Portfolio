import { guard, json } from "./_lib/guard";
import { desDecrypt } from "./_lib/des";

export const config = { runtime: "edge" };

// JioSaavn catalogue for Spotify, Siri and the terminal, straight from
// JioSaavn's web API (the free public mirrors run out of daily quota).
// Responses are cached on Vercel's CDN, so repeat searches cost nothing.
//   /api/music?search=<query>   /api/music?playlist=<id>   /api/music?song=<id>

const BASE = "https://www.jiosaavn.com/api.php?_format=json&_marker=0&api_version=4&ctx=web6dot0";
// JioSaavn's own web player key for the stream URLs.
const MEDIA_KEY = "38346591";

interface RawSong {
  id: string;
  title: string;
  image: string;
  more_info?: {
    duration?: string;
    encrypted_media_url?: string;
    artistMap?: { primary_artists?: { name: string }[] };
  };
}

const ENTITIES: Record<string, string> = { amp: "&", quot: '"', "#039": "'", apos: "'", lt: "<", gt: ">" };
const decode = (s = "") => s.replace(/&(amp|quot|#039|apos|lt|gt);/g, (_, e: string) => ENTITIES[e]);

function toTrack(s: RawSong) {
  const enc = s.more_info?.encrypted_media_url;
  if (!enc) return null;
  let url: string;
  try {
    // 160kbps is plenty in a browser and loads twice as fast as 320.
    url = desDecrypt(enc, MEDIA_KEY).replace(/_96\.mp4$/, "_160.mp4").replace(/^http:/, "https:");
  } catch {
    return null;
  }
  if (!url.startsWith("https://")) return null;
  const image = (s.image ?? "").replace(/^http:/, "https:");
  return {
    id: s.id,
    title: decode(s.title),
    artist: decode((s.more_info?.artistMap?.primary_artists ?? []).map((a) => a.name).join(", ")) || "Unknown artist",
    thumbnail: image,
    cover: image.replace(/\d+x\d+(?=\.\w+$)/, "500x500"),
    duration: Number(s.more_info?.duration) || undefined,
    url
  };
}

export default async function handler(req: Request): Promise<Response> {
  const blocked = guard(req, "GET", 40);
  if (blocked) return blocked;

  const params = new URL(req.url).searchParams;
  const search = params.get("search")?.trim().slice(0, 100);
  const playlist = params.get("playlist");
  const song = params.get("song");

  let call: string;
  let pick: (d: any) => RawSong[];
  if (search) {
    call = `__call=search.getResults&n=30&p=1&q=${encodeURIComponent(search)}`;
    pick = (d) => d.results;
  } else if (playlist && /^\d+$/.test(playlist)) {
    call = `__call=playlist.getDetails&n=30&p=1&listid=${playlist}`;
    pick = (d) => d.list;
  } else if (song && /^[\w-]+$/.test(song)) {
    call = `__call=song.getDetails&pids=${song}`;
    pick = (d) => d.songs;
  } else {
    return json(400, { error: "Pass search, playlist or song" });
  }

  try {
    const res = await fetch(`${BASE}&${call}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) throw new Error(String(res.status));
    const list = pick(await res.json());
    const tracks = (Array.isArray(list) ? list : []).map(toTrack).filter(Boolean);
    // Trending changes daily; searches and songs barely ever.
    return json(200, { tracks }, `public, s-maxage=${playlist ? 3600 : 86400}, stale-while-revalidate=604800`);
  } catch {
    return json(502, { error: "Music service unavailable" }, "public, s-maxage=60");
  }
}
