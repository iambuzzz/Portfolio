import React, { useRef, useState } from "react";
import Webcam from "react-webcam";
import { format } from "date-fns";
import { useStore } from "~/stores";
import { motion } from "framer-motion";

interface SidebarProps {
  state: FaceTimeState;
  onTake: () => void;
  onSave: () => void;
  onSelect: (src: string) => void;
}

interface SidebarItemProps {
  date: string;
  active: boolean;
}

interface FaceTimeState {
  canSave: boolean;
  curImage: string | null;
}

const SidebarItem = ({ date, active }: SidebarItemProps) => {
  const [hover, setHover] = useState(false);
  const deleteImage = useStore((state) => state.delFaceTimeImage);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: "64px",
        padding: "0 10px",
        borderRadius: "8px",
        gap: "10px",
        background: active ? "var(--lg-border)" : "transparent",
        transition: "background 0.15s ease",
        position: "relative",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div 
        style={{
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            background: "rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
        }}
      >
        <span className="i-ph:link-bold" style={{ fontSize: "20px", color: "rgba(255,255,255,0.8)" }} />
      </div>

      <div style={{ textAlign: "left", flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: "14px", color: "rgba(255,255,255,0.9)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          FaceTime Link
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "rgba(255,255,255,0.6)", fontSize: "12px", marginTop: "2px" }}>
          <span className="i-ph:video-camera" />
          <span>FaceTime · {format(Number(date), "hh:mm")}</span>
        </div>
      </div>

      <span
        className="i-ph:x-circle-fill"
        style={{
            position: "absolute",
            right: "10px",
            fontSize: "18px",
            color: "rgba(255,255,255,0.4)",
            opacity: hover ? 1 : 0,
            transition: "all 0.15s ease",
            cursor: "pointer"
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
        onClick={(e) => {
          e.stopPropagation();
          deleteImage(date);
        }}
      />
    </div>
  );
};

const Sidebar = ({ state, onTake, onSave, onSelect }: SidebarProps) => {
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
        {Object.keys(images)
          .reverse()
          .map((date) => (
            <button
              key={date}
              onClick={() => onSelect(images[date])}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
            >
              <SidebarItem date={date} active={state.curImage === images[date]} />
            </button>
          ))}
      </div>
    </div>
  );
};

const FaceTime = () => {
  const webcamRef = useRef<Webcam>(null);
  const addImage = useStore((state) => state.addFaceTimeImage);
  const [state, setState] = useState<FaceTimeState>({
    canSave: false,
    curImage: null
  });

  return (
    <div style={{ position: "relative", height: "100%", width: "100%", backgroundColor: "#000", }}>
      <Sidebar
        state={state}
        onTake={() => {
          if (!state.curImage) {
            const src = webcamRef.current?.getScreenshot() || "";
            setState({ curImage: src, canSave: true });
          } else setState({ curImage: null, canSave: false });
        }}
        onSave={() => {
          addImage(state.curImage!);
          setState({ curImage: null, canSave: false });
        }}
        onSelect={(src) => {
          setState({ curImage: src, canSave: false });
        }}
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
