import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { profile } from "~/data/profile";
import { ConfirmSheet, Tile } from "~/settings/ui";
import { takePendingPanel } from "~/settings/nav";
import { PANE_GROUPS, type PaneInfo } from "~/settings/panes";
import { AppearancePanel, DesktopDockPanel, DisplaysPanel, ProfilePanel, SoundPanel, WallpaperPanel } from "~/settings/panels/Personal";
import { AboutPanel, AccessibilityPanel, GeneralPanel, PrivacyPanel, ScreenTimePanel, SharePanel, SiriPanel } from "~/settings/panels/System";

// macOS System Settings. Every item here does something real; see
// src/settings for the panels, preferences store and global effects.

interface Pane extends PaneInfo {
  Panel: ComponentType;
}

const PANELS: Record<string, ComponentType> = {
  appearance: AppearancePanel,
  wallpaper: WallpaperPanel,
  desktop: DesktopDockPanel,
  displays: DisplaysPanel,
  sound: SoundPanel,
  siri: SiriPanel,
  accessibility: AccessibilityPanel,
  "screen-time": ScreenTimePanel,
  privacy: PrivacyPanel,
  share: SharePanel,
  general: GeneralPanel,
  about: AboutPanel
};
const GROUPS: Pane[][] = PANE_GROUPS.map((g) => g.map((p) => ({ ...p, Panel: PANELS[p.id] })));

const PROFILE: Pane = {
  id: "profile",
  label: profile.name,
  icon: "",
  color: "",
  keywords: "resume cv contact email github linkedin ambuj",
  Panel: ProfilePanel
};
const ALL = [PROFILE, ...GROUPS.flat()];

export default function SystemSettings() {
  const [active, setActive] = useState<string>(() => takePendingPanel() ?? "profile");
  const [query, setQuery] = useState("");
  const [rootRef, width] = useElementWidth();
  const narrow = width > 0 && width < 620;
  const [showDetail, setShowDetail] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  // Opened from elsewhere (e.g. achievement banner) while already running.
  useEffect(() => {
    const on = (e: Event) => {
      takePendingPanel();
      setActive((e as CustomEvent<string>).detail);
      setShowDetail(true);
    };
    window.addEventListener("settings:open", on);
    return () => window.removeEventListener("settings:open", on);
  }, []);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
    setScrolled(false);
  }, [active]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return ALL.filter((p) => `${p.label} ${p.keywords}`.toLowerCase().includes(q));
  }, [query]);

  const pane = ALL.find((p) => p.id === active) ?? PROFILE;
  const select = (id: string) => {
    setActive(id);
    setShowDetail(true);
  };

  const NavItem = ({ p }: { p: Pane }) => (
    <button type="button" className={`st-nav-item ${!narrow && active === p.id ? "on" : ""}`} onClick={() => select(p.id)}>
      {p.id === "profile" ? (
        <img src={profile.avatar} alt="" className="st-avatar" style={{ width: 22, height: 22 }} />
      ) : (
        <Tile icon={p.icon} color={p.color} size={narrow ? 30 : 22} />
      )}
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.label}</span>
      {narrow && <span className="i-ph:caret-right st-chevron" />}
    </button>
  );

  const sidebar = (
    <nav className="st-sidebar" aria-label="Settings">
      {narrow && <h1 className="st-large-title">Settings</h1>}
      <label className="st-search">
        <span className="i-ph:magnifying-glass" style={{ width: 13, height: 13, color: "var(--st-sub)" }} />
        <input placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search settings" />
        {query && (
          <button type="button" aria-label="Clear search" onClick={() => setQuery("")} style={{ background: "none", border: 0, color: "var(--st-sub)", display: "flex" }}>
            <span className="i-ph:x-circle-fill" style={{ width: 13, height: 13 }} />
          </button>
        )}
      </label>
      <div className="st-nav">
        {results ? (
          results.length ? (
            results.map((p) => <NavItem key={p.id} p={p} />)
          ) : (
            <div className="st-empty">No results for “{query}”</div>
          )
        ) : (
          <>
            <button type="button" className={`st-profile ${!narrow && active === "profile" ? "on" : ""}`} onClick={() => select("profile")}>
              <img src={profile.avatar} alt="" className="st-avatar" style={{ width: narrow ? 60 : 38, height: narrow ? 60 : 38 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="st-profile-name" style={{ display: "block", fontWeight: 600, fontSize: 13.5 }}>{profile.name}</span>
                <span className="st-row-sub" style={{ display: "block" }}>
                  Résumé, contact & profiles
                </span>
              </span>
              {narrow && <span className="i-ph:caret-right st-chevron" />}
            </button>
            {GROUPS.map((g, i) => (
              <div key={i}>
                <div className="st-nav-gap" />
                <div className="st-nav-group">
                  {g.map((p) => (
                    <NavItem key={p.id} p={p} />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </nav>
  );

  const detail = (
    <main className="st-main">
      <div className={`st-toolbar ${scrolled ? "scrolled" : ""}`} style={narrow ? { paddingTop: 0 } : { paddingLeft: 24 }}>
        {narrow && (
          <button type="button" className="st-back" aria-label="Back to Settings" onClick={() => setShowDetail(false)}>
            <span className="i-ph:caret-left-bold" style={{ width: 16, height: 16 }} />
            <span className="st-back-label">Settings</span>
          </button>
        )}
        <span className="st-toolbar-title">{pane.id === "profile" ? "Profile" : pane.label}</span>
      </div>
      <div ref={contentRef} className="st-content" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}>
        <div className="st-content-inner">
          <pane.Panel />
        </div>
      </div>
    </main>
  );

  return (
    <div ref={rootRef} className={`st-root ${narrow ? "narrow" : ""}`} style={narrow ? { paddingTop: 36 } : undefined}>
      {narrow ? (showDetail ? detail : sidebar) : (
        <>
          {sidebar}
          {detail}
        </>
      )}
      <ConfirmSheet />
    </div>
  );
}
