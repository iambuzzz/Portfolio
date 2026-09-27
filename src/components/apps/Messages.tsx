import { motion, AnimatePresence } from "framer-motion";
import { profile } from "~/data/profile";

interface Message {
  id: string;
  text: string;
  from: "me" | "them";
  time: string;
}

interface Conversation {
  id: string;
  name: string;
  avatar: string;
  preview: string;
  time: string;
  unread?: number;
  messages: Message[];
  online?: boolean;
}

// Turn bare URLs in a message into links.
const linkify = (text: string) =>
  text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noreferrer" style={{ color: "#007AFF", textDecoration: "underline" }}>
        {part}
      </a>
    ) : (
      part
    )
  );

// Every message here comes from the profile — no invented chats.
const CONVERSATIONS: Conversation[] = [
  {
    id: "intro",
    name: profile.name,
    avatar: "AJ",
    preview: "Hey! 👋 Thanks for visiting.",
    time: "Now",
    unread: 3,
    online: true,
    messages: [
      { id: "1", text: `Hey! 👋 I'm ${profile.firstName} — ${profile.role}.`, from: "them", time: "Now" },
      { id: "2", text: profile.summary, from: "them", time: "Now" },
      { id: "3", text: `Want to talk? Email me at ${profile.email} — or ask Siri anything about me.`, from: "them", time: "Now" },
    ],
  },
  {
    id: "projects",
    name: "Projects",
    avatar: "i-ph:rocket-launch",
    preview: profile.projects.map((p) => p.name).join(", "),
    time: profile.projects[0].date,
    messages: profile.projects.map((p, i) => ({
      id: String(i + 1),
      text: `${p.name}: ${p.tagline} ${p.live}`,
      from: "them" as const,
      time: p.date,
    })),
  },
  {
    id: "coding",
    name: "Coding Profiles",
    avatar: "i-ph:code",
    preview: profile.achievements[0],
    time: "Now",
    messages: [
      ...profile.achievements.map((a, i) => ({ id: String(i + 1), text: a, from: "them" as const, time: "Now" })),
      { id: "links", text: `LeetCode: ${profile.socials.leetcode}\nCodeChef: ${profile.socials.codechef}\nCodolio: ${profile.socials.codolio}`, from: "them", time: "Now" },
    ],
  },
];

export default function MessagesApp() {
  const [activeConv, setActiveConv] = useState(CONVERSATIONS[0]);
  // Phone-sized / narrow windows: iOS-style list → conversation navigation.
  const [rootRef, rootWidth] = useElementWidth();
  const narrow = rootWidth > 0 && rootWidth < 600;
  const [narrowView, setNarrowView] = useState<"list" | "chat">("list");
  const [input, setInput] = useState("");
  const [conversations, setConversations] = useState(CONVERSATIONS);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [activeConv, conversations]); // scroll to bottom on new message or conversation change

  const send = () => {
    if (!input.trim()) return;
    const newMsg: Message = {
      id: Date.now().toString(),
      text: input.trim(),
      from: "me",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConv.id
          ? { ...c, messages: [...c.messages, newMsg], preview: input.trim(), time: "Now" }
          : c
      )
    );
    setActiveConv((prev) => ({
      ...prev,
      messages: [...prev.messages, newMsg],
    }));
    setInput("");
  };

  return (
    <div className="app-theme"
      ref={rootRef}
      style={{
        display: "flex",
        height: "100%",
        
        background: "var(--a-bg)",
        borderRadius: "0 0 14px 14px",
        overflow: "hidden",
      }}
    >
      {(!narrow || narrowView === "list") && (
        <>
      {/* Sidebar */}
      <div
        style={{
          width: narrow ? "100%" : "230px",
          flexShrink: 0,
          borderRight: "0.5px solid var(--a-border)",
          background: "var(--a-bg-side)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "10px",
            borderBottom: "0.5px solid var(--a-border)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "var(--a-fill)",
              borderRadius: "9px",
              padding: "5px 9px",
            }}
          >
            <span className="i-ph:magnifying-glass" style={{ width: "11px", height: "11px", opacity: 0.5 }} />
            <input
              placeholder="Search"
              style={{
                background: "none",
                border: "none",
                outline: "none",
                fontSize: "16px",
                width: "100%",
                color: "var(--a-text)",
              }}
            />
          </div>
          <button
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "18px",
              color: "#007AFF",
              padding: "0 2px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span className="i-ph:pencil-simple" style={{ width: "18px", height: "18px" }} />
          </button>
        </div>

        {/* Conversations */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => {
                setActiveConv(conv);
                setNarrowView("chat");
                setConversations((prev) =>
                  prev.map((c) => (c.id === conv.id ? { ...c, unread: 0 } : c))
                );
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 12px",
                background: activeConv.id === conv.id ? "rgba(0,122,255,0.1)" : "transparent",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                borderRadius: "10px",
                margin: "1px 4px",
                width: "calc(100% - 8px)",
                transition: "background 0.15s ease",
              }}
            >
              {/* Avatar */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #007AFF, #AF52DE)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                  }}
                >
                  {conv.avatar.startsWith("i-")
                    ? <span className={conv.avatar} style={{ width: "20px", height: "20px", color: "white" }} />
                    : conv.avatar}
                </div>
                {conv.online && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      right: 0,
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: "#34C759",
                      border: "2px solid var(--a-bg-side)",
                    }}
                  />
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: conv.unread ? 700 : 500,
                      color: "var(--a-text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "120px",
                    }}
                  >
                    {conv.name}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--a-text-2)", flexShrink: 0 }}>
                    {conv.time}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1px" }}>
                  <span
                    style={{
                      fontSize: "12px",
                      color: conv.unread ? "var(--a-text)" : "var(--a-text-2)",
                      fontWeight: conv.unread ? 500 : 400,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "130px",
                    }}
                  >
                    {conv.preview}
                  </span>
                  {conv.unread ? (
                    <div
                      style={{
                        minWidth: 18,
                        height: 18,
                        borderRadius: 9,
                        background: "#007AFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        color: "white",
                        fontWeight: 700,
                        padding: "0 4px",
                        flexShrink: 0,
                      }}
                    >
                      {conv.unread}
                    </div>
                  ) : null}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

        </>
      )}

      {(!narrow || narrowView === "chat") && (
        <>
      {/* Chat area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div
          style={{
            padding: narrow ? "10px 12px" : "10px 16px",
            borderBottom: "0.5px solid var(--a-border)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "var(--a-bg)",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #007AFF, #AF52DE)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
            }}
          >
            {activeConv.avatar.startsWith("i-")
              ? <span className={activeConv.avatar} style={{ width: "16px", height: "16px", color: "white" }} />
              : activeConv.avatar}
          </div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--a-text)" }}>
              {activeConv.name}
            </div>
            {activeConv.online && (
              <div style={{ fontSize: "11px", color: "#34C759" }}>Active now</div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollContainerRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <AnimatePresence>
            {activeConv.messages.map((msg, i) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: i * 0.04, duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
                style={{
                  display: "flex",
                  justifyContent: msg.from === "me" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "70%",
                    padding: "8px 12px",
                    borderRadius:
                      msg.from === "me"
                        ? "18px 18px 4px 18px"
                        : "18px 18px 18px 4px",
                    background:
                      msg.from === "me"
                        ? "linear-gradient(135deg, #007AFF, #0055D4)"
                        : "var(--a-bubble)",
                    color: msg.from === "me" ? "white" : "var(--a-text)",
                    fontSize: "14px",
                    lineHeight: "1.4",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                  }}
                >
                  {linkify(msg.text)}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Input */}
        <div
          style={{
            padding: "10px 12px",
            borderTop: "0.5px solid var(--a-border)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "var(--a-bg)",
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              background: "var(--a-fill)",
              borderRadius: "20px",
              padding: "6px 14px",
              gap: "8px",
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="iMessage"
              style={{
                flex: 1,
                background: "none",
                border: "none",
                outline: "none",
                fontSize: "16px",
                color: "var(--a-text)",
              }}
            />
          </div>
          <button
            onClick={send}
            disabled={!input.trim()}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: input.trim() ? "#007AFF" : "var(--a-fill)",
              border: "none",
              cursor: input.trim() ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
              color: input.trim() ? "white" : "var(--a-text-3)",
              flexShrink: 0,
              transition: "background 0.15s ease",
            }}
          >
            ↑
          </button>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
