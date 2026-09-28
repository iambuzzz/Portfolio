import { useShallow } from "zustand/react/shallow";
import { profile } from "~/data/profile";
import { useStore } from "~/stores";
import { ACCENT_HEX } from "~/stores/slices/settings";
import { useWidgetStore, WIDGET_CATALOG } from "~/stores/widgets";
import { useMusicStore } from "~/stores/music";
import { wallpaperThumb } from "~/utils";
import { unlock } from "../activity";
import { usePrefs } from "../prefs";
import { Button, Group, Hero, Row, Segmented, Slider, Tile, Toggle } from "../ui";

const openUrl = (url: string) => window.open(url, "_blank", "noopener");
const openApp = (id: string) => window.dispatchEvent(new CustomEvent("app:open", { detail: id }));

// ── Profile (Apple ID-style) ─────────────────────────────────────────────────
export function ProfilePanel() {
  const downloadResume = () => {
    const a = document.createElement("a");
    a.href = profile.resume;
    a.download = profile.resumeFileName;
    a.click();
    unlock("resume");
  };
  const edu = profile.education[0];
  return (
    <>
      <Hero
        icon={<img src={profile.avatar} alt="" className="st-avatar" style={{ width: 84, height: 84 }} />}
        title={profile.name}
        sub={
          <>
            {profile.role}
            <br />
            📍 {profile.location}
          </>
        }
      />
      <Group>
        <Row label="Résumé" sub={profile.resumeFileName} icon={<Tile icon="i-ph:download-simple" color="#34c759" />}>
          <Button kind="primary" onClick={downloadResume}>
            Download
          </Button>
        </Row>
        <Row label="Send a message" sub="Straight to Ambuj's inbox, from the Mail app" icon={<Tile icon="i-ph:paper-plane-tilt-fill" color="#007aff" />} onClick={() => openApp("mail")} chevron />
        <Row label="Email" sub={profile.email} icon={<Tile icon="i-ph:envelope-simple-fill" color="#5ac8fa" />} onClick={() => (window.location.href = `mailto:${profile.email}`)} chevron />
      </Group>
      <Group title="Profiles">
        <Row label="GitHub" sub={`@${profile.handle}`} icon={<Tile icon="i-ph:github-logo-fill" color="#24292f" />} onClick={() => openUrl(profile.socials.github)} chevron />
        <Row label="LinkedIn" icon={<Tile icon="i-ph:linkedin-logo-fill" color="#0a66c2" />} onClick={() => openUrl(profile.socials.linkedin)} chevron />
        <Row label="LeetCode" sub="Max rating 1830" icon={<Tile icon="i-ph:code-fill" color="#ffa116" />} onClick={() => openUrl(profile.socials.leetcode)} chevron />
        <Row label="CodeChef" sub="2★ · max rating 1585" icon={<Tile icon="i-ph:code-fill" color="#5b4638" />} onClick={() => openUrl(profile.socials.codechef)} chevron />
      </Group>
      <Group title="At a glance">
        <Row label={edu.school} sub={`${edu.degree} · ${edu.period} · ${edu.score}`} icon={<Tile icon="i-ph:briefcase-fill" color="#af52de" />} />
        <Row
          label={`${profile.projects.length} projects`}
          sub={profile.projects.map((p) => p.name).join(", ")}
          icon={<Tile icon="i-ph:rocket-launch-fill" color="#ff9500" />}
          onClick={() => openApp("about")}
          chevron
        />
        <Row label="600+ DSA problems solved" sub="Across LeetCode, CodeChef and more" icon={<Tile icon="i-ph:trophy-fill" color="#ffcc00" />} />
      </Group>
    </>
  );
}

// ── Appearance ───────────────────────────────────────────────────────────────
export function AppearancePanel() {
  const s = useStore(
    useShallow((st) => ({
      mode: st.appearanceMode,
      setMode: st.setAppearanceMode,
      accent: st.accentColor,
      setAccent: st.setAccentColor,
      iconStyle: st.iconStyle,
      setIconStyle: st.setIconStyle,
      tint: st.tintWindows,
      setTint: st.setTintWindows
    }))
  );
  return (
    <>
      <Group>
        <Row label="Appearance" sub="Auto follows your device's light/dark setting">
          <Segmented
            label="Appearance"
            value={s.mode}
            onChange={(m) => {
              s.setMode(m);
              if (m === "dark") unlock("night");
            }}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "auto", label: "Auto" }
            ]}
          />
        </Row>
        <Row label="Accent colour" sub="Selection, switches, sliders and focus rings">
          <span style={{ display: "flex", gap: 7 }}>
            {Object.entries(ACCENT_HEX).map(([name, hex]) => (
              <button
                key={name}
                type="button"
                title={name}
                aria-label={`Accent ${name}`}
                aria-pressed={s.accent.toLowerCase() === hex.toLowerCase()}
                onClick={() => s.setAccent(hex)}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: hex,
                  border: 0,
                  boxShadow: s.accent.toLowerCase() === hex.toLowerCase() ? `0 0 0 2px var(--st-card), 0 0 0 4px ${hex}` : "inset 0 0 0 0.5px rgba(0,0,0,0.2)"
                }}
              />
            ))}
          </span>
        </Row>
      </Group>
      <Group title="Icons & windows">
        <Row label="Icon style" sub="How app icons look in the Dock and Launchpad">
          <Segmented
            label="Icon style"
            value={s.iconStyle}
            onChange={s.setIconStyle}
            options={[
              { value: "default", label: "Default" },
              { value: "dark", label: "Dark" },
              { value: "clear", label: "Clear" },
              { value: "tinted", label: "Tinted" }
            ]}
          />
        </Row>
        <Row label="Tint windows with wallpaper" sub="Let the wallpaper colour show through window backgrounds">
          <Toggle label="Tint windows" checked={s.tint} onChange={s.setTint} />
        </Row>
      </Group>
    </>
  );
}

// ── Wallpaper ────────────────────────────────────────────────────────────────
export function WallpaperPanel() {
  const { sets, active, setActive, dark } = useStore(
    useShallow((st) => ({ sets: st.wallpaperSets, active: st.activeWallpaperSet, setActive: st.setActiveWallpaperSet, dark: st.dark }))
  );
  return (
    <Group>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14, padding: 14 }}>
        {sets.map((w) => {
          const on = w.id === active;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => {
                setActive(w.id);
                unlock("decorator");
              }}
              style={{ background: "none", border: 0, padding: 0, textAlign: "center", color: "var(--st-text)", font: "inherit" }}
            >
              <img
                src={wallpaperThumb(dark ? w.night : w.day)}
                alt=""
                style={{
                  width: "100%",
                  aspectRatio: "16 / 10",
                  objectFit: "cover",
                  borderRadius: 8,
                  display: "block",
                  boxShadow: on ? "0 0 0 3px var(--st-accent)" : "0 0 0 0.5px var(--st-border)"
                }}
              />
              <div style={{ marginTop: 6, fontSize: 12, fontWeight: on ? 600 : 400 }}>{w.name}</div>
            </button>
          );
        })}
      </div>
    </Group>
  );
}

// ── Desktop & Dock ───────────────────────────────────────────────────────────
export function DesktopDockPanel() {
  const s = useStore(
    useShallow((st) => ({
      size: st.dockSize,
      setSize: st.setDockSize,
      mag: st.dockMag,
      setMag: st.setDockMag,
      autoHide: st.dockAutoHide,
      setAutoHide: st.setDockAutoHide
    }))
  );
  const { widgets, add, remove, reset, setGalleryOpen } = useWidgetStore(
    useShallow((w) => ({ widgets: w.widgets, add: w.addWidget, remove: w.removeWidget, reset: w.resetWidgets, setGalleryOpen: w.setGalleryOpen }))
  );
  return (
    <>
      <Group title="Dock">
        <Row label="Size">
          <Slider label="Dock size" value={s.size} min={32} max={80} onChange={s.setSize} left={<small>Small</small>} right={<small>Large</small>} />
        </Row>
        <Row label="Magnification">
          <Slider label="Magnification" value={s.mag} min={1} max={2.5} step={0.1} onChange={s.setMag} left={<small>Off</small>} right={<small>Max</small>} />
        </Row>
        <Row label="Automatically hide and show the Dock" sub="Move the pointer to the bottom edge to reveal it">
          <Toggle label="Auto-hide Dock" checked={s.autoHide} onChange={s.setAutoHide} />
        </Row>
      </Group>
      <Group title="Widgets" footer="Drag widgets anywhere on the desktop. Right-click the desktop › Edit Widgets for the gallery.">
        {WIDGET_CATALOG.map((w) => {
          const on = widgets.some((x) => x.id === w.id);
          return (
            <Row key={w.id} label={w.name} sub={w.description}>
              <Toggle label={w.name} checked={on} onChange={(v) => (v ? add(w.id) : remove(w.id))} />
            </Row>
          );
        })}
        <Row label="Layout">
          <Button onClick={() => setGalleryOpen(true)}>Edit Widgets…</Button>
          <Button onClick={reset}>Reset</Button>
        </Row>
      </Group>
    </>
  );
}

// ── Displays ─────────────────────────────────────────────────────────────────
export function DisplaysPanel() {
  const { brightness, setBrightness } = useStore(useShallow((st) => ({ brightness: st.brightness, setBrightness: st.setBrightness })));
  const p = usePrefs();
  return (
    <>
      <Group>
        <Row label="Brightness">
          <Slider
            label="Brightness"
            value={brightness}
            min={1}
            max={100}
            onChange={setBrightness}
            left={<span className="i-ph:sun-dim" />}
            right={<span className="i-ph:sun-fill" />}
          />
        </Row>
      </Group>
      <Group title="Night Shift" footer="Warms the colours of the screen to be easier on your eyes at night.">
        <Row label="Night Shift">
          <Toggle label="Night Shift" checked={p.nightShift} onChange={(v) => p.set("nightShift", v)} />
        </Row>
        <Row label="Colour temperature" style={{ opacity: p.nightShift ? 1 : 0.45 }}>
          <Slider
            label="Colour temperature"
            value={p.nightShiftWarmth}
            onChange={(v) => p.set("nightShiftWarmth", v)}
            left={<small>Less warm</small>}
            right={<small>More warm</small>}
            width={240}
          />
        </Row>
      </Group>
    </>
  );
}

// ── Sound ────────────────────────────────────────────────────────────────────
export function SoundPanel() {
  const { volume, setVolume } = useMusicStore(useShallow((m) => ({ volume: m.volume, setVolume: m.setVolume })));
  const p = usePrefs();
  return (
    <>
      <Group>
        <Row label="Output volume" sub="Music played in Spotify, Terminal or Siri">
          <Slider
            label="Output volume"
            value={volume}
            onChange={setVolume}
            left={<span className="i-ph:speaker-low" />}
            right={<span className="i-ph:speaker-high" />}
          />
        </Row>
      </Group>
      <Group>
        <Row label="Play user interface sound effects" sub="Siri's chime when it starts listening">
          <Toggle label="UI sounds" checked={p.uiSounds} onChange={(v) => p.set("uiSounds", v)} />
        </Row>
      </Group>
    </>
  );
}
