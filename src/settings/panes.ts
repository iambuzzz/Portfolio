// @unocss-include (icon classes below are only referenced from this .ts file)
// Settings sidebar entries. Shared by System Settings and Spotlight.
export interface PaneInfo {
  id: string;
  label: string;
  icon: string;
  color: string;
  keywords: string;
}

export const PANE_GROUPS: PaneInfo[][] = [
  [
    { id: "appearance", label: "Appearance", icon: "i-ph:circle-half-fill", color: "#1c1c1e", keywords: "dark light mode theme accent colour color icon tint" },
    { id: "wallpaper", label: "Wallpaper", icon: "i-ph:image-fill", color: "#34aadc", keywords: "background desktop picture" },
    { id: "desktop", label: "Desktop & Dock", icon: "i-ph:app-window-fill", color: "#1c1c1e", keywords: "dock size magnification hide widgets calendar weather github clock battery" },
    { id: "displays", label: "Displays", icon: "i-ph:monitor-fill", color: "#007aff", keywords: "brightness night shift warm screen" },
    { id: "sound", label: "Sound", icon: "i-ph:speaker-high-fill", color: "#ff2d55", keywords: "volume music effects chime" }
  ],
  [
    { id: "siri", label: "Siri", icon: "i-ph:microphone-fill", color: "#af52de", keywords: "voice speak listen ai assistant rate" },
    { id: "accessibility", label: "Accessibility", icon: "i-ph:person-simple-circle-fill", color: "#007aff", keywords: "reduce motion animation transparency blur performance" },
    { id: "screen-time", label: "Screen Time", icon: "i-ph:hourglass-medium-fill", color: "#5856d6", keywords: "achievements trophies usage time apps easter eggs" }
  ],
  [
    { id: "privacy", label: "Privacy & Data", icon: "i-ph:hand-fill", color: "#007aff", keywords: "storage delete clear cookies camera microphone services" },
    { id: "share", label: "Share", icon: "i-ph:share-network-fill", color: "#34c759", keywords: "qr code link copy whatsapp linkedin" }
  ],
  [
    { id: "general", label: "General", icon: "i-ph:gear-fill", color: "#8e8e93", keywords: "recruiter mode startup login keyboard shortcuts reset" },
    { id: "about", label: "About", icon: "i-ph:info-fill", color: "#8e8e93", keywords: "version build what's new update tech stack" }
  ]
];
