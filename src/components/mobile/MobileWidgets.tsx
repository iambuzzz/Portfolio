import { useEffect, useState } from "react";
import { profile } from "~/data/profile";
import { useShallow } from "zustand/react/shallow";
import { useMusicStore } from "~/stores/music";
import { useWeather, WeatherIcon, LOCATION } from "~/components/widgets/WeatherWidget";
import { loadGitHub, type GhData } from "~/components/widgets/GitHubWidget";

// iOS home-screen widgets (glass tiles). Small = 2×2 icons, medium = 4×2.

type OpenApp = (id: string) => void;

// One request shared by every widget on the page.
let ghRequest: Promise<GhData | null> | null = null;

function useGitHub() {
  const [data, setData] = useState<GhData | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    (ghRequest ??= loadGitHub(profile.handle)).then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, []);
  return data;
}

export function ProfileWidget({ openApp }: { openApp: OpenApp }) {
  return (
    <div className="mw mw-medium mw-profile" role="group" aria-label={`${profile.name}, profile`}>
      <button type="button" className="mw-profile-main" onClick={() => openApp("about")}>
        <img src={profile.avatar} alt="" className="mw-avatar" draggable={false} />
        <span className="mw-profile-text">
          <span className="mw-kicker">Portfolio</span>
          <span className="mw-name">{profile.name}</span>
          <span className="mw-role">Full-Stack Developer · {profile.location.split(",")[0]}</span>
        </span>
      </button>
      <div className="mw-profile-actions">
        <a className="mw-pill" href={profile.resume} target="_blank" rel="noreferrer">
          <span className="i-ph:file-text-fill" /> Résumé
        </a>
        <button type="button" className="mw-pill" onClick={() => openApp("mail")}>
          <span className="i-ph:envelope-simple-fill" /> Contact
        </button>
        <button type="button" className="mw-pill" onClick={() => openApp("messages")}>
          <span className="i-ph:chat-circle-fill" /> Chat
        </button>
      </div>
    </div>
  );
}

export function WeatherSmall() {
  const w = useWeather();
  return (
    <div className="mw mw-small mw-weather" aria-label={w ? `${LOCATION.name}: ${w.temp}°, ${w.condition}` : "Weather"}>
      <div className="mw-weather-top">
        <span className="mw-city">
          {LOCATION.name} <span className="i-ph:navigation-arrow-fill" />
        </span>
        <span className="mw-temp">{w ? `${w.temp}°` : "--"}</span>
      </div>
      <div className="mw-weather-bottom">
        {w && <WeatherIcon type={w.icon} size={22} />}
        <span className="mw-cond">{w?.condition ?? "Loading…"}</span>
        {w && (
          <span className="mw-hl">
            H:{w.high}° L:{w.low}°
          </span>
        )}
      </div>
    </div>
  );
}

export function GitHubSmall() {
  const gh = useGitHub();
  const latest = gh?.recent[0];
  return (
    <a className="mw mw-small mw-github" href={`https://github.com/${profile.handle}`} target="_blank" rel="noreferrer" aria-label="GitHub profile">
      <div className="mw-gh-top">
        <span className="i-fa6-brands:github" />
        <span className="mw-gh-handle">@{profile.handle}</span>
      </div>
      <div className="mw-gh-stats">
        <span>
          <b>{gh ? gh.repos : "–"}</b> repos
        </span>
        <span>
          <b>{gh ? gh.followers : "–"}</b> followers
        </span>
      </div>
      <div className="mw-gh-latest">
        <span className="mw-kicker">Latest push</span>
        <span className="mw-gh-repo">{latest?.name ?? (gh === null ? "Offline" : "…")}</span>
      </div>
    </a>
  );
}

export function MusicWidget({ openApp }: { openApp: OpenApp }) {
  // Not the playback position (it ticks ~4×/s): the widget doesn't show it.
  const { track, playing, toggle, next } = useMusicStore(useShallow((s) => ({ track: s.queue[s.index], playing: s.playing, toggle: s.toggle, next: s.next })));
  return (
    <div className="mw mw-medium mw-music">
      <button type="button" className="mw-music-art" onClick={() => openApp("spotify")} aria-label="Open Spotify">
        {track ? <img src={track.cover || track.thumbnail} alt="" draggable={false} /> : <span className="i-ph:music-notes-fill" />}
      </button>
      <div className="mw-music-info" onClick={() => openApp("spotify")}>
        <span className="mw-kicker">{track ? (playing ? "Now Playing" : "Paused") : "Spotify"}</span>
        <span className="mw-music-title">{track?.title ?? "Play something"}</span>
        <span className="mw-music-artist">{track?.artist ?? "Search any song, stream it here"}</span>
      </div>
      <div className="mw-music-ctl">
        <button type="button" aria-label={playing ? "Pause" : "Play"} onClick={() => (track ? toggle() : openApp("spotify"))}>
          <span className={playing ? "i-ph:pause-fill" : "i-ph:play-fill"} />
        </button>
        <button type="button" aria-label="Next" disabled={!track} onClick={() => next()}>
          <span className="i-ph:fast-forward-fill" />
        </button>
      </div>
    </div>
  );
}

export function CalendarSmall({ openApp }: { openApp: OpenApp }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return (
    <button type="button" className="mw mw-small mw-cal" onClick={() => openApp("clock")} aria-label="Date">
      <span className="mw-cal-day">{now.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()}</span>
      <span className="mw-cal-date">{now.getDate()}</span>
      <span className="mw-cal-month">{now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
    </button>
  );
}

export function ProjectsWidget({ openProject }: { openProject: (url: string) => void }) {
  return (
    <div className="mw mw-small mw-projects">
      <span className="mw-kicker">Projects</span>
      {profile.projects.map((p) => (
        <button type="button" key={p.id} className="mw-proj" onClick={() => openProject(p.live)}>
          <img src={p.logo} alt="" draggable={false} />
          <span>{p.name}</span>
        </button>
      ))}
    </div>
  );
}
