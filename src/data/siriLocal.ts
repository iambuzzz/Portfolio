// Offline brain for Siri: handles common commands and questions about the
// profile without any API. Used when the AI proxy is unavailable (no key,
// rate-limited, offline) so Siri still works.
import { profile } from "./profile";

export interface LocalAnswer {
  reply: string;
  tool?: { name: string; args?: Record<string, unknown> };
}

const APP_ALIASES: Record<string, string> = {
  finder: "finder",
  files: "finder",
  about: "about",
  profile: "about",
  portfolio: "about",
  safari: "safari",
  browser: "safari",
  terminal: "terminal",
  notes: "notes",
  mail: "mail",
  email: "mail",
  messages: "messages",
  photos: "photos",
  maps: "maps",
  map: "maps",
  calculator: "calculator",
  settings: "system-settings",
  "system settings": "system-settings",
  spotify: "spotify",
  music: "spotify",
  vscode: "vscode",
  "vs code": "vscode",
  code: "vscode",
  facetime: "facetime",
  camera: "facetime",
  typora: "typora",
  clock: "clock",
  "app store": "app-store",
  bear: "bear"
};

const findApp = (text: string) => {
  const names = Object.keys(APP_ALIASES).sort((a, b) => b.length - a.length);
  const hit = names.find((n) => new RegExp(`\\b${n}\\b`).test(text));
  return hit ? APP_ALIASES[hit] : undefined;
};

const list = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

export function localAnswer(raw: string): LocalAnswer | null {
  const t = raw.toLowerCase().replace(/[?!.]/g, " ").trim();
  const p = profile;
  const first = p.firstName;

  // Interface commands
  if (/\b(dark|night) mode\b|\bgo dark\b/.test(t)) return { reply: "Switching the theme for you.", tool: { name: "toggle_dark_mode" } };
  if (/\blight mode\b/.test(t)) return { reply: "Switching the theme for you.", tool: { name: "toggle_dark_mode" } };
  if (/\b(resume|résumé|cv)\b/.test(t)) return { reply: `Here's ${first}'s résumé — the download should start right away!`, tool: { name: "download_resume" } };
  if (/\b(time|date|day is it|what day)\b/.test(t)) return { reply: "", tool: { name: "get_current_time" } };
  if (/\b(pause|stop)\b.*\b(music|song|playing)\b|^(pause|stop)$/.test(t)) return { reply: "Paused.", tool: { name: "pause_music" } };
  const play = t.match(/\bplay\s+(?:the\s+)?(?:song\s+)?(.+?)(?:\s+on\s+spotify)?[.!?]*$/);
  if (play && !/^(some\s+)?(music|a song|songs|something)$/.test(play[1])) return { reply: "", tool: { name: "play_music", args: { query: play[1] } } };
  if (/\bplay\b/.test(t)) return { reply: "", tool: { name: "play_music" } };
  if (/\bfull ?screen\b/.test(t)) return { reply: "", tool: { name: "toggle_fullscreen" } };
  if (/\b(close|quit|exit)\b/.test(t)) {
    const app = findApp(t);
    if (app) return { reply: "Done.", tool: { name: "close_app", args: { app_id: app } } };
  }
  if (/\b(open|launch|start|show)\b/.test(t)) {
    if (/\blaunchpad\b/.test(t)) return { reply: `Here are ${first}'s projects!`, tool: { name: "open_launchpad" } };
    const app = findApp(t);
    if (app) return { reply: "Opening it now.", tool: { name: "open_app", args: { app_id: app } } };
  }

  // A specific project
  const project = p.projects.find((pr) => t.includes(pr.name.toLowerCase()) || t.includes(pr.id));
  if (project) {
    return { reply: `${project.name}: ${project.tagline} Built with ${list(project.stack)}. You can try it live at ${project.live.replace(/^https?:\/\//, "").replace(/\/$/, "")}.` };
  }

  // Questions about the profile
  if (/\bprojects?\b|\bbuilt\b|\bwork(ed)? on\b/.test(t))
    return { reply: `${first} has built ${list(p.projects.map((pr) => pr.name))}. Opening Launchpad so you can try them.`, tool: { name: "open_launchpad" } };
  if (/\bskills?\b|\btech\b|\bstack\b|\blanguages?\b|\bframeworks?\b|\bknow\b/.test(t))
    return { reply: `${first} works with ${list(p.skills.Languages)}, plus ${list(p.skills["Frameworks & Libraries"].slice(0, 5))}, and databases like ${list(p.skills["Databases & ORMs"].slice(0, 3))}.` };
  if (/\b(educat|college|universit|school|cgpa|study|studies|degree|iiit)/.test(t)) {
    const e = p.education[0];
    return { reply: `${first} is doing a ${e.degree} at IIIT Kota (${e.period}), with a ${e.score.replace("CGPA: ", "CGPA of ")}.` };
  }
  if (/\b(achiev|leetcode|codechef|rating|dsa|competitive)/.test(t)) return { reply: `${list(p.achievements)}`.replace(/\.(?=,| and)/g, "") };
  if (/\bcertif/.test(t)) return { reply: `${first} holds ${list(p.certifications.map((c) => `${c.title} from ${c.issuer}`))}.` };
  if (/\b(interest|hobb|free time|guitar|piano|sing)/.test(t)) return { reply: `Outside code, ${first} enjoys ${list(p.interests.slice(3).map((i) => i.text.toLowerCase().replace(/\.$/, "")))}.` };
  if (/\b(contact|email|reach|hire|linkedin|github|connect)\b/.test(t))
    return { reply: `You can email ${first} at ${p.email}, or find ${first} on GitHub and LinkedIn — links are in the About Me app.` };
  if (/\b(where|location|live|based)\b/.test(t)) return { reply: `${first} is based in ${p.location}.` };
  if (/\b(who|about|introduce|tell me|yourself)\b/.test(t) || t.includes(first.toLowerCase()))
    return { reply: `${p.name} is a ${p.role.split("|")[0].trim().toLowerCase()} and computer science student at IIIT Kota, graduating in 2027, who builds full-stack, real-time and event-driven systems.` };

  if (/^(hi|hello|hey|yo|namaste)\b/.test(t)) return { reply: `Hi! Ask me about ${first}'s projects, skills or education — or tell me to open an app.` };
  return null;
}
