import React, { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { apps } from "~/configs";
import { profile, thumbOf, type Certification, type Project } from "~/data/profile";
import { useStore } from "~/stores";
import { useWidgetStore } from "~/stores/widgets";
import { usePrefs } from "~/settings/prefs";
import { useActivity, unlock } from "~/settings/activity";
import { openSettings } from "~/settings/nav";
import { PANE_GROUPS } from "~/settings/panes";
import { Tile } from "~/settings/ui";
import { askSiri } from "~/utils/siriBridge";

// Spotlight: search apps, Ambuj's projects, skills, certificates, settings
// and quick actions. Everything shown comes from the profile or the site
// itself; nothing is made up.

interface SpotlightProps {
  toggleSpotlight: () => void;
  openApp: (id: string) => void;
  toggleLaunchpad: (target: boolean) => void;
  btnRef: React.RefObject<HTMLDivElement>;
}

type Kind = "app" | "project" | "action" | "skill" | "setting" | "cert" | "siri";

interface Item {
  key: string;
  kind: Kind;
  title: string;
  sub?: string;
  keywords?: string;
  icon: ReactNode;
  run: () => void;
  alt?: { label: string; run: () => void };
  hint?: string;
  preview: () => ReactNode;
}

const SECTION: Record<Kind, string> = {
  app: "Applications",
  project: "Projects",
  action: "Actions",
  skill: "Skills",
  setting: "System Settings",
  cert: "Certificates",
  siri: "Siri"
};
const ORDER: Kind[] = ["app", "project", "action", "skill", "setting", "cert", "siri"];

const APP_INFO: Record<string, string> = {
  finder: "Browse Ambuj's projects, résumé and certificates as files.",
  about: "Ambuj's profile: education, projects, skills and contact.",
  bear: "Notes about each project, written from the résumé.",
  safari: "Opens Ambuj's live projects inside the portfolio.",
  vscode: "Read DevTinder's source code in VS Code for the web.",
  facetime: "Say hi on camera. Photos never leave your device.",
  terminal: "A sandboxed terminal with commands, games and easter eggs. Try `help`.",
  github: "Ambuj's GitHub profile.",
  siri: "Ask anything about Ambuj, by voice or by typing.",
  "system-settings": "Appearance, Dock, widgets, Siri, achievements and more.",
  notes: "Quick notes. Saved in your browser.",
  spotify: "Search and play music (JioSaavn).",
  maps: "Where Ambuj studies: Kota, Rajasthan.",
  messages: "Get in touch with Ambuj.",
  photos: "Certificates and project screenshots.",
  clock: "World clock, alarm, stopwatch and timer.",
  mail: "Send Ambuj an email from right here."
};

// Extra words people might type for an app.
const APP_KEYWORDS: Record<string, string> = {
  finder: "files documents folders",
  about: "ambuj profile contact me",
  bear: "notes projects",
  safari: "browser web internet",
  vscode: "code editor source",
  facetime: "camera video photo",
  terminal: "shell command line console cli hacker",
  siri: "assistant ai voice ask",
  "system-settings": "preferences settings",
  notes: "text write",
  spotify: "music songs play",
  maps: "location kota iiit",
  messages: "chat contact",
  photos: "certificates pictures images",
  clock: "time alarm stopwatch timer",
  mail: "email contact hire"
};

const DEFAULT_SUGGESTED = ["about", "finder", "terminal", "siri", "spotify", "system-settings"];

// ── Matching ────────────────────────────────────────────────────────────────
const words = (s: string) => s.toLowerCase().split(/[\s\-–·/&().,]+/).filter(Boolean);

function score(q: string, it: Item): number {
  const t = it.title.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 90 - Math.min(t.length - q.length, 20) * 0.1;
  const tw = words(it.title);
  if (tw.some((w) => w.startsWith(q))) return 80;
  if (q.length >= 2 && tw.map((w) => w[0]).join("").startsWith(q)) return 72;
  if (q.length >= 3 && t.includes(q)) return 62;
  const kw = words(it.keywords ?? "");
  if (q.length >= 2 && kw.some((w) => w.startsWith(q))) return 50;
  if (q.includes(" ") && `${t} ${(it.keywords ?? "").toLowerCase()}`.includes(q)) return 50;
  // Loose "typo-friendly" match on short names: letters in order (e.g. "trml" → Terminal).
  if (q.length >= 3 && t.length <= 16 && t[0] === q[0]) {
    let i = 0;
    for (const ch of t) if (ch === q[i]) i++;
    if (i === q.length) return 20;
  }
  return 0;
}

const Highlight = ({ text, q }: { text: string; q: string }) => {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
};

const AppImg = ({ src, size }: { src: string; size: number }) => (
  <img src={src.startsWith("/") || src.startsWith("http") ? src : `/${src}`} alt="" style={{ width: size, height: size, objectFit: "contain" }} draggable={false} />
);

const ProjectIcon = ({ p, size }: { p: Project; size: number }) => (
  <img
    src={p.logo}
    alt=""
    style={{ width: size, height: size, borderRadius: size * 0.225, boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }}
    draggable={false}
  />
);

const Kbd = ({ children }: { children: ReactNode }) => <kbd className="sl-kbd">{children}</kbd>;

// ── Component ───────────────────────────────────────────────────────────────
export default function Spotlight({ toggleSpotlight, openApp, toggleLaunchpad, btnRef }: SpotlightProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const [copied, setCopied] = useState(false);
  const dark = useStore((s) => s.dark);
  const toggleDark = useStore((s) => s.toggleDark);
  const nightShift = usePrefs((s) => s.nightShift);
  const appOpens = useActivity((s) => s.appOpens);

  useClickOutside(rootRef, toggleSpotlight, [btnRef]);
  useEffect(() => inputRef.current?.focus(), []);

  const done = (fn: () => void) => () => {
    fn();
    toggleSpotlight();
  };
  const open = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

  const items = useMemo<Item[]>(() => {
    const list: Item[] = [];

    // Applications
    for (const a of apps) {
      if (a.id === "launchpad") continue;
      const opens = appOpens[a.id] ?? 0;
      list.push({
        key: `app:${a.id}`,
        kind: "app",
        title: a.title,
        sub: a.link ? "Website" : "Application",
        keywords: `${a.id} ${APP_KEYWORDS[a.id] ?? ""}`,
        icon: <AppImg src={a.img} size={22} />,
        run: done(() => (a.link ? open(a.link) : openApp(a.id))),
        hint: "Open",
        preview: () => (
          <div className="sl-pv-center">
            <AppImg src={a.img} size={84} />
            <div className="sl-pv-title">{a.title}</div>
            <div className="sl-pv-kind">{a.link ? "Website" : "Application"}</div>
            {APP_INFO[a.id] && <p className="sl-pv-text">{APP_INFO[a.id]}</p>}
            {opens > 0 && (
              <div className="sl-pv-meta">
                You've opened it {opens} time{opens === 1 ? "" : "s"}
              </div>
            )}
          </div>
        )
      });
    }
    list.push({
      key: "app:launchpad",
      kind: "app",
      title: "Launchpad",
      sub: "Application",
      keywords: "all apps projects grid",
      icon: <AppImg src="img/icons/launchpad.png" size={22} />,
      run: done(() => toggleLaunchpad(true)),
      hint: "Open",
      preview: () => (
        <div className="sl-pv-center">
          <AppImg src="img/icons/launchpad.png" size={84} />
          <div className="sl-pv-title">Launchpad</div>
          <div className="sl-pv-kind">Application</div>
          <p className="sl-pv-text">Every app and project in one place.</p>
        </div>
      )
    });

    // Projects
    for (const p of profile.projects) {
      list.push({
        key: `project:${p.id}`,
        kind: "project",
        title: p.name,
        sub: p.stack.slice(0, 3).join(" · "),
        keywords: `project ${p.stack.join(" ")}`,
        icon: <ProjectIcon p={p} size={22} />,
        run: done(() => open(p.live)),
        hint: "Open live site",
        alt: { label: "Open on GitHub", run: done(() => open(p.github)) },
        preview: () => (
          <div>
            <div className="sl-pv-head">
              <ProjectIcon p={p} size={52} />
              <div>
                <div className="sl-pv-title" style={{ marginTop: 0 }}>
                  {p.name}
                </div>
                <div className="sl-pv-kind">Project · {p.date}</div>
              </div>
            </div>
            {p.screenshots[0] && (
              <img className="sl-pv-cert" src={thumbOf(p.screenshots[0].src)} alt={`${p.name}: ${p.screenshots[0].caption}`} style={{ marginTop: 14, aspectRatio: "16 / 9", objectFit: "cover" }} />
            )}
            <p className="sl-pv-text" style={{ textAlign: "left" }}>
              {p.tagline}
            </p>
            <div className="sl-chips">
              {p.stack.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
            <div className="sl-pv-actions">
              <button type="button" className="primary" onClick={done(() => open(p.live))}>
                Live site
              </button>
              <button type="button" onClick={done(() => open(p.github))}>
                GitHub
              </button>
            </div>
          </div>
        )
      });
    }

    // Actions
    const action = (
      id: string,
      title: string,
      icon: string,
      color: string,
      text: string,
      run: () => void,
      keywords = "",
      keepOpen = false
    ): Item => ({
      key: `action:${id}`,
      kind: "action",
      title,
      sub: "Action",
      keywords,
      icon: <Tile icon={icon} color={color} size={22} />,
      run: keepOpen ? run : done(run),
      hint: "Run",
      preview: () => (
        <div className="sl-pv-center">
          <Tile icon={icon} color={color} size={72} />
          <div className="sl-pv-title">{title}</div>
          <p className="sl-pv-text">{text}</p>
        </div>
      )
    });
    list.push(
      action("resume", "Download Résumé", "i-ph:download-simple-bold", "#34c759", `Save ${profile.resumeFileName} (PDF).`, () => {
        const a = document.createElement("a");
        a.href = profile.resumeDownload;
        a.download = profile.resumeFileName;
        a.click();
        unlock("resume");
      }, "resume cv pdf download"),
      action("email", "Email Ambuj", "i-ph:envelope-simple-fill", "#007aff", `Write to ${profile.email} in your mail app.`, () => {
        location.href = `mailto:${profile.email}`;
      }, "mail contact hire"),
      action("message", "Send a Message", "i-ph:paper-plane-tilt-fill", "#34c759", "Write to Ambuj right here, without leaving the site.", () => openApp("mail"), "contact hire mail"),
      action(
        "copy-email",
        copied ? "Email Address Copied" : "Copy Email Address",
        copied ? "i-ph:check-bold" : "i-ph:copy-fill",
        "#8e8e93",
        profile.email,
        () => {
          navigator.clipboard?.writeText(profile.email).then(() => setCopied(true), () => {});
        },
        "clipboard contact mail",
        true
      ),
      action("dark", dark ? "Switch to Light Mode" : "Switch to Dark Mode", dark ? "i-ph:sun-fill" : "i-ph:moon-fill", "#1c1c1e", "Change the site's appearance.", toggleDark, "theme appearance dark light night"),
      action(
        "nightshift",
        nightShift ? "Turn Night Shift Off" : "Turn Night Shift On",
        "i-ph:sun-horizon-fill",
        "#ff9500",
        "Warmer colours, easier on the eyes at night.",
        () => usePrefs.getState().set("nightShift", !nightShift),
        "warm display screen eyes"
      ),
      action("widgets", "Edit Widgets", "i-ph:squares-four-fill", "#5856d6", "Add, remove and arrange desktop widgets.", () => useWidgetStore.getState().setGalleryOpen(true), "widget calendar weather clock github battery"),
      action("share", "Share This Portfolio", "i-ph:qr-code-bold", "#34c759", "QR code, copy link, or share to WhatsApp, LinkedIn and X.", () => openSettings("share"), "qr link send"),
      action("achievements", "Show Achievements", "i-ph:trophy-fill", "#ff9f0a", "See which of the hidden achievements you've unlocked.", () => openSettings("screen-time"), "trophy easter eggs screen time")
    );
    const socials: [string, string, string][] = [
      ["GitHub", profile.socials.github, "i-ph:github-logo-fill"],
      ["LinkedIn", profile.socials.linkedin, "i-ph:linkedin-logo-fill"],
      ["LeetCode", profile.socials.leetcode, "i-ph:code-bold"],
      ["CodeChef", profile.socials.codechef, "i-ph:chef-hat-fill"],
      ["Codolio", profile.socials.codolio, "i-ph:chart-bar-fill"]
    ];
    for (const [name, url, icon] of socials) {
      list.push(action(`social-${name}`, `Open ${name} Profile`, icon, "#1c1c1e", url.replace(/^https:\/\/(www\.)?/, ""), () => open(url), `${name} social profile`));
    }

    // Skills (only those on the résumé)
    for (const [category, skills] of Object.entries(profile.skills)) {
      for (const skill of skills) {
        const base = skill.toLowerCase().replace(/\.js$/, "");
        const usedIn = profile.projects.filter((p) => p.stack.some((s) => s.toLowerCase().replace(/\.js$/, "").includes(base) || base.includes(s.toLowerCase())));
        const question = `What has Ambuj done with ${skill}?`;
        list.push({
          key: `skill:${skill}`,
          kind: "skill",
          title: skill,
          sub: category,
          keywords: `skill ${category}`,
          icon: <Tile icon="i-ph:code-bold" color="#5e5ce6" size={22} />,
          run: done(() => askSiri(question)),
          hint: "Ask Siri",
          preview: () => (
            <div className="sl-pv-center">
              <Tile icon="i-ph:code-bold" color="#5e5ce6" size={72} />
              <div className="sl-pv-title">{skill}</div>
              <div className="sl-pv-kind">{category}</div>
              {usedIn.length > 0 && (
                <p className="sl-pv-text">
                  Used in {usedIn.map((p) => p.name).join(", ")}.
                </p>
              )}
              <div className="sl-pv-meta">↩ Ask Siri: “{question}”</div>
            </div>
          )
        });
      }
    }

    // Settings panes
    for (const pane of PANE_GROUPS.flat()) {
      list.push({
        key: `setting:${pane.id}`,
        kind: "setting",
        title: pane.label,
        sub: "System Settings",
        keywords: `settings ${pane.keywords}`,
        icon: <Tile icon={pane.icon} color={pane.color} size={22} />,
        run: done(() => openSettings(pane.id)),
        hint: "Open",
        preview: () => (
          <div className="sl-pv-center">
            <Tile icon={pane.icon} color={pane.color} size={72} />
            <div className="sl-pv-title">{pane.label}</div>
            <div className="sl-pv-kind">System Settings</div>
            <p className="sl-pv-text" style={{ textTransform: "capitalize" }}>
              {pane.keywords.split(" ").slice(0, 6).join(", ")}
            </p>
          </div>
        )
      });
    }

    // Certificates
    for (const c of profile.certifications as Certification[]) {
      list.push({
        key: `cert:${c.id}`,
        kind: "cert",
        title: c.title,
        sub: `${c.issuer} · ${c.year}`,
        keywords: `certificate certification ${c.issuer}`,
        icon: <Tile icon="i-ph:certificate-fill" color="#ff9500" size={22} />,
        run: done(() => open(c.file)),
        hint: "View",
        preview: () => (
          <div>
            <img src={c.preview} alt={`${c.title} certificate`} className="sl-pv-cert" />
            <div className="sl-pv-title" style={{ fontSize: 15 }}>
              {c.title}
            </div>
            <div className="sl-pv-kind">
              {c.issuer} · {c.year}
            </div>
          </div>
        )
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark, nightShift, copied, appOpens]);

  // ── Results ────────────────────────────────────────────────────────────────
  const q = query.trim().toLowerCase();
  const { top, sections, flat } = useMemo(() => {
    if (!q) return { top: null, sections: [] as [Kind, Item[]][], flat: [] as Item[] };
    const scored = items
      .map((it) => ({ it, base: score(q, it) }))
      .filter((x) => x.base > 0)
      // Small tie-breakers: apps first, then the ones this visitor uses most.
      .map(({ it, base }) => ({ it, s: base + (it.kind === "app" ? 3 : 0) + Math.min(appOpens[it.key.slice(4)] ?? 0, 5) * 0.2 }))
      .sort((a, b) => b.s - a.s);
    const topHit = scored[0]?.it ?? null;
    const groups = new Map<Kind, Item[]>();
    for (const { it } of scored) {
      if (it === topHit) continue;
      const g = groups.get(it.kind) ?? [];
      if (g.length < 5) g.push(it);
      groups.set(it.kind, g);
    }
    const siri: Item = {
      key: "siri:ask",
      kind: "siri",
      title: `Ask Siri “${query.trim()}”`,
      icon: <AppImg src="img/icons/siri.png" size={22} />,
      run: done(() => askSiri(query.trim())),
      hint: "Ask",
      preview: () => (
        <div className="sl-pv-center">
          <AppImg src="img/icons/siri.png" size={84} />
          <div className="sl-pv-title">Ask Siri</div>
          <p className="sl-pv-text">“{query.trim()}”</p>
          <div className="sl-pv-meta">Siri knows Ambuj's résumé, projects and skills.</div>
        </div>
      )
    };
    groups.set("siri", [siri]);
    const secs = ORDER.filter((k) => groups.get(k)?.length).map((k) => [k, groups.get(k)!] as [Kind, Item[]]);
    return { top: topHit, sections: secs, flat: [...(topHit ? [topHit] : []), ...secs.flatMap(([, g]) => g)] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, items]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const current = flat[Math.min(sel, flat.length - 1)];

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && current) {
      e.preventDefault();
      if ((e.metaKey || e.ctrlKey) && current.alt) current.alt.run();
      else current.run();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (query) setQuery("");
      else toggleSpotlight();
    }
  };

  // ── Empty state: suggestions ───────────────────────────────────────────────
  const suggested = useMemo(() => {
    const used = Object.entries(appOpens)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);
    const ids = [...new Set([...used, ...DEFAULT_SUGGESTED])].filter((id) => apps.some((a) => a.id === id && !a.link));
    return ids.slice(0, 6).map((id) => apps.find((a) => a.id === id)!);
  }, [appOpens]);
  const quick = ["action:resume", "action:message", "action:dark", "action:share"].map((k) => items.find((i) => i.key === k)!);

  let idx = -1;
  const renderRow = (it: Item) => {
    idx++;
    const i = idx;
    return (
      <button
        type="button"
        key={it.key}
        data-idx={i}
        className={`sl-row ${i === sel ? "on" : ""}`}
        onMouseMove={() => sel !== i && setSel(i)}
        onClick={it.run}
      >
        <span className="sl-row-icon">{it.icon}</span>
        <span className="sl-row-title">
          <Highlight text={it.title} q={it.kind === "siri" ? "" : q} />
        </span>
        {it.sub && <span className="sl-row-sub">{it.sub}</span>}
      </button>
    );
  };

  return (
    <div className="sl" ref={rootRef} onKeyDown={onKeyDown} role="dialog" aria-label="Spotlight">
      <div className="sl-bar">
        <span className="i-ph:magnifying-glass-bold sl-bar-icon" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search apps, projects, skills, settings…"
          aria-label="Spotlight Search"
          role="combobox"
          aria-expanded={!!q}
          aria-controls="sl-results"
          spellCheck={false}
          autoComplete="off"
        />
        {q && current && <span className="sl-bar-hit">{current.icon}</span>}
      </div>

      {!q ? (
        <div className="sl-empty">
          <div className="sl-label">Suggestions</div>
          <div className="sl-apps">
            {suggested.map((a) => (
              <button type="button" key={a.id} className="sl-app" onClick={done(() => openApp(a.id))} title={a.title}>
                <AppImg src={a.img} size={48} />
                <span>{a.title}</span>
              </button>
            ))}
          </div>
          <div className="sl-label">Quick actions</div>
          <div className="sl-quick">
            {quick.map((it) => (
              <button type="button" key={it.key} onClick={it.run}>
                {it.icon}
                {it.title}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="sl-body" id="sl-results">
          <div className="sl-list" ref={listRef} role="listbox">
            {top && (
              <>
                <div className="sl-label">Top Hit</div>
                {renderRow(top)}
              </>
            )}
            {sections.map(([kind, group]) => (
              <React.Fragment key={kind}>
                <div className="sl-label">{SECTION[kind]}</div>
                {group.map(renderRow)}
              </React.Fragment>
            ))}
          </div>
          <div className="sl-preview">
            <div className="sl-preview-body">{current?.preview()}</div>
            {current && (
              <div className="sl-foot">
                <span>
                  <Kbd>↩</Kbd> {current.hint}
                </span>
                {current.alt && (
                  <span>
                    <Kbd>⌘↩</Kbd> {current.alt.label}
                  </span>
                )}
                <span style={{ marginLeft: "auto" }}>
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd> move
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
