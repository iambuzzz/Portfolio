import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Frame from "./Frame";

// ── matrix ───────────────────────────────────────────────────────────────────
const GLYPHS = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789AMBUJ";

export function Matrix({ exit }: { exit: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [msg, setMsg] = useState(false);
  useEffect(() => {
    const c = ref.current!;
    const box = c.parentElement!;
    c.width = box.clientWidth;
    c.height = box.clientHeight;
    const ctx = c.getContext("2d")!;
    const size = 14;
    const drops = Array.from({ length: Math.ceil(c.width / size) }, () => Math.random() * -40);
    const color = getComputedStyle(c).getPropertyValue("--t-green").trim() || "#3f3";
    let raf = 0;
    let last = 0;
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (t - last < 40) return;
      last = t;
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.font = `${size}px monospace`;
      drops.forEach((y, i) => {
        ctx.fillStyle = Math.random() > 0.97 ? "#fff" : color;
        ctx.fillText(GLYPHS[Math.floor(Math.random() * GLYPHS.length)], i * size, y * size);
        drops[i] = y * size > c.height && Math.random() > 0.975 ? 0 : y + 1;
      });
    };
    raf = requestAnimationFrame(frame);
    const m = setTimeout(() => setMsg(true), 1800);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(m);
    };
  }, []);
  return (
    <Frame onKey={() => exit()}>
      <div style={{ position: "absolute", inset: 0, background: "#000" }} onClick={() => exit()}>
        <canvas ref={ref} style={{ display: "block" }} />
        {msg && (
          <div className="flex-center" style={{ position: "absolute", inset: 0, flexDirection: "column", pointerEvents: "none" }}>
            <div style={{ background: "rgba(0,0,0,0.75)", padding: "10px 18px", color: "var(--t-green)", textAlign: "center", borderRadius: 4 }}>
              Wake up, visitor… the portfolio has you.
              <div style={{ opacity: 0.7, marginTop: 4 }}>press any key to exit the Matrix</div>
            </div>
          </div>
        )}
      </div>
    </Frame>
  );
}

// ── sl (steam locomotive) ────────────────────────────────────────────────────
// Classic `sl` art. Like the real thing, it can't be stopped.
const TRAIN = [
  "      ====        ________                ___________ ",
  "  _D _|  |_______/        \\__I_I_____===__|_________| ",
  "   |(_)---  |   H\\________/ |   |        =|___ ___|   ",
  "   /     |  |   H  |  |     |   |         ||_| |_||   ",
  "  |      |  |   H  |__--------------------| [___] |   ",
  "  | ________|___H__/__|_____/[][]~\\_______|       |   ",
  "  |/ |   |-----------I_____I [][] []  D   |=======|__ ",
  "__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__ ",
  " |/-=|___|=    ||    ||    ||    |_____/~\\___/        ",
  "  \\_/      \\O=====O=====O=====O_/      \\_/            "
];
const WHEELS_ALT = [
  "__/ =| o |=-O=====O=====O=====O \\ ____Y___________|__ ",
  " |/-=|___|=    ||    ||    ||    |_____/~\\___/        ",
  "  \\_/      \\__/  \\__/  \\__/  \\__/      \\_/            "
];
const SMOKE = ["                (  ) (@@) ( )  (@)  ()    @@    O     @", "          (@@@)", "      (    )", "    (@@@@)", "  (   )"];

export function Sl({ exit }: { exit: () => void }) {
  const [x, setX] = useState(100);
  const [f, setF] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = (t - t0) / 5200;
      if (p >= 1) return exit();
      setX(100 - p * 220);
      setF(Math.floor((t - t0) / 120));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const body = f % 2 ? [...TRAIN.slice(0, 7), ...WHEELS_ALT] : TRAIN;
  const smoke = SMOKE.map((s, i) => (f + i) % 3 === 0 ? s.replace(/@/g, "O") : s);
  return (
    <Frame onKey={() => {}}>
      <div className="flex-center" style={{ height: "100%", overflow: "hidden" }}>
        <pre style={{ margin: 0, lineHeight: 1.1, transform: `translateX(${x}%)`, whiteSpace: "pre", color: "var(--t-fg)" }}>
          <span style={{ color: "var(--t-muted)" }}>{smoke.join("\n")}</span>
          {"\n"}
          {body.join("\n")}
        </pre>
      </div>
    </Frame>
  );
}

// ── kernel panic (rm -rf /) ──────────────────────────────────────────────────
export function KernelPanic() {
  const [phase, setPhase] = useState<"panic" | "restart">("panic");
  useEffect(() => {
    const a = setTimeout(() => setPhase("restart"), 3600);
    const b = setTimeout(() => window.dispatchEvent(new CustomEvent("system:restart")), 6200);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);
  return createPortal(
    <div
      onClick={() => window.dispatchEvent(new CustomEvent("system:restart"))}
      style={{ position: "fixed", inset: 0, zIndex: 300000, background: "#000", color: "#ddd", fontFamily: "var(--font-mono)", cursor: "default" }}
    >
      {phase === "panic" ? (
        <pre style={{ margin: 0, padding: 24, fontSize: 12, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
          {`panic(cpu 0 caller 0xffffff8012a4c3e1): "guest@portfolio ran rm -rf / … bold move."
Debugger message: panic
Memory ID: 0x6
OS release type: User
OS version: PortfolioOS 26.0 (Ambuj Edition)
Kernel version: Darwin Kernel Version 26.0.0: sandboxed-in-your-browser
Fileset Kernelcache UUID: 4D4D-4255-4A-2027
System uptime in nanoseconds: 6.02e+23
Backtrace (CPU 0), Frame : Return Address
0xffffffa0b1c33a10 : 0xffffff80129a1c3d  com.ambuj.projects.devtinder
0xffffffa0b1c33a60 : 0xffffff80129b2e6f  com.ambuj.projects.buddyboard
0xffffffa0b1c33ab0 : 0xffffff80129c3f1a  com.ambuj.projects.foodiehub
0xffffffa0b1c33b00 : 0xffffff80129d4a2b  com.apple.kext.just.kidding

Nothing was actually deleted — this whole terminal is a simulation. 😉
Rebooting…`}
        </pre>
      ) : (
        <div className="flex-center" style={{ height: "100%", flexDirection: "column", gap: 18, fontFamily: "var(--font-system)" }}>
          <div style={{ fontSize: 54 }}>⏻</div>
          <div style={{ fontSize: 18, color: "#fff", textAlign: "center", maxWidth: 520, lineHeight: 1.5 }}>
            Your computer restarted because of a problem.
            <div style={{ fontSize: 14, color: "#aaa", marginTop: 8 }}>(The problem was `rm -rf /`. Please don't do that on a real machine.)</div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
