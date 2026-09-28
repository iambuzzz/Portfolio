import type { Track } from "~/stores/music";

// JioSaavn catalogue through our own /api/music function (see api/music.ts),
// which also resolves each song's stream URL. Songs stream straight from
// JioSaavn's CDN.

/** JioSaavn's editorial "Trending Today" playlist. */
export const TRENDING_PLAYLIST = "110858205";

async function get(query: string): Promise<Track[]> {
  let res: Response;
  try {
    res = await fetch(`/api/music?${query}`);
  } catch {
    throw new Error("Couldn't reach the music service. Check your connection and try again.");
  }
  const body = await res.json().catch(() => null);
  if (res.status === 429) throw new Error("Too many requests, try again in a minute.");
  if (!res.ok || !Array.isArray(body?.tracks)) throw new Error("The music service is unavailable right now. Please try again later.");
  return body.tracks as Track[];
}

const cache = new Map<string, Promise<Track[]>>();
const cached = (key: string, load: () => Promise<Track[]>) => {
  if (!cache.has(key)) cache.set(key, load().catch((e) => (cache.delete(key), Promise.reject(e))));
  return cache.get(key)!;
};

export const searchSongs = (query: string) => {
  const q = query.trim().toLowerCase();
  return cached(`s:${q}`, () => get(`search=${encodeURIComponent(q)}`));
};

export const playlistSongs = (id: string) => cached(`p:${id}`, () => get(`playlist=${id}`));

export async function fetchSong(id: string): Promise<Track | null> {
  return (await get(`song=${encodeURIComponent(id)}`))[0] ?? null;
}
