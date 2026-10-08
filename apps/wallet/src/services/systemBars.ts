import { useEffect } from "react";

/**
 * Keeps content clear of the phone's status bar and navigation bar. On Android the
 * native shell (MainActivity.kt) reports their sizes; elsewhere the CSS falls back
 * to the browser's safe-area values.
 */
interface AndroidSystemBars {
  insets(): string;
  setDarkIcons(dark: boolean): void;
}

declare global {
  interface Window {
    AndroidSystemBars?: AndroidSystemBars;
    __applySystemBars?: (insets: string) => void;
  }
}

function apply(insets: string) {
  const [top, bottom] = insets.split(",").map(Number);
  const root = document.documentElement.style;
  root.setProperty("--safe-top", `${top || 0}px`);
  root.setProperty("--safe-bottom", `${bottom || 0}px`);
}

export function initSystemBars() {
  window.__applySystemBars = apply;
  if (!window.AndroidSystemBars) return;
  apply(window.AndroidSystemBars.insets());
  // Most screens are light; dark ones opt in with useDarkScreen().
  window.AndroidSystemBars.setDarkIcons(true);
}

/** Screens with a dark background call this so the clock and battery stay readable. */
export function useDarkScreen(dark = true) {
  useEffect(() => {
    window.AndroidSystemBars?.setDarkIcons(!dark);
    return () => window.AndroidSystemBars?.setDarkIcons(true);
  }, [dark]);
}
