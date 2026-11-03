import type { Platform } from "../layout/formatCombo";
/** macOS o el resto, para mostrar atajos (⌘ o Ctrl). */
export const detectPlatform = (nav: string | undefined = typeof navigator === "undefined" ? undefined : navigator.platform): Platform => (nav && /mac|iphone|ipad/i.test(nav) ? "mac" : "other");
