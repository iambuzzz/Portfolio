import type { StateCreator } from "zustand";

export interface UserSlice {
  faceTimeImages: {
    [date: string]: string;
  };
  addFaceTimeImage: (v: string) => void;
  delFaceTimeImage: (k: string) => void;
}

export const createUserSlice: StateCreator<UserSlice> = (set) => ({
  faceTimeImages: {},
  // Always return a new object: Zustand only re-renders on a new reference.
  addFaceTimeImage: (v) => set((state) => ({ faceTimeImages: { ...state.faceTimeImages, [Date.now()]: v } })),
  delFaceTimeImage: (k) =>
    set((state) => {
      const { [k]: _removed, ...rest } = state.faceTimeImages;
      return { faceTimeImages: rest };
    })
});
