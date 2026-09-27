import { create } from "zustand";
import { persist } from "zustand/middleware";

export type WidgetKind = "calendar" | "weather" | "github" | "clock" | "battery";

export interface PlacedWidget {
  id: WidgetKind;
  x: number;
  y: number;
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

interface WidgetState {
  widgets: PlacedWidget[];
  galleryOpen: boolean;
  moveWidget: (id: WidgetKind, x: number, y: number) => void;
  removeWidget: (id: WidgetKind) => void;
  addWidget: (id: WidgetKind) => void;
  resetWidgets: () => void;
  setGalleryOpen: (open: boolean) => void;
}

export const useWidgetStore = create<WidgetState>()(
  persist(
    (set) => ({
      widgets: DEFAULT_WIDGETS,
      galleryOpen: false,
      moveWidget: (id, x, y) =>
        set((s) => ({ widgets: s.widgets.map((w) => (w.id === id ? { ...w, x, y } : w)) })),
      removeWidget: (id) => set((s) => ({ widgets: s.widgets.filter((w) => w.id !== id) })),
      addWidget: (id) =>
        set((s) => {
          if (s.widgets.some((w) => w.id === id)) return s;
          // Cascade new widgets so they don't land exactly on top of each other.
          const n = s.widgets.length;
          return { widgets: [...s.widgets, { id, x: 16 + (n % 4) * 216, y: 48 + Math.floor(n / 4) * 220 }] };
        }),
      resetWidgets: () => set({ widgets: DEFAULT_WIDGETS }),
      setGalleryOpen: (galleryOpen) => set({ galleryOpen })
    }),
    {
      name: "macos-widgets",
      partialize: (s) => ({ widgets: s.widgets })
    }
  )
);
