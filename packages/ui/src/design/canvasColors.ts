/** Tokens que usa el lienzo del grafo: los colores se leen del tema vigente en cada dibujo, nunca se escriben a mano. */
export const GRAPH_TOKENS = {
  trashed: "--c-text-disabled",
  edge: "--c-border-control", edgeOn: "--c-accent", selected: "--c-text", text: "--c-text",
} as const;

/**
 * Colores de los nodos del grafo por tipo de elemento. Son tonos vivos de luminosidad media, que se leen igual sobre fondo claro y oscuro,
 * y se dibujan con degradado y un halo suave (la papelera usa el token gris del tema).
 */
export const GRAPH_NODE_COLORS = { page: "#4c8dff", subpage: "#a45cf5", board: "#18c29c", database: "#ff9f2e" } as const;

/** Aclara (`amount` > 0) u oscurece (< 0) un color «#rrggbb» mezclándolo con blanco o negro. */
export function shade(hex: string, amount: number): string {
  const to = amount >= 0 ? 255 : 0, k = Math.abs(amount);
  const ch = [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - k) + to * k));
  return "#" + ch.map((c) => c.toString(16).padStart(2, "0")).join("");
}

/** Lee valores de tokens CSS de un elemento (canvas no entiende `var()`). */
export function readTokens<K extends string>(el: Element, names: Record<K, string>, fallback: Partial<Record<K, string>> = {}): Record<K, string> {
  const style = getComputedStyle(el);
  const out = {} as Record<K, string>;
  for (const key of Object.keys(names) as K[]) out[key] = style.getPropertyValue(names[key]).trim() || fallback[key] || "currentColor";
  return out;
}
