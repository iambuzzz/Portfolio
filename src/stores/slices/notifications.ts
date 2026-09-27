import type { StateCreator } from "zustand";
import { profile } from "~/data/profile";

export interface Notification {
  id: string;
  title: string;
  message: string;
  app: string;
  icon: string;
  timestamp: number;
  read: boolean;
}

export interface NotificationsSlice {
  notifications: Notification[];
  doNotDisturb: boolean;
  pushNotification: (n: Omit<Notification, "id" | "timestamp" | "read">) => void;
  dismissNotification: (id: string) => void;
  clearAllNotifications: () => void;
  toggleDND: () => void;
}

export const createNotificationsSlice: StateCreator<NotificationsSlice> = (set) => ({
  notifications: [
    {
      id: "n1",
      title: `Hi, I'm ${profile.firstName} 👋`,
      message: "Explore my projects in Launchpad, or ask Siri anything about me.",
      app: "Messages",
      icon: "img/icons/messages.png",
      timestamp: Date.now() - 1000 * 60 * 2,
      read: false,
    },
    {
      id: "n2",
      title: "Tip",
      message: "Press ⌘/Ctrl + Space for Spotlight. Right-click the desktop to edit widgets.",
      app: "Finder",
      icon: "img/icons/finder.png",
      timestamp: Date.now() - 1000 * 60 * 10,
      read: false,
    },
    {
      id: "n3",
      title: "Résumé",
      message: "My résumé and certificates are in Finder › Documents.",
      app: "Finder",
      icon: "img/icons/finder.png",
      timestamp: Date.now() - 1000 * 60 * 30,
      read: true,
    },
  ],
  doNotDisturb: false,
  pushNotification: (n) =>
    set((state) => ({
      notifications: [
        {
          ...n,
          id: `n-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          timestamp: Date.now(),
          read: false,
        },
        ...state.notifications,
      ],
    })),
  dismissNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
  clearAllNotifications: () => set(() => ({ notifications: [] })),
  toggleDND: () => set((state) => ({ doNotDisturb: !state.doNotDisturb })),
});
