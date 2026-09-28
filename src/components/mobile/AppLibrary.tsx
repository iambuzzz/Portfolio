import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { profile } from "~/data/profile";
import { useActivity } from "~/settings/activity";
import { MobileIcon, type MobileEntry } from "./MobileIcon";

// iOS App Library: the last home-screen page. Every app and project grouped in
// category folders, plus a search field that filters them all.

const GROUPS: { title: string; ids: string[] }[] = [
  { title: "Productivity", ids: ["notes", "mail", "clock", "finder"] },
  { title: "Developer", ids: ["terminal", "vscode", "safari", "bear"] },
  { title: "Social", ids: ["messages", "facetime", "about", "link:github"] },
  { title: "Entertainment", ids: ["spotify", "photos", "maps"] },
  { title: "Utilities", ids: ["system-settings", "siri", "link:resume", "action:fullscreen"] },
  { title: "Projects", ids: profile.projects.map((p) => `project:${p.id}`) }
];

const DEFAULT_SUGGESTIONS = ["about", "safari", "terminal", "messages"];

export default function AppLibrary({
  entries,
  onOpen
}: {
  entries: MobileEntry[];
  onOpen: (e: MobileEntry, el: HTMLElement) => void;
}) {
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState<string | null>(null);
  const opens = useActivity((s) => s.appOpens);
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);

  // Most-opened apps first, topped up with the portfolio's highlights so the
  // folder is always full (a new visitor had just one icon in it).
  const suggestions = useMemo(() => {
    const used = Object.entries(opens)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);
    return [...new Set([...used, ...DEFAULT_SUGGESTIONS])]
      .map((id) => byId.get(id))
      .filter((e): e is MobileEntry => !!e)
      .slice(0, 4);
  }, [opens, byId]);
  const groups = [
    ...(suggestions.length ? [{ title: "Suggestions", items: suggestions }] : []),
    ...GROUPS.map((g) => ({ title: g.title, items: g.ids.map((id) => byId.get(id)).filter((e): e is MobileEntry => !!e) }))
  ];
  const found = q.trim() ? entries.filter((e) => e.title.toLowerCase().includes(q.trim().toLowerCase())) : null;
  const open = groups.find((g) => g.title === folder);

  return (
    <div className="ml-root">
      <label className="ml-search">
        <span className="i-ph:magnifying-glass-bold" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="App Library" aria-label="Search App Library" />
        {q && (
          <button type="button" aria-label="Clear" onClick={() => setQ("")}>
            <span className="i-ph:x-circle-fill" />
          </button>
        )}
      </label>

      {found ? (
        <div className="ml-list">
          {found.length ? (
            found.map((e) => (
              <button type="button" key={e.id} className="ml-row" onClick={(ev) => onOpen(e, ev.currentTarget.querySelector(".mi-tile") as HTMLElement)}>
                <MobileIcon entry={e} size={40} bare />
                <span>{e.title}</span>
              </button>
            ))
          ) : (
            <div className="ml-empty">No results</div>
          )}
        </div>
      ) : (
        <div className="ml-grid">
          {groups.map((g) => (
            <div key={g.title} className="ml-folder">
              <div className="ml-folder-box">
                {g.items.length <= 4
                  ? g.items.map((e) => <MobileIcon key={e.id} entry={e} size={0} bare onOpen={onOpen} />)
                  : [
                      ...g.items.slice(0, 3).map((e) => <MobileIcon key={e.id} entry={e} size={0} bare onOpen={onOpen} />),
                      <button type="button" key="more" className="ml-cluster" aria-label={`Show all ${g.title}`} onClick={() => setFolder(g.title)}>
                        {g.items.slice(3, 7).map((e) => (
                          <MobileIcon key={e.id} entry={e} size={0} bare />
                        ))}
                      </button>
                    ]}
              </div>
              <button type="button" className="ml-folder-name" onClick={() => setFolder(g.title)}>
                {g.title}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Rendered at the phone root: inside the sliding pages (a transformed
          element) the fixed sheet would be placed relative to them, off-screen. */}
      {createPortal(
      <AnimatePresence>
        {open && (
          <motion.div className="ml-sheet" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setFolder(null)}>
            <motion.div
              className="ml-sheet-box"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ml-sheet-title">{open.title}</div>
              <div className="ml-sheet-grid">
                {open.items.map((e) => (
                  <MobileIcon
                    key={e.id}
                    entry={e}
                    size={60}
                    label
                    onOpen={(en, el) => {
                      setFolder(null);
                      onOpen(en, el);
                    }}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.querySelector(".m-root") ?? document.body
      )}
    </div>
  );
}
