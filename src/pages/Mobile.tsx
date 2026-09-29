import { useShallow } from "zustand/react/shallow";
import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useAnimationControls, useMotionValue, type AnimationControls } from "framer-motion";
import { wallpaperSrc } from "~/utils";
import AppLoading from "~/components/AppLoading";
import AppErrorBoundary from "~/components/AppErrorBoundary";
import { apps } from "~/configs";
import { profile } from "~/data/profile";
import { useStore, useWallpaper } from "~/stores";
import type { MacActions } from "~/types";
import StatusBar from "~/components/mobile/StatusBar";
import ControlCenterMenu from "~/components/menus/ControlCenterMenu";
import NotificationCenter from "~/components/NotificationCenter";
import { LayerActive } from "~/components/mobile/layerActive";
import { usePrefs } from "~/settings/prefs";
import { enterFullScreen, exitFullScreen, isFullScreen } from "~/utils/screen";
import Spotlight from "~/components/Spotlight";
import Siri from "~/components/apps/Siri";
import AppLibrary from "~/components/mobile/AppLibrary";
import { MobileIcon, type MobileEntry } from "~/components/mobile/MobileIcon";
import { ProfileWidget, WeatherSmall, GitHubSmall, MusicWidget, CalendarSmall, ProjectsWidget } from "~/components/mobile/MobileWidgets";
import { useAudioContext } from "~/context/AudioContext";
import { unlock, useActivity } from "~/settings/activity";
import { AchievementToasts } from "~/settings/Effects";
import "~/styles/mobile.css";

// iPhone-style shell: paged home screen with widgets, an App Library, apps that
// zoom out of their icons, a home bar (tap / flick up = home, drag up and hold =
// app switcher with live cards), and Siri as an edge glow with a bottom panel.

// iPhones don't let websites go full screen; the icon only appears where it works.
const CAN_FULLSCREEN =
  typeof document !== "undefined" && !!(document.fullscreenEnabled || (document as Document & { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled);

const DOCK = ["terminal", "bear", "about", "siri", "spotify"];
const PAGE_APPS = [
  // Full Screen sits second on page 1 (Maps takes Clock's spot; Clock lives in
  // the App Library); on iPhones, which can't go full screen, the original order stays.
  CAN_FULLSCREEN
    ? ["photos", "action:fullscreen", "notes", "mail", "maps", "facetime", "finder", "system-settings"]
    : ["photos", "maps", "notes", "mail", "clock", "facetime", "finder", "system-settings"],
  ["messages", "safari", "vscode", ...profile.projects.map((p) => `project:${p.id}`), "link:resume", "link:github"]
];
const MAX_RECENTS = 6;
// Apps with dark chrome: black behind the status bar, white status text.
const DARK_APPS = new Set(["terminal", "spotify", "vscode", "facetime"]);
const TRACKED_APPS = apps.filter((a) => a.desktop && a.id !== "siri").length;

const ENTRIES: MobileEntry[] = [
  ...apps
    .filter((a) => a.desktop)
    .map((a) => ({
      id: a.id,
      title: a.mobileTitle ?? (a.id === "about" ? "About Me" : a.title),
      img: a.mobileImg ?? a.img,
      // macOS icons fill ~81% of their canvas; Spotify is full-bleed.
      scale: a.mobileImg || a.id === "spotify" ? 1 : a.id === "about" ? 1.07 : 1.235,
      bg: a.id === "spotify" ? "#000" : undefined
    })),
  ...profile.projects.map((p) => ({ id: `project:${p.id}`, title: p.name, img: p.logo, url: p.live })),
  { id: "link:resume", title: "Résumé", img: "img/icons/resume.svg", url: profile.resume, external: true },
  { id: "link:github", title: "GitHub", img: "img/sites/github.svg", url: profile.socials.github, external: true },
  ...(CAN_FULLSCREEN ? [{ id: "action:fullscreen", title: "Full Screen", img: "img/icons/fullscreen.svg" }] : [])
];
const ENTRY = new Map(ENTRIES.map((e) => [e.id, e]));

type Mode = "home" | "app" | "switcher";
// React 18 has no `inert` prop yet; the attribute still works.
const inert = (on: boolean) => (on ? ({ inert: "" } as Record<string, string>) : {});
interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

// ── One running app (kept mounted while it's in the switcher) ───────────────
const AppLayer = React.memo(function AppLayer({
  id,
  register,
  hidden
}: {
  id: string;
  register: (id: string, c: { layer: AnimationControls; icon: AnimationControls } | null) => void;
  hidden: boolean;
}) {
  const layer = useAnimationControls();
  const icon = useAnimationControls();
  useEffect(() => {
    register(id, { layer, icon });
    return () => register(id, null);
  }, [id, layer, icon, register]);
  const app = apps.find((a) => a.id === id)!;
  const entry = ENTRY.get(id)!;
  return (
    <motion.div className={`m-layer ${DARK_APPS.has(id) ? "dark-app" : ""}`} data-layer={id} initial={{ visibility: "hidden" }} animate={layer} {...inert(hidden)}>
      <div className="m-layer-body">
        <AppErrorBoundary name={app.title}>
          <LayerActive.Provider value={!hidden}>
            <Suspense fallback={<AppLoading />}>{app.content}</Suspense>
          </LayerActive.Provider>
        </AppErrorBoundary>
      </div>
      <motion.div className="m-layer-icon" initial={{ opacity: 0 }} animate={icon}>
        <MobileIcon entry={entry} size={0} bare />
      </motion.div>
    </motion.div>
  );
});

export default function Mobile(_props: MacActions) {
  const { dark, brightness, setVolume, setBrightness, setSafariUrl, focusMode } = useStore(
    useShallow((s) => ({ dark: s.dark, brightness: s.brightness, setVolume: s.setVolume, setBrightness: s.setBrightness, setSafariUrl: s.setSafariUrl, focusMode: s.focusMode }))
  );
  const activeWallpaper = useWallpaper();
  const { audioState, controls } = useAudioContext();

  const [W, setW] = useState(window.innerWidth);
  const [H, setH] = useState(window.innerHeight);
  useEffect(() => {
    const on = () => (setW(window.innerWidth), setH(window.innerHeight));
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  const [recents, setRecents] = useState<string[]>([]); // oldest → newest
  const [active, setActive] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("home");
  const [page, setPage] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [showSiri, setShowSiri] = useState(false);
  const [showCC, setShowCC] = useState(false);
  const [showNC, setShowNC] = useState(false);
  const [resumeSheet, setResumeSheet] = useState(false);
  const ccBtnRef = useRef<HTMLDivElement>(null);
  const searchBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => unlock("hello"), []);

  // Animation controls of each mounted app layer.
  const ctl = useRef(new Map<string, { layer: AnimationControls; icon: AnimationControls }>());
  const register = useCallback((id: string, c: { layer: AnimationControls; icon: AnimationControls } | null) => {
    if (c) ctl.current.set(id, c);
    else ctl.current.delete(id);
  }, []);

  // ── geometry ──────────────────────────────────────────────────────────────
  const fullPose = { x: 0, y: 0, scaleX: 1, scaleY: 1, borderRadius: 0, opacity: 1, visibility: "visible" as const };
  const boxPose = (b: Box) => ({
    x: b.left,
    y: b.top,
    scaleX: b.width / W,
    scaleY: b.height / H,
    borderRadius: W * 0.23,
    opacity: 1,
    visibility: "visible" as const
  });
  const centerBox = (): Box => ({ left: W / 2 - 32, top: H / 2 - 32, width: 64, height: 64 });
  const iconBox = (id: string): Box => {
    const el = [...document.querySelectorAll<HTMLElement>(`.m-home [data-app-icon="${id}"], .m-dock [data-app-icon="${id}"]`)].find((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.left >= -1 && r.right <= W + 1;
    });
    const r = el?.getBoundingClientRect();
    return r ? { left: r.left, top: r.top, width: r.width, height: r.height } : centerBox();
  };
  const SW = 0.62; // switcher card scale
  const cardW = W * SW;
  const spacing = cardW * 0.84;
  const [scroll, setScroll] = useState(0);
  const cardPose = (i: number, n: number, sc: number, lift = 0) => ({
    x: (W - cardW) / 2 + (i - (n - 1)) * spacing + sc,
    y: (H - H * SW) / 2 - 8 + lift,
    scaleX: SW,
    scaleY: SW,
    borderRadius: 34 / SW,
    opacity: 1,
    visibility: "visible" as const
  });

  // ── history: the phone's Back button closes the app instead of the site ──
  const pushed = useRef(false);
  const goHomeRef = useRef<(fromPop?: boolean) => void>(() => {});
  useEffect(() => {
    const onPop = () => {
      if (!pushed.current) return;
      pushed.current = false;
      goHomeRef.current(true);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // ── open / home / switcher ────────────────────────────────────────────────
  const pendingOpen = useRef<{ id: string; from: Box | "card" } | null>(null);
  const runOpen = useCallback(() => {
    const p = pendingOpen.current;
    const c = p && ctl.current.get(p.id);
    if (!p || !c) return;
    pendingOpen.current = null;
    if (p.from !== "card") {
      c.layer.set(boxPose(p.from));
      c.icon.set({ opacity: 1 });
      c.icon.start({ opacity: 0, transition: { duration: 0.22, delay: 0.06 } });
    }
    c.layer.start({ ...fullPose, transition: { type: "spring", stiffness: 260, damping: 30, mass: 0.9 } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H]);
  // A newly mounted layer: wait a frame so its controls are attached (StrictMode
  // mounts twice in development, which stopped an animation started at once).
  useEffect(() => {
    if (!pendingOpen.current) return;
    const raf = requestAnimationFrame(runOpen);
    return () => cancelAnimationFrame(raf);
  });

  const openApp = useCallback(
    (id: string, from?: Box | "card") => {
      if (id === "siri") return setShowSiri(true);
      const app = apps.find((a) => a.id === id);
      if (!app) return;
      if (!pushed.current) {
        history.pushState({ mApp: true }, "");
        pushed.current = true;
      }
      useActivity.getState().recordAppOpen(id, TRACKED_APPS);
      // Any other visible app/cards go away.
      for (const [other, c] of ctl.current) if (other !== id) c.layer.start({ opacity: 0, transition: { duration: 0.15 }, transitionEnd: { visibility: "hidden" } });
      setRecents((r) => [...r.filter((x) => x !== id), id].slice(-MAX_RECENTS));
      setActive(id);
      setMode("app");
      setShowSearch(false);
      pendingOpen.current = { id, from: from ?? centerBox() };
      if (ctl.current.has(id)) runOpen();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [W, H, runOpen]
  );

  const openEntry = useCallback(
    (e: MobileEntry, tile?: HTMLElement) => {
      const r = tile?.getBoundingClientRect();
      const from = r ? { left: r.left, top: r.top, width: r.width, height: r.height } : undefined;
      if (e.id === "action:fullscreen") return void (isFullScreen() ? exitFullScreen() : enterFullScreen());
      if (e.id === "link:resume") return setResumeSheet(true);
      if (e.url && e.external) window.open(e.url, "_blank", "noopener");
      else if (e.url) {
        setSafariUrl(e.url);
        openApp("safari", from);
      } else openApp(e.id, from);
    },
    [openApp, setSafariUrl]
  );

  const goHome = (fromPop = false) => {
    if (pushed.current && !fromPop) {
      pushed.current = false;
      history.back();
    }
    if (mode === "app" && active) {
      const c = ctl.current.get(active);
      c?.icon.start({ opacity: 1, transition: { duration: 0.18, delay: 0.08 } });
      c?.layer.start({ ...boxPose(iconBox(active)), transition: { type: "spring", stiffness: 300, damping: 32 }, transitionEnd: { visibility: "hidden" } });
    } else {
      for (const c of ctl.current.values()) c.layer.start({ opacity: 0, scaleX: SW * 0.9, scaleY: SW * 0.9, transition: { duration: 0.2 }, transitionEnd: { visibility: "hidden" } });
    }
    setMode("home");
    setActive(null);
  };
  goHomeRef.current = goHome;

  const enterSwitcher = () => {
    if (!recents.length) return goHome();
    setScroll(0);
    setMode("switcher");
    recents.forEach((id, i) => {
      const c = ctl.current.get(id);
      // Cards show the live app, not the icon left from zooming home.
      c?.icon.set({ opacity: 0 });
      c?.layer.start({ ...cardPose(i, recents.length, 0), transition: { type: "spring", stiffness: 300, damping: 32 } });
    });
    if (!pushed.current) {
      history.pushState({ mApp: true }, "");
      pushed.current = true;
    }
  };

  const quitApp = (id: string) => {
    const next = recents.filter((x) => x !== id);
    setRecents(next);
    if (active === id) setActive(null);
    if (!next.length) return goHome();
    const sc = Math.min(scroll, (next.length - 1) * spacing);
    setScroll(sc);
    next.forEach((x, i) => ctl.current.get(x)?.layer.start({ ...cardPose(i, next.length, sc), transition: { type: "spring", stiffness: 300, damping: 32 } }));
  };

  // Apps, Siri and Spotlight ask the shell to open things through events.
  useEffect(() => {
    const onOpen = (e: Event) => openApp((e as CustomEvent<string>).detail);
    const onClose = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (id === "siri") setShowSiri(false);
      else if (id === active) goHomeRef.current();
    };
    const onSafari = () => openApp("safari");
    const onLaunchpad = () => {
      goHomeRef.current();
      setPage(2);
    };
    window.addEventListener("app:open", onOpen);
    window.addEventListener("app:close", onClose);
    window.addEventListener("launchpad:openSafari", onSafari);
    window.addEventListener("siri:openLaunchpad", onLaunchpad);
    return () => {
      window.removeEventListener("app:open", onOpen);
      window.removeEventListener("app:close", onClose);
      window.removeEventListener("launchpad:openSafari", onSafari);
      window.removeEventListener("siri:openLaunchpad", onLaunchpad);
    };
  }, [openApp, active]);

  // ── home bar gesture (inside an app) ──────────────────────────────────────
  const bar = useRef<{ y0: number; t0: number; samples: [number, number][] } | null>(null);
  const onBarDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    bar.current = { y0: e.clientY, t0: performance.now(), samples: [[performance.now(), e.clientY]] };
  };
  const onBarMove = (e: React.PointerEvent) => {
    const b = bar.current;
    if (!b || !active) return;
    const dy = Math.min(0, e.clientY - b.y0);
    b.samples.push([performance.now(), e.clientY]);
    if (b.samples.length > 6) b.samples.shift();
    const s = 1 - Math.min(0.42, (-dy / H) * 0.9);
    ctl.current.get(active)?.layer.set({ x: (W - W * s) / 2, y: (H - H * s) / 2 + dy * 0.55, scaleX: s, scaleY: s, borderRadius: 40 / s });
  };
  const onBarUp = (e: React.PointerEvent) => {
    const b = bar.current;
    bar.current = null;
    if (!b || !active) return;
    const dy = e.clientY - b.y0;
    const [t1, y1] = b.samples[0];
    const v = (e.clientY - y1) / Math.max(1, performance.now() - t1); // px/ms, negative = up
    if (Math.abs(dy) < 8) return goHome(); // tap
    if (v < -0.55 || dy < -H * 0.42) return goHome();
    if (dy < -50) return enterSwitcher();
    ctl.current.get(active)?.layer.start({ ...fullPose, transition: { type: "spring", stiffness: 400, damping: 34 } });
  };

  // ── switcher gestures ─────────────────────────────────────────────────────
  const sw = useRef<{ x0: number; y0: number; sc0: number; card: string | null; axis: "x" | "y" | null } | null>(null);
  const cardAt = (x: number, y: number): string | null => {
    const n = recents.length;
    for (let i = n - 1; i >= 0; i--) {
      const p = cardPose(i, n, scroll);
      if (x >= p.x && x <= p.x + cardW && y >= p.y - 30 && y <= p.y + H * SW) return recents[i];
    }
    return null;
  };
  const onSwDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    sw.current = { x0: e.clientX, y0: e.clientY, sc0: scroll, card: cardAt(e.clientX, e.clientY), axis: null };
  };
  const onSwMove = (e: React.PointerEvent) => {
    const s = sw.current;
    if (!s) return;
    const dx = e.clientX - s.x0;
    const dy = e.clientY - s.y0;
    if (!s.axis && Math.hypot(dx, dy) > 8) s.axis = Math.abs(dx) > Math.abs(dy) || !s.card ? "x" : "y";
    const n = recents.length;
    if (s.axis === "x") {
      const sc = Math.max(0, Math.min((n - 1) * spacing, s.sc0 + dx));
      setScroll(sc);
      recents.forEach((id, i) => ctl.current.get(id)?.layer.set(cardPose(i, n, sc)));
    } else if (s.axis === "y" && s.card) {
      const i = recents.indexOf(s.card);
      ctl.current.get(s.card)?.layer.set(cardPose(i, n, scroll, Math.min(0, dy)));
    }
  };
  const onSwUp = (e: React.PointerEvent) => {
    const s = sw.current;
    sw.current = null;
    if (!s) return;
    const dy = e.clientY - s.y0;
    const n = recents.length;
    if (!s.axis) {
      // Tap: a card opens its app, empty space goes home.
      if (s.card) {
        const c = ctl.current.get(s.card);
        for (const [id, o] of ctl.current) if (id !== s.card) o.layer.start({ opacity: 0, transition: { duration: 0.15 }, transitionEnd: { visibility: "hidden" } });
        setRecents((r) => [...r.filter((x) => x !== s.card), s.card!]);
        setActive(s.card);
        setMode("app");
        c?.layer.start({ ...fullPose, transition: { type: "spring", stiffness: 280, damping: 30 } });
      } else goHome();
      return;
    }
    if (s.axis === "y" && s.card) {
      const i = recents.indexOf(s.card);
      if (dy < -H * 0.16) {
        ctl.current.get(s.card)?.layer.start({ y: -H, opacity: 0, transition: { duration: 0.22 }, transitionEnd: { visibility: "hidden" } });
        setTimeout(() => quitApp(s.card!), 180);
      } else ctl.current.get(s.card)?.layer.start({ ...cardPose(i, n, scroll), transition: { type: "spring", stiffness: 400, damping: 32 } });
    }
  };

  // ── home pages (swipe) ────────────────────────────────────────────────────
  const PAGES = 3;
  const dragged = useRef(false);
  // The pages' x is driven directly: after every swipe it snaps to the page,
  // even when the page number didn't change (short swipe, or past the last
  // page). A declarative `animate` only re-runs on change, which left the pages
  // stranded, most visibly with Reduce Motion (animations are skipped).
  const pagesX = useMotionValue(0);
  // Pages off-screen are hidden while the home screen is still: their frosted
  // widgets otherwise cost the GPU a blur pass every frame (opening/closing apps
  // lagged on phones). They're shown again the moment a swipe starts.
  const [pagesMoving, setPagesMoving] = useState(false);
  const [pagesEase, setPagesEase] = useState(false);
  const snapRun = useRef(0);
  const snapPages = useCallback(
    (p: number) => {
      const run = ++snapRun.current;
      setPagesMoving(true);
      const done = () => run === snapRun.current && setPagesMoving(false);
      // Reduce Motion: framer skips its animations (and returns nothing), so the
      // page would jump. Use a short plain CSS slide instead (.m-pages-ease).
      const anim = usePrefs.getState().reduceMotion
        ? undefined
        : (animate(pagesX, -p * W, { type: "spring", stiffness: 320, damping: 34 }) as ReturnType<typeof animate> | undefined);
      if (anim) anim.then(done);
      else {
        setPagesEase(true);
        // Next frame: after a swipe, framer's own drag-end step (instant under
        // Reduce Motion) would otherwise overwrite this position.
        requestAnimationFrame(() => run === snapRun.current && pagesX.set(-p * W));
        setTimeout(() => {
          if (run !== snapRun.current) return;
          pagesX.set(-p * W);
          setPagesEase(false);
          done();
        }, 260);
      }
    },
    [pagesX, W]
  );
  useEffect(() => {
    snapPages(page);
  }, [page, snapPages]);
  const pageTo = (p: number) => {
    const next = Math.max(0, Math.min(PAGES - 1, p));
    setPage(next);
    snapPages(next);
  };
  const [longPress, setLongPress] = useState(false);

  const setAudioVolume = (v: number) => {
    setVolume(v);
    controls.volume(v / 100);
  };

  // Brightness 50 is the default. The wallpaper keeps its usual shade (same
  // scale as the laptop); below the default the whole phone dims too, down
  // to 50% darker at 0.
  const dimBy = Math.max(0, (50 - (brightness as number)) / 100);
  const statusDark = mode === "app" && !dark && !(active && DARK_APPS.has(active)); // dark text on light apps
  const inApp = mode === "app";
  const home = mode !== "app";
  const dockEntries = DOCK.map((id) => ENTRY.get(id)!).filter(Boolean);

  return (
    <div className={`m-root ${dark ? "dark" : ""}`}>
      {/* Brightness dims the wallpaper only, like the desktop. */}
      <div
        className="m-wall"
        style={{ backgroundImage: `url(${wallpaperSrc(dark ? activeWallpaper.night : activeWallpaper.day)})`, filter: `brightness(${(brightness as number) * 0.7 + 50}%)` }}
      />

      <StatusBar
        isAppOpen={inApp}
        dark={statusDark || (showCC && !dark)}
        onLeftTap={() => setShowNC((v) => !v)}
        onRightTap={() => setShowCC((v) => !v)}
        onIslandTap={(live) => openApp(live ? "spotify" : "facetime")}
        rightRef={ccBtnRef}
      />

      {/* Home screen */}
      <motion.div
        className="m-home"
        animate={{
          scale: home ? (mode === "switcher" ? 0.92 : 1) : 0.9,
          opacity: home ? (mode === "switcher" ? 0.35 : 1) : 0,
          filter: mode === "switcher" ? "blur(12px)" : "blur(0px)",
          ...(home ? { visibility: "visible" } : {}),
          // Performance only: once settled, drop the no-op blur (a filter makes the
          // browser re-render every frosted widget off-screen), and stop drawing
          // the home screen at all while an app covers it.
          transitionEnd: { ...(mode === "switcher" ? {} : { filter: "none" }), ...(home ? {} : { visibility: "hidden" }) }
        }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
        {...inert(!home || mode === "switcher")}
      >
        <motion.div
          className={`m-pages ${pagesEase ? "m-pages-ease" : ""}`}
          style={{ width: W * PAGES, x: pagesX }}
          drag="x"
          dragDirectionLock
          dragConstraints={{ left: -(PAGES - 1) * W, right: 0 }}
          dragElastic={0.18}
          dragMomentum={false}
          onDragStart={() => {
            dragged.current = true;
            snapRun.current++;
            setPagesEase(false);
            setPagesMoving(true);
          }}
          onDragEnd={(_, info) => {
            setTimeout(() => (dragged.current = false), 0);
            if (info.offset.x < -W * 0.18 || info.velocity.x < -400) pageTo(page + 1);
            else if (info.offset.x > W * 0.18 || info.velocity.x > 400) pageTo(page - 1);
            else pageTo(page);
          }}
          onClickCapture={(e) => dragged.current && e.stopPropagation()}
        >
          {/* Page 1 */}
          <div className={`m-page ${!pagesMoving && page !== 0 ? "m-page-off" : ""}`} style={{ width: W }}>
            <div className="m-grid">
              <div className="m-span-4x2">
                <ProfileWidget openApp={(id) => openApp(id)} />
              </div>
              <div className="m-span-2x2">
                <WeatherSmall />
              </div>
              <div className="m-span-2x2">
                <GitHubSmall />
              </div>
              {PAGE_APPS[0].map((id) => (
                <MobileIcon key={id} entry={ENTRY.get(id)!} size={0} label onOpen={openEntry} />
              ))}
            </div>
          </div>
          {/* Page 2 */}
          <div className={`m-page ${!pagesMoving && page !== 1 ? "m-page-off" : ""}`} style={{ width: W }}>
            <div className="m-grid">
              <div className="m-span-4x2">
                <MusicWidget openApp={(id) => openApp(id)} />
              </div>
              <div className="m-span-2x2">
                <CalendarSmall openApp={(id) => openApp(id)} />
              </div>
              <div className="m-span-2x2">
                <ProjectsWidget openProject={(url) => openEntry({ id: "safari", title: "Safari", img: "", url })} />
              </div>
              {PAGE_APPS[1].map((id) => (
                <MobileIcon key={id} entry={ENTRY.get(id)!} size={0} label onOpen={openEntry} />
              ))}
            </div>
          </div>
          {/* Page 3: App Library */}
          <div className={`m-page ${!pagesMoving && page !== 2 ? "m-page-off" : ""}`} style={{ width: W }}>
            <AppLibrary entries={ENTRIES} onOpen={openEntry} />
          </div>
        </motion.div>

        {/* Search pill + page dots */}
        <div className="m-search-row">
          <div ref={searchBtnRef}>
            <button type="button" className="m-search-pill" onClick={() => setShowSearch(true)} onContextMenu={(e) => (e.preventDefault(), setLongPress(true))}>
              <span className="i-ph:magnifying-glass-bold" /> Search
            </button>
          </div>
          <div className="m-dots" role="tablist" aria-label="Home screen pages">
            {Array.from({ length: PAGES }, (_, i) => (
              <button type="button" key={i} role="tab" aria-selected={i === page} aria-label={i === PAGES - 1 ? "App Library" : `Page ${i + 1}`} className={i === page ? "on" : ""} onClick={() => pageTo(i)} />
            ))}
          </div>
        </div>

        {/* Dock */}
        <div className="m-dock">
          {dockEntries.map((e) => (
            <MobileIcon key={e.id} entry={e} size={0} onOpen={openEntry} />
          ))}
        </div>
      </motion.div>

      {/* Running apps (live; also the app switcher's cards) */}
      {recents.map((id) => (
        <AppLayer key={id} id={id} register={register} hidden={!(mode === "app" && active === id)} />
      ))}

      {/* Home bar inside apps */}
      {inApp && (
        <div className={`m-homebar ${active && DARK_APPS.has(active) ? "on-dark" : ""}`} onPointerDown={onBarDown} onPointerMove={onBarMove} onPointerUp={onBarUp} onPointerCancel={onBarUp} aria-label="Home" role="button">
          <span />
        </div>
      )}

      {/* App switcher */}
      {mode === "switcher" && (
        <div className="m-switcher" onPointerDown={onSwDown} onPointerMove={onSwMove} onPointerUp={onSwUp} onPointerCancel={onSwUp}>
          {recents.map((id, i) => {
            const p = cardPose(i, recents.length, scroll);
            const e = ENTRY.get(id)!;
            return (
              <div key={id} className="m-card-label" style={{ transform: `translate(${p.x}px, ${p.y - 34}px)`, zIndex: i + 1 }}>
                <MobileIcon entry={e} size={26} bare />
                <span>{e.title}</span>
              </div>
            );
          })}
          <div className="m-switcher-hint">Swipe a card up to close it · tap to open</div>
        </div>
      )}

      {/* Résumé: view in a tab, or download the PDF (iOS action sheet) */}
      <AnimatePresence>
        {resumeSheet && (
          <motion.div className="m-sheet-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setResumeSheet(false)}>
            <motion.div
              className="m-sheet"
              role="dialog"
              aria-label="Résumé"
              initial={{ y: "110%" }}
              animate={{ y: 0 }}
              exit={{ y: "110%" }}
              transition={{ type: "spring", stiffness: 420, damping: 38 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="m-sheet-group">
                <div className="m-sheet-title">
                  <img src="/img/icons/resume.svg" alt="" />
                  <span>
                    <b>{profile.resumeFileName}</b>
                    <small>PDF · {profile.name}</small>
                  </span>
                </div>
                <button
                  type="button"
                  className="m-sheet-btn"
                  onClick={() => {
                    setResumeSheet(false);
                    window.open(profile.resume, "_blank", "noopener");
                  }}
                >
                  <span className="i-ph:eye" /> View Résumé
                </button>
                <a className="m-sheet-btn" href={profile.resumeDownload} download={profile.resumeFileName} onClick={() => setResumeSheet(false)}>
                  <span className="i-ph:download-simple" /> Download PDF
                </a>
              </div>
              <button type="button" className="m-sheet-btn m-sheet-cancel" onClick={() => setResumeSheet(false)}>
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spotlight */}
      <AnimatePresence>
        {showSearch && (
          <motion.div className="m-spot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Spotlight
              openApp={(id) => openApp(id)}
              toggleLaunchpad={() => {
                setShowSearch(false);
                setPage(2);
              }}
              toggleSpotlight={() => setShowSearch(false)}
              btnRef={searchBtnRef as React.RefObject<HTMLDivElement>}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Siri: edge glow + bottom panel */}
      <AnimatePresence>
        {(showSiri || longPress) && (
          <motion.div key="siri" className="m-siri" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <div className="m-siri-glow" aria-hidden />
            <div className="m-siri-catch" onClick={() => (setShowSiri(false), setLongPress(false))} />
            <motion.div className="m-siri-panel" initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} transition={{ type: "spring", stiffness: 320, damping: 30 }}>
              <Siri mobile closeSiri={() => (setShowSiri(false), setLongPress(false))} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Control Center / Notification Center (swipe down from the top corners) */}
      <div className="m-edge left" onTouchStart={swipeDown(() => setShowNC(true))} onTouchMove={swipeDown(() => setShowNC(true))} />
      <div className="m-edge right" onTouchStart={swipeDown(() => setShowCC(true))} onTouchMove={swipeDown(() => setShowCC(true))} />
      <AnimatePresence>
        {showCC && (
          <ControlCenterMenu
            playing={audioState.playing}
            toggleAudio={controls.toggle}
            setVolume={setAudioVolume}
            setBrightness={setBrightness}
            toggleControlCenter={() => setShowCC(false)}
            btnRef={ccBtnRef}
          />
        )}
      </AnimatePresence>
      <NotificationCenter show={showNC} onClose={() => setShowNC(false)} />
      {/* Brightness below normal dims the whole phone (apps, panels, everything),
          like the laptop. A plain overlay: cheaper than filtering the page. */}
      {dimBy > 0 && <div className="m-dim" aria-hidden style={{ opacity: dimBy }} />}
      {/* Focus (Control Center) hides pop-ups; they are still recorded in Screen Time. */}
      {!focusMode && <AchievementToasts />}
    </div>
  );
}

// Touch helper: a downward swipe of 30px from the top edge.
function swipeDown(fire: () => void) {
  return (e: React.TouchEvent<HTMLDivElement>) => {
    const el = e.currentTarget as HTMLDivElement & { y0?: number };
    const y = e.touches[0].clientY;
    if (e.type === "touchstart") el.y0 = y;
    else if (el.y0 !== undefined && y - el.y0 > 30) {
      el.y0 = undefined;
      fire();
    }
  };
}
