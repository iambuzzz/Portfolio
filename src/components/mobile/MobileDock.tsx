import React from "react";
import { apps } from "~/configs";
import { useStore } from "~/stores";

export default function MobileDock({ openApp }: { openApp: (id: string) => void }) {
  const dockApps = ["facetime", "messages", "safari", "music"];

  const { dark, iconStyle } = useStore((s) => ({
    dark: s.dark,
    iconStyle: s.iconStyle,
  }));

  const bgClass = dark 
    ? "bg-white/20 shadow-[0_0_20px_rgba(0,0,0,0.2)]" 
    : "bg-white/40 shadow-[0_0_20px_rgba(0,0,0,0.1)]";

  return (
    <div className="fixed bottom-6 left-0 right-0 flex justify-center z-40 pointer-events-none px-4">
      <div 
        className={`pointer-events-auto flex items-center justify-around w-full max-w-[380px] h-[84px] px-2 rounded-[32px] backdrop-blur-3xl saturate-[2] ${bgClass}`}
      >
        {dockApps.map((id) => {
          const app = apps.find((a) => a.id === id);
          if (!app) return null;
          return (
            <div 
              key={id} 
              className="flex flex-col items-center justify-center cursor-pointer active:opacity-70 transition-opacity"
              onClick={() => openApp(id)}
            >
              <img 
                src={`/${app.img}`} 
                alt={app.title} 
                className="w-[58px] h-[58px] object-cover rounded-[14px]"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
