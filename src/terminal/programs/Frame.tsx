import { useEffect, useRef, type ReactNode, type KeyboardEvent } from "react";

// Full-window program shell: grabs keyboard focus, keeps keys away from the
// desktop shortcuts, and shows a key-hint footer.
export default function Frame({
  children,
  footer,
  onKey,
  onBlur
}: {
  children: ReactNode;
  footer?: ReactNode;
  onKey: (e: KeyboardEvent<HTMLDivElement>) => void;
  onBlur?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div
      ref={ref}
      tabIndex={0}
      className="t-program"
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key !== "Tab") e.preventDefault();
        onKey(e);
      }}
      onBlur={onBlur}
      onMouseDown={() => setTimeout(() => ref.current?.focus(), 0)}
      style={{ outline: "none", height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}
    >
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", position: "relative" }}>{children}</div>
      {footer && (
        <div style={{ flexShrink: 0, padding: "6px 2px 0", color: "var(--t-muted)", borderTop: "1px solid var(--t-border)", marginTop: 6 }}>{footer}</div>
      )}
    </div>
  );
}

export const Key = ({ k, children }: { k: string; children: ReactNode }) => (
  <span style={{ marginRight: 14 }}>
    <span style={{ background: "var(--t-fg)", color: "var(--t-bg-solid)", padding: "0 4px", borderRadius: 2, fontWeight: 700 }}>{k}</span> {children}
  </span>
);
