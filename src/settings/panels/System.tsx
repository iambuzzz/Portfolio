import { useEffect, useMemo, useState } from "react";
import { renderSVG } from "uqr";
import { profile } from "~/data/profile";
import apps from "~/configs/apps";
import { useStore } from "~/stores";
import { useWidgetStore } from "~/stores/widgets";
import { ACHIEVEMENTS, useActivity } from "../activity";
import { usePrefs, type StartupApp } from "../prefs";
import { Button, confirmAction, Group, Hero, Row, Select, Slider, Tile, Toggle } from "../ui";

// ── Siri ─────────────────────────────────────────────────────────────────────
function useVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => window.speechSynthesis?.getVoices() ?? []);
  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis.getVoices());
    window.speechSynthesis?.addEventListener("voiceschanged", load);
    load();
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", load);
  }, []);
  return voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
}

export function SiriPanel() {
  const p = usePrefs();
  const voices = useVoices();
  const preview = () => {
    const s = window.speechSynthesis;
    s.cancel();
    const u = new SpeechSynthesisUtterance(`Hi! I'm Siri. Ask me anything about ${profile.firstName}'s projects.`);
    const v = voices.find((x) => x.name === p.siriVoiceName);
    if (v) u.voice = v;
    u.rate = p.siriRate;
    u.pitch = 1.1;
    s.speak(u);
  };
  return (
    <>
      <Hero
        icon={<img src="/img/icons/siri.png" alt="" style={{ width: 64, height: 64, borderRadius: 16 }} />}
        title="Siri"
        sub={`Siri answers questions about ${profile.firstName} using AI, and can open apps, play music and switch themes.`}
      />
      <Group title="Voice">
        <Row label="Speak replies aloud">
          <Toggle label="Speak replies" checked={p.siriVoice} onChange={(v) => p.set("siriVoice", v)} />
        </Row>
        <Row label="Voice" sub={voices.length ? `${voices.length} English voices on this device` : "Your browser's default voice"} style={{ opacity: p.siriVoice ? 1 : 0.45 }}>
          <Select
            label="Voice"
            value={p.siriVoiceName}
            onChange={(v) => p.set("siriVoiceName", v)}
            options={[{ value: "", label: "Automatic" }, ...voices.map((v) => ({ value: v.name, label: `${v.name} (${v.lang})` }))]}
          />
        </Row>
        <Row label="Speaking rate" style={{ opacity: p.siriVoice ? 1 : 0.45 }}>
          <Slider label="Speaking rate" value={p.siriRate} min={0.7} max={1.4} step={0.05} onChange={(v) => p.set("siriRate", v)} left={<small>Slower</small>} right={<small>Faster</small>} />
        </Row>
        <Row label="Preview">
          <Button onClick={preview}>
            <span className="i-ph:play-fill" style={{ verticalAlign: "-2px" }} /> Play sample
          </Button>
        </Row>
      </Group>
      <Group title="Listening" footer="Voice input uses your browser's speech recognition (or Whisper if unavailable). You can always type instead.">
        <Row label="Start listening when Siri opens">
          <Toggle label="Auto-listen" checked={p.siriAutoListen} onChange={(v) => p.set("siriAutoListen", v)} />
        </Row>
      </Group>
    </>
  );
}

// ── Accessibility ────────────────────────────────────────────────────────────
export function AccessibilityPanel() {
  const p = usePrefs();
  return (
    <Group footer="Reduce Transparency also makes the site faster on older computers.">
      <Row label="Reduce motion" sub="Turns off window, dock and page animations" icon={<Tile icon="i-ph:sparkle-fill" color="#5856d6" />}>
        <Toggle label="Reduce motion" checked={p.reduceMotion} onChange={(v) => p.set("reduceMotion", v)} />
      </Row>
      <Row label="Reduce transparency" sub="Solid backgrounds instead of frosted glass" icon={<Tile icon="i-ph:eye-fill" color="#007aff" />}>
        <Toggle label="Reduce transparency" checked={p.reduceTransparency} onChange={(v) => p.set("reduceTransparency", v)} />
      </Row>
    </Group>
  );
}

// ── Screen Time & Achievements ───────────────────────────────────────────────
const fmtDuration = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : m ? `${m}m` : `${s}s`;
};

export function ScreenTimePanel() {
  const a = useActivity();
  const top = Object.entries(a.appOpens)
    .sort((x, y) => y[1] - x[1])
    .slice(0, 6);
  const max = top[0]?.[1] ?? 1;
  const got = Object.keys(a.unlocked).length;
  return (
    <>
      <Hero
        icon={<Tile icon="i-ph:hourglass-medium-fill" color="#5856d6" size={56} />}
        title={fmtDuration(a.seconds)}
        sub={`spent exploring since ${new Date(a.firstVisit).toLocaleDateString("en", { day: "numeric", month: "short" })} · ${a.visits} visit${a.visits === 1 ? "" : "s"}`}
      />
      <Group title="Most used">
        {top.length === 0 && <div className="st-empty">Open a few apps and they'll show up here.</div>}
        {top.map(([id, n]) => {
          const app = apps.find((x) => x.id === id);
          return (
            <Row key={id} label={app?.title ?? id} icon={app?.img ? <img src={`/${app.img}`} alt="" style={{ width: 22, height: 22 }} /> : undefined}>
              <span style={{ width: 160, height: 6, borderRadius: 3, background: "var(--st-field)", overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${(n / max) * 100}%`, background: "var(--st-accent)" }} />
              </span>
              <span style={{ width: 52, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {n} open{n === 1 ? "" : "s"}
              </span>
            </Row>
          );
        })}
      </Group>
      <Group
        title={
          <>
            Achievements <span style={{ fontWeight: 400, color: "var(--st-sub)" }}>· {got} of {ACHIEVEMENTS.length}</span>
          </>
        }
        footer="Stored only in this browser. Hints are there for the ones you haven't found yet 👀"
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8, padding: 10 }}>
          {ACHIEVEMENTS.map((x) => {
            const at = a.unlocked[x.id];
            return (
              <div
                key={x.id}
                title={at ? `Unlocked ${new Date(at).toLocaleString()}` : x.hint}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: at ? "color-mix(in srgb, var(--st-accent) 10%, transparent)" : "var(--st-field)",
                  opacity: at ? 1 : 0.7
                }}
              >
                <span style={{ fontSize: 22, filter: at ? "none" : "grayscale(1)", opacity: at ? 1 : 0.5 }}>{at ? x.emoji : "🔒"}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 600 }}>{x.title}</span>
                  <span className="st-row-sub" style={{ display: "block" }}>
                    {at ? new Date(at).toLocaleDateString("en", { day: "numeric", month: "short" }) : x.hint}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </Group>
      <Group>
        <Row label="Reset Screen Time & Achievements">
          <Button kind="danger" onClick={async () => {
              const ok = await confirmAction({
                title: "Reset Screen Time and achievements?",
                message: "Your time on the site, most-used apps and all unlocked achievements will be cleared. This can't be undone.",
                confirmLabel: "Reset",
                destructive: true
              });
              if (ok) a.reset();
            }}>
            Reset…
          </Button>
        </Row>
      </Group>
    </>
  );
}

// ── Privacy & Data ───────────────────────────────────────────────────────────
const STORAGE_GROUPS: { match: (k: string) => boolean; name: string; what: string }[] = [
  { match: (k) => k.startsWith("macos-notes"), name: "Notes", what: "Notes you wrote" },
  { match: (k) => k === "macos-messages", name: "Messages", what: "Your chats with the AI assistant" },
  { match: (k) => k === "macos-maps-recents", name: "Maps", what: "Your recent map searches" },
  { match: (k) => k === "macos-mail", name: "Mail", what: "Sent messages, drafts, stars and read status" },
  { match: (k) => k === "macos-music", name: "Music library", what: "Liked songs, recently played, volume" },
  { match: (k) => k === "macos-activity", name: "Screen Time", what: "Time spent, apps opened, achievements" },
  { match: (k) => k === "macos-widgets", name: "Widgets", what: "Which widgets are on the desktop and where" },
  { match: (k) => k === "macos-prefs" || k.startsWith("macos-settings-"), name: "Settings", what: "Appearance, wallpaper, dock and your preferences" },
  { match: (k) => k.startsWith("terminal-"), name: "Terminal", what: "Terminal theme and snake high score" }
];

function useStoredData() {
  const [tick, setTick] = useState(0);
  const rows = useMemo(() => {
    const out = STORAGE_GROUPS.map((g) => ({ ...g, keys: [] as string[], bytes: 0 }));
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!;
        const g = out.find((x) => x.match(k));
        if (g) {
          g.keys.push(k);
          g.bytes += (k.length + (localStorage.getItem(k)?.length ?? 0)) * 2;
        }
      }
    } catch {
      // storage blocked
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
  return { rows, refresh: () => setTick((t) => t + 1) };
}

const fmtBytes = (b: number) => (b < 1024 ? `${b} B` : `${(b / 1024).toFixed(1)} KB`);

export function PrivacyPanel() {
  const { rows, refresh } = useStoredData();
  const clearGroup = async (keys: string[], name: string) => {
    const ok = await confirmAction({
      title: `Delete ${name} data?`,
      message: "It's removed from this browser only, and the page reloads.",
      confirmLabel: "Delete",
      destructive: true
    });
    if (!ok) return;
    keys.forEach((k) => localStorage.removeItem(k));
    location.reload();
  };
  const clearAll = async () => {
    const ok = await confirmAction({
      title: "Clear all data?",
      message: "Everything this portfolio has saved in your browser (settings, music library, notes, achievements) is deleted, and the page reloads.",
      confirmLabel: "Clear All",
      destructive: true
    });
    if (!ok) return;
    try {
      rows.flatMap((r) => r.keys).forEach((k) => localStorage.removeItem(k));
      sessionStorage.clear();
    } catch {
      // storage blocked
    }
    location.reload();
  };
  useEffect(refresh, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <Hero
        icon={<Tile icon="i-ph:shield-check-fill" color="#007aff" size={56} />}
        title="Your data stays with you"
        sub="No accounts, no cookies, no analytics or trackers. Everything below is saved only in this browser."
      />
      <Group title="Saved on this device">
        {rows.map((r) => (
          <Row key={r.name} label={r.name} sub={r.what}>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{r.keys.length ? fmtBytes(r.bytes) : "—"}</span>
            <Button kind="danger" disabled={!r.keys.length} onClick={() => clearGroup(r.keys, r.name)}>
              Delete
            </Button>
          </Row>
        ))}
        <Row label="Everything">
          <Button kind="danger" onClick={clearAll}>
            Clear all data…
          </Button>
        </Row>
      </Group>
      <Group title="Services this site uses" footer="Siri's AI key stays on the server; your browser only sends the question you asked.">
        <Row label="Music" sub="Song search and streaming from JioSaavn, through this site's own server" icon={<Tile icon="i-ph:music-notes-fill" color="#1db954" />} />
        <Row label="Siri" sub="Your typed/spoken question → this site's server → Groq AI" icon={<Tile icon="i-ph:microphone-fill" color="#af52de" />} />
        <Row label="Messages" sub="Your chat (last few messages) → this site's server → Groq AI" icon={<Tile icon="i-ph:chat-circle-dots-fill" color="#34c759" />} />
        <Row label="Voice input" sub="Your browser's speech recognition (Chrome may process audio on Google's servers)" icon={<Tile icon="i-ph:waveform" color="#ff2d55" />} />
        <Row label="Mail" sub="Web3Forms, only when you send a message" icon={<Tile icon="i-ph:envelope-simple-fill" color="#007aff" />} />
        <Row label="Weather & Maps" sub="Open-Meteo (weather) and Google Maps (map, search, directions)" icon={<Tile icon="i-ph:globe-simple" color="#34c759" />} />
        <Row label="GitHub widget" sub="Public profile stats from GitHub" icon={<Tile icon="i-ph:github-logo-fill" color="#24292f" />} />
      </Group>
      <Group title="Camera & microphone">
        <Row label="FaceTime" sub="Uses your camera only while open. Photos stay in this tab and are never uploaded." icon={<Tile icon="i-ph:camera-fill" color="#34c759" />} />
        <Row label="Siri" sub="Uses the microphone only while listening." icon={<Tile icon="i-ph:microphone-fill" color="#ff9500" />} />
      </Group>
    </>
  );
}

// ── Share ────────────────────────────────────────────────────────────────────
export function SharePanel() {
  const url = window.location.origin;
  const [copied, setCopied] = useState(false);
  const svg = useMemo(() => renderSVG(url, { border: 1, ecc: "M" }), [url]);
  const text = `Check out ${profile.name}'s interactive macOS-style portfolio`;
  const copy = () =>
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  const downloadQr = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    a.download = "ambuj-portfolio-qr.svg";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const intents: { label: string; icon: string; color: string; href: string }[] = [
    { label: "WhatsApp", icon: "i-ph:paper-plane-tilt-fill", color: "#25d366", href: `https://wa.me/?text=${encodeURIComponent(`${text}: ${url}`)}` },
    { label: "LinkedIn", icon: "i-ph:linkedin-logo-fill", color: "#0a66c2", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
    { label: "X", icon: "i-ph:share-network-fill", color: "#000", href: `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` },
    { label: "Email", icon: "i-ph:envelope-simple-fill", color: "#5ac8fa", href: `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}` }
  ];
  return (
    <>
      <Hero
        icon={
          <div
            aria-label={`QR code for ${url}`}
            role="img"
            style={{ width: 176, height: 176, background: "#fff", borderRadius: 16, padding: 10, boxShadow: "0 4px 18px rgba(0,0,0,0.12)" }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        }
        title="Share this portfolio"
        sub="Scan with a phone camera to open it, or send the link."
      />
      <Group>
        <Row label={url.replace(/^https?:\/\//, "")} icon={<Tile icon="i-ph:globe-simple" color="#007aff" />}>
          <Button kind="primary" onClick={copy}>
            {copied ? "Copied ✓" : "Copy link"}
          </Button>
        </Row>
        {"share" in navigator && (
          <Row label="Share…" sub="Use your device's share sheet" icon={<Tile icon="i-ph:share-network-fill" color="#34c759" />} onClick={() => navigator.share({ title: document.title, text, url }).catch(() => {})} chevron />
        )}
        <Row label="Download QR code" sub="SVG, prints sharp at any size" icon={<Tile icon="i-ph:qr-code" color="#8e8e93" />} onClick={downloadQr} chevron />
      </Group>
      <Group title="Send via">
        {intents.map((i) => (
          <Row key={i.label} label={i.label} icon={<Tile icon={i.icon} color={i.color} />} onClick={() => window.open(i.href, "_blank", "noopener")} chevron />
        ))}
      </Group>
    </>
  );
}

// ── General ──────────────────────────────────────────────────────────────────
const SHORTCUTS: [string, string][] = [
  ["⌘ Space", "Spotlight search"],
  ["⌘ F  /  F11", "Full screen"],
  ["⌘ ↑  /  ⌘ ↓", "Brightness"],
  ["Esc", "Close Siri, Spotlight and menus"],
  ["Tab", "Autocomplete in Terminal"],
  ["↑ ↓", "Terminal history"],
  ["Ctrl C  /  Ctrl L", "Cancel / clear in Terminal"]
];

const STARTUP: { value: StartupApp; label: string }[] = [
  { value: "about", label: "About Me" },
  { value: "finder", label: "Finder" },
  { value: "terminal", label: "Terminal" },
  { value: "spotify", label: "Spotify" },
  { value: "none", label: "Nothing (empty desktop)" }
];

export function GeneralPanel() {
  const p = usePrefs();
  const resetAll = async () => {
    const ok = await confirmAction({
      title: "Reset all settings?",
      message: "Appearance, wallpaper, Dock, widgets and preferences go back to their defaults. Your achievements are kept.",
      confirmLabel: "Reset",
      destructive: true
    });
    if (!ok) return;
    p.reset();
    useWidgetStore.getState().resetWidgets();
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("macos-settings-") || k === "terminal-theme")
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      // storage blocked
    }
    location.reload();
  };
  return (
    <>
      <Group
        title="Recruiter Mode"
        footer="Short on time? Skips the login screen, turns off animations and opens About Me first — straight to the résumé and projects."
      >
        <Row label="Recruiter Mode" icon={<Tile icon="i-ph:briefcase-fill" color="#ff9500" />}>
          <Toggle label="Recruiter Mode" checked={p.recruiterMode} onChange={p.setRecruiterMode} />
        </Row>
      </Group>
      <Group title="Startup">
        <Row label="Skip the login screen" sub="Go straight to the desktop on your next visit">
          <Toggle label="Skip login" checked={p.skipIntro} onChange={(v) => p.set("skipIntro", v)} />
        </Row>
        <Row label="Open at startup">
          <Select label="Open at startup" value={p.startupApp} onChange={(v) => p.set("startupApp", v)} options={STARTUP} />
        </Row>
      </Group>
      <Group title="Keyboard shortcuts">
        {SHORTCUTS.map(([k, what]) => (
          <Row key={k} label={what}>
            <kbd style={{ fontFamily: "var(--font-system)", fontSize: 12, padding: "2px 7px", borderRadius: 5, background: "var(--st-field)", color: "var(--st-text)" }}>{k}</kbd>
          </Row>
        ))}
      </Group>
      <Group>
        <Row label="Reset all settings" sub="Appearance, wallpaper, dock, widgets and preferences">
          <Button kind="danger" onClick={resetAll}>
            Reset…
          </Button>
        </Row>
      </Group>
    </>
  );
}

// ── About ────────────────────────────────────────────────────────────────────
// Hand-written highlights (not raw commit messages).
const WHATS_NEW: { icon: string; color: string; title: string; text: string }[] = [
  { icon: "i-ph:gear-fill", color: "#8e8e93", title: "New System Settings", text: "Recruiter Mode, Night Shift, Siri voice options, Privacy & Data and sharing with a QR code." },
  { icon: "i-ph:trophy-fill", color: "#ffcc00", title: "Screen Time & Achievements", text: "17 achievements to discover across the desktop — some are well hidden." },
  { icon: "i-ph:terminal-window-fill", color: "#1c1c1e", title: "A real-feeling Terminal", text: "Autocomplete, neofetch, git log, an interactive projects explorer, games and themes." },
  { icon: "i-ph:music-notes-fill", color: "#1db954", title: "Spotify plays full songs", text: "Search any song and play it — or just ask Siri to play it." },
  { icon: "i-ph:microphone-fill", color: "#af52de", title: "Siri knows Ambuj", text: "Ask about projects, skills or education by voice or text." }
];

const STACK = ["React 18", "TypeScript", "Vite", "Zustand", "UnoCSS", "Framer Motion", "Vercel Edge Functions", "Groq AI", "JioSaavn API", "Web3Forms"];

export function AboutPanel() {
  const info = __BUILD_INFO__;
  const dark = useStore((s) => s.dark);
  return (
    <>
      <Hero
        icon={
          <div className="flex-center" style={{ width: 72, height: 72, borderRadius: 18, background: "linear-gradient(135deg,#0a84ff,#bf5af2)", color: "#fff", fontSize: 30, fontWeight: 800 }}>
            A
          </div>
        }
        title="PortfolioOS"
        sub={`Designed and built by ${profile.name}`}
      />
      <Group>
        <Row label="Version" sub={info.commit ? `Build ${info.commit}` : undefined}>
          26.0
        </Row>
        <Row label="Last updated">{new Date(info.builtAt).toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric" })}</Row>
        <Row label="Built with" sub={STACK.join(" · ")} />
        <Row label="Theme">{dark ? "Dark" : "Light"}</Row>
      </Group>
      <Group title="What's new">
        {WHATS_NEW.map((w) => (
          <Row key={w.title} label={w.title} sub={w.text} icon={<Tile icon={w.icon} color={w.color} />} />
        ))}
      </Group>
      <p className="st-footer" style={{ textAlign: "center", marginTop: 4 }}>
        Inspired by macOS. Apple, macOS, Siri and FaceTime are trademarks of Apple Inc.; Spotify is a trademark of Spotify AB. This is a personal portfolio and
        isn't affiliated with or endorsed by either company.
      </p>
    </>
  );
}
