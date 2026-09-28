import React, { useRef, useState } from "react";
import Webcam from "react-webcam";
import { format } from "date-fns";
import { useStore } from "~/stores";
import { motion } from "framer-motion";
import { unlock } from "~/settings/activity";
import { useLayerActive } from "~/components/mobile/layerActive";

interface SidebarProps {
  state: FaceTimeState;
  onTake: () => void;
  onSave: () => void;
  onSelect: (src: string) => void;
  onDelete: (date: string) => void;
}

interface SidebarItemProps {
  date: string;
  src: string;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

interface FaceTimeState {
  canSave: boolean;
  curImage: string | null;
}

const download = (src: string, date: string) => {
  const a = document.createElement("a");
  a.href = src;
  a.download = `FaceTime ${format(Number(date), "yyyy-MM-dd 'at' HH.mm.ss")}.jpg`;
  a.click();
};

const iconBtn: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,0.1)",
  color: "rgba(255,255,255,0.8)",
  flexShrink: 0
};

const SidebarItem = ({ date, src, active, onSelect, onDelete }: SidebarItemProps) => {
  const [hover, setHover] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Photo from ${format(Number(date), "h:mm a")}`}
      onClick={onSelect}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        height: "60px",
        padding: "0 10px",
        borderRadius: "8px",
        gap: "10px",
        cursor: "pointer",
        background: active ? "var(--lg-border)" : hover ? "rgba(255,255,255,0.06)" : "transparent",
        transition: "background 0.15s ease"
      }}
    >
      <img src={src} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
      <div style={{ textAlign: "left", flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: "14px", color: "rgba(255,255,255,0.9)" }}>Photo</div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "rgba(255,255,255,0.6)", fontSize: "12px", marginTop: "2px" }}>
          <span className="i-ph:camera" />
          <span>{format(Number(date), "h:mm:ss a")}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, opacity: hover || active ? 1 : 0, transition: "opacity 0.15s ease" }}>
        <button
          aria-label="Download photo"
          title="Download"
          style={iconBtn}
          onClick={(e) => {
            e.stopPropagation();
            download(src, date);
          }}
        >
          <span className="i-ph:download-simple-bold" style={{ fontSize: 13 }} />
        </button>
        <button
          aria-label="Delete photo"
          title="Delete"
          style={{ ...iconBtn, color: "#ff6b6b" }}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <span className="i-ph:trash-bold" style={{ fontSize: 13 }} />
        </button>
      </div>
    </div>
  );
};

const Sidebar = ({ state, onTake, onSave, onSelect, onDelete }: SidebarProps) => {
  const images = useStore((state) => state.faceTimeImages);

  return (
    <div 
        style={{
            position: "absolute",
            width: "260px",
            height: "100%",
            zIndex: 10,
            left: 0,
            top: 0,
            display: "flex",
            flexDirection: "column",
            background: "rgba(30,30,32,0.6)",
            backdropFilter: "blur(40px) saturate(150%)",
            WebkitBackdropFilter: "blur(40px) saturate(150%)",
            borderRight: "1px solid rgba(255,255,255,0.1)",
        }}
    >
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <button
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            width: "100%",
            padding: "8px 0",
            color: "white",
            background: "rgba(52,199,89,0.9)",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
          onClick={onTake}
        >
          <span className="i-ph:aperture" style={{ fontSize: "16px" }} />
          <span>{state.curImage ? "Retake" : "Take a Picture"}</span>
        </button>
        <button
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            width: "100%",
            padding: "8px 0",
            color: "white",
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 500,
            cursor: state.canSave ? "pointer" : "not-allowed",
            opacity: state.canSave ? 1 : 0.5,
          }}
          disabled={!state.canSave}
          onClick={onSave}
        >
          <span
            className={state.canSave ? "i-ph:download-simple" : "i-ph:download-simple"}
            style={{ fontSize: "16px" }}
          />
          <span>Save Picture</span>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 12px" }}>
        <div style={{ padding: "0 10px", color: "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
            Recent
        </div>
        {Object.keys(images).length === 0 && (
          <div style={{ padding: "4px 10px", color: "rgba(255,255,255,0.45)", fontSize: 12, lineHeight: 1.5 }}>
            Photos you save appear here. They stay in this tab only — nothing is uploaded.
          </div>
        )}
        {Object.keys(images)
          .reverse()
          .map((date) => (
            <SidebarItem
              key={date}
              date={date}
              src={images[date]}
              active={state.curImage === images[date]}
              onSelect={() => onSelect(images[date])}
              onDelete={() => onDelete(date)}
            />
          ))}
      </div>
    </div>
  );
};

const FaceTime = () => {
  const webcamRef = useRef<Webcam>(null);
  // Phone: turn the camera off while FaceTime waits in the app switcher.
  const active = useLayerActive();
  const addImage = useStore((state) => state.addFaceTimeImage);
  const deleteImage = useStore((state) => state.delFaceTimeImage);
  const images = useStore((state) => state.faceTimeImages);
  const [state, setState] = useState<FaceTimeState>({
    canSave: false,
    curImage: null
  });

  const take = () => {
    if (!state.curImage) {
      const src = webcamRef.current?.getScreenshot() || "";
      if (src) unlock("cheese");
      setState({ curImage: src, canSave: true });
    } else setState({ curImage: null, canSave: false });
  };
  const save = () => {
    addImage(state.curImage!);
    setState({ curImage: null, canSave: false });
  };
  const remove = (date: string) => {
    // Deleting the photo on screen goes back to the camera.
    if (state.curImage === images[date]) setState({ curImage: null, canSave: false });
    deleteImage(date);
  };

  // Phone / narrow window: full-screen camera with iPhone Camera controls.
  const [rootRef, width] = useElementWidth();
  const narrow = width > 0 && width < 768;
  const [showRoll, setShowRoll] = useState(false);
  const saved = Object.keys(images).reverse();
  const viewingDate = saved.find((d) => images[d] === state.curImage && !state.canSave);

  if (narrow) {
    return (
      <div ref={rootRef} className="ft-narrow">
        {!state.curImage ? (
          active && <Webcam mirrored audio={false} ref={webcamRef} screenshotFormat="image/jpeg" className="ft-view" videoConstraints={{ facingMode: "user" }} />
        ) : (
          <img src={state.curImage} alt="Your photo" className="ft-view" />
        )}
        {showRoll && saved.length > 0 && (
          <div className="ft-roll" role="list" aria-label="Saved photos">
            {saved.map((d) => (
              <button type="button" role="listitem" key={d} className={state.curImage === images[d] ? "on" : ""} onClick={() => setState({ curImage: images[d], canSave: false })}>
                <img src={images[d]} alt={`Saved ${d}`} />
              </button>
            ))}
          </div>
        )}
        <div className="ft-controls">
          <button type="button" className="ft-thumb" aria-label="Saved photos" disabled={!saved.length} onClick={() => setShowRoll((v) => !v)}>
            {saved.length ? <img src={images[saved[0]]} alt="" /> : <span className="i-ph:images" />}
          </button>
          <button type="button" className={`ft-shutter ${state.curImage ? "retake" : ""}`} aria-label={state.curImage ? "Back to camera" : "Take a picture"} onClick={take}>
            {state.curImage && <span className="i-ph:camera-bold" />}
          </button>
          {state.canSave ? (
            <button type="button" className="ft-side" onClick={save}>
              <span className="i-ph:download-simple-bold" /> Save
            </button>
          ) : viewingDate ? (
            <button type="button" className="ft-side danger" onClick={() => remove(viewingDate)}>
              <span className="i-ph:trash-bold" /> Delete
            </button>
          ) : (
            <span className="ft-side placeholder" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} style={{ position: "relative", height: "100%", width: "100%", backgroundColor: "#000", }}>
      <Sidebar
        state={state}
        onTake={take}
        onSave={save}
        onSelect={(src) => {
          setState({ curImage: src, canSave: false });
        }}
        onDelete={remove}
      />

      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {!state.curImage ? (
          <Webcam
            mirrored={true}
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            videoConstraints={{
              facingMode: "user",
              aspectRatio: 16/9
            }}
          />
        ) : (
          state.curImage && <img src={state.curImage} alt="your-image" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
      </div>
    </div>
  );
};

export default FaceTime;
