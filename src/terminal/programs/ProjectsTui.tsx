import { useState } from "react";
import { profile } from "~/data/profile";
import Frame, { Key } from "./Frame";

// `projects -i`: lazygit-style explorer. ↑/↓ select, enter = live, g = GitHub.
export default function ProjectsTui({ exit }: { exit: (summary?: React.ReactNode) => void }) {
  const [i, setI] = useState(0);
  const projects = profile.projects;
  const p = projects[i];

  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === "arrowdown" || k === "j") setI((v) => (v + 1) % projects.length);
    else if (k === "arrowup" || k === "k") setI((v) => (v - 1 + projects.length) % projects.length);
    else if (k === "enter" || k === "l") window.open(p.live, "_blank", "noopener");
    else if (k === "g") window.open(p.github, "_blank", "noopener");
    else if (k === "q" || k === "escape" || (e.ctrlKey && k === "c")) exit();
    else if (/^[1-9]$/.test(k) && +k <= projects.length) setI(+k - 1);
  };

  const box: React.CSSProperties = { border: "1px solid var(--t-border)", borderRadius: 4, padding: "8px 10px", minHeight: 0, overflowY: "auto" };

  return (
    <Frame
      onKey={onKey}
      footer={
        <>
          <Key k="↑↓">select</Key>
          <Key k="enter">open live</Key>
          <Key k="g">GitHub</Key>
          <Key k="q">quit</Key>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "minmax(150px, 30%) 1fr", gap: 8, height: "100%" }}>
        <div style={box}>
          <div style={{ color: "var(--t-muted)", marginBottom: 6 }}>─ projects ({projects.length}) ─</div>
          {projects.map((x, n) => (
            <div
              key={x.id}
              onClick={() => setI(n)}
              onDoubleClick={() => window.open(x.live, "_blank", "noopener")}
              style={{
                padding: "2px 6px",
                cursor: "default",
                background: n === i ? "var(--t-accent)" : "transparent",
                color: n === i ? "var(--t-bg-solid)" : "var(--t-fg)",
                fontWeight: n === i ? 700 : 400
              }}
            >
              {n === i ? "▸ " : "  "}
              {x.name}
              <span style={{ float: "right", opacity: 0.7 }}>{x.date}</span>
            </div>
          ))}
        </div>
        <div style={box}>
          <div style={{ color: "var(--t-yellow)", fontWeight: 700, fontSize: "1.15em" }}>{p.name}</div>
          <div style={{ color: "var(--t-muted)", margin: "2px 0 8px" }}>{p.date}</div>
          <div style={{ marginBottom: 8 }}>{p.tagline}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {p.stack.map((s) => (
              <span key={s} style={{ border: "1px solid var(--t-cyan)", color: "var(--t-cyan)", borderRadius: 3, padding: "0 5px" }}>
                {s}
              </span>
            ))}
          </div>
          {p.highlights.map((h) => (
            <div key={h} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              <span style={{ color: "var(--t-green)" }}>✓</span>
              <span>{h}</span>
            </div>
          ))}
          <div style={{ marginTop: 8, color: "var(--t-muted)" }}>
            live → <span style={{ color: "var(--t-blue)" }}>{p.live}</span>
            <br />
            code → <span style={{ color: "var(--t-blue)" }}>{p.github}</span>
          </div>
        </div>
      </div>
    </Frame>
  );
}
