import { create } from "zustand";
import { persist } from "zustand/middleware";

export type WidgetKind = "calendar" | "weather" | "github" | "clock" | "battery";

export interface PlacedWidget {
  id: WidgetKind;
  x: number;
  y: number;
  /** Changes every time the widget is added, so a re-added widget never reuses a copy that is still animating out. */
  key?: number;
}

export const WIDGET_CATALOG: { id: WidgetKind; name: string; description: string }[] = [
  { id: "calendar", name: "Calendar", description: "This month at a glance" },
  { id: "weather", name: "Weather", description: "Live weather and local time in Kota" },
  { id: "github", name: "GitHub", description: "Live repos, followers and recent activity" },
  { id: "clock", name: "Clock", description: "Analog clock" },
  { id: "battery", name: "Batteries", description: "Your device's battery level" }
];

// Default layout: Calendar + Weather in the top-left, like the Tahoe desktop.
const DEFAULT_WIDGETS: PlacedWidget[] = [
  { id: "calendar", x: 16, y: 48 },
  { id: "weather", x: 232, y: 48 },
  { id: "github", x: 448, y: 48 }
];

// Rendered sizes (px), used before a widget is on screen to measure.
const SIZE: Record<WidgetKind, [number, number]> = {
  calendar: [200, 190],
  weather: [200, 214],
  github: [220, 192],
  clock: [216, 80],
  battery: [138, 57]
};
const GAP = 16;
const TOP = 48;
const DOCK_CLEARANCE = 90;

type Rect = { x: number; y: number; w: number; h: number };

const sizeOf = (id: WidgetKind): [number, number] => {
  const el = document.querySelector<HTMLElement>(`[data-widget="${id}"]`);
  return el && el.offsetWidth ? [el.offsetWidth, el.offsetHeight] : SIZE[id];
};

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP && a.y < b.y + b.h + GAP && b.y < a.y + a.h + GAP;

/**
 * Nearest spot to (x, y) where `id` doesn't overlap any of `others`.
 * With `scan`, it takes the first free spot reading left→right, top→bottom instead.
 */
export function freeSpot(id: WidgetKind, others: PlacedWidget[], x: number, y: number, scan = false) {
  const [w, h] = sizeOf(id);
  const maxX = Math.max(GAP, window.innerWidth - w - 8);
  const maxY = Math.max(TOP, window.innerHeight - h - DOCK_CLEARANCE);
  const rects = others.filter((o) => o.id !== id).map((o) => {
    const [ow, oh] = sizeOf(o.id);
    return { x: o.x, y: o.y, w: ow, h: oh };
  });
  const fits = (cx: number, cy: number) => !rects.some((r) => overlaps({ x: cx, y: cy, w, h }, r));
  const cx = Math.min(maxX, Math.max(GAP, x));
  const cy = Math.min(maxY, Math.max(TOP, y));
  if (fits(cx, cy)) return { x: cx, y: cy };
  const step = 8;
  let best: { x: number; y: number } | null = null;
  let bestScore = Infinity;
  for (let ty = TOP; ty <= maxY; ty += step) {
    for (let tx = GAP; tx <= maxX; tx += step) {
      if (!fits(tx, ty)) continue;
      if (scan) return { x: tx, y: ty };
      const d = Math.hypot(tx - cx, ty - cy);
      if (d < bestScore) {
        bestScore = d;
        best = { x: tx, y: ty };
      }
    }
  }
  // Desktop is full: fall back to where it was asked for.
  return best ?? { x: cx, y: cy };
}

interface WidgetState {
  widgets: PlacedWidget[];
  galleryOpen: boolean;
  moveWidget: (id: WidgetKind, x: number, y: number) => void;
  removeWidget: (id: WidgetKind) => void;
  addWidget: (id: WidgetKind) => void;
  resetWidgets: () => void;
  tidy: () => void;
  setGalleryOpen: (open: boolean) => void;
}

export const useWidgetStore = create<WidgetState>()(
  persist(
    (set) => ({
      widgets: DEFAULT_WIDGETS,
      galleryOpen: false,
      // Dropping onto another widget slides it to the nearest free spot.
      moveWidget: (id, x, y) =>
        set((s) => {
          const p = freeSpot(id, s.widgets, x, y);
          return { widgets: s.widgets.map((w) => (w.id === id ? { ...w, ...p } : w)) };
        }),
      removeWidget: (id) => set((s) => ({ widgets: s.widgets.filter((w) => w.id !== id) })),
      addWidget: (id) =>
        set((s) => {
          if (s.widgets.some((w) => w.id === id)) return s;
          const p = freeSpot(id, s.widgets, GAP, TOP, true);
          return { widgets: [...s.widgets, { id, ...p, key: Date.now() }] };
        }),
      resetWidgets: () => set({ widgets: DEFAULT_WIDGETS.map((w) => ({ ...w, key: Date.now() })) }),
      tidy: () =>
        set((s) => {
          // Untangle layouts saved before overlap checks existed (or after a window resize).
          const placed: PlacedWidget[] = [];
          let changed = false;
          for (const w of s.widgets) {
            const p = freeSpot(w.id, placed, w.x, w.y);
            if (p.x !== w.x || p.y !== w.y) changed = true;
            placed.push({ ...w, ...p });
          }
          return changed ? { widgets: placed } : s;
        }),
      setGalleryOpen: (galleryOpen) => set({ galleryOpen })
    }),
    {
      name: "macos-widgets",
      partialize: (s) => ({ widgets: s.widgets })
    }
  )
);
