import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { commandNames, find, sandboxed, suggest } from "~/terminal/commands";
import { formatPath } from "~/terminal/fs";
import { C, Run, RunContext } from "~/terminal/ui";
import type { Ctx, Program, PromptOptions, ThemeName } from "~/terminal/types";

// A simulated zsh. Commands come only from the allow-list in terminal/commands;
// input is never evaluated, and all output is rendered as React text.

const THEME_KEY = "terminal-theme";
const MAX_BLOCKS = 400;
// Survives closing/reopening the window during the visit.
const HISTORY: string[] = [];

const THEMES: Record<ThemeName, Record<string, string>> = {
  default: {
    bg: "rgba(24,24,27,0.94)", "bg-solid": "#18181b", fg: "#e7e7ea", muted: "#8b8b94", green: "#5af78e", yellow: "#f3f99d",
    red: "#ff5c57", blue: "#57c7ff", purple: "#ff6ac1", cyan: "#9aedfe", orange: "#ffb86c", accent: "#57c7ff", border: "rgba(255,255,255,0.14)"
  },
  matrix: {
    bg: "rgba(0,8,2,0.96)", "bg-solid": "#000802", fg: "#33ff66", muted: "#1c8c3a", green: "#33ff66", yellow: "#b6ff00",
    red: "#ff3355", blue: "#00ff99", purple: "#66ff99", cyan: "#00ffcc", orange: "#aaff33", accent: "#33ff66", border: "rgba(51,255,102,0.25)"
  },
  dracula: {
    bg: "rgba(40,42,54,0.97)", "bg-solid": "#282a36", fg: "#f8f8f2", muted: "#6272a4", green: "#50fa7b", yellow: "#f1fa8c",
    red: "#ff5555", blue: "#8be9fd", purple: "#ff79c6", cyan: "#8be9fd", orange: "#ffb86c", accent: "#bd93f9", border: "rgba(98,114,164,0.5)"
  },
  solarized: {
    bg: "rgba(0,43,54,0.97)", "bg-solid": "#002b36", fg: "#93a1a1", muted: "#586e75", green: "#859900", yellow: "#b58900",
    red: "#dc322f", blue: "#268bd2", purple: "#6c71c4", cyan: "#2aa198", orange: "#cb4b16", accent: "#268bd2", border: "rgba(147,161,161,0.25)"
  },
  retro: {
    bg: "rgba(20,12,0,0.98)", "bg-solid": "#140c00", fg: "#ffb000", muted: "#a06a00", green: "#ffcc33", yellow: "#ffd966",
    red: "#ff6a00", blue: "#ffc04d", purple: "#ffa64d", cyan: "#ffcf66", orange: "#ff9900", accent: "#ffb000", border: "rgba(255,176,0,0.3)"
  }
};

const readTheme = (): ThemeName => {
  try {
    const t = localStorage.getItem(THEME_KEY) as ThemeName | null;
    return t && t in THEMES ? t : "default";
  } catch {
    return "default";
  }
};

/** Split a command line into words, honouring "double" and 'single' quotes. */
function tokenize(line: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

/** Coloured rendering of a command line (used for the input and history). */
function Highlight({ line }: { line: string }) {
  const parts = line.split(/(\s+)/);
  let seenCmd = false;
  return (
    <>
      {parts.map((p, i) => {
        if (!p.trim()) return <span key={i}>{p}</span>;
        if (!seenCmd) {
          seenCmd = true;
          const known = !!find(p);
          return (
            <span key={i} style={{ color: known ? "var(--t-green)" : sandboxed(p) ? "var(--t-orange)" : "var(--t-red)", fontWeight: known ? 600 : 400 }}>
              {p}
            </span>
          );
        }
        const color = p.startsWith("-") ? "var(--t-cyan)" : /^["']/.test(p) ? "var(--t-yellow)" : "var(--t-fg)";
        return (
          <span key={i} style={{ color }}>
            {p}
          </span>
        );
      })}
    </>
  );
}

const Prompt = ({ cwd }: { cwd: string[] }) => (
  <span style={{ whiteSpace: "nowrap" }}>
    <C c="green" b>
      guest@ambuj
    </C>{" "}
    <C c="blue" b>
      {formatPath(cwd)}
    </C>{" "}
    <C>%</C>{" "}
  </span>
);

interface Block {
  id: number;
  node: ReactNode;
}

export default function Terminal() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [input, setInput] = useState("");
  const [cwd, setCwdState] = useState<string[]>([]);
  const [theme, setThemeState] = useState<ThemeName>(readTheme);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<{ question: string; resolve: (v: string | null) => void } | null>(null);
  const [program, setProgram] = useState<ReactNode>(null);

  const idRef = useRef(0);
  const cwdRef = useRef<string[]>([]);
  const themeRef = useRef(theme);
  const abortRef = useRef<AbortController | null>(null);
  const histIdx = useRef<number>(HISTORY.length);
  const draft = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const print = useCallback((node: ReactNode) => {
    const id = ++idRef.current;
    setBlocks((b) => {
      const next = [...b, { id, node }];
      return next.length > MAX_BLOCKS ? next.slice(-MAX_BLOCKS) : next;
    });
  }, []);

  const setCwd = (p: string[]) => {
    cwdRef.current = p;
    setCwdState(p);
  };
  const setTheme = (t: ThemeName) => {
    themeRef.current = t;
    setThemeState(t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      // storage blocked
    }
  };

  // Stay pinned to the bottom as output grows (including typewriter text).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content) return;
    const ro = new ResizeObserver(() => (el.scrollTop = el.scrollHeight));
    ro.observe(content);
    return () => ro.disconnect();
  }, []);

  const rootRef = useRef<HTMLDivElement>(null);
  const focusInput = () => {
    if (window.getSelection()?.toString()) return;
    // A full-window program (projects -i, snake…) keeps its own focus; taking
    // it here left the program deaf to keys, with no way to quit.
    if (program) return rootRef.current?.querySelector<HTMLElement>(".t-program")?.focus();
    if (inputRef.current) inputRef.current.focus();
    else rootRef.current?.focus();
  };

  // ── run a command line ─────────────────────────────────────────────────────
  const execRef = useRef<(line: string, opts?: { echo?: boolean; nested?: boolean }) => Promise<void>>();
  const exec = async (raw: string, { echo = true, nested = false } = {}) => {
    const line = raw.trim();
    if (echo)
      print(
        <div>
          <Prompt cwd={cwdRef.current} />
          <Highlight line={raw} />
        </div>
      );
    if (!line) return;
    if (echo && HISTORY[HISTORY.length - 1] !== line) HISTORY.push(line);
    histIdx.current = HISTORY.length;

    // Ctrl+C-able context, shared with nested runs (e.g. `ask` → `play`).
    const controller = nested && abortRef.current ? abortRef.current : new AbortController();
    if (!nested) abortRef.current = controller;

    // `rm -rf /` must reach its easter egg even with odd spacing.
    const [name, ...args] = tokenize(line);
    const cmd = find(name);
    if (!cmd) {
      if (sandboxed(name)) {
        print(
          <span>
            <C c="orange">🔒 {name}:</C> not available — this terminal is a sandboxed simulation running in your browser. Try <Run cmd="help" />.
          </span>
        );
      } else {
        const s = suggest(name);
        print(
          <span>
            <C c="red">zsh: command not found: {name}</C>
            {s && (
              <>
                {" "}
                — did you mean <Run cmd={[s, ...args].join(" ")}>{s}</Run>?
              </>
            )}
          </span>
        );
      }
      return;
    }

    const ctx: Ctx = {
      print,
      clear: () => setBlocks([]),
      get cwd() {
        return cwdRef.current;
      },
      setCwd,
      run: (l) => execRef.current!(l, { echo: false, nested: true }),
      openApp: (id) => window.dispatchEvent(new CustomEvent("app:open", { detail: id })),
      closeTerminal: () => window.dispatchEvent(new CustomEvent("app:close", { detail: "terminal" })),
      setTheme,
      get theme() {
        return themeRef.current;
      },
      takeover: (prog: Program) =>
        new Promise<void>((resolve) => {
          setProgram(
            prog((summary) => {
              setProgram(null);
              if (summary) print(summary);
              resolve();
              setTimeout(() => inputRef.current?.focus(), 0);
            })
          );
        }),
      prompt: (question: string, opts?: PromptOptions) =>
        new Promise<string | null>((resolve) => {
          setInput(opts?.initial ?? "");
          setAsk({ question, resolve });
          setTimeout(() => inputRef.current?.focus(), 0);
        }),
      signal: controller.signal,
      history: HISTORY
    };

    if (!nested) {
      setBusy(true);
      // The input is hidden while busy; the root takes keys (Ctrl+C) instead.
      setTimeout(() => {
        const root = rootRef.current;
        // Don't steal focus from a full-window program or a prompt input.
        if (root && !inputRef.current && !root.contains(document.activeElement)) root.focus();
      }, 0);
    }
    try {
      await cmd.run(args, ctx);
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") print(<C c="red">{name}: {(e as Error).message}</C>);
    } finally {
      if (!nested) {
        setBusy(false);
        abortRef.current = null;
        // Take focus back only if nothing else (e.g. Spotlight) has it.
        setTimeout(() => {
          const a = document.activeElement;
          if (!a || a === document.body || rootRef.current?.contains(a)) inputRef.current?.focus();
        }, 0);
      }
    }
  };
  execRef.current = exec;

  // Welcome banner once per open (guarded: StrictMode runs effects twice in dev).
  const bannerShown = useRef(false);
  useEffect(() => {
    if (bannerShown.current) return;
    bannerShown.current = true;
    exec("banner", { echo: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── completion ─────────────────────────────────────────────────────────────
  const completions = (text: string): { prefix: string; options: string[] } => {
    const endsWithSpace = /\s$/.test(text);
    const words = tokenize(text);
    if (words.length === 0) return { prefix: "", options: [] };
    if (words.length === 1 && !endsWithSpace) {
      const w = words[0].toLowerCase();
      return { prefix: w, options: commandNames().filter((n) => n.startsWith(w)) };
    }
    const cmd = find(words[0]);
    const args = endsWithSpace ? [...words.slice(1), ""] : words.slice(1);
    const partial = args[args.length - 1] ?? "";
    const all = cmd?.complete?.(args, { cwd: cwdRef.current }) ?? [];
    return { prefix: partial, options: Array.from(new Set(all.filter((o) => o.startsWith(partial)))) };
  };

  // Fish-style grey suggestion: last matching history line, else first completion.
  const hint = (() => {
    if (!input || ask || busy) return "";
    const fromHistory = [...HISTORY].reverse().find((h) => h.startsWith(input) && h !== input);
    if (fromHistory) return fromHistory.slice(input.length);
    const { prefix, options } = completions(input);
    const first = options[0];
    return first && first !== prefix ? first.slice(prefix.length) : "";
  })();

  const tabComplete = () => {
    const { prefix, options } = completions(input);
    if (!options.length) return;
    const base = input.slice(0, input.length - prefix.length);
    if (options.length === 1) {
      const o = options[0];
      setInput(base + o + (o.endsWith("/") ? "" : " "));
      return;
    }
    // Extend to the longest common prefix, else list the options.
    let common = options[0];
    for (const o of options) while (!o.startsWith(common)) common = common.slice(0, -1);
    if (common.length > prefix.length) setInput(base + common);
    else
      print(
        <div>
          <Prompt cwd={cwdRef.current} />
          <Highlight line={input} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0 18px", color: "var(--t-muted)" }}>
            {options.map((o) => (
              <span key={o}>{o}</span>
            ))}
          </div>
        </div>
      );
  };

  // ── keyboard ───────────────────────────────────────────────────────────────
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Keep desktop shortcuts (Cmd+F etc.) out while typing, except Esc/Cmd combos.
    // Ctrl+Space (Spotlight) is let through too.
    if (!e.metaKey && !(e.ctrlKey && e.code === "Space")) e.stopPropagation();
    const k = e.key;
    const ctrl = e.ctrlKey;

    if (ctrl && k.toLowerCase() === "c") {
      e.preventDefault();
      if (ask) {
        print(
          <div>
            <C c="yellow">{ask.question}</C> {input}
            <C c="muted">^C</C>
          </div>
        );
        const r = ask.resolve;
        setAsk(null);
        setInput("");
        r(null);
        abortRef.current?.abort();
      } else if (busy) {
        abortRef.current?.abort();
        print(<C c="muted">^C</C>);
      } else {
        print(
          <div>
            <Prompt cwd={cwdRef.current} />
            <Highlight line={input} />
            <C c="muted">^C</C>
          </div>
        );
        setInput("");
      }
      return;
    }
    if (ctrl && k.toLowerCase() === "l") {
      e.preventDefault();
      setBlocks([]);
      return;
    }
    if (ctrl && k.toLowerCase() === "u") {
      e.preventDefault();
      setInput("");
      return;
    }

    if (k === "Enter") {
      e.preventDefault();
      if (ask) {
        print(
          <div>
            <C c="yellow">{ask.question}</C> {input}
          </div>
        );
        const r = ask.resolve;
        setAsk(null);
        setInput("");
        r(input);
        return;
      }
      if (busy) return;
      const line = input;
      setInput("");
      draft.current = "";
      exec(line);
      return;
    }
    if (k === "Tab") {
      e.preventDefault();
      if (!ask && !busy) tabComplete();
      return;
    }
    if (k === "ArrowRight" && hint && inputRef.current?.selectionStart === input.length) {
      e.preventDefault();
      setInput(input + hint);
      return;
    }
    if (k === "ArrowUp" && !ask) {
      e.preventDefault();
      if (!HISTORY.length) return;
      if (histIdx.current === HISTORY.length) draft.current = input;
      histIdx.current = Math.max(0, histIdx.current - 1);
      setInput(HISTORY[histIdx.current]);
      return;
    }
    if (k === "ArrowDown" && !ask) {
      e.preventDefault();
      if (histIdx.current >= HISTORY.length) return;
      histIdx.current += 1;
      setInput(histIdx.current === HISTORY.length ? draft.current : HISTORY[histIdx.current]);
    }
  };

  // Keep the coloured overlay scrolled with the input on long lines.
  const syncScroll = () => {
    if (overlayRef.current && inputRef.current) overlayRef.current.scrollLeft = inputRef.current.scrollLeft;
  };
  useEffect(syncScroll, [input]);

  const vars = Object.fromEntries(Object.entries(THEMES[theme]).map(([k, v]) => [`--t-${k}`, v])) as CSSProperties;
  const showInput = !program && (!busy || !!ask);

  return (
    <RunContext.Provider value={(l) => !busy && !ask && !program && exec(l)}>
      <div
        ref={rootRef}
        tabIndex={-1}
        onKeyDown={(e) => {
          // Only reached while a command runs (the input stops propagation).
          if (!busy || program) return;
          e.stopPropagation();
          if (e.ctrlKey && e.key.toLowerCase() === "c") {
            e.preventDefault();
            abortRef.current?.abort();
            print(<C c="muted">^C</C>);
          }
        }}
        className={`terminal-app font-terminal ${theme === "retro" ? "t-crt" : ""}`}
        style={{ ...vars, height: "100%", display: "flex", flexDirection: "column", background: "var(--t-bg)", color: "var(--t-fg)", fontSize: 13, lineHeight: 1.45, outline: "none" }}
        onClick={focusInput}
      >
        {program ? (
          <div style={{ flex: 1, minHeight: 0, padding: "8px 10px" }}>{program}</div>
        ) : (
          <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 10px 12px" }}>
            <div ref={contentRef}>
              {blocks.map((b) => (
                <div key={b.id} style={{ wordBreak: "break-word" }}>
                  {b.node}
                </div>
              ))}
              {showInput && (
                <div style={{ display: "flex", alignItems: "baseline" }}>
                  {ask ? <C c="yellow">{ask.question}&nbsp;</C> : <Prompt cwd={cwd} />}
                  <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
                    {!ask && (
                      <div ref={overlayRef} aria-hidden className="t-overlay">
                        <Highlight line={input} />
                        <span style={{ color: "var(--t-muted)" }}>{hint}</span>
                      </div>
                    )}
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={onKeyDown}
                      onScroll={syncScroll}
                      onSelect={syncScroll}
                      autoFocus
                      spellCheck={false}
                      autoCapitalize="off"
                      autoComplete="off"
                      aria-label={ask ? ask.question : "Terminal input"}
                      className="t-input"
                      style={{ color: ask ? "var(--t-fg)" : "transparent" }}
                    />
                  </div>
                </div>
              )}
              {busy && !ask && (
                <div style={{ color: "var(--t-muted)" }}>
                  <span className="t-cursor">▋</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </RunContext.Provider>
  );
}
