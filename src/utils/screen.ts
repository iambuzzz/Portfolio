interface FsDocumentElement extends HTMLElement {
  msRequestFullscreen?: () => void;
  mozRequestFullScreen?: () => void;
  webkitRequestFullscreen?: () => void;
}

interface FsDocument extends Document {
  webkitIsFullScreen?: boolean;
  mozFullScreen?: boolean;
  msFullscreenElement?: Element;
}

// Plain Fullscreen API only. (We used to call navigator.keyboard.lock(), which
// captures every key including Esc and browser shortcuts, so visitors couldn't
// leave full screen without press-and-holding Esc.)
export const enterFullScreen = async (): Promise<void> => {
  if (isFullScreen()) return;
  const element = document.documentElement as FsDocumentElement;
  try {
    if (element.requestFullscreen) await element.requestFullscreen();
    else if (element.webkitRequestFullscreen) element.webkitRequestFullscreen();
    else if (element.mozRequestFullScreen) element.mozRequestFullScreen();
    else if (element.msRequestFullscreen) element.msRequestFullscreen();
  } catch {
    // Needs a user gesture; ignore if the browser refuses.
  }
};

export const exitFullScreen = (): void => {
  if (!isFullScreen()) return;
  document.exitFullscreen?.().catch(() => {});
};

export const isFullScreen = (): boolean => {
  const fsDoc = document as FsDocument;
  return !!(
    fsDoc.fullscreenElement ||
    fsDoc.webkitIsFullScreen ||
    fsDoc.mozFullScreen ||
    fsDoc.msFullscreenElement
  );
};
