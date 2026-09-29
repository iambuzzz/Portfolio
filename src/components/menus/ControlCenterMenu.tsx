import { useShallow } from "zustand/react/shallow";
import React, { useRef } from "react";
import Slider from "react-rangeslider";
import "react-rangeslider/lib/index.css";
import { motion } from "framer-motion";
import { useMusicStore, useNowPlaying } from "~/stores/music";
import { usePrefs } from "~/settings/prefs";
import { enterFullScreen, exitFullScreen, isFullScreen } from "~/utils/screen";
import { useWindowSize } from "~/hooks/useWindowSize";
import { useStore } from "~/stores";
import { useClickOutside } from "~/hooks";

interface SliderProps {
  icon: string;
  value: number;
  setValue: (value: number) => void;
  dark?: boolean;
}

const SliderComponent = ({ icon, value, setValue, dark }: SliderProps) => (
  <div className="slider flex">
    <div className="size-7 flex-center bg-c-100" border="t l b c-300 rounded-l-full">
      {icon.startsWith("i-ph:") ? (
        <span className={icon} text="xs c-500" />
      ) : (
        <img src={icon} alt="" style={{ width: "14px", height: "14px", filter: dark ? "invert(1)" : "none", opacity: 0.7 }} />
      )}
    </div>
    <Slider
      min={1}
      max={100}
      value={value}
      tooltip={false}
      orientation="horizontal"
      onChange={(v: number) => setValue(v)}
    />
  </div>
);

const VerticalSlider = ({ icon, value, setValue, light }: { icon: React.ReactNode, value: number, setValue: (value: number) => void, light?: boolean }) => {
  const sliderRef = useRef<HTMLDivElement>(null);

  const updateValue = (e: React.PointerEvent) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    let y = e.clientY - rect.top;
    y = Math.max(0, Math.min(y, rect.height));
    const percentage = 100 - (y / rect.height) * 100;
    setValue(percentage);
  };

  return (
    <div
      ref={sliderRef}
      onPointerDown={(e) => {
        sliderRef.current?.setPointerCapture(e.pointerId);
        updateValue(e);
      }}
      onPointerMove={(e) => {
        if (e.buttons > 0) updateValue(e);
      }}
      style={{
        width: "56px",
        height: "195px",
        borderRadius: "28px",
        background: light ? "rgba(118,118,128,0.2)" : "rgba(50,50,52,0.9)",
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
        touchAction: "none"
      }}
    >
      <div 
        style={{ 
          position: "absolute",
          bottom: 0, left: 0, right: 0,
          height: `${value}%`, 
          background: "rgba(255,255,255,0.92)", 
          borderRadius: "28px", 
          transition: "height 50ms ease" 
        }}
      />
      <div 
        style={{ 
          position: "absolute",
          bottom: "12px", 
          left: "50%", 
          transform: "translateX(-50%)", 
          // Dark when the white fill reaches the icon (bottom ~32px), else white.
          color: light || value > 17 ? "rgba(0,0,0,0.75)" : "rgba(255,255,255,0.9)",
          width: "20px", 
          height: "20px",
          zIndex: 2,
          pointerEvents: "none"
        }}
      >
        {icon}
      </div>
    </div>
  );
};

interface CCMProps {
  toggleControlCenter: () => void;
  toggleAudio: (target: boolean) => void;
  setBrightness: (value: number) => void;
  setVolume: (value: number) => void;
  playing: boolean;
  btnRef: React.RefObject<HTMLDivElement>;
}

export default function ControlCenterMenu({
  toggleControlCenter,
  toggleAudio,
  setBrightness,
  setVolume,
  playing,
  btnRef
}: CCMProps) {
  const controlCenterRef = useRef<HTMLDivElement>(null);
  const music = useNowPlaying();
  const { dark, wifi, brightness, bluetooth, airdrop, fullscreen, volume, focusMode } = useStore(useShallow(
    (state) => ({
      dark: state.dark,
      wifi: state.wifi,
      brightness: state.brightness,
      bluetooth: state.bluetooth,
      airdrop: state.airdrop,
      fullscreen: state.fullscreen,
      volume: state.volume,
      focusMode: state.focusMode
    })
  ));

  const { toggleWIFI, toggleBluetooth, toggleAirdrop, toggleDark, toggleFullScreen, toggleFocus } =
    useStore(useShallow((state) => ({
      toggleWIFI: state.toggleWIFI,
      toggleBluetooth: state.toggleBluetooth,
      toggleAirdrop: state.toggleAirdrop,
      toggleDark: state.toggleDark,
      toggleFullScreen: state.toggleFullScreen,
      toggleFocus: state.toggleFocus
    })));
  const { winWidth } = useWindowSize();
  const isMobile = winWidth < 768;

  // ── Phone controls: every button does something real ──
  const mPlayer = useMusicStore(useShallow((s) => ({ playing: s.playing, has: !!s.queue[s.index], toggle: s.toggle, next: s.next, prev: s.prev })));
  const reduceTransparency = usePrefs((s) => s.reduceTransparency);
  const [isFs, setIsFs] = React.useState(isFullScreen);
  React.useEffect(() => {
    const on = () => setIsFs(isFullScreen());
    document.addEventListener("fullscreenchange", on);
    document.addEventListener("webkitfullscreenchange", on);
    return () => {
      document.removeEventListener("fullscreenchange", on);
      document.removeEventListener("webkitfullscreenchange", on);
    };
  }, []);
  const canFullscreen = !!(document.fullscreenEnabled || (document as Document & { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled);
  const beforeMute = useRef(volume || 70);
  const muted = volume === 0;
  const toggleMute = () => {
    if (muted) setVolume(beforeMute.current || 70);
    else {
      beforeMute.current = volume;
      setVolume(0);
    }
  };
  const openFromCC = (id: string) => {
    toggleControlCenter();
    window.dispatchEvent(new CustomEvent("app:open", { detail: id }));
  };
  // Phone palette follows the theme (it used to be dark in light mode too).
  const P = dark
    ? { sheet: "rgba(25,25,28,0.92)", line: "rgba(255,255,255,0.1)", tile: "rgba(44,44,48,0.95)", off: "rgba(28,28,30,0.9)", round: "rgba(255,255,255,0.18)", on: "rgba(255,255,255,0.88)", onText: "#000", music: "rgba(50,40,70,0.9)", text: "#fff", sub: "rgba(255,255,255,0.7)" }
    : { sheet: "rgba(242,242,247,0.94)", line: "rgba(0,0,0,0.08)", tile: "#fff", off: "rgba(118,118,128,0.14)", round: "#fff", on: "#1c1c1e", onText: "#fff", music: "#fff", text: "#1c1c1e", sub: "rgba(60,60,67,0.7)" };
  const roundBtn = (on = false): React.CSSProperties => ({ width: "64px", height: "64px", borderRadius: "50%", background: on ? P.on : P.tile, boxShadow: dark ? "none" : "0 1px 3px rgba(0,0,0,0.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" });
  const caption: React.CSSProperties = { marginTop: 6, fontSize: 10.5, color: P.sub, textAlign: "center" };

  // Laptop: close on any press outside. Phone: the backdrop closes it on a
  // completed tap, so that tap can't fall through to the app icon underneath.
  useClickOutside(controlCenterRef, () => !isMobile && toggleControlCenter(), [btnRef]);

  return (
    <>
      {isMobile && (
        <style>{`
          .mobile-cc::-webkit-scrollbar {
            display: none;
          }
          .mobile-cc {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>
      )}
      
      {/* FULLSCREEN OVERLAY */}
      {isMobile && (
        <motion.div
          className="m-cc-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            zIndex: 9989
          }}
          onClick={toggleControlCenter}
        />
      )}
      
      <motion.div
        className={`text-c-black ${isMobile ? "mobile-cc" : ""}`}
        ref={controlCenterRef}
        initial={isMobile ? { y: "-110%" } : { opacity: 0, y: -8, scale: 0.97 }}
        animate={isMobile ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
        exit={isMobile ? { y: "-110%" } : { opacity: 0, y: -6, scale: 0.97 }}
        transition={isMobile ? { duration: 0.42, ease: [0.32, 0.72, 0, 1] } : { type: "spring", stiffness: 350, damping: 30, mass: 0.8 }}
        style={isMobile ? {
          position: "fixed",
          top: 0, left: 0, right: 0,
          width: "100vw",
          padding: "56px 14px 20px",
          borderRadius: "0 0 36px 36px",
          background: P.sheet,
          backdropFilter: "blur(50px) saturate(180%)",
          WebkitBackdropFilter: "blur(50px) saturate(180%)",
          borderBottom: `0.5px solid ${P.line}`,
          zIndex: 9990
        } : {
          position: "fixed",
          top: "32px",
          right: "6px",
          left: "auto",
          width: "320px",
          padding: "10px",
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gridAutoRows: "auto",
          gap: "12px",
          borderRadius: "var(--radius-menu)",
          background: 'var(--lg-bg-menu)',
          backdropFilter: 'blur(40px) saturate(250%)',
          WebkitBackdropFilter: 'blur(40px) saturate(250%)',
          border: 'var(--lg-border)',
          boxShadow: 'var(--shadow-menu), var(--lg-inner-highlight)',
          zIndex: 9999,
          maxHeight: "auto",
          overflowY: "visible"
        }}
      >
        {isMobile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
            
            {/* ROW 1: Connectivity & Now Playing */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", height: "160px" }}>
              
              {/* CONNECTIVITY TILE */}
              <div style={{ width: "100%", height: "160px", background: P.tile, borderRadius: "20px", padding: "14px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", height: "100%" }}>
                  <motion.div whileTap={{ scale: 0.88 }} onClick={toggleAirdrop} style={{ width: "100%", height: "60px", borderRadius: "14px", background: airdrop ? "#0A84FF" : P.off, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", cursor: "pointer" }}>
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: "22px", height: "22px", color: airdrop ? "white" : P.text }}>
                      <path d="M6.5 20C4.01 20 2 17.99 2 15.5c0-2.03 1.37-3.74 3.24-4.27C5.08 10.82 5 10.42 5 10c0-2.76 2.24-5 5-5 1.8 0 3.37.96 4.24 2.4.26-.03.51-.04.76-.04 2.76 0 5 2.24 5 5 0 .11 0 .22-.01.33C21.67 13.24 23 14.73 23 16.5c0 1.93-1.57 3.5-3.5 3.5H6.5zM13 11V8h-2v3H9l3 4 3-4h-2z"/>
                    </svg>
                    <span style={{ fontSize: "10px", color: airdrop ? "rgba(255,255,255,0.85)" : P.sub }}>AirDrop</span>
                  </motion.div>
                  
                  <motion.div whileTap={{ scale: 0.88 }} style={{ width: "100%", height: "60px", borderRadius: "14px", background: "#0A84FF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", cursor: "pointer" }}>
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: "22px", height: "22px", color: true ? "white" : P.text }}>
                      <path d="M15.5 5H13l2.5-3 2.5 3h-2.5zM13 19h2.5l-2.5 3-2.5-3H13zM3 6h2v12H3V6zm4-2h2v16H7V4zm4 2h2v12h-2V6zm4-4h2v16h-2V2z"/>
                    </svg>
                    <span style={{ fontSize: "10px", color: true ? "rgba(255,255,255,0.85)" : P.sub }}>Mobile Data</span>
                  </motion.div>
                  
                  <motion.div whileTap={{ scale: 0.88 }} onClick={toggleWIFI} style={{ width: "100%", height: "60px", borderRadius: "14px", background: wifi ? "#0A84FF" : P.off, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", cursor: "pointer" }}>
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: "22px", height: "22px", color: wifi ? "white" : P.text }}>
                      <path d="M1 9l2 2c5.523-5.523 14.477-5.523 20 0l2-2C19.261 3.261 4.739 3.261 1 9zm8 8l3 3 3-3c-1.657-1.657-4.343-1.657-6 0zm-4-4l2 2c2.761-2.761 7.239-2.761 10 0l2-2C15.522 9.478 8.478 9.478 5 13z"/>
                    </svg>
                    <span style={{ fontSize: "10px", color: wifi ? "rgba(255,255,255,0.85)" : P.sub }}>Wi-Fi</span>
                  </motion.div>
                  
                  <motion.div whileTap={{ scale: 0.88 }} onClick={toggleBluetooth} style={{ width: "100%", height: "60px", borderRadius: "14px", background: bluetooth ? "#0A84FF" : P.off, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", cursor: "pointer" }}>
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: "22px", height: "22px", color: bluetooth ? "white" : P.text }}>
                      <path d="M17.71 7.71L12 2h-1v7.59L6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29zM13 5.83l1.88 1.88L13 9.59V5.83zm1.88 10.46L13 18.17v-3.76l1.88 1.88z"/>
                    </svg>
                    <span style={{ fontSize: "10px", color: bluetooth ? "rgba(255,255,255,0.85)" : P.sub }}>Bluetooth</span>
                  </motion.div>
                </div>
              </div>

              {/* NOW PLAYING TILE */}
              <div style={{ width: "100%", height: "160px", background: P.music, borderRadius: "20px", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {music.active ? (
                    <img style={{ width: "40px", height: "40px", borderRadius: "6px", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", objectFit: "cover" }} src={music.cover} alt="cover" />
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: "20px", height: "20px", color: P.text }}>
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    {music.active ? (
                      <>
                        <span style={{ fontSize: "14px", fontWeight: 600, color: P.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{music.title}</span>
                        <span style={{ fontSize: "12px", color: P.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{music.artist}</span>
                      </>
                    ) : (
                      <span style={{ fontSize: "15px", color: P.sub }}>Not Playing</span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center" }}>
                  <motion.div role="button" aria-label="Previous song" whileTap={{ opacity: 0.5 }} style={{ cursor: "pointer", opacity: mPlayer.has ? 1 : 0.4 }} onClick={() => mPlayer.has && mPlayer.prev()}>
                    <svg viewBox="0 0 24 24" fill={P.text} style={{ width: "30px", height: "30px" }}><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                  </motion.div>
                  <motion.div role="button" aria-label={mPlayer.playing ? "Pause" : "Play"} whileTap={{ opacity: 0.5 }} style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); if (mPlayer.has) mPlayer.toggle(); else openFromCC("spotify"); }}>
                    {mPlayer.playing ? (
                      <svg viewBox="0 0 24 24" fill={P.text} style={{ width: "38px", height: "38px" }}><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill={P.text} style={{ width: "38px", height: "38px" }}><path d="M8 5v14l11-7z"/></svg>
                    )}
                  </motion.div>
                  <motion.div role="button" aria-label="Next song" whileTap={{ opacity: 0.5 }} style={{ cursor: "pointer", opacity: mPlayer.has ? 1 : 0.4 }} onClick={() => mPlayer.has && mPlayer.next()}>
                    <svg viewBox="0 0 24 24" fill={P.text} style={{ width: "30px", height: "30px" }}><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                  </motion.div>
                </div>
              </div>
            </div>

            {/* ROW 2: Toggles and Sliders */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              
              {/* LEFT COLUMN: Rotation, Silent, Focus */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", flexDirection: "row", gap: "10px" }}>
                  {/* Dark Mode */}
                  <div>
                  <motion.div role="button" aria-label="Dark Mode" aria-pressed={dark} whileTap={{ scale: 0.88 }} onClick={toggleDark} style={{ width: "58px", height: "58px", borderRadius: "50%", background: dark ? "rgba(255,255,255,0.85)" : P.round, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: "none" }}>
                    <span className={dark ? "i-ph:moon-fill" : "i-ph:sun-fill"} style={{ width: "24px", height: "24px", color: dark ? "#5E5CE6" : "#FF9500" }} />
                  </motion.div>
                  <div style={caption}>{dark ? "Dark" : "Light"}</div>
                  </div>
                  {/* Solid UI (Reduce Transparency) */}
                  <div>
                  <motion.div role="button" aria-label="Reduce Transparency" aria-pressed={reduceTransparency} whileTap={{ scale: 0.88 }} onClick={() => usePrefs.getState().set("reduceTransparency", !reduceTransparency)} style={{ width: "58px", height: "58px", borderRadius: "50%", background: reduceTransparency ? P.on : P.round, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: "none" }}>
                    <span className="i-ph:drop-half-bottom-fill" style={{ width: "24px", height: "24px", color: reduceTransparency ? P.onText : P.text }} />
                  </motion.div>
                  <div style={caption}>Solid UI</div>
                  </div>
                </div>
                
                {/* FOCUS PILL */}
                <motion.div whileTap={{ scale: 0.95 }} onClick={toggleFocus} style={{ marginTop: "10px", display: "flex", alignItems: "center", width: "100%", height: "46px", borderRadius: "14px", background: focusMode ? "rgba(90,60,140,0.7)" : P.tile, padding: "0 14px", gap: "10px", cursor: "pointer" }}>
                  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: "18px", height: "18px", color: focusMode ? "#BF5AF2" : P.text }}>
                    <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>
                  </svg>
                  <span style={{ display: "flex", flexDirection: "column", flex: 1, lineHeight: 1.2 }}>
                    <span style={{ fontSize: "15px", fontWeight: 500, color: focusMode ? "#fff" : P.text }}>Focus</span>
                    <span style={{ fontSize: "11px", color: focusMode ? "rgba(255,255,255,0.75)" : P.sub }}>{focusMode ? "On · pop-ups hidden" : "Hide pop-ups"}</span>
                  </span>
                  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: "12px", height: "12px", color: P.sub }}>
                    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                  </svg>
                </motion.div>
              </div>

              {/* RIGHT COLUMN: Sliders */}
              <div style={{ display: "flex", flexDirection: "row", justifyContent: "center", gap: "16px", height: "195px" }}>
                <VerticalSlider light={!dark}
                  icon={<svg viewBox="0 0 24 24" fill="currentColor" style={{ width: "100%", height: "100%" }}><path d="M12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm6.59-4.41l-1.41-1.41-2.12 2.12 1.41 1.41 2.12-2.12zM12 4V1h-2v3h2zm-5.66 1.76L4.22 3.64 2.81 5.05l2.12 2.12 1.41-1.41zM4 11H1v2h3v-2zm1.76 5.66l-2.12 2.12 1.41 1.41 2.12-2.12-1.41-1.41zM11 20v3h2v-3h-2zm5.66-1.76l2.12 2.12 1.41-1.41-2.12-2.12-1.41 1.41zM20 11v2h3v-2h-3z"/></svg>}
                  value={brightness}
                  setValue={setBrightness}
                />
                
                
                <VerticalSlider light={!dark}
                  icon={<svg viewBox="0 0 24 24" fill="currentColor" style={{ width: "100%", height: "100%" }}><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>}
                  value={volume}
                  setValue={setVolume}
                />
              </div>
            </div>

            {/* ROW 3: shortcuts */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", justifyItems: "center", marginTop: "12px" }}>
              {canFullscreen && (
                <div>
                  <motion.div role="button" aria-label={isFs ? "Exit Full Screen" : "Full Screen"} aria-pressed={isFs} whileTap={{ scale: 0.88 }} onClick={() => (isFs ? exitFullScreen() : enterFullScreen())} style={roundBtn(isFs)}>
                    <span className={isFs ? "i-ph:corners-in-bold" : "i-ph:corners-out-bold"} style={{ width: 26, height: 26, color: isFs ? P.onText : P.text }} />
                  </motion.div>
                  <div style={caption}>{isFs ? "Exit Full" : "Full Screen"}</div>
                </div>
              )}
              <div>
                <motion.div role="button" aria-label="Open Clock" whileTap={{ scale: 0.88 }} onClick={() => openFromCC("clock")} style={roundBtn()}>
                  <span className="i-ph:timer-bold" style={{ width: 26, height: 26, color: P.text }} />
                </motion.div>
                <div style={caption}>Clock</div>
              </div>
              <div>
                {/* Mute: silences the music */}
                <motion.div role="button" aria-label={muted ? "Unmute" : "Mute"} aria-pressed={muted} whileTap={{ scale: 0.88 }} onClick={toggleMute} style={roundBtn(muted)}>
                  <span className={muted ? "i-ph:speaker-slash-fill" : "i-ph:speaker-high-fill"} style={{ width: 26, height: 26, color: muted ? "#FF3B30" : P.text }} />
                </motion.div>
                <div style={caption}>{muted ? "Unmute" : "Mute"}</div>
              </div>
              <div>
                <motion.div role="button" aria-label="Open Camera" whileTap={{ scale: 0.88 }} onClick={() => openFromCC("facetime")} style={roundBtn()}>
                  <span className="i-ph:camera-fill" style={{ width: 26, height: 26, color: P.text }} />
                </motion.div>
                <div style={caption}>Camera</div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Layout: same tiles as macOS, but only controls that do something. */}
            {/* Left: every toggle in one tile. Right: the four one-tap buttons. */}
            <div className="cc-grid row-span-2 col-span-2 p-2.5 flex flex-col justify-around space-y-1">
              <div className="hstack space-x-2">
                <div className={`${wifi ? "cc-btn" : "cc-btn-active"}`} onClick={toggleWIFI}>
                  <span className="i-ph:wifi-high text-base" />
                </div>
                <div p="t-0.5">
                  <div className="font-medium leading-4" style={{ fontSize: '12px' }}>Wi-Fi</div>
                  <div className="cc-text">{wifi ? "Home" : "Off"}</div>
                </div>
              </div>
              <div className="hstack space-x-2 cursor-pointer" onClick={toggleFocus}>
                <div className={`${focusMode ? "cc-btn" : "cc-btn-active"}`}>
                  <span className="i-ph:moon text-base" />
                </div>
                <div p="t-0.5">
                  <div className="font-medium leading-4" style={{ fontSize: '12px' }}>Focus</div>
                  <div className="cc-text">{focusMode ? "Pop-ups hidden" : "Off"}</div>
                </div>
              </div>
              <div className="hstack space-x-2 cursor-pointer" onClick={toggleDark}>
                <div className={`${dark ? "cc-btn" : "cc-btn-active"}`}>
                  {dark ? (
                    <span className="i-ph:moon text-base" />
                  ) : (
                    <span className="i-ph:sun text-base" />
                  )}
                </div>
                <div className="font-medium" style={{ fontSize: '12px' }}>{dark ? "Dark Mode" : "Light Mode"}</div>
              </div>
              <div
                className="hstack space-x-2 cursor-pointer"
                role="button"
                aria-label="Solid UI (Reduce Transparency)"
                aria-pressed={reduceTransparency}
                onClick={() => usePrefs.getState().set("reduceTransparency", !reduceTransparency)}
              >
                <div className={`${reduceTransparency ? "cc-btn" : "cc-btn-active"}`}>
                  <span className="i-ph:drop-half-bottom-fill text-base" />
                </div>
                <div p="t-0.5">
                  <div className="font-medium leading-4" style={{ fontSize: '12px' }}>Solid UI</div>
                  <div className="cc-text">{reduceTransparency ? "On" : "Off"}</div>
                </div>
              </div>
            </div>

            <div className="cc-grid flex-center flex-col cursor-pointer py-2" role="button" aria-pressed={muted} onClick={toggleMute}>
              <span className={`${muted ? "i-ph:speaker-slash" : "i-ph:speaker-high"} text-base`} />
              <span className="text-center mt-1.5" style={{ fontSize: '10px', lineHeight: '12px' }}>{muted ? "Unmute" : "Mute"}</span>
            </div>
            <div className="cc-grid flex-center flex-col cursor-pointer py-2" onClick={() => toggleFullScreen(!fullscreen)}>
              {fullscreen ? (
                <span className="i-ph:arrows-in text-base" />
              ) : (
                <span className="i-ph:arrows-out text-base" />
              )}
              <span className="text-center mt-1.5" style={{ fontSize: '10px', lineHeight: '12px' }}>{fullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}</span>
            </div>

            <div className="cc-grid flex-center flex-col cursor-pointer py-2" role="button" onClick={() => openFromCC("clock")}>
              <span className="i-ph:clock text-base" />
              <span className="text-center mt-1.5" style={{ fontSize: '10px', lineHeight: '12px' }}>Clock</span>
            </div>
            <div className="cc-grid flex-center flex-col cursor-pointer py-2" role="button" onClick={() => openFromCC("facetime")}>
              <span className="i-ph:camera text-base" />
              <span className="text-center mt-1.5" style={{ fontSize: '10px', lineHeight: '12px' }}>Camera</span>
            </div>

            <div className="cc-grid col-span-4 px-2.5 py-2 space-y-1 flex flex-col justify-around">
              <span className="font-medium ml-0.5" style={{ fontSize: '12px' }}>Display</span>
              <SliderComponent icon="i-ph:sun" value={brightness} setValue={setBrightness} />
            </div>

            <div className="cc-grid col-span-4 px-2.5 py-2 space-y-1 flex flex-col justify-around">
              <span className="font-medium ml-0.5" style={{ fontSize: '12px' }}>Sound</span>
              <SliderComponent icon="i-ph:speaker-high" value={volume} setValue={setVolume} />
            </div>

            <div className="player cc-grid col-span-4 hstack space-x-2.5" p="y-2 l-2 r-4">
              <img
                className="w-12 rounded-lg"
                src={music.cover}
                alt="cover art"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
              />
              <div className="flex-1">
                <div className="font-medium" style={{ fontSize: '12px' }}>{music.title}</div>
                <div className="cc-text">{music.artist}</div>
              </div>
              {mPlayer.has && (
                <span className="i-ph:skip-back-fill text-lg cursor-pointer" role="button" aria-label="Previous song" onClick={() => mPlayer.prev()} />
              )}
              {playing ? (
                <span className="i-ph:pause-fill text-2xl play cursor-pointer" onClick={() => toggleAudio(false)} />
              ) : (
                // Nothing queued yet: open Spotify to pick something (as on the phone).
                <span className="i-ph:play-fill text-2xl pause cursor-pointer" onClick={() => (mPlayer.has ? toggleAudio(true) : openFromCC("spotify"))} />
              )}
              {mPlayer.has && (
                <span className="i-ph:skip-forward-fill text-lg cursor-pointer" role="button" aria-label="Next song" onClick={() => mPlayer.next()} />
              )}
            </div>
          </>
        )}
      </motion.div>
    </>
  );
}
