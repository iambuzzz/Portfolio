import { profile } from "~/data/profile";

// Read-only virtual file system generated from the résumé (data/profile.ts).

export interface FileNode {
  type: "file";
  name: string;
  content?: string;
  /** Binary files can't be cat'ed; `open` follows this link instead. */
  open?: string;
  hidden?: boolean;
}
export interface DirNode {
  type: "dir";
  name: string;
  children: FsNode[];
  hidden?: boolean;
}
export type FsNode = FileNode | DirNode;

const lines = (...l: (string | false | undefined)[]) => l.filter((x) => x !== false && x !== undefined).join("\n");

export const text = {
  about: () =>
    lines(
      `${profile.name}`,
      profile.role,
      `📍 ${profile.location}`,
      "",
      profile.summary,
      "",
      "Interests:",
      ...profile.interests.map((i) => `  • ${i.title} — ${i.text}`)
    ),
  education: () =>
    lines(...profile.education.flatMap((e) => [`${e.school}`, `  ${e.degree}${e.period ? ` · ${e.period}` : ""}`, `  ${e.score}`, ""])).trim(),
  skills: () => lines(...Object.entries(profile.skills).map(([k, v]) => `${k}:\n  ${v.join(", ")}`)),
  achievements: () => lines(...profile.achievements.map((a) => `• ${a}`)),
  interests: () => lines(...profile.interests.map((i) => `• ${i.title} — ${i.text}`)),
  contact: () =>
    lines(
      `Email     ${profile.email}`,
      `GitHub    ${profile.socials.github}`,
      `LinkedIn  ${profile.socials.linkedin}`,
      `LeetCode  ${profile.socials.leetcode}`,
      `CodeChef  ${profile.socials.codechef}`,
      `Codolio   ${profile.socials.codolio}`,
      "",
      "Tip: run `mail` to send a message right from this terminal."
    ),
  project: (id: string) => {
    const p = profile.projects.find((x) => x.id === id)!;
    return lines(
      `# ${p.name}  (${p.date})`,
      "",
      p.tagline,
      "",
      `Stack:  ${p.stack.join(" · ")}`,
      `Live:   ${p.live}`,
      `Code:   ${p.github}`,
      "",
      ...p.highlights.map((h) => `- ${h}`)
    );
  }
};

export const ROOT: DirNode = {
  type: "dir",
  name: "~",
  children: [
    { type: "file", name: "about.txt", content: text.about() },
    { type: "file", name: "education.txt", content: text.education() },
    { type: "file", name: "skills.txt", content: text.skills() },
    { type: "file", name: "achievements.txt", content: text.achievements() },
    { type: "file", name: "contact.txt", content: text.contact() },
    { type: "file", name: "resume.pdf", open: profile.resume },
    {
      type: "dir",
      name: "projects",
      children: profile.projects.map((p) => ({ type: "file" as const, name: `${p.id}.md`, content: text.project(p.id) }))
    },
    {
      type: "dir",
      name: "certificates",
      children: profile.certifications.map((c) => ({ type: "file" as const, name: `${c.id}.pdf`, open: c.url }))
    },
    {
      type: "file",
      name: ".secrets",
      hidden: true,
      content: "There are no secrets here, just a sandbox.\nBut `sudo hire-ambuj` might do something… 👀"
    }
  ]
};

export const formatPath = (path: string[]) => (path.length ? `~/${path.join("/")}` : "~");

/** Resolve a path (relative, ~, .., absolute-ish) against cwd. */
export function resolve(cwd: string[], input = ""): { node: FsNode; path: string[] } | null {
  let parts: string[];
  const raw = input.trim();
  if (!raw || raw === "~") parts = [];
  else if (raw.startsWith("~/")) parts = raw.slice(2).split("/");
  else if (raw.startsWith("/")) parts = raw.slice(1).split("/");
  else parts = [...cwd, ...raw.split("/")];

  const path: string[] = [];
  for (const seg of parts) {
    if (!seg || seg === ".") continue;
    if (seg === "..") path.pop();
    else path.push(seg);
  }
  let node: FsNode = ROOT;
  for (const seg of path) {
    if (node.type !== "dir") return null;
    const next: FsNode | undefined = node.children.find((c) => c.name === seg);
    if (!next) return null;
    node = next;
  }
  return { node, path };
}

/** Completions for a partially typed path, e.g. "proj" → ["projects/"]. */
export function completePath(cwd: string[], partial: string, want: "any" | "dir" | "file" = "any"): string[] {
  const slash = partial.lastIndexOf("/");
  const base = slash >= 0 ? partial.slice(0, slash + 1) : "";
  const prefix = slash >= 0 ? partial.slice(slash + 1) : partial;
  const dir = resolve(cwd, base || ".");
  if (!dir || dir.node.type !== "dir") return [];
  return dir.node.children
    .filter((c) => c.name.startsWith(prefix) && (!c.hidden || prefix.startsWith(".")))
    .filter((c) => want === "any" || c.type === "dir" || want === "file")
    .filter((c) => want !== "dir" || c.type === "dir")
    .map((c) => base + c.name + (c.type === "dir" ? "/" : ""));
}
