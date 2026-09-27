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
