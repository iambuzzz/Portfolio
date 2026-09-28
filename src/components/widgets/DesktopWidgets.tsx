import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useWidgetStore, WIDGET_CATALOG, type WidgetKind } from "~/stores/widgets";
import CalendarWidget from "./CalendarWidget";
import WeatherWidget from "./WeatherWidget";
import ClockWidget from "./ClockWidget";
import BatteryWidget from "./BatteryWidget";
import GitHubWidget from "./GitHubWidget";

const MENU_BAR = 32;
const DOCK_CLEARANCE = 90;
const DRAG_THRESHOLD = 4;

const renderWidget = (id: WidgetKind) => {
  switch (id) {
    case "calendar":
      return <CalendarWidget compact={false} />;
    case "weather":
      return <WeatherWidget compact={false} />;
    case "github":
      return <GitHubWidget />;
    case "clock":
      return <ClockWidget />;
    case "battery":
      return <BatteryWidget />;
  }
};

const RemoveButton = ({ onClick }: { onClick: () => void }) => (
  <button
    aria-label="Remove widget"
    className="flex-center"
    onPointerDown={(e) => e.stopPropagation()}
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    style={{
      position: "absolute",
      top: -8,
      left: -8,
      width: 22,
      height: 22,
      borderRadius: "50%",
      background: "rgba(60,60,67,0.85)",
      border: "0.5px solid rgba(255,255,255,0.35)",
      color: "white",
      boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
      zIndex: 2,
      cursor: "default"
    }}
  >
    <span className="i-ph:minus-bold" style={{ width: 12, height: 12 }} />
  </button>
);

function DraggableWidget({ id, x, y, editing }: { id: WidgetKind; x: number; y: number; editing: boolean }) {
  const moveWidget = useWidgetStore((s) => s.moveWidget);
  const removeWidget = useWidgetStore((s) => s.removeWidget);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; startY: number; moved: boolean } | null>(null);
  const [offset, setOffset] = useState<{ dx: number; dy: number } | null>(null);
  // A drag ends with a click on the widget; swallow it so links don't open.
  const justDragged = useRef(false);
  const [hovered, setHovered] = useState(false);

  const clampPos = (nx: number, ny: number) => {
    const el = ref.current;
    const w = el?.offsetWidth ?? 200;
    const h = el?.offsetHeight ?? 150;
    return {
      x: Math.round(Math.min(window.innerWidth - w - 8, Math.max(8, nx))),
      y: Math.round(Math.min(window.innerHeight - h - DOCK_CLEARANCE, Math.max(MENU_BAR + 8, ny)))
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { startX: e.clientX, startY: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    d.moved = true;
    const p = clampPos(x + dx, y + dy);
    setOffset({ dx: p.x - x, dy: p.y - y });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    justDragged.current = !!d?.moved;
    if (d?.moved && offset) moveWidget(id, x + offset.dx, y + offset.dy);
    setOffset(null);
  };

  const dragging = offset !== null;

  return (
    <motion.div
      ref={ref}
      data-widget={id}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: dragging ? 1.03 : 1 }}
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.18 } }}
      transition={{ duration: 0.2 }}
      style={{
        position: "fixed",
        left: x,
        top: y,
        translateX: offset?.dx ?? 0,
        translateY: offset?.dy ?? 0,
        zIndex: dragging ? 58 : 55,
        cursor: dragging ? "grabbing" : "default",
        touchAction: "none",
        userSelect: "none",
        filter: dragging ? "drop-shadow(0 12px 24px rgba(0,0,0,0.35))" : undefined
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={(e) => {
        if (justDragged.current) {
          e.preventDefault();
          e.stopPropagation();
          justDragged.current = false;
        }
      }}
      onDragStart={(e) => e.preventDefault()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {(editing || (hovered && !dragging)) && <RemoveButton onClick={() => removeWidget(id)} />}
      <motion.div
        animate={editing ? { rotate: [-0.6, 0.6, -0.6] } : { rotate: 0 }}
        transition={editing ? { repeat: Infinity, duration: 0.35 } : { duration: 0.15 }}
      >
        {renderWidget(id)}
      </motion.div>
    </motion.div>
  );
}

function WidgetGallery() {
  const widgets = useWidgetStore((s) => s.widgets);
  const addWidget = useWidgetStore((s) => s.addWidget);
  const removeWidget = useWidgetStore((s) => s.removeWidget);
  const resetWidgets = useWidgetStore((s) => s.resetWidgets);
  const setGalleryOpen = useWidgetStore((s) => s.setGalleryOpen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setGalleryOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setGalleryOpen]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
      onContextMenu={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        left: "50%",
        bottom: 96,
        translateX: "-50%",
        width: "min(760px, calc(100vw - 32px))",
        zIndex: 1050,
        padding: "16px 18px",
        borderRadius: 22,
        background: "var(--lg-bg-tinted)",
        backdropFilter: "var(--lg-blur-heavy)",
        WebkitBackdropFilter: "var(--lg-blur-heavy)",
        border: "var(--lg-border)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        fontFamily: "var(--font-system)"
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <div className="text-c-black dark:text-white" style={{ fontSize: 15, fontWeight: 600 }}>
          Widgets
        </div>
        <div className="flex items-center" style={{ gap: 8 }}>
          <button
            onClick={resetWidgets}
            className="text-c-black dark:text-white"
            style={{ fontSize: 12, padding: "4px 10px", borderRadius: 8, background: "rgba(127,127,127,0.18)" }}
          >
            Reset Layout
          </button>
          <button
            onClick={() => setGalleryOpen(false)}
            style={{ fontSize: 12, padding: "4px 14px", borderRadius: 8, background: "var(--accent-blue, #007AFF)", color: "white", fontWeight: 600 }}
          >
            Done
          </button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
        {WIDGET_CATALOG.map((w) => {
          const added = widgets.some((p) => p.id === w.id);
          return (
            <div
              key={w.id}
              style={{
                borderRadius: 14,
                padding: 10,
                background: "rgba(127,127,127,0.12)",
                display: "flex",
                flexDirection: "column",
                gap: 8
              }}
            >
              <div
                className="flex-center"
                style={{ height: 120, overflow: "hidden", pointerEvents: "none" }}
                aria-hidden
              >
                <div style={{ transform: "scale(0.6)" }}>{renderWidget(w.id)}</div>
              </div>
              <div>
                <div className="text-c-black dark:text-white" style={{ fontSize: 13, fontWeight: 600 }}>
                  {w.name}
                </div>
                <div className="text-c-500" style={{ fontSize: 11 }}>
                  {w.description}
                </div>
              </div>
              <button
                onClick={() => (added ? removeWidget(w.id) : addWidget(w.id))}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "4px 0",
                  borderRadius: 8,
                  background: added ? "rgba(127,127,127,0.2)" : "var(--accent-blue, #007AFF)",
                  color: added ? "inherit" : "white"
                }}
                className={added ? "text-c-black dark:text-white" : ""}
              >
                {added ? "Remove" : "Add Widget"}
              </button>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

export default function DesktopWidgets() {
  const widgets = useWidgetStore((s) => s.widgets);
  const galleryOpen = useWidgetStore((s) => s.galleryOpen);
  const tidy = useWidgetStore((s) => s.tidy);

  // Once widgets have rendered (real sizes known), fix any overlaps.
  useEffect(() => {
    const t = setTimeout(tidy, 600);
    window.addEventListener("resize", tidy);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", tidy);
    };
  }, [tidy]);

  return (
    <>
      <AnimatePresence>
        {widgets.map((w) => (
          <DraggableWidget key={`${w.id}-${w.key ?? 0}`} id={w.id} x={w.x} y={w.y} editing={galleryOpen} />
        ))}
      </AnimatePresence>
      <AnimatePresence>{galleryOpen && <WidgetGallery />}</AnimatePresence>
    </>
  );
}
