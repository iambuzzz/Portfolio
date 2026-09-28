import { profile } from "~/data/profile";

// Live GitHub stats (public API, no token). Cached for an hour per visitor so
// we stay well inside GitHub's 60 requests/hour unauthenticated limit.

export interface GhData {
  avatar: string;
  repos: number;
  followers: number;
  recent: { name: string; url: string; language: string | null; pushed: string }[];
}

const CACHE_KEY = "gh-widget-v1";
const TTL = 60 * 60 * 1000;

export async function loadGitHub(user: string): Promise<GhData | null> {
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
    if (cached && Date.now() - cached.at < TTL) return cached.data;
  } catch {
    // ignore bad cache
  }
  const remember = (data: GhData) => {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
    } catch {
      // storage full/blocked
    }
    return data;
  };
  // Prefer our CDN-cached proxy; fall back to GitHub directly (e.g. local preview).
  try {
    const res = await fetch("/api/github");
    const data = await res.json();
    if (res.ok && typeof data.repos === "number") return remember(data);
  } catch {
    // proxy unavailable
  }
  try {
    const [u, r] = await Promise.all([
      fetch(`https://api.github.com/users/${user}`).then((res) => (res.ok ? res.json() : Promise.reject(res.status))),
      fetch(`https://api.github.com/users/${user}/repos?sort=pushed&per_page=4`).then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
    ]);
    const data: GhData = {
      avatar: u.avatar_url,
      repos: u.public_repos,
      followers: u.followers,
      recent: (r as any[]).map((x) => ({ name: x.name, url: x.html_url, language: x.language, pushed: x.pushed_at }))
    };
    return remember(data);
  } catch {
    return null;
  }
}

const ago = (iso: string) => {
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (d < 1) return "today";
  if (d < 2) return "yesterday";
  if (d < 30) return `${Math.floor(d)}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
};

export default function GitHubWidget() {
  const [data, setData] = useState<GhData | null | undefined>(undefined);
  useEffect(() => {
    loadGitHub(profile.handle).then(setData);
  }, []);

  return (
    <a
      href={profile.socials.github}
      target="_blank"
      rel="noreferrer"
      draggable={false}
      style={{
        display: "block",
        width: 220,
        padding: "14px 16px",
        borderRadius: 18,
        background: "linear-gradient(145deg, rgba(22,27,34,0.88) 0%, rgba(13,17,23,0.94) 100%)",
        backdropFilter: "blur(64px) saturate(200%)",
        WebkitBackdropFilter: "blur(64px) saturate(200%)",
        border: "0.5px solid rgba(255,255,255,0.12)",
        boxShadow: "0 4px 32px rgba(0,0,0,0.42)",
        color: "white",
        fontFamily: "var(--font-system)",
        userSelect: "none"
      }}
    >
      <div className="flex items-center" style={{ gap: 10 }}>
        {data?.avatar ? (
          <img src={data.avatar} alt="" draggable={false} style={{ width: 34, height: 34, borderRadius: "50%" }} />
        ) : (
          <span className="i-fa6-brands:github" style={{ width: 30, height: 30 }} />
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>@{profile.handle}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
            {data ? `${data.repos} repos · ${data.followers} followers` : data === null ? "GitHub" : "Loading…"}
          </div>
        </div>
      </div>
      {data && data.recent.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: "0.5px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>
            Recently pushed
          </div>
          {data.recent.map((r) => (
            <div key={r.name} className="flex items-center justify-between" style={{ fontSize: 12, padding: "2px 0", gap: 8 }}>
              <span className="truncate">{r.name}</span>
              <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, flexShrink: 0 }}>{ago(r.pushed)}</span>
            </div>
          ))}
        </div>
      )}
    </a>
  );
}
