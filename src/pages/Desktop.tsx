import { useWallpaper } from "~/stores";
import { useShallow } from "zustand/react/shallow";
import React, { Suspense } from "react";
import { apps, launchpadApps } from "~/configs";
import { minMarginY, isFullScreen, wallpaperSrc } from "~/utils";
import AppLoading from "~/components/AppLoading";
import AppErrorBoundary from "~/components/AppErrorBoundary";
import type { MacActions } from "~/types";
import DynamicIsland from "~/components/DynamicIsland";
import NotificationCenter from "~/components/NotificationCenter";
import AboutThisMacModal from "~/components/AboutThisMacModal";
import DesktopWidgets from "~/components/widgets/DesktopWidgets";
import ContextMenu from "~/components/menus/ContextMenu";
import { FolderIcon, FolderHomeIcon, FolderDockIcon, PdfIcon } from "~/components/DesktopIcons";
import { AnimatePresence, motion } from "framer-motion";
import { useWindowSize } from "~/hooks";

interface DesktopState {
  showApps: { [key: string]: boolean };
  appsZ: { [key: string]: number };
  maxApps: { [key: string]: boolean };
  minApps: { [key: string]: boolean };
  maxZ: number;
  showLaunchpad: boolean;
  currentTitle: string;
  spotlight: boolean;
  showNotificationCenter: boolean;
}

// Build the initial state map from apps config — includes ALL apps
function buildInitialState(): Pick<DesktopState, "showApps" | "appsZ" | "maxApps" | "minApps"> {
  const showApps: { [key: string]: boolean } = {};
  const appsZ: { [key: string]: number } = {};
  const maxApps: { [key: string]: boolean } = {};
  const minApps: { [key: string]: boolean } = {};
  apps.forEach((app) => {
    showApps[app.id] = !!app.show;
    appsZ[app.id] = 2;
    maxApps[app.id] = false;
    minApps[app.id] = false;
  });
  return { showApps, appsZ, maxApps, minApps };
}

const INITIAL = buildInitialState();

export default function Desktop(props: MacActions) {
  const [state, setState] = useState<DesktopState>({
    ...INITIAL,
    maxZ: 2,
    showLaunchpad: false,
    currentTitle: "Finder",
    spotlight: false,
    showNotificationCenter: false,
  });

  const [spotlightBtnRef, setSpotlightBtnRef] =
    useState<React.RefObject<HTMLDivElement> | null>(null);
  const [showAboutMac, setShowAboutMac] = useState(false);

  const { dark, brightness } = useStore(useShallow((s) => ({
    dark: s.dark,
    brightness: s.brightness,
  })));

  const { isMobile } = useWindowSize();

  const activeWallpaper = useWallpaper();

  const handleLaunchpadAppClick = (e: React.MouseEvent, link: string) => {
    e.stopPropagation();
    e.preventDefault();
    useStore.getState().setSafariUrl(link);
    window.dispatchEvent(new CustomEvent("launchpad:openSafari"));
  };

  // Listen for cross-component events and global keyboard shortcuts
  useEffect(() => {
    const handleOpenSafari = () => {
      toggleLaunchpad(false);
      openApp("safari");
    };
    const handleOpenLaunchpad = () => toggleLaunchpad(true);
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // System independent Command key (Cmd on Mac, Ctrl on Windows/Linux)
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // Spotlight: Cmd/Ctrl + Space
      if (isCmdOrCtrl && e.code === 'Space') {
        e.preventDefault();
        toggleSpotlight();
      }

      // Full screen: exactly Cmd/Ctrl + F, or F11. Anything with Shift/Alt
      // (e.g. Chrome's Cmd+Shift+F) is left to the browser.
      if ((isCmdOrCtrl && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "f") || e.key === "F11") {
        e.preventDefault();
        useStore.getState().toggleFullScreen(!isFullScreen());
      }

      // Brightness Down: Cmd/Ctrl + Down Arrow OR F1
      if ((isCmdOrCtrl && e.key === 'ArrowDown') || e.key === 'F1') {
        e.preventDefault();
        const currentBrightness = useStore.getState().brightness as number;
        useStore.getState().setBrightness(Math.max(currentBrightness - 10, 1));
      }

      // Brightness Up: Cmd/Ctrl + Up Arrow OR F2
      if ((isCmdOrCtrl && e.key === 'ArrowUp') || e.key === 'F2') {
        e.preventDefault();
        const currentBrightness = useStore.getState().brightness as number;
        useStore.getState().setBrightness(Math.min(currentBrightness + 10, 100));
      }
    };

    const handleAppOpen = (e: Event) => openApp((e as CustomEvent<string>).detail);
    const handleAppClose = (e: Event) => closeApp((e as CustomEvent<string>).detail);
    window.addEventListener("app:open", handleAppOpen);
    window.addEventListener("app:close", handleAppClose);
    window.addEventListener("launchpad:openSafari", handleOpenSafari);
    window.addEventListener("siri:openLaunchpad", handleOpenLaunchpad);
    window.addEventListener("keydown", handleKeyDown);
    // Keep the Control Center toggle in sync when the visitor leaves full
    // screen with Esc or the browser's own controls.
    const handleFsChange = () => useStore.setState({ fullscreen: isFullScreen() });
    document.addEventListener("fullscreenchange", handleFsChange);
    
    return () => {
      window.removeEventListener("app:open", handleAppOpen);
      window.removeEventListener("app:close", handleAppClose);
      window.removeEventListener("launchpad:openSafari", handleOpenSafari);
      window.removeEventListener("siri:openLaunchpad", handleOpenLaunchpad);
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFsChange);
    };
  }, [state]);  // re-bind when state updates so closures are fresh

  const toggleLaunchpad = (target: boolean): void => {
    setState((prev) => ({ ...prev, showLaunchpad: target }));
  };

  const toggleSpotlight = (): void => {
    setState((prev) => ({ ...prev, spotlight: !prev.spotlight }));
  };

  const toggleNotificationCenter = (): void => {
    setState((prev) => ({ ...prev, showNotificationCenter: !prev.showNotificationCenter }));
  };

  const setWindowPosition = (id: string): void => {
    const r = document.querySelector(`#window-${id}`) as HTMLElement;
    if (!r) return;
    const rect = r.getBoundingClientRect();
    r.style.setProperty("--window-transform-x", (window.innerWidth + rect.x).toFixed(1) + "px");
    r.style.setProperty("--window-transform-y", (rect.y - minMarginY).toFixed(1) + "px");
  };

  const setAppMax = (id: string, target?: boolean): void => {
    setState((prev) => {
      const maxApps = { ...prev.maxApps };
      if (target === undefined) target = !maxApps[id];
      maxApps[id] = target!;
      return { ...prev, maxApps };
    });
  };

  const minimizeApp = (id: string): void => {
    setWindowPosition(id);
    const dock = document.querySelector(`#dock-${id}`) as HTMLElement;
    const win = document.querySelector(`#window-${id}`) as HTMLElement;
    if (!dock || !win) return;
    const dockRect = dock.getBoundingClientRect();
    const posY = window.innerHeight - win.offsetHeight / 2 - minMarginY;
    const posX = window.innerWidth + dockRect.x - win.offsetWidth / 2 + 25;
    win.style.transform = `translate(${posX}px, ${posY}px) scale(0.2)`;
    win.style.transition = "ease-out 0.3s";
    setState((prev) => ({ ...prev, minApps: { ...prev.minApps, [id]: true } }));
  };

  const closeApp = (id: string): void => {
    setState((prev) => ({
      ...prev,
      showApps: { ...prev.showApps, [id]: false },
      maxApps: { ...prev.maxApps, [id]: false },
    }));
  };

  const openApp = (id: string): void => {
    const appDef = apps.find((a) => a.id === id);
    if (!appDef) {
      console.warn(`openApp: unknown app id "${id}"`);
      return;
    }

    setState((prev) => {
      const maxZ = prev.maxZ + 1;
      const showApps = { ...prev.showApps, [id]: true };
      const appsZ = { ...prev.appsZ, [id]: maxZ };

      // Un-minimize if needed
      const minApps = { ...prev.minApps };
      if (minApps[id]) {
        const win = document.querySelector(`#window-${id}`) as HTMLElement;
        if (win) {
          win.style.transform = `translate(${win.style.getPropertyValue("--window-transform-x")}, ${win.style.getPropertyValue("--window-transform-y")}) scale(1)`;
          win.style.transition = "ease-in 0.3s";
          // Drop the transition once restored, or every later drag lags behind the cursor.
          setTimeout(() => (win.style.transition = ""), 320);
        }
        minApps[id] = false;
      }

      return {
        ...prev,
        showApps,
        appsZ,
        maxZ,
        minApps,
        currentTitle: appDef.title,
      };
    });
  };

  // Hide Dock + TopBar only while the front-most visible window is maximised.
  // Derived (not stored) so it can never go stale after close/minimise/focus.
  const frontApp = Object.keys(state.showApps)
    .filter((id) => state.showApps[id] && !state.minApps[id] && id !== "siri")
    .sort((a, b) => (state.appsZ[b] ?? 0) - (state.appsZ[a] ?? 0))[0];
  const hideDockAndTopbar = !!frontApp && !!state.maxApps[frontApp];

  const renderAppWindows = () => {
    return apps.map((app) => {
      if (!app.desktop) return null;

      if (app.id === "siri" && state.showApps[app.id]) {
        return (
          <div
            key={`desktop-app-${app.id}`}
            className="fixed top-8 right-4 z-[1000] drop-shadow-2xl flex items-start justify-end"
          >
            <AppErrorBoundary name="Siri">
              <Suspense fallback={null}>
                {React.cloneElement(app.content as React.ReactElement, {
                  closeSiri: () => closeApp("siri"),
                })}
              </Suspense>
            </AppErrorBoundary>
          </div>
        );
      }

      if (!app.content) return null;

      const windowProps = {
        id: app.id,
        title: app.title,
        width: app.width,
        height: app.height,
        minWidth: app.minWidth,
        minHeight: app.minHeight,
        aspectRatio: app.aspectRatio,
        x: app.x,
        y: app.y,
        z: state.appsZ[app.id] ?? 2,
        max: state.maxApps[app.id] ?? false,
        min: state.minApps[app.id] ?? false,
        titlebar: app.titlebar,
        close: closeApp,
        setMax: setAppMax,
        setMin: minimizeApp,
        focus: openApp,
      };

      return (
        <AnimatePresence key={`desktop-app-${app.id}`}>
          {state.showApps[app.id] && (
            <AppWindow {...windowProps}>
              <AppErrorBoundary name={app.title}>
                <Suspense fallback={<AppLoading />}>{app.content}</Suspense>
              </AppErrorBoundary>
            </AppWindow>
          )}
        </AnimatePresence>
      );
    });
  };

  const bgStyle: any = {
    backgroundImage: `url(${wallpaperSrc(dark ? activeWallpaper.night : activeWallpaper.day)})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    filter: `brightness(${(brightness as number) * 0.7 + 50}%)`
  };
  bgStyle["trans" + "ition"] = "filter 0.3s ea" + "se";

  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0 });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ show: true, x: e.clientX, y: e.clientY });
  };

  return (
    <div
      className="size-full overflow-clip bg-center bg-cover"
      style={bgStyle}
      onContextMenu={handleContextMenu}
    >
      {/* Top Menu Bar */}
      <TopBar
        title={state.currentTitle}
        setLogin={props.setLogin}
        shutMac={props.shutMac}
        sleepMac={props.sleepMac}
        restartMac={props.restartMac}
        toggleSpotlight={toggleSpotlight}
        hide={hideDockAndTopbar || state.showLaunchpad}
        setSpotlightBtnRef={setSpotlightBtnRef}
        openApp={openApp}
        toggleNotificationCenter={toggleNotificationCenter}
        showNotificationCenter={state.showNotificationCenter}
        openAboutMac={() => setShowAboutMac(true)}
      />

      {/* Dynamic Island */}
      <DynamicIsland hide={hideDockAndTopbar || state.showLaunchpad} />

      {/* Desktop widgets — draggable, removable, re-addable (right-click › Edit Widgets) */}
      {!isMobile && <DesktopWidgets />}

      {/* Desktop Icons - top-right */}
      <div
        style={{
          position: "fixed",
          top: 48,
          right: 24,
          zIndex: 55,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
        }}
      >
      </div>

      {isMobile && (
        <div className="absolute top-[48px] left-0 right-0 bottom-24 p-6 grid grid-cols-4 gap-y-6 gap-x-2 content-start z-40">
          {apps.filter(a => !a.hideOnMobile && !a.dockOnMobile && a.id !== "launchpad").map(app => (
            <div key={app.id} className="flex flex-col items-center gap-1.5 cursor-pointer" onClick={() => openApp(app.id)}>
              <div className="w-[60px] h-[60px] bg-transparent rounded-[22.5%] shadow-sm overflow-hidden flex items-center justify-center border border-black/5 dark:border-white/5">
                <img src={app.mobileImg || app.img} alt={app.title} className="w-full h-full object-cover" />
              </div>
              <span className="text-white text-xs font-light text-center tracking-wide" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>
                {app.mobileTitle || app.title}
              </span>
            </div>
          ))}
          {launchpadApps.map(app => (
            <div key={app.id} className="flex flex-col items-center gap-1.5 cursor-pointer" onClick={(e) => handleLaunchpadAppClick(e, app.link)}>
              <div className={`w-[60px] h-[60px] rounded-[22.5%] shadow-sm overflow-hidden flex items-center justify-center border border-black/10 dark:border-white/10 ${app.img.includes('skill-exchange') ? 'bg-black' : 'bg-white'}`}>
                <img src={app.mobileImg || app.img} alt={app.title} className="w-[60%] h-[60%] object-contain" />
              </div>
              <span className="text-white text-xs font-light text-center tracking-wide" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>
                {app.mobileTitle || app.title}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Desktop App Windows */}
      <div className="window-bound absolute" style={{ top: minMarginY, zIndex: 60, pointerEvents: "none" }}>
        {renderAppWindows()}
      </div>

      {/* About This Mac modal */}
      <AboutThisMacModal show={showAboutMac} onClose={() => setShowAboutMac(false)} />

      {/* Spotlight */}
      {state.spotlight && (
        <Spotlight
          openApp={openApp}
          toggleLaunchpad={toggleLaunchpad}
          toggleSpotlight={toggleSpotlight}
          btnRef={spotlightBtnRef as React.RefObject<HTMLDivElement>}
        />
      )}

      {/* Launchpad */}
      <Launchpad show={state.showLaunchpad} toggleLaunchpad={toggleLaunchpad} />

      {/* Notification Center */}
      <NotificationCenter
        show={state.showNotificationCenter}
        onClose={toggleNotificationCenter}
      />

      {/* Dock */}
      <Dock
        open={openApp}
        showApps={state.showApps}
        showLaunchpad={state.showLaunchpad}
        toggleLaunchpad={toggleLaunchpad}
        hide={hideDockAndTopbar}
      />

      {/* Context Menu */}
      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        show={contextMenu.show}
        onClose={() => setContextMenu({ ...contextMenu, show: false })}
        openApp={openApp}
      />
    </div>
  );
}
