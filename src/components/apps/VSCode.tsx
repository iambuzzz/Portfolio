import { useEffect, useState } from "react";
import { profile } from "~/data/profile";

// Browse any project's source in a web VS Code (github1s), one tab per project.
// On touch screens github1s pops the keyboard on every tap (its editor focuses
// a hidden text box), so phones get a read-only explorer + code view instead.
const LAST_KEY = "vscode-last-project";
const TOUCH = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

interface Entry {
  path: string;
  type: "blob" | "tree";
  size?: number;
}

// One tree request per repo per visit (GitHub allows 60/hour without a token).
const trees = new Map<string, Promise<Entry[]>>();
const repoOf = (github: string) => github.replace(/^https:\/\/github\.com\//, "").replace(/\/$/, "");
const loadTree = (repo: string) => {
  if (!trees.has(repo)) {
    const req = fetch(`https://api.github.com/repos/${repo}/git/trees/HEAD?recursive=1`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { tree: Entry[] }) => d.tree);
    req.catch(() => trees.delete(repo)); // let a later visit retry
    trees.set(repo, req);
  }
  return trees.get(repo)!;
};

const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|svg|mp3|mp4|webm|woff2?|ttf|otf|pdf|zip|gz)$/i;
const MAX_SIZE = 400_000;

function CodeBrowser({ repo, github }: { repo: string; github: string }) {
  const [tree, setTree] = useState<Entry[] | null | undefined>(undefined);
  const [dir, setDir] = useState("");
  const [file, setFile] = useState<Entry | null>(null);
  const [text, setText] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    setTree(undefined);
    setDir("");
    setFile(null);
    loadTree(repo).then(
      (t) => alive && setTree(t),
      () => alive && setTree(null)
    );
    return () => {
      alive = false;
    };
  }, [repo]);

  useEffect(() => {
    if (!file) return;
    let alive = true;
    setText(undefined);
    if (BINARY.test(file.path) || (file.size ?? 0) > MAX_SIZE) return setText(null);
    fetch(`https://raw.githubusercontent.com/${repo}/HEAD/${file.path.split("/").map(encodeURIComponent).join("/")}`)
      .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
      .then(
        (t) => alive && setText(t),
        () => alive && setText(null)
      );
    return () => {
      alive = false;
    };
  }, [repo, file]);

  if (tree === undefined) return <div className="vsc-m-note"><span className="i-ph:spinner-gap vsc-spin" /> Loading files…</div>;
  if (tree === null)
    return (
      <div className="vsc-m-note">
        Couldn't load the file list (GitHub may be busy, try again in a bit).
        <a href={github} target="_blank" rel="noreferrer">Open on GitHub</a>
      </div>
    );

  if (file) {
    const name = file.path.split("/").pop();
    const lines = text?.replace(/\n$/, "").split("\n") ?? [];
    return (
      <div className="vsc-m">
        <div className="vsc-m-bar">
          <button type="button" className="vsc-m-back" onClick={() => setFile(null)}>
            <span className="i-ph:caret-left-bold" /> {dir ? dir.split("/").pop() : "Files"}
          </button>
          <span className="vsc-m-title">{name}</span>
        </div>
        {text === undefined ? (
          <div className="vsc-m-note"><span className="i-ph:spinner-gap vsc-spin" /> Opening {name}…</div>
        ) : text === null ? (
          <div className="vsc-m-note">
            No preview for this file.
            <a href={`${github}/blob/HEAD/${file.path}`} target="_blank" rel="noreferrer">Open on GitHub</a>
          </div>
        ) : (
          <div className="vsc-m-code">
            <pre>
              {lines.map((l, i) => (
                <div key={i} className="vsc-m-line">
                  <span className="vsc-m-ln">{i + 1}</span>
                  <span>{l || " "}</span>
                </div>
              ))}
            </pre>
          </div>
        )}
      </div>
    );
  }

  // Folder listing: sub-folders first, then files.
  const prefix = dir ? `${dir}/` : "";
  const here = tree
    .filter((e) => e.path.startsWith(prefix) && !e.path.slice(prefix.length).includes("/"))
    .sort((a, b) => (a.type === b.type ? a.path.localeCompare(b.path) : a.type === "tree" ? -1 : 1));
  return (
    <div className="vsc-m">
      <div className="vsc-m-bar">
        {dir ? (
          <button type="button" className="vsc-m-back" onClick={() => setDir(dir.split("/").slice(0, -1).join("/"))}>
            <span className="i-ph:caret-left-bold" /> {dir.includes("/") ? dir.split("/").slice(-2, -1)[0] : repo.split("/")[1]}
          </button>
        ) : (
          <span className="vsc-m-root">EXPLORER</span>
        )}
        <span className="vsc-m-title">{dir ? dir.split("/").pop() : repo.split("/")[1]}</span>
      </div>
      <div className="vsc-m-list">
        {here.map((e) => {
          const name = e.path.slice(prefix.length);
          const folder = e.type === "tree";
          return (
            <button type="button" key={e.path} className="vsc-m-item" onClick={() => (folder ? setDir(e.path) : setFile(e))}>
              <span className={folder ? "i-ph:folder-simple-fill" : "i-ph:file-code"} style={{ color: folder ? "#dcb67a" : "#8fb9e8" }} />
              <span className="vsc-m-name">{name}</span>
              {folder && <span className="i-ph:caret-right vsc-m-chev" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const initial = () => {
  try {
    const id = localStorage.getItem(LAST_KEY);
    if (profile.projects.some((p) => p.id === id)) return id!;
  } catch {
    // storage blocked
  }
  return profile.projects[0].id;
};

export default function VSCode() {
  const [active, setActive] = useState(initial);
  const [loading, setLoading] = useState(true);
  const project = profile.projects.find((p) => p.id === active) ?? profile.projects[0];

  const pick = (id: string) => {
    if (id === active) return;
    setActive(id);
    setLoading(true);
    try {
      localStorage.setItem(LAST_KEY, id);
    } catch {
      // storage blocked
    }
  };

  return (
    <div className="vsc">
      <div className="vsc-tabs" role="tablist" aria-label="Projects">
        {profile.projects.map((p) => (
          <button type="button" role="tab" aria-selected={p.id === active} key={p.id} className={`vsc-tab ${p.id === active ? "on" : ""}`} onClick={() => pick(p.id)} title={p.tagline}>
            <span className="i-ph:folder-simple-fill" style={{ width: 14, height: 14, color: "#dcb67a", flexShrink: 0 }} />
            {p.name}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <a className="vsc-link" href={project.live} target="_blank" rel="noreferrer" title="Open the live site" aria-label="Open the live site">
          <span className="i-ph:globe-simple" style={{ width: 14, height: 14 }} />
          <span className="vsc-link-text">Live</span>
        </a>
        <a className="vsc-link" href={project.github} target="_blank" rel="noreferrer" title="Open on GitHub" aria-label="Open on GitHub">
          <span className="i-ph:github-logo" style={{ width: 14, height: 14 }} />
          <span className="vsc-link-text">GitHub</span>
        </a>
      </div>
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        {TOUCH ? (
          <CodeBrowser repo={repoOf(project.github)} github={project.github} />
        ) : (
        <iframe
          key={project.id}
          className="size-full bg-[#202020]"
          style={{ border: 0, display: "block" }}
          src={project.github.replace("github.com", "github1s.com")}
          title={`${project.name} source code`}
          onLoad={() => setLoading(false)}
        />
        )}
        {loading && !TOUCH && (
          <div className="vsc-loading">
            <span className="i-ph:spinner-gap" /> Opening {project.name}…
          </div>
        )}
      </div>
    </div>
  );
}
