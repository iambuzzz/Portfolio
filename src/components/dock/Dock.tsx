import { useShallow } from "zustand/react/shallow";
import { useMotionValue } from "framer-motion";
import { motion } from "framer-motion";
import { apps } from "~/configs";
import { useWindowSize } from "~/hooks";
import { useState } from "react";
import { useStore } from "~/stores";
import DockItem from "./DockItem";

interface DockProps {
  open: (id: string) => void;
  showApps: {
    [key: string]: boolean;
  };
  showLaunchpad: boolean;
  toggleLaunchpad: (target: boolean) => void;
  hide: boolean;
}

// Extra width the magnification adds around the hovered icon (same curve as
// DockItem: neighbours within 6 icons grow, the hovered one most).
function magnifyExtra(size: number, mag: number): number {
  const limit = size * 6;
  const xs = [0, limit / (mag * 0.85), limit / (mag * 0.65), limit];
  const ys = [size * mag, size * mag * 0.75, size * mag * 0.55, size];
  const widthAt = (d: number) => {
    for (let i = 1; i < xs.length; i++) {
      if (d <= xs[i]) return ys[i - 1] + ((ys[i] - ys[i - 1]) * (d - xs[i - 1])) / (xs[i] - xs[i - 1]);
    }
    return size;
  };
  let extra = 0;
  for (let k = -6; k <= 6; k++) extra += Math.max(0, widthAt(Math.abs(k) * size) - size);
  return extra;
}

// Largest icon size (then magnification) that keeps the magnified Dock inside
// the viewport, so the end icons never slide out of reach in a narrow window.
function fitDock(available: number, count: number, size: number, mag: number) {
  const fits = (s: number, m: number) => count * s + magnifyExtra(s, m) <= available;
  let s = size;
  while (s > 32 && !fits(s, mag)) s--;
  let m = mag;
  while (m > 1 && !fits(s, m)) m = Math.max(1, m - 0.1);
  return { size: s, mag: m };
}

export default function Dock({
  open,
  showApps,
  showLaunchpad,
  toggleLaunchpad,
  hide
}: DockProps) {
  const { dockSize, dockMag, autoHide } = useStore(useShallow((state) => ({
    dockSize: state.dockSize,
    dockMag: state.dockMag,
    autoHide: state.dockAutoHide
  })));

  // Settings › Desktop & Dock › Automatically hide and show the Dock:
  // reveal at the bottom edge, hide again once the pointer moves away.
  const [reveal, setReveal] = useState(false);
  const hovering = useRef(false);
  useEffect(() => {
    if (!autoHide) return;
    const onMove = (e: MouseEvent) => {
      if (e.clientY >= window.innerHeight - 6) setReveal(true);
      else if (!hovering.current && e.clientY < window.innerHeight - dockSize - 60) setReveal(false);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [autoHide, dockSize]);

  const [bouncingApp, setBouncingApp] = useState<string | null>(null);

  const openApp = (id: string) => {
    if (id === "launchpad") toggleLaunchpad(!showLaunchpad);
    else {
      toggleLaunchpad(false);
      // Trigger bounce animation
      if (!showApps[id]) {
        setBouncingApp(id);
        setTimeout(() => setBouncingApp(null), 700);
      }
      open(id);
    }
  };

  const mouseX = useMotionValue<number | null>(null);
  const { winWidth } = useWindowSize();
  const isMobile = winWidth < 768;
  const tucked = autoHide && !isMobile && !reveal && !showLaunchpad;
  const hidden = hide || tucked;

  // Find separator position (between desktop apps and external links)
  const desktopApps = apps.filter(app => {
    if (app.hideFromDock) return false;
    if (!app.desktop && app.id !== 'launchpad') return false;
    if (isMobile) {
      return !!app.dockOnMobile;
    }
    return true;
  });
  const externalApps = apps.filter(app => {
    if (app.hideFromDock) return false;
    if (app.desktop || app.id === 'launchpad') return false;
    if (isMobile) {
      return !!app.dockOnMobile;
    }
    return true;
  });

  // Side margins, list padding and the separator.
  const fit = isMobile
    ? { size: dockSize, mag: dockMag }
    : fitDock(winWidth - 16 - 20 - 14, desktopApps.length + externalApps.length, dockSize, dockMag);
  const size = fit.size;
  const mag = fit.mag;

  return (
    <motion.div
      className={`dock fixed inset-x-0 mx-2 sm:mx-auto bottom-2 w-full sm:w-max overflow-x-scroll sm:overflow-visible flex justify-center ${hide ? "z-0" : showLaunchpad ? "z-[80]" : "z-50"}`}
      initial={false}
      onMouseEnter={() => (hovering.current = true)}
      onMouseLeave={() => (hovering.current = false)}
      style={{ pointerEvents: hidden ? "none" : undefined }}
      animate={{
        opacity: hide ? 0 : 1,
        y: hidden ? (tucked ? dockSize + 30 : 20) : 0,
      }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 35,
        mass: 0.8,
      }}
    >
      {/* Ambient glow beneath dock */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: -8,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '70%',
          height: 28,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(180,200,255,0.22) 0%, rgba(120,160,255,0.10) 60%, transparent 100%)',
          filter: 'blur(10px)',
          pointerEvents: 'none',
          zIndex: -1,
        }}
      />
      <ul
        className="flex items-end px-2 rounded-none sm:rounded-2xl"
        onMouseMove={(e) => mouseX.set(e.nativeEvent.x)}
        onMouseLeave={() => mouseX.set(null)}
        style={{
          height: `${(size + 15) / 16}rem`,
          padding: '4px 10px',
        }}
      >
        {desktopApps.map((app) => (
          <DockItem
            key={`dock-${app.id}`}
            id={app.id}
            title={(isMobile && app.mobileTitle) ? app.mobileTitle : app.title}
            img={(isMobile && app.mobileImg) ? app.mobileImg : app.img}
            mouseX={mouseX}
            desktop={app.desktop}
            openApp={openApp}
            isOpen={app.desktop && showApps[app.id]}
            link={app.link}
            dockSize={size}
            dockMag={mag}
            isBouncing={bouncingApp === app.id}
          />
        ))}

        {/* Separator */}
        {externalApps.length > 0 && (
          <li className="flex items-center mx-1.5" style={{ height: `${size / 16}rem` }}>
            <div
              style={{
                width: '1px',
                height: '55%',
                background: 'rgba(128,128,128,0.35)',
                borderRadius: '1px',
              }}
            />
          </li>
        )}

        {externalApps.map((app) => (
          <DockItem
            key={`dock-${app.id}`}
            id={app.id}
            title={(isMobile && app.mobileTitle) ? app.mobileTitle : app.title}
            img={(isMobile && app.mobileImg) ? app.mobileImg : app.img}
            mouseX={mouseX}
            desktop={app.desktop}
            openApp={openApp}
            isOpen={false}
            link={app.link}
            dockSize={size}
            dockMag={mag}
            isBouncing={bouncingApp === app.id}
          />
        ))}
      </ul>
    </motion.div>
  );
}
