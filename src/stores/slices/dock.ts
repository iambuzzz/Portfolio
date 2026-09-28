import type { StateCreator } from "zustand";

export interface DockSlice {
  dockSize: number;
  dockMag: number;
  setDockSize: (v: number) => void;
  setDockMag: (v: number) => void;
}

const load = (key: string, fallback: number) => {
  try {
    const v = localStorage.getItem(`macos-settings-${key}`);
    return v !== null ? Number(JSON.parse(v)) || fallback : fallback;
  } catch {
    return fallback;
  }
};
const save = (key: string, v: number) => {
  try {
    localStorage.setItem(`macos-settings-${key}`, JSON.stringify(v));
  } catch {
    // storage blocked
  }
};

// Saved so Settings › Desktop & Dock survives a reload.
export const createDockSlice: StateCreator<DockSlice> = (set) => ({
  dockSize: load("dockSize", 50),
  dockMag: load("dockMag", 2),
  setDockSize: (v) => {
    save("dockSize", v);
    set(() => ({ dockSize: v }));
  },
  setDockMag: (v) => {
    save("dockMag", v);
    set(() => ({ dockMag: v }));
  }
});
