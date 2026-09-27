import React, { createContext, useContext, ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMusicStore } from "~/stores/music";

// Thin adapter so the menu bar, Control Center, Dynamic Island and Siri keep a
// simple play/pause/volume API. The actual player is the Spotify app.
interface AudioContextType {
  audioState: { playing: boolean; volume: number };
  controls: {
    play: () => void;
    pause: () => void;
    toggle: (play?: boolean) => void;
    volume: (value: number) => void;
  };
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { playing, volume, toggle, setVolume } = useMusicStore(
    useShallow((s) => ({ playing: s.playing, volume: s.volume, toggle: s.toggle, setVolume: s.setVolume }))
  );

  const value: AudioContextType = {
    audioState: { playing, volume: volume / 100 },
    controls: {
      play: () => toggle(true),
      pause: () => toggle(false),
      toggle: (play?: boolean) => toggle(play),
      volume: (v: number) => setVolume(Math.round(v * 100))
    }
  };

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
};

export const useAudioContext = () => {
  const context = useContext(AudioContext);
  if (!context) throw new Error("useAudioContext must be used within an AudioProvider");
  return context;
};
