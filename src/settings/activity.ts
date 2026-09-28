import { create } from "zustand";
import { persist } from "zustand/middleware";

// Screen Time & Achievements: a visitor's own activity on the portfolio.
// Stored only in their browser; nothing is sent anywhere.

export interface Achievement {
  id: string;
  title: string;
  emoji: string;
  /** Shown before it's unlocked. */
  hint: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "hello", title: "Hello, World", emoji: "👋", hint: "Visit the portfolio" },
  { id: "explorer", title: "Explorer", emoji: "🧭", hint: "Open 5 different apps" },
  { id: "completionist", title: "Completionist", emoji: "🗺️", hint: "Open every app" },
  { id: "root", title: "Root Access", emoji: "🔑", hint: "Try sudo in Terminal…" },
  { id: "chaos", title: "Chaos Engineer", emoji: "💥", hint: "Do the one thing you should never do in a terminal" },
  { id: "neo", title: "Neo", emoji: "🕶️", hint: "Enter the Matrix" },
  { id: "secrets", title: "Secret Keeper", emoji: "🤫", hint: "Find the hidden file" },
  { id: "snake", title: "Snake Charmer", emoji: "🐍", hint: "Score 100+ in snake" },
  { id: "typist", title: "Speed Demon", emoji: "⌨️", hint: "Type 50+ WPM in the typing test" },
  { id: "superfan", title: "Superfan", emoji: "🧠", hint: "Get 5/5 in the quiz" },
  { id: "dj", title: "DJ", emoji: "🎧", hint: "Play a song" },
  { id: "siri", title: "Hey Siri", emoji: "🔮", hint: "Ask Siri a question" },
  { id: "cheese", title: "Say Cheese", emoji: "📸", hint: "Take a photo in FaceTime" },
  { id: "mail", title: "Message Sent", emoji: "📨", hint: "Send Ambuj a message" },
  { id: "night", title: "Night Owl", emoji: "🌙", hint: "Switch to dark mode" },
  { id: "decorator", title: "Interior Designer", emoji: "🖼️", hint: "Change the wallpaper" },
  { id: "resume", title: "Paper Trail", emoji: "📄", hint: "Download the résumé" }
];

interface ActivityState {
  firstVisit: number;
  visits: number;
  seconds: number; // total time spent (tab visible)
  appOpens: Record<string, number>;
  unlocked: Record<string, number>; // id → timestamp
  recordAppOpen: (id: string, totalApps: number) => void;
  tick: (s: number) => void;
  unlock: (id: string) => void;
  reset: () => void;
}

export const useActivity = create<ActivityState>()(
  persist(
    (set, get) => ({
      firstVisit: Date.now(),
      visits: 0,
      seconds: 0,
      appOpens: {},
      unlocked: {},
      recordAppOpen: (id, totalApps) => {
        const appOpens = { ...get().appOpens, [id]: (get().appOpens[id] ?? 0) + 1 };
        set({ appOpens });
        const distinct = Object.keys(appOpens).length;
        if (distinct >= 5) get().unlock("explorer");
        if (distinct >= totalApps) get().unlock("completionist");
      },
      tick: (s) => set((st) => ({ seconds: st.seconds + s })),
      unlock: (id) => {
        if (get().unlocked[id] || !ACHIEVEMENTS.some((a) => a.id === id)) return;
        set((st) => ({ unlocked: { ...st.unlocked, [id]: Date.now() } }));
        window.dispatchEvent(new CustomEvent("achievement:unlocked", { detail: id }));
      },
      reset: () => set({ firstVisit: Date.now(), visits: 1, seconds: 0, appOpens: {}, unlocked: {} })
    }),
    { name: "macos-activity", partialize: ({ recordAppOpen: _a, tick: _t, unlock: _u, reset: _r, ...rest }) => rest }
  )
);

/** Unlock from anywhere (Terminal, Siri, apps). */
export const unlock = (id: string) => useActivity.getState().unlock(id);
