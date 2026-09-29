import { useEffect, useState, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { profile } from "~/data/profile";
import apps from "~/configs/apps";
import { useStore } from "~/stores";
import { useCurrentTrack, useMusicStore } from "~/stores/music";
import { searchSongs } from "~/utils/saavn";
import { getGroqChatCompletion } from "~/utils/groq";
import { toPlainText } from "~/utils/text";
import { localAnswer } from "~/data/siriLocal";
import { SIRI_FALLBACK } from "~/data/siri";
import { contactFormEnabled, isEmail, mailtoLink, sendContactMessage } from "~/utils/contact";
import { ROOT, completePath, formatPath, resolve, text, type FsNode } from "./fs";
import { A, Art, Block, C, Columns, Pre, Run, Typewriter, bar, sleep } from "./ui";
import type { Command, Ctx, ThemeName } from "./types";
import ProjectsTui from "./programs/ProjectsTui";
import Htop from "./programs/Htop";
import Snake from "./programs/Snake";
import TypingTest from "./programs/TypingTest";
import { KernelPanic, Matrix, Sl } from "./programs/Effects";
import { unlock } from "~/settings/activity";

// ── helpers ──────────────────────────────────────────────────────────────────
const projectIds = profile.projects.map((p) => p.id);
const socials = profile.socials as Record<string, string>;
const appIds = apps.filter((a) => a.desktop && a.id !== "terminal").map((a) => a.id);
const fmtTime = (s: number) => (s && isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");
const typeOut = (ctx: Ctx, t: string, speed?: number) =>
  new Promise<void>((resolve) => ctx.print(<Typewriter text={t} speed={speed} signal={ctx.signal} onDone={resolve} />));
const err = (msg: ReactNode) => <C c="red">{msg}</C>;

// Full-screen programs driven by arrow keys / typing: a phone has no way to
// play (or even quit) them, so they stay laptop-only.
const noKeyboard = () => window.matchMedia?.("(pointer: coarse)").matches || window.innerWidth < 768;
const keyboardOnly = (name: string, ctx: Ctx) =>
  ctx.print(<C c="yellow">{name} needs a physical keyboard. Try it on a laptop!</C>);
const hash = (s: string) => {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0).toString(16).padStart(8, "0").slice(0, 7);
};

export const THEMES: ThemeName[] = ["default", "matrix", "dracula", "solarized", "retro"];

// Commands people try in "real" terminals. The sandbox says no, politely.
const SANDBOXED = ["curl", "wget", "ssh", "scp", "nc", "telnet", "ping", "python", "python3", "node", "bash", "sh", "zsh", "chmod", "chown", "apt", "apt-get", "brew", "npm", "pnpm", "yarn", "pip", "kill", "killall", "shutdown", "reboot", "mkdir", "touch", "mv", "cp", "export", "env", "eval", "exec"];

// ── Live "now playing" (updates in place) ────────────────────────────────────
function NowPlaying() {
  const t = useCurrentTrack();
  const { playing, position, duration } = useMusicStore(useShallow((s) => ({ playing: s.playing, position: s.position, duration: s.duration })));
  if (!t) return <C c="muted">Nothing playing. Try `play kesariya`.</C>;
  return (
    <div>
      <C c="green">{playing ? "▶" : "❚❚"}</C> <C b>{t.title}</C> <C c="muted">— {t.artist}</C>
      <div>
        <C c="muted">{fmtTime(position)}</C> <C c="green">{bar(position / Math.max(duration, 1), 30)}</C> <C c="muted">{fmtTime(duration)}</C>
      </div>
    </div>
  );
}

// ── neofetch ─────────────────────────────────────────────────────────────────
const APPLE = [
  ["green", "                    'c."],
  ["green", "                 ,xNMM."],
  ["green", "               .OMMMMo"],
  ["green", "               OMMM0,"],
  ["green", "     .;loddo:' loolloddol;."],
  ["green", "   cKMMMMMMMMMMNWMMMMMMMMMM0:"],
  ["yellow", " .KMMMMMMMMMMMMMMMMMMMMMMMWd."],
  ["yellow", " XMMMMMMMMMMMMMMMMMMMMMMMX."],
  ["orange", ";MMMMMMMMMMMMMMMMMMMMMMMM:"],
  ["orange", ":MMMMMMMMMMMMMMMMMMMMMMMM:"],
  ["red", ".MMMMMMMMMMMMMMMMMMMMMMMMX."],
  ["red", " kMMMMMMMMMMMMMMMMMMMMMMMMWd."],
  ["purple", " .XMMMMMMMMMMMMMMMMMMMMMMMMMMk"],
  ["purple", "  .XMMMMMMMMMMMMMMMMMMMMMMMMK."],
  ["blue", "    kMMMMMMMMMMMMMMMMMMMMMMd"],
  ["blue", "     ;KMMMMMMMWXXWMMMMMMMk."],
  ["blue", "       .cooc,.    .,coo:."]
] as const;

function Neofetch() {
  const info: [string, ReactNode][] = [
    ["OS", "B.Tech CSE · IIIT Kota (2023–2027)"],
    ["Host", profile.location],
    ["Kernel", "Full-Stack Developer"],
    ["Uptime", "600+ DSA problems solved"],
    ["Packages", `${profile.projects.length} projects (${projectIds.join(", ")})`],
    ["Shell", "MERN · Next.js · TypeScript"],
    ["Backend", "Kafka · gRPC · Redis · AWS"],
    ["Ratings", "LeetCode 1830 · CodeChef 1585 (2★)"],
    ["Certs", `${profile.certifications.length} (${profile.certifications.map((c) => c.issuer).join(", ")})`],
    ["Contact", <A key="m" href={`mailto:${profile.email}`} />]
  ];
  return (
    <div style={{ display: "flex", gap: 22, flexWrap: "wrap", margin: "4px 0 8px" }}>
      <Art>
        {APPLE.map(([c, l], i) => (
          <div key={i} style={{ color: `var(--t-${c})` }}>
            {l}
          </div>
        ))}
      </Art>
      <div style={{ lineHeight: 1.5 }}>
        <C c="green" b>
          ambuj
        </C>
        @<C c="green" b>iiitkota</C>
        <div>
          <C c="muted">{"-".repeat(14)}</C>
        </div>
        {info.map(([k, v]) => (
          <div key={k}>
            <C c="yellow" b>
              {k}
            </C>
            : {v}
          </div>
        ))}
        <div style={{ marginTop: 6 }}>
          {["red", "green", "yellow", "blue", "purple", "cyan", "orange", "fg"].map((c) => (
            <span key={c} style={{ background: `var(--t-${c})`, display: "inline-block", width: 22, height: 14 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── git log: the journey, from dates on the résumé ───────────────────────────
const JOURNEY: { date: string; type: string; msg: string; ref?: string }[] = [
  { date: "Aug 2027", type: "chore", msg: "graduate from IIIT Kota (expected)", ref: "HEAD -> main" },
  ...profile.certifications
    .filter((c) => c.year >= 2026)
    .map((c) => ({ date: String(c.year), type: "docs", msg: `certified: ${c.title} (${c.issuer})` })),
  ...profile.projects
    .slice()
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .map((p) => ({ date: p.date, type: "feat", msg: `ship ${p.name} — ${p.stack.slice(0, 4).join(", ")}`, ref: p.id === "buddyboard" ? "tag: latest" : undefined })),
  ...profile.certifications
    .filter((c) => c.year < 2026)
    .map((c) => ({ date: String(c.year), type: "docs", msg: `certified: ${c.title} (${c.issuer})` })),
  { date: "Aug 2023", type: "init", msg: "start B.Tech CSE at IIIT Kota", ref: "origin" }
];

function GitLog() {
  return (
    <Block gap={6}>
      {JOURNEY.map((j) => (
        <div key={j.msg}>
          <C c="yellow">commit {hash(j.msg)}</C>
          {j.ref && (
            <>
              {" "}
              (<C c="cyan" b>{j.ref}</C>)
            </>
          )}
          <div>
            <C c="muted">Author: Ambuj Jaiswal &lt;{profile.email}&gt;</C>
          </div>
          <div>
            <C c="muted">Date:   {j.date}</C>
          </div>
          <div style={{ paddingLeft: 24 }}>
            <C c={j.type === "feat" ? "green" : j.type === "init" ? "purple" : j.type === "docs" ? "blue" : "orange"}>{j.type}:</C> {j.msg}
          </div>
        </div>
      ))}
    </Block>
  );
}

// ── cowsay / fortune ─────────────────────────────────────────────────────────
const FORTUNES = [
  ["Talk is cheap. Show me the code.", "Linus Torvalds"],
  ["Programs must be written for people to read, and only incidentally for machines to execute.", "Harold Abelson"],
  ["Premature optimization is the root of all evil.", "Donald Knuth"],
  ["Simplicity is prerequisite for reliability.", "Edsger W. Dijkstra"],
  ["Any fool can write code that a computer can understand. Good programmers write code that humans can understand.", "Martin Fowler"],
  ["There are only two hard things in Computer Science: cache invalidation and naming things.", "Phil Karlton"],
  ["Make it work, make it right, make it fast.", "Kent Beck"],
  ["First, solve the problem. Then, write the code.", "John Johnson"],
  ["Walking on water and developing software from a specification are easy if both are frozen.", "Edward V. Berard"],
  ["It's not a bug — it's an undocumented feature.", "Anonymous"]
];

const cowsay = (msg: string) => {
  const words = msg.split(/\s+/);
  const rows: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > 38) {
      rows.push(cur.trim());
      cur = w;
    } else cur += " " + w;
  }
  if (cur.trim()) rows.push(cur.trim());
  const w = Math.max(...rows.map((r) => r.length));
  const top = " " + "_".repeat(w + 2);
  const bottom = " " + "-".repeat(w + 2);
  const body =
    rows.length === 1
      ? [`< ${rows[0]} >`]
      : rows.map((r, i) => `${i === 0 ? "/" : i === rows.length - 1 ? "\\" : "|"} ${r.padEnd(w)} ${i === 0 ? "\\" : i === rows.length - 1 ? "/" : "|"}`);
  return [top, ...body, bottom, "        \\   ^__^", "         \\  (oo)\\_______", "            (__)\\       )\\/\\", "                ||----w |", "                ||     ||"].join("\n");
};

// ── quiz (from résumé facts) ─────────────────────────────────────────────────
const QUIZ: { q: string; options: string[]; answer: number }[] = [
  { q: "Which project uses Apache Kafka and gRPC?", options: ["FoodieHub", "DevTinder", "BuddyBoard", "None of them"], answer: 1 },
  { q: "Where is Ambuj studying?", options: ["IIT Bombay", "NIT Trichy", "IIIT Kota", "BITS Pilani"], answer: 2 },
  { q: "What is Ambuj's max LeetCode rating?", options: ["1585", "1830", "2100", "1450"], answer: 1 },
  { q: "Which stack powers BuddyBoard?", options: ["Next.js + Firebase", "Django + Postgres", "MERN + Kafka", "Vue + Supabase"], answer: 0 },
  { q: "How many DSA problems has Ambuj solved?", options: ["100+", "300+", "600+", "50+"], answer: 2 },
  { q: "Which project was built first?", options: ["DevTinder", "BuddyBoard", "FoodieHub"], answer: 2 },
  { q: "FoodieHub is inspired by which app?", options: ["Zomato", "Swiggy", "Uber Eats", "Blinkit"], answer: 1 },
  { q: "What's Ambuj's CodeChef rating tier?", options: ["1-star", "2-star", "4-star", "5-star"], answer: 1 }
];

// ── the registry ─────────────────────────────────────────────────────────────
const list: Command[] = [
  // Portfolio
  {
    name: "help",
    group: "Portfolio",
    summary: "list commands (help <cmd> for details)",
    complete: () => commandNames(),
    run: ([name], ctx) => {
      if (name) return ctx.run(`man ${name}`);
      const groups = ["Portfolio", "Interactive", "Music", "Files & system", "Fun & games"] as const;
      ctx.print(
        <Block gap={8}>
          {groups.map((g) => (
            <div key={g}>
              <C c="yellow" b>
                {g}
              </C>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", columnGap: 16 }}>
                {list
                  .filter((c) => c.group === g && !c.hidden)
                  .map((c) => (
                    <div key={c.name} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <Run cmd={c.name}>{c.name.padEnd(12)}</Run> <C c="muted">{c.summary}</C>
                    </div>
                  ))}
              </div>
            </div>
          ))}
          <div>
            <C c="muted">Tab</C> autocompletes · <C c="muted">↑↓</C> history · <C c="muted">Ctrl+C</C> cancels · <C c="muted">Ctrl+L</C> clears ·
            click any <C c="accent">highlighted</C> command to run it.
          </div>
          <div>
            <C c="muted">Some commands are hidden. 👀 Try something you shouldn't.</C>
          </div>
        </Block>
      );
    }
  },
  {
    name: "man",
    group: "Files & system",
    summary: "manual for a command",
    usage: "man <command>",
    hidden: true,
    complete: () => commandNames(),
    run: ([name], ctx) => {
      const c = name && find(name);
      if (!c) return ctx.print(name ? err(`No manual entry for ${name}`) : "What manual page do you want?");
      ctx.print(
        <Block>
          <div>
            <C c="yellow" b>
              {c.name}
            </C>{" "}
            — {c.summary}
          </div>
          <div>
            usage: <C c="green">{c.usage ?? c.name}</C>
          </div>
          {c.aliases && <div>aliases: {c.aliases.join(", ")}</div>}
        </Block>
      );
    }
  },
  {
    name: "whoami",
    group: "Portfolio",
    summary: "who is Ambuj?",
    run: (_, ctx) =>
      ctx.print(
        <Block>
          <C c="yellow" b>
            {profile.name}
          </C>
          <span>{profile.role}</span>
          <C c="muted">📍 {profile.location}</C>
          <span>
            Next: <Run cmd="about" /> · <Run cmd="projects" /> · <Run cmd="neofetch" /> · <Run cmd="sudo hire-ambuj" />
          </span>
        </Block>
      )
  },
  { name: "about", group: "Portfolio", summary: "short bio and interests", run: (_, ctx) => ctx.print(<Pre>{text.about()}</Pre>) },
  { name: "education", group: "Portfolio", summary: "college & school", run: (_, ctx) => ctx.print(<Pre>{text.education()}</Pre>) },
  {
    name: "skills",
    group: "Portfolio",
    summary: "languages, frameworks & tools",
    run: (_, ctx) =>
      ctx.print(
        <Block gap={6}>
          {Object.entries(profile.skills).map(([group, items], gi) => (
            <div key={group}>
              <C c={(["green", "blue", "purple", "orange", "cyan"] as const)[gi % 5]} b>
                {group}
              </C>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 8px", marginTop: 2 }}>
                {items.map((s) => (
                  <span key={s} style={{ border: "1px solid var(--t-border)", borderRadius: 3, padding: "0 6px" }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <C c="muted">
            Fun view: <Run cmd="htop" />
          </C>
        </Block>
      )
  },
  {
    name: "projects",
    group: "Portfolio",
    summary: "things Ambuj built (projects -i: interactive)",
    usage: "projects [-i | <name>]",
    complete: () => ["-i", ...projectIds],
    run: async ([arg], ctx) => {
      if ((arg === "-i" || arg === "--interactive") && noKeyboard()) arg = "";
      if (arg === "-i" || arg === "--interactive") return ctx.takeover((exit) => <ProjectsTui exit={exit} />);
      if (arg) {
        const p = profile.projects.find((x) => x.id === arg.toLowerCase() || x.name.toLowerCase() === arg.toLowerCase());
        if (!p) return ctx.print(err(`projects: no such project: ${arg} (try ${projectIds.join(", ")})`));
        return ctx.print(
          <Block>
            <div>
              <C c="yellow" b>
                {p.name}
              </C>{" "}
              <C c="muted">· {p.date}</C>
            </div>
            <span>{p.tagline}</span>
            <C c="cyan">{p.stack.join(" · ")}</C>
            {p.highlights.map((h) => (
              <div key={h} style={{ display: "flex", gap: 8 }}>
                <C c="green">✓</C>
                <span>{h}</span>
              </div>
            ))}
            <span>
              live: <A href={p.live} /> · code: <A href={p.github} />
            </span>
          </Block>
        );
      }
      ctx.print(
        <Block>
          {profile.projects.map((p) => (
            <div key={p.id}>
              <Run cmd={`projects ${p.id}`}>{p.name.padEnd(11)}</Run> <C c="muted">{p.date.padEnd(9)}</C> {p.tagline}
            </div>
          ))}
          <C c="muted">
            Try the interactive explorer: <Run cmd="projects -i" />
          </C>
        </Block>
      );
    }
  },
  {
    name: "achievements",
    group: "Portfolio",
    summary: "competitive programming",
    run: (_, ctx) =>
      ctx.print(
        <Block>
          {profile.achievements.map((a) => (
            <div key={a}>
              <C c="yellow">★</C> {a}
            </div>
          ))}
          <span>
            <A href={profile.socials.leetcode}>LeetCode</A> · <A href={profile.socials.codechef}>CodeChef</A> ·{" "}
            <A href={profile.socials.codolio}>Codolio</A>
          </span>
        </Block>
      )
  },
  {
    name: "certs",
    aliases: ["certifications", "certificates"],
    group: "Portfolio",
    summary: "certifications",
    run: (_, ctx) =>
      ctx.print(
        <Block>
          {profile.certifications.map((c) => (
            <div key={c.id}>
              <C c="green">✔</C> {c.title} <C c="muted">— {c.issuer}, {c.year}</C> · <A href={c.url}>verify</A>
            </div>
          ))}
        </Block>
      )
  },
  {
    name: "contact",
    aliases: ["socials"],
    group: "Portfolio",
    summary: "how to reach Ambuj",
    run: (_, ctx) =>
      ctx.print(
        <Block>
          <span>
            ✉️ <A href={`mailto:${profile.email}`} />
          </span>
          {Object.entries(profile.socials).map(([k, v]) => (
            <span key={k}>
              <C c="muted">{k.padEnd(9)}</C>
              <A href={v} />
            </span>
          ))}
          <span>
            Or send a message right here: <Run cmd="mail" />
          </span>
        </Block>
      )
  },
  {
    name: "resume",
    aliases: ["cv"],
    group: "Portfolio",
    summary: "download the résumé (PDF)",
    run: (_, ctx) => {
      const a = document.createElement("a");
      a.href = profile.resumeDownload;
      a.download = profile.resumeFileName;
      a.click();
      unlock("resume");
      ctx.print(
        <span>
          <C c="green">↓</C> Downloading {profile.resumeFileName}… (or <A href={profile.resume}>open it</A>)
        </span>
      );
    }
  },
  { name: "neofetch", aliases: ["fastfetch"], group: "Portfolio", summary: "system info, Ambuj edition", run: (_, ctx) => ctx.print(<Neofetch />) },
  {
    name: "git",
    group: "Portfolio",
    summary: "git log: Ambuj's journey as commits",
    usage: "git log | git status",
    complete: () => ["log", "status"],
    run: ([sub], ctx) => {
      if (!sub || sub === "log") return ctx.print(<GitLog />);
      if (sub === "status")
        return ctx.print(
          <Pre>
            {`On branch main\nYour branch is ahead of 'origin/college' by ${profile.projects.length} shipped projects.\n\nnothing to commit, working tree clean ✨`}
          </Pre>
        );
      ctx.print(err(`git: '${sub}' isn't available here — try \`git log\` or \`git status\``));
    }
  },

  // Interactive
  {
    name: "ask",
    group: "Interactive",
    summary: "ask the AI anything about Ambuj",
    usage: "ask <question>",
    run: async (args, ctx) => {
      const q = args.join(" ").trim();
      if (!q) return ctx.print(<span>usage: ask &lt;question&gt; — e.g. <Run cmd="ask what has Ambuj built?" /></span>);
      ctx.print(<C c="muted">thinking…</C>);
      let reply = "";
      try {
        const data = await getGroqChatCompletion(q.slice(0, 500));
        const msg = data.choices?.[0]?.message ?? {};
        reply = toPlainText(msg.content || "");
        for (const tc of msg.tool_calls ?? []) {
          let a: Record<string, string> = {};
          try {
            a = JSON.parse(tc.function.arguments || "{}");
          } catch {
            /* ignore */
          }
          const n = tc.function.name;
          if (n === "play_music") await ctx.run(a.query ? `play ${a.query}` : "play");
          else if (n === "pause_music") await ctx.run("pause");
          else if (n === "open_app" && a.app_id) await ctx.run(`open ${a.app_id}`);
          else if (n === "toggle_dark_mode") useStore.getState().toggleDark();
          else if (n === "download_resume") await ctx.run("resume");
          else if (n === "open_launchpad") await ctx.run("projects -i");
          else if (n === "get_current_time") await ctx.run("date");
        }
        if (!reply && (msg.tool_calls ?? []).length) return;
      } catch {
        if (ctx.signal.aborted) return;
        const local = localAnswer(q);
        reply = local?.reply || SIRI_FALLBACK;
      }
      if (ctx.signal.aborted) return;
      await typeOut(ctx, reply || SIRI_FALLBACK);
    }
  },
  {
    name: "mail",
    aliases: ["message"],
    group: "Interactive",
    summary: "send Ambuj a message from here",
    run: async (_, ctx) => {
      ctx.print(
        <span>
          📨 New message to <C c="yellow">{profile.name}</C> <C c="muted">(Ctrl+C to cancel)</C>
        </span>
      );
      const name = await ctx.prompt("Your name:");
      if (name === null) return;
      if (!name.trim()) return ctx.print(err("mail: a name is required"));
      let email: string | null = "";
      while (!isEmail(email ?? "")) {
        email = await ctx.prompt("Your email:");
        if (email === null) return;
        if (!isEmail(email)) ctx.print(<C c="red">That doesn't look like an email address — try again.</C>);
      }
      const subject = await ctx.prompt("Subject:", { initial: "Hello from your portfolio" });
      if (subject === null) return;
      const message = await ctx.prompt("Message:");
      if (message === null) return;
      if (!message.trim()) return ctx.print(err("mail: empty message, nothing sent"));
      const ok = await ctx.prompt("Send it? [Y/n]");
      if (ok === null || /^n/i.test(ok)) return ctx.print(<C c="muted">Not sent.</C>);
      const m = { name: name.trim(), email: email!.trim(), subject: subject.trim(), message: message.trim() };
      if (!contactFormEnabled) {
        window.location.href = mailtoLink(m);
        return ctx.print(<span>Opening your mail app…</span>);
      }
      ctx.print(<C c="muted">Sending…</C>);
      const sent = await sendContactMessage(m);
      if (sent) unlock("mail");
      ctx.print(
        sent ? (
          <C c="green">✔ Sent! Ambuj will reply to {m.email}.</C>
        ) : (
          <C c="red">
            ✘ Couldn't send. Email <A href={`mailto:${profile.email}`} /> directly.
          </C>
        )
      );
    }
  },
  {
    name: "quiz",
    group: "Fun & games",
    summary: "how well do you know Ambuj?",
    run: async (_, ctx) => {
      const qs = [...QUIZ].sort(() => Math.random() - 0.5).slice(0, 5);
      let score = 0;
      ctx.print(<C c="yellow">🧠 5 questions. Answer with a, b, c or d. (Ctrl+C to quit)</C>);
      for (const [i, q] of qs.entries()) {
        ctx.print(
          <Block>
            <C b>
              {i + 1}. {q.q}
            </C>
            {q.options.map((o, n) => (
              <span key={o}>
                {"   "}
                <C c="cyan">{String.fromCharCode(97 + n)})</C> {o}
              </span>
            ))}
          </Block>
        );
        let pick = -1;
        while (pick < 0 || pick >= q.options.length) {
          const a = await ctx.prompt("answer:");
          if (a === null) return;
          pick = a.trim().toLowerCase().charCodeAt(0) - 97;
        }
        if (pick === q.answer) {
          score++;
          ctx.print(<C c="green">✔ correct</C>);
        } else ctx.print(<C c="red">✘ it's {q.options[q.answer]}</C>);
      }
      if (score === 5) unlock("superfan");
      ctx.print(
        <C c={score >= 4 ? "green" : "yellow"} b>
          Score: {score}/5 {score === 5 ? "— you should probably hire Ambuj 😄" : score >= 3 ? "— nice!" : "— check out `about` and try again!"}
        </C>
      );
    }
  },
  { name: "htop", aliases: ["top", "btop"], group: "Interactive", summary: "skills as running processes", run: (_, ctx) => (noKeyboard() ? keyboardOnly("htop", ctx) : ctx.takeover((exit) => <Htop exit={exit} />)) },

  // Music
  {
    name: "play",
    group: "Music",
    summary: "play any song (JioSaavn)",
    usage: "play <song or artist>",
    run: async (args, ctx) => {
      const q = args.join(" ").trim();
      const m = useMusicStore.getState();
      if (!q) {
        if (!m.queue.length) return ctx.print(<span>usage: play &lt;song&gt; — e.g. <Run cmd="play kesariya" /></span>);
        m.toggle(true);
        return ctx.print(<NowPlaying />);
      }
      ctx.print(<C c="muted">🔎 searching “{q}”…</C>);
      try {
        const tracks = await searchSongs(q);
        if (ctx.signal.aborted) return;
        if (!tracks.length) return ctx.print(err(`play: nothing found for “${q}”`));
        m.playQueue(tracks, 0);
        ctx.print(<NowPlaying />);
        ctx.print(
          <C c="muted">
            Up next: {tracks.slice(1, 4).map((t) => t.title).join(" · ")} — <Run cmd="next" /> <Run cmd="pause" /> <Run cmd="open spotify" />
          </C>
        );
      } catch (e) {
        ctx.print(err(`play: ${(e as Error).message}`));
      }
    }
  },
  {
    name: "pause",
    group: "Music",
    summary: "pause the music",
    run: (_, ctx) => {
      useMusicStore.getState().toggle(false);
      ctx.print(<C c="muted">❚❚ paused</C>);
    }
  },
  { name: "next", aliases: ["skip"], group: "Music", summary: "next song", run: (_, ctx) => (useMusicStore.getState().next(), ctx.print(<NowPlaying />)) },
  { name: "prev", aliases: ["previous"], group: "Music", summary: "previous song", run: (_, ctx) => (useMusicStore.getState().prev(), ctx.print(<NowPlaying />)) },
  { name: "np", aliases: ["nowplaying"], group: "Music", summary: "what's playing (live)", run: (_, ctx) => ctx.print(<NowPlaying />) },
  {
    name: "vol",
    aliases: ["volume"],
    group: "Music",
    summary: "set volume 0–100",
    usage: "vol <0-100>",
    run: ([v], ctx) => {
      const m = useMusicStore.getState();
      if (v === undefined) return ctx.print(<span>volume: {m.volume}% {bar(m.volume / 100, 20)}</span>);
      const n = Math.max(0, Math.min(100, Number(v)));
      if (Number.isNaN(n)) return ctx.print(err("vol: expected a number 0–100"));
      m.setVolume(n);
      ctx.print(<span>🔊 {n}% {bar(n / 100, 20)}</span>);
    }
  },

  // Files & system
  {
    name: "ls",
    group: "Files & system",
    summary: "list files",
    usage: "ls [-a] [path]",
    complete: (args, ctx) => completePath(ctx.cwd, args[args.length - 1] ?? "", "dir"),
    run: (args, ctx) => {
      const all = args.includes("-a") || args.includes("-la") || args.includes("-al");
      const target = args.find((a) => !a.startsWith("-"));
      const r = resolve(ctx.cwd, target ?? ".");
      if (!r) return ctx.print(err(`ls: ${target}: No such file or directory`));
      if (r.node.type === "file") return ctx.print(r.node.name);
      const base = target ? target.replace(/\/?$/, "/") : "";
      const items = r.node.children.filter((c) => all || !c.hidden);
      ctx.print(
        <Columns
          items={[...(all ? [<C key="." c="blue">./</C>, <C key=".." c="blue">../</C>] : []), ...items.map((c) => <Entry key={c.name} node={c} base={base} />)]}
        />
      );
    }
  },
  {
    name: "cd",
    group: "Files & system",
    summary: "change directory",
    usage: "cd <dir>",
    complete: (args, ctx) => completePath(ctx.cwd, args[args.length - 1] ?? "", "dir"),
    run: ([p], ctx) => {
      const r = resolve(ctx.cwd, p ?? "~");
      if (!r) return ctx.print(err(`cd: no such file or directory: ${p}`));
      if (r.node.type !== "dir") return ctx.print(err(`cd: not a directory: ${p}`));
      ctx.setCwd(r.path);
    }
  },
  {
    name: "cat",
    aliases: ["less", "more", "bat"],
    group: "Files & system",
    summary: "print a file",
    usage: "cat <file>",
    complete: (args, ctx) => completePath(ctx.cwd, args[args.length - 1] ?? "", "file"),
    run: ([p], ctx) => {
      if (!p) return ctx.print("usage: cat <file> — try `ls`");
      const r = resolve(ctx.cwd, p);
      if (!r) return ctx.print(err(`cat: ${p}: No such file or directory`));
      if (r.node.type === "dir") return ctx.print(err(`cat: ${p}: Is a directory`));
      if (r.node.open)
        return ctx.print(
          <span>
            cat: {p}: binary file — try <Run cmd={`open ${p}`} />
          </span>
        );
      if (r.node.name === ".secrets") unlock("secrets");
      ctx.print(<Pre>{r.node.content}</Pre>);
    }
  },
  {
    name: "tree",
    group: "Files & system",
    summary: "show the file tree",
    run: (_, ctx) => {
      const out: string[] = [formatPath(ctx.cwd)];
      const walk = (n: FsNode, prefix: string) => {
        if (n.type !== "dir") return;
        const kids = n.children.filter((c) => !c.hidden);
        kids.forEach((c, i) => {
          const last = i === kids.length - 1;
          out.push(`${prefix}${last ? "└── " : "├── "}${c.name}${c.type === "dir" ? "/" : ""}`);
          walk(c, prefix + (last ? "    " : "│   "));
        });
      };
      walk(resolve(ctx.cwd, ".")?.node ?? ROOT, "");
      ctx.print(<Art>{out.join("\n")}</Art>);
    }
  },
  { name: "pwd", group: "Files & system", summary: "current directory", run: (_, ctx) => ctx.print(`/Users/guest/${ctx.cwd.join("/")}`.replace(/\/$/, "")) },
  {
    name: "open",
    group: "Files & system",
    summary: "open an app, project, link or file",
    usage: "open <app | project | github | linkedin | file>",
    complete: (args, ctx) => [...appIds, ...projectIds, ...Object.keys(socials), "resume", ...completePath(ctx.cwd, args[args.length - 1] ?? "")],
    run: ([t], ctx) => {
      if (!t)
        return ctx.print(
          <span>
            usage: open &lt;target&gt; — apps: {appIds.join(", ")} · projects: {projectIds.join(", ")} · links: {Object.keys(socials).join(", ")}
          </span>
        );
      const key = t.toLowerCase();
      const project = profile.projects.find((p) => p.id === key);
      const r = resolve(ctx.cwd, t);
      const url =
        project?.live ?? socials[key] ?? (key === "resume" ? profile.resume : undefined) ?? (r?.node.type === "file" ? r.node.open : undefined);
      if (url) {
        window.open(url, "_blank", "noopener");
        return ctx.print(<span>Opening {url.replace(/^https?:\/\//, "")}…</span>);
      }
      if (appIds.includes(key)) {
        ctx.openApp(key);
        return ctx.print(<span>Opening {apps.find((a) => a.id === key)?.title}…</span>);
      }
      if (r?.node.type === "file") return ctx.run(`cat ${t}`);
      ctx.print(err(`open: can't open “${t}”`));
    }
  },
  { name: "echo", group: "Files & system", summary: "print text", usage: "echo <text>", run: (args, ctx) => ctx.print(<Pre>{args.join(" ")}</Pre>) },
  { name: "date", group: "Files & system", summary: "current date & time", run: (_, ctx) => ctx.print(new Date().toString().replace(/ GMT.*/, "")) },
  {
    name: "cal",
    group: "Files & system",
    summary: "this month's calendar",
    run: (_, ctx) => {
      const d = new Date();
      const first = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
      const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const title = d.toLocaleString("en", { month: "long", year: "numeric" });
      const cells: ReactNode[] = Array.from({ length: first }, (_, i) => <span key={`b${i}`}>{"   "}</span>);
      for (let n = 1; n <= days; n++)
        cells.push(
          <span key={n} style={n === d.getDate() ? { background: "var(--t-fg)", color: "var(--t-bg-solid)" } : undefined}>
            {String(n).padStart(2)}
          </span>
        );
      const rows: ReactNode[][] = [];
      for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
      ctx.print(
        <Art>
          {"      " + title + "\n"}
          <C c="muted">{"Su Mo Tu We Th Fr Sa\n"}</C>
          {rows.map((r, i) => (
            <div key={i}>
              {r.map((c, j) => (
                <span key={j}>
                  {c}
                  {j < 6 ? " " : ""}
                </span>
              ))}
            </div>
          ))}
        </Art>
      );
    }
  },
  {
    name: "history",
    group: "Files & system",
    summary: "commands you've run",
    run: (_, ctx) =>
      ctx.print(
        <Pre>
          {ctx.history.map((h, i) => `${String(i + 1).padStart(4)}  ${h}`).join("\n") || "(empty)"}
        </Pre>
      )
  },
  {
    name: "theme",
    group: "Files & system",
    summary: "terminal theme",
    usage: `theme <${THEMES.join(" | ")}>`,
    complete: () => THEMES,
    run: ([t], ctx) => {
      if (t && (THEMES as string[]).includes(t)) {
        ctx.setTheme(t as ThemeName);
        return ctx.print(<C c="green">✔ theme: {t}</C>);
      }
      ctx.print(
        <span>
          {t && err(`theme: unknown theme “${t}”. `)}
          themes:{" "}
          {THEMES.map((n) => (
            <span key={n}>
              <Run cmd={`theme ${n}`} c={n === ctx.theme ? "green" : "accent"}>
                {n === ctx.theme ? `[${n}]` : n}
              </Run>{" "}
            </span>
          ))}
        </span>
      );
    }
  },
  { name: "clear", aliases: ["cls"], group: "Files & system", summary: "clear the screen (Ctrl+L)", run: (_, ctx) => ctx.clear() },
  { name: "exit", aliases: ["quit", "logout"], group: "Files & system", summary: "close the terminal", run: (_, ctx) => ctx.closeTerminal() },

  // Fun & games
  { name: "snake", group: "Fun & games", summary: "classic snake", run: (_, ctx) => (noKeyboard() ? keyboardOnly("snake", ctx) : ctx.takeover((exit) => <Snake exit={exit} />)) },
  { name: "typing-test", aliases: ["typing", "wpm"], group: "Fun & games", summary: "30s WPM test (tech-stack words)", run: (_, ctx) => (noKeyboard() ? keyboardOnly("typing-test", ctx) : ctx.takeover((exit) => <TypingTest exit={exit} />)) },
  { name: "matrix", aliases: ["hack", "cmatrix"], group: "Fun & games", summary: "enter the Matrix", run: (_, ctx) => (unlock("neo"), ctx.takeover((exit) => <Matrix exit={() => exit()} />)) },
  { name: "sl", group: "Fun & games", summary: "you meant ls, right?", run: (_, ctx) => ctx.takeover((exit) => <Sl exit={() => exit()} />) },
  {
    name: "cowsay",
    group: "Fun & games",
    summary: "a cow says things",
    usage: "cowsay <text>",
    run: (args, ctx) => ctx.print(<Art>{cowsay(args.join(" ") || "Moo. Try `sudo hire-ambuj`.")}</Art>)
  },
  {
    name: "fortune",
    group: "Fun & games",
    summary: "developer wisdom",
    run: (_, ctx) => {
      const [q, who] = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
      ctx.print(
        <span>
          “{q}” <C c="muted">— {who}</C>
        </span>
      );
    }
  },
  {
    name: "coffee",
    group: "Fun & games",
    summary: "take a break",
    run: async (_, ctx) => {
      ctx.print(<Art c="orange">{"      ( (\n       ) )\n    ........\n    |      |]\n    \\      /\n     `----'"}</Art>);
      await typeOut(ctx, "☕ Brewing… done. Here's a coffee for you. Take a break!", 25);
    }
  },

  // Hidden easter eggs
  {
    name: "sudo",
    group: "Fun & games",
    summary: "superuser do",
    hidden: true,
    complete: () => ["hire-ambuj"],
    run: async (args, ctx) => {
      const sub = args.join(" ");
      if (/^rm\s+-rf/.test(sub)) return ctx.run(sub);
      if (sub !== "hire-ambuj" && sub !== "hire-me" && sub !== "hire ambuj") {
        return ctx.print(<C c="red">guest is not in the sudoers file. This incident will be reported. 👮</C>);
      }
      const step = async (node: ReactNode, ms = 220) => {
        ctx.print(node);
        await sleep(ms, ctx.signal);
      };
      try {
        await step(<span>[sudo] password for recruiter: <C c="muted">********</C></span>, 500);
        await step("Reading package lists... Done", 250);
        await step("Building dependency tree... Done", 250);
        await step(
          <span>
            The following NEW package will be installed: <C c="green" b>ambuj-jaiswal</C> <C c="muted">(2027.08-iiitkota)</C>
          </span>,
          400
        );
        const deps = Object.values(profile.skills).flat();
        for (let i = 0; i < deps.length; i += 6) {
          await step(
            <span>
              <C c="muted">Resolving:</C>{" "}
              {deps.slice(i, i + 6).map((d) => (
                <span key={d}>
                  <C c="green">✓</C> {d}{"  "}
                </span>
              ))}
            </span>,
            140
          );
        }
        for (const p of profile.projects) {
          for (let k = 1; k <= 4; k++) await sleep(70, ctx.signal);
          await step(
            <span>
              Unpacking {p.id.padEnd(11)} [<C c="green">{bar(1, 24)}</C>] 100%
            </span>,
            120
          );
        }
        await step("Setting up ambuj-jaiswal ... done", 400);
        unlock("root");
        ctx.print(
          <Block>
            <C c="green" b>
              🎉 Ambuj Jaiswal is ready to join your team!
            </C>
            <span>
              Next steps: <Run cmd="resume" /> · <Run cmd="mail" /> · <A href={profile.socials.linkedin}>LinkedIn</A> · <A href={`mailto:${profile.email}`} />
            </span>
          </Block>
        );
      } catch {
        /* Ctrl+C */
      }
    }
  },
  {
    name: "rm",
    group: "Files & system",
    summary: "remove files",
    hidden: true,
    run: async (args, ctx) => {
      const line = args.join(" ");
      if (!/-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r/.test(line) || !/(^|\s)(\/|~|\*|\.)(\s|$|\/)/.test(line + " ")) {
        return ctx.print(err(`rm: ${args.filter((a) => !a.startsWith("-"))[0] ?? ""}: Operation not permitted (this portfolio is read-only)`));
      }
      const victims = [
        "/System/Library/CoreServices/Finder.app",
        "/Applications/Spotify.app",
        "/Applications/Safari.app",
        "/Users/guest/Desktop/widgets",
        `/Users/ambuj/projects/${projectIds.join(" /Users/ambuj/projects/")}`,
        "/usr/lib/node_modules (all 1.2 million of them)",
        "/private/var/db/.coffee",
        "/bin/zsh"
      ];
      try {
        for (const v of victims.flatMap((v) => v.split(" "))) {
          ctx.print(<C c="red">removed '{v}'</C>);
          await sleep(90, ctx.signal);
        }
        await sleep(500, ctx.signal);
        unlock("chaos");
        ctx.print(<KernelPanic />);
      } catch {
        ctx.print(<C c="yellow">Phew. Cancelled just in time.</C>);
      }
    }
  },
  {
    name: "vim",
    aliases: ["vi", "nano", "emacs", "nvim"],
    group: "Fun & games",
    summary: "editors",
    hidden: true,
    run: (_, ctx) => ctx.print(<span>This terminal is read-only — and you'd never exit vim anyway. 😉 Try <Run cmd="cat about.txt" />.</span>)
  },
  { name: "uname", group: "Files & system", summary: "system name", hidden: true, run: (_, ctx) => ctx.print("PortfolioOS 26.0 ambuj-macbook (a simulation running in your browser)") },
  {
    name: "hello",
    aliases: ["hi", "hey", "namaste"],
    group: "Fun & games",
    summary: "say hi",
    hidden: true,
    run: (_, ctx) => ctx.print(<span>Hey there! 👋 I'm Ambuj's terminal. Start with <Run cmd="help" /> or <Run cmd="whoami" />.</span>)
  },
  {
    name: "banner",
    group: "Portfolio",
    summary: "welcome banner",
    hidden: true,
    run: (_, ctx) => ctx.print(<Banner />)
  }
];

function Entry({ node, base }: { node: FsNode; base: string }) {
  const path = base + node.name;
  if (node.type === "dir")
    return (
      <Run cmd={`ls ${path}`} c="blue">
        {node.name}/
      </Run>
    );
  if (node.open)
    return (
      <Run cmd={`open ${path}`} c="orange">
        {node.name}
      </Run>
    );
  return (
    <Run cmd={`cat ${path}`} c="fg">
      {node.name}
    </Run>
  );
}

// ── Welcome banner ───────────────────────────────────────────────────────────
const LOGO = [
  " █████╗ ███╗   ███╗██████╗ ██╗   ██╗     ██╗",
  "██╔══██╗████╗ ████║██╔══██╗██║   ██║     ██║",
  "███████║██╔████╔██║██████╔╝██║   ██║     ██║",
  "██╔══██║██║╚██╔╝██║██╔══██╗██║   ██║██   ██║",
  "██║  ██║██║ ╚═╝ ██║██████╔╝╚██████╔╝╚█████╔╝",
  "╚═╝  ╚═╝╚═╝     ╚═╝╚═════╝  ╚═════╝  ╚════╝ "
];

function Banner() {
  const [rows, setRows] = useState(0);
  useEffect(() => {
    if (rows >= LOGO.length) return;
    const t = setTimeout(() => setRows((r) => r + 1), 70);
    return () => clearTimeout(t);
  }, [rows]);
  return (
    <Block gap={6}>
      <Art c="accent" style={{ lineHeight: 1.02, textShadow: "0 0 6px color-mix(in srgb, var(--t-accent) 45%, transparent)" }}>
        {LOGO.slice(0, rows).join("\n")}
      </Art>
      {rows >= LOGO.length && (
        <>
          <span>
            Welcome to <C c="yellow" b>{profile.name}</C>'s terminal — <C c="muted">{profile.role}</C>
          </span>
          <span>
            Type <Run cmd="help" /> to see what I can do, or try: <Run cmd="neofetch" /> <Run cmd="projects -i" /> <Run cmd="git log" />{" "}
            <Run cmd="ask what has Ambuj built?" /> <Run cmd="play kesariya" /> <Run cmd="sudo hire-ambuj" />
          </span>
        </>
      )}
    </Block>
  );
}

// ── lookup ───────────────────────────────────────────────────────────────────
export const commands = list;

export function find(name: string): Command | undefined {
  const n = name.toLowerCase();
  return list.find((c) => c.name === n || c.aliases?.includes(n));
}

export function commandNames(includeHidden = false): string[] {
  return list.filter((c) => includeHidden || !c.hidden).map((c) => c.name);
}

export const sandboxed = (name: string) => SANDBOXED.includes(name.toLowerCase());

/** Closest command for "did you mean …?" (Levenshtein ≤ 2). */
export function suggest(name: string): string | undefined {
  const d = (a: string, b: string) => {
    const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) m[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return m[a.length][b.length];
  };
  let best: [string, number] | undefined;
  for (const c of list.filter((c) => !c.hidden)) {
    for (const n of [c.name, ...(c.aliases ?? [])]) {
      const dist = d(name.toLowerCase(), n);
      if (dist <= 2 && (!best || dist < best[1])) best = [c.name, dist];
    }
  }
  return best?.[0];
}
