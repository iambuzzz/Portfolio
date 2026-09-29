import { useShallow } from "zustand/react/shallow";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import CalendarWidget from "./widgets/CalendarWidget";
import WeatherWidget from "./widgets/WeatherWidget";
import { useRef } from "react";
import { useWindowSize } from "~/hooks/useWindowSize";
import { useWidgetStore } from "~/stores/widgets";

interface NotificationCenterProps {
  show: boolean;
  onClose: () => void;
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.02 } },
  exit: { transition: { staggerChildren: 0.04, staggerDirection: -1 } },
};

const cardVariants = {
  hidden: { x: 64, opacity: 0, scale: 0.97 },
  visible: {
    x: 0, opacity: 1, scale: 1,
    transition: { type: "spring", stiffness: 360, damping: 32, mass: 0.8 },
  },
  exit: {
    x: 64, opacity: 0, scale: 0.96,
    transition: { duration: 0.18, ease: "easeIn" },
  },
};

const CARD: React.CSSProperties = {
  background: "rgba(28,28,30,0.75)",
  backdropFilter: "blur(48px) saturate(190%)",
  WebkitBackdropFilter: "blur(48px) saturate(190%)",
  border: "0.5px solid rgba(255,255,255,0.13)",
  borderRadius: 16,
};

export default function NotificationCenter({ show, onClose }: NotificationCenterProps) {
  const { notifications, dismissNotification, clearAllNotifications, focusMode, toggleFocus } =
    useStore(useShallow((s) => ({
      notifications: s.notifications,
      dismissNotification: s.dismissNotification,
      clearAllNotifications: s.clearAllNotifications,
      focusMode: s.focusMode,
      toggleFocus: s.toggleFocus,
    })));

  const { winWidth } = useWindowSize();
  const isMobile = winWidth < 768;
  // The badge counts what's in the list (it used to count only unread ones on
  // the laptop, so it said 2 next to 3 notifications).
  const unread = notifications.length;

  // Phone: swipe up anywhere on the sheet closes it (once scrolled to the end).
  const start = useRef<{ x: number; y: number } | null>(null);
  const begin = (x: number, y: number, target?: EventTarget | null) => {
    // A swipe that starts on the scrolling notifications list scrolls it; it
    // must not close the sheet.
    const list = (target as HTMLElement | null)?.closest?.(".m-nc-list");
    start.current = list && list.scrollHeight > list.clientHeight + 1 ? null : { x, y };
  };
  const end = (x: number, y: number, el: HTMLElement) => {
    const s0 = start.current;
    start.current = null;
    if (!isMobile || !s0) return;
    const dy = y - s0.y;
    const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
    if (dy < -70 && Math.abs(x - s0.x) < Math.abs(dy) && atEnd) onClose();
  };

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Transparent click-outside overlay — frosted on mobile */}
          <motion.div
            key="nc-backdrop"
            className={isMobile ? "m-nc-scrim" : undefined}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ 
              position: "fixed", 
              inset: 0, 
              zIndex: isMobile ? 9998 : 90,
              background: isMobile ? "rgba(0,0,0,0.3)" : "transparent",
              backdropFilter: isMobile ? "blur(10px)" : "none",
              WebkitBackdropFilter: isMobile ? "blur(10px)" : "none",
            }}
            onClick={onClose}
          />

          {/* Staggered column of discrete glass cards */}
          <motion.div
            key="nc-cards"
            className={isMobile ? "m-nc-sheet" : "nc-desk"}
            variants={isMobile ? undefined : containerVariants}
            initial={isMobile ? { y: "-100%", opacity: 0.5 } : "hidden"}
            animate={isMobile ? { y: 0, opacity: 1 } : "visible"}
            exit={isMobile ? { y: "-100%", opacity: 0.5 } : "exit"}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            style={{
              position: "fixed",
              top: isMobile ? 0 : 40,
              bottom: isMobile ? 0 : "auto",
              right: isMobile ? 12 : 12,
              left: isMobile ? 12 : "auto",
              width: isMobile ? "calc(100% - 24px)" : 320,
              padding: isMobile ? "50px 0 18px" : 0,
              overflowY: isMobile ? "auto" : "visible",
              zIndex: isMobile ? 9999 : 95,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
            onClick={(e) => {
              e.stopPropagation();
              // Phone: the sheet fills the screen, so tapping its empty space closes it.
              if (isMobile && e.target === e.currentTarget) onClose();
            }}
            onTouchStart={(e) => begin(e.touches[0].clientX, e.touches[0].clientY, e.target)}
            onTouchEnd={(e) => end(e.changedTouches[0].clientX, e.changedTouches[0].clientY, e.currentTarget)}
            onMouseDown={(e) => begin(e.clientX, e.clientY, e.target)}
            onMouseUp={(e) => end(e.clientX, e.clientY, e.currentTarget)}
          >
            {/* Header card */}
            <motion.div
              variants={cardVariants}
              style={{ ...CARD, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
            >
              <span style={{ fontSize: 15, fontWeight: 600, color: "white" }}>
                Notification Center
                {unread > 0 && (
                  <span style={{
                    background: "var(--accent-red)",
                    color: "white",
                    borderRadius: 10,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "1px 6px",
                    marginLeft: 6,
                  }}>{unread}</span>
                )}
              </span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {notifications.length > 0 && (
                  <button
                    onClick={clearAllNotifications}
                    style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer", padding: "2px 4px" }}
                  >
                    Clear All
                  </button>
                )}
                <button
                  onClick={toggleFocus}
                  style={{
                    background: focusMode ? "var(--accent-purple)" : "rgba(255,255,255,0.12)",
                    border: "none",
                    borderRadius: 20,
                    padding: "3px 10px",
                    fontSize: 11,
                    color: "white",
                    cursor: "pointer",
                    fontWeight: 500,
                    transition: "background 0.2s ease",
                  }}
                >
                  {focusMode ? "Focus On" : "Focus"}
                </button>
              </div>
            </motion.div>

            {/* Notifications card */}
            <motion.div variants={cardVariants} className={isMobile ? "m-nc-list" : "nc-desk-list"} style={{ ...CARD, overflow: "hidden" }}>
              {notifications.length === 0 ? (
                <div style={{ padding: "20px 16px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
                  No notifications
                </div>
              ) : (
                <div style={{ padding: "6px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
                  <AnimatePresence initial={false}>
                    {notifications.map((n) => (
                      <motion.div
                        key={n.id}
                        initial={{ opacity: 0, x: 40, scale: 0.96 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 60, scale: 0.92, transition: { duration: 0.18 } }}
                        transition={{ type: "spring", stiffness: 380, damping: 28 }}
                        style={{
                          background: n.read ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.09)",
                          border: "0.5px solid rgba(255,255,255,0.08)",
                          borderRadius: 10,
                          padding: "10px 12px",
                          display: "flex",
                          gap: 10,
                          alignItems: "flex-start",
                        }}
                      >
                        <img src={n.icon} alt={n.app} style={{ width: 30, height: 30, borderRadius: 7, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {n.title}
                            </span>
                            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", flexShrink: 0, marginLeft: 6 }}>
                              {formatDistanceToNow(n.timestamp, { addSuffix: true })}
                            </span>
                          </div>
                          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", margin: 0, lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                            {n.message}
                          </p>
                        </div>
                        <button
                          onClick={() => dismissNotification(n.id)}
                          style={{
                            background: "rgba(255,255,255,0.12)",
                            border: "none",
                            borderRadius: "50%",
                            width: 18,
                            height: 18,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            flexShrink: 0,
                            color: "rgba(255,255,255,0.6)",
                            fontSize: 10,
                            fontWeight: 700,
                            marginTop: -2,
                          }}
                        >
                          ×
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>

            {isMobile && (
              <div aria-hidden style={{ position: "fixed", left: "50%", bottom: 8, width: 138, height: 5, marginLeft: -69, borderRadius: 3, background: "rgba(255,255,255,0.85)", pointerEvents: "none" }} />
            )}

            {/* Weather card */}
            <motion.div variants={cardVariants} style={{ alignSelf: isMobile ? "flex-start" : undefined }}>
              <WeatherWidget />
            </motion.div>

            {/* Calendar card */}
            <motion.div variants={cardVariants} style={{ alignSelf: isMobile ? "flex-start" : undefined }}>
              <CalendarWidget />
            </motion.div>

            {/* Phone: Close. Desktop: opens the widget gallery. */}
            <motion.div variants={cardVariants} style={{ display: "flex", justifyContent: "center", paddingTop: 2 }}>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (!isMobile) useWidgetStore.getState().setGalleryOpen(true);
                }}
                style={{
                  background: "rgba(120,120,128,0.32)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  border: "none",
                  borderRadius: 20,
                  padding: isMobile ? "8px 22px" : "5px 14px",
                  fontSize: isMobile ? 14 : 12,
                  fontWeight: 500,
                  color: "white",
                  cursor: "pointer",
                }}
              >
                {isMobile ? "Close" : "Edit Widgets"}
              </button>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
