// Open System Settings at a specific panel from anywhere (e.g. achievement banner).
let pending: string | null = null;

export const takePendingPanel = () => {
  const p = pending;
  pending = null;
  return p;
};

export function openSettings(panel: string) {
  pending = panel;
  window.dispatchEvent(new CustomEvent("app:open", { detail: "system-settings" }));
  window.dispatchEvent(new CustomEvent("settings:open", { detail: panel }));
}
