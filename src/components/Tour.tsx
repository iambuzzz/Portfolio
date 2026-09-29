import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { usePrefs } from "~/settings/prefs";
import { profile } from "~/data/profile";

// First-visit tour: a few speech bubbles pointing at what a visitor (usually a
// recruiter) is looking for — the résumé, About, Siri, Mail and the Terminal.
// Shown once; finishing or skipping it is remembered in the prefs.

interface Step {
  title: string;
  text: string;
  /** The element to point at; the bubble is centred when it isn't on screen. */
  target?: () => Element | null;
}

const q = (sel: string) => () => document.querySelector(sel);

function stepsFor(phone: boolean): Step[] {
  const dock = (id: string) => (phone ? q(`.m-dock [data-app-icon="${id}"]`) : q(`#dock-${id}`));
  return [
    {
      title: `👋 Welcome! I'm ${profile.firstName}`,
      text: `A full-stack developer. This portfolio works like ${phone ? "an iPhone" : "a Mac"}, so here's a quick tour of where everything is.`
    },
    phone
      ? { title: "📄 My résumé", text: "Tap here to view my résumé or download it as a PDF.", target: dock("link:resume") }
      : {
          title: "📄 My résumé",
          text: "Download my résumé (PDF) from here, in the About Me window.",
          target: q(`a[href="${profile.resumeDownload}"]`)
        },
    { title: "👤 About Me", text: "Projects, skills, education and links, all on one page.", target: dock("about") },
    { title: "✨ Siri", text: `Siri knows my résumé. Ask anything, like “What has ${profile.firstName} built?”`, target: dock("siri") },
    { title: "✉️ Mail", text: "Send me a message from here. It goes straight to my inbox.", target: dock("mail") },
    {
      title: "💻 Are you a techie?",
      text: phone ? "Try the Terminal: type help to see what it can do." : "Try the Terminal: type help, or play snake.",
      target: dock("terminal")
    }
  ];
}

type Box = { left: number; top: number; width: number; height: number };
const sameBox = (a: Box | null, b: Box | null) =>
  a === b || (!!a && !!b && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height);

export default function Tour({ phone }: { phone: boolean }) {
  const done = usePrefs((s) => s.tourDone);
  const setPref = usePrefs((s) => s.set);
  const [steps] = useState(() => stepsFor(phone));
  const [i, setI] = useState(-1);
  const [box, setBox] = useState<Box | null>(null);
  const [vw, setVw] = useState(() => window.innerWidth);
  const [vh, setVh] = useState(() => window.innerHeight);

  // Start once the desktop / home screen has settled after signing in.
  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => setI(0), 1400);
    return () => clearTimeout(t);
  }, [done]);

  const step = i >= 0 && !done ? steps[i] : undefined;
  const last = steps.length - 1;
  const finish = () => {
    setI(-1);
    setPref("tourDone", true);
  };
  const next = () => (i >= last ? finish() : setI(i + 1));
  const back = () => setI(Math.max(0, i - 1));

  // Follow the target: the dock and windows can still be animating in.
  useEffect(() => {
    if (!step) return;
    const measure = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
      const r = step.target?.()?.getBoundingClientRect();
      const b = r && r.width > 0 && r.bottom > 0 && r.top < window.innerHeight ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
      setBox((prev) => (sameBox(prev, b) ? prev : b));
    };
    measure();
    const id = setInterval(measure, 200);
    window.addEventListener("resize", measure);
    return () => {
      clearInterval(id);
      window.removeEventListener("resize", measure);
    };
  }, [step]);

  // Pop-ups (achievement toasts) would sit on top of the bubbles: hide them meanwhile.
  const active = !!step;
  useEffect(() => {
    document.documentElement.classList.toggle("tour-on", active);
    return () => document.documentElement.classList.remove("tour-on");
  }, [active]);

  // Keyboard: Esc skips, Enter / → next, ← back. Nothing else reaches the page.
  useEffect(() => {
    if (!step) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if (e.key === "Enter" || e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  if (typeof document === "undefined") return null;

  // Bubble position: above the target when it sits low (the dock), else below.
  const W = Math.min(300, vw - 24);
  const pad = 8;
  let card: React.CSSProperties = { width: W };
  let arrow: React.CSSProperties | null = null;
  if (box) {
    const cx = box.left + box.width / 2;
    const left = Math.min(Math.max(cx - W / 2, 12), vw - W - 12);
    const above = box.top + box.height / 2 > vh / 2;
    card = above ? { width: W, left, bottom: vh - box.top + pad + 12 } : { width: W, left, top: box.top + box.height + pad + 12 };
    arrow = { left: Math.min(Math.max(cx - left - 7, 16), W - 30), ...(above ? { bottom: -7 } : { top: -7 }) };
  }

  return createPortal(
    <AnimatePresence>
      {step && (
        <motion.div
          key="tour"
          className={`tour ${box ? "" : "tour-center"}`}
          role="dialog"
          aria-modal="true"
          aria-label="Quick tour"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {box ? (
            <div className="tour-hole" style={{ left: box.left - pad, top: box.top - pad, width: box.width + pad * 2, height: box.height + pad * 2 }} />
          ) : (
            <div className="tour-dim" />
          )}
          <motion.div
            key={i}
            className="tour-card"
            style={card}
            initial={{ opacity: 0, y: box ? 6 : 0, scale: box ? 1 : 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.22 }}
          >
            {arrow && <span className="tour-arrow" style={arrow} />}
            <div className="tour-title">{step.title}</div>
            <div className="tour-text">{step.text}</div>
            <div className="tour-foot">
              <span className="tour-dots" aria-label={`Step ${i + 1} of ${steps.length}`}>
                {steps.map((_, k) => (
                  <span key={k} className={k === i ? "on" : ""} />
                ))}
              </span>
              <button type="button" className="tour-skip" onClick={finish}>
                {i === 0 ? "Skip" : "Skip tour"}
              </button>
              <button type="button" className="tour-next" onClick={next} autoFocus={!phone}>
                {i === 0 ? "Start tour" : i === last ? "Got it" : "Next"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
