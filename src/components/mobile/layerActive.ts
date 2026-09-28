import { createContext, useContext } from "react";

// Phone: false while an app sits in the background (switcher / home screen), so
// it can pause expensive work such as the camera. Always true on the desktop.
export const LayerActive = createContext(true);
export const useLayerActive = () => useContext(LayerActive);
