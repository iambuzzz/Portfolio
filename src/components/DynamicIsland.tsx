import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import { useCurrentTrack, useMusicStore } from "~/stores/music";

// Menu-bar "Dynamic Island". Idle it's a small pill with a camera dot; while
// music plays it shows the cover and a level meter; click to open the
// Now Playing controls. Sizes are explicit numbers (never "auto") so the
// spring can't get stuck half-way when clicked mid-animation.

const SIZES = {
  idle: { width: 126, height: 32, radius: 16 },
  playing: { width: 200, height: 32, radius: 16 },
  open: { width: 360, height: 104, radius: 26 }
};

const fmt = (s: number) => (s && isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");

const Bars = () => (
  <div className="flex items-center" style={{ gap: 2, height: 12 }} aria-hidden>
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        animate={{ height: [3, 11, 5, 9, 3] }}
        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        style={{ width: 2.5, borderRadius: 2, background: "#1DB954" }}
      />
    ))}
  </div>
);

const CameraDot = () => (
  <div
    aria-hidden
    style={{
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: "radial-gradient(circle, #1f1f1f 30%, #0a0a0a 100%)",
      border: "1px solid rgba(255,255,255,0.08)",
      flexShrink: 0
    }}
  />
);

export default function DynamicIsland({ hide = false }: { hide?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const track = useCurrentTrack();
  const m = useMusicStore(
    useShallow((s) => ({
      playing: s.playing,
      position: s.position,
      duration: s.duration,
      toggle: s.toggle,
      next: s.next,
      prev: s.prev,
      hasNext: s.index + 1 < s.queue.length || s.repeat || s.shuffle
    }))
  );

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (hide) setOpen(false);
  }, [hide]);

  const size = open ? SIZES.open : m.playing && track ? SIZES.playing : SIZES.idle;

  const btn = (label: string, icon: string, onClick: () => void, disabled = false, big = false) => (
    <button
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex-center"
      style={{ color: "white", opacity: disabled ? 0.35 : 1, width: big ? 34 : 28, height: big ? 34 : 28 }}
    >
      <span className={icon} style={{ width: big ? 24 : 18, height: big ? 24 : 18 }} />
    </button>
  );

  return (
    // Above the (transparent, full-width) menu bar so clicks reach the island.
    <div
      className="fixed inset-x-0 flex justify-center"
      style={{ top: 6, zIndex: 100000, pointerEvents: "none", opacity: hide ? 0 : 1, visibility: hide ? "hidden" : "visible", transition: "opacity 0.3s" }}
    >
      <motion.div
        ref={ref}
        role="button"
        aria-label={open ? "Close Now Playing" : "Open Now Playing"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        initial={false}
        animate={{ width: size.width, height: size.height, borderRadius: size.radius }}
        transition={{ type: "spring", stiffness: 400, damping: 32 }}
        style={{
          pointerEvents: "auto",
          background: "#0d0d0d",
          overflow: "hidden",
          cursor: "default",
          boxShadow: "var(--shadow-dynamic-island)",
          fontFamily: "var(--font-system)"
        }}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {open ? (
            <motion.div
              key="open"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.08, duration: 0.18 } }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
              style={{ width: SIZES.open.width, height: SIZES.open.height, padding: "14px 18px" }}
            >
              {track ? (
                <>
                  <div className="flex items-center" style={{ gap: 12 }}>
                    <img src={track.thumbnail} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="truncate" style={{ color: "white", fontSize: 13.5, fontWeight: 600 }}>
                        {track.title}
                      </div>
                      <div className="truncate" style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>
                        {track.artist}
                      </div>
                    </div>
                    <div className="flex items-center">
                      {btn("Previous", "i-ph:skip-back-fill", m.prev)}
                      {btn(m.playing ? "Pause" : "Play", m.playing ? "i-ph:pause-fill" : "i-ph:play-fill", () => m.toggle(), false, true)}
                      {btn("Next", "i-ph:skip-forward-fill", m.next, !m.hasNext)}
                    </div>
                  </div>
                  <div className="flex items-center" style={{ gap: 8, marginTop: 12, fontSize: 10.5, color: "rgba(255,255,255,0.5)", fontVariantNumeric: "tabular-nums" }}>
                    <span>{fmt(m.position)}</span>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.18)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, (m.position / Math.max(m.duration, 1)) * 100)}%`, background: "white", borderRadius: 2 }} />
                    </div>
                    <span>{fmt(m.duration)}</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center h-full" style={{ gap: 12 }}>
                  <div className="flex-center" style={{ width: 44, height: 44, borderRadius: 10, background: "#1DB954", flexShrink: 0 }}>
                    <span className="i-ph:music-notes-fill" style={{ width: 22, height: 22, color: "#000" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "white", fontSize: 13.5, fontWeight: 600 }}>Nothing playing</div>
                    <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>Play any song on Spotify</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      window.dispatchEvent(new CustomEvent("app:open", { detail: "spotify" }));
                    }}
                    style={{ background: "#1DB954", color: "#000", fontSize: 12, fontWeight: 700, borderRadius: 999, padding: "6px 12px", flexShrink: 0 }}
                  >
                    Open Spotify
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="closed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.05, duration: 0.15 } }}
              exit={{ opacity: 0, transition: { duration: 0.06 } }}
              className="flex items-center justify-between"
              style={{ width: "100%", height: 32, padding: "0 10px 0 7px" }}
            >
              {m.playing && track ? (
                <>
                  <img src={track.thumbnail} alt="" style={{ width: 20, height: 20, borderRadius: 6, objectFit: "cover" }} />
                  <Bars />
                </>
              ) : (
                <>
                  <span />
                  <CameraDot />
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
