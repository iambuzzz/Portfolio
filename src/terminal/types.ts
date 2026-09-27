import type { ReactNode } from "react";

// The Terminal is a simulation: every command is a plain function from this
// allow-list. Nothing a visitor types is ever evaluated as code or HTML.

export type ThemeName = "default" | "matrix" | "dracula" | "solarized" | "retro";

export interface PromptOptions {
  /** Pre-filled value. */
  initial?: string;
}

/** Full-window program (htop, snake, …). Call `exit` to return to the shell. */
export type Program = (exit: (summary?: ReactNode) => void) => ReactNode;

export interface Ctx {
  /** Append output. */
  print(node: ReactNode): void;
  clear(): void;
  cwd: string[];
  setCwd(path: string[]): void;
  /** Run another command line (as if typed). */
  run(line: string): Promise<void>;
  openApp(id: string): void;
  closeTerminal(): void;
  setTheme(t: ThemeName): void;
  theme: ThemeName;
  /** Replace the terminal with a full-window program until it exits. */
  takeover(program: Program): Promise<void>;
  /** Ask the visitor a question inline; resolves null on Ctrl+C. */
  prompt(question: string, opts?: PromptOptions): Promise<string | null>;
  /** Aborted when the visitor presses Ctrl+C. */
  signal: AbortSignal;
  history: string[];
}

export interface Command {
  name: string;
  aliases?: string[];
  summary: string;
  usage?: string;
  group: "Portfolio" | "Interactive" | "Music" | "Files & system" | "Fun & games";
  /** Easter eggs: runnable but not listed in `help`. */
  hidden?: boolean;
  /** Suggestions for the argument being typed. */
  complete?(args: string[], ctx: Pick<Ctx, "cwd">): string[];
  run(args: string[], ctx: Ctx): void | Promise<void>;
}
