/** Tokens que usa el lienzo del grafo: los colores se leen del tema vigente en cada dibujo, nunca se escriben a mano. */
export const GRAPH_TOKENS = {
  note: "--c-accent", board: "--c-success", database: "--c-warning", trashed: "--c-text-disabled",
  edge: "--c-border-control", edgeOn: "--c-accent", selected: "--c-text", text: "--c-text",
} as const;

/** Lee valores de tokens CSS de un elemento (canvas no entiende `var()`). */
export function readTokens<K extends string>(el: Element, names: Record<K, string>, fallback: Partial<Record<K, string>> = {}): Record<K, string> {
  const style = getComputedStyle(el);
  const out = {} as Record<K, string>;
  for (const key of Object.keys(names) as K[]) out[key] = style.getPropertyValue(names[key]).trim() || fallback[key] || "currentColor";
  return out;
}
