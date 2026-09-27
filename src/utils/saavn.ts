import type { Track } from "~/stores/music";

// JioSaavn catalogue via the open-source saavn API (CORS-enabled, no key).
// Songs stream straight from JioSaavn's CDN.
const API = "https://saavn.sumit.co/api";

/** JioSaavn's editorial "Trending Today" playlist. */
export const TRENDING_PLAYLIST = "110858205";

interface Img {
  quality: string;
  url: string;
}
interface RawSong {
  id: string;
  name: string;
  duration: number | null;
  image: Img[];
  downloadUrl: Img[];
  artists?: { primary?: { name: string }[] };
}

// Names arrive HTML-escaped ("Darmiyaan (From &quot;Musafir Cafe&quot;)").
const decode = (s: string) => {
  const el = document.createElement("textarea");
  el.innerHTML = s;
  return el.value;
};

const pick = (list: Img[], quality: string) => list.find((x) => x.quality === quality)?.url ?? list[list.length - 1]?.url ?? "";

const toTrack = (s: RawSong): Track | null => {
  // 160kbps is plenty in a browser and loads twice as fast as 320.
  const url = pick(s.downloadUrl ?? [], "160kbps");
  if (!url) return null;
  return {
    id: s.id,
    title: decode(s.name),
    artist: decode((s.artists?.primary ?? []).map((a) => a.name).join(", ") || "Unknown artist"),
    thumbnail: pick(s.image ?? [], "150x150"),
    cover: pick(s.image ?? [], "500x500"),
    duration: s.duration ?? undefined,
    url
  };
};

async function get<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`);
  } catch {
    throw new Error("Couldn't reach the music service. Check your connection and try again.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) throw new Error("The music service is unavailable right now. Please try again later.");
  return body.data as T;
}

const cache = new Map<string, Promise<Track[]>>();
const cached = (key: string, load: () => Promise<Track[]>) => {
  if (!cache.has(key)) cache.set(key, load().catch((e) => (cache.delete(key), Promise.reject(e))));
  return cache.get(key)!;
};

export const searchSongs = (query: string) => {
  const q = query.trim().toLowerCase();
  return cached(`s:${q}`, async () => {
    const d = await get<{ results: RawSong[] }>(`/search/songs?query=${encodeURIComponent(q)}&limit=30`);
    return d.results.map(toTrack).filter((t): t is Track => !!t);
  });
};

export const playlistSongs = (id: string) =>
  cached(`p:${id}`, async () => {
    const d = await get<{ songs: RawSong[] }>(`/playlists?id=${id}&limit=30`);
    return d.songs.map(toTrack).filter((t): t is Track => !!t);
  });

export async function fetchSong(id: string): Promise<Track | null> {
  const d = await get<RawSong[]>(`/songs/${id}`);
  return d[0] ? toTrack(d[0]) : null;
}
