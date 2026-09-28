import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { profile } from "~/data/profile";
import { contactFormEnabled, mailtoLink, sendContactMessage } from "~/utils/contact";
import { unlock } from "~/settings/activity";

// Mail: Ambuj's welcome + project emails in the Inbox, and a working Compose
// (Web3Forms) whose sent messages and drafts are kept in the visitor's browser.

interface MailMessage {
  id: string;
  from: string;
  fromEmail: string;
  to?: string;
  subject: string;
  body: string;
  time: string;
  /** Sort key (ms). */
  at: number;
}

interface Draft {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  at: number;
}

type Folder = "inbox" | "sent" | "drafts" | "starred" | "trash";

const FOLDERS: { id: Folder; label: string; icon: string }[] = [
  { id: "inbox", label: "Inbox", icon: "i-ph:tray" },
  { id: "sent", label: "Sent", icon: "i-ph:paper-plane-tilt" },
  { id: "drafts", label: "Drafts", icon: "i-ph:file-text" },
  { id: "starred", label: "Starred", icon: "i-ph:star" },
  { id: "trash", label: "Trash", icon: "i-ph:trash" }
];

const now = Date.now();
const INBOX: MailMessage[] = [
  {
    id: "welcome",
    from: profile.name,
    fromEmail: profile.email,
    subject: "Thanks for stopping by 👋",
    body: `Hi there,

Thanks for exploring my portfolio! I'm ${profile.name}, ${profile.role}.

${profile.summary}

You can reach me at:
• Email: ${profile.email}
• GitHub: ${profile.socials.github}
• LinkedIn: ${profile.socials.linkedin}

Click Compose to send me a message right here — it lands straight in my inbox.
My résumé is in Finder, or just ask Siri.

— ${profile.firstName}`,
    time: "Now",
    at: now
  },
  ...profile.projects.map((p, i) => ({
    id: `project-${p.id}`,
    from: profile.name,
    fromEmail: profile.email,
    subject: `Project: ${p.name}`,
    body: `${p.tagline}

Stack: ${p.stack.join(", ")}

${p.highlights.map((h) => `• ${h}`).join("\n")}

Live: ${p.live}
GitHub: ${p.github}`,
    time: p.date,
    at: now - (i + 1) * 1000
  }))
];

// ── Saved state (this browser only) ─────────────────────────────────────────
interface Saved {
  read: string[];
  starred: string[];
  trashed: string[];
  /** Emptied from Trash. */
  gone: string[];
  sent: MailMessage[];
  drafts: Draft[];
  /** Remembered for the next Compose. */
  me: { name: string; email: string };
}
const STORAGE_KEY = "macos-mail";
const EMPTY: Saved = { read: [], starred: ["welcome"], trashed: [], gone: [], sent: [], drafts: [], me: { name: "", email: "" } };
const load = (): Saved => {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") };
  } catch {
    return EMPTY;
  }
};

const fmt = (t: number) => {
  const d = new Date(t);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { day: "numeric", month: "short" });
};
const preview = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 90);
const toggle = (list: string[], id: string, on: boolean) => (on ? [...new Set([...list, id])] : list.filter((x) => x !== id));

// ── Compose ─────────────────────────────────────────────────────────────────
function Compose({
  draft,
  onChange,
  onClose,
  onSent,
  narrow
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onClose: (discard: boolean) => void;
  onSent: (d: Draft) => void;
  narrow: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const set = (k: "name" | "email" | "subject" | "message") => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...draft, [k]: e.target.value, at: Date.now() });

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!contactFormEnabled) {
      window.location.href = mailtoLink(draft);
      return;
    }
    const botcheck = (e.currentTarget.elements.namedItem("botcheck") as HTMLInputElement)?.checked ?? false;
    setStatus("sending");
    const sent = await sendContactMessage({ ...draft, botcheck });
    if (sent) {
      unlock("mail");
      onSent(draft);
    }
    setStatus(sent ? "sent" : "error");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="mail-compose"
      style={narrow ? { inset: 0, width: "auto", borderRadius: 0 } : undefined}
      role="dialog"
      aria-label="New Message"
    >
      <div className="mail-compose-head">
        <span>{draft.subject.trim() || "New Message"}</span>
        <span style={{ display: "flex", gap: 4 }}>
          {status !== "sent" && (
            <button type="button" className="mail-icon-btn" title="Discard draft" aria-label="Discard draft" onClick={() => onClose(true)}>
              <span className="i-ph:trash" />
            </button>
          )}
          <button type="button" className="mail-icon-btn" title={status === "sent" ? "Close" : "Close and save draft"} aria-label="Close" onClick={() => onClose(false)}>
            <span className="i-ph:x-bold" />
          </button>
        </span>
      </div>
      {status === "sent" ? (
        <div className="mail-sent-ok">
          <span className="i-ph:check-circle-fill" style={{ width: 44, height: 44, color: "#34C759" }} />
          <div style={{ fontSize: 15, fontWeight: 600 }}>Message sent!</div>
          <div style={{ fontSize: 13, color: "var(--a-text-2)" }}>
            Thanks, {draft.name.split(" ")[0] || "friend"}. {profile.firstName} will reply to {draft.email}. A copy is in Sent.
          </div>
          <button type="button" className="mail-btn primary" onClick={() => onClose(false)}>
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div className="mail-field">
            <span>To:</span>
            <span style={{ color: "var(--a-text-2)" }}>
              {profile.name} &lt;{profile.email}&gt;
            </span>
          </div>
          <div className="mail-field">
            <span>From:</span>
            <input required placeholder="Your name" value={draft.name} onChange={set("name")} aria-label="Your name" />
            <input required type="email" placeholder="you@example.com" value={draft.email} onChange={set("email")} aria-label="Your email" />
          </div>
          <div className="mail-field">
            <span>Subject:</span>
            <input required value={draft.subject} onChange={set("subject")} aria-label="Subject" />
          </div>
          {/* Honeypot for spam bots — hidden from people. */}
          <input type="checkbox" name="botcheck" tabIndex={-1} autoComplete="off" style={{ display: "none" }} />
          <textarea required placeholder="Write your message…" value={draft.message} onChange={set("message")} className="mail-textarea" aria-label="Message" />
          <div className="mail-compose-foot">
            {status === "error" ? (
              <span style={{ fontSize: 12, color: "#FF3B30", marginRight: "auto" }}>Couldn't send. Email {profile.email}.</span>
            ) : (
              <span style={{ fontSize: 11, color: "var(--a-text-3)", marginRight: "auto" }}>Draft saved automatically</span>
            )}
            <button type="submit" className="mail-btn primary" disabled={status === "sending"}>
              <span className="i-ph:paper-plane-tilt-fill" style={{ width: 13, height: 13 }} />
              {status === "sending" ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      )}
    </motion.div>
  );
}

// ── App ─────────────────────────────────────────────────────────────────────
export default function Mail() {
  const [saved, setSaved] = useState<Saved>(load);
  const [folder, setFolder] = useState<Folder>("inbox");
  const [selected, setSelected] = useState<string | null>(INBOX[0].id);
  const [search, setSearch] = useState("");
  const [compose, setCompose] = useState<Draft | null>(null);
  // The open compose was sent: don't keep it as a draft any more.
  const [sentId, setSentId] = useState<string | null>(null);
  const sentRef = useRef<string | null>(null);
  const [rootRef, rootWidth] = useElementWidth();
  const narrow = rootWidth > 0 && rootWidth < 640;
  const [narrowView, setNarrowView] = useState<"list" | "message">("list");

  // The message shown when Mail opens counts as read.
  useEffect(() => {
    if (!narrow && selected) setSaved((s) => (s.read.includes(selected) ? s : { ...s, read: [...s.read, selected] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrow]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // storage blocked
    }
  }, [saved]);

  const inbox = INBOX.filter((m) => !saved.gone.includes(m.id));
  const all = [...inbox, ...saved.sent];
  const isTrashed = (id: string) => saved.trashed.includes(id);
  const lists: Record<Folder, MailMessage[]> = {
    inbox: inbox.filter((m) => !isTrashed(m.id)),
    sent: saved.sent.filter((m) => !isTrashed(m.id)),
    drafts: [],
    starred: all.filter((m) => saved.starred.includes(m.id) && !isTrashed(m.id)),
    trash: all.filter((m) => isTrashed(m.id))
  };
  const unread = lists.inbox.filter((m) => !saved.read.includes(m.id)).length;
  const counts: Partial<Record<Folder, number>> = { inbox: unread, drafts: saved.drafts.length, trash: lists.trash.length };

  const q = search.trim().toLowerCase();
  const matches = (s: string) => !q || s.toLowerCase().includes(q);
  const shown = useMemo(
    () => lists[folder].filter((m) => matches(`${m.from} ${m.to ?? ""} ${m.subject} ${m.body}`)).sort((a, b) => b.at - a.at),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [saved, folder, q]
  );
  const drafts = saved.drafts.filter((d) => matches(`${d.subject} ${d.message}`)).sort((a, b) => b.at - a.at);
  const active = folder === "drafts" ? null : shown.find((m) => m.id === selected) ?? null;

  const patch = (fn: (s: Saved) => Partial<Saved>) => setSaved((s) => ({ ...s, ...fn(s) }));
  const open = (m: MailMessage) => {
    setSelected(m.id);
    patch((s) => ({ read: toggle(s.read, m.id, true) }));
    setNarrowView("message");
  };
  const goFolder = (f: Folder) => {
    setFolder(f);
    setSearch("");
    const first = f === "drafts" ? null : [...lists[f]].sort((a, b) => b.at - a.at)[0];
    setSelected(first?.id ?? null);
    if (first) patch((s) => ({ read: toggle(s.read, first.id, true) }));
    setNarrowView("list");
  };

  // Compose / drafts
  const newDraft = (p: Partial<Draft> = {}): Draft => ({ id: `d${Date.now()}`, name: saved.me.name, email: saved.me.email, subject: "", message: "", at: Date.now(), ...p });
  const hasContent = (d: Draft) => !!(d.subject.trim() || d.message.trim());
  const closeCompose = (discard: boolean) => {
    if (compose && compose.id !== sentId) {
      const d = compose;
      patch((s) => ({
        drafts: discard || !hasContent(d) ? s.drafts.filter((x) => x.id !== d.id) : [d, ...s.drafts.filter((x) => x.id !== d.id)],
        me: { name: d.name || s.me.name, email: d.email || s.me.email }
      }));
    }
    setCompose(null);
  };
  const onSent = (d: Draft) => {
    const msg: MailMessage = { id: `sent-${Date.now()}`, from: d.name, fromEmail: d.email, to: profile.name, subject: d.subject, body: d.message, time: "", at: Date.now() };
    patch((s) => ({ sent: [msg, ...s.sent], drafts: s.drafts.filter((x) => x.id !== d.id), me: { name: d.name, email: d.email } }));
    sentRef.current = d.id;
    setSentId(d.id);
  };
  // Keep an open compose in Drafts too, so nothing is lost if the window closes.
  useEffect(() => {
    if (!compose || compose.id === sentId || !hasContent(compose)) return;
    const t = setTimeout(() => {
      if (sentRef.current !== compose.id) patch((s) => ({ drafts: [compose, ...s.drafts.filter((x) => x.id !== compose.id)] }));
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compose]);

  const reply = (m: MailMessage) =>
    setCompose(newDraft({ subject: m.subject.startsWith("Re: ") ? m.subject : `Re: ${m.subject}`, message: `\n\n— On ${m.time || fmt(m.at)}, ${m.from} wrote:\n${m.body.split("\n").slice(0, 6).map((l) => `> ${l}`).join("\n")}` }));

  const setStar = (id: string, on: boolean) => patch((s) => ({ starred: toggle(s.starred, id, on) }));
  const trash = (id: string) => {
    patch((s) => ({ trashed: toggle(s.trashed, id, true) }));
    const next = shown.find((m) => m.id !== id);
    setSelected(next?.id ?? null);
    setNarrowView("list");
  };
  const restore = (id: string) => patch((s) => ({ trashed: toggle(s.trashed, id, false) }));
  const deleteForever = (id: string) =>
    patch((s) => ({ trashed: toggle(s.trashed, id, false), gone: id.startsWith("sent-") ? s.gone : toggle(s.gone, id, true), sent: s.sent.filter((m) => m.id !== id) }));
  const emptyTrash = () => lists.trash.forEach((m) => deleteForever(m.id));

  const folderLabel = FOLDERS.find((f) => f.id === folder)!.label;
  const emptyText: Record<Folder, string> = {
    inbox: "No messages",
    sent: "Messages you send to Ambuj appear here.",
    drafts: "No drafts. Unsent messages are saved here.",
    starred: "Star a message to find it here.",
    trash: "Trash is empty"
  };

  const Row = ({ m }: { m: MailMessage }) => {
    const isUnread = folder !== "sent" && !m.id.startsWith("sent-") && !saved.read.includes(m.id);
    const sentByMe = m.id.startsWith("sent-");
    return (
      <button type="button" className={`mail-row ${selected === m.id ? "on" : ""}`} onClick={() => open(m)}>
        {isUnread && <span className="mail-dot" />}
        <span className="mail-avatar" style={isUnread ? { background: "rgba(0,122,255,0.15)", color: "#007AFF" } : undefined}>
          {sentByMe ? <span className="i-ph:paper-plane-tilt-fill" style={{ width: 16, height: 16 }} /> : <img src={profile.avatar} alt="" draggable={false} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="mail-row-top">
            <span className="mail-row-from" style={{ fontWeight: isUnread ? 700 : 500 }}>
              {sentByMe ? `To: ${m.to}` : m.from}
            </span>
            {saved.starred.includes(m.id) && <span className="i-ph:star-fill" style={{ width: 11, height: 11, color: "#FF9500", flexShrink: 0 }} />}
            <span className="mail-row-time">{m.time || fmt(m.at)}</span>
          </span>
          <span className="mail-row-subject" style={{ fontWeight: isUnread ? 600 : 400 }}>
            {m.subject}
          </span>
          <span className="mail-row-preview">{preview(m.body)}</span>
        </span>
      </button>
    );
  };

  const sidebar = (
    <nav className="mail-side" aria-label="Mailboxes">
      <div className="mail-side-label">Mailboxes</div>
      {FOLDERS.map((f) => (
        <button type="button" key={f.id} className={`mail-folder ${folder === f.id ? "on" : ""}`} onClick={() => goFolder(f.id)}>
          <span className={f.icon} style={{ width: 15, height: 15 }} />
          <span style={{ flex: 1, textAlign: "left" }}>{f.label}</span>
          {!!counts[f.id] && <span className={`mail-count ${f.id === "inbox" ? "blue" : ""}`}>{counts[f.id]}</span>}
        </button>
      ))}
      <div style={{ flex: 1 }} />
      <button type="button" className="mail-btn primary" style={{ margin: "8px 12px" }} onClick={() => setCompose(newDraft())}>
        <span className="i-ph:note-pencil-bold" style={{ width: 14, height: 14 }} /> Compose
      </button>
    </nav>
  );

  const list = (
    <div className="mail-list" style={{ width: narrow ? "100%" : 280 }}>
      {narrow && (
        <div className="mail-narrow-head">
          <span style={{ fontSize: 22, fontWeight: 700 }}>{folderLabel}</span>
          <button type="button" aria-label="Compose" className="mail-round-btn" onClick={() => setCompose(newDraft())}>
            <span className="i-ph:note-pencil" style={{ width: 17, height: 17 }} />
          </button>
        </div>
      )}
      {narrow && (
        <div className="mail-chips" role="tablist" aria-label="Mailboxes">
          {FOLDERS.map((f) => (
            <button type="button" role="tab" aria-selected={folder === f.id} key={f.id} className={folder === f.id ? "on" : ""} onClick={() => goFolder(f.id)}>
              {f.label}
              {!!counts[f.id] && ` ${counts[f.id]}`}
            </button>
          ))}
        </div>
      )}
      <div style={{ padding: "8px 10px", borderBottom: "0.5px solid var(--a-border)", display: "flex", gap: 8, alignItems: "center" }}>
        <label className="mail-search">
          <span className="i-ph:magnifying-glass" style={{ width: 12, height: 12, opacity: 0.5 }} />
          <input placeholder={`Search ${folderLabel}`} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={`Search ${folderLabel}`} />
        </label>
        {folder === "trash" && lists.trash.length > 0 && (
          <button type="button" className="mail-btn" style={{ color: "#FF3B30" }} onClick={emptyTrash}>
            Empty
          </button>
        )}
      </div>
      <div style={{ overflowY: "auto", flex: 1 }}>
        {folder === "drafts"
          ? drafts.map((d) => (
              <button type="button" key={d.id} className="mail-row" onClick={() => setCompose(d)}>
                <span className="mail-avatar">
                  <span className="i-ph:file-text" style={{ width: 16, height: 16 }} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="mail-row-top">
                    <span className="mail-row-from" style={{ color: "#FF3B30" }}>
                      Draft
                    </span>
                    <span className="mail-row-time">{fmt(d.at)}</span>
                  </span>
                  <span className="mail-row-subject">{d.subject.trim() || "(No subject)"}</span>
                  <span className="mail-row-preview">{preview(d.message) || "No message yet"}</span>
                </span>
              </button>
            ))
          : shown.map((m) => <Row key={m.id} m={m} />)}
        {(folder === "drafts" ? !drafts.length : !shown.length) && <div className="mail-empty">{q ? `No results for “${search.trim()}”` : emptyText[folder]}</div>}
      </div>
    </div>
  );

  const reader = (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {active && (
        <div className="mail-toolbar">
          {narrow && (
            <button type="button" className="mail-back" onClick={() => setNarrowView("list")}>
              <span className="i-ph:caret-left-bold" style={{ width: 15, height: 15 }} /> {folderLabel}
            </button>
          )}
          <div style={{ flex: 1 }} />
          {isTrashed(active.id) ? (
            <>
              <button type="button" className="mail-btn" onClick={() => restore(active.id)}>
                <span className="i-ph:arrow-counter-clockwise-bold" style={{ width: 13, height: 13 }} /> Restore
              </button>
              <button type="button" className="mail-btn" style={{ color: "#FF3B30" }} onClick={() => deleteForever(active.id)}>
                Delete Forever
              </button>
            </>
          ) : (
            <>
              {!active.id.startsWith("sent-") && (
                <button type="button" className="mail-icon-btn" title="Reply" aria-label="Reply" onClick={() => reply(active)}>
                  <span className="i-ph:arrow-bend-up-left-bold" />
                </button>
              )}
              <button
                type="button"
                className="mail-icon-btn"
                title={saved.starred.includes(active.id) ? "Unstar" : "Star"}
                aria-label={saved.starred.includes(active.id) ? "Unstar" : "Star"}
                aria-pressed={saved.starred.includes(active.id)}
                onClick={() => setStar(active.id, !saved.starred.includes(active.id))}
              >
                <span className={saved.starred.includes(active.id) ? "i-ph:star-fill" : "i-ph:star"} style={{ color: saved.starred.includes(active.id) ? "#FF9500" : undefined }} />
              </button>
              {!active.id.startsWith("sent-") && (
                <button
                  type="button"
                  className="mail-icon-btn"
                  title="Mark as unread"
                  aria-label="Mark as unread"
                  onClick={() => {
                    patch((s) => ({ read: toggle(s.read, active.id, false) }));
                    setSelected(null);
                    setNarrowView("list");
                  }}
                >
                  <span className="i-ph:envelope-simple" />
                </button>
              )}
              <button type="button" className="mail-icon-btn" title="Move to Trash" aria-label="Move to Trash" onClick={() => trash(active.id)}>
                <span className="i-ph:trash" />
              </button>
            </>
          )}
        </div>
      )}
      {active ? (
        <AnimatePresence mode="wait">
          <motion.div key={active.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="mail-reader">
            {isTrashed(active.id) && <div className="mail-banner">This message is in Trash.</div>}
            <h2>{active.subject}</h2>
            <div className="mail-meta">
              <span className="mail-avatar" style={{ width: 42, height: 42, background: "rgba(0,122,255,0.12)", color: "#007AFF" }}>
                {active.id.startsWith("sent-") ? <span className="i-ph:user" style={{ width: 20, height: 20 }} /> : <img src={profile.avatar} alt="" draggable={false} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{active.from}</div>
                <div style={{ fontSize: 11.5, color: "var(--a-text-2)" }}>
                  {active.fromEmail}
                  {active.to && ` → ${active.to}`} · {active.time || new Date(active.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                </div>
              </div>
            </div>
            <div className="mail-body">{active.body}</div>
          </motion.div>
        </AnimatePresence>
      ) : (
        <div className="mail-empty" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {folder === "drafts" ? "Pick a draft to keep writing" : "No message selected"}
        </div>
      )}
    </div>
  );

  return (
    <div className="app-theme mail-app" ref={rootRef}>
      {!narrow && sidebar}
      {(!narrow || narrowView === "list") && list}
      {(!narrow || narrowView === "message") && reader}
      <AnimatePresence>
        {compose && <Compose key={compose.id} draft={compose} onChange={setCompose} onClose={closeCompose} onSent={onSent} narrow={narrow} />}
      </AnimatePresence>
    </div>
  );
}
