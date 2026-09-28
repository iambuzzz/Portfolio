import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { profile } from "~/data/profile";
import { useWindowSize } from "~/hooks/useWindowSize";

interface Note {
  id: string;
  title: string;
  body: string;
  created: number;
  updated: number;
  pinned?: boolean;
  color?: string;
  /** Written by Ambuj (from the profile) vs. by the visitor. */
  starter?: boolean;
  /** Set when moved to Recently Deleted. */
  deleted?: number;
}

// Starter notes are generated from the profile; visitors' edits and new notes
// are kept in their own browser (localStorage).
const NOW = Date.now();
const starter = (n: Omit<Note, "created" | "updated" | "starter">): Note => ({ ...n, created: NOW, updated: NOW, starter: true });
const STARTER_NOTES: Note[] = [
  starter({
    id: "welcome",
    title: "👋 Start here",
    body: `Hi, I'm ${profile.firstName}! This whole site is my portfolio, built as a Mac.

Things to try:
☐ Open Terminal and type "help", "whoami" or "open devtinder"
☐ Ask Siri about me (menu bar or dock)
☐ Press ⌘/Ctrl + Space for Spotlight
☐ Right-click the desktop › Edit Widgets
☐ Play any song in Spotify
☐ Find my résumé and certificates in Finder

Tick them off as you go (put the cursor on a line and press ⌘/Ctrl + L).
Your own notes stay in your browser. #portfolio`,
    pinned: true,
    color: "#FFCC00"
  }),
  starter({
    id: "skills",
    title: "Skills",
    body: `${Object.entries(profile.skills)
      .map(([k, v]) => `${k}\n${v.join(", ")}`)
      .join("\n\n")}\n\n#resume`,
    color: "#007AFF"
  }),
  starter({
    id: "education",
    title: "Education",
    body: `${profile.education.map((e) => `${e.school}\n${e.degree}${e.period ? ` (${e.period})` : ""}\n${e.score}`).join("\n\n")}\n\n#resume`,
    color: "#AF52DE"
  }),
  starter({
    id: "achievements",
    title: "Achievements",
    body: `${profile.achievements.map((a) => `• ${a}`).join("\n")}\n\n#resume`,
    color: "#34C759"
  }),
  starter({
    id: "interests",
    title: "Interests",
    body: `${profile.interests.map((i) => `${i.title}: ${i.text}`).join("\n")}\n\n#personal`,
    color: "#FF2D55"
  })
];
const STARTER_IDS = new Set(STARTER_NOTES.map((n) => n.id));
const STARTER_COLOR = Object.fromEntries(STARTER_NOTES.map((n) => [n.id, n.color]));

const NOTE_COLORS = [
  { name: "Yellow", value: "#FFCC00" },
  { name: "Orange", value: "#FF9500" },
  { name: "Red", value: "#FF3B30" },
  { name: "Pink", value: "#FF2D55" },
  { name: "Purple", value: "#AF52DE" },
  { name: "Blue", value: "#007AFF" },
  { name: "Teal", value: "#30B0C7" },
  { name: "Green", value: "#34C759" },
  { name: "Graphite", value: "#8E8E93" }
];
// Saves from before every starter note had its own colour get the defaults once.
const COLORS_KEY = "macos-notes-colors-v2";

const STORAGE_KEY = "macos-notes-v1";
const DAY = 86_400_000;

function loadNotes(): Note[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (Array.isArray(saved) && saved.length) {
      const recolor = !localStorage.getItem(COLORS_KEY);
      localStorage.setItem(COLORS_KEY, "1");
      // Older saves had only a text date; give them timestamps.
      return saved.map((n) => ({
        ...(recolor && STARTER_IDS.has(n.id) ? { color: STARTER_COLOR[n.id] } : {}),
        ...n,
        created: n.created ?? (Number(n.id) || NOW),
        updated: n.updated ?? (Number(n.id) || NOW),
        starter: n.starter ?? STARTER_IDS.has(n.id)
      }));
    }
  } catch {
    // storage unavailable or corrupted: fall back to the starter notes
  }
  return STARTER_NOTES;
}

const fmtTime = (t: number) => {
  const d = new Date(t);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (today.getTime() - t < 7 * DAY) return d.toLocaleDateString([], { weekday: "long" });
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
};

function bucket(t: number) {
  const age = Date.now() - t;
  if (new Date(t).toDateString() === new Date().toDateString()) return "Today";
  if (age < 7 * DAY) return "Previous 7 Days";
  if (age < 30 * DAY) return "Previous 30 Days";
  return String(new Date(t).getFullYear());
}

const tagsOf = (n: Note) => [...new Set((n.body.match(/(^|\s)#[\p{L}\d_-]+/gu) ?? []).map((t) => t.trim().toLowerCase()))];
const preview = (n: Note) => n.body.replace(/\s+/g, " ").trim().slice(0, 60) || "No additional text";

type Folder = "all" | "ambuj" | "mine" | "deleted";
const FOLDERS: { id: Folder; label: string; icon: string }[] = [
  { id: "all", label: "All Notes", icon: "i-ph:tray" },
  { id: "ambuj", label: `${profile.firstName}'s Notes`, icon: "i-ph:user-circle" },
  { id: "mine", label: "My Notes", icon: "i-ph:folder" },
  { id: "deleted", label: "Recently Deleted", icon: "i-ph:trash" }
];

// ── Small pieces (module level so typing doesn't remount the list) ──────────
const iconBtn: CSSProperties = {
  background: "none",
  border: "none",
  padding: "5px 7px",
  borderRadius: 6,
  color: "var(--a-text)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

function ToolButton({ icon, title, onClick, active, disabled }: { icon: string; title: string; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className="notes-tool"
      style={{ ...iconBtn, color: active ? "#b38600" : "var(--a-text)", opacity: disabled ? 0.3 : 0.75 }}
    >
      <span className={icon} style={{ width: 17, height: 17 }} />
    </button>
  );
}

const NoteRow = memo(function NoteRow({ note, selected, onSelect }: { note: Note; selected: boolean; onSelect: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(note.id)}
      className="notes-row"
      style={{
        width: "calc(100% - 12px)",
        textAlign: "left",
        padding: "8px 12px",
        borderRadius: 8,
        margin: "1px 6px",
        border: "none",
        background: selected ? "rgba(255,204,0,0.28)" : undefined,
        display: "flex",
        gap: 8,
        alignItems: "stretch",
        color: "var(--a-text)"
      }}
    >
      {note.color && <span style={{ width: 3, borderRadius: 2, background: note.color, flexShrink: 0 }} />}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {note.title.trim() || "New Note"}
        </span>
        <span style={{ display: "flex", gap: 6, marginTop: 1, fontSize: 11 }}>
          <span style={{ color: "var(--a-text-2)", flexShrink: 0 }}>{fmtTime(note.updated)}</span>
          <span style={{ color: "var(--a-text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview(note)}</span>
        </span>
      </span>
    </button>
  );
});

const GroupHeader = ({ children }: { children: ReactNode }) => (
  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--a-text-2)", padding: "10px 16px 3px" }}>{children}</div>
);

function Menu({ items, onClose, header }: { items: { label: string; icon: string; run: () => void; danger?: boolean }[]; onClose: () => void; header?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", down);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("mousedown", down);
      window.removeEventListener("keydown", key);
    };
  }, [onClose]);
  return (
    <div ref={ref} className="notes-menu" role="menu">
      {header}
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          role="menuitem"
          onClick={() => {
            it.run();
            onClose();
          }}
          style={{ color: it.danger ? "#ff3b30" : undefined }}
        >
          <span className={it.icon} style={{ width: 14, height: 14 }} />
          {it.label}
        </button>
      ))}
    </div>
  );
}

// ── App ─────────────────────────────────────────────────────────────────────
export default function Notes() {
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  const [selected, setSelected] = useState<string>(() => loadNotes().find((n) => !n.deleted)?.id ?? "");
  const [folder, setFolder] = useState<Folder>("all");
  const [tag, setTag] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [menu, setMenu] = useState<"share" | "more" | null>(null);
  const [toast, setToast] = useState("");
  const [saved, setSaved] = useState(true);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const { winWidth } = useWindowSize();
  const isMobile = winWidth < 768;
  const [mobileView, setMobileView] = useState<"sidebar" | "list" | "editor">("list");

  // Autosave, debounced, with a "Saved" indicator.
  useEffect(() => {
    setSaved(false);
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
        setSaved(true);
      } catch {
        // storage blocked: notes just won't persist
      }
    }, 400);
    return () => clearTimeout(t);
  }, [notes]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  const live = notes.filter((n) => !n.deleted);
  const inFolder = (n: Note) =>
    folder === "deleted" ? !!n.deleted : !n.deleted && (folder === "all" || (folder === "ambuj" ? n.starter : !n.starter));
  const q = search.trim().toLowerCase();
  const visible = notes.filter(
    (n) => inFolder(n) && (!tag || tagsOf(n).includes(tag)) && (!q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
  );
  const allTags = useMemo(() => [...new Set(live.flatMap(tagsOf))].sort(), [live]);
  const counts: Record<Folder, number> = {
    all: live.length,
    ambuj: live.filter((n) => n.starter).length,
    mine: live.filter((n) => !n.starter).length,
    deleted: notes.length - live.length
  };

  // Stable order while typing: pinned first, then by creation time.
  const pinned = folder === "deleted" ? [] : visible.filter((n) => n.pinned);
  const rest = visible.filter((n) => folder === "deleted" || !n.pinned).sort((a, b) => b.created - a.created);
  const groups: { label: string; notes: Note[] }[] = [];
  for (const n of rest) {
    const label = folder === "deleted" ? "Deleted notes are kept here until you empty them" : bucket(n.created);
    const g = groups.find((x) => x.label === label);
    if (g) g.notes.push(n);
    else groups.push({ label, notes: [n] });
  }

  const active = notes.find((n) => n.id === selected && inFolder(n)) ?? null;
  const readOnly = !!active?.deleted;

  const patch = (id: string, p: Partial<Note>, touch = true) =>
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...p, ...(touch ? { updated: Date.now() } : {}) } : n)));

  const select = (id: string) => {
    setSelected(id);
    if (isMobile) setMobileView("editor");
  };

  const newNote = () => {
    const id = Date.now().toString();
    setNotes((prev) => [{ id, title: "", body: "", created: Date.now(), updated: Date.now() }, ...prev]);
    if (folder === "ambuj" || folder === "deleted") setFolder("all");
    setTag(null);
    setSearch("");
    select(id);
    setTimeout(() => document.getElementById("notes-title")?.focus(), 50);
  };

  const removeNote = (n: Note) => {
    if (n.deleted) setNotes((prev) => prev.filter((x) => x.id !== n.id));
    else patch(n.id, { deleted: Date.now(), pinned: false }, false);
    const next = visible.find((x) => x.id !== n.id);
    setSelected(next?.id ?? "");
    if (isMobile) setMobileView("list");
  };

  // Checklist / bullets: toggle the prefix of the line(s) under the cursor.
  const toggleLinePrefix = (kind: "check" | "bullet") => {
    const ta = bodyRef.current;
    if (!ta || !active || readOnly) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const from = value.lastIndexOf("\n", s - 1) + 1;
    const toIdx = value.indexOf("\n", e);
    const to = toIdx === -1 ? value.length : toIdx;
    const lines = value.slice(from, to).split("\n");
    const next = lines.map((l) => {
      if (kind === "bullet") return l.startsWith("• ") ? l.slice(2) : `• ${l.replace(/^(☐|☑) /, "")}`;
      if (l.startsWith("☐ ")) return `☑ ${l.slice(2)}`;
      if (l.startsWith("☑ ")) return l.slice(2);
      return `☐ ${l.replace(/^• /, "")}`;
    });
    const body = value.slice(0, from) + next.join("\n") + value.slice(to);
    patch(active.id, { body });
    const delta = body.length - value.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(Math.max(from, s + (lines.length === 1 ? delta : 0)), e + delta);
    });
  };

  const noteText = (n: Note) => `${n.title.trim() || "New Note"}\n\n${n.body}`;
  const download = (n: Note) => {
    const url = URL.createObjectURL(new Blob([noteText(n)], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(n.title.trim() || "Note").replace(/[^\w\s-]/g, "").trim() || "Note"}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === "s") {
      e.preventDefault();
      setToast("Notes save automatically ✓");
    } else if (k === "l") {
      e.preventDefault();
      toggleLinePrefix("check");
    } else if (k === "n" && e.altKey) {
      e.preventDefault();
      newNote();
    }
  };

  const shareItems = active
    ? [
        {
          label: "Copy Note",
          icon: "i-ph:copy",
          run: () => navigator.clipboard?.writeText(noteText(active)).then(() => setToast("Copied to clipboard"), () => setToast("Couldn't copy"))
        },
        { label: "Download as .txt", icon: "i-ph:download-simple", run: () => download(active) },
        {
          label: "Send by Email",
          icon: "i-ph:envelope-simple",
          run: () => (location.href = `mailto:?subject=${encodeURIComponent(active.title || "Note")}&body=${encodeURIComponent(active.body)}`)
        },
        ...(typeof navigator.share === "function"
          ? [{ label: "More…", icon: "i-ph:export", run: () => navigator.share({ title: active.title, text: noteText(active) }).catch(() => {}) }]
          : [])
      ]
    : [];
  const moreItems = active
    ? [
        {
          label: "Duplicate",
          icon: "i-ph:copy-simple",
          run: () => {
            const id = Date.now().toString();
            setNotes((prev) => [{ ...active, id, title: `${active.title || "New Note"} copy`, pinned: false, starter: false, created: Date.now(), updated: Date.now() }, ...prev]);
            select(id);
          }
        },
        { label: "Delete Note", icon: "i-ph:trash", run: () => removeNote(active), danger: true }
      ]
    : [];

  const sidebar = (
    <div className="notes-side" style={{ width: isMobile ? "100%" : 190 }}>
      <div style={{ padding: "12px 12px 6px", fontSize: 11, fontWeight: 700, color: "var(--a-text-3)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        On this Mac
      </div>
      {FOLDERS.map((f) => (
        <button
          key={f.id}
          type="button"
          className={`notes-folder ${folder === f.id && !tag ? "on" : ""}`}
          onClick={() => {
            setFolder(f.id);
            setTag(null);
            if (isMobile) setMobileView("list");
          }}
        >
          <span className={f.icon} style={{ width: 15, height: 15, color: "#e0a800" }} />
          <span style={{ flex: 1, textAlign: "left" }}>{f.label}</span>
          <span style={{ fontSize: 11, color: "var(--a-text-3)" }}>{counts[f.id]}</span>
        </button>
      ))}
      {folder === "deleted" && counts.deleted > 0 && (
        <button type="button" className="notes-folder" style={{ color: "#ff3b30", fontSize: 11.5 }} onClick={() => setNotes((prev) => prev.filter((n) => !n.deleted))}>
          <span className="i-ph:trash" style={{ width: 14, height: 14 }} />
          Empty Recently Deleted
        </button>
      )}
      {allTags.length > 0 && (
        <>
          <div style={{ padding: "16px 12px 6px", fontSize: 11, fontWeight: 700, color: "var(--a-text-3)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Tags
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", padding: "0 12px" }}>
            {allTags.map((t) => (
              <button
                key={t}
                type="button"
                className={`notes-tag ${tag === t ? "on" : ""}`}
                onClick={() => {
                  setTag(tag === t ? null : t);
                  setFolder("all");
                  if (isMobile) setMobileView("list");
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <div style={{ padding: "8px 12px", fontSize: 10.5, color: "var(--a-text-3)", lineHeight: 1.4 }}>Type #word in a note to tag it.</div>
        </>
      )}
    </div>
  );

  const list = (
    <div className="notes-list" style={{ width: isMobile ? "100%" : 240 }}>
      <div style={{ padding: "8px 10px", borderBottom: "0.5px solid var(--a-border)", display: "flex", gap: 6, alignItems: "center" }}>
        {isMobile && (
          <button type="button" style={{ ...iconBtn, color: "#e0a800" }} aria-label="Folders" onClick={() => setMobileView("sidebar")}>
            <span className="i-ph:caret-left-bold" style={{ width: 16, height: 16 }} />
          </button>
        )}
        <label className="notes-search">
          <span className="i-ph:magnifying-glass" style={{ width: 13, height: 13, color: "var(--a-text-2)" }} />
          <input ref={searchRef} placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search notes" />
          {search && (
            <button type="button" aria-label="Clear search" onClick={() => setSearch("")} style={{ ...iconBtn, padding: 0 }}>
              <span className="i-ph:x-circle-fill" style={{ width: 13, height: 13, color: "var(--a-text-3)" }} />
            </button>
          )}
        </label>
        <button type="button" title="New Note" aria-label="New Note" onClick={newNote} style={{ ...iconBtn, background: "rgba(255,204,0,0.3)", color: "#8a6700", width: 28, height: 28, padding: 0 }}>
          <span className="i-ph:note-pencil" style={{ width: 16, height: 16 }} />
        </button>
      </div>
      {tag && (
        <div style={{ padding: "6px 14px 0", fontSize: 11.5, color: "var(--a-text-2)" }}>
          Tagged <b style={{ color: "var(--a-text)" }}>{tag}</b> ·{" "}
          <button type="button" onClick={() => setTag(null)} style={{ border: 0, background: "none", color: "#b38600", padding: 0, font: "inherit" }}>
            Show all
          </button>
        </div>
      )}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
        {pinned.length > 0 && (
          <>
            <GroupHeader>Pinned</GroupHeader>
            {pinned.map((n) => (
              <NoteRow key={n.id} note={n} selected={n.id === active?.id} onSelect={select} />
            ))}
          </>
        )}
        {groups.map((g) => (
          <div key={g.label}>
            <GroupHeader>{g.label}</GroupHeader>
            {g.notes.map((n) => (
              <NoteRow key={n.id} note={n} selected={n.id === active?.id} onSelect={select} />
            ))}
          </div>
        ))}
        {!visible.length && (
          <div style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--a-text-3)" }}>
            {q ? `No notes match “${search.trim()}”` : folder === "deleted" ? "Nothing in Recently Deleted" : "No notes yet"}
          </div>
        )}
      </div>
    </div>
  );

  const editor = (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      <div style={{ padding: "6px 10px", borderBottom: "0.5px solid var(--a-border)", display: "flex", alignItems: "center", gap: 2, position: "relative" }}>
        {isMobile && (
          <button type="button" style={{ ...iconBtn, color: "#e0a800" }} aria-label="Back" onClick={() => setMobileView("list")}>
            <span className="i-ph:caret-left-bold" style={{ width: 16, height: 16 }} />
          </button>
        )}
        <ToolButton icon="i-ph:note-pencil" title="New Note (⌥⌘N)" onClick={newNote} />
        <ToolButton icon="i-ph:check-square" title="Checklist (⌘L)" onClick={() => toggleLinePrefix("check")} disabled={!active || readOnly} />
        <ToolButton icon="i-ph:list-bullets" title="Bulleted list" onClick={() => toggleLinePrefix("bullet")} disabled={!active || readOnly} />
        <ToolButton icon={active?.pinned ? "i-ph:push-pin-fill" : "i-ph:push-pin"} title={active?.pinned ? "Unpin" : "Pin"} active={active?.pinned} onClick={() => active && patch(active.id, { pinned: !active.pinned }, false)} disabled={!active || readOnly} />
        <div style={{ position: "relative" }}>
          <ToolButton icon="i-ph:share-network" title="Share" onClick={() => setMenu(menu === "share" ? null : "share")} disabled={!active} />
          {menu === "share" && <Menu items={shareItems} onClose={() => setMenu(null)} />}
        </div>
        <div style={{ position: "relative" }}>
          <ToolButton icon="i-ph:dots-three-outline" title="More" onClick={() => setMenu(menu === "more" ? null : "more")} disabled={!active || readOnly} />
          {menu === "more" && active && (
            <Menu
              items={moreItems}
              onClose={() => setMenu(null)}
              header={
                <div className="notes-colors">
                  <div className="notes-colors-label">Colour</div>
                  <div className="notes-swatches" role="radiogroup" aria-label="Note colour">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={!active.color}
                      aria-label="No colour"
                      title="No colour"
                      className={`notes-swatch none ${!active.color ? "on" : ""}`}
                      onClick={() => patch(active.id, { color: undefined }, false)}
                    />
                    {NOTE_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        role="radio"
                        aria-checked={active.color === c.value}
                        aria-label={c.name}
                        title={c.name}
                        className={`notes-swatch ${active.color === c.value ? "on" : ""}`}
                        style={{ background: c.value }}
                        onClick={() => patch(active.id, { color: c.value }, false)}
                      />
                    ))}
                  </div>
                </div>
              }
            />
          )}
        </div>
        <div style={{ flex: 1 }} />
        {active && !readOnly && (
          <span style={{ fontSize: 11, color: "var(--a-text-3)", marginRight: 6, display: "flex", alignItems: "center", gap: 3 }} aria-live="polite">
            {saved ? (
              <>
                <span className="i-ph:check-circle" style={{ width: 12, height: 12 }} /> Saved
              </>
            ) : (
              "Saving…"
            )}
          </span>
        )}
        <ToolButton icon="i-ph:trash" title={readOnly ? "Delete permanently" : "Delete"} onClick={() => active && removeNote(active)} disabled={!active} />
      </div>

      {active ? (
        <>
          {readOnly && (
            <div className="notes-banner">
              This note is in Recently Deleted.
              <button type="button" onClick={() => patch(active.id, { deleted: undefined }, false)}>
                Restore
              </button>
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--a-text-2)", padding: "10px 20px 0", textAlign: "center" }}>
            {new Date(active.updated).toLocaleString([], { dateStyle: "long", timeStyle: "short" })}
          </div>
          <input
            id="notes-title"
            value={active.title}
            placeholder="Title"
            readOnly={readOnly}
            onChange={(e) => patch(active.id, { title: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                bodyRef.current?.focus();
              } else onKeyDown(e);
            }}
            className="font-display notes-title"
          />
          <textarea
            ref={bodyRef}
            value={active.body}
            placeholder="Start writing…"
            readOnly={readOnly}
            onChange={(e) => patch(active.id, { body: e.target.value })}
            onKeyDown={onKeyDown}
            className="notes-body"
          />
        </>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, alignItems: "center", justifyContent: "center", color: "var(--a-text-3)", fontSize: 14 }}>
          {folder === "deleted" ? "Nothing selected" : "Select a note, or create a new one"}
          {folder !== "deleted" && (
            <button type="button" onClick={newNote} style={{ border: 0, borderRadius: 8, padding: "6px 14px", background: "rgba(255,204,0,0.3)", color: "#8a6700", fontWeight: 600, fontSize: 13 }}>
              New Note
            </button>
          )}
        </div>
      )}
      {toast && <div className="notes-toast">{toast}</div>}
    </div>
  );

  return (
    <div className="app-theme notes-app" style={{ display: "flex", height: "100%", background: "var(--a-bg)", overflow: "hidden" }}>
      {(!isMobile || mobileView === "sidebar") && sidebar}
      {(!isMobile || mobileView === "list") && list}
      {(!isMobile || mobileView === "editor") && editor}
    </div>
  );
}
