import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BlockNoteEditor } from "@blocknote/core";
import { schema } from "./schema";
import { buildBlockTypeItems } from "./blockTypeItems";

describe("selector «Convertir en»", () => {
  const items = buildBlockTypeItems(BlockNoteEditor.create({ schema }), (k) => k);
  it("ofrece los bloques de texto propios sin repetir ninguno", () => {
    for (const type of ["paragraph", "heading", "codeBlock", "callout", "task"]) expect(items.map((i) => i.type), type).toContain(type);
    const keys = items.map((i) => `${i.type}:${JSON.stringify(i.props ?? {})}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("selección de un bloque", () => {
  it("no pinta el velo ni el contorno azul en ningún tipo de bloque", () => {
    const css = readFileSync(join(__dirname, "editor.css"), "utf8");
    const sel = ".bn-container :is(.bn-block-content.ProseMirror-selectednode, .ProseMirror-selectednode > .bn-block-content)";
    expect(css).toContain(`${sel} > * {\n  outline: none;\n}`);
    expect(css).toContain(`${sel}::after {\n  content: none;\n  display: none;\n}`);
  });
});
