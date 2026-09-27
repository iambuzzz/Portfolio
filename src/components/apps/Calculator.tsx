import { useEffect, useLayoutEffect, useRef, useState } from "react";

// iOS / macOS-style calculator: standard precedence (2 + 3 × 4 = 14), the
// pending operator stays highlighted, "=" repeats the last operation, and
// % works like iOS (50 + 10% → 55). Keyboard works while the window is focused.

type Op = "+" | "−" | "×" | "÷";
type Token = number | Op;

interface CalcState {
  expr: Token[]; // committed tokens, e.g. [12, "×"]
  entry: string; // number being typed ("" = none)
  result: number | null; // shown after "="
  last: { op: Op; operand: number } | null; // for repeated "="
  shownExpr: string; // expression line above the display
  error: boolean;
}

const INITIAL: CalcState = { expr: [], entry: "", result: null, last: null, shownExpr: "", error: false };
const MAX_DIGITS = 9;
const isOp = (t: Token): t is Op => typeof t === "string";
const round = (n: number) => Number(n.toPrecision(12));

const apply = (a: number, op: Op, b: number) =>
  op === "+" ? a + b : op === "−" ? a - b : op === "×" ? a * b : b === 0 ? NaN : a / b;

/** Evaluate with × ÷ before + −. */
function evaluate(tokens: Token[]): number {
  const t = [...tokens];
  if (isOp(t[t.length - 1])) t.pop();
  const sum: Token[] = [t[0] as number];
  for (let i = 1; i < t.length; i += 2) {
    const op = t[i] as Op;
    const n = t[i + 1] as number;
    if (op === "×" || op === "÷") sum[sum.length - 1] = apply(sum[sum.length - 1] as number, op, n);
    else sum.push(op, n);
  }
  let acc = sum[0] as number;
  for (let i = 1; i < sum.length; i += 2) acc = apply(acc, sum[i] as Op, sum[i + 1] as number);
  return round(acc);
}

/** What iOS shows right after an operator: the value that can already be reduced. */
function preview(expr: Token[], op: Op): number {
  const body = expr.slice(0, -1);
  if (op === "+" || op === "−") return evaluate(body);
  // × ÷: only the trailing multiplicative run.
  let start = body.length - 1;
  while (start >= 2 && (body[start - 1] === "×" || body[start - 1] === "÷")) start -= 2;
  return evaluate(body.slice(start));
}

function format(n: number): string {
  if (!isFinite(n)) return "Error";
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e9 || abs < 1e-8)) return n.toExponential(8).replace(/\.?0+e/, "e").replace("e+", "e");
  const intDigits = Math.max(1, Math.floor(Math.log10(abs || 1)) + 1);
  return n.toLocaleString("en-US", { maximumFractionDigits: Math.max(0, MAX_DIGITS - intDigits) });
}

/** Format while typing: keep a trailing "." or zeros the user typed. */
function formatEntry(e: string): string {
  const neg = e.startsWith("-");
  const [int, dec] = (neg ? e.slice(1) : e).split(".");
  const grouped = Number(int || "0").toLocaleString("en-US");
  return (neg ? "-" : "") + grouped + (dec !== undefined ? "." + dec : "");
}

const exprText = (tokens: Token[]) => tokens.map((t) => (isOp(t) ? ` ${t} ` : format(t))).join("");

function reduce(s: CalcState, key: string): CalcState {
  if (s.error && key !== "AC") s = INITIAL;

  // Digits
  if (/^[0-9]$/.test(key)) {
    const base = s.result !== null ? { ...INITIAL, last: s.last } : s;
    const digits = base.entry.replace(/[-.]/g, "");
    if (digits.length >= MAX_DIGITS) return base;
    const entry = base.entry === "0" ? key : base.entry === "-0" ? "-" + key : base.entry + key;
    return { ...base, entry };
  }
  if (key === ".") {
    const base = s.result !== null ? { ...INITIAL, last: s.last } : s;
    if (base.entry.includes(".")) return base;
    return { ...base, entry: (base.entry === "" || base.entry === "-" ? base.entry + "0" : base.entry) + "." };
  }

  // Operators
  if (key === "+" || key === "−" || key === "×" || key === "÷") {
    const op = key as Op;
    let expr: Token[];
    if (s.result !== null) expr = [s.result, op];
    else if (s.entry !== "") expr = [...s.expr, Number(s.entry), op];
    else if (s.expr.length && isOp(s.expr[s.expr.length - 1])) expr = [...s.expr.slice(0, -1), op]; // change operator
    else expr = [0, op];
    return { ...s, expr, entry: "", result: null, shownExpr: "" };
  }

  if (key === "=") {
    // Repeat the last operation: 2 + 3 = = → 8
    if (s.result !== null && s.last) {
      const r = round(apply(s.result, s.last.op, s.last.operand));
      return { ...s, result: r, shownExpr: `${format(s.result)} ${s.last.op} ${format(s.last.operand)}`, error: !isFinite(r) };
    }
    if (!s.expr.length) {
      return s.entry ? { ...s, result: Number(s.entry), entry: "", shownExpr: "" } : s;
    }
    // "2 + =" uses the displayed value as the second operand, like iOS.
    const operand = s.entry !== "" ? Number(s.entry) : preview(s.expr, s.expr[s.expr.length - 1] as Op);
    const full: Token[] = [...s.expr, operand];
    const r = evaluate(full);
    return {
      expr: [],
      entry: "",
      result: r,
      last: { op: s.expr[s.expr.length - 1] as Op, operand },
      shownExpr: exprText(full),
      error: !isFinite(r)
    };
  }

  if (key === "AC") return INITIAL;
  if (key === "⌫") {
    if (s.result !== null || !s.entry) return s;
    const entry = s.entry.slice(0, -1);
    return { ...s, entry: entry === "-" ? "" : entry };
  }

  if (key === "±") {
    if (s.result !== null) return { ...s, result: -s.result };
    if (s.entry) return { ...s, entry: s.entry.startsWith("-") ? s.entry.slice(1) : "-" + s.entry };
    return { ...s, entry: "-0" };
  }

  if (key === "%") {
    if (s.result !== null) return { ...s, result: round(s.result / 100) };
    if (!s.entry) return s;
    const v = Number(s.entry);
    const op = s.expr[s.expr.length - 1];
    // "50 + 10%" → 10% of 50
    const pct = (op === "+" || op === "−") && s.expr.length >= 2 ? round((preview(s.expr, op) * v) / 100) : round(v / 100);
    return { ...s, entry: String(pct) };
  }
  return s;
}

const KEYMAP: Record<string, string> = {
  "+": "+", "-": "−", "*": "×", x: "×", X: "×", "/": "÷", "÷": "÷", "=": "=", Enter: "=",
  Backspace: "⌫", Delete: "AC", Escape: "AC", c: "AC", C: "AC", "%": "%", ".": ".", ",": ".", n: "±"
};

type Kind = "fn" | "op" | "num";
const ROWS: { key: string; kind: Kind; wide?: boolean }[][] = [
  [{ key: "AC", kind: "fn" }, { key: "±", kind: "fn" }, { key: "%", kind: "fn" }, { key: "÷", kind: "op" }],
  [{ key: "7", kind: "num" }, { key: "8", kind: "num" }, { key: "9", kind: "num" }, { key: "×", kind: "op" }],
  [{ key: "4", kind: "num" }, { key: "5", kind: "num" }, { key: "6", kind: "num" }, { key: "−", kind: "op" }],
  [{ key: "1", kind: "num" }, { key: "2", kind: "num" }, { key: "3", kind: "num" }, { key: "+", kind: "op" }],
  [{ key: "0", kind: "num", wide: true }, { key: ".", kind: "num" }, { key: "=", kind: "op" }]
];

export default function Calculator() {
  const [s, setS] = useState<CalcState>(INITIAL);
  const [flash, setFlash] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);

  const press = (key: string) => {
    setS((cur) => reduce(cur, key));
    setFlash(key);
  };
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 120);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => rootRef.current?.focus(), []);

  const pendingOp = !s.entry && s.result === null && s.expr.length ? (s.expr[s.expr.length - 1] as Op) : null;
  const value = s.error
    ? "Error"
    : s.result !== null
      ? format(s.result)
      : s.entry
        ? formatEntry(s.entry)
        : pendingOp
          ? format(preview(s.expr, pendingOp))
          : "0";
  const typing = s.result === null && s.entry !== "" && !s.error;
  const topLine = s.result !== null ? s.shownExpr : exprText(s.expr) + (s.entry ? formatEntry(s.entry) : "");

  // Shrink the display font until the number fits (like iOS).
  useLayoutEffect(() => {
    const el = displayRef.current;
    if (!el) return;
    const fit = () => {
      const max = Math.min(76, el.parentElement!.clientHeight * 0.75);
      let size = max;
      el.style.fontSize = `${size}px`;
      while (el.scrollWidth > el.clientWidth && size > 18) {
        size -= 2;
        el.style.fontSize = `${size}px`;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement!);
    return () => ro.disconnect();
  }, [value]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
      e.preventDefault();
      navigator.clipboard?.writeText(value.replace(/,/g, "")).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1000);
      });
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") {
      e.preventDefault();
      navigator.clipboard?.readText().then((t) => {
        const n = t.replace(/,/g, "").trim();
        if (/^-?\d*\.?\d+$/.test(n)) {
          setS((cur) => ({ ...(cur.result !== null ? { ...INITIAL, last: cur.last } : cur), entry: n.slice(0, 12) }));
        }
      });
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const key = /^[0-9]$/.test(e.key) ? e.key : KEYMAP[e.key];
    if (!key) return;
    e.preventDefault();
    e.stopPropagation();
    // Backspace with nothing typed behaves like AC (as the top-left key does).
    press(key === "⌫" && !typing ? "AC" : key);
  };

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseDown={() => setTimeout(() => rootRef.current?.focus(), 0)}
      className="calc select-none"
      aria-label="Calculator"
    >
      {/* Display */}
      <div className="calc-display" onDoubleClick={() => navigator.clipboard?.writeText(value.replace(/,/g, ""))} title="⌘C to copy">
        <div className="calc-expr" aria-hidden>
          {copied ? "Copied" : topLine || " "}
        </div>
        <div ref={displayRef} className="calc-value" aria-live="polite">
          {value}
        </div>
      </div>

      {/* Keypad */}
      <div className="calc-keys">
        {ROWS.flat().map(({ key, kind, wide }) => {
          const label = key === "AC" ? (typing ? "⌫" : "AC") : key;
          const active = kind === "op" && key !== "=" && pendingOp === key;
          const pressed = flash === key || (key === "AC" && (flash === "⌫" || flash === "AC"));
          return (
            <button
              key={key}
              type="button"
              tabIndex={-1}
              aria-label={label === "⌫" ? "Delete" : label === "±" ? "Plus minus" : label}
              aria-pressed={active || undefined}
              className={`calc-btn calc-${kind} ${wide ? "calc-wide" : ""} ${active ? "calc-active" : ""} ${pressed ? "calc-pressed" : ""}`}
              onClick={() => press(label)}
            >
              {label === "⌫" ? <span className="i-ph:backspace" style={{ width: "0.95em", height: "0.95em" }} /> : label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
