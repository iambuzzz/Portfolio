import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

// Small building blocks for terminal output. Colours come from the active
// theme's CSS variables (see THEMES in Terminal.tsx).

export type Tone = "fg" | "muted" | "green" | "yellow" | "red" | "blue" | "purple" | "cyan" | "orange" | "accent";

export const C = ({ c = "fg", b, children, style }: { c?: Tone; b?: boolean; children: ReactNode; style?: CSSProperties }) => (
  <span style={{ color: `var(--t-${c})`, fontWeight: b ? 700 : undefined, ...style }}>{children}</span>
);

/** Lets output elements run commands (clickable `help`, suggestions, …). */
export const RunContext = createContext<(line: string) => void>(() => {});

export function Run({ cmd, children, c = "accent" }: { cmd: string; children?: ReactNode; c?: Tone }) {
  const run = useContext(RunContext);
  return (
    <button
      type="button"
      className="t-run"
      onClick={(e) => {
        e.stopPropagation();
        run(cmd);
      }}
      title={`Run: ${cmd}`}
      style={{ color: `var(--t-${c})` }}
    >
      {children ?? cmd}
    </button>
  );
}

/** External link (only ever our own known URLs). */
export const A = ({ href, children }: { href: string; children?: ReactNode }) => (
  <a className="t-link" href={href} target={href.startsWith("mailto:") ? undefined : "_blank"} rel="noreferrer noopener" onClick={(e) => e.stopPropagation()}>
    {children ?? href.replace(/^mailto:/, "").replace(/^https?:\/\//, "")}
  </a>
);

export const Pre = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit", ...style }}>{children}</pre>
);

/** Non-wrapping pre for ASCII art. */
export const Art = ({ children, c = "fg", style }: { children: ReactNode; c?: Tone; style?: CSSProperties }) => (
  <pre style={{ margin: 0, whiteSpace: "pre", fontFamily: "inherit", lineHeight: 1.15, color: `var(--t-${c})`, overflowX: "auto", ...style }}>{children}</pre>
);

export const Columns = ({ items, min = 150 }: { items: ReactNode[]; min?: number }) => (
  <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`, columnGap: 16 }}>
    {items.map((it, i) => (
      <div key={i} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {it}
      </div>
    ))}
  </div>
);

export const Block = ({ children, gap = 2 }: { children: ReactNode; gap?: number }) => (
  <div style={{ display: "flex", flexDirection: "column", gap, margin: "2px 0 6px" }}>{children}</div>
);

/** Text that types itself out; calls onDone when finished (or when cut short). */
export function Typewriter({ text, speed = 12, onDone, signal }: { text: string; speed?: number; onDone?: () => void; signal?: AbortSignal }) {
  const [n, setN] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    const finish = () => {
      if (done.current) return;
      done.current = true;
      onDone?.();
    };
    if (signal?.aborted) {
      setN(text.length);
      finish();
      return;
    }
    const onAbort = () => {
      setN(text.length);
      finish();
    };
    signal?.addEventListener("abort", onAbort);
    // Type a few characters per tick so long answers don't drag.
    const step = Math.max(1, Math.round(text.length / 400));
    const t = setInterval(() => {
      setN((v) => {
        const next = Math.min(text.length, v + step);
        if (next >= text.length) {
          clearInterval(t);
          setTimeout(finish, 0);
        }
        return next;
      });
    }, speed);
    return () => {
      clearInterval(t);
      signal?.removeEventListener("abort", onAbort);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Pre>
      {text.slice(0, n)}
      {n < text.length && <span className="t-cursor">▋</span>}
    </Pre>
  );
}

/** ASCII progress bar: [██████░░░░] */
export const bar = (ratio: number, width = 24) => {
  const r = Math.max(0, Math.min(1, ratio || 0));
  const full = Math.round(r * width);
  return "█".repeat(full) + "░".repeat(width - full);
};

export const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
