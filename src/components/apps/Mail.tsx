import { motion, AnimatePresence } from "framer-motion";
import { profile } from "~/data/profile";

interface MailMessage {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  preview: string;
  body: string;
  time: string;
  unread?: boolean;
  starred?: boolean;
  avatar: string;
}

const MESSAGES: MailMessage[] = [
  {
    id: "welcome",
    from: profile.name,
    fromEmail: profile.email,
    subject: "Thanks for stopping by 👋",
    preview: `Hi! I'm ${profile.firstName} — ${profile.role}.`,
    body: `Hi there,

Thanks for exploring my portfolio! I'm ${profile.name}, ${profile.role}.

${profile.summary}

You can reach me at:
• Email: ${profile.email}
• GitHub: ${profile.socials.github}
• LinkedIn: ${profile.socials.linkedin}

My résumé is in Finder, or just ask Siri.

— ${profile.firstName}`,
    time: "Now",
    unread: true,
    starred: true,
    avatar: "AJ",
  },
  ...profile.projects.map((p, i) => ({
    id: `project-${p.id}`,
    from: profile.name,
    fromEmail: profile.email,
    subject: `Project: ${p.name}`,
    preview: p.tagline,
    body: `${p.tagline}

Stack: ${p.stack.join(", ")}

${p.highlights.map((h) => `• ${h}`).join("\n")}

Live: ${p.live}
GitHub: ${p.github}`,
    time: p.date,
    unread: i === 0,
    avatar: "AJ",
  })),
];

const FOLDERS = ["Inbox", "Sent", "Drafts", "Starred", "Trash"];

export default function Mail() {
  const [selected, setSelected] = useState<string>(MESSAGES[0].id);
  const [activeFolder, setActiveFolder] = useState("Inbox");
  const [search, setSearch] = useState("");
  const [composing, setComposing] = useState(false);

  const filtered = search.trim()
    ? MESSAGES.filter(
        (m) =>
          m.subject.toLowerCase().includes(search.toLowerCase()) ||
          m.from.toLowerCase().includes(search.toLowerCase()) ||
          m.preview.toLowerCase().includes(search.toLowerCase())
      )
    : MESSAGES;

  const activeMsg = MESSAGES.find((m) => m.id === selected);

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
      {/* Sidebar — folders */}
      <div
        style={{
          width: "160px",
          flexShrink: 0,
          background: "var(--a-bg-side)",
          borderRight: "0.5px solid var(--a-border)",
          display: "flex",
          flexDirection: "column",
          padding: "8px 0",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "var(--a-text-3)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            padding: "6px 14px 4px",
          }}
        >
          Mailboxes
        </div>
        {FOLDERS.map((folder) => (
          <div
            key={folder}
            onClick={() => setActiveFolder(folder)}
            style={{
              padding: "6px 14px",
              borderRadius: "7px",
              margin: "1px 6px",
              cursor: "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: activeFolder === folder ? "rgba(0,122,255,0.12)" : "transparent",
              color: activeFolder === folder ? "#007AFF" : "var(--a-text)",
              fontSize: "13px",
              transition: "background 0.15s ease",
            }}
          >
            <span>{folder}</span>
            {folder === "Inbox" && (
              <span
                style={{
                  background: "#007AFF",
                  color: "#fff",
                  borderRadius: "10px",
                  fontSize: "10px",
                  fontWeight: 600,
                  padding: "1px 6px",
                  minWidth: "18px",
                  textAlign: "center",
                }}
              >
                {MESSAGES.filter((m) => m.unread).length}
              </span>
            )}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setComposing(true)}
          style={{
            margin: "8px 12px",
            background: "#007AFF",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "7px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "4px",
          }}
        >
          <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span> Compose
        </button>
      </div>

      {/* Message list */}
      <div
        style={{
          width: "260px",
          flexShrink: 0,
          borderRight: "0.5px solid var(--a-border)",
          background: "var(--a-bg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Search */}
        <div style={{ padding: "8px 10px", borderBottom: "0.5px solid var(--a-border)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              background: "var(--a-fill)",
              borderRadius: "7px",
              padding: "5px 8px",
            }}
          >
            <span className="i-ph:magnifying-glass" style={{ width: "11px", height: "11px", opacity: 0.5 }} />
            <input
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: "none",
                border: "none",
                outline: "none",
                fontSize: "12px",
                width: "100%",
                color: "var(--a-text)",
              }}
            />
          </div>
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {filtered.map((msg) => (
            <motion.div
              key={msg.id}
              onClick={() => setSelected(msg.id)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                padding: "10px 14px",
                borderBottom: "0.5px solid var(--a-border)",
                cursor: "default",
                background:
                  selected === msg.id
                    ? "rgba(0,122,255,0.1)"
                    : "transparent",
                transition: "background 0.12s ease",
                position: "relative",
              }}
            >
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                {/* Avatar */}
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: msg.unread ? "rgba(0,122,255,0.15)" : "var(--a-fill)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                    flexShrink: 0,
                    fontWeight: 600,
                    color: msg.unread ? "#007AFF" : "var(--a-text-2)",
                  }}
                >
                  {msg.avatar.startsWith("i-")
                    ? <span className={msg.avatar} style={{ width: "18px", height: "18px" }} />
                    : msg.avatar}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: msg.unread ? 700 : 500,
                        color: "var(--a-text)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                      }}
                    >
                      {msg.from}
                    </span>
                    <span style={{ fontSize: "10px", color: "var(--a-text-2)", flexShrink: 0, marginLeft: "6px" }}>
                      {msg.time}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--a-text)",
                      fontWeight: msg.unread ? 600 : 400,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      marginTop: "1px",
                    }}
                  >
                    {msg.subject}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--a-text-2)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      marginTop: "1px",
                    }}
                  >
                    {msg.preview}
                  </div>
                </div>
              </div>
              {msg.unread && (
                <div
                  style={{
                    position: "absolute",
                    left: "6px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#007AFF",
                  }}
                />
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Message view */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {activeMsg ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeMsg.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                padding: "24px 28px",
                overflowY: "auto",
                background: "var(--a-bg)",
              }}
            >
              <h2
                style={{
                  fontSize: "20px",
                  fontWeight: 700,
                  color: "var(--a-text)",
                  margin: "0 0 12px",
                }}
              >
                {activeMsg.subject}
              </h2>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "20px" }}>
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "50%",
                    background: "rgba(0,122,255,0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    fontWeight: 600,
                    color: "#007AFF",
                  }}
                >
                  {activeMsg.avatar.startsWith("i-")
                    ? <span className={activeMsg.avatar} style={{ width: "20px", height: "20px" }} />
                    : activeMsg.avatar}
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--a-text)" }}>{activeMsg.from}</div>
                  <div style={{ fontSize: "11px", color: "var(--a-text-2)" }}>
                    {activeMsg.fromEmail} · {activeMsg.time}
                  </div>
                </div>
                {activeMsg.starred && (
                  <span style={{ marginLeft: "auto" }}>
                    <span className="i-ph:star-fill" style={{ width: "18px", height: "18px", color: "#FF9500" }} />
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: "14px",
                  lineHeight: "1.65",
                  color: "var(--a-text)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {activeMsg.body}
              </div>
            </motion.div>
          </AnimatePresence>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--a-text-3)",
              fontSize: "14px",
            }}
          >
            Select a message
          </div>
        )}
      </div>

      {/* Compose overlay */}
      <AnimatePresence>
        {composing && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{
              position: "absolute",
              bottom: "20px",
              right: "20px",
              width: "420px",
              background: "var(--a-bg)",
              borderRadius: "12px",
              boxShadow: "0 16px 60px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.1)",
              border: "0.5px solid var(--a-border)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              zIndex: 10,
            }}
          >
            <div
              style={{
                padding: "10px 14px",
                background: "var(--a-bg-side)",
                borderBottom: "0.5px solid var(--a-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--a-text)" }}>New Message</span>
              <button
                onClick={() => setComposing(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "16px",
                  color: "var(--a-text-2)",
                  lineHeight: 1,
                  padding: "2px",
                }}
              >
                ×
              </button>
            </div>
            {["To", "Subject"].map((label) => (
              <div
                key={label}
                style={{
                  padding: "8px 14px",
                  borderBottom: "0.5px solid var(--a-border)",
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: "12px", color: "var(--a-text-2)", width: "46px" }}>{label}:</span>
                <input
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    fontSize: "13px",
                    background: "transparent",
                    color: "var(--a-text)",
                  }}
                />
              </div>
            ))}
            <textarea
              placeholder="Write your message..."
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                resize: "none",
                fontSize: "13px",
                lineHeight: "1.6",
                color: "var(--a-text)",
                padding: "12px 14px",
                background: "transparent",
                height: "180px",
              }}
            />
            <div
              style={{
                padding: "8px 14px",
                borderTop: "0.5px solid var(--a-border)",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                style={{
                  background: "#007AFF",
                  color: "#fff",
                  border: "none",
                  borderRadius: "7px",
                  padding: "6px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Send
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
