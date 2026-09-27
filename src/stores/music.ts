import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Track {
  id: string; // YouTube video id
  title: string;
  channel: string;
  thumbnail: string;
  duration?: number; // seconds
}

/** Minimal surface of the YouTube IFrame player we drive. */
export interface PlayerHandle {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
}

// The mounted YouTube player (inside the Spotify window) registers itself here.
let player: PlayerHandle | null = null;
export const registerPlayer = (p: PlayerHandle | null) => {
  player = p;
};

interface MusicState {
  queue: Track[];
  index: number;
  playing: boolean;
  position: number;
  duration: number;
  volume: number; // 0–100
  liked: Track[];
  recent: Track[];
  playQueue: (tracks: Track[], index: number) => void;
  toggle: (play?: boolean) => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleLike: (t: Track) => void;
  /** Called by the player to report its state. */
  report: (s: Partial<Pick<MusicState, "playing" | "position" | "duration">>) => void;
  /** Fill in details for the current track (e.g. title of a pasted link). */
  describeCurrent: (d: Partial<Track>) => void;
  stop: () => void;
}

export const useMusicStore = create<MusicState>()(
  persist(
    (set, get) => ({
      queue: [],
      index: 0,
      playing: false,
      position: 0,
      duration: 0,
      volume: 70,
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
          recent: [track, ...s.recent.filter((r) => r.id !== track.id)].slice(0, 20)
        }));
      },
      toggle: (play) => {
        const { queue, playing } = get();
        if (!queue.length) return;
        const target = play ?? !playing;
        if (target) player?.playVideo();
        else player?.pauseVideo();
        set({ playing: target });
      },
      next: () => {
        const { queue, index } = get();
        if (index + 1 < queue.length) get().playQueue(queue, index + 1);
        else set({ playing: false });
      },
      prev: () => {
        const { queue, index, position } = get();
        if (position > 3 || index === 0) get().seek(0);
        else get().playQueue(queue, index - 1);
      },
      seek: (seconds) => {
        player?.seekTo(seconds, true);
        set({ position: seconds });
      },
      setVolume: (v) => {
        player?.setVolume(v);
        set({ volume: v });
      },
      toggleLike: (t) =>
        set((s) => ({
          liked: s.liked.some((l) => l.id === t.id) ? s.liked.filter((l) => l.id !== t.id) : [t, ...s.liked]
        })),
      report: (s) => set(s),
      describeCurrent: (d) =>
        set((s) => {
          const cur = s.queue[s.index];
          if (!cur) return s;
          const updated = { ...cur, ...d };
          const queue = s.queue.map((t, i) => (i === s.index ? updated : t));
          return { queue, recent: s.recent.map((t) => (t.id === cur.id ? updated : t)) };
        }),
      stop: () => set({ playing: false })
    }),
    {
      name: "macos-music",
      partialize: (s) => ({ liked: s.liked, recent: s.recent, volume: s.volume })
    }
  )
);

/** Current track, or null when nothing is loaded. */
export const useCurrentTrack = () => useMusicStore((s) => s.queue[s.index] ?? null);

/** Display info for "Now Playing" widgets (Control Center, Dynamic Island). */
export const useNowPlaying = () => {
  const t = useCurrentTrack();
  return t
    ? { title: t.title, artist: t.channel, cover: t.thumbnail, active: true }
    : { title: "Not Playing", artist: "Open Spotify to play music", cover: "/img/icons/spotify.png", active: false };
};
