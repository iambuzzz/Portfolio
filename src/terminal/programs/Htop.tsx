import { useEffect, useMemo, useState } from "react";
import { profile } from "~/data/profile";
import Frame, { Key } from "./Frame";

// `htop`: Ambuj's skill list rendered as running processes. The skills are
// real (from the résumé); the CPU/MEM numbers are random, just for fun.

const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const meter = (v: number, w = 22) => "|".repeat(Math.round((v / 100) * w)).padEnd(w, " ");

export default function Htop({ exit }: { exit: () => void }) {
  const procs = useMemo(
    () =>
      Object.entries(profile.skills).flatMap(([group, list], g) =>
        list.map((name, i) => ({ pid: 1000 + g * 100 + i * 7, name, group, time: rand(0, 3000) }))
      ),
    []
  );
  const [tick, setTick] = useState(0);
  const [sel, setSel] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [paused]);

  // New random load every tick.
  const rows = useMemo(
    () =>
      procs
        .map((p) => ({ ...p, cpu: rand(0.3, 38), mem: rand(0.5, 9), time: p.time + tick }))
        .sort((a, b) => b.cpu - a.cpu),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick]
  );
  const cores = useMemo(() => [0, 1, 2, 3].map(() => rand(8, 96)), [tick]);
  const mem = useMemo(() => rand(40, 78), [tick]);
  const since = new Date(2023, 7, 1);
  const days = Math.floor((Date.now() - since.getTime()) / 86400000);

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === "q" || k === "escape" || k === "f10" || (e.ctrlKey && k === "c")) exit();
    else if (k === "arrowdown" || k === "j") setSel((v) => Math.min(rows.length - 1, v + 1));
    else if (k === "arrowup" || k === "k") setSel((v) => Math.max(0, v - 1));
    else if (k === " ") setPaused((v) => !v);
  };

  const cell = (w: number, right = false): React.CSSProperties => ({ width: w, flexShrink: 0, textAlign: right ? "right" : "left", paddingRight: 8 });

  return (
    <Frame
      onKey={onKey}
      footer={
        <>
          <Key k="↑↓">select</Key>
          <Key k="space">{paused ? "resume" : "freeze"}</Key>
          <Key k="q">quit</Key>
          <span style={{ float: "right" }}>skills are real · numbers are random 😄</span>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px", marginBottom: 8 }}>
        <div>
          {cores.map((c, i) => (
            <div key={i}>
              <span style={{ color: "var(--t-cyan)" }}>{i + 1}</span> [<span style={{ color: "var(--t-green)" }}>{meter(c)}</span>
              <span style={{ color: "var(--t-muted)" }}>{c.toFixed(1).padStart(5)}%</span>]
            </div>
          ))}
          <div>
            <span style={{ color: "var(--t-cyan)" }}>Mem</span>[<span style={{ color: "var(--t-yellow)" }}>{meter(mem, 20)}</span>
            <span style={{ color: "var(--t-muted)" }}>{mem.toFixed(0).padStart(3)}%</span>]
          </div>
        </div>
        <div>
          <div>
            <span style={{ color: "var(--t-cyan)" }}>Tasks:</span> <b>{procs.length}</b> skills, <b>{profile.projects.length}</b> projects running
          </div>
          <div>
            <span style={{ color: "var(--t-cyan)" }}>Load average:</span> <b>{(cores[0] / 25).toFixed(2)}</b> {(cores[1] / 25).toFixed(2)} {(cores[2] / 25).toFixed(2)}
          </div>
          <div>
            <span style={{ color: "var(--t-cyan)" }}>Uptime:</span> {days} days (since Aug 2023, IIIT Kota)
          </div>
          <div>
            <span style={{ color: "var(--t-cyan)" }}>DSA solved:</span> 600+ · <span style={{ color: "var(--t-cyan)" }}>LeetCode</span> 1830 ·{" "}
            <span style={{ color: "var(--t-cyan)" }}>CodeChef</span> 1585
          </div>
        </div>
      </div>
      <div style={{ display: "flex", background: "var(--t-green)", color: "var(--t-bg-solid)", fontWeight: 700 }}>
        <span style={cell(52, true)}>PID</span>
        <span style={cell(56)}>USER</span>
        <span style={cell(54, true)}>CPU%</span>
        <span style={cell(54, true)}>MEM%</span>
        <span style={cell(74, true)}>TIME+</span>
        <span style={{ ...cell(170), flex: 1 }}>COMMAND</span>
      </div>
      <div style={{ overflowY: "auto", height: "calc(100% - 118px)" }}>
        {rows.map((r, i) => (
          <div
            key={r.pid}
            onClick={() => setSel(i)}
            style={{ display: "flex", background: i === sel ? "var(--t-accent)" : "transparent", color: i === sel ? "var(--t-bg-solid)" : undefined }}
          >
            <span style={cell(52, true)}>{r.pid}</span>
            <span style={cell(56)}>ambuj</span>
            <span style={{ ...cell(54, true), color: i === sel ? undefined : r.cpu > 25 ? "var(--t-red)" : undefined }}>{r.cpu.toFixed(1)}</span>
            <span style={cell(54, true)}>{r.mem.toFixed(1)}</span>
            <span style={cell(74, true)}>{fmtTime(r.time)}</span>
            <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              <b>{r.name.toLowerCase().replace(/\s+/g, "-")}</b>
              <span style={{ opacity: 0.6 }}> --group={r.group.toLowerCase().replace(/[^a-z0-9]+/g, "-")}</span>
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}
