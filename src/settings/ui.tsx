import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { create } from "zustand";

// macOS System Settings building blocks. Styles: `.st-*` in component.css.

export const Tile = ({ icon, color, size = 22 }: { icon: string; color: string; size?: number }) => (
  <span className="st-tile" style={{ width: size, height: size, background: color, borderRadius: size * 0.27 }}>
    <span className={icon} style={{ width: size * 0.62, height: size * 0.62, color: "#fff" }} />
  </span>
);

export const Group = ({ title, footer, children }: { title?: ReactNode; footer?: ReactNode; children: ReactNode }) => (
  <section className="st-section">
    {title && <h3 className="st-group-title">{title}</h3>}
    <div className="st-group">{children}</div>
    {footer && <p className="st-footer">{footer}</p>}
  </section>
);

export function Row({
  label,
  sub,
  icon,
  children,
  onClick,
  chevron,
  style
}: {
  label: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  style?: CSSProperties;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className={`st-row ${onClick ? "st-row-btn" : ""}`} onClick={onClick} style={style} type={onClick ? "button" : undefined}>
      {icon && <span className="st-row-icon">{icon}</span>}
      <span className="st-row-text">
        <span className="st-row-label">{label}</span>
        {sub && <span className="st-row-sub">{sub}</span>}
      </span>
      {children !== undefined && <span className="st-row-control">{children}</span>}
      {chevron && <span className="i-ph:caret-right st-chevron" />}
    </Tag>
  );
}

export const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    className={`st-switch ${checked ? "on" : ""}`}
    onClick={(e) => {
      e.stopPropagation();
      onChange(!checked);
    }}
  >
    <span />
  </button>
);

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  left,
  right,
  label,
  width = 200
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  left?: ReactNode;
  right?: ReactNode;
  label: string;
  width?: number;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <span className="st-slider" style={{ width }}>
      {left}
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ["--pct" as string]: `${pct}%` }}
      />
      {right}
    </span>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <span className="st-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </span>
  );
}

export function Select<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <span className="st-select">
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="i-ph:caret-up-down-bold" />
    </span>
  );
}

export const Button = ({ children, onClick, kind = "default", disabled }: { children: ReactNode; onClick: () => void; kind?: "default" | "primary" | "danger"; disabled?: boolean }) => (
  <button type="button" className={`st-btn st-btn-${kind}`} onClick={onClick} disabled={disabled}>
    {children}
  </button>
);

/** Big centred header used at the top of some panels (like macOS About). */
export const Hero = ({ icon, title, sub }: { icon: ReactNode; title: ReactNode; sub?: ReactNode }) => (
  <div className="st-hero">
    {icon}
    <div className="st-hero-title">{title}</div>
    {sub && <div className="st-hero-sub">{sub}</div>}
  </div>
);

// ── Alert sheet (replaces the browser's confirm()) ──────────────────────────
interface Ask {
  title: string;
  message?: string;
  confirmLabel: string;
  destructive?: boolean;
  resolve: (ok: boolean) => void;
}
const useAsk = create<{ ask: Ask | null }>(() => ({ ask: null }));

/** macOS-style alert inside the Settings window. Resolves true when confirmed. */
export const confirmAction = (opts: Omit<Ask, "resolve">) =>
  new Promise<boolean>((resolve) => {
    useAsk.getState().ask?.resolve(false);
    useAsk.setState({ ask: { ...opts, resolve } });
  });

export function ConfirmSheet() {
  const ask = useAsk((s) => s.ask);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const close = (ok: boolean) => {
    ask?.resolve(ok);
    useAsk.setState({ ask: null });
  };
  useEffect(() => {
    if (!ask) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask]);
  // Settings closed while asking: treat as cancel.
  useEffect(
    () => () => {
      const pending = useAsk.getState().ask;
      if (pending) {
        pending.resolve(false);
        useAsk.setState({ ask: null });
      }
    },
    []
  );
  if (!ask) return null;
  return (
    <div className="st-alert-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
      <div className="st-alert" role="alertdialog" aria-modal="true" aria-labelledby="st-alert-title">
        <img src="/img/icons/settings.png" alt="" className="st-alert-icon" />
        <div id="st-alert-title" className="st-alert-title">
          {ask.title}
        </div>
        {ask.message && <div className="st-alert-msg">{ask.message}</div>}
        <div className="st-alert-actions">
          <button type="button" ref={cancelRef} className="st-alert-btn" onClick={() => close(false)}>
            Cancel
          </button>
          <button type="button" className={`st-alert-btn primary ${ask.destructive ? "danger" : ""}`} onClick={() => close(true)}>
            {ask.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
