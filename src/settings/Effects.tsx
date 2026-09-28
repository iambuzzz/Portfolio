import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  MotionConfig,
  MotionGlobalConfig,
  motion,
} from "framer-motion";
import { useStore } from "~/stores";
import { usePrefs } from "./prefs";
import { ACHIEVEMENTS, useActivity } from "./activity";
import { openSettings } from "./nav";

// Applies Settings globally: motion, transparency, Night Shift, accent colour,
// automatic dark mode, and Screen Time tracking.

const prefersDark = () =>
  window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;

export function PrefsProvider({ children }: { children: ReactNode }) {
  const { reduceMotion, reduceTransparency, nightShift, nightShiftWarmth } =
    usePrefs();
  const appearanceMode = useStore((s) => s.appearanceMode);
  const accent = useStore((s) => s.accentColor);

  // Accessibility classes on <html> (CSS in component.css).
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reduceMotion);
    // Makes every framer-motion animation jump straight to its end state
    // (MotionConfig alone only skips transforms, so fades and springs kept playing).
    MotionGlobalConfig.skipAnimations = reduceMotion;
  }, [reduceMotion]);
  useEffect(() => {
    document.documentElement.classList.toggle(
      "reduce-transparency",
      reduceTransparency,
    );
  }, [reduceTransparency]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--accent-primary",
      accent || "#007AFF",
    );
  }, [accent]);

  // Appearance "Auto" follows the operating system, live.
  useEffect(() => {
    if (appearanceMode !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = mq.matches;
      document.documentElement.classList.toggle("dark", dark);
      useStore.setState({ dark });
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [appearanceMode]);

  // Screen Time: count time while the tab is visible.
  const counted = useRef(false);
  useEffect(() => {
    if (!counted.current) {
      counted.current = true;
      useActivity.setState((s) => ({ visits: s.visits + 1 }));
    }
    const t = setInterval(() => {
      if (document.visibilityState === "visible")
        useActivity.getState().tick(10);
    }, 10000);
    return () => clearInterval(t);
  }, []);

  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
      {children}
      {nightShift && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 2147483000,
            background: `rgba(255, 138, 40, ${0.08 + (nightShiftWarmth / 100) * 0.27})`,
            mixBlendMode: "multiply",
          }}
        />
      )}
    </MotionConfig>
  );
}

// ── Achievement banner (desktop) ─────────────────────────────────────────────
export function AchievementToasts() {
  const [queue, setQueue] = useState<string[]>([]);
  useEffect(() => {
    const on = (e: Event) =>
      setQueue((q) => [...q, (e as CustomEvent<string>).detail]);
    window.addEventListener("achievement:unlocked", on);
    // First visit counts as an achievement.
    const t = setTimeout(() => useActivity.getState().unlock("hello"), 1200);
    return () => {
      window.removeEventListener("achievement:unlocked", on);
      clearTimeout(t);
    };
  }, []);
  const current = queue[0];
  // Auto-hides after a few seconds, but not while the pointer is on it.
  const [hover, setHover] = useState(false);
  const dismiss = () => {
    setHover(false);
    setQueue((q) => q.slice(1));
  };
  useEffect(() => {
    if (!current || hover) return;
    const t = setTimeout(() => setQueue((q) => q.slice(1)), 4200);
    return () => clearTimeout(t);
  }, [current, hover]);
  const a = ACHIEVEMENTS.find((x) => x.id === current);

  return (
    <AnimatePresence>
      {a && (
        <motion.div
          key={a.id}
          className="ach-toast"
          role="status"
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          style={{
            position: "fixed",
            top: 40,
            right: 14,
            zIndex: 100001,
            width: 320,
          }}
        >
          <button
            type="button"
            className="ach-toast-close text-c-black"
            aria-label="Dismiss notification"
            title="Dismiss"
            onClick={dismiss}
          >
            <span className="i-ph:x-bold" />
          </button>
          <button
            type="button"
            onClick={() => {
              dismiss();
              openSettings("screen-time");
            }}
            className="text-c-black"
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              borderRadius: 18,
              textAlign: "left",
              background: "var(--lg-bg-solid)",
              backdropFilter: "var(--lg-blur)",
              WebkitBackdropFilter: "var(--lg-blur)",
              border: "var(--lg-border)",
              boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
              fontFamily: "var(--font-system)",
            }}
          >
            <div
              className="flex-center"
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                fontSize: 22,
                flexShrink: 0,
                background: "linear-gradient(135deg,#ffd60a,#ff9f0a)",
              }}
            >
              {a.emoji}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  opacity: 0.6,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Achievement unlocked
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{a.title}</div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>
                {Object.keys(useActivity.getState().unlocked).length} of{" "}
                {ACHIEVEMENTS.length} · see Settings › Screen Time
              </div>
            </div>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { prefersDark };
