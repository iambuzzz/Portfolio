import { create } from "zustand";
import { createDockSlice, type DockSlice } from "./slices/dock";
import { createSystemSlice, type SystemSlice } from "./slices/system";
import { createUserSlice, type UserSlice } from "./slices/user";
import { createSettingsSlice, type SettingsSlice } from "./slices/settings";
import { createNotificationsSlice, type NotificationsSlice } from "./slices/notifications";

export const useStore = create<DockSlice & SystemSlice & UserSlice & SettingsSlice & NotificationsSlice>(
  (...a) => ({
    ...createDockSlice(...a),
    ...createSystemSlice(...a),
    ...createUserSlice(...a),
    ...createSettingsSlice(...a),
    ...createNotificationsSlice(...a),
  })
);

/** Active wallpaper set; re-renders the caller when the wallpaper changes. */
export const useWallpaper = () =>
  useStore((s) => s.wallpaperSets.find((w) => w.id === s.activeWallpaperSet) ?? s.wallpaperSets[0]);
