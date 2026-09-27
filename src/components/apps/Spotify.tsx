import { motion } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import { useCurrentTrack, useMusicStore, type Track } from "~/stores/music";
import { playlistSongs, searchSongs, TRENDING_PLAYLIST } from "~/utils/saavn";

// Spotify-style music player. Catalogue and full-length streams come from
// JioSaavn (see utils/saavn); playback is a shared <audio> in stores/music.

const GREEN = "#1DB954";
const C = {
  bg: "#121212",
  panel: "#181818",
  raised: "#282828",
  hover: "#2a2a2a",
  text: "#ffffff",
  sub: "#b3b3b3"
};

// Quick searches on Home / empty Search.
const BROWSE: { label: string; query: string; color: string }[] = [
  { label: "Arijit Singh", query: "arijit singh", color: "#8d67ab" },
  { label: "Bollywood Romance", query: "bollywood romantic", color: "#e8115b" },
  { label: "Punjabi Hits", query: "punjabi hits", color: "#e1118c" },
  { label: "Lo-fi Chill", query: "lofi", color: "#503750" },
  { label: "90s Hindi", query: "90s hindi", color: "#ba5d07" },
  { label: "English Pop", query: "english pop hits", color: "#1e3264" },
  { label: "Workout", query: "workout", color: "#777777" },
  { label: "Sufi", query: "sufi", color: "#148a08" }
];

const fmt = (s: number) => {
  if (!s || !isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

// ── Building blocks ──────────────────────────────────────────────────────────
const Heart = ({ track, size = 16 }: { track: Track; size?: number }) => {
  const liked = useMusicStore((s) => s.liked.some((l) => l.id === track.id));
  const toggleLike = useMusicStore((s) => s.toggleLike);
  return (
    <button
      aria-label={liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
      onClick={(e) => {
        e.stopPropagation();
        toggleLike(track);
      }}
      className="flex-center"
      style={{ color: liked ? GREEN : C.sub, flexShrink: 0 }}
    >
      <span className={liked ? "i-ph:heart-fill" : "i-ph:heart"} style={{ width: size, height: size }} />
    </button>
  );
};

// Animated bars next to the song that's playing.
const Equalizer = () => (
  <span className="flex items-end" style={{ gap: 2, height: 12, width: 14 }} aria-label="Playing">
    {[0, 0.2, 0.4].map((d) => (
      <motion.span
        key={d}
        animate={{ height: [3, 12, 5, 10, 3] }}
        transition={{ repeat: Infinity, duration: 1, delay: d }}
        style={{ width: 3, background: GREEN, borderRadius: 1 }}
      />
    ))}
  </span>
);

function TrackRow({ tracks, i, compact }: { tracks: Track[]; i: number; compact: boolean }) {
  const t = tracks[i];
  const active = useMusicStore((s) => s.queue[s.index]?.id === t.id);
  const playing = useMusicStore((s) => s.playing);
  const playQueue = useMusicStore((s) => s.playQueue);
  const toggle = useMusicStore((s) => s.toggle);
  return (
    <div
      onClick={() => (active ? toggle() : playQueue(tracks, i))}
      style={{
        display: "grid",
        gridTemplateColumns: compact ? "44px 1fr auto" : "28px 44px 1fr auto auto",
        alignItems: "center",
        gap: 12,
        padding: "6px 10px",
        borderRadius: 6,
        cursor: "default"
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = C.hover)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {!compact && (
        <span className="flex justify-end" style={{ fontSize: 13, color: active ? GREEN : C.sub }}>
          {active && playing ? <Equalizer /> : i + 1}
        </span>
      )}
      <img src={t.thumbnail} alt="" loading="lazy" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 4 }} />
      <div style={{ minWidth: 0 }}>
        <div className="truncate" style={{ fontSize: 14, color: active ? GREEN : C.text }}>
          {t.title}
        </div>
        <div className="truncate" style={{ fontSize: 12.5, color: C.sub }}>
          {t.artist}
        </div>
      </div>
      <Heart track={t} />
      {!compact && <span style={{ fontSize: 13, color: C.sub, width: 40, textAlign: "right" }}>{fmt(t.duration ?? 0)}</span>}
    </div>
  );
}

function TrackCard({ tracks, i }: { tracks: Track[]; i: number }) {
  const t = tracks[i];
  const playQueue = useMusicStore((s) => s.playQueue);
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={() => playQueue(tracks, i)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ background: hover ? C.raised : C.panel, borderRadius: 8, padding: 12, transition: "background 0.2s", cursor: "default", minWidth: 0 }}
    >
      <div style={{ position: "relative" }}>
        <img
          src={t.cover}
          alt=""
          loading="lazy"
          style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
        />
        <motion.div
          animate={{ opacity: hover ? 1 : 0, y: hover ? 0 : 8 }}
          className="flex-center"
          style={{ position: "absolute", right: 8, bottom: 8, width: 44, height: 44, borderRadius: "50%", background: GREEN, boxShadow: "0 8px 16px rgba(0,0,0,0.4)" }}
        >
          <span className="i-ph:play-fill" style={{ width: 20, height: 20, color: "#000" }} />
        </motion.div>
      </div>
      <div className="line-clamp-2" style={{ fontSize: 14, fontWeight: 600, color: C.text, marginTop: 10, lineHeight: 1.3 }}>
        {t.title}
      </div>
      <div className="truncate" style={{ fontSize: 12.5, color: C.sub, marginTop: 4 }}>
        {t.artist}
      </div>
    </div>
  );
}

const Heading = ({ children }: { children: React.ReactNode }) => (
  <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: "8px 0 14px", letterSpacing: "-0.02em" }}>{children}</h2>
);

const Muted = ({ children }: { children: React.ReactNode }) => <div style={{ color: C.sub, fontSize: 14, lineHeight: 1.6, padding: "4px 2px" }}>{children}</div>;

// ── Data ─────────────────────────────────────────────────────────────────────
type Load = { state: "idle" | "loading" | "ok" | "error"; tracks: Track[]; message?: string };

function useLoad(fn: (() => Promise<Track[]>) | null, deps: unknown[]): Load {
  const [load, setLoad] = useState<Load>({ state: "idle", tracks: [] });
  useEffect(() => {
    if (!fn) {
      setLoad({ state: "idle", tracks: [] });
      return;
    }
    let live = true;
    setLoad((l) => ({ ...l, state: "loading" }));
    fn()
      .then((tracks) => live && setLoad({ state: "ok", tracks }))
      .catch((e) => live && setLoad({ state: "error", tracks: [], message: e.message }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return load;
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// ── App ──────────────────────────────────────────────────────────────────────
let mountedWindows = 0;

type View = "home" | "search" | "liked" | "recent";

export default function Spotify() {
  // Measure ourselves: works in desktop windows and full-screen on phones.
  const [rootRef, measured] = useElementWidth();
  const width = measured || 1000;
  const [view, setView] = useState<View>("home");
  const [query, setQuery] = useState("");
  const q = useDebounced(query.trim(), 350);
  const results = useLoad(q ? () => searchSongs(q) : null, [q]);
  const trending = useLoad(() => playlistSongs(TRENDING_PLAYLIST), []);
  const { liked, recent } = useMusicStore(useShallow((s) => ({ liked: s.liked, recent: s.recent })));
  const current = useCurrentTrack();
  const scrollRef = useRef<HTMLDivElement>(null);

  const compact = width < 760;
  const showPanel = !!current && width >= 1000;

  // Quitting Spotify stops the music, like the real app.
  // Deferred so a remount (React StrictMode, or Siri opening the window while
  // a song starts) doesn't cut the music off.
  useEffect(() => {
    mountedWindows++;
    return () => {
      mountedWindows--;
      setTimeout(() => mountedWindows === 0 && useMusicStore.getState().stop(), 0);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [view]);

  const browse = (query: string) => {
    setQuery(query);
    setView("search");
  };

  const grid = { display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? 130 : 160}px, 1fr))`, gap: 14 } as const;

  const NavItem = ({ id, icon, label }: { id: View; icon: string; label: string }) => (
    <button
      onClick={() => setView(id)}
      className="flex items-center"
      style={{ gap: 14, padding: "8px 12px", fontSize: 14, fontWeight: 700, color: view === id ? C.text : C.sub, width: "100%", borderRadius: 6 }}
    >
      <span className={icon} style={{ width: 22, height: 22 }} />
      {label}
    </button>
  );

  const LibraryItem = ({ id, icon, bg, title, count }: { id: View; icon: string; bg: string; title: string; count: number }) => (
    <button
      onClick={() => setView(id)}
      className="flex items-center"
      style={{ gap: 10, padding: 8, width: "100%", borderRadius: 6, textAlign: "left", background: view === id ? C.raised : "transparent" }}
    >
      <div className="flex-center" style={{ width: 44, height: 44, borderRadius: 4, background: bg, flexShrink: 0 }}>
        <span className={icon} style={{ width: 18, height: 18 }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, color: C.text }}>{title}</div>
        <div style={{ fontSize: 12, color: C.sub }}>Playlist · {count} songs</div>
      </div>
    </button>
  );

  const chips = (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? 140 : 170}px, 1fr))`, gap: 10 }}>
      {BROWSE.map((b) => (
        <button
          key={b.label}
          onClick={() => browse(b.query)}
          style={{ background: b.color, borderRadius: 8, padding: "18px 14px", fontSize: 15, fontWeight: 700, color: "#fff", textAlign: "left" }}
        >
          {b.label}
        </button>
      ))}
    </div>
  );

  const home = (
    <>
      <div style={{ fontSize: compact ? 24 : 30, fontWeight: 800, color: C.text, margin: "4px 0 18px", letterSpacing: "-0.03em" }}>
        {(() => {
          const h = new Date().getHours();
          return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
        })()}
      </div>
      {recent.length > 0 && (
        <>
          <Heading>Recently played</Heading>
          <div style={{ ...grid, marginBottom: 24 }}>
            {recent.slice(0, compact ? 4 : 6).map((_, i) => (
              <TrackCard key={recent[i].id} tracks={recent} i={i} />
            ))}
          </div>
        </>
      )}
      <Heading>Trending Today</Heading>
      {trending.state === "loading" && <Muted>Loading…</Muted>}
      {trending.state === "error" && <Muted>{trending.message}</Muted>}
      <div style={{ ...grid, marginBottom: 24 }}>
        {trending.tracks.slice(0, compact ? 8 : 12).map((t, i) => (
          <TrackCard key={t.id} tracks={trending.tracks} i={i} />
        ))}
      </div>
      <Heading>Browse</Heading>
      {chips}
    </>
  );

  const searchView = (
    <>
      <form
        onSubmit={(e) => e.preventDefault()}
        style={{ position: "sticky", top: compact ? -14 : -18, zIndex: 2, background: C.bg, padding: "4px 0 14px" }}
      >
        <div className="flex items-center" style={{ gap: 10, background: C.raised, borderRadius: 999, padding: "10px 16px", maxWidth: 480 }}>
          <span className="i-ph:magnifying-glass" style={{ width: 18, height: 18, color: C.sub }} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What do you want to play?"
            aria-label="Search songs"
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.text, fontSize: 14 }}
          />
          {query && (
            <button aria-label="Clear search" onClick={() => setQuery("")} className="flex-center" style={{ color: C.sub }}>
              <span className="i-ph:x-bold" style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>
      </form>
      {!q ? (
        <>
          <Heading>Browse all</Heading>
          {chips}
        </>
      ) : (
        <>
          {results.state === "loading" && results.tracks.length === 0 && <Muted>Searching…</Muted>}
          {results.state === "error" && <Muted>{results.message}</Muted>}
          {results.state === "ok" && results.tracks.length === 0 && <Muted>No songs found for “{q}”.</Muted>}
          {results.tracks.map((t, i) => (
            <TrackRow key={t.id} tracks={results.tracks} i={i} compact={compact} />
          ))}
        </>
      )}
    </>
  );

  const playlistView = (title: string, tracks: Track[], bg: string, icon: string, empty: string) => (
    <>
      <div className="flex items-end" style={{ gap: 18, marginBottom: 20 }}>
        <div className="flex-center" style={{ width: compact ? 96 : 140, height: compact ? 96 : 140, borderRadius: 6, background: bg, flexShrink: 0 }}>
          <span className={icon} style={{ width: 48, height: 48, color: "#fff" }} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: C.text }}>Playlist</div>
          <div style={{ fontSize: compact ? 26 : 40, fontWeight: 800, color: C.text, letterSpacing: "-0.03em" }}>{title}</div>
          <div style={{ fontSize: 13, color: C.sub }}>{tracks.length} songs · saved in this browser</div>
        </div>
      </div>
      {tracks.length > 0 && (
        <button
          aria-label={`Play ${title}`}
          onClick={() => useMusicStore.getState().playQueue(tracks, 0)}
          className="flex-center"
          style={{ width: 52, height: 52, borderRadius: "50%", background: GREEN, marginBottom: 16 }}
        >
          <span className="i-ph:play-fill" style={{ width: 22, height: 22, color: "#000" }} />
        </button>
      )}
      {tracks.length === 0 && <Muted>{empty}</Muted>}
      {tracks.map((t, i) => (
        <TrackRow key={t.id} tracks={tracks} i={i} compact={compact} />
      ))}
    </>
  );

  const LIKED_BG = "linear-gradient(135deg,#450af5,#8e8ee5)";
  const RECENT_BG = "linear-gradient(135deg,#1e3264,#1DB954)";

  return (
    <div ref={rootRef} style={{ height: "100%", display: "flex", flexDirection: "column", background: "#000", color: C.text, fontFamily: "var(--font-system)" }}>
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 8, padding: 8 }}>
        {/* Sidebar */}
        {!compact && (
          <div style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ background: C.bg, borderRadius: 8, padding: 8 }}>
              <NavItem id="home" icon={view === "home" ? "i-ph:house-fill" : "i-ph:house"} label="Home" />
              <NavItem id="search" icon="i-ph:magnifying-glass-bold" label="Search" />
            </div>
            <div style={{ background: C.bg, borderRadius: 8, padding: 8, flex: 1, overflowY: "auto" }}>
              <div className="flex items-center" style={{ gap: 14, padding: "8px 12px", fontSize: 14, fontWeight: 700, color: C.sub }}>
                <span className="i-ph:books" style={{ width: 22, height: 22 }} />
                Your Library
              </div>
              <LibraryItem id="liked" icon="i-ph:heart-fill" bg={LIKED_BG} title="Liked Songs" count={liked.length} />
              <LibraryItem id="recent" icon="i-ph:clock-counter-clockwise-bold" bg={RECENT_BG} title="Recently Played" count={recent.length} />
            </div>
          </div>
        )}

        {/* Main */}
        <div
          ref={scrollRef}
          style={{ flex: 1, minWidth: 0, background: C.bg, borderRadius: 8, overflowY: "auto", padding: compact ? "14px 14px 20px" : "18px 22px 24px", position: "relative" }}
        >
          {compact && (
            <div className="flex" style={{ gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              {(["home", "search", "liked", "recent"] as View[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{ padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, background: view === v ? GREEN : C.raised, color: view === v ? "#000" : C.text }}
                >
                  {{ home: "Home", search: "Search", liked: "Liked", recent: "Recent" }[v]}
                </button>
              ))}
            </div>
          )}
          {view === "home"
            ? home
            : view === "search"
              ? searchView
              : view === "liked"
                ? playlistView("Liked Songs", liked, LIKED_BG, "i-ph:heart-fill", "Tap the heart on any song to save it here.")
                : playlistView("Recently Played", recent, RECENT_BG, "i-ph:clock-counter-clockwise-bold", "Songs you play will show up here.")}
        </div>

        {/* Now playing panel */}
        {showPanel && <NowPlaying track={current!} />}
      </div>

      <PlayerBar compact={compact} />
    </div>
  );
}

function NowPlaying({ track }: { track: Track }) {
  const error = useMusicStore((s) => s.error);
  const { queue, index } = useMusicStore(useShallow((s) => ({ queue: s.queue, index: s.index })));
  const upNext = queue.slice(index + 1, index + 6);
  const playQueue = useMusicStore((s) => s.playQueue);
  return (
    <div style={{ width: 300, flexShrink: 0, background: C.bg, borderRadius: 8, padding: 14, overflowY: "auto" }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Now Playing</div>
      <motion.img
        key={track.id}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        src={track.cover}
        alt=""
        style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
      />
      <div className="flex items-start justify-between" style={{ marginTop: 14, gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div className="line-clamp-2" style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.25 }}>
            {track.title}
          </div>
          <div className="truncate" style={{ fontSize: 14, color: C.sub, marginTop: 4 }}>
            {track.artist}
          </div>
        </div>
        <div style={{ paddingTop: 4 }}>
          <Heart track={track} size={20} />
        </div>
      </div>
      {error && <div style={{ fontSize: 12, color: "#f15e6c", marginTop: 10 }}>{error}</div>}
      {upNext.length > 0 && (
        <div style={{ marginTop: 18, background: C.panel, borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Next in queue</div>
          {upNext.map((t, i) => (
            <button
              key={t.id}
              onClick={() => playQueue(queue, index + 1 + i)}
              className="flex items-center"
              style={{ gap: 10, padding: "5px 0", width: "100%", textAlign: "left" }}
            >
              <img src={t.thumbnail} alt="" loading="lazy" style={{ width: 36, height: 36, borderRadius: 4, objectFit: "cover" }} />
              <div style={{ minWidth: 0 }}>
                <div className="truncate" style={{ fontSize: 13, color: C.text }}>
                  {t.title}
                </div>
                <div className="truncate" style={{ fontSize: 11.5, color: C.sub }}>
                  {t.artist}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PlayerBar({ compact }: { compact: boolean }) {
  const current = useCurrentTrack();
  const s = useMusicStore(
    useShallow((s) => ({
      playing: s.playing,
      position: s.position,
      duration: s.duration,
      volume: s.volume,
      shuffle: s.shuffle,
      repeat: s.repeat,
      toggle: s.toggle,
      next: s.next,
      prev: s.prev,
      seek: s.seek,
      setVolume: s.setVolume,
      toggleShuffle: s.toggleShuffle,
      toggleRepeat: s.toggleRepeat,
      hasNext: s.index + 1 < s.queue.length || s.repeat || s.shuffle
    }))
  );
  const lastVolume = useRef(70);

  const range = (value: number, max: number): React.CSSProperties => ({
    accentColor: GREEN,
    height: 4,
    cursor: "pointer",
    background: `linear-gradient(to right, #fff ${(value / Math.max(max, 1)) * 100}%, #4d4d4d 0)`
  });

  const Toggle = ({ on, icon, label, onClick }: { on: boolean; icon: string; label: string; onClick: () => void }) => (
    <button aria-label={label} aria-pressed={on} onClick={onClick} className="flex flex-col items-center" style={{ color: on ? GREEN : C.sub }}>
      <span className={icon} style={{ width: 17, height: 17 }} />
    </button>
  );

  return (
    <div
      style={{
        height: compact ? 96 : 80,
        flexShrink: 0,
        display: "flex",
        flexDirection: compact ? "column" : "row",
        alignItems: compact ? "stretch" : "center",
        justifyContent: "center",
        gap: compact ? 6 : 12,
        padding: compact ? "0 14px 16px" : "0 14px",
        background: "#000"
      }}
    >
      {compact && current && (
        // Thin progress line on phones.
        <div style={{ height: 3, background: "#4d4d4d", borderRadius: 2 }}>
          <div style={{ height: "100%", width: `${(s.position / Math.max(s.duration, 1)) * 100}%`, background: "#fff", borderRadius: 2 }} />
        </div>
      )}
      <div className="flex items-center" style={{ gap: 12, flex: compact ? undefined : "0 0 30%", minWidth: 0 }}>
        <div className="flex items-center" style={{ gap: 10, minWidth: 0, flex: 1 }}>
          {current ? (
            <>
              <img src={current.thumbnail} alt="" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 4 }} />
              <div style={{ minWidth: 0 }}>
                <div className="truncate" style={{ fontSize: 13.5 }}>
                  {current.title}
                </div>
                <div className="truncate" style={{ fontSize: 12, color: C.sub }}>
                  {current.artist}
                </div>
              </div>
              <Heart track={current} />
            </>
          ) : (
            <div style={{ fontSize: 13, color: C.sub }}>Pick a song to start playing</div>
          )}
        </div>
        {compact && (
          <button
            aria-label={s.playing ? "Pause" : "Play"}
            onClick={() => s.toggle()}
            disabled={!current}
            className="flex-center"
            style={{ width: 38, height: 38, borderRadius: "50%", background: current ? "#fff" : "#555", flexShrink: 0 }}
          >
            <span className={s.playing ? "i-ph:pause-fill" : "i-ph:play-fill"} style={{ width: 18, height: 18, color: "#000" }} />
          </button>
        )}
      </div>

      {!compact && (
        <div className="flex flex-col items-center" style={{ flex: 1, gap: 6 }}>
          <div className="flex items-center" style={{ gap: 20 }}>
            <Toggle on={s.shuffle} icon="i-ph:shuffle-bold" label="Shuffle" onClick={s.toggleShuffle} />
            <button aria-label="Previous" onClick={s.prev} disabled={!current} style={{ color: C.sub }}>
              <span className="i-ph:skip-back-fill" style={{ width: 18, height: 18 }} />
            </button>
            <button
              aria-label={s.playing ? "Pause" : "Play"}
              onClick={() => s.toggle()}
              disabled={!current}
              className="flex-center"
              style={{ width: 34, height: 34, borderRadius: "50%", background: current ? "#fff" : "#555" }}
            >
              <span className={s.playing ? "i-ph:pause-fill" : "i-ph:play-fill"} style={{ width: 16, height: 16, color: "#000" }} />
            </button>
            <button aria-label="Next" onClick={s.next} disabled={!current || !s.hasNext} style={{ color: C.sub }}>
              <span className="i-ph:skip-forward-fill" style={{ width: 18, height: 18 }} />
            </button>
            <Toggle on={s.repeat} icon="i-ph:repeat-bold" label="Repeat" onClick={s.toggleRepeat} />
          </div>
          <div className="flex items-center" style={{ gap: 8, width: "100%", maxWidth: 560 }}>
            <span style={{ fontSize: 11, color: C.sub, width: 36, textAlign: "right" }}>{fmt(s.position)}</span>
            <input
              type="range"
              className="spotify-range"
              aria-label="Seek"
              min={0}
              max={Math.max(s.duration, 1)}
              step={1}
              value={Math.min(s.position, s.duration)}
              onChange={(e) => s.seek(+e.target.value)}
              disabled={!current}
              style={{ ...range(s.position, s.duration), flex: 1 }}
            />
            <span style={{ fontSize: 11, color: C.sub, width: 36 }}>{fmt(s.duration)}</span>
          </div>
        </div>
      )}

      {!compact && (
        <div className="flex items-center justify-end" style={{ gap: 8, flex: "0 0 30%" }}>
          <button
            aria-label={s.volume === 0 ? "Unmute" : "Mute"}
            onClick={() => {
              if (s.volume > 0) {
                lastVolume.current = s.volume;
                s.setVolume(0);
              } else s.setVolume(lastVolume.current || 70);
            }}
            style={{ color: C.sub }}
            className="flex-center"
          >
            <span className={s.volume === 0 ? "i-ph:speaker-x" : s.volume < 50 ? "i-ph:speaker-low" : "i-ph:speaker-high"} style={{ width: 18, height: 18 }} />
          </button>
          <input
            type="range"
            className="spotify-range"
            aria-label="Volume"
            min={0}
            max={100}
            value={s.volume}
            onChange={(e) => s.setVolume(+e.target.value)}
            style={{ ...range(s.volume, 100), width: 110 }}
          />
        </div>
      )}
    </div>
  );
}
