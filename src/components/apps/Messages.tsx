import { motion, AnimatePresence } from "framer-motion";
import { profile } from "~/data/profile";
import { MESSAGES_FALLBACK, MESSAGES_LIMITS } from "~/data/messages";

const STORAGE_KEY = "macos-messages";
const nowTime = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// Visitor messages and AI replies, per conversation, kept in this browser.
type Saved = Record<string, Message[]>;
const loadSaved = (): Saved => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
};

async function askAssistant(history: Message[]): Promise<string> {
  const res = await fetch("/api/messages/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      history: history
        .filter((m) => !m.error)
        .slice(-MESSAGES_LIMITS.maxTurns)
        .map((m) => ({ role: m.from === "me" ? "user" : "assistant", content: m.text }))
    })
  });
  if (res.status === 429) return "You're sending messages a bit fast. Give it a minute and try again 🙂";
  if (!res.ok) throw new Error(String(res.status));
  const { reply } = await res.json();
  return reply || MESSAGES_FALLBACK;
}

interface Message {
  id: string;
  text: string;
  from: "me" | "them";
  time: string;
  /** Couldn't reach the assistant; not sent back as context. */
  error?: boolean;
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
    avatar: profile.avatar,
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
  const [activeId, setActiveId] = useState(CONVERSATIONS[0].id);
  // Phone-sized / narrow windows: iOS-style list → conversation navigation.
  const [rootRef, rootWidth] = useElementWidth();
  const narrow = rootWidth > 0 && rootWidth < 600;
  const [narrowView, setNarrowView] = useState<"list" | "chat">("list");
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState<Saved>(loadSaved);
  const [unread, setUnread] = useState<Record<string, number>>(() => Object.fromEntries(CONVERSATIONS.map((c) => [c.id, c.unread ?? 0])));
  const [typing, setTyping] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const conversations = CONVERSATIONS.map((c) => {
    const extra = saved[c.id] ?? [];
    const last = extra[extra.length - 1];
    return { ...c, messages: [...c.messages, ...extra], preview: last ? last.text : c.preview, time: last ? last.time : c.time, unread: unread[c.id] };
  });
  const activeConv = conversations.find((c) => c.id === activeId)!;
  const q = search.trim().toLowerCase();
  const listed = q ? conversations.filter((c) => `${c.name} ${c.messages.map((m) => m.text).join(" ")}`.toLowerCase().includes(q)) : conversations;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // storage blocked: chat just won't persist
    }
  }, [saved]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [activeId, saved, typing]);

  // The open conversation counts as read (on phones, only once it's shown).
  useEffect(() => {
    if (!narrow || narrowView === "chat") setUnread((u) => (u[activeId] ? { ...u, [activeId]: 0 } : u));
  }, [activeId, narrow, narrowView]);

  const add = (convId: string, msg: Message) => setSaved((prev) => ({ ...prev, [convId]: [...(prev[convId] ?? []), msg] }));

  const send = async () => {
    const text = input.trim();
    if (!text || typing) return;
    const convId = activeConv.id;
    const mine: Message = { id: Date.now().toString(), text, from: "me", time: nowTime() };
    const history = [...activeConv.messages, mine];
    add(convId, mine);
    setInput("");
    setTyping(convId);
    let reply: Message;
    try {
      reply = { id: `${Date.now()}r`, text: await askAssistant(history), from: "them", time: nowTime() };
    } catch {
      reply = { id: `${Date.now()}r`, text: MESSAGES_FALLBACK, from: "them", time: nowTime(), error: true };
    }
    add(convId, reply);
    setTyping(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const clearChat = () => setSaved((prev) => ({ ...prev, [activeConv.id]: [] }));

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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search messages"
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
            type="button"
            title="Message Ambuj"
            aria-label="New message"
            onClick={() => {
              setActiveId("intro");
              setNarrowView("chat");
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#007AFF",
              padding: "0 2px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span className="i-ph:note-pencil" style={{ width: "18px", height: "18px" }} />
          </button>
        </div>

        {/* Conversations */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {listed.map((conv) => (
            <button
              key={conv.id}
              onClick={() => {
                setActiveId(conv.id);
                setNarrowView("chat");
                setUnread((u) => ({ ...u, [conv.id]: 0 }));
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
                    : <img src={conv.avatar} alt="" draggable={false} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />}
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
              : <img src={activeConv.avatar} alt="" draggable={false} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />}
          </div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--a-text)" }}>
              {activeConv.name}
            </div>
            <div style={{ fontSize: "11px", color: "var(--a-text-2)" }}>
              Replies by {profile.firstName}'s AI assistant
            </div>
          </div>
          <div style={{ flex: 1 }} />
          {(saved[activeConv.id]?.length ?? 0) > 0 && (
            <button
              type="button"
              onClick={clearChat}
              title="Clear this chat"
              style={{ border: "none", background: "var(--a-fill)", color: "var(--a-text)", borderRadius: 8, padding: "4px 10px", fontSize: 12 }}
            >
              Clear chat
            </button>
          )}
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
            {activeConv.messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
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
          {typing === activeConv.id && (
            <div className="msg-typing" aria-label="Typing">
              <span />
              <span />
              <span />
            </div>
          )}
        </div>
        <div style={{ textAlign: "center", fontSize: 10.5, color: "var(--a-text-3)", padding: "0 12px 4px" }}>
          AI replies use only {profile.firstName}'s résumé and can be wrong. For anything important, email {profile.email}.
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
              ref={inputRef}
              value={input}
              maxLength={MESSAGES_LIMITS.maxChars}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && send()}
              placeholder={`Message ${profile.firstName}…`}
              aria-label="Message"
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
            aria-label="Send"
            disabled={!input.trim() || !!typing}
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
