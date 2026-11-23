import { useSyncExternalStore } from "react";

/** Temas de color del código. `auto` sigue el tema claro u oscuro de la app; los demás tienen paleta propia (ver `code.css`). */
export const CODE_THEMES = [
  { value: "auto", label: "Automático" },
  { value: "github", label: "GitHub" },
  { value: "one", label: "One" },
  { value: "solarized", label: "Solarized" },
  { value: "dracula", label: "Dracula" },
  { value: "monokai", label: "Monokai" },
  { value: "nord", label: "Nord" },
] as const;

export type CodeThemeId = (typeof CODE_THEMES)[number]["value"];

const KEY = "vnote:codeTheme";
const listeners = new Set<() => void>();
let current: CodeThemeId = "auto";

function isTheme(v: unknown): v is CodeThemeId { return CODE_THEMES.some((t) => t.value === v); }

function apply(id: CodeThemeId): void {
  if (typeof document === "undefined") return;
  if (id === "auto") document.documentElement.removeAttribute("data-code-theme");
  else document.documentElement.setAttribute("data-code-theme", id);
}

/** Lee el tema guardado (localStorage puede faltar o lanzar: entonces queda «auto»). */
export function loadCodeTheme(): CodeThemeId {
  try { const v = localStorage.getItem(KEY); if (isTheme(v)) current = v; } catch { /* sin persistencia */ }
  apply(current);
  return current;
}

export function getCodeTheme(): CodeThemeId { return current; }

/** Cambia el tema de todos los bloques de código a la vez y lo recuerda. */
export function setCodeTheme(id: CodeThemeId): void {
  current = id;
  try { localStorage.setItem(KEY, id); } catch { /* sin persistencia */ }
  apply(id);
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void): (() => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Tema de código actual y su setter, para componentes. */
export function useCodeTheme(): [CodeThemeId, (id: CodeThemeId) => void] {
  const theme = useSyncExternalStore(subscribe, getCodeTheme, getCodeTheme);
  return [theme, setCodeTheme];
}

loadCodeTheme();
