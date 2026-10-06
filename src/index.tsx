import { useShallow } from "zustand/react/shallow";
import React from "react";
import { wallpaperSrc } from "~/utils";
import { createRoot } from "react-dom/client";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, useWallpaper } from "~/stores";

import Desktop from "~/pages/Desktop";
import Login from "~/pages/Login";
import Boot from "~/pages/Boot";

import "@unocss/reset/tailwind.css";
import "uno.css";
import "~/styles/index.css";
import { AudioProvider } from "~/context/AudioContext";
import { PrefsProvider } from "~/settings/Effects";
import { initialPrefs } from "~/settings/prefs";
import { useMusicStore } from "~/stores/music";
import type { SystemCommand } from "~/components/menus/AppleMenu";

// macOS Tahoe transition variants
// Login → Desktop: bright white bloom flash (exactly like macOS unlocking)
const loginExitVariants = {
  initial: { opacity: 1, scale: 1, filter: "brightness(1)" },
  exit: {
    opacity: 0,
    scale: 1.05,
    filter: "brightness(4) saturate(0)",
    transition: {
      duration: 0.35,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

import Mobile from "~/pages/Mobile";
import { useWindowSize } from "~/hooks/useWindowSize";

// No scale here: react-rnd measures window offsets with getBoundingClientRect
// on mount, and a scaled ancestor made the first drag/click jump windows.
const desktopEnterVariants = {
  initial: { opacity: 0, filter: "brightness(2)" },
  animate: {
    opacity: 1,
    filter: "brightness(1)",
    transition: {
      duration: 0.55,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

const bootVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.6 } },
  exit: {
    opacity: 0,
    scale: 1.04,
    filter: "brightness(3)",
    transition: { duration: 0.5, ease: [0.4, 0, 0.6, 1] },
  },
};

export default function App() {
  // Settings › General › "Skip the login screen" (and Recruiter Mode).
  const [login, setLogin] = useState<boolean>(() => initialPrefs().skipIntro);
  // No white login flash when the intro was skipped on load.
  const [flashOnLogin, setFlashOnLogin] = useState(() => !initialPrefs().skipIntro);
  useEffect(() => {
    if (!login) setFlashOnLogin(true);
  }, [login]);
  const [booting, setBooting] = useState<boolean>(false);
  const [restart, setRestart] = useState<boolean>(false);
  const [sleep, setSleep] = useState<boolean>(false);
  // Lock Screen: the login screen over a still-running desktop.
  const [locked, setLocked] = useState(false);
  // Sleep: display off; waking goes to the lock screen.
  const [asleep, setAsleep] = useState(false);
  const desktopRef = useRef<HTMLDivElement>(null);

  const { winWidth } = useWindowSize();
  const isMobile = winWidth < 768;

  const { dark, iconStyle, tintWindows } = useStore(useShallow((s) => ({
    dark: s.dark,
    iconStyle: s.iconStyle,
    tintWindows: s.tintWindows,
  })));
  const activeWallpaper = useWallpaper();

  // Sync the persisted appearance to the <html> dark class on mount.
  useEffect(() => {
    if (dark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [dark]);

  // Drive icon-style + window-tint appearance from the root element so CSS
  // can react globally (matches the dark-class pattern above).
  useEffect(() => {
    document.documentElement.dataset.iconStyle = iconStyle;
  }, [iconStyle]);

  useEffect(() => {
    document.documentElement.dataset.tintWindows = tintWindows ? "on" : "off";
  }, [tintWindows]);

  const shutMac = (e: React.MouseEvent): void => {
    e.stopPropagation();
    setRestart(false);
    setSleep(false);
    setLogin(false);
    setBooting(true);
  };

  const reboot = (): void => {
    setRestart(true);
    setSleep(false);
    setLogin(false);
    setBooting(true);
  };

  const restartMac = (e: React.MouseEvent): void => {
    e.stopPropagation();
    reboot();
  };

  // Apps can ask for a reboot (e.g. the Terminal's `rm -rf /` easter egg).
  useEffect(() => {
    window.addEventListener("system:restart", reboot);
    return () => window.removeEventListener("system:restart", reboot);
  }, []);

  const goToSleep = (): void => {
    useMusicStore.getState().toggle(false);
    setAsleep(true);
  };

  const sleepMac = (e: React.MouseEvent): void => {
    e.stopPropagation();
    goToSleep();
  };

  const wake = (): void => {
    setAsleep(false);
    // From the desktop, waking asks for the password again (lock screen).
    if (login) setLocked(true);
  };

  useEffect(() => {
    const onCommand = (e: Event) => {
      const cmd = (e as CustomEvent<SystemCommand>).detail;
      if (cmd === "lock") setLocked(true);
      else if (cmd === "sleep") goToSleep();
    };
    window.addEventListener("system:command", onCommand);
    return () => window.removeEventListener("system:command", onCommand);
  }, []);

  // Logging out or rebooting drops any lock.
  useEffect(() => {
    if (!login) setLocked(false);
  }, [login]);

  // While locked, the desktop behind can't be focused, clicked or reached by
  // its keyboard shortcuts.
  useEffect(() => {
    desktopRef.current?.toggleAttribute("inert", locked);
    if (!locked) return;
    const block = (e: KeyboardEvent) => {
      if (!(e.target as HTMLElement)?.closest?.(".lock-overlay")) e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", block, true);
    return () => window.removeEventListener("keydown", block, true);
  }, [locked]);

  // Sleep: any key or click wakes.
  useEffect(() => {
    if (!asleep) return;
    const t0 = Date.now();
    const onKey = (e: KeyboardEvent) => {
      e.stopImmediatePropagation();
      e.preventDefault();
      if (Date.now() - t0 > 400) wake();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asleep]);

  const getPage = () => {
    if (booting) return "boot";
    if (login) return "desktop";
    return "login";
  };

  const page = getPage();

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "transparent" }}>
      {/* Persistent wallpaper — always visible, never absent during transitions */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${wallpaperSrc(dark ? activeWallpaper.night : activeWallpaper.day)})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          zIndex: 0,
        }}
      />

      <AnimatePresence mode="popLayout">
        {page === "boot" && (
          <motion.div
            key="boot"
            className="size-full"
            variants={bootVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ position: "absolute", inset: 0, zIndex: 1 }}
          >
            <Boot restart={restart} sleep={sleep} setBooting={setBooting} />
          </motion.div>
        )}

        {page === "desktop" && (
          <motion.div
            key="desktop"
            ref={desktopRef}
            className="size-full"
            variants={desktopEnterVariants}
            initial="initial"
            animate="animate"
            style={{ position: "absolute", inset: 0, zIndex: 1 }}
          >
            {isMobile ? (
              <Mobile
                setLogin={setLogin}
                shutMac={shutMac}
                sleepMac={sleepMac}
                restartMac={restartMac}
              />
            ) : (
              <Desktop
                setLogin={setLogin}
                shutMac={shutMac}
                sleepMac={sleepMac}
                restartMac={restartMac}
              />
            )}
          </motion.div>
        )}

        {page === "login" && (
          <motion.div
            key="login"
            className="size-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.4 } }}
            exit={loginExitVariants.exit}
            style={{ position: "absolute", inset: 0, zIndex: 1 }}
          >
            <Login
              setLogin={setLogin}
              shutMac={shutMac}
              sleepMac={sleepMac}
              restartMac={restartMac}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lock Screen over the running desktop */}
      <AnimatePresence>
        {locked && page === "desktop" && (
          <motion.div
            key="lock"
            className="size-full lock-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.35 } }}
            exit={{ opacity: 0, scale: 1.03, transition: { duration: 0.35 } }}
            style={{ position: "absolute", inset: 0, zIndex: 50 }}
          >
            <Login
              setLogin={(v) => {
                if (v === true) setLocked(false);
              }}
              shutMac={shutMac}
              sleepMac={sleepMac}
              restartMac={restartMac}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sleep: display off */}
      <AnimatePresence>
        {asleep && (
          <motion.div
            key="sleep"
            className="sleep-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.6 } }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
            onClick={wake}
          >
            <motion.div className="hint" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 2.5, duration: 1 } }}>
              Click or press any key to wake
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* White bloom flash — gentler fade-out on login→desktop */}
      <AnimatePresence>
        {login && flashOnLogin && (
          <motion.div
            key="flash"
            style={{
              position: "absolute",
              inset: 0,
              background: "white",
              pointerEvents: "none",
              zIndex: 9999,
            }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0, transition: { duration: 0.8, delay: 0 } }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Icons are images: a click that moves a few pixels made the browser start
// dragging the image (a little "+" badge) and swallowed the click, so menus
// opened only sometimes. Nothing here uses native image/link drag.
window.addEventListener("dragstart", (e) => {
  if (e.target instanceof HTMLImageElement || e.target instanceof HTMLAnchorElement) e.preventDefault();
});

// public/stale-asset.js reloads an out-of-date page with ?_r=<time> to skip the
// browser cache; tidy the address bar once the current page is here.
{
  const url = new URL(location.href);
  if (url.searchParams.has("_r")) {
    url.searchParams.delete("_r");
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  }
}

const rootElement = document.getElementById("root") as HTMLElement;
const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <PrefsProvider>
      <AudioProvider>
        <App />
      </AudioProvider>
    </PrefsProvider>
  </React.StrictMode>
);
