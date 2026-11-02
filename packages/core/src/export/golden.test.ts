// T-413: archivo dorado de la exportación. Si la salida cambia a propósito, se regenera con `bunx vitest run -u` y se revisa el diff.
import { describe, it, expect } from "vitest";
import type { Block, Inline } from "../blocks/types";
import { MemoryAssetStore } from "../assets/memoryAssetStore";
import { assetUrl } from "../assets/attach";
import { emptyDiagram, addNode, addEdge } from "../diagrams/diagram";
import { newTree, addChild, serializeTree } from "../diagrams/tree";
import { emptyTimeline, addEvent, serializeTimeline } from "../diagrams/timeline";
import { template2x2, addItem, serializeMatrix } from "../diagrams/matrix";
import { serializeDiagram } from "../diagrams/diagram";
import { exportHtml, type ExportPage } from "./exportDocument";

const t = (text: string, styles: Record<string, true | string> = {}): Inline => ({ type: "text", text, styles });
let n = 0;
const b = (type: string, content: Block["content"], props: Record<string, unknown> = {}, children: Block[] = []): Block => ({ id: `g${++n}`, type, props, content, children });
const must = <T,>(r: { ok: true; value: T } | { ok: false }): T => { if (!r.ok) throw new Error("x"); return r.value; };

async function sample() {
  const assets = new MemoryAssetStore();
  const png = await assets.put(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]));
  let d = emptyDiagram();
  d = addNode(d, { id: "a", shape: "terminator", x: 0, y: 0, text: "Inicio" }).diagram;
  d = addNode(d, { id: "z", shape: "process", x: 0, y: 100, text: "Trabajo" }).diagram;
  d = must(addEdge(d, "a", "z")).diagram;
  let tree = newTree("Proyecto");
  tree = must(addChild(tree, "root", "Diseño", "d")).tree;
  tree = must(addChild(tree, "root", "Código", "c")).tree;
  let tl = emptyTimeline();
  tl = must(addEvent(tl, { id: "e1", date: "2026-03-01", title: "Arranque" })).timeline;
  tl = must(addEvent(tl, { id: "e2", date: "2026-04-15", title: "Entrega" })).timeline;
  const mx = template2x2();
  const matrix = must(addItem(mx, mx.rows[0]!.id, mx.cols[0]!.id, "Pagar luz")).matrix;
  const pages: ExportPage[] = [
    { id: "r", title: "Notas del proyecto", depth: 0, blocks: [
      b("heading", [t("Resumen")], { level: 1 }),
      b("paragraph", [t("Texto con "), t("negrita", { bold: true }), t(", "), t("cursiva", { italic: true }), t(" y "), t("color", { textColor: "red", backgroundColor: "yellow" }), t(".")]),
      b("paragraph", [{ type: "link", href: "https://example.com/a?x=1&y=2", content: [{ type: "text", text: "un enlace", styles: {} }] }, t(" y una mención a "), { type: "mention", pageId: "h", title: "Hija" }]),
      b("bulletListItem", [t("uno")], {}, [b("bulletListItem", [t("uno punto uno")])]),
      b("bulletListItem", [t("dos")]),
      b("numberedListItem", [t("primero")]), b("numberedListItem", [t("segundo")]),
      b("checkListItem", [t("hecho")], { checked: true }), b("checkListItem", [t("pendiente")], { checked: false }),
      b("toggleListItem", [t("Más detalles")], {}, [b("paragraph", [t("oculto")])]),
      b("quote", [t("Una cita")]), b("divider", undefined),
      b("codeBlock", [t("const a = 1 < 2;")], { language: "ts" }),
      b("table", { type: "table", rows: [[[t("A")], [t("B")]], [[t("1")], [t("2")]]] }),
      b("callout", [t("Atención")], { variant: "warning" }),
      b("task", [t("Pagar")], { checked: false, due: "2026-03-10", remindAt: "2026-03-09T08:00" }),
      b("linkCard", undefined, { url: "https://example.com/doc", title: "Documento" }),
      b("image", undefined, { url: assetUrl(png.hash), name: "logo.png", caption: "Logo" }),
      b("image", undefined, { url: assetUrl("c".repeat(64)), name: "perdida.png", caption: "" }),
      b("diagram", undefined, { data: serializeDiagram(d) }),
      b("mindmap", undefined, { data: serializeTree(tree) }),
      b("orgchart", undefined, { data: serializeTree(tree) }),
      b("timeline", undefined, { data: serializeTimeline(tl) }),
      b("matrix", undefined, { data: serializeMatrix(matrix) }),
    ] },
    { id: "h", title: "Hija", depth: 1, blocks: [b("paragraph", [t("Contenido de la hija")])] },
  ];
  return { pages, assets };
}

describe("exportación dorada (T-413)", () => {
  it("la muestra completa produce exactamente el HTML de referencia", async () => {
    const { pages, assets } = await sample();
    const r = await exportHtml({ pages }, { assets });
    if (r.status !== "done") throw new Error("x");
    expect(r.report.missing).toEqual([{ name: "perdida.png", url: assetUrl("c".repeat(64)) }]);
    await expect(r.html.replace(/></g, ">\n<") + "\n").toMatchFileSnapshot("../../tests/golden/export-v1.html");
  });
  it("es determinista: dos exportaciones dan los mismos bytes", async () => {
    const { pages, assets } = await sample();
    const a = await exportHtml({ pages }, { assets }), c = await exportHtml({ pages }, { assets });
    expect(a.status === "done" && c.status === "done" && a.html === c.html).toBe(true);
  });
});
