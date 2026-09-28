import { useEffect, useMemo, useState } from "react";
import { profile } from "~/data/profile";
import Frame, { Key } from "./Frame";
import { unlock } from "~/settings/activity";

// `typing-test`: 30-second WPM test using words from Ambuj's tech stack.
const DURATION = 30;

const WORDS = Array.from(
  new Set(
    [...Object.values(profile.skills).flat(), ...profile.projects.flatMap((p) => [p.name, ...p.stack])]
      .flatMap((s) => s.toLowerCase().replace(/[()]/g, "").split(/\s+/))
      .filter((w) => w.length > 1 && w.length < 14)
  )
);

const makeText = () =>
  Array.from({ length: 60 }, () => WORDS[Math.floor(Math.random() * WORDS.length)]).join(" ");

export default function TypingTest({ exit }: { exit: (summary?: React.ReactNode) => void }) {
  const [target, setTarget] = useState(makeText);
  const [typed, setTyped] = useState("");
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!start || done) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [start, done]);

  const elapsed = start ? Math.min(DURATION, (now - start) / 1000) : 0;
  useEffect(() => {
    if (start && elapsed >= DURATION) setDone(true);
  }, [elapsed, start]);

  const stats = useMemo(() => {
    let correct = 0;
    for (let i = 0; i < typed.length; i++) if (typed[i] === target[i]) correct++;
    const minutes = Math.max(elapsed, 1) / 60;
    return { wpm: Math.round(correct / 5 / minutes), acc: typed.length ? Math.round((correct / typed.length) * 100) : 100 };
  }, [typed, target, elapsed]);

  useEffect(() => {
    if (done && stats.wpm >= 50 && stats.acc >= 85) unlock("typist");
  }, [done, stats.wpm, stats.acc]);

  const restart = () => {
    setTarget(makeText());
    setTyped("");
    setStart(null);
    setDone(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" || (e.ctrlKey && e.key.toLowerCase() === "c")) {
      return exit(
        start ? (
          <span>
            typing-test: <b>{stats.wpm} WPM</b> · {stats.acc}% accuracy
          </span>
        ) : undefined
      );
    }
    if (done) {
      if (e.key === "Enter" || e.key.toLowerCase() === "r") restart();
      return;
    }
    if (e.key === "Backspace") return setTyped((t) => t.slice(0, -1));
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
      if (!start) setStart(Date.now());
      setTyped((t) => (t.length < target.length ? t + e.key : t));
    }
  };

  // Show a window of text around the cursor.
  const from = Math.max(0, target.lastIndexOf(" ", Math.max(0, typed.length - 60)) + 1);
  const view = target.slice(from, from + 260);

  return (
    <Frame
      onKey={onKey}
      footer={
        <>
          <Key k="type">start the clock</Key>
          <Key k="⌫">fix</Key>
          <Key k="esc">quit</Key>
          {done && <Key k="r">retry</Key>}
        </>
      }
    >
      <div style={{ padding: "8px 4px", height: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 24, fontSize: "1.1em" }}>
          <span>
            ⏱ <b style={{ color: "var(--t-yellow)" }}>{Math.ceil(DURATION - elapsed)}s</b>
          </span>
          <span>
            <b style={{ color: "var(--t-green)" }}>{stats.wpm}</b> WPM
          </span>
          <span>
            <b style={{ color: "var(--t-cyan)" }}>{stats.acc}%</b> accuracy
          </span>
        </div>
        {done ? (
          <div style={{ fontSize: "1.2em", lineHeight: 1.8 }}>
            <div style={{ color: "var(--t-green)", fontWeight: 700 }}>Time! You typed {stats.wpm} WPM at {stats.acc}% accuracy.</div>
            <div style={{ color: "var(--t-muted)" }}>
              {stats.wpm >= 70 ? "Blazing. Ship it. 🚀" : stats.wpm >= 45 ? "Solid dev speed. ⌨️" : "Warm-up round, try again!"} — r to retry, esc to quit.
            </div>
          </div>
        ) : (
          <div style={{ fontSize: "1.25em", lineHeight: 1.8, wordBreak: "break-word" }}>
            {!start && <div style={{ color: "var(--t-muted)", fontSize: "0.8em" }}>Start typing the words below. Words come from Ambuj's tech stack.</div>}
            {view.split("").map((ch, n) => {
              const i = from + n;
              const t = typed[i];
              const color = t === undefined ? "var(--t-muted)" : t === ch ? "var(--t-green)" : "var(--t-red)";
              return (
                <span
                  key={i}
                  style={{
                    color,
                    background: t !== undefined && t !== ch && ch === " " ? "var(--t-red)" : undefined,
                    borderLeft: i === typed.length ? "2px solid var(--t-fg)" : "2px solid transparent",
                    marginLeft: -2
                  }}
                >
                  {ch}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </Frame>
  );
}
