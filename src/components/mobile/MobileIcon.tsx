// One home-screen icon: an iOS squircle tile with the app's artwork.

export interface MobileEntry {
  /** App id, or `project:<id>` for a project (opens in Safari). */
  id: string;
  title: string;
  img: string;
  /** macOS artwork has a transparent margin: zoom it to fill the tile. */
  scale?: number;
  /** Tile colour behind the artwork (default white). */
  bg?: string;
  /** Projects: the live site. */
  url?: string;
  /** Open `url` in a new browser tab instead of Safari (PDFs, sites that can't be embedded). */
  external?: boolean;
}

export function MobileIcon({
  entry,
  size,
  label,
  bare,
  onOpen
}: {
  entry: MobileEntry;
  /** Tile size in px; 0 = fill the parent cell. */
  size: number;
  label?: boolean;
  /** No button wrapper (inside another button / list row). */
  bare?: boolean;
  onOpen?: (e: MobileEntry, tile: HTMLElement) => void;
}) {
  const src = entry.img.startsWith("/") || entry.img.startsWith("http") ? entry.img : `/${entry.img}`;
  const tile = (
    <span className="mi-tile" data-app-icon={entry.id} style={{ ...(size ? { width: size, height: size } : {}), ...(entry.bg ? { background: entry.bg } : {}) }}>
      <img src={src} alt="" draggable={false} style={entry.scale && entry.scale !== 1 ? { transform: `scale(${entry.scale})` } : undefined} />
    </span>
  );
  if (bare && !onOpen) return tile;
  return (
    <button
      type="button"
      className="mi"
      aria-label={entry.title}
      onClick={(e) => onOpen?.(entry, e.currentTarget.querySelector(".mi-tile") as HTMLElement)}
    >
      {tile}
      {label && <span className="mi-label">{entry.title}</span>}
    </button>
  );
}
