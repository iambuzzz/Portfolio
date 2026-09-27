import React from "react";
import { useStore } from "~/stores";

const SPOTIFY_URL = import.meta.env.VITE_SPOTIFY_URL ?? "https://spotify-clone-xi-one-47.vercel.app";

export default function Spotify() {
  const dark = useStore((state) => state.dark);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        fontFamily:
          "'SF Pro Text', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Inter', 'Helvetica Neue', sans-serif",
        backgroundColor: dark ? "#000000" : "#ffffff",
      }}
    >
      <iframe
        src={SPOTIFY_URL}
        title="Spotify"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          backgroundColor: "transparent",
        }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}