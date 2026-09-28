import { useEffect, useState, type RefObject } from "react";
import { useMusicStore } from "~/stores/music";

// iPhone status bar: time (tap → Notification Center), Dynamic Island (shows
// the playing song as a live activity), signal/Wi-Fi/battery (tap → Control
// Center). Text is white on the home screen and follows the app inside apps.

interface StatusBarProps {
  isAppOpen: boolean;
  /** Dark glyphs (light app underneath). */
  dark?: boolean;
  onLeftTap?: () => void;
  onRightTap?: () => void;
  /** Dynamic Island: opens the live activity's app (or the camera). */
  onIslandTap?: (live: boolean) => void;
  rightRef?: RefObject<HTMLDivElement>;
}

export default function StatusBar({ isAppOpen, dark, onLeftTap, onRightTap, onIslandTap, rightRef }: StatusBarProps) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 10_000);
    return () => clearInterval(t);
  }, []);
  // Only the current track: the store also ticks the playback position ~4×/s.
  const track = useMusicStore((s) => (s.playing ? s.queue[s.index] : undefined));
  const clock = time.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).replace(/\s?[AP]M$/, "");

  return (
    <div className={`m-status ${dark ? "on-light" : ""} ${isAppOpen ? "in-app" : ""}`}>
      <button type="button" className="m-status-time" onClick={onLeftTap} aria-label="Notification Center">
        {clock}
      </button>

      <button
        type="button"
        className={`m-island ${track ? "live" : ""}`}
        aria-label={track ? `Now playing ${track.title}` : "Camera"}
        onClick={() => onIslandTap?.(!!track)}
      >
        {track && (
          <>
            <img src={track.thumbnail || track.cover} alt="" draggable={false} />
            <span className="m-island-wave" aria-hidden>
              <i />
              <i />
              <i />
              <i />
            </span>
          </>
        )}
      </button>

      <div ref={rightRef} className="m-status-right" onClick={onRightTap} role="button" aria-label="Control Center">
        <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor" aria-hidden>
          <rect x="0" y="7" width="3" height="4" rx="1" />
          <rect x="4.5" y="5" width="3" height="6" rx="1" />
          <rect x="9" y="2.5" width="3" height="8.5" rx="1" />
          <rect x="13.5" y="0" width="3" height="11" rx="1" />
        </svg>
        <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor" aria-hidden>
          <path d="M8 2.2c2.3 0 4.4.9 6 2.4l1.2-1.2C13.3 1.5 10.8.5 8 .5S2.7 1.5.8 3.4L2 4.6c1.6-1.5 3.7-2.4 6-2.4Zm0 3.3c1.4 0 2.6.5 3.6 1.4l1.2-1.2C11.5 4.5 9.8 3.8 8 3.8S4.5 4.5 3.2 5.7l1.2 1.2c1-.9 2.2-1.4 3.6-1.4Zm0 3.3c.5 0 1 .2 1.3.5L8 10.6 6.7 9.3c.3-.3.8-.5 1.3-.5Z" />
        </svg>
        <span className="m-battery" aria-label="Battery full">
          <span />
        </span>
      </div>
    </div>
  );
}
