import { useState, useRef, useEffect } from "react";
import { profile } from "~/data/profile";
import { motion, AnimatePresence } from "framer-motion";
import { useWindowSize } from "~/hooks/useWindowSize";

interface Note {
  id: string;
  title: string;
  body: string;
  date: string;
  dateISO?: string;
  pinned?: boolean;
  color?: string;
}

const TODAY = new Date().toISOString().slice(0, 10);

// Starter notes are generated from the profile; visitors' edits and new notes
// are kept in their own browser (localStorage).
const INITIAL_NOTES: Note[] = [
  {
    id: "welcome",
    title: "👋 Start here",
    body: `Hi, I'm ${profile.firstName}! This whole site is my portfolio, built as a Mac.

Things to try:
• Open Terminal and type "help", "whoami" or "open devtinder"
• Ask Siri about me (menu bar or dock)
• Press ⌘/Ctrl + Space for Spotlight
• Right-click the desktop › Edit Widgets
• Play any song in Spotify
• Find my résumé and certificates in Finder

Feel free to write your own notes here — they stay in your browser.`,
    date: "Today",
    dateISO: TODAY,
    pinned: true,
    color: "#FFCC00",
  },
  {
    id: "skills",
    title: "Skills",
    body: Object.entries(profile.skills).map(([k, v]) => `${k}\n${v.join(", ")}`).join("\n\n"),
    date: "Today",
    dateISO: TODAY,
    color: "#007AFF",
  },
  {
    id: "education",
    title: "Education",
    body: profile.education.map((e) => `${e.school}\n${e.degree}${e.period ? ` (${e.period})` : ""}\n${e.score}`).join("\n\n"),
    date: "Today",
    dateISO: TODAY,
  },
  {
    id: "achievements",
    title: "Achievements",
    body: profile.achievements.map((a) => `• ${a}`).join("\n"),
    date: "Today",
    dateISO: TODAY,
    color: "#34C759",
  },
  {
    id: "interests",
    title: "Interests",
    body: profile.interests.map((i) => `${i.title}: ${i.text}`).join("\n"),
    date: "Today",
    dateISO: TODAY,
  },
];

const STORAGE_KEY = "macos-notes-v1";
const loadNotes = (): Note[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {
    // storage unavailable or corrupted: fall back to the starter notes
  }
  return INITIAL_NOTES;
};

const DATE_BUCKET_ORDER = ["Previous 7 Days", ...Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i)), "Older"];

function dateBucket(note: Note): string {
  const iso = note.dateISO;
  if (!iso) {
    const d = note.date.toLowerCase();
    if (d === "today" || d === "now" || d === "thursday" || d === "friday" || d === "saturday" || d === "sunday" || d === "monday" || d === "tuesday" || d === "wednesday" || d === "yesterday")
      return "Previous 7 Days";
    return "Older";
  }
  const year = iso.slice(0, 4);
  const noteDate = new Date(iso);
  const now = new Date();
  const diffDays = (now.getTime() - noteDate.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays <= 7) return "Previous 7 Days";
  return year;
}

function groupNotes(notes: Note[]): { bucket: string; notes: Note[] }[] {
  const map: Record<string, Note[]> = {};
  for (const n of notes) {
    const b = dateBucket(n);
    if (!map[b]) map[b] = [];
    map[b].push(n);
  }
  return DATE_BUCKET_ORDER.filter((b) => map[b]?.length).map((b) => ({ bucket: b, notes: map[b] }));
}

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  const [selected, setSelected] = useState<string>(() => notes[0]?.id ?? "");

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch {
      // ignore: notes just won't persist
    }
  }, [notes]);
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState<"notes" | "shared">("notes");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { winWidth } = useWindowSize();
  const isMobile = winWidth < 768;
  const [mobileView, setMobileView] = useState<"sidebar" | "list" | "editor">("list");

  const activeNote = notes.find((n) => n.id === selected);

  const filtered = search.trim()
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(search.toLowerCase()) ||
          n.body.toLowerCase().includes(search.toLowerCase())
      )
    : notes;

  const pinned = filtered.filter((n) => n.pinned);
  const regular = filtered.filter((n) => !n.pinned);
  const groups = groupNotes(regular);

  const updateNote = (field: "title" | "body", val: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === selected ? { ...n, [field]: val } : n))
    );
  };

  const newNote = () => {
    const id = Date.now().toString();
    const note: Note = { id, title: "New Note", body: "", date: "Now", dateISO: new Date().toISOString().slice(0, 10) };
    setNotes((prev) => [note, ...prev]);
    setSelected(id);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const deleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (selected === id) {
      setSelected(notes.find((n) => n.id !== id)?.id ?? "");
      if (isMobile) setMobileView("list");
    }
  };

  const NoteRow = ({ note }: { note: Note }) => (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={() => { setSelected(note.id); if (isMobile) setMobileView("editor"); }}
      style={{
        padding: "9px 14px",
        borderRadius: "8px",
        margin: "1px 6px",
        cursor: "default",
        background: selected === note.id ? "rgba(255,204,0,0.22)" : "transparent",
        transition: "background 0.15s ease",
        display: "flex",
        gap: "8px",
        alignItems: "flex-start",
      }}
      onMouseEnter={(e) => {
        if (selected !== note.id)
          (e.currentTarget as HTMLElement).style.background = "var(--a-fill)";
      }}
      onMouseLeave={(e) => {
        if (selected !== note.id)
          (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      {note.color && (
        <div style={{ width: 3, borderRadius: 2, background: note.color, alignSelf: "stretch", flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--a-text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {note.title || "Untitled"}
        </div>
        <div style={{ display: "flex", gap: "6px", marginTop: "1px" }}>
          <span style={{ fontSize: "11px", color: "var(--a-text-2)", flexShrink: 0 }}>{note.date}</span>
          <span
            style={{
              fontSize: "11px",
              color: "var(--a-text-3)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {note.body.slice(0, 28) || "No additional text"}
          </span>
        </div>
      </div>
    </motion.div>
  );

  const GroupHeader = ({ label }: { label: string }) => (
    <div
      style={{
        fontSize: "12px",
        fontWeight: 700,
        color: "var(--a-text-2)",
        padding: "8px 14px 3px",
        letterSpacing: "0.01em",
      }}
    >
      {label}
    </div>
  );

  const toolbarIcons = [
    { icon: "i-ph:note-pencil", title: "New Note", action: newNote },
    { icon: "i-ph:text-aa", title: "Format" },
    { icon: "i-ph:table", title: "Table" },
    { icon: "i-ph:check-square", title: "Checklist" },
    { icon: "i-ph:paperclip", title: "Attachment" },
    { icon: "i-ph:tag", title: "Tags" },
    { icon: "i-ph:share-network", title: "Share" },
    { icon: "i-ph:dots-three", title: "More" },
  ];

  return (
    <div className="app-theme"
      style={{
        display: "flex",
        height: "100%",
        
        background: "var(--a-bg)",
        borderRadius: "0 0 14px 14px",
        overflow: "hidden",
      }}
    >
      {/* ── Left sidebar (iCloud/sections) ── */}
      {(!isMobile || mobileView === "sidebar") && (
      <div
        style={{
          width: isMobile ? "100%" : "180px",
          flexShrink: 0,
          borderRight: "0.5px solid var(--a-border)",
          background: "var(--a-bg-side)",
          display: "flex",
          flexDirection: "column",
          paddingTop: "8px",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "6px 12px 8px",
            borderBottom: "0.5px solid var(--a-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--a-text)" }}>Notes</span>
          <button
            onClick={newNote}
            title="New Note"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px 4px",
              borderRadius: "5px",
              color: "#886800",
            }}
          >
            <span className="i-ph:note-pencil" style={{ width: "16px", height: "16px" }} />
          </button>
        </div>

        {/* iCloud section */}
        <div style={{ padding: "10px 0 4px" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--a-text-3)", textTransform: "uppercase", letterSpacing: "0.5px", padding: "0 12px 4px" }}>
            iCloud
          </div>
          <button
            onClick={() => setActiveSection("notes")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "5px 12px",
              width: "calc(100% - 8px)",
              background: activeSection === "notes" ? "rgba(0,122,255,0.12)" : "transparent",
              border: "none",
              borderRadius: "6px",
              margin: "0 4px",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <img src="/img/icons/sf-icons/folder.svg" alt="Folder" style={{ width: "13px", height: "13px", opacity: 0.8 }} className="dark:invert" />
              <span style={{ fontSize: "12px", fontWeight: activeSection === "notes" ? 600 : 400, color: activeSection === "notes" ? "#007AFF" : "var(--a-text)" }}>
                Notes
              </span>
            </div>
            <span style={{ fontSize: "11px", color: "var(--a-text-3)", background: "var(--a-fill)", borderRadius: "8px", padding: "1px 6px" }}>
              {notes.length}
            </span>
          </button>
          <button
            onClick={() => setActiveSection("shared")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "5px 12px",
              width: "calc(100% - 8px)",
              margin: "0 4px",
              background: activeSection === "shared" ? "rgba(0,122,255,0.12)" : "transparent",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <img src="/img/icons/sf-icons/folder-user.svg" alt="Shared Folder" style={{ width: "13px", height: "13px", opacity: 0.6 }} className="dark:invert" />
              <span style={{ fontSize: "12px", color: "var(--a-text)" }}>Shared</span>
            </div>
            <span style={{ fontSize: "11px", color: "var(--a-text-3)", background: "var(--a-fill)", borderRadius: "8px", padding: "1px 6px" }}>1</span>
          </button>
        </div>

        {/* Tags */}
        <div style={{ padding: "8px 12px 4px", borderTop: "0.5px solid var(--a-border)" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--a-text-3)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
            Tags
          </div>
          <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
            {["All Tags", "#tags"].map((tag) => (
              <span
                key={tag}
                style={{
                  background: "var(--a-fill)",
                  borderRadius: "12px",
                  padding: "3px 9px",
                  fontSize: "11px",
                  color: "var(--a-text)",
                  cursor: "default",
                  userSelect: "none",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* ── Note list ── */}
      {(!isMobile || mobileView === "list") && (
      <div
        style={{
          width: isMobile ? "100%" : "220px",
          flexShrink: 0,
          borderRight: "0.5px solid var(--a-border)",
          background: "var(--a-bg-list)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Search + new */}
        <div
          style={{
            padding: "8px 10px",
            borderBottom: "0.5px solid var(--a-border)",
            display: "flex",
            gap: "6px",
            alignItems: "center",
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: "5px",
              background: "var(--a-fill)",
              borderRadius: "7px",
              padding: "4px 8px",
            }}
          >
            <img src="/img/icons/sf-icons/search.svg" alt="Search" style={{ width: "11px", height: "11px", opacity: 0.5 }} className="dark:invert" />
            <input
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ background: "none", border: "none", outline: "none", fontSize: "12px", width: "100%", color: "var(--a-text)" }}
            />
          </div>
          <button
            onClick={newNote}
            title="New Note"
            style={{
              background: "rgba(255,204,0,0.3)",
              border: "none",
              borderRadius: "7px",
              width: "28px",
              height: "28px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: "18px", lineHeight: 1, color: "#886800" }}>+</span>
          </button>
        </div>

        {/* Grouped note list */}
        <div style={{ flex: 1, overflowY: "auto", paddingTop: "4px" }}>
          {pinned.length > 0 && (
            <>
              <GroupHeader label="Pinned" />
              {pinned.map((n) => <NoteRow key={n.id} note={n} />)}
            </>
          )}
          <AnimatePresence>
            {groups.map(({ bucket, notes: gNotes }) => (
              <div key={bucket}>
                <GroupHeader label={bucket} />
                {gNotes.map((n) => <NoteRow key={n.id} note={n} />)}
              </div>
            ))}
          </AnimatePresence>
        </div>
      </div>
      )}

      {/* ── Editor ── */}
      {(!isMobile || mobileView === "editor") && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", width: isMobile ? "100%" : "auto" }}>
      {activeNote ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Editor toolbar */}
          {isMobile && (
            <button onClick={() => setMobileView("list")} style={{ padding: "8px 12px", background: "none", border: "none", color: "#007AFF", fontWeight: 500, display: "flex", alignItems: "center", gap: "4px" }}>
              ‹ Back
            </button>
          )}
          <div
            style={{
              padding: "6px 12px",
              borderBottom: "0.5px solid var(--a-border)",
              display: "flex",
              alignItems: "center",
              gap: "2px",
              background: "var(--a-bg)",
            }}
          >
            {toolbarIcons.map((t) => (
              <button
                key={t.title}
                title={t.title}
                onClick={t.action}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 6px",
                  borderRadius: "6px",
                  opacity: 0.55,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "opacity 0.12s, background 0.12s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = "1";
                  (e.currentTarget as HTMLElement).style.background = "var(--a-fill)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = "0.55";
                  (e.currentTarget as HTMLElement).style.background = "none";
                }}
              >
                <span className={t.icon} style={{ width: "16px", height: "16px" }} />
              </button>
            ))}
            <div style={{ flex: 1 }} />
            {/* Search in note */}
            <button
              title="Search"
              style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: "6px", opacity: 0.55 }}
            >
              <img src="/img/icons/sf-icons/search.svg" alt="Search" style={{ width: "16px", height: "16px", opacity: 0.7 }} className="dark:invert" />
            </button>
            {/* Delete */}
            <button
              onClick={() => deleteNote(activeNote.id)}
              title="Delete"
              style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: "6px", opacity: 0.4 }}
            >
              <img src="/img/icons/sf-icons/trash.svg" alt="Trash" style={{ width: "14px", height: "14px", opacity: 0.7 }} className="dark:invert" />
            </button>
          </div>

          {/* Date */}
          <div style={{ fontSize: "11px", color: "var(--a-text-2)", padding: "10px 20px 0", textAlign: "center" }}>
            {activeNote.dateISO ?? activeNote.date}
          </div>

          {/* Title */}
          <input
            value={activeNote.title}
            onChange={(e) => updateNote("title", e.target.value)}
            className="font-display"
            style={{
              border: "none",
              outline: "none",
              fontSize: "20px",
              fontWeight: 700,
              color: "var(--a-text)",
              padding: "8px 20px 4px",
              background: "transparent",
            }}
          />

          {/* Body */}
          <textarea
            ref={textareaRef}
            value={activeNote.body}
            onChange={(e) => updateNote("body", e.target.value)}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              resize: "none",
              fontSize: "14px",
              lineHeight: "1.6",
              color: "var(--a-text)",
              padding: "0 20px 20px",
              background: "transparent",
              
            }}
          />
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--a-text-3)", fontSize: "14px" }}>
          Select or create a note
        </div>
      )}
      </div>
      )}
    </div>
  );
}
