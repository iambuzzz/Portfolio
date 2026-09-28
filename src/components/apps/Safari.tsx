import { useEffect, useMemo, useRef, useState } from "react";
import websites from "~/configs/websites";
import wallpapers from "~/configs/wallpapers";
import { profile } from "~/data/profile";
import { checkURL, wallpaperSrc } from "~/utils";
import { useStore } from "~/stores";
import { askSiri } from "~/utils/siriBridge";
import type { SiteSectionData, SiteData } from "~/types";

// Safari: a start page, a search page (Ambuj's portfolio + Wikipedia, with a
// hand-off to Google in a real tab), and pages in an iframe when the site
// allows being embedded. Sites that forbid it get a clear "open in new tab".

type Page = { kind: "home" } | { kind: "search"; q: string } | { kind: "web"; url: string };
type Frame = "checking" | "ok" | "blocked";

const HISTORY_KEY = "macos-safari-history";
interface Visit {
  url: string;
  title: string;
  at: number;
}
const loadVisits = (): Visit[] => {
  try {
    const v = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(v) ? v.slice(0, 8) : [];
  } catch {
    return [];
  }
};

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

// Known to allow embedding: skip the check.
const EMBEDDABLE = new Set([...profile.projects.map((p) => hostOf(p.live)), "en.wikipedia.org", "en.m.wikipedia.org", location.hostname]);
const frameCache = new Map<string, boolean>();
// Embeddable, but only usable on a wide desktop screen (Codolio overflows below
// ~1400px even in a normal browser), so it is opened in a real tab instead.
const TAB_ONLY = new Set(["codolio.com"]);

async function canEmbed(url: string): Promise<boolean> {
  const host = hostOf(url);
  if (TAB_ONLY.has(host)) return false;
  if (EMBEDDABLE.has(host) || url.startsWith("/")) return true;
  if (frameCache.has(host)) return frameCache.get(host)!;
  try {
    const res = await fetch(`/api/frame-check?url=${encodeURIComponent(url)}`);
    if (!res.ok) return true; // checker unavailable: let the browser try
    const { embeddable } = await res.json();
    frameCache.set(host, !!embeddable);
    return !!embeddable;
  } catch {
    return true;
  }
}

const toUrl = (text: string): string | null => {
  const t = text.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (!/\s/.test(t) && checkURL(t)) return `https://${t}`;
  return null;
};

const openTab = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

// ── Start page ──────────────────────────────────────────────────────────────
const NavSection = ({ section, go }: { section: SiteSectionData; go: (url: string) => void }) => (
  <div style={{ margin: "0 auto", width: "100%", maxWidth: 800, padding: "32px 16px 0" }}>
    <div className="sf-h">{section.title}</div>
    <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))", gap: "18px 12px" }}>
      {section.sites.map((site: SiteData) => (
        <button
          type="button"
          key={`safari-nav-${site.id}`}
          className="sf-site"
          onClick={() => (site.link.startsWith("mailto:") ? (location.href = site.link) : go(site.link))}
        >
          <span className="sf-site-icon">
            {site.img ? <img src={site.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : site.title.slice(0, 2)}
          </span>
          <span className="sf-site-label">{site.title}</span>
        </button>
      ))}
    </div>
  </div>
);

function HomePage({ go, visits, clear }: { go: (url: string) => void; visits: Visit[]; clear: () => void }) {
  const dark = useStore((s) => s.dark);
  return (
    <div className="sf-home" style={{ backgroundImage: `url(${wallpaperSrc(dark ? wallpapers.night : wallpapers.day)})` }}>
      <div className="sf-home-inner">
        <NavSection section={websites.favorites} go={go} />
        <NavSection section={websites.freq} go={go} />
        {visits.length > 0 && (
          <div style={{ margin: "0 auto", width: "100%", maxWidth: 800, padding: "40px 16px 48px" }}>
            <div className="sf-h" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              Recently Visited
              <button type="button" className="sf-link-btn" onClick={clear}>
                Clear
              </button>
            </div>
            <div className="sf-card" style={{ marginTop: 14 }}>
              {visits.map((v) => (
                <button type="button" key={v.url} className="sf-visit" onClick={() => go(v.url)}>
                  <span className="i-ph:globe-simple" style={{ width: 16, height: 16, color: "var(--sf-sub)", flexShrink: 0 }} />
                  <span className="sf-visit-title">{v.title}</span>
                  {v.title !== hostOf(v.url) && <span className="sf-visit-host">{hostOf(v.url)}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Search page ─────────────────────────────────────────────────────────────
interface WikiHit {
  title: string;
  snippet: string;
}

function SearchPage({ q, go }: { q: string; go: (url: string) => void }) {
  const [wiki, setWiki] = useState<WikiHit[] | null>(null);
  const needle = q.toLowerCase();

  useEffect(() => {
    setWiki(null);
    const ctrl = new AbortController();
    fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=6&srsearch=${encodeURIComponent(q)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => setWiki((d?.query?.search ?? []).map((h: WikiHit) => ({ title: h.title, snippet: h.snippet.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#039;/g, "'") }))))
      .catch(() => setWiki([]));
    return () => ctrl.abort();
  }, [q]);

  // Matches from the portfolio itself.
  const mine = useMemo(() => {
    const hits: { title: string; sub: string; icon: string; run: () => void }[] = [];
    const has = (s: string) => s.toLowerCase().includes(needle) || needle.split(/\s+/).every((w) => s.toLowerCase().includes(w));
    for (const p of profile.projects)
      if (has(`${p.name} ${p.tagline} ${p.stack.join(" ")}`)) hits.push({ title: p.name, sub: `${p.tagline} · ${p.stack.slice(0, 4).join(", ")}`, icon: "i-ph:rocket-launch-fill", run: () => go(p.live) });
    for (const c of profile.certifications) if (has(`${c.title} ${c.issuer}`)) hits.push({ title: c.title, sub: `Certificate · ${c.issuer}, ${c.year}`, icon: "i-ph:certificate-fill", run: () => go(c.file) });
    for (const [cat, list] of Object.entries(profile.skills))
      for (const s of list)
        if (s.toLowerCase().includes(needle) || needle.split(/\s+/).includes(s.toLowerCase().replace(/\.js$/, "")))
          hits.push({ title: s, sub: `Skill · ${cat}. Ask Siri what ${profile.firstName} built with it`, icon: "i-ph:code-bold", run: () => askSiri(`What has ${profile.firstName} done with ${s}?`) });
    for (const site of websites.favorites.sites) if (has(site.title) && !site.link.startsWith("mailto:")) hits.push({ title: `${profile.firstName} on ${site.title}`, sub: site.link.replace(/^https:\/\/(www\.)?/, ""), icon: "i-ph:user-circle-fill", run: () => go(site.link) });
    return hits.slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needle]);

  return (
    <div className="sf-search">
      <div className="sf-search-inner">
        <button type="button" className="sf-google" onClick={() => openTab(`https://www.google.com/search?q=${encodeURIComponent(q)}`)}>
          <img src="https://www.google.com/favicon.ico" alt="" width={18} height={18} />
          <span style={{ flex: 1, textAlign: "left" }}>
            Search Google for <b>“{q}”</b>
          </span>
          <span className="sf-google-note">
            opens a new tab <span className="i-ph:arrow-square-out" style={{ width: 13, height: 13, verticalAlign: "-2px" }} />
          </span>
        </button>

        {mine.length > 0 && (
          <>
            <div className="sf-section">From {profile.firstName}'s portfolio</div>
            {mine.map((h) => (
              <button type="button" key={h.title} className="sf-result" onClick={h.run}>
                <span className={h.icon} style={{ width: 18, height: 18, color: "#007aff", flexShrink: 0, marginTop: 2 }} />
                <span style={{ minWidth: 0 }}>
                  <span className="sf-result-title">{h.title}</span>
                  <span className="sf-result-sub">{h.sub}</span>
                </span>
              </button>
            ))}
          </>
        )}

        <div className="sf-section">Wikipedia</div>
        {wiki === null ? (
          <div className="sf-muted">Searching…</div>
        ) : wiki.length === 0 ? (
          <div className="sf-muted">No Wikipedia articles found.</div>
        ) : (
          wiki.map((w) => (
            <button type="button" key={w.title} className="sf-result" onClick={() => go(`https://en.m.wikipedia.org/wiki/${encodeURIComponent(w.title.replace(/ /g, "_"))}`)}>
              <span className="i-ph:book-open-text" style={{ width: 18, height: 18, color: "var(--sf-sub)", flexShrink: 0, marginTop: 2 }} />
              <span style={{ minWidth: 0 }}>
                <span className="sf-result-title">{w.title}</span>
                <span className="sf-result-sub">{w.snippet}…</span>
              </span>
            </button>
          ))
        )}
        <div className="sf-muted" style={{ marginTop: 18, fontSize: 11.5 }}>
          Google and most big sites don't allow being shown inside other websites, so web search opens in a real browser tab.
        </div>
      </div>
    </div>
  );
}

// ── Blocked site ────────────────────────────────────────────────────────────
const BlockedPage = ({ url }: { url: string }) => (
  <div className="sf-blocked">
    <span className="i-ph:shield-warning" style={{ width: 44, height: 44, color: "var(--sf-sub)" }} />
    <div style={{ fontSize: 18, fontWeight: 600 }}>{hostOf(url)} can't be shown here</div>
    <div className="sf-muted" style={{ maxWidth: 380, lineHeight: 1.5 }}>
      {TAB_ONLY.has(hostOf(url))
        ? "This site is built for a full-size browser window, so it opens in its own tab."
        : "This website doesn't allow itself to be displayed inside other websites. You can still open it in a new browser tab."}
    </div>
    <button type="button" className="sf-primary" onClick={() => openTab(url)}>
      Open {hostOf(url)} in a new tab <span className="i-ph:arrow-square-out" style={{ width: 14, height: 14 }} />
    </button>
  </div>
);

const NoInternetPage = () => (
  <div className="sf-blocked">
    <span className="i-ph:wifi-slash" style={{ width: 44, height: 44, color: "var(--sf-sub)" }} />
    <div style={{ fontSize: 18, fontWeight: 600 }}>You Are Not Connected to the Internet</div>
    <div className="sf-muted">Wi-Fi is turned off in Control Center.</div>
  </div>
);

// ── Safari ──────────────────────────────────────────────────────────────────
const Safari = () => {
  const wifi = useStore((s) => s.wifi);
  const safariUrl = useStore((s) => s.safariUrl);
  const setSafariUrl = useStore((s) => s.setSafariUrl);

  // One state, so the list and the position always change together.
  const [{ history, index }, setNav] = useState<{ history: Page[]; index: number }>({ history: [{ kind: "home" }], index: 0 });
  const page = history[index];
  const step = (d: number) => setNav((n) => ({ ...n, index: Math.max(0, Math.min(n.history.length - 1, n.index + d)) }));
  const [address, setAddress] = useState("");
  const [frame, setFrame] = useState<Frame>("checking");
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [visits, setVisits] = useState<Visit[]>(loadVisits);
  const [toast, setToast] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const navigate = (next: Page) => {
    setNav((n) => {
      const kept = n.history.slice(0, n.index + 1);
      // Same page twice in a row (e.g. a repeated open request): don't stack it.
      if (JSON.stringify(kept[kept.length - 1]) === JSON.stringify(next)) return n;
      return { history: [...kept, next], index: kept.length };
    });
  };
  const go = (url: string) => navigate({ kind: "web", url });
  const submit = (text: string) => {
    const t = text.trim();
    if (!t) return navigate({ kind: "home" });
    const url = toUrl(t);
    navigate(url ? { kind: "web", url } : { kind: "search", q: t });
    inputRef.current?.blur();
  };

  // Opened from Launchpad / Finder with a URL.
  useEffect(() => {
    if (safariUrl) {
      go(safariUrl);
      setSafariUrl("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safariUrl]);

  // Address bar mirrors the current page.
  useEffect(() => {
    setAddress(page.kind === "web" ? page.url : page.kind === "search" ? page.q : "");
  }, [page]);

  // Check whether the site may be embedded, then remember the visit.
  useEffect(() => {
    if (page.kind !== "web") return;
    let alive = true;
    setFrame("checking");
    canEmbed(page.url).then((ok) => {
      if (!alive) return;
      setFrame(ok ? "ok" : "blocked");
      setLoading(ok);
    });
    const wiki = /wikipedia\.org\/wiki\/([^?#]+)/.exec(page.url);
    const title =
      profile.projects.find((p) => hostOf(p.live) === hostOf(page.url))?.name ??
      (wiki ? `${decodeURIComponent(wiki[1]).replace(/_/g, " ")} — Wikipedia` : hostOf(page.url));
    setVisits((v) => [{ url: page.url, title, at: Date.now() }, ...v.filter((x) => x.url !== page.url)].slice(0, 8));
    return () => {
      alive = false;
    };
  }, [page]);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(visits));
    } catch {
      // storage blocked
    }
  }, [visits]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  const share = async () => {
    const url = page.kind === "web" ? page.url : page.kind === "search" ? `https://www.google.com/search?q=${encodeURIComponent(page.q)}` : location.href;
    try {
      await navigator.clipboard.writeText(url);
      setToast("Link copied");
    } catch {
      setToast("Couldn't copy the link");
    }
  };

  const canBack = index > 0;
  const canForward = index < history.length - 1;
  const secure = page.kind === "web" && page.url.startsWith("https://");

  return (
    <div className="sf">
      <div className="sf-bar">
        <div style={{ display: "flex", gap: 2 }}>
          <button type="button" className="sf-btn" aria-label="Back" title="Back" disabled={!canBack} onClick={() => step(-1)}>
            <span className="i-ph:caret-left-bold" />
          </button>
          <button type="button" className="sf-btn" aria-label="Forward" title="Forward" disabled={!canForward} onClick={() => step(1)}>
            <span className="i-ph:caret-right-bold" />
          </button>
        </div>
        <form
          className="sf-address"
          onSubmit={(e) => {
            e.preventDefault();
            submit(address);
          }}
        >
          <span className={secure ? "i-ph:lock-simple-fill" : "i-ph:magnifying-glass"} style={{ width: 13, height: 13, color: "var(--sf-sub)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onFocus={(e) => e.target.select()}
            placeholder="Search or enter website name"
            aria-label="Address and search bar"
            spellCheck={false}
          />
          {page.kind === "web" && frame === "ok" && (
            <button
              type="button"
              className="sf-btn small"
              aria-label="Reload"
              title="Reload"
              onClick={() => {
                setLoading(true);
                setReloadKey((k) => k + 1);
              }}
            >
              <span className="i-ph:arrow-clockwise" />
            </button>
          )}
        </form>
        <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
          <button type="button" className="sf-btn" aria-label="Copy link" title="Copy link" onClick={share}>
            <span className="i-ph:share-network" />
          </button>
          <button type="button" className="sf-btn" aria-label="Open in new tab" title="Open in a real browser tab" disabled={page.kind === "home"} onClick={() => {
              if (page.kind === "web") openTab(page.url);
              else if (page.kind === "search") openTab(`https://www.google.com/search?q=${encodeURIComponent(page.q)}`);
            }}>
            <span className="i-ph:arrow-square-out" />
          </button>
        </div>
        {loading && page.kind === "web" && frame === "ok" && <div className="sf-progress" />}
      </div>

      <div style={{ flex: 1, position: "relative", minHeight: 0, overflow: "hidden" }}>
        {!wifi ? (
          <NoInternetPage />
        ) : page.kind === "home" ? (
          <HomePage go={go} visits={visits} clear={() => setVisits([])} />
        ) : page.kind === "search" ? (
          <SearchPage q={page.q} go={go} />
        ) : frame === "blocked" ? (
          <BlockedPage url={page.url} />
        ) : frame === "checking" ? (
          <div className="sf-blocked sf-muted">Loading {hostOf(page.url)}…</div>
        ) : (
          <iframe
            key={`${page.url}-${reloadKey}`}
            title={`Safari: ${hostOf(page.url)}`}
            src={page.url}
            onLoad={() => setLoading(false)}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              background: "#fff",
              display: "block"
            }}
          />
        )}
        {toast && <div className="notes-toast">{toast}</div>}
      </div>
    </div>
  );
};

export default Safari;
