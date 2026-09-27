import { useEffect, useRef, useState } from "react";
import Frame, { Key } from "./Frame";

const COLS = 28;
const ROWS = 16;
const TICK = 110;
const BEST_KEY = "terminal-snake-best";

type P = { x: number; y: number };
const DIRS: Record<string, P> = {
  arrowup: { x: 0, y: -1 }, w: { x: 0, y: -1 }, k: { x: 0, y: -1 },
  arrowdown: { x: 0, y: 1 }, s: { x: 0, y: 1 }, j: { x: 0, y: 1 },
  arrowleft: { x: -1, y: 0 }, a: { x: -1, y: 0 }, h: { x: -1, y: 0 },
  arrowright: { x: 1, y: 0 }, d: { x: 1, y: 0 }, l: { x: 1, y: 0 }
};

const readBest = () => {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
};

export default function Snake({ exit }: { exit: (summary?: React.ReactNode) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const game = useRef({ snake: [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }] as P[], dir: { x: 1, y: 0 }, queue: [] as P[], food: { x: 18, y: 8 } as P });
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(readBest);
  const [state, setState] = useState<"playing" | "paused" | "over">("playing");

  const reset = () => {
    game.current = { snake: [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }], dir: { x: 1, y: 0 }, queue: [], food: { x: 18, y: 8 } };
    setScore(0);
    setState("playing");
  };

  const placeFood = () => {
    const g = game.current;
    let f: P;
    do f = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    while (g.snake.some((s) => s.x === f.x && s.y === f.y));
    g.food = f;
  };

  // Game loop
  useEffect(() => {
    if (state !== "playing") return;
    const t = setInterval(() => {
      const g = game.current;
      const next = g.queue.shift();
      if (next && !(next.x === -g.dir.x && next.y === -g.dir.y)) g.dir = next;
      const head = { x: g.snake[0].x + g.dir.x, y: g.snake[0].y + g.dir.y };
      const hitWall = head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS;
      const hitSelf = g.snake.some((s) => s.x === head.x && s.y === head.y);
      if (hitWall || hitSelf) {
        setState("over");
        return;
      }
      g.snake.unshift(head);
      if (head.x === g.food.x && head.y === g.food.y) {
        setScore((s) => s + 10);
        placeFood();
      } else g.snake.pop();
      draw();
    }, TICK);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    if (state === "over" && score > best) {
      setBest(score);
      try {
        localStorage.setItem(BEST_KEY, String(score));
      } catch {
        // storage blocked
      }
    }
  }, [state, score, best]);

  const draw = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const cell = c.width / COLS;
    const css = getComputedStyle(c);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = css.getPropertyValue("--t-red").trim() || "#f55";
    const f = game.current.food;
    ctx.beginPath();
    ctx.arc(f.x * cell + cell / 2, f.y * cell + cell / 2, cell / 2.6, 0, Math.PI * 2);
    ctx.fill();
    game.current.snake.forEach((s, i) => {
      ctx.fillStyle = (i === 0 ? css.getPropertyValue("--t-yellow") : css.getPropertyValue("--t-green")).trim() || "#5f5";
      ctx.fillRect(s.x * cell + 1, s.y * cell + 1, cell - 2, cell - 2);
    });
  };

  useEffect(draw, []);

  const finish = () =>
    exit(
      <span>
        snake: final score <b>{score}</b> · best <b>{Math.max(best, score)}</b>
      </span>
    );

  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === "q" || k === "escape" || (e.ctrlKey && k === "c")) return finish();
    if (state === "over") {
      if (k === "r" || k === "enter" || k === " ") reset();
      return;
    }
    if (k === " " || k === "p") return setState((s) => (s === "playing" ? "paused" : "playing"));
    const d = DIRS[k];
    if (d && game.current.queue.length < 3) game.current.queue.push(d);
  };

  return (
    <Frame
      onKey={onKey}
      onBlur={() => setState((s) => (s === "playing" ? "paused" : s))}
      footer={
        <>
          <Key k="←↑↓→">move (or WASD)</Key>
          <Key k="space">pause</Key>
          <Key k="q">quit</Key>
          <span style={{ float: "right" }}>
            score <b style={{ color: "var(--t-yellow)" }}>{score}</b> · best <b>{Math.max(best, score)}</b>
          </span>
        </>
      }
    >
      <div className="flex-center" style={{ height: "100%", flexDirection: "column" }}>
        <div style={{ position: "relative" }}>
          <canvas
            ref={canvasRef}
            width={COLS * 18}
            height={ROWS * 18}
            style={{ border: "1px solid var(--t-border)", borderRadius: 4, maxWidth: "100%", background: "rgba(0,0,0,0.25)" }}
          />
          {state !== "playing" && (
            <div className="flex-center" style={{ position: "absolute", inset: 0, flexDirection: "column", background: "rgba(0,0,0,0.55)", gap: 6 }}>
              <div style={{ fontSize: "1.4em", fontWeight: 700, color: state === "over" ? "var(--t-red)" : "var(--t-yellow)" }}>
                {state === "over" ? "GAME OVER" : "PAUSED"}
              </div>
              <div>{state === "over" ? "r to restart · q to quit" : "space to resume · click to focus"}</div>
            </div>
          )}
        </div>
      </div>
    </Frame>
  );
}
