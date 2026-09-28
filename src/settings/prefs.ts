import { create } from "zustand";
import { persist } from "zustand/middleware";

// Visitor preferences that the Settings app controls (saved in this browser).

export type StartupApp = "about" | "none" | "terminal" | "finder" | "spotify";

export interface Prefs {
  // Accessibility
  reduceMotion: boolean;
  /** The visitor changed Reduce Motion themselves (else the device default applies). */
  reduceMotionSet: boolean;
  reduceTransparency: boolean;
  // Displays
  nightShift: boolean;
  nightShiftWarmth: number; // 0–100
  // Sound
  uiSounds: boolean;
  // Siri
  siriVoice: boolean; // speak replies aloud
  siriVoiceName: string; // "" = automatic
  siriRate: number; // 0.7–1.4
  siriAutoListen: boolean;
  // Startup
  skipIntro: boolean; // skip the login screen on return visits
  startupApp: StartupApp;
  recruiterMode: boolean;
}

// Phones (the iOS view, same breakpoint) start with Reduce Motion on: lighter
// and smoother on phone GPUs. Visitors can still turn it off in Settings.
const PHONE = typeof window !== "undefined" && window.innerWidth < 768;

export const DEFAULT_PREFS: Prefs = {
  reduceMotion: PHONE,
  reduceMotionSet: false,
  reduceTransparency: false,
  nightShift: false,
  nightShiftWarmth: 45,
  uiSounds: true,
  siriVoice: true,
  siriVoiceName: "",
  siriRate: 1,
  siriAutoListen: true,
  skipIntro: false,
  startupApp: "about",
  recruiterMode: false
};

interface PrefsState extends Prefs {
  set: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
  /** Recruiter Mode: less motion, no login screen, About opens first. */
  setRecruiterMode: (on: boolean) => void;
  reset: () => void;
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFS,
      set: (key, value) => set({ [key]: value, ...(key === "reduceMotion" ? { reduceMotionSet: true } : {}) } as Partial<Prefs>),
      setRecruiterMode: (on) =>
        set(
          on
            ? { recruiterMode: true, reduceMotion: true, reduceMotionSet: true, skipIntro: true, startupApp: "about" }
            : { recruiterMode: false, reduceMotion: false, reduceMotionSet: true, skipIntro: false }
        ),
      reset: () => set({ ...DEFAULT_PREFS })
    }),
    {
      name: "macos-prefs",
      partialize: ({ set: _s, setRecruiterMode: _r, reset: _x, ...rest }) => rest,
      // Saved prefs include reduceMotion even if the visitor never touched it:
      // only a choice they made overrides the device default.
      merge: (saved, current) => {
        const s = { ...(saved as Partial<Prefs>) };
        if (!s.reduceMotionSet) delete s.reduceMotion;
        return { ...current, ...s };
      }
    }
  )
);

/** Read once at startup (before React renders). */
export const initialPrefs = (): Prefs => ({ ...DEFAULT_PREFS, ...usePrefs.getState() });
