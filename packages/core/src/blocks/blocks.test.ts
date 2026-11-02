// T-068 a T-074 (prueba primero): modelo canónico de bloques y conversión Yjs <-> canónico, contrastada con el editor real.
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import * as Y from "yjs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BLOCK_TYPES, defaultProps, type Block, type Inline } from "./types";
import { fromYjs } from "./fromYjs";
import { toYjs } from "./toYjs";
import { normalizeEditorBlocks } from "../../tests/support/normalizeEditorBlocks";

function fixture(name: string) {
  const f = JSON.parse(readFileSync(resolve(__dirname, `../../tests/fixtures/${name}.json`), "utf8"));
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, Uint8Array.from(atob(f.update), (c) => c.charCodeAt(0)));
  return { fragment: ydoc.getXmlFragment("doc"), editorBlocks: normalizeEditorBlocks(f.doc) };
}
const flat = (bs: Block[]): Block[] => bs.flatMap((b) => [b, ...flat(b.children)]);

describe("modelo canónico (T-068)", () => {
  it("define todos los tipos de bloque de RF-3 con sus propiedades por defecto", () => {
    for (const t of ["paragraph", "heading", "bulletListItem", "numberedListItem", "checkListItem", "toggleListItem", "quote", "divider", "codeBlock", "image", "file", "table"]) {
      expect(BLOCK_TYPES).toContain(t);
    }
    expect(defaultProps("paragraph")).toEqual({ textColor: "default", textAlignment: "left", backgroundColor: "default" });
    expect(defaultProps("heading")).toEqual({ level: 1, isToggleable: false, textColor: "default", textAlignment: "left", backgroundColor: "default" });
    expect(defaultProps("divider")).toEqual({});
    expect(defaultProps("table")).toEqual({ textColor: "default" });
  });
});

describe("Yjs -> canónico coincide con el editor real (T-069 a T-072)", () => {
  it("texto, encabezados, listas, tareas, estilos, colores y enlaces", () => {
    const { fragment, editorBlocks } = fixture("basic");
    expect(fromYjs(fragment)).toEqual(editorBlocks);
  });
  it("código, cita, divisor, desplegable, tabla, imagen y archivo", () => {
    const { fragment, editorBlocks } = fixture("extra");
    expect(fromYjs(fragment)).toEqual(editorBlocks);
  });
  it.each([
    ["basic", ["heading", "paragraph", "bulletListItem", "numberedListItem", "checkListItem"]],
    ["extra", ["codeBlock", "quote", "divider", "toggleListItem", "table", "image", "file"]],
  ])("el fixture %s contiene los tipos esperados", (name, types) => {
    const kinds = new Set(flat(fromYjs(fixture(name).fragment)).map((b) => b.type));
    for (const t of types) expect(kinds.has(t)).toBe(true);
  });
  it("conserva estilos, colores y enlaces dentro del texto", () => {
    const blocks = fromYjs(fixture("basic").fragment);
    const styled = blocks[1]!.content as Inline[];
    expect(styled.some((i) => i.type === "text" && i.styles.bold === true)).toBe(true);
    expect(styled.some((i) => i.type === "text" && i.styles.italic === true && i.styles.underline === true)).toBe(true);
    const colored = blocks[8]!.content as Inline[];
    expect(colored[0]).toMatchObject({ styles: { textColor: "blue", backgroundColor: "green" } });
    const link = blocks[9]!.content as Inline[];
    expect(link[0]).toMatchObject({ type: "link", href: "https://example.com" });
  });
});

describe("canónico -> Yjs (T-073)", () => {
  it.each(["basic", "extra"])("reproduce exactamente la estructura que genera el editor (%s)", (name) => {
    const { fragment } = fixture(name);
    const blocks = fromYjs(fragment);
    const out = new Y.Doc().getXmlFragment("doc");
    const doc = new Y.Doc();
    toYjs(blocks, doc.getXmlFragment("doc"));
    expect(doc.getXmlFragment("doc").toString()).toBe(fragment.toString());
    expect(fromYjs(doc.getXmlFragment("doc"))).toEqual(blocks);
    expect(out).toBeDefined();
  });
});

describe("propiedad: canónico -> Yjs -> canónico es la identidad (T-074)", () => {
  const styleSets = [{}, { bold: true }, { italic: true }, { underline: true }, { strike: true }, { bold: true, italic: true }, { code: true }, { textColor: "red" }];
  const inline = fc
    .array(fc.tuple(fc.stringMatching(/^[A-Za-zñáé ]{1,12}$/), fc.constantFrom(...styleSets)), { maxLength: 5 })
    .map((items) => {
      const out: Inline[] = [];
      for (const [text, styles] of items) {
        const last = out.at(-1);
        if (last && last.type === "text" && JSON.stringify(last.styles) === JSON.stringify(styles)) continue; // Yjs fusiona estilos iguales contiguos
        out.push({ type: "text", text, styles: styles as Record<string, true | string> });
      }
      return out;
    });
  let counter = 0;
  const kind = fc.constantFrom("paragraph", "heading", "bulletListItem", "numberedListItem", "checkListItem", "quote");
  const block = (depth: number): fc.Arbitrary<Block> =>
    fc.record({ type: kind, content: inline, level: fc.constantFrom(1, 2, 3), checked: fc.boolean(), kids: depth > 0 ? fc.array(fc.constant(0), { maxLength: 2 }) : fc.constant([] as number[]) }).chain((r) =>
      fc.tuple(...r.kids.map(() => block(depth - 1))).map((children) => {
        const props: Record<string, unknown> = { ...defaultProps(r.type as never) };
        if (r.type === "heading") props.level = r.level;
        if (r.type === "checkListItem") props.checked = r.checked;
        return { id: `id-${++counter}`, type: r.type, props, content: r.content, children } as Block;
      }),
    );
  it("se conserva cualquier árbol de bloques de texto con estilos", () => {
    fc.assert(
      fc.property(fc.array(block(2), { maxLength: 6 }), (blocks) => {
        const doc = new Y.Doc();
        toYjs(blocks, doc.getXmlFragment("doc"));
        expect(fromYjs(doc.getXmlFragment("doc"))).toEqual(blocks);
      }),
      { numRuns: 300 },
    );
  });
});
