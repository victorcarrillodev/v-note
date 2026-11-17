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

/** Nivel más profundo que muestra el índice (RF-7.8). */
export type TocMaxLevel = 1 | 2 | 3;

/**
 * Encabezados del documento en orden, recorriendo bloques anidados sin recursión profunda.
 * `id` es el id del bloque, así los textos repetidos no se confunden (CL-13).
 */
export function extractHeadings(blocks: readonly unknown[], maxLevel?: TocMaxLevel): Heading[] {
  const out: Heading[] = [];
  const stack: unknown[] = [...blocks].reverse();
  while (stack.length) {
    const b = stack.pop() as BlockLike;
    if (b.type === "heading") {
      const text = inlineText(b.content).trim();
      const level = b.props?.level ?? 1;
      if (text !== "" && (maxLevel === undefined || level <= maxLevel)) out.push({ id: b.id, level, text });
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

/** Ancla de un encabezado como en GitHub: minúsculas, sin signos y con guiones; conserva las letras acentuadas. */
export function headingAnchor(text: string): string {
  const slug = text.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").trim().replace(/\s+/g, "-");
  return slug === "" ? "seccion" : slug;
}

export type TocEntry = Heading & { anchor: string };

/** Entradas del índice con un ancla única por encabezado (los repetidos reciben «-1», «-2»…). */
export function tocEntries(blocks: readonly unknown[], maxLevel: TocMaxLevel = 3): TocEntry[] {
  const seen = new Map<string, number>();
  return extractHeadings(blocks, maxLevel).map((h) => {
    const base = headingAnchor(h.text);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return { ...h, anchor: n === 0 ? base : `${base}-${n}` };
  });
}

/** ¿Hay un bloque `toc` en algún nivel del documento? Solo entonces los encabezados exportados llevan ancla. */
export function hasTocBlock(blocks: readonly unknown[]): boolean {
  const stack: unknown[] = [...blocks];
  while (stack.length) {
    const b = stack.pop() as BlockLike;
    if (b.type === "toc") return true;
    if (Array.isArray(b.children)) stack.push(...b.children);
  }
  return false;
}
