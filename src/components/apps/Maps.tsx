import { motion } from "framer-motion";

interface Place {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  zoom: number;
  color: string;
  /** Query used for "Directions" in Google Maps. */
  query: string;
}

// IIIT Kota's campus isn't in OpenStreetMap yet, so it's shown at city level.
const FAVOURITES: Place[] = [
  { id: "iiit", name: "IIIT Kota", type: "University · Kota, Rajasthan", lat: 25.1737, lng: 75.8574, zoom: 12, color: "#007AFF", query: "IIIT Kota" },
  { id: "kota", name: "Kota, Rajasthan", type: "City", lat: 25.1737, lng: 75.8574, zoom: 11, color: "#FF9500", query: "Kota, Rajasthan" },
  { id: "school", name: "Jagat Taran Golden Jubilee School", type: "School · Prayagraj", lat: 25.454, lng: 81.859, zoom: 16, color: "#34C759", query: "Jagat Taran Golden Jubilee School, Prayagraj" },
  { id: "prayagraj", name: "Prayagraj, Uttar Pradesh", type: "City", lat: 25.4381, lng: 81.8338, zoom: 11, color: "#AF52DE", query: "Prayagraj" }
];

// Degrees of longitude visible at a given zoom in a ~700px wide map.
const spanFor = (zoom: number) => (360 / Math.pow(2, zoom)) * 2.5;

const embedUrl = (p: Place) => {
  const dLng = spanFor(p.zoom);
  const dLat = dLng * 0.6;
  const bbox = [p.lng - dLng / 2, p.lat - dLat / 2, p.lng + dLng / 2, p.lat + dLat / 2].map((n) => n.toFixed(5)).join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${p.lat},${p.lng}`;
};

export default function Maps() {
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Place>(FAVOURITES[0]);
  const [results, setResults] = useState<Place[]>([]);
  const [status, setStatus] = useState<"" | "searching" | "none">("");

  const shown = search.trim()
    ? FAVOURITES.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : FAVOURITES;

  // Free geocoding via OpenStreetMap Nominatim (no key; ~1 request/sec).
  const geocode = async () => {
    const q = search.trim();
    if (!q) return;
    setStatus("searching");
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`);
      const data: { lat: string; lon: string; display_name: string }[] = await res.json();
      const found = data.map((r, i) => ({
        id: `r${i}-${r.lat}`,
        name: r.display_name.split(",")[0],
        type: r.display_name.split(",").slice(1, 3).join(",").trim(),
        lat: +r.lat,
        lng: +r.lon,
        zoom: 14,
        color: "#FF3B30",
        query: r.display_name
      }));
      setResults(found);
      setStatus(found.length ? "" : "none");
      if (found[0]) setActive(found[0]);
    } catch {
      setStatus("none");
    }
  };

  const zoom = (d: number) => setActive((p) => ({ ...p, zoom: Math.min(18, Math.max(3, p.zoom + d)) }));

  const Row = ({ place }: { place: Place }) => {
    const selected = active.id === place.id;
    return (
      <button
        onClick={() => setActive(place)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 10px",
          margin: "1px 6px",
          width: "calc(100% - 12px)",
          borderRadius: 8,
          background: selected ? "rgba(0,122,255,0.12)" : "transparent",
          textAlign: "left"
        }}
      >
        <div className="flex-center" style={{ width: 28, height: 28, borderRadius: "50%", background: place.color, flexShrink: 0 }}>
          <span className="i-ph:map-pin-fill" style={{ width: 14, height: 14, color: "white" }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="truncate" style={{ fontSize: 13, fontWeight: selected ? 600 : 400, color: selected ? "#007AFF" : "var(--a-text)" }}>
            {place.name}
          </div>
          <div className="truncate" style={{ fontSize: 11, color: "var(--a-text-2)" }}>
            {place.type}
          </div>
        </div>
      </button>
    );
  };

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--a-text-3)", textTransform: "uppercase", letterSpacing: "0.5px", padding: "8px 14px 4px" }}>
      {children}
    </div>
  );

  return (
    <div className="app-theme" style={{ display: "flex", height: "100%", background: "var(--a-bg)", overflow: "hidden" }}>
      {/* Sidebar */}
      <div
        style={{
          width: 230,
          flexShrink: 0,
          background: "var(--a-bg-side)",
          borderRight: "0.5px solid var(--a-border)",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto"
        }}
      >
        <form
          style={{ padding: 10 }}
          onSubmit={(e) => {
            e.preventDefault();
            geocode();
          }}
        >
          <div className="flex items-center" style={{ gap: 6, background: "var(--a-fill)", borderRadius: 10, padding: "7px 10px" }}>
            <span className="i-ph:magnifying-glass" style={{ width: 12, height: 12, color: "var(--a-text-2)" }} />
            <input
              placeholder="Search Maps"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setStatus("");
              }}
              style={{ background: "none", border: "none", outline: "none", fontSize: 13, width: "100%", color: "var(--a-text)" }}
            />
          </div>
          {search.trim() && (
            <div style={{ fontSize: 11, color: "var(--a-text-2)", padding: "6px 4px 0" }}>
              {status === "searching" ? "Searching…" : status === "none" ? "No places found." : "Press Enter to search the world"}
            </div>
          )}
        </form>

        {results.length > 0 && (
          <>
            <SectionLabel>Results</SectionLabel>
            {results.map((p) => (
              <Row key={p.id} place={p} />
            ))}
          </>
        )}
        <SectionLabel>Favourites</SectionLabel>
        {shown.map((p) => (
          <Row key={p.id} place={p} />
        ))}
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: "relative", background: "#e8e8e0" }}>
        <iframe
          key={`${active.id}-${active.zoom}`}
          title={`Map of ${active.name}`}
          src={embedUrl(active)}
          style={{ width: "100%", height: "100%", border: 0 }}
          loading="lazy"
        />

        <div style={{ position: "absolute", right: 12, top: 12, display: "flex", flexDirection: "column", gap: 4 }}>
          {(
            [
              ["i-ph:plus-bold", 1],
              ["i-ph:minus-bold", -1]
            ] as const
          ).map(([icon, d]) => (
            <button
              key={icon}
              onClick={() => zoom(d)}
              className="flex-center"
              style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.92)", boxShadow: "0 2px 8px rgba(0,0,0,0.18)", color: "#1c1c1e" }}
            >
              <span className={icon} style={{ width: 13, height: 13 }} />
            </button>
          ))}
        </div>

        <motion.div
          key={active.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 14,
            maxWidth: 420,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 14px",
            borderRadius: 14,
            background: "var(--a-bg)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.2)"
          }}
        >
          <div className="flex-center" style={{ width: 36, height: 36, borderRadius: "50%", background: active.color, flexShrink: 0 }}>
            <span className="i-ph:map-pin-fill" style={{ width: 18, height: 18, color: "white" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="truncate" style={{ fontSize: 14, fontWeight: 600, color: "var(--a-text)" }}>
              {active.name}
            </div>
            <div className="truncate" style={{ fontSize: 11, color: "var(--a-text-2)" }}>
              {active.type}
            </div>
          </div>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(active.query)}`}
            target="_blank"
            rel="noreferrer"
            style={{ background: "#007AFF", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "white", flexShrink: 0 }}
          >
            Directions
          </a>
        </motion.div>
      </div>
    </div>
  );
}
