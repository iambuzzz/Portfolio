import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { apps } from "~/configs";
import { profile } from "~/data/profile";

// Small system windows opened from the Apple menu: About This Mac, Force Quit
// and the Log Out / Restart confirmation. Each is a real (draggable) window,
// centred on screen, that follows light and dark mode.

function DialogWindow({
  show,
  onClose,
  width,
  title,
  children,
  label
}: {
  show: boolean;
  onClose: () => void;
  width: number;
  title?: string;
  label: string;
  children: ReactNode;
}) {
  const drag = useDragControls();
  const areaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show, onClose]);

  return (
    <AnimatePresence>
      {show && (
        // Full-screen, click-through layer: flex centres the window, so the
        // pop-in animation's transform can't knock it off centre.
        <div ref={areaRef} className="sysdlg-area">
          <motion.div
            className="sysdlg"
            role="dialog"
            aria-label={label}
            style={{ width }}
            drag
            dragControls={drag}
            dragListener={false}
            dragMomentum={false}
            dragConstraints={areaRef}
            dragElastic={0}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          >
            <div className="sysdlg-bar" onPointerDown={(e) => drag.start(e)}>
              <div className="sysdlg-lights">
                <button type="button" className="red" aria-label="Close" onClick={onClose} onPointerDown={(e) => e.stopPropagation()} />
                <span className="off" />
                <span className="off" />
              </div>
              {title && <span className="sysdlg-title">{title}</span>}
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ── About This Mac: the visitor's real device ───────────────────────────────
interface DeviceInfo {
  kind: "mac" | "pc" | "phone" | "tablet";
  name: string;
  rows: { label: string; value: string }[];
}

const MacBookSVG = () => (
  <svg width="120" height="80" viewBox="0 0 120 80" fill="none" aria-hidden>
    <rect x="18" y="6" width="84" height="54" rx="4" fill="#c8c8cc" />
    <rect x="20" y="8" width="80" height="50" rx="3" fill="#1c1c1e" />
    <path d="M10 62 L14 60 H106 L110 62 L114 70 H6 L10 62Z" fill="#b0b0b5" />
    <rect x="6" y="70" width="108" height="3" rx="1.5" fill="#a0a0a5" />
    <rect x="52" y="6" width="16" height="4" rx="2" fill="#b0b0b5" />
  </svg>
);

function gpuName(): string | null {
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    const raw = ext ? String(gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
    if (!raw) return null;
    // "ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)" → "Apple M2"
    const apple = raw.match(/Apple M\d+(?: (?:Pro|Max|Ultra))?/);
    if (apple) return apple[0];
    const inner = raw.match(/ANGLE \([^,]+, ([^,(]+?)(?: \(|,|\))/);
    return (inner?.[1] ?? raw).replace(/Direct3D.*$/, "").trim();
  } catch {
    return null;
  }
}

async function readDevice(): Promise<DeviceInfo> {
  const ua = navigator.userAgent;
  const uad = (navigator as Navigator & { userAgentData?: { platform?: string; brands?: { brand: string; version: string }[]; getHighEntropyValues?: (h: string[]) => Promise<{ platformVersion?: string }> } }).userAgentData;
  const touch = navigator.maxTouchPoints > 1;

  let kind: DeviceInfo["kind"] = "pc";
  let os = "Unknown";
  if (/iPhone/.test(ua)) (kind = "phone"), (os = `iOS ${(ua.match(/OS (\d+[_\d]*)/)?.[1] ?? "").replace(/_/g, ".")}`.trim());
  else if (/iPad/.test(ua) || (/Macintosh/.test(ua) && touch)) (kind = "tablet"), (os = "iPadOS");
  else if (/Android/.test(ua)) (kind = /Mobile/.test(ua) ? "phone" : "tablet"), (os = `Android ${ua.match(/Android ([\d.]+)/)?.[1] ?? ""}`.trim());
  else if (/Mac OS X|Macintosh/.test(ua)) (kind = "mac"), (os = "macOS");
  else if (/Windows/.test(ua)) os = "Windows";
  else if (/CrOS/.test(ua)) os = "ChromeOS";
  else if (/Linux/.test(ua)) os = "Linux";

  // Chromium reports the real OS version (the UA string is frozen).
  try {
    const hv = await uad?.getHighEntropyValues?.(["platformVersion"]);
    const major = Number(hv?.platformVersion?.split(".")[0]);
    if (major && os === "macOS") os = `macOS ${hv!.platformVersion!.split(".").slice(0, 2).join(".")}`;
    if (major && os === "Windows") os = major >= 13 ? "Windows 11" : "Windows 10";
  } catch {
    // not available
  }

  const brand = uad?.brands?.find((b) => /Chrome|Edge|Opera|Brave/.test(b.brand) && !/Not/.test(b.brand));
  const browser = /Edg\//.test(ua)
    ? `Edge ${ua.match(/Edg\/(\d+)/)?.[1]}`
    : /Firefox\//.test(ua)
      ? `Firefox ${ua.match(/Firefox\/(\d+)/)?.[1]}`
      : brand
        ? `${brand.brand.replace("Google ", "")} ${brand.version}`
        : /Chrome\//.test(ua)
          ? `Chrome ${ua.match(/Chrome\/(\d+)/)?.[1]}`
          : /Safari\//.test(ua)
            ? `Safari ${ua.match(/Version\/([\d.]+)/)?.[1] ?? ""}`.trim()
            : "Unknown";

  const dpr = window.devicePixelRatio || 1;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const gpu = gpuName();
  const rows = [
    gpu && { label: kind === "mac" && /^Apple M/.test(gpu) ? "Chip" : "Graphics", value: gpu },
    navigator.hardwareConcurrency && { label: "Processor", value: `${navigator.hardwareConcurrency} cores` },
    // Browsers cap this at 8 to limit fingerprinting.
    mem && { label: "Memory", value: mem >= 8 ? "8 GB or more" : `${mem} GB` },
    { label: "Display", value: `${screen.width} × ${screen.height}${dpr >= 2 ? " Retina" : ""} (${dpr}×)` },
    { label: "System", value: os },
    { label: "Browser", value: browser }
  ].filter(Boolean) as DeviceInfo["rows"];

  const name = { mac: "Your Mac", pc: "Your Computer", phone: "Your Phone", tablet: "Your Tablet" }[kind];
  return { kind, name, rows };
}

export function AboutThisMacModal({ show, onClose, openApp }: { show: boolean; onClose: () => void; openApp?: (id: string) => void }) {
  const [info, setInfo] = useState<DeviceInfo | null>(null);
  useEffect(() => {
    if (show && !info) readDevice().then(setInfo);
  }, [show, info]);

  return (
    <DialogWindow show={show} onClose={onClose} width={320} label="About This Mac">
      <div className="atm">
        <div className="atm-hero">
          {!info || info.kind === "mac" ? (
            <MacBookSVG />
          ) : (
            <span className={info.kind === "phone" ? "i-ph:device-mobile-duotone" : info.kind === "tablet" ? "i-ph:device-tablet-duotone" : "i-ph:desktop-tower-duotone"} />
          )}
        </div>
        <div className="atm-name">{info?.name ?? "This Mac"}</div>
        <div className="atm-sub">Read from your browser just now. Nothing is sent anywhere.</div>
        <div className="atm-rows">
          {(info?.rows ?? []).map((r) => (
            <div key={r.label} className="atm-row">
              <span>{r.label}</span>
              <span>{r.value}</span>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="sysdlg-btn"
          onClick={() => {
            onClose();
            openApp?.("about");
          }}
        >
          More Info…
        </button>
        <div className="atm-foot">
          macOS-style portfolio by {profile.name}
          <br />© {new Date().getFullYear()} {profile.name}
        </div>
      </div>
    </DialogWindow>
  );
}

// ── Force Quit Applications ─────────────────────────────────────────────────
export function ForceQuitDialog({
  show,
  onClose,
  openIds,
  quit
}: {
  show: boolean;
  onClose: () => void;
  openIds: string[];
  quit: (id: string) => void;
}) {
  const list = useMemo(() => apps.filter((a) => openIds.includes(a.id)), [openIds]);
  const [sel, setSel] = useState<string | null>(null);
  const selected = list.some((a) => a.id === sel) ? sel : list[0]?.id ?? null;

  return (
    <DialogWindow show={show} onClose={onClose} width={360} title="Force Quit Applications" label="Force Quit Applications">
      <div className="fq">
        <p className="fq-hint">If an app doesn't respond for a while, select its name and click Force Quit.</p>
        <div className="fq-list" role="listbox" aria-label="Open applications">
          {list.length ? (
            list.map((a) => (
              <button
                type="button"
                role="option"
                aria-selected={a.id === selected}
                key={a.id}
                className={`fq-item ${a.id === selected ? "on" : ""}`}
                onClick={() => setSel(a.id)}
                onDoubleClick={() => quit(a.id)}
              >
                <img src={a.img.startsWith("/") ? a.img : `/${a.img}`} alt="" />
                {a.title}
              </button>
            ))
          ) : (
            <div className="fq-empty">No apps are open.</div>
          )}
        </div>
        <p className="fq-hint small">You can open this window with ⌥⌘⎋ on a real Mac.</p>
        <div className="sysdlg-actions">
          <button type="button" className="sysdlg-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="sysdlg-btn primary" disabled={!selected} onClick={() => selected && quit(selected)}>
            Force Quit
          </button>
        </div>
      </div>
    </DialogWindow>
  );
}

// ── Log Out / Restart confirmation ──────────────────────────────────────────
export type PowerAction = "logout" | "restart";

const POWER_TEXT: Record<PowerAction, { q: string; auto: string; btn: string; icon: string }> = {
  logout: { q: "Are you sure you want to quit all applications and log out now?", auto: "You will be logged out automatically in", btn: "Log Out", icon: "i-ph:sign-out-bold" },
  restart: { q: "Are you sure you want to restart your computer now?", auto: "Your computer will restart automatically in", btn: "Restart", icon: "i-ph:arrow-clockwise-bold" }
};

export function PowerConfirm({ action, onCancel, onConfirm }: { action: PowerAction | null; onCancel: () => void; onConfirm: (a: PowerAction) => void }) {
  const [left, setLeft] = useState(60);
  const shown = useRef<PowerAction | null>(null);
  if (action) shown.current = action;
  const a = shown.current ?? "logout";
  const t = POWER_TEXT[a];

  useEffect(() => {
    if (!action) return;
    setLeft(60);
    const id = setInterval(() => setLeft((s) => s - 1), 1000);
    const onKey = (e: KeyboardEvent) => e.key === "Enter" && onConfirm(action);
    window.addEventListener("keydown", onKey);
    return () => {
      clearInterval(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [action, onConfirm]);

  useEffect(() => {
    if (action && left <= 0) onConfirm(action);
  }, [left, action, onConfirm]);

  return (
    <DialogWindow show={!!action} onClose={onCancel} width={300} label={t.btn}>
      <div className="pc">
        <div className="pc-icon">
          <span className={t.icon} />
        </div>
        <div className="pc-q">{t.q}</div>
        <div className="pc-auto">
          {t.auto} {left} {left === 1 ? "second" : "seconds"}.
        </div>
        <div className="sysdlg-actions stack">
          <button type="button" className="sysdlg-btn primary" autoFocus onClick={() => onConfirm(a)}>
            {t.btn}
          </button>
          <button type="button" className="sysdlg-btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </DialogWindow>
  );
}
