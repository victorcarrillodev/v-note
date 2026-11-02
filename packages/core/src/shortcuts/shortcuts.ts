// Catálogo de acciones con atajos reasignables y detección de conflictos (RF-20). Lógica pura: sin DOM.

export type ActionId = "palette.open" | "page.new" | "capture.open" | "search.open" | "edit.undo" | "edit.redo" | "theme.toggle" | "sidebar.toggle";
export type Action = { id: ActionId; labelKey: string; defaultCombo: string };
/** Atajo por acción; `null` = la acción se quedó sin atajo. */
export type Bindings = Record<string, string | null>;

export const ACTIONS: readonly Action[] = [
  { id: "palette.open", labelKey: "shortcuts.paletteOpen", defaultCombo: "Mod+K" },
  { id: "search.open", labelKey: "shortcuts.searchOpen", defaultCombo: "Mod+Shift+F" },
  { id: "page.new", labelKey: "shortcuts.pageNew", defaultCombo: "Mod+Alt+N" },
  { id: "capture.open", labelKey: "shortcuts.captureOpen", defaultCombo: "Mod+Shift+Space" },
  { id: "edit.undo", labelKey: "shortcuts.undo", defaultCombo: "Mod+Z" },
  { id: "edit.redo", labelKey: "shortcuts.redo", defaultCombo: "Mod+Shift+Z" },
  { id: "theme.toggle", labelKey: "shortcuts.themeToggle", defaultCombo: "Mod+Alt+T" },
  { id: "sidebar.toggle", labelKey: "shortcuts.sidebarToggle", defaultCombo: "Mod+\\" },
];

const MOD_ORDER = ["Mod", "Alt", "Shift"] as const;

/** Forma canónica: modificadores en orden fijo (Cmd y Ctrl se unifican en `Mod`) y la tecla en mayúscula. */
export function normalizeCombo(combo: string): string {
  const mods = new Set<string>();
  let key = "";
  for (const raw of combo.split("+")) {
    const p = raw.trim();
    const l = p.toLowerCase();
    if (l === "ctrl" || l === "control" || l === "cmd" || l === "meta" || l === "command" || l === "mod") mods.add("Mod");
    else if (l === "alt" || l === "option") mods.add("Alt");
    else if (l === "shift") mods.add("Shift");
    else key = p === "" ? "+" : l === "space" || p === " " ? "Space" : p.length === 1 ? p.toUpperCase() : p[0]!.toUpperCase() + p.slice(1);
  }
  return [...MOD_ORDER.filter((m) => mods.has(m)), key].join("+");
}

export type KeyEventLike = { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean };
const MODIFIER_KEYS = new Set(["Control", "Meta", "Alt", "Shift", "AltGraph"]);

/** Atajo que representa un evento de teclado; `null` si solo se pulsó un modificador. */
export function comboFromEvent(e: KeyEventLike): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null;
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("Mod");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  parts.push(e.key === " " ? "Space" : e.key);
  return normalizeCombo(parts.join("+"));
}

export function defaultBindings(): Bindings {
  return Object.fromEntries(ACTIONS.map((a) => [a.id, normalizeCombo(a.defaultCombo)]));
}

/** Atajos de fábrica sobrescritos por los guardados; se ignoran acciones que ya no existen. */
export function effectiveBindings(saved: Record<string, string | null>): Bindings {
  const out = defaultBindings();
  for (const [id, combo] of Object.entries(saved)) if (id in out) out[id] = combo === null ? null : normalizeCombo(combo);
  return out;
}

export type Conflict = { combo: string; actions: string[] };

export function findConflicts(bindings: Bindings): Conflict[] {
  const byCombo = new Map<string, string[]>();
  for (const [id, combo] of Object.entries(bindings)) {
    if (combo === null) continue;
    byCombo.set(combo, [...(byCombo.get(combo) ?? []), id]);
  }
  return [...byCombo].filter(([, ids]) => ids.length > 1).map(([combo, actions]) => ({ combo, actions }));
}

export type SetBindingResult = { ok: true; bindings: Bindings } | { ok: false; conflictsWith: string[] };

/** Asigna un atajo sin mutar el original. Si choca, falla indicando con quién, salvo `takeFromOthers` (la otra acción se queda sin atajo). */
export function setBinding(bindings: Bindings, id: string, combo: string | null, opts: { takeFromOthers?: boolean } = {}): SetBindingResult {
  const next: Bindings = { ...bindings };
  if (combo === null) { next[id] = null; return { ok: true, bindings: next }; }
  const c = normalizeCombo(combo);
  const others = Object.entries(bindings).filter(([k, v]) => k !== id && v === c).map(([k]) => k);
  if (others.length > 0) {
    if (!opts.takeFromOthers) return { ok: false, conflictsWith: others };
    for (const o of others) next[o] = null;
  }
  next[id] = c;
  return { ok: true, bindings: next };
}
