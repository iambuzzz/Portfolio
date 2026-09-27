import { motion } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import { registerPlayer, useCurrentTrack, useMusicStore, type Track } from "~/stores/music";

// Spotify-style music app. Search and charts come from YouTube via our API
// proxy (api/music/search); playback uses the official YouTube IFrame player,
// shown visibly in the "Now Playing" panel as YouTube's terms require.

const GREEN = "#1DB954";
const C = {
  bg: "#121212",
  panel: "#181818",
  raised: "#282828",
  hover: "#2a2a2a",
  text: "#ffffff",
  sub: "#b3b3b3"
};

const fmt = (s: number) => {
  if (!s || !isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

// ── YouTube IFrame API ───────────────────────────────────────────────────────
let apiPromise: Promise<any> | null = null;
const loadYouTubeApi = () =>
  (apiPromise ??= new Promise((resolve) => {
    const w = window as any;
    if (w.YT?.Player) return resolve(w.YT);
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(w.YT);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  }));

const PASTED_TITLE = "YouTube video";

// Accepts a YouTube URL or a bare 11-char id.
const parseYouTubeId = (input: string) => {
  const m = input.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/)([\w-]{11})/) ?? input.trim().match(/^([\w-]{11})$/);
  return m?.[1] ?? null;
};

function NowPlayingVideo() {
  const track = useCurrentTrack();
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [error, setError] = useState("");

  // Create the player once.
  useEffect(() => {
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | undefined;
    loadYouTubeApi().then((YT) => {
      if (cancelled || !hostRef.current) return;
      const store = useMusicStore.getState();
      const current = store.queue[store.index];
      playerRef.current = new YT.Player(hostRef.current, {
        width: "100%",
        height: "100%",
        videoId: current?.id,
        playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: (e: any) => {
            e.target.setVolume(useMusicStore.getState().volume);
            registerPlayer(e.target);
            if (useMusicStore.getState().playing) e.target.playVideo();
          },
          onStateChange: (e: any) => {
            const { report, next } = useMusicStore.getState();
            if (e.data === YT.PlayerState.PLAYING) {
              setError("");
              report({ playing: true, duration: e.target.getDuration() });
              // Pasted links start with placeholder details; use the real ones.
              const cur = useMusicStore.getState().queue[useMusicStore.getState().index];
              const info = e.target.getVideoData?.();
              if (cur && info?.title && cur.title === PASTED_TITLE) {
                useMusicStore.getState().describeCurrent({ title: info.title, channel: info.author || "YouTube" });
              }
              clearInterval(poll);
              poll = setInterval(() => report({ position: e.target.getCurrentTime() }), 500);
            } else if (e.data === YT.PlayerState.PAUSED) {
              report({ playing: false });
              clearInterval(poll);
            } else if (e.data === YT.PlayerState.ENDED) {
              clearInterval(poll);
              next();
            }
          },
          onError: () => {
            setError("This video can't be played here — skipping.");
            setTimeout(() => useMusicStore.getState().next(), 1200);
          }
        }
      });
    });
    return () => {
      cancelled = true;
      clearInterval(poll);
      registerPlayer(null);
      useMusicStore.getState().stop();
      try {
        playerRef.current?.destroy();
      } catch {
        // player may not have finished initialising
      }
    };
  }, []);

  // Load the new video whenever the current track changes.
  useEffect(() => {
    const p = playerRef.current;
    if (track && p?.loadVideoById) p.loadVideoById(track.id);
  }, [track?.id]);

  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", minHeight: 200, background: "#000", borderRadius: 10, overflow: "hidden" }}>
      <div ref={hostRef} style={{ width: "100%", height: "100%" }} />
      {error && (
        <div style={{ position: "absolute", inset: "auto 0 0 0", padding: 8, fontSize: 12, background: "rgba(0,0,0,0.75)", color: C.sub }}>{error}</div>
      )}
    </div>
  );
}

// ── Building blocks ──────────────────────────────────────────────────────────
const Heart = ({ track }: { track: Track }) => {
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
      <span className={liked ? "i-ph:heart-fill" : "i-ph:heart"} style={{ width: 16, height: 16 }} />
    </button>
  );
};

function TrackRow({ tracks, i }: { tracks: Track[]; i: number }) {
  const t = tracks[i];
  const current = useCurrentTrack();
  const playQueue = useMusicStore((s) => s.playQueue);
  const active = current?.id === t.id;
  return (
    <div
      onClick={() => playQueue(tracks, i)}
      className="group"
      style={{ display: "grid", gridTemplateColumns: "28px 44px 1fr auto auto", alignItems: "center", gap: 12, padding: "6px 10px", borderRadius: 6, cursor: "default" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = C.hover)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ fontSize: 13, color: active ? GREEN : C.sub, textAlign: "right" }}>{i + 1}</span>
      <img src={t.thumbnail} alt="" loading="lazy" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 4 }} />
      <div style={{ minWidth: 0 }}>
        <div className="truncate" style={{ fontSize: 14, color: active ? GREEN : C.text }}>
          {t.title}
        </div>
        <div className="truncate" style={{ fontSize: 12.5, color: C.sub }}>
          {t.channel}
        </div>
      </div>
      <Heart track={t} />
      <span style={{ fontSize: 13, color: C.sub, width: 40, textAlign: "right" }}>{t.duration ? fmt(t.duration) : ""}</span>
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
        <img src={t.thumbnail} alt="" loading="lazy" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }} />
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
        {t.channel}
      </div>
    </div>
  );
}

const Heading = ({ children }: { children: React.ReactNode }) => (
  <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: "8px 0 14px", letterSpacing: "-0.02em" }}>{children}</h2>
);

// ── Data ─────────────────────────────────────────────────────────────────────
type Load = { state: "idle" | "loading" | "ok" | "error"; tracks: Track[]; message?: string };

const cache = new Map<string, Track[]>();
async function fetchTracks(q: string): Promise<Track[]> {
  const key = q.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key)!;
  const res = await fetch(`/api/music/search${key ? `?q=${encodeURIComponent(key)}` : ""}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  cache.set(key, data.tracks);
  return data.tracks;
}

function useTrending() {
  const [load, setLoad] = useState<Load>({ state: "loading", tracks: [] });
  useEffect(() => {
    fetchTracks("")
      .then((tracks) => setLoad({ state: "ok", tracks }))
      .catch((e) => setLoad({ state: "error", tracks: [], message: e.message }));
  }, []);
  return load;
}

// ── App ──────────────────────────────────────────────────────────────────────
type View = "home" | "search" | "liked";

export default function Spotify({ width = 1000 }: { width?: number }) {
  const [view, setView] = useState<View>("home");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Load>({ state: "idle", tracks: [] });
  const trending = useTrending();
  const { liked, recent, playQueue } = useMusicStore(useShallow((s) => ({ liked: s.liked, recent: s.recent, playQueue: s.playQueue })));
  const current = useCurrentTrack();

  const compact = width < 760;
  const showPanel = !!current && width >= 1000;

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    const id = parseYouTubeId(q);
    if (id) {
      playQueue([{ id, title: PASTED_TITLE, channel: "YouTube", thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }], 0);
      return;
    }
    setResults({ state: "loading", tracks: [] });
    try {
      setResults({ state: "ok", tracks: await fetchTracks(q) });
    } catch (err) {
      setResults({ state: "error", tracks: [], message: (err as Error).message });
    }
  };

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

  const notConfigured = (msg?: string) => (
    <div style={{ color: C.sub, fontSize: 14, lineHeight: 1.6, padding: "8px 2px" }}>
      {msg?.includes("not configured")
        ? "Music search isn't switched on yet. You can still paste any YouTube link in Search to play it."
        : msg}
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
          <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? 140 : 160}px, 1fr))`, gap: 14, marginBottom: 24 }}>
            {recent.slice(0, compact ? 4 : 6).map((_, i) => (
              <TrackCard key={recent[i].id} tracks={recent} i={i} />
            ))}
          </div>
        </>
      )}
      <Heading>Trending in India</Heading>
      {trending.state === "loading" && <div style={{ color: C.sub, fontSize: 14 }}>Loading…</div>}
      {trending.state === "error" && notConfigured(trending.message)}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? 140 : 160}px, 1fr))`, gap: 14 }}>
        {trending.tracks.map((t, i) => (
          <TrackCard key={t.id} tracks={trending.tracks} i={i} />
        ))}
      </div>
    </>
  );

  const searchView = (
    <>
      <form onSubmit={search} style={{ position: "sticky", top: 0, zIndex: 2, background: C.bg, paddingBottom: 14 }}>
        <div className="flex items-center" style={{ gap: 10, background: C.raised, borderRadius: 999, padding: "10px 16px", maxWidth: 480 }}>
          <span className="i-ph:magnifying-glass" style={{ width: 18, height: 18, color: C.sub }} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What do you want to play?"
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.text, fontSize: 14 }}
          />
        </div>
        <div style={{ fontSize: 12, color: C.sub, marginTop: 8 }}>Press Enter to search · or paste a YouTube link</div>
      </form>
      {results.state === "loading" && <div style={{ color: C.sub, fontSize: 14 }}>Searching…</div>}
      {results.state === "error" && notConfigured(results.message)}
      {results.state === "ok" && results.tracks.length === 0 && <div style={{ color: C.sub, fontSize: 14 }}>No results.</div>}
      {results.tracks.map((_, i) => (
        <TrackRow key={results.tracks[i].id} tracks={results.tracks} i={i} />
      ))}
    </>
  );

  const likedView = (
    <>
      <div className="flex items-end" style={{ gap: 18, marginBottom: 20 }}>
        <div className="flex-center" style={{ width: compact ? 96 : 140, height: compact ? 96 : 140, borderRadius: 6, background: "linear-gradient(135deg,#450af5,#8e8ee5)", flexShrink: 0 }}>
          <span className="i-ph:heart-fill" style={{ width: 48, height: 48, color: "#fff" }} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: C.text }}>Playlist</div>
          <div style={{ fontSize: compact ? 26 : 40, fontWeight: 800, color: C.text, letterSpacing: "-0.03em" }}>Liked Songs</div>
          <div style={{ fontSize: 13, color: C.sub }}>{liked.length} songs · saved in this browser</div>
        </div>
      </div>
      {liked.length === 0 && <div style={{ color: C.sub, fontSize: 14 }}>Tap the heart on any song to save it here.</div>}
      {liked.map((t, i) => (
        <TrackRow key={t.id} tracks={liked} i={i} />
      ))}
    </>
  );

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#000", color: C.text, fontFamily: "var(--font-system)" }}>
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 8, padding: 8 }}>
        {/* Sidebar */}
        {!compact && (
          <div style={{ width: 200, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ background: C.bg, borderRadius: 8, padding: 8 }}>
              <NavItem id="home" icon="i-ph:house-fill" label="Home" />
              <NavItem id="search" icon="i-ph:magnifying-glass-bold" label="Search" />
            </div>
            <div style={{ background: C.bg, borderRadius: 8, padding: 8, flex: 1, overflowY: "auto" }}>
              <NavItem id="liked" icon="i-ph:books" label="Your Library" />
              <button onClick={() => setView("liked")} className="flex items-center" style={{ gap: 10, padding: 8, width: "100%", borderRadius: 6, textAlign: "left" }}>
                <div className="flex-center" style={{ width: 40, height: 40, borderRadius: 4, background: "linear-gradient(135deg,#450af5,#8e8ee5)", flexShrink: 0 }}>
                  <span className="i-ph:heart-fill" style={{ width: 16, height: 16 }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: C.text }}>Liked Songs</div>
                  <div style={{ fontSize: 12, color: C.sub }}>{liked.length} songs</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Main */}
        <div style={{ flex: 1, minWidth: 0, background: C.bg, borderRadius: 8, overflowY: "auto", padding: compact ? "14px 14px 20px" : "18px 22px 24px", position: "relative" }}>
          {compact && (
            <div className="flex" style={{ gap: 8, marginBottom: 14 }}>
              {(["home", "search", "liked"] as View[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{ padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, background: view === v ? GREEN : C.raised, color: view === v ? "#000" : C.text }}
                >
                  {v === "home" ? "Home" : v === "search" ? "Search" : "Liked"}
                </button>
              ))}
            </div>
          )}
          {current && !showPanel && (
            <div style={{ marginBottom: 16, maxWidth: 480 }}>
              <NowPlayingVideo />
            </div>
          )}
          {view === "home" ? home : view === "search" ? searchView : likedView}
        </div>

        {/* Now playing panel */}
        {showPanel && (
          <div style={{ width: 300, flexShrink: 0, background: C.bg, borderRadius: 8, padding: 14, overflowY: "auto" }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Now playing</div>
            <NowPlayingVideo />
            <div className="line-clamp-2" style={{ fontSize: 18, fontWeight: 700, marginTop: 14, lineHeight: 1.3 }}>
              {current!.title}
            </div>
            <div className="flex items-center justify-between" style={{ marginTop: 4, gap: 8 }}>
              <span className="truncate" style={{ fontSize: 13, color: C.sub }}>
                {current!.channel}
              </span>
              <Heart track={current!} />
            </div>
          </div>
        )}
      </div>

      <PlayerBar compact={compact} />
    </div>
  );
}

function PlayerBar({ compact }: { compact: boolean }) {
  const current = useCurrentTrack();
  const { playing, position, duration, volume, toggle, next, prev, seek, setVolume, queue, index } = useMusicStore(
    useShallow((s) => ({
      playing: s.playing,
      position: s.position,
      duration: s.duration,
      volume: s.volume,
      toggle: s.toggle,
      next: s.next,
      prev: s.prev,
      seek: s.seek,
      setVolume: s.setVolume,
      queue: s.queue,
      index: s.index
    }))
  );

  const range: React.CSSProperties = { accentColor: GREEN, height: 4, cursor: "pointer" };

  return (
    <div style={{ height: compact ? 64 : 76, flexShrink: 0, display: "flex", alignItems: "center", gap: 12, padding: "0 14px", background: "#000" }}>
      <div className="flex items-center" style={{ gap: 10, width: compact ? "auto" : "30%", minWidth: 0, flex: compact ? 1 : undefined }}>
        {current ? (
          <>
            <img src={current.thumbnail} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 4 }} />
            <div style={{ minWidth: 0 }}>
              <div className="truncate" style={{ fontSize: 13.5 }}>
                {current.title}
              </div>
              <div className="truncate" style={{ fontSize: 12, color: C.sub }}>
                {current.channel}
              </div>
            </div>
            {!compact && <Heart track={current} />}
          </>
        ) : (
          <div style={{ fontSize: 13, color: C.sub }}>Pick a song to start playing</div>
        )}
      </div>

      <div className="flex flex-col items-center" style={{ flex: compact ? undefined : 1, gap: 4 }}>
        <div className="flex items-center" style={{ gap: 18 }}>
          <button aria-label="Previous" onClick={prev} disabled={!current} style={{ color: C.sub }}>
            <span className="i-ph:skip-back-fill" style={{ width: 18, height: 18 }} />
          </button>
          <button
            aria-label={playing ? "Pause" : "Play"}
            onClick={() => toggle()}
            disabled={!current}
            className="flex-center"
            style={{ width: 34, height: 34, borderRadius: "50%", background: current ? "#fff" : "#555" }}
          >
            <span className={playing ? "i-ph:pause-fill" : "i-ph:play-fill"} style={{ width: 16, height: 16, color: "#000" }} />
          </button>
          <button aria-label="Next" onClick={next} disabled={!current || index + 1 >= queue.length} style={{ color: C.sub }}>
            <span className="i-ph:skip-forward-fill" style={{ width: 18, height: 18 }} />
          </button>
        </div>
        {!compact && (
          <div className="flex items-center" style={{ gap: 8, width: "100%", maxWidth: 520 }}>
            <span style={{ fontSize: 11, color: C.sub, width: 36, textAlign: "right" }}>{fmt(position)}</span>
            <input
              type="range"
              aria-label="Seek"
              min={0}
              max={Math.max(duration, 1)}
              step={1}
              value={Math.min(position, duration)}
              onChange={(e) => seek(+e.target.value)}
              disabled={!current}
              style={{ ...range, flex: 1 }}
            />
            <span style={{ fontSize: 11, color: C.sub, width: 36 }}>{fmt(duration)}</span>
          </div>
        )}
      </div>

      {!compact && (
        <div className="flex items-center justify-end" style={{ gap: 8, width: "30%" }}>
          <span className={volume === 0 ? "i-ph:speaker-x" : "i-ph:speaker-high"} style={{ width: 18, height: 18, color: C.sub }} />
          <input type="range" aria-label="Volume" min={0} max={100} value={volume} onChange={(e) => setVolume(+e.target.value)} style={{ ...range, width: 110 }} />
        </div>
      )}
    </div>
  );
}
