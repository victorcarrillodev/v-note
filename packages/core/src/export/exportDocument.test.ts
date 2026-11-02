// T-402, T-405, T-407, T-408, T-411 (prueba primero): documento HTML completo, con o sin páginas hijas (RF-24, CL-31).
import { describe, it, expect } from "vitest";
import type { Block, Inline } from "../blocks/types";
import { MemoryAssetStore } from "../assets/memoryAssetStore";
import { assetUrl } from "../assets/attach";
import { exportHtml, sniffMime, type ExportPage } from "./exportDocument";

const t = (text: string): Inline => ({ type: "text", text, styles: {} });
const p = (text: string): Block => ({ id: "b" + text, type: "paragraph", props: {}, content: [t(text)], children: [] });
const page = (id: string, title: string, depth: number, blocks: Block[] = [p("cuerpo " + title)]): ExportPage => ({ id, title, depth, blocks });
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const ok = async (pages: ExportPage[], assets = new MemoryAssetStore(), opts: Parameters<typeof exportHtml>[2] = {}) => {
  const r = await exportHtml({ pages }, { assets }, opts);
  if (r.status !== "done") throw new Error("esperaba done: " + r.status);
  return r;
};

describe("documento autocontenido (T-402)", () => {
  it("es un HTML completo con título, estilos incrustados y sin recursos externos", async () => {
    const { html } = await ok([page("1", "Mi página", 0)]);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<html lang="es">');
    expect(html).toContain("<title>Mi página</title>");
    expect(html).toContain("<style>");
    expect(html).not.toMatch(/<link\b/i);
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/\s(?:src|href)="(?!#|data:|https?:|mailto:|tel:)/i);
    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain("default-src 'none'");
  });
  it("escapa el título de la página", async () => {
    const { html } = await ok([page("1", "<img src=x onerror=alert(1)>", 0)]);
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });
  it("las imágenes adjuntas van en línea (data:) y se detecta su tipo", async () => {
    const assets = new MemoryAssetStore();
    const info = await assets.put(PNG);
    const img: Block = { id: "i", type: "image", props: { url: assetUrl(info.hash), name: "a.png", caption: "" }, content: undefined, children: [] };
    const { html, report } = await ok([page("1", "P", 0, [img])], assets);
    expect(html).toContain('src="data:image/png;base64,');
    expect(html).not.toContain("asset:");
    expect(report.missing).toEqual([]);
  });
  it("sniffMime reconoce formatos por sus primeros bytes y, si no, por el nombre", () => {
    expect(sniffMime(PNG, "x")).toBe("image/png");
    expect(sniffMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), "x")).toBe("image/jpeg");
    expect(sniffMime(new TextEncoder().encode("GIF89a.."), "x")).toBe("image/gif");
    expect(sniffMime(new TextEncoder().encode("%PDF-1.7"), "x")).toBe("application/pdf");
    expect(sniffMime(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"), "x.svg")).toBe("image/svg+xml");
    expect(sniffMime(new Uint8Array([1, 2, 3]), "notas.txt")).toBe("text/plain");
    expect(sniffMime(new Uint8Array([1, 2, 3]), "raro.bin")).toBe("application/octet-stream");
  });
});

describe("adjunto faltante (T-407)", () => {
  it("avisa de cuál falta y completa la exportación con el resto", async () => {
    const assets = new MemoryAssetStore();
    const hash = "b".repeat(64);
    const img: Block = { id: "i", type: "image", props: { url: assetUrl(hash), name: "perdida.png" }, content: undefined, children: [] };
    const { html, report } = await ok([page("1", "P", 0, [img, p("texto que sí está")])], assets);
    expect(report.missing).toEqual([{ name: "perdida.png", url: assetUrl(hash) }]);
    expect(html).toContain("texto que sí está");
    expect(html).toContain("Adjunto no disponible: perdida.png");
  });
  it("un fallo al leer el adjunto cuenta como faltante, no como error", async () => {
    const assets = new MemoryAssetStore();
    const info = await assets.put(PNG);
    assets.get = async () => { throw new Error("disco"); };
    const img: Block = { id: "i", type: "image", props: { url: assetUrl(info.hash), name: "x.png" }, content: undefined, children: [] };
    const { report } = await ok([page("1", "P", 0, [img])], assets);
    expect(report.missing).toHaveLength(1);
  });
});

describe("con páginas hijas (T-405)", () => {
  const tree = [page("r", "Raíz", 0), page("a", "Hija A", 1), page("a1", "Nieta", 2), page("b", "Hija B", 1)];
  it("incluye un índice con enlaces internos y cada página en su sección", async () => {
    const { html } = await ok(tree);
    expect(html).toContain('<nav class="toc"');
    for (const [i, title] of ["Raíz", "Hija A", "Nieta", "Hija B"].entries()) {
      expect(html).toContain(`<a href="#page-${i}">${title}</a>`);
      expect(html).toContain(`<section class="page depth-${Math.min(i === 2 ? 2 : i === 0 ? 0 : 1, 2)}" id="page-${i}">`);
    }
    expect(html.indexOf("Raíz</h1>")).toBeLessThan(html.indexOf("Hija A</h1>"));
    expect(html.indexOf("Nieta</h1>")).toBeLessThan(html.indexOf("Hija B</h1>"));
  });
  it("una sola página no lleva índice", async () => {
    const { html } = await ok([page("r", "Sola", 0)]);
    expect(html).not.toContain('class="toc"');
  });
  it("las menciones entre páginas exportadas son enlaces internos", async () => {
    const m: Block = { id: "m", type: "paragraph", props: {}, content: [{ type: "mention", pageId: "a", title: "Hija A" }], children: [] };
    const { html } = await ok([page("r", "Raíz", 0, [m]), page("a", "Hija A", 1)]);
    expect(html).toContain('<a class="mention" href="#page-1">Hija A</a>');
  });
  it("una página sin título se llama «Sin título»", async () => {
    const { html } = await ok([page("r", "  ", 0)]);
    expect(html).toContain("<title>Sin título</title>");
  });
});

describe("impresión (T-408)", () => {
  it("trae estilos de impresión: saltos entre páginas, sin sombras y enlaces legibles", async () => {
    const { html } = await ok([page("r", "R", 0)]);
    expect(html).toContain("@media print");
    expect(html).toContain("page-break-before");
    expect(html).toContain("@page");
  });
});

describe("progreso y cancelación (T-411, CL-31)", () => {
  const many = Array.from({ length: 60 }, (_, i) => page("p" + i, "Pág " + i, i === 0 ? 0 : 1));
  it("informa el avance hasta el total", async () => {
    const seen: [number, number][] = [];
    await ok(many, new MemoryAssetStore(), { onProgress: (d, tot) => seen.push([d, tot]) });
    expect(seen.length).toBeGreaterThan(1);
    expect(seen.at(-1)![0]).toBe(seen.at(-1)![1]);
    expect(seen.map((s) => s[0])).toEqual([...seen.map((s) => s[0])].sort((a, b) => a - b));
  });
  it("cancelar a la mitad devuelve «cancelado» y ningún documento a medias", async () => {
    const ac = new AbortController();
    const r = await exportHtml({ pages: many }, { assets: new MemoryAssetStore() }, { signal: ac.signal, onProgress: (d) => { if (d >= 20) ac.abort(); } });
    expect(r.status).toBe("cancelled");
    expect("html" in r).toBe(false);
  });
  it("cancelar antes de empezar no hace nada", async () => {
    const ac = new AbortController(); ac.abort();
    expect((await exportHtml({ pages: many }, { assets: new MemoryAssetStore() }, { signal: ac.signal })).status).toBe("cancelled");
  });
  it("exportar no modifica las páginas de entrada", async () => {
    const copy = JSON.stringify(many);
    await ok(many);
    expect(JSON.stringify(many)).toBe(copy);
  });
});

describe("vista de base de datos elegida (T-406)", () => {
  it("usa la función que entrega la vista de cada bloque", async () => {
    const b: Block = { id: "dv", type: "databaseView", props: { databaseId: "d1", viewId: "v1" }, content: undefined, children: [] };
    const asked: string[] = [];
    const r = await exportHtml({ pages: [page("r", "R", 0, [b])] }, { assets: new MemoryAssetStore(), databaseView: async (blk) => { asked.push(blk.id); return { name: "Tareas", viewName: "Todas", properties: [], rows: [{ pageId: "x", title: "Fila 1", position: "a", values: {} }] }; } });
    expect(asked).toEqual(["dv"]);
    expect(r.status === "done" && r.html).toContain("<td>Fila 1</td>");
  });
});
