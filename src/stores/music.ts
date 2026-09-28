import { create } from "zustand";
import { persist } from "zustand/middleware";
import { fetchSong } from "~/utils/saavn";
import { unlock } from "~/settings/activity";

export interface Track {
  id: string; // JioSaavn song id
  title: string;
  artist: string;
  thumbnail: string; // small cover (lists)
  cover: string; // large cover (now playing)
  duration?: number; // seconds
  url: string; // audio stream
}

// One shared <audio> element, created on first play. Keeping it outside React
// means the menu bar, Control Center and Siri all drive the same player.
let audio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = "auto";
  const { report } = useMusicStore.getState();
  audio.addEventListener("play", () => report({ playing: true, error: "" }));
  audio.addEventListener("pause", () => report({ playing: false }));
  audio.addEventListener("timeupdate", () => report({ position: audio!.currentTime }));
  audio.addEventListener("loadedmetadata", () => report({ duration: audio!.duration }));
  audio.addEventListener("ended", () => useMusicStore.getState().next());
  audio.addEventListener("error", () => useMusicStore.getState().recover());
  return audio;
}

// Lock screen / keyboard media keys.
function updateMediaSession(t: Track) {
  if (!("mediaSession" in navigator)) return;
  const s = useMusicStore.getState;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: t.title,
    artist: t.artist,
    artwork: [{ src: t.cover, sizes: "500x500", type: "image/jpeg" }]
  });
  navigator.mediaSession.setActionHandler("play", () => s().toggle(true));
  navigator.mediaSession.setActionHandler("pause", () => s().toggle(false));
  navigator.mediaSession.setActionHandler("nexttrack", () => s().next());
  navigator.mediaSession.setActionHandler("previoustrack", () => s().prev());
}

function load(t: Track) {
  const a = getAudio();
  a.src = t.url;
  a.volume = useMusicStore.getState().volume / 100;
  a.play().catch(() => {
    // Autoplay blocked or source failed; "error" handler covers the latter.
    useMusicStore.getState().report({ playing: false });
  });
  updateMediaSession(t);
}

interface MusicState {
  queue: Track[];
  index: number;
  playing: boolean;
  position: number;
  duration: number;
  volume: number; // 0–100
  shuffle: boolean;
  repeat: boolean;
  error: string;
  liked: Track[];
  recent: Track[];
  playQueue: (tracks: Track[], index: number) => void;
  toggle: (play?: boolean) => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleLike: (t: Track) => void;
  /** Called by the audio element to report its state. */
  report: (s: Partial<Pick<MusicState, "playing" | "position" | "duration" | "error">>) => void;
  /** Stream failed: refresh its URL once, otherwise skip the song. */
  recover: () => void;
  stop: () => void;
}

const retried = new Set<string>();

export const useMusicStore = create<MusicState>()(
  persist(
    (set, get) => ({
      queue: [],
      index: 0,
      playing: false,
      position: 0,
      duration: 0,
      volume: 70,
      shuffle: false,
      repeat: false,
      error: "",
      liked: [],
      recent: [],
      playQueue: (tracks, index) => {
        const track = tracks[index];
        if (!track) return;
        set((s) => ({
          queue: tracks,
          index,
          position: 0,
          duration: track.duration ?? 0,
          playing: true,
          error: "",
          recent: [track, ...s.recent.filter((r) => r.id !== track.id)].slice(0, 20)
        }));
        load(track);
        unlock("dj");
      },
      toggle: (play) => {
        const { queue, index, playing } = get();
        const track = queue[index];
        if (!track) return;
        const target = play ?? !playing;
        const a = getAudio();
        if (target) {
          if (!a.src) load(track);
          else a.play().catch(() => set({ playing: false }));
        } else a.pause();
        set({ playing: target });
      },
      next: () => {
        const { queue, index, shuffle, repeat } = get();
        if (!queue.length) return;
        if (shuffle && queue.length > 1) {
          let i = index;
          while (i === index) i = Math.floor(Math.random() * queue.length);
          get().playQueue(queue, i);
        } else if (index + 1 < queue.length) get().playQueue(queue, index + 1);
        else if (repeat) get().playQueue(queue, 0);
        else set({ playing: false, position: 0 });
      },
      prev: () => {
        const { queue, index, position } = get();
        if (position > 3 || index === 0) get().seek(0);
        else get().playQueue(queue, index - 1);
      },
      seek: (seconds) => {
        if (audio) audio.currentTime = seconds;
        set({ position: seconds });
      },
      setVolume: (v) => {
        if (audio) audio.volume = v / 100;
        set({ volume: v });
      },
      toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
      toggleRepeat: () => set((s) => ({ repeat: !s.repeat })),
      toggleLike: (t) =>
        set((s) => ({
          liked: s.liked.some((l) => l.id === t.id) ? s.liked.filter((l) => l.id !== t.id) : [t, ...s.liked]
        })),
      report: (s) => set(s),
      recover: async () => {
        const { queue, index } = get();
        const track = queue[index];
        if (!track) return;
        if (!retried.has(track.id)) {
          retried.add(track.id);
          const fresh = await fetchSong(track.id).catch(() => null);
          if (fresh && get().queue[get().index]?.id === track.id) {
            const q = get().queue.map((t, i) => (i === get().index ? fresh : t));
            set({ queue: q });
            load(fresh);
            return;
          }
        }
        set({ error: "This song can't be played right now — skipping.", playing: false });
        setTimeout(() => get().next(), 1200);
      },
      stop: () => {
        audio?.pause();
        set({ playing: false });
      }
    }),
    {
      name: "macos-music",
      version: 2,
      // v1 stored YouTube tracks, which this player can't play.
      migrate: (old: any, version) => (version < 2 ? { volume: old?.volume ?? 70 } : old),
      partialize: (s) => ({ liked: s.liked, recent: s.recent, volume: s.volume, shuffle: s.shuffle, repeat: s.repeat })
    }
  )
);

/** Current track, or null when nothing is loaded. */
export const useCurrentTrack = () => useMusicStore((s) => s.queue[s.index] ?? null);

/** Display info for "Now Playing" widgets (Control Center, Dynamic Island). */
export const useNowPlaying = () => {
  const t = useCurrentTrack();
  return t
    ? { title: t.title, artist: t.artist, cover: t.thumbnail, active: true }
    : { title: "Not Playing", artist: "Open Spotify to play music", cover: "/img/icons/spotify.png", active: false };
};
