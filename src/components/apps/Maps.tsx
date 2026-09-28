import { useEffect, useRef, useState, type ReactNode } from "react";

// Maps: Google Maps Embed API (free, key restricted to this site's domains).
// Without a key it falls back to an OpenStreetMap view of the same place.
const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;

type Mode = "driving" | "walking" | "bicycling" | "transit" | "flying";
type MapType = "roadmap" | "satellite";

interface Place {
  id: string;
  name: string;
  sub: string;
  /** What Google should look up. */
  query: string;
  icon: string;
  color: string;
  /** Only used by the OpenStreetMap fallback. */
  lat?: number;
  lng?: number;
}

// Places from Ambuj's résumé.
const FAVOURITES: Place[] = [
  { id: "iiit", name: "IIIT Kota", sub: "University · B.Tech CSE, 2023–2027", query: "IIIT Kota, RIICO Industrial Area, Kota, Rajasthan", icon: "i-ph:graduation-cap-fill", color: "#007AFF", lat: 25.1737, lng: 75.8574 },
  { id: "kota", name: "Kota, Rajasthan", sub: "City · where Ambuj studies", query: "Kota, Rajasthan", icon: "i-ph:buildings-fill", color: "#FF9500", lat: 25.2138, lng: 75.8648 },
  { id: "school", name: "Jagat Taran Golden Jubilee School", sub: "School · Class 10 & 12", query: "Jagat Taran Golden Jubilee School, Prayagraj", icon: "i-ph:book-open-fill", color: "#34C759", lat: 25.454, lng: 81.859 },
  { id: "prayagraj", name: "Prayagraj, Uttar Pradesh", sub: "City", query: "Prayagraj, Uttar Pradesh", icon: "i-ph:map-pin-fill", color: "#AF52DE", lat: 25.4358, lng: 81.8463 }
];

const MODES: { id: Mode; icon: string; label: string }[] = [
  { id: "driving", icon: "i-ph:car-fill", label: "Drive" },
  { id: "transit", icon: "i-ph:train-fill", label: "Transit" },
  { id: "walking", icon: "i-ph:person-simple-walk-bold", label: "Walk" },
  { id: "bicycling", icon: "i-ph:bicycle-bold", label: "Cycle" },
  { id: "flying", icon: "i-ph:airplane-tilt-fill", label: "Fly" }
];

const RECENTS_KEY = "macos-maps-recents";
const loadRecents = (): string[] => {
  try {
    const r = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]");
    return Array.isArray(r) ? r.filter((x) => typeof x === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
};

// Free place suggestions while typing (Photon, OpenStreetMap data; no key).
// Picking one searches it on Google, so results still come from Google Maps.
interface Suggestion {
  key: string;
  title: string;
  sub?: string;
  icon: string;
  query: string;
}

function usePlaceSuggestions(text: string, enabled: boolean) {
  const [items, setItems] = useState<Suggestion[]>([]);
  useEffect(() => {
    const q = text.trim();
    if (!enabled || q.length < 2) {
      setItems([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        // Biased towards Kota, where most visitors will look.
        const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lat=25.18&lon=75.85&lang=en`, { signal: ctrl.signal });
        const data: { features: { properties: Record<string, string> }[] } = await res.json();
        const seen = new Set<string>();
        setItems(
          data.features
            .map(({ properties: p }) => {
              const where = [p.city ?? p.county, p.state, p.country].filter(Boolean);
              const title = p.name ?? [p.housenumber, p.street].filter(Boolean).join(" ");
              return { key: `${p.osm_type}${p.osm_id}`, title, sub: where.join(", "), icon: "i-ph:map-pin-bold", query: [title, ...where].join(", ") };
            })
            .filter((x) => x.title && !seen.has(x.query) && seen.add(x.query))
            // Drop matches on just one common word ("shree banchu inn" ≠ "Shree Ram Udhyan").
            .filter((x) => {
              const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
              const title = x.title.toLowerCase().split(/[\s,.-]+/);
              const hits = words.filter((w) => title.some((t) => t.startsWith(w))).length;
              return hits >= Math.max(1, words.length - 1);
            })
        );
      } catch {
        // offline / aborted: just no suggestions
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [text, enabled]);
  return items;
}

type View = { kind: "place"; place: Place } | { kind: "search"; query: string } | { kind: "directions"; from: string; to: string; mode: Mode };

function embedUrl(view: View, mapType: MapType): string {
  const q = encodeURIComponent;
  if (!KEY) {
    // Fallback: OpenStreetMap around the place (no search or directions).
    const p = view.kind === "place" ? view.place : FAVOURITES[0];
    const lat = p.lat ?? FAVOURITES[0].lat!;
    const lng = p.lng ?? FAVOURITES[0].lng!;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.06},${lat - 0.035},${lng + 0.06},${lat + 0.035}&layer=mapnik&marker=${lat},${lng}`;
  }
  const base = "https://www.google.com/maps/embed/v1";
  const common = `key=${KEY}&maptype=${mapType}`;
  if (view.kind === "directions") return `${base}/directions?${common}&origin=${q(view.from)}&destination=${q(view.to)}&mode=${view.mode}`;
  if (view.kind === "search") return `${base}/search?${common}&q=${q(view.query)}`;
  return `${base}/place?${common}&q=${q(view.place.query)}`;
}

const openInGoogle = (view: View) => {
  const q = encodeURIComponent;
  if (view.kind === "directions") return `https://www.google.com/maps/dir/?api=1&origin=${q(view.from)}&destination=${q(view.to)}&travelmode=${view.mode === "flying" ? "driving" : view.mode}`;
  return `https://www.google.com/maps/search/?api=1&query=${q(view.kind === "search" ? view.query : view.place.query)}`;
};

const Label = ({ children }: { children: ReactNode }) => <div className="maps-label">{children}</div>;

export default function Maps() {
  const [view, setView] = useState<View>({ kind: "place", place: FAVOURITES[0] });
  const [mapType, setMapType] = useState<MapType>("roadmap");
  const [search, setSearch] = useState("");
  const [recents, setRecents] = useState<string[]>(loadRecents);
  const [panel, setPanel] = useState<"browse" | "directions">("browse");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(FAVOURITES[0].query);
  const [mode, setMode] = useState<Mode>("driving");
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rootRef, rootWidth] = useElementWidth();
  const narrow = rootWidth > 0 && rootWidth < 700;
  const searchRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [sel, setSel] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const remote = usePlaceSuggestions(search, !!KEY && focused);

  const src = embedUrl(view, mapType);
  useEffect(() => setLoading(true), [src]);

  useEffect(() => {
    try {
      localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
    } catch {
      // storage blocked
    }
  }, [recents]);

  const runSearch = (text = search) => {
    const q = text.trim();
    if (!q) return;
    setView({ kind: "search", query: q });
    setRecents((r) => [q, ...r.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 6));
    setFocused(false);
    setSheetOpen(false);
    searchRef.current?.blur();
  };

  const q = search.trim().toLowerCase();
  const suggestions: Suggestion[] = !q
    ? []
    : [
        { key: "search", title: `Search “${search.trim()}”`, icon: "i-ph:magnifying-glass-bold", query: search.trim() },
        ...FAVOURITES.filter((p) => p.name.toLowerCase().includes(q)).map((p) => ({ key: `fav-${p.id}`, title: p.name, sub: p.sub, icon: "i-ph:star-fill", query: p.query })),
        ...recents
          .filter((r) => r.toLowerCase().includes(q) && r.toLowerCase() !== q)
          .map((r) => ({ key: `recent-${r}`, title: r, sub: "Recent", icon: "i-ph:clock-counter-clockwise-bold", query: r })),
        ...remote
      ].slice(0, 8);
  useEffect(() => setSel(0), [q, remote.length]);

  const pick = (sgt: Suggestion) => {
    setSearch(sgt.key === "search" ? sgt.query : sgt.title);
    runSearch(sgt.query);
  };

  const showDirections = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!from.trim() || !to.trim()) return;
    setView({ kind: "directions", from: from.trim(), to: to.trim(), mode });
    setSheetOpen(false);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFrom(`${pos.coords.latitude.toFixed(5)},${pos.coords.longitude.toFixed(5)}`);
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 10000 }
    );
  };

  const directionsTo = (query: string) => {
    setTo(query);
    setPanel("directions");
  };

  const title = view.kind === "place" ? view.place.name : view.kind === "search" ? view.query : `${from || "Start"} → ${to}`;
  const sub =
    view.kind === "place"
      ? view.place.sub
      : view.kind === "search"
        ? "Search results"
        : `${MODES.find((m) => m.id === view.mode)?.label ?? ""} directions`;

  const browse = (
    <>
      <form
        className="maps-search"
        onSubmit={(e) => {
          e.preventDefault();
          if (suggestions[sel]) pick(suggestions[sel]);
          else runSearch();
        }}
      >
        <span className="i-ph:magnifying-glass" style={{ width: 14, height: 14, color: "var(--a-text-2)" }} />
        <input
          ref={searchRef}
          placeholder={KEY ? "Search places, cafés, addresses…" : "Search needs a Google Maps key"}
          value={search}
          disabled={!KEY}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => {
            setFocused(true);
            setSheetOpen(true);
          }}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSel((i) => Math.min(suggestions.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSel((i) => Math.max(0, i - 1));
            } else if (e.key === "Escape") {
              setFocused(false);
              searchRef.current?.blur();
            }
          }}
          aria-label="Search Maps"
          role="combobox"
          aria-expanded={focused && suggestions.length > 0}
          aria-controls="maps-suggestions"
          autoComplete="off"
        />
        {search && (
          <button type="button" aria-label="Clear search" className="maps-icon-btn" onClick={() => setSearch("")}>
            <span className="i-ph:x-circle-fill" style={{ width: 14, height: 14, color: "var(--a-text-3)" }} />
          </button>
        )}
      </form>
      {focused && suggestions.length > 0 && (
        <div className="maps-suggest" id="maps-suggestions" role="listbox">
          {suggestions.map((sgt, i) => (
            <button
              type="button"
              role="option"
              aria-selected={i === sel}
              key={sgt.key}
              className={`maps-suggest-row ${i === sel ? "on" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseMove={() => setSel(i)}
              onClick={() => pick(sgt)}
            >
              <span className={sgt.icon} style={{ width: 14, height: 14, flexShrink: 0, color: sgt.key.startsWith("fav") ? "#ff9500" : "var(--a-text-2)" }} />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="maps-row-title">{sgt.title}</span>
                {sgt.sub && <span className="maps-row-sub">{sgt.sub}</span>}
              </span>
            </button>
          ))}
          <div className="maps-suggest-foot">Suggestions: © OpenStreetMap contributors</div>
        </div>
      )}
      {!(focused && suggestions.length > 0) && KEY && (
        <button type="button" className="maps-dir-btn" onClick={() => setPanel("directions")}>
          <span className="i-ph:arrow-bend-up-right-bold" style={{ width: 14, height: 14 }} />
          Directions
        </button>
      )}

      {!(focused && suggestions.length > 0) && (
        <>
      <Label>{"Ambuj's places"}</Label>
      {FAVOURITES.map((p) => {
        const on = view.kind === "place" && view.place.id === p.id;
        return (
          <button type="button" key={p.id} className={`maps-row ${on ? "on" : ""}`} onClick={() => {
              setView({ kind: "place", place: p });
              setSheetOpen(false);
            }}>
            <span className="maps-pin" style={{ background: p.color }}>
              <span className={p.icon} style={{ width: 14, height: 14 }} />
            </span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span className="maps-row-title">{p.name}</span>
              <span className="maps-row-sub">{p.sub}</span>
            </span>
          </button>
        );
      })}

      {KEY && recents.length > 0 && (
        <>
          <Label>
            Recent searches
            <button type="button" className="maps-clear" onClick={() => setRecents([])}>
              Clear
            </button>
          </Label>
          {recents.map((r) => (
            <button
              type="button"
              key={r}
              className={`maps-row ${view.kind === "search" && view.query === r ? "on" : ""}`}
              onClick={() => {
                setSearch(r);
                runSearch(r);
              }}
            >
              <span className="maps-pin" style={{ background: "var(--a-fill)", color: "var(--a-text-2)" }}>
                <span className="i-ph:clock-counter-clockwise-bold" style={{ width: 13, height: 13 }} />
              </span>
              <span className="maps-row-title" style={{ flex: 1 }}>
                {r}
              </span>
            </button>
          ))}
        </>
      )}
      {KEY && (
        <>
          <Label>Try</Label>
          <div className="maps-chips">
            {["Cafés near IIIT Kota", "Chambal Riverfront Kota", "Kota Junction", "Triveni Sangam Prayagraj"].map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => {
                  setSearch(s);
                  runSearch(s);
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </>
      )}
        </>
      )}
    </>
  );

  const directions = (
    <form onSubmit={showDirections} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 10px 0" }}>
      <button type="button" className="maps-back" onClick={() => setPanel("browse")}>
        <span className="i-ph:caret-left-bold" style={{ width: 12, height: 12 }} /> Back
      </button>
      <div className="maps-field">
        <span className="maps-dot" style={{ background: "#34C759" }} />
        <input placeholder="From: city, address or place" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
        <button type="button" className="maps-icon-btn" title="Use my location" aria-label="Use my location" onClick={useMyLocation}>
          <span className={locating ? "i-ph:spinner-gap" : "i-ph:crosshair-bold"} style={{ width: 15, height: 15, color: "#007AFF" }} />
        </button>
      </div>
      <div className="maps-field">
        <span className="maps-dot" style={{ background: "#FF3B30" }} />
        <input placeholder="To" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
        <button
          type="button"
          className="maps-icon-btn"
          title="Swap"
          aria-label="Swap start and destination"
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
        >
          <span className="i-ph:arrows-down-up-bold" style={{ width: 14, height: 14, color: "var(--a-text-2)" }} />
        </button>
      </div>
      <div className="maps-modes" role="radiogroup" aria-label="Travel mode">
        {MODES.map((m) => (
          <button type="button" role="radio" aria-checked={mode === m.id} key={m.id} className={mode === m.id ? "on" : ""} title={m.label} onClick={() => setMode(m.id)}>
            <span className={m.icon} style={{ width: 16, height: 16 }} />
            <span>{m.label}</span>
          </button>
        ))}
      </div>
      <button type="submit" className="maps-go" disabled={!from.trim() || !to.trim()}>
        Get Directions
      </button>
      <div style={{ fontSize: 11, color: "var(--a-text-3)", lineHeight: 1.4, padding: "0 2px" }}>
        Tip: pick one of {"Ambuj's"} places as the destination:
      </div>
      <div className="maps-chips" style={{ padding: 0 }}>
        {FAVOURITES.map((p) => (
          <button type="button" key={p.id} onClick={() => setTo(p.query)}>
            {p.name}
          </button>
        ))}
      </div>
    </form>
  );

  const cardBody = (
    <>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="maps-row-title" style={{ fontSize: 14 }}>
          {title}
        </div>
        <div className="maps-row-sub">{sub}</div>
      </div>
      {KEY && view.kind !== "directions" && (
        <button
          type="button"
          className="maps-card-btn primary"
          onClick={() => {
            directionsTo(view.kind === "place" ? view.place.query : view.query);
            setSheetOpen(true);
          }}
        >
          Directions
        </button>
      )}
      <a className="maps-card-btn" href={openInGoogle(view)} target="_blank" rel="noreferrer" title="Open in Google Maps" aria-label="Open in Google Maps">
        <span className="i-ph:arrow-square-out-bold" style={{ width: 14, height: 14 }} />
      </a>
    </>
  );

  const map = (
    <div style={{ flex: 1, position: "relative", minHeight: 0, background: "#e8e8e0" }}>
      <iframe
        key={src}
        title={`Map: ${title}`}
        src={src}
        onLoad={() => setLoading(false)}
        style={{ width: "100%", height: "100%", border: 0 }}
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
      {loading && (
        <div className="maps-loading">
          <span className="i-ph:spinner-gap" /> Loading map…
        </div>
      )}
      {KEY && (
        <div className={`maps-seg ${narrow ? "narrow" : ""}`} role="radiogroup" aria-label="Map type">
          {(["roadmap", "satellite"] as const).map((t) => (
            <button type="button" role="radio" aria-checked={mapType === t} key={t} className={mapType === t ? "on" : ""} onClick={() => setMapType(t)}>
              {t === "roadmap" ? "Map" : "Satellite"}
            </button>
          ))}
        </div>
      )}
      {!narrow && <div className="maps-card">{cardBody}</div>}
    </div>
  );

  if (narrow) {
    // Phone / narrow window: full-screen map with an iOS-style bottom sheet.
    return (
      <div ref={rootRef} className="app-theme maps-app" style={{ position: "relative" }}>
        {map}
        {sheetOpen && <div className="maps-sheet-scrim" onClick={() => setSheetOpen(false)} />}
        <div className={`maps-sheet ${sheetOpen ? "open" : ""}`}>
          <button type="button" className="maps-grabber" aria-label={sheetOpen ? "Collapse" : "Expand"} onClick={() => setSheetOpen((o) => !o)}>
            <span />
          </button>
          {sheetOpen ? (
            <div className="maps-sheet-body">{panel === "browse" ? browse : directions}</div>
          ) : (
            <>
              <div
                className="maps-sheet-peek"
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSheetOpen(true);
                  setPanel("browse");
                  setTimeout(() => searchRef.current?.focus(), 50);
                }}
              >
                <span className="i-ph:magnifying-glass" style={{ width: 14, height: 14, color: "var(--a-text-2)" }} />
                <span>Search Maps</span>
              </div>
              <div className="maps-card flat">{cardBody}</div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="app-theme maps-app">
      <aside className="maps-side">{panel === "browse" ? browse : directions}</aside>
      {map}
    </div>
  );
}
