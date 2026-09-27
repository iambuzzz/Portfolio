import type { StateCreator } from "zustand";

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
      title: "Welcome back",
      message: "Your macOS portfolio is ready.",
      app: "Finder",
      icon: "img/icons/finder.png",
      timestamp: Date.now() - 1000 * 60 * 5,
      read: false,
    },
    {
      id: "n2",
      title: "New message",
      message: "Hey! Check out the new features in the portfolio.",
      app: "Messages",
      icon: "img/icons/messages.png",
      timestamp: Date.now() - 1000 * 60 * 30,
      read: false,
    },
    {
      id: "n3",
      title: "Calendar",
      message: "Meeting with team at 3:00 PM",
      app: "Calendar",
      icon: "img/icons/calendar.png",
      timestamp: Date.now() - 1000 * 60 * 60,
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
