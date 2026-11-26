import { describe, it, expect } from "vitest";
import type { Block } from "../blocks/types";
import { blocksToMarkdown } from "../backup/markdown";
import { blocksToPlainText } from "../search/plainText";
import { flashcardsFromBlocks } from "../flashcards/cards";
import { blocksToHtml } from "./html";

const block = (type: string, props: Record<string, unknown>): Block => ({ id: type, type, props, content: undefined as never, children: [] });
const blocks = [block("equation", { formula: "O(n^2)" }), block("mermaid", { code: "graph TD\nA-->B" }), block("flashcard", { front: "¿Pila?", back: "<b>LIFO</b>" })];

describe("bloques de estudio", () => {
  it("se encuentran al buscar", () => {
    const text = blocksToPlainText(blocks);
    for (const s of ["O(n^2)", "A-->B", "¿Pila?", "LIFO"]) expect(text).toContain(s);
  });
  it("se exportan a Markdown", () => {
    const md = blocksToMarkdown(blocks);
    expect(md).toContain("$$\nO(n^2)\n$$");
    expect(md).toContain("```mermaid\ngraph TD\nA-->B\n```");
    expect(md).toContain("> **P:** ¿Pila?");
  });
  it("se exportan a HTML: ecuación como MathML y el texto escapado", () => {
    const html = blocksToHtml(blocks, { assets: () => null } as never);
    expect(html).toContain("<math");
    expect(html).toContain('class="language-mermaid"');
    expect(html).toContain("&lt;b&gt;LIFO");
    expect(html).not.toContain("<b>LIFO");
  });
  it("solo las tarjetas con pregunta entran al repaso", () => {
    expect(flashcardsFromBlocks([...blocks, block("flashcard", { front: "  " })]).map((c) => c.front)).toEqual(["¿Pila?"]);
  });
});
