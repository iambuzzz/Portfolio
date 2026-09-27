import React from "react";
import { Rnd } from "react-rnd";
import { minMarginX, minMarginY, appBarHeight } from "~/utils";
import { motion } from "framer-motion";

const FullIcon = ({ size }: { size: number }) => (
  <svg className="icon" viewBox="0 0 13 13" width={size} height={size}
    xmlns="http://www.w3.org/2000/svg" fillRule="evenodd" clipRule="evenodd"
    strokeLinejoin="round" strokeMiterlimit={2}>
    <path d="M9.26 12.03L.006 2.73v9.3H9.26zM2.735.012l9.3 9.3v-9.3h-9.3z" />
  </svg>
);

const ExitFullIcon = ({ size }: { size: number }) => (
  <svg className="icon" viewBox="0 0 19 19" width={size} height={size}
    xmlns="http://www.w3.org/2000/svg" fillRule="evenodd" clipRule="evenodd"
    strokeLinejoin="round" strokeMiterlimit={2}>
    <path d="M18.373 9.23L9.75.606V9.23h8.624zM.6 9.742l8.623 8.624V9.742H.599z" />
  </svg>
);

interface TrafficProps {
  id: string;
  max: boolean;
  aspectRatio?: number;
  setMax: (id: string, target?: boolean) => void;
  setMin: (id: string) => void;
  close: (id: string) => void;
}

interface WindowProps extends TrafficProps {
  title: string;
  min: boolean;
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  x?: number;
  y?: number;
  z: number;
  titlebar?: "default" | "transparent" | "hidden";
  focus: (id: string) => void;
  children: React.ReactNode;
}

interface WindowState {
  width: number;
  height: number;
  x: number;
  y: number;
}

const TrafficLights = ({ id, close, aspectRatio, max, setMax, setMin }: TrafficProps) => {
  const disableMax = aspectRatio !== undefined;
  const [hovered, setHovered] = useState(false);

  const btnStyle: React.CSSProperties = {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    cursor: "default",
    transition: "filter 0.15s ease",
    padding: 0,
    outline: "none",
    flexShrink: 0,
  };

  return (
    <div
      className="traffic-lights flex flex-row absolute left-0 items-center"
      style={{ paddingLeft: "10px", gap: "8px", height: "100%" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        style={{ ...btnStyle, backgroundColor: "#FF5F57" }}
        onClick={(e) => { e.stopPropagation(); close(id); }}
      >
        {hovered && <span className="icon i-ph:x-bold" style={{ fontSize: "8px", color: "rgba(0,0,0,0.5)" }} />}
      </button>
      <button
        style={{ ...btnStyle, backgroundColor: max ? "#999" : "#FDBC40", opacity: max ? 0.5 : 1 }}
        onClick={(e) => { e.stopPropagation(); setMin(id); }}
        disabled={max}
      >
        {hovered && !max && <span className="icon i-ph:minus-bold" style={{ fontSize: "9px", color: "rgba(0,0,0,0.5)" }} />}
      </button>
      <button
        style={{ ...btnStyle, backgroundColor: disableMax ? "#999" : "#28C840", opacity: disableMax ? 0.5 : 1 }}
        onClick={(e) => { e.stopPropagation(); !disableMax && setMax(id); }}
        disabled={disableMax}
      >
        {hovered && !disableMax && (max ? <ExitFullIcon size={8} /> : <FullIcon size={6} />)}
      </button>
    </div>
  );
};

const Window = (props: WindowProps) => {
  const dockSize = useStore((state) => state.dockSize);
  const { winWidth, winHeight } = useWindowSize();

  const initWidth = Math.min(winWidth, props.width || 640);
  const initHeight = Math.min(winHeight, props.height || 400);

  // Keep windows reachable: at least minMarginX of the window stays on screen
  // horizontally, and the title bar stays between the menu bar and the dock.
  // (x is offset by winWidth because window-bound is sized 2× the viewport.)
  const clamp = useCallback(
    (x: number, y: number, w: number) => ({
      x: Math.round(Math.min(winWidth * 2 - minMarginX, Math.max(winWidth - w + minMarginX, x))),
      y: Math.round(Math.min(winHeight - minMarginY - (dockSize + 15 + minMarginY), Math.max(0, y))),
    }),
    [winWidth, winHeight, dockSize]
  );

  // State always holds the clamped position so react-rnd's internal drag
  // position matches what is rendered (a mismatch made the first drag/click
  // after opening jump or lag).
  const [state, setState] = useState<WindowState>(() => ({
    width: initWidth,
    height: initHeight,
    ...clamp(
      winWidth + (winWidth - initWidth) / 2 + (props.x || 0),
      (winHeight - initHeight - dockSize - minMarginY) / 2 + (props.y || 0),
      initWidth
    ),
  }));

  useEffect(() => {
    setState((prev) => {
      const width = Math.min(winWidth, prev.width);
      return { ...prev, width, height: Math.min(winHeight, prev.height), ...clamp(prev.x, prev.y, width) };
    });
  }, [winWidth, winHeight, clamp]);

  const isMobile = winWidth < 768;
  const round = (props.max || isMobile) ? "rounded-none" : "";
  const minimized = props.min ? "opacity-0 invisible transition-opacity duration-300" : "";
  const width = (props.max || isMobile) ? winWidth : state.width;
  const height = (props.max || isMobile) ? winHeight : state.height;
  const disableMax = props.aspectRatio !== undefined;

  const children = React.cloneElement(props.children as React.ReactElement, { width });

  return (
    <Rnd
      bounds="parent"
      size={{ width, height }}
      position={
        props.max || isMobile ? { x: winWidth, y: -minMarginY } : { x: state.x, y: state.y }
      }
      onDragStop={(_, d) => setState((prev) => ({ ...prev, ...clamp(d.x, d.y, prev.width) }))}
      onResizeStop={(_, __, ref, ___, position) =>
        setState((prev) => ({
          ...prev,
          width: parseInt(ref.style.width),
          height: parseInt(ref.style.height),
          ...clamp(position.x, position.y, parseInt(ref.style.width)),
        }))
      }
      minWidth={props.minWidth ?? 200}
      minHeight={props.minHeight ?? 150}
      dragHandleClassName="window-bar"
      // Clicking the traffic lights must never start a drag.
      cancel=".traffic-lights button"
      disableDragging={props.max || isMobile}
      enableResizing={!(props.max || isMobile)}
      lockAspectRatio={props.aspectRatio}
      lockAspectRatioExtraHeight={props.aspectRatio ? appBarHeight : undefined}
      style={{ zIndex: props.z, pointerEvents: "auto" }}
      onMouseDown={() => props.focus(props.id)}
      className={`overflow-clip ${round} ${minimized}`}
      id={`window-${props.id}`}
    >
      {/* macOS Tahoe Liquid Glass window shell */}
      <motion.div
        initial={{ opacity: 0, scale: 0.3, y: "100vh", borderRadius: 28 }}
        animate={{ opacity: 1, scale: 1, y: 0, borderRadius: props.max ? 0 : 12 }}
        exit={{ 
          opacity: [1, 0, 0], 
          scale: 0.3, 
          y: "100vh", 
          borderRadius: 28,
          transition: { 
            duration: 0.35, 
            ease: [0.32, 0.72, 0, 1],
            opacity: { times: [0, 0.8, 1], ease: "linear" }
          } 
        }}
        transition={{ duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
        style={{
          width: "100%",
          height: "100%",
          transformOrigin: `calc(var(--launch-origin-x, 50vw) - ${state.x}px) calc(var(--launch-origin-y, 100vh) - ${state.y}px)`,
          overflow: "hidden",
          background: props.titlebar === "transparent" ? "transparent" : "var(--lg-bg-clear)",
          backdropFilter: props.titlebar === "transparent" ? "none" : "var(--lg-blur-heavy)",
          WebkitBackdropFilter: props.titlebar === "transparent" ? "none" : "var(--lg-blur-heavy)",
          boxShadow: props.max ? "none" : "var(--shadow-window), var(--lg-inner-highlight)",
          border: props.max ? "none" : "var(--lg-border-subtle)",
          transition: "box-shadow 0.3s ease",
        }}
      >
        {/* Tahoe title bar */}
        {props.titlebar !== "hidden" && (
          <div
            className="window-bar relative text-center"
            style={{
              height: props.titlebar === "transparent" ? "40px" : "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: props.titlebar === "transparent" ? "transparent" : "var(--window-bar-bg)",
              backdropFilter: props.titlebar === "transparent" ? "none" : "var(--lg-blur-menu)",
              WebkitBackdropFilter: props.titlebar === "transparent" ? "none" : "var(--lg-blur-menu)",
              borderBottom: props.titlebar === "transparent" ? "none" : "0.5px solid rgba(0,0,0,0.06)",
              userSelect: "none",
              WebkitUserSelect: "none",
              position: props.titlebar === "transparent" ? "absolute" : "relative",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10,
            }}
            onDoubleClick={() => !disableMax && props.setMax(props.id)}
          >
            <TrafficLights
              id={props.id}
              max={props.max}
              aspectRatio={props.aspectRatio}
              setMax={props.setMax}
              setMin={props.setMin}
              close={props.close}
            />
            {props.titlebar !== "transparent" && (
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  opacity: 0.7,
                  letterSpacing: "0.2px",
                  fontFamily: "var(--font-system)",
                }}
                className="text-c-700"
              >
                {props.title}
              </span>
            )}
          </div>
        )}

        {/* Window content */}
        <motion.div 
          className="w-full overflow-y-hidden" 
          style={{ height: props.titlebar === "transparent" || props.titlebar === "hidden" ? "100%" : "calc(100% - 32px)" }}
          initial={{ opacity: 0, filter: "blur(8px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.15, delay: 0.35, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </motion.div>
    </Rnd>
  );
};

export default Window;
