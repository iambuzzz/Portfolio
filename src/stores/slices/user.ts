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
- [ ] Run \`sudo hire-me\` in **Terminal** 😉
`,
  setTyporaMd: (v) => set(() => ({ typoraMd: v })),
  faceTimeImages: {},
  addFaceTimeImage: (v) =>
    set((state) => {
      const images = state.faceTimeImages;
      images[+new Date()] = v;
      return { faceTimeImages: images };
    }),
  delFaceTimeImage: (k) =>
    set((state) => {
      const images = state.faceTimeImages;
      delete images[k];
      return { faceTimeImages: images };
    })
});
