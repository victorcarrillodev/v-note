export type Heading = { id: string; level: number; text: string };
type InlineLike = { text?: string; content?: unknown };
type BlockLike = { id: string; type: string; props?: { level?: number }; content?: unknown; children?: unknown };

/** A partir de este número de encabezados se ofrece la tabla de contenidos (RF-5.8). */
export const MIN_HEADINGS = 3;

const inlineText = (content: unknown): string => {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((c: InlineLike) => (typeof c.text === "string" ? c.text : inlineText(c.content))).join("");
};

/** Encabezados del documento en orden, recorriendo bloques anidados sin recursión profunda. */
export function extractHeadings(blocks: readonly unknown[]): Heading[] {
  const out: Heading[] = [];
  const stack: unknown[] = [...blocks].reverse();
  while (stack.length) {
    const b = stack.pop() as BlockLike;
    if (b.type === "heading") {
      const text = inlineText(b.content).trim();
      if (text !== "") out.push({ id: b.id, level: b.props?.level ?? 1, text });
    }
    if (Array.isArray(b.children)) for (let i = b.children.length - 1; i >= 0; i--) stack.push(b.children[i]);
  }
  return out;
}

export const shouldShowToc = (headings: readonly Heading[]): boolean => headings.length >= MIN_HEADINGS;

/** Encabezado «visible»: el último cuyo borde superior ya cruzó la línea de lectura; antes de todos, el primero. */
export function activeHeading(headings: readonly Heading[], tops: Record<string, number>, line: number): string | null {
  if (headings.length === 0) return null;
  let active = headings[0]!.id;
  for (const h of headings) if ((tops[h.id] ?? Infinity) <= line) active = h.id;
  return active;
}
