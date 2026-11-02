// T-134b (prueba primero): contar bloques de una página (incluye hijos) y umbral del aviso de página grande.
import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { toYjs } from "./toYjs";
import { countBlocks, LARGE_PAGE_BLOCKS, isLargePage } from "./count";
import { para } from "../../tests/support/builders";

const frag = (blocks: ReturnType<typeof para>[]) => { const d = new Y.Doc(); toYjs(blocks, d.getXmlFragment("doc")); return d.getXmlFragment("doc"); };

describe("countBlocks", () => {
  it("página vacía: 0", () => expect(countBlocks(new Y.Doc().getXmlFragment("doc"))).toBe(0));
  it("cuenta bloques de primer nivel", () => expect(countBlocks(frag([para("a"), para("b"), para("c")]))).toBe(3));
  it("cuenta también los hijos anidados", () => {
    const child = para("hijo");
    const nested = para("nieto");
    const parent = para("padre", "bulletListItem", { children: [{ ...child, children: [nested] }, para("otro hijo")] });
    expect(countBlocks(frag([parent, para("x")]))).toBe(5);
  });
});

describe("umbral de página grande", () => {
  it("el umbral es 5 000 bloques (RF-3, RNF-2)", () => expect(LARGE_PAGE_BLOCKS).toBe(5000));
  it("solo es grande si SUPERA el umbral", () => {
    expect(isLargePage(5000)).toBe(false);
    expect(isLargePage(5001)).toBe(true);
  });
});
