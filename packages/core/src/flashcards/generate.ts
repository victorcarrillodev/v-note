import { inlineToText, type Block, type Inline } from "../blocks/types";

/** Una tarjeta sugerida: todavía no existe como bloque; la persona la revisa y la edita después. */
export type CardDraft = { front: string; back: string };

const TEXT_TYPES = new Set(["paragraph", "bulletListItem", "numberedListItem", "checkListItem", "quote", "toggleListItem"]);
const textOf = (b: Block): string => (Array.isArray(b.content) ? inlineToText(b.content as Inline[]).trim() : "");
const isQuestion = (s: string) => /\?\s*$/.test(s);

/** Todo el texto de los hijos (en orden de lectura), un renglón por bloque. */
function childrenText(blocks: Block[]): string {
  return blocks.flatMap((c) => [textOf(c), childrenText(c.children)]).filter((s) => s !== "").join("\n");
}

/** «Término :: definición» (convención de Anki y Obsidian). */
function doubleColon(text: string): CardDraft | null {
  const i = text.indexOf("::");
  if (i < 1) return null;
  const front = text.slice(0, i).trim(), back = text.slice(i + 2).trim();
  return front && back ? { front, back } : null;
}

/** «**Término**: definición»: el término en negrita al principio, seguido de «:» o de una raya. */
function boldTerm(content: Inline[]): CardDraft | null {
  const [first, ...rest] = content;
  if (!first || first.type !== "text" || !first.styles.bold) return null;
  const tail = inlineToText(rest);
  const m = /^\s*[:：—–]\s*(\S[\s\S]*)$/.exec(tail);
  const front = first.text.trim();
  return front && m ? { front, back: m[1]!.trim() } : null;
}

/**
 * Tarjetas que se pueden sacar del texto de unas notas, sin adivinar: solo patrones explícitos.
 * 1) toggle con contenido (título = pregunta); 2) «A :: B»; 3) «**A**: B»; 4) una pregunta y el párrafo siguiente como respuesta.
 */
export function draftsFromBlocks(blocks: Block[]): CardDraft[] {
  const out: CardDraft[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    if (b.type === "flashcard") continue;
    const text = textOf(b);
    let consumedChildren = false;
    if (b.type === "toggleListItem" && text !== "" && b.children.length > 0) {
      const back = childrenText(b.children);
      if (back !== "") { out.push({ front: text, back }); consumedChildren = true; }
    }
    if (!consumedChildren && TEXT_TYPES.has(b.type) && text !== "") {
      const draft = doubleColon(text) ?? (Array.isArray(b.content) ? boldTerm(b.content as Inline[]) : null);
      if (draft) out.push(draft);
      else if (isQuestion(text) && b.type !== "toggleListItem") {
        const next = blocks[i + 1];
        const answer = next && TEXT_TYPES.has(next.type) && next.type !== "toggleListItem" ? textOf(next) : "";
        if (answer !== "" && !isQuestion(answer)) { out.push({ front: text, back: answer }); i++; }
      }
    }
    if (!consumedChildren) out.push(...draftsFromBlocks(b.children));
  }
  return out;
}

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/** Descarta las sugeridas cuya pregunta ya existe (sin distinguir mayúsculas ni espacios), para no duplicar al repetir el atajo. */
export function withoutExisting(drafts: CardDraft[], existingFronts: string[]): CardDraft[] {
  const have = new Set(existingFronts.map(norm));
  return drafts.filter((d) => {
    const key = norm(d.front);
    if (have.has(key)) return false;
    have.add(key);
    return true;
  });
}
