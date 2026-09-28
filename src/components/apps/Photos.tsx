import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { profile, thumbOf } from "~/data/profile";

export interface Photo {
  id: string;
  url: string;
  /** Smaller image for the grid; the viewer uses `url`. */
  thumb?: string;
  label: string;
  date: string;
  liked?: boolean;
  album?: string;
}

// Real images only: project screenshots and certificates.
const PHOTOS: Photo[] = [
  ...profile.projects.flatMap((p) =>
    p.screenshots.map((s, i) => ({
      id: `${p.id}-${i}`,
      url: s.src,
      thumb: thumbOf(s.src),
      label: `${p.name} — ${s.caption}`,
      date: p.date,
      album: "projects",
    })),
  ),
  ...profile.certifications.map((c) => ({
    id: `cert-${c.id}`,
    url: c.preview,
    label: `${c.issuer} — ${c.title}`,
    date: String(c.year),
    liked: true,
    album: "certificates",
  })),
];

const ALBUMS = [
  { id: "recents", label: "Recents", icon: "i-ph:clock", count: PHOTOS.length },
  {
    id: "favorites",
    label: "Favourites",
    icon: "i-ph:heart-fill",
    count: PHOTOS.filter((p) => p.liked).length,
  },
  {
    id: "certificates",
    label: "Certificates",
    icon: "i-ph:certificate",
    count: PHOTOS.filter((p) => p.album === "certificates").length,
  },
  {
    id: "projects",
    label: "Projects",
    icon: "i-ph:laptop",
    count: PHOTOS.filter((p) => p.album === "projects").length,
  },
];

// ── Viewer ──────────────────────────────────────────────────────────────────
// Zoom: scroll / trackpad pinch toward the pointer, double-click toggles 2.5×,
// drag to pan, two-finger pinch on touch screens, keys + − 0. Clicking
// anywhere outside the photo closes the viewer.
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export function PhotoViewer({
  photo,
  onClose,
  onLike,
  onPrev,
  onNext,
}: {
  photo: Photo;
  onClose: () => void;
  /** Omit to hide the heart (e.g. Finder's Quick Look). */
  onLike?: () => void;
  /** Step through a set of photos (buttons + ← → keys). */
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [view, setView] = useState({ z: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const viewRef = useRef(view);
  viewRef.current = view;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; z: number } | null>(null);
  const moved = useRef(false);
  // Pointer capture retargets the click, so remember where the press began.
  const pressedImg = useRef(false);

  // Keep the photo covering the stage: no panning past its edges.
  const clampPan = (z: number, x: number, y: number) => {
    const img = imgRef.current;
    const stage = stageRef.current;
    if (!img || !stage) return { z, x, y };
    const maxX = Math.max(0, (img.offsetWidth * z - stage.clientWidth) / 2);
    const maxY = Math.max(0, (img.offsetHeight * z - stage.clientHeight) / 2);
    return {
      z,
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  };

  // Zoom to `z`, keeping the point under (cx, cy) (client coords) in place.
  const zoomAt = (z: number, cx?: number, cy?: number) => {
    const stage = stageRef.current;
    const cur = viewRef.current;
    const next = clampZoom(z);
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    const px = cx === undefined ? 0 : cx - (r.left + r.width / 2);
    const py = cy === undefined ? 0 : cy - (r.top + r.height / 2);
    const k = next / cur.z;
    setView(
      next === 1
        ? { z: 1, x: 0, y: 0 }
        : clampPan(next, px - (px - cur.x) * k, py - (py - cur.y) * k),
    );
  };
  const zoomAtRef = useRef(zoomAt);
  zoomAtRef.current = zoomAt;

  // Wheel must be non-passive to stop the page from scrolling.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Trackpad pinch arrives as ctrl+wheel with small deltas.
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022));
      zoomAtRef.current(viewRef.current.z * factor, e.clientX, e.clientY);
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "+" || e.key === "=")
        zoomAtRef.current(viewRef.current.z * 1.25);
      else if (e.key === "-" || e.key === "_")
        zoomAtRef.current(viewRef.current.z / 1.25);
      else if (e.key === "0") zoomAtRef.current(1);
      else if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onPrev?.();
      else if (e.key === "ArrowRight") onNext?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  // A new photo starts un-zoomed.
  useEffect(() => setView({ z: 1, x: 0, y: 0 }), [photo.url]);

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    pressedImg.current = e.target === imgRef.current;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        z: viewRef.current.z,
      };
    } else if (viewRef.current.z > 1 && e.target === imgRef.current) {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setDragging(true);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      moved.current = true;
      zoomAt(
        (pinch.current.z * Math.hypot(a.x - b.x, a.y - b.y)) /
          pinch.current.dist,
        (a.x + b.x) / 2,
        (a.y + b.y) / 2,
      );
      return;
    }
    if (!dragging) return;
    const cur = viewRef.current;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    if (Math.abs(dx) + Math.abs(dy) > 1) moved.current = true;
    setView(clampPan(cur.z, cur.x + dx, cur.y + dy));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (!pointers.current.size) setDragging(false);
  };

  const zoomed = view.z > 1;
  return (
    <motion.div
      className="photo-viewer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, pointerEvents: "none" }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <motion.div
        ref={stageRef}
        className="photo-zoom-stage"
        initial={{ scale: 0.82, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0, transition: { duration: 0.18 } }}
        transition={{ type: "spring", stiffness: 360, damping: 30 }}
        onClick={(e) => {
          // Only the photo itself (or a drag/pinch) keeps the viewer open.
          if (pressedImg.current || moved.current) e.stopPropagation();
        }}
        onDoubleClick={(e) =>
          e.target === imgRef.current &&
          zoomAt(zoomed ? 1 : 2.5, e.clientX, e.clientY)
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ overflow: zoomed ? "hidden" : "visible" }}
      >
        <img
          ref={imgRef}
          src={photo.url}
          alt={photo.label}
          draggable={false}
          style={{
            boxShadow: zoomed ? "none" : undefined,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`,
            transition:
              dragging || pinch.current ? "none" : "transform 0.18s ease-out",
            cursor: dragging ? "grabbing" : zoomed ? "grab" : "zoom-in",
          }}
        />
      </motion.div>

      {/* Glass info panel */}
      <motion.div
        className="photo-viewer-bar"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
        transition={{ delay: 0.06, duration: 0.22 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="photo-viewer-info">
          <span className="title">{photo.label}</span>
          <span className="date">{photo.date}</span>
        </div>
        <div className="photo-viewer-sep" />
        <div className="photo-zoom-ctl" role="group" aria-label="Zoom">
          <button
            type="button"
            aria-label="Zoom out"
            title="Zoom out (−)"
            disabled={view.z <= MIN_ZOOM}
            onClick={() => zoomAt(view.z / 1.5)}
          >
            <span className="i-ph:minus-bold" />
          </button>
          <button
            type="button"
            className="val"
            title="Fit (0)"
            onClick={() => zoomAt(1)}
          >
            {Math.round(view.z * 100)}%
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            title="Zoom in (+)"
            disabled={view.z >= MAX_ZOOM}
            onClick={() => zoomAt(view.z * 1.5)}
          >
            <span className="i-ph:plus-bold" />
          </button>
        </div>
        {(onPrev || onNext) && (
          <div className="photo-zoom-ctl" role="group" aria-label="Browse">
            <button type="button" aria-label="Previous" title="Previous (←)" disabled={!onPrev} onClick={onPrev}>
              <span className="i-ph:caret-left-bold" />
            </button>
            <button type="button" aria-label="Next" title="Next (→)" disabled={!onNext} onClick={onNext}>
              <span className="i-ph:caret-right-bold" />
            </button>
          </div>
        )}
        {onLike && (
          <button
            type="button"
            className={`photo-viewer-like ${photo.liked ? "on" : ""}`}
            aria-label={photo.liked ? "Unlike" : "Like"}
            onClick={onLike}
          >
            <span className={photo.liked ? "i-ph:heart-fill" : "i-ph:heart"} />
          </button>
        )}
        <button type="button" className="photo-viewer-done" onClick={onClose}>
          Done
        </button>
      </motion.div>
    </motion.div>
  );
}

export default function Photos() {
  const [photos, setPhotos] = useState(PHOTOS);
  const [selected, setSelected] = useState<string | null>(null);
  const [activeAlbum, setActiveAlbum] = useState("recents");
  const [viewPhoto, setViewPhoto] = useState<Photo | null>(null);

  const displayed =
    activeAlbum === "favorites"
      ? photos.filter((p) => p.liked)
      : activeAlbum === "recents"
        ? photos
        : photos.filter((p) => p.album === activeAlbum);

  const toggleLike = (id: string) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, liked: !p.liked } : p)),
    );
    if (viewPhoto?.id === id)
      setViewPhoto((prev) => prev && { ...prev, liked: !prev.liked });
  };

  return (
    <div
      className="photos-app-container"
      style={{
        display: "flex",
        height: "100%",
        background: "var(--c-bg)",
        borderRadius: "0 0 14px 14px",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <style>{`
        .mobile-only { display: none !important; }
        .mobile-only-block { display: none !important; }
        
        @media (max-width: 768px) {
          .mobile-only { display: flex !important; }
          .mobile-only-block { display: block !important; }
          .desktop-only { display: none !important; }
          
          .photos-sidebar { display: none !important; }
          .photos-main-area { background: #F2F2F7 !important; }
          
          .photos-header {
            padding: 24px 20px 8px 20px !important;
            border-bottom: none !important;
            background: #F2F2F7 !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            position: relative;
            display: flex !important;
          }
          
          .photos-header-title {
            font-size: 28px !important;
            font-weight: 700 !important;
            font-family: system-ui, -apple-system, sans-serif !important;
            color: #000 !important;
            margin-bottom: 2px !important;
            line-height: 1.2 !important;
          }
          
          .photos-header-subtitle {
            font-size: 13px !important;
            color: #8E8E93 !important;
            margin-left: 0 !important;
          }
          
          /* Albums: iOS segmented control, four equal parts that always fit. */
          .photos-mobile-chips {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr);
            gap: 2px !important;
            margin: 6px 16px 14px;
            padding: 2px !important;
            border-radius: 10px;
            background: rgba(118, 118, 128, 0.12) !important;
            width: auto;
            box-sizing: border-box;
          }
          .photos-chip {
            min-width: 0;
            padding: 7px 2px !important;
            border: none !important;
            border-radius: 8px !important;
            background: transparent !important;
            color: #1c1c1e !important;
            font-size: 12.5px !important;
            font-weight: 500 !important;
            white-space: nowrap !important;
            overflow: hidden;
            text-overflow: ellipsis;
            cursor: pointer;
            transition: background 0.2s ease, box-shadow 0.2s ease;
          }
          .photos-chip.active {
            background: #fff !important;
            color: #000 !important;
            font-weight: 600 !important;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 0 0 0.5px rgba(0, 0, 0, 0.04);
          }
          
          .photos-grid-container {
            padding: 0 !important;
            padding-bottom: 24px !important;
          }
          
          .photos-grid {
            padding: 0 !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 2px !important;
          }
          
          .photo-thumb {
            aspect-ratio: 1/1 !important;
            border-radius: 4px !important;
            box-shadow: none !important;
            outline: none !important;
          }
          .photo-thumb:active {
            transform: scale(0.97) !important;
            transition: transform 0.1s !important;
          }
          
          .photo-hover-label, .photo-like-badge { display: none !important; }
          
          
          /* The site's dark mode (not the phone's system setting). */
          .dark .photos-main-area, .dark .photos-header { background: #000 !important; }
          .dark .photos-header-title { color: #fff !important; }
          .dark .photos-mobile-chips { background: rgba(118, 118, 128, 0.24) !important; }
          .dark .photos-chip { color: #f2f2f7 !important; }
          .dark .photos-chip.active { background: #636366 !important; color: #fff !important; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3); }
        }
      `}</style>
      {/* Sidebar */}
      <div
        className="photos-sidebar"
        style={{
          width: "180px",
          flexShrink: 0,
          background: "var(--lg-bg-tinted)",
          backdropFilter: "var(--lg-blur-light)",
          WebkitBackdropFilter: "var(--lg-blur-light)",
          borderRight: "var(--lg-border)",
          overflowY: "auto",
          padding: "8px 0",
        }}
      >
        <div
          style={{
            fontSize: "10px",
            fontWeight: 700,
            color: "var(--c-text-tertiary)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            padding: "8px 14px 4px",
          }}
        >
          Library
        </div>
        {ALBUMS.map((album) => {
          const active = activeAlbum === album.id;
          return (
            <motion.button
              key={album.id}
              onClick={() => setActiveAlbum(album.id)}
              whileHover={{ x: 1 }}
              transition={{ duration: 0.12 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 12px",
                background: active ? "var(--c-bg-tertiary)" : "transparent",
                border: "none",
                cursor: "pointer",
                width: "calc(100% - 12px)",
                margin: "1px 6px",
                borderRadius: "7px",
                transition: "background 0.15s ease",
                position: "relative",
              }}
            >
              {active && (
                <motion.div
                  layoutId="photos-sidebar-indicator"
                  style={{
                    position: "absolute",
                    left: 0,
                    top: "20%",
                    bottom: "20%",
                    width: "2.5px",
                    borderRadius: "2px",
                    background: "var(--system-blue, #007AFF)",
                  }}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span
                className={album.icon}
                style={{
                  width: "14px",
                  height: "14px",
                  flexShrink: 0,
                  color: active
                    ? "var(--system-blue, #007AFF)"
                    : "var(--c-text-secondary)",
                }}
              />
              <span
                style={{
                  flex: 1,
                  fontSize: "13px",
                  color: active
                    ? "var(--system-blue, #007AFF)"
                    : "var(--c-text)",
                  fontWeight: active ? 600 : 500,
                  textAlign: "left",
                }}
              >
                {album.label}
              </span>
              <span
                style={{ fontSize: "11px", color: "var(--c-text-tertiary)" }}
              >
                {album.count}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Grid */}
      <div
        className="photos-main-area"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "var(--c-bg)",
        }}
      >
        <div
          className="photos-header"
          style={{
            padding: "10px 16px",
            borderBottom: "0.5px solid var(--c-border)",
            fontSize: "16px",
            fontWeight: 700,
            color: "var(--c-text)",
            display: "block",
          }}
        >
          <span className="desktop-only">
            {ALBUMS.find((a) => a.id === activeAlbum)?.label}
          </span>
          <span className="mobile-only-block photos-header-title">Library</span>

          <span
            className="photos-header-subtitle"
            style={{
              marginLeft: 8,
              fontSize: "12px",
              fontWeight: 400,
              color: "var(--c-text-tertiary)",
            }}
          >
            {displayed.length} items
          </span>
        </div>

        <div className="mobile-only photos-mobile-chips" role="tablist" aria-label="Albums">
          {ALBUMS.map((album) => (
            <button
              key={album.id}
              role="tab"
              aria-selected={activeAlbum === album.id}
              className={`photos-chip ${activeAlbum === album.id ? "active" : ""}`}
              onClick={() => setActiveAlbum(album.id)}
            >
              {album.label}
            </button>
          ))}
        </div>

        {/* Scroll in a wrapper: a fixed-height grid squeezes its rows and the
            4:3 tiles overlap. */}
        <div
          className="photos-grid-container"
          style={{ flex: 1, minHeight: 0, overflowY: "auto" }}
        >
          <div
            className="photos-grid"
            style={{
              padding: "12px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(128px, 1fr))",
              gap: "6px",
              alignContent: "start",
            }}
          >
            <AnimatePresence mode="popLayout">
              {displayed.map((photo, i) => (
                <motion.div
                  key={photo.id}
                  layout
                  className="photo-thumb"
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.88 }}
                  transition={{
                    delay: i * 0.025,
                    duration: 0.22,
                    ease: [0.25, 0.46, 0.45, 0.94],
                  }}
                  onClick={() => setViewPhoto(photo)}
                  style={{
                    position: "relative",
                    borderRadius: "10px",
                    overflow: "hidden",
                    cursor: "default",
                    aspectRatio: "4/3",
                    outline:
                      selected === photo.id
                        ? "2.5px solid var(--system-blue, #007AFF)"
                        : "2.5px solid transparent",
                    outlineOffset: "1px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                    transition: "outline-color 0.15s ease",
                  }}
                  whileHover={{
                    scale: 1.03,
                    boxShadow: "0 6px 18px rgba(0,0,0,0.2)",
                  }}
                  onMouseDown={() => setSelected(photo.id)}
                >
                  <img
                    src={photo.thumb ?? photo.url}
                    alt={photo.label}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                    loading="lazy"
                  />
                  {/* hover label */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)",
                      opacity: 0,
                      transition: "opacity 0.2s ease",
                      display: "flex",
                      alignItems: "flex-end",
                      padding: "6px 8px",
                    }}
                    className="photo-hover-label"
                  >
                    <span
                      style={{
                        fontSize: "10px",
                        color: "rgba(255,255,255,0.9)",
                        fontWeight: 500,
                        lineHeight: 1.2,
                      }}
                    >
                      {photo.label}
                    </span>
                  </div>
                  {photo.liked && (
                    <div
                      className="photo-like-badge"
                      style={{ position: "absolute", top: 5, right: 5 }}
                    >
                      <span
                        className="i-ph:heart-fill"
                        style={{
                          width: "13px",
                          height: "13px",
                          color: "var(--system-pink, #FF2D55)",
                          filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
                        }}
                      />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {viewPhoto && (
          <PhotoViewer
            key={viewPhoto.id}
            photo={viewPhoto}
            onClose={() => setViewPhoto(null)}
            onLike={() => toggleLike(viewPhoto.id)}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
