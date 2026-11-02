// T-123, T-125 (prueba primero): los bloques propios (aviso y tarjeta de enlace) sobreviven al ciclo Yjs y se exportan a Markdown.
import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { toYjs } from "./toYjs";
import { fromYjs } from "./fromYjs";
import { blocksToMarkdown } from "../backup/markdown";
import type { Block } from "./types";

const callout: Block = { id: "c1", type: "callout", props: { variant: "warning" }, content: [{ type: "text", text: "Ojo con esto", styles: { bold: true } }], children: [] };
const card: Block = { id: "l1", type: "linkCard", props: { url: "https://example.com/a", title: "Ejemplo" }, content: undefined, children: [] };

describe("bloques propios", () => {
  it("aviso y tarjeta de enlace hacen ida y vuelta por Yjs sin perder nada", () => {
    const doc = new Y.Doc();
    toYjs([callout, card], doc.getXmlFragment("doc"));
    const back = fromYjs(doc.getXmlFragment("doc"));
    expect(back).toEqual([callout, card]);
  });
  it("el Markdown del aviso conserva el texto, su formato y el tipo de aviso", () => {
    const md = blocksToMarkdown([callout]);
    expect(md).toContain("**Ojo con esto**");
    expect(md).toMatch(/^> /m);
    expect(md.toLowerCase()).toContain("warning");
  });
  it("el Markdown de la tarjeta es un enlace con su título", () => {
    expect(blocksToMarkdown([card])).toContain("[Ejemplo](https://example.com/a)");
  });
  it("una tarjeta sin título usa la URL como texto", () => {
    expect(blocksToMarkdown([{ ...card, props: { url: "https://x.org", title: "" } }])).toContain("[https://x.org](https://x.org)");
  });
  it("el bloque de tarea hace ida y vuelta por Yjs y se exporta como casilla con su fecha", () => {
    const task: Block = { id: "t1", type: "task", props: { checked: false, due: "2026-03-10", remindAt: "2026-03-09T08:00", recurrence: "" }, content: [{ type: "text", text: "Pagar luz", styles: {} }], children: [] };
    const doc = new Y.Doc();
    toYjs([task], doc.getXmlFragment("doc"));
    expect(fromYjs(doc.getXmlFragment("doc"))).toEqual([task]);
    const md = blocksToMarkdown([task]);
    expect(md).toContain("- [ ] Pagar luz");
    expect(md).toContain("vence 2026-03-10");
    expect(blocksToMarkdown([{ ...task, props: { ...task.props, checked: true, due: "", remindAt: "" } }])).toContain("- [x] Pagar luz");
  });
});
