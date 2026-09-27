import type { StateCreator } from "zustand";
import { profile } from "~/data/profile";

export interface UserSlice {
  typoraMd: string;
  setTyporaMd: (v: string) => void;
  faceTimeImages: {
    [date: string]: string;
  };
  addFaceTimeImage: (v: string) => void;
  delFaceTimeImage: (k: string) => void;
}

export const createUserSlice: StateCreator<UserSlice> = (set) => ({
  typoraMd: `# Scratchpad

A markdown editor (built on Milkdown). **Type anything** — headings, lists, \`code\`, tables all work.

## Ideas for you to try

- [ ] Open **Spotify** and play a song
- [ ] Ask **Siri** about ${profile.firstName}'s projects
- [ ] Run \`sudo hire-ambuj\` in **Terminal** 😉
`,
  setTyporaMd: (v) => set(() => ({ typoraMd: v })),
  faceTimeImages: {},
  // Always return a new object: Zustand only re-renders on a new reference.
  addFaceTimeImage: (v) => set((state) => ({ faceTimeImages: { ...state.faceTimeImages, [Date.now()]: v } })),
  delFaceTimeImage: (k) =>
    set((state) => {
      const { [k]: _removed, ...rest } = state.faceTimeImages;
      return { faceTimeImages: rest };
    })
});
