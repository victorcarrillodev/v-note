// T-401, T-402, T-406 y T-407 (prueba primero): renderizador de bloques a HTML autocontenido (RF-24).
import { describe, it, expect } from "vitest";
import type { Block, Inline } from "../blocks/types";
import { blocksToHtml, collectAssetUrls, newReport, type RenderContext } from "./html";
import { newTree, addChild } from "../diagrams/tree";
import { serializeTree } from "../diagrams/tree";
import { assetUrl } from "../assets/attach";

const HASH = "a".repeat(64);
const t = (text: string, styles: Record<string, true | string> = {}): Inline => ({ type: "text", text, styles });
const blk = (type: string, content: Block["content"], props: Record<string, unknown> = {}, children: Block[] = [], id = "b"): Block => ({ id, type, props, content, children });
const ctx = (over: Partial<RenderContext> = {}): RenderContext => ({ assets: new Map(), databases: new Map(), pageAnchors: new Map(), report: newReport(), ...over });
const html = (blocks: Block[], c: RenderContext = ctx()) => blocksToHtml(blocks, c);

describe("bloques de texto", () => {
  it("párrafo, encabezados h1 a h3 y cita", () => {
    expect(html([blk("paragraph", [t("Hola")])])).toBe("<p>Hola</p>");
    expect(html([blk("heading", [t("T")], { level: 2 })])).toBe("<h2>T</h2>");
    expect(html([blk("heading", [t("T")], { level: 9 })])).toBe("<h3>T</h3>");
    expect(html([blk("quote", [t("Dicho")])])).toBe("<blockquote>Dicho</blockquote>");
  });
  it("divisor y bloque vacío", () => {
    expect(html([blk("divider", undefined)])).toBe("<hr>");
    expect(html([blk("paragraph", [])])).toBe("<p></p>");
  });
  it("escapa HTML en el texto: no hay etiquetas vivas", () => {
    const out = html([blk("paragraph", [t('<script>alert("x")</script> & "q"')])]);
    expect(out).not.toContain("<script>");
    expect(out).toBe("<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &quot;q&quot;</p>");
  });
  it("estilos en línea: negrita, cursiva, subrayado, tachado y código", () => {
    expect(html([blk("paragraph", [t("a", { bold: true }), t("b", { italic: true }), t("c", { underline: true }), t("d", { strike: true }), t("e", { code: true })])]))
      .toBe("<p><strong>a</strong><em>b</em><u>c</u><s>d</s><code>e</code></p>");
  });
  it("color y resaltado solo con nombres permitidos (clases), nunca estilos arbitrarios", () => {
    expect(html([blk("paragraph", [t("x", { textColor: "red", backgroundColor: "yellow" })])])).toBe('<p><span class="c-red bg-yellow">x</span></p>');
    const evil = html([blk("paragraph", [t("x", { textColor: 'red" onmouseover="alert(1)' })])]);
    expect(evil).not.toContain("onmouseover");
  });
  it("alineación del texto por clase", () => {
    expect(html([blk("paragraph", [t("x")], { textAlignment: "center" })])).toBe('<p class="align-center">x</p>');
  });
});

describe("enlaces", () => {
  const link = (href: string): Inline => ({ type: "link", href, content: [{ type: "text", text: "ir", styles: {} }] });
  it("permite http, https, mailto y tel", () => {
    for (const h of ["https://a.com/x?y=1&z=2", "http://a.com", "mailto:a@b.c", "tel:+5255"]) {
      expect(html([blk("paragraph", [link(h)])])).toContain('<a href="');
    }
    expect(html([blk("paragraph", [link("https://a.com/x?y=1&z=2")])])).toContain('href="https://a.com/x?y=1&amp;z=2"');
  });
  it("rechaza javascript:, data: y similares: queda solo el texto", () => {
    for (const h of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<b>", "vbscript:x", " javascript:alert(1)"]) {
      const out = html([blk("paragraph", [link(h)])]);
      expect(out).toBe("<p>ir</p>");
    }
  });
  it("las menciones son texto, o enlace interno si la página también se exporta", () => {
    const m: Inline = { type: "mention", pageId: "p1", title: "Otra" };
    expect(html([blk("paragraph", [m])])).toBe('<p><span class="mention">Otra</span></p>');
    expect(html([blk("paragraph", [m])], ctx({ pageAnchors: new Map([["p1", "page-1"]]) }))).toBe('<p><a class="mention" href="#page-1">Otra</a></p>');
  });
});

describe("listas", () => {
  it("agrupa elementos consecutivos y anida a los hijos", () => {
    const out = html([
      blk("bulletListItem", [t("a")], {}, [blk("bulletListItem", [t("a1")])]),
      blk("bulletListItem", [t("b")]),
      blk("paragraph", [t("fin")]),
    ]);
    expect(out).toBe("<ul><li>a<ul><li>a1</li></ul></li><li>b</li></ul><p>fin</p>");
  });
  it("lista numerada y de tareas", () => {
    expect(html([blk("numberedListItem", [t("uno")]), blk("numberedListItem", [t("dos")])])).toBe("<ol><li>uno</li><li>dos</li></ol>");
    expect(html([blk("checkListItem", [t("hecho")], { checked: true }), blk("checkListItem", [t("falta")], { checked: false })]))
      .toBe('<ul class="todo"><li><input type="checkbox" disabled checked> hecho</li><li><input type="checkbox" disabled> falta</li></ul>');
  });
  it("el desplegable usa details/summary", () => {
    expect(html([blk("toggleListItem", [t("Más")], {}, [blk("paragraph", [t("oculto")])])])).toBe("<details><summary>Más</summary><p>oculto</p></details>");
  });
});

describe("código, tabla y bloques propios", () => {
  it("bloque de código con lenguaje y texto escapado", () => {
    expect(html([blk("codeBlock", [t("a < b")], { language: "ts" })])).toBe('<pre><code class="language-ts">a &lt; b</code></pre>');
    expect(html([blk("codeBlock", [t("x")], { language: 'x" onclick="y' })])).not.toContain("onclick");
  });
  it("tabla con la primera fila como encabezado", () => {
    const table: Block["content"] = { type: "table", rows: [[[t("A")], [t("B")]], [[t("1")], [t("2")]]] };
    expect(html([blk("table", table)])).toBe("<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>");
  });
  it("aviso destacado, tarea y tarjeta de enlace", () => {
    expect(html([blk("callout", [t("Ojo")], { variant: "warning" })])).toBe('<aside class="callout callout-warning">Ojo</aside>');
    expect(html([blk("callout", [t("Ojo")], { variant: "x\" y" })])).toBe('<aside class="callout callout-info">Ojo</aside>');
    expect(html([blk("task", [t("Pagar")], { checked: false, due: "2026-03-10" })])).toContain("Pagar");
    expect(html([blk("task", [t("Pagar")], { checked: false, due: "2026-03-10" })])).toContain("2026-03-10");
    expect(html([blk("linkCard", undefined, { url: "https://e.com/a", title: "Ej" })])).toBe('<a class="link-card" href="https://e.com/a">Ej</a>');
    expect(html([blk("linkCard", undefined, { url: "javascript:x", title: "Ej" })])).toBe('<p class="link-card">Ej</p>');
  });
  it("un tipo desconocido conserva su texto", () => {
    expect(html([blk("rareza", [t("texto")])])).toBe("<p>texto</p>");
  });
});

describe("diagramas y organizadores (T-403, T-404)", () => {
  it("se incrustan como vectores", () => {
    const added = addChild(newTree("Centro"), "root", "Rama", "r");
    if (!added.ok) throw new Error("x");
    const tree = serializeTree(added.value.tree);
    const out = html([blk("mindmap", undefined, { data: tree })]);
    expect(out).toContain('<figure class="diagram"><svg ');
    expect(out).toContain("Centro");
  });
  it("datos ilegibles no rompen la exportación: se avisa", () => {
    const c = ctx();
    const out = html([blk("diagram", undefined, { data: "{no es json" })], c);
    expect(out).toContain("no se pudo");
    expect(c.report.warnings.length).toBe(1);
  });
});

describe("adjuntos (T-402, T-407)", () => {
  const png = "data:image/png;base64,AAAA";
  it("la imagen resuelta se incrusta en línea, con su pie", () => {
    const c = ctx({ assets: new Map([[assetUrl(HASH), { dataUri: png }]]) });
    const out = html([blk("image", undefined, { url: assetUrl(HASH), name: "foto.png", caption: "Mi foto" })], c);
    expect(out).toBe(`<figure><img src="${png}" alt="Mi foto"><figcaption>Mi foto</figcaption></figure>`);
    expect(out).not.toContain("asset:");
  });
  it("una imagen faltante avisa, deja un marcador y el resto se exporta", () => {
    const c = ctx({ assets: new Map([[assetUrl(HASH), null]]) });
    const out = html([blk("image", undefined, { url: assetUrl(HASH), name: "foto.png" }), blk("paragraph", [t("sigue")])], c);
    expect(out).toContain('class="missing"');
    expect(out).toContain("foto.png");
    expect(out).toContain("<p>sigue</p>");
    expect(c.report.missing).toEqual([{ name: "foto.png", url: assetUrl(HASH) }]);
  });
  it("una imagen externa https se enlaza tal cual; otros esquemas se rechazan", () => {
    expect(html([blk("image", undefined, { url: "https://e.com/i.png", name: "i" })])).toContain('src="https://e.com/i.png"');
    expect(html([blk("image", undefined, { url: "javascript:x", name: "i" })])).not.toContain("javascript");
  });
  it("un archivo adjunto disponible es un enlace de descarga; si falta, se avisa", () => {
    const c = ctx({ assets: new Map([[assetUrl(HASH), { dataUri: "data:application/pdf;base64,AAAA" }]]) });
    expect(html([blk("file", undefined, { url: assetUrl(HASH), name: "doc.pdf" })], c)).toBe('<p class="file"><a href="data:application/pdf;base64,AAAA" download="doc.pdf">doc.pdf</a></p>');
    const c2 = ctx({ assets: new Map([[assetUrl(HASH), null]]) });
    expect(html([blk("file", undefined, { url: assetUrl(HASH), name: "doc.pdf" })], c2)).toContain('class="missing"');
    expect(c2.report.missing).toHaveLength(1);
  });
  it("collectAssetUrls encuentra los adjuntos de bloques anidados, sin repetir", () => {
    const urls = collectAssetUrls([
      blk("image", undefined, { url: assetUrl(HASH) }),
      blk("toggleListItem", [t("x")], {}, [blk("file", undefined, { url: assetUrl(HASH) }), blk("image", undefined, { url: "https://e.com/i.png" })]),
    ]);
    expect(urls).toEqual([assetUrl(HASH)]);
  });
});

describe("vista de base de datos (T-406)", () => {
  it("exporta la vista elegida como tabla con sus columnas y filas", () => {
    const props = [{ id: "n", name: "Nombre", type: "text", config: {} }, { id: "h", name: "Hecho", type: "checkbox", config: {} }] as never;
    const rows = [{ pageId: "p1", title: "Uno", position: "a", values: { n: "x", h: true } }, { pageId: "p2", title: "Dos", position: "b", values: { n: "<y>", h: false } }] as never;
    const c = ctx({ databases: new Map([["blk1", { name: "Tareas", viewName: "Todas", properties: props, rows }]]) });
    const out = html([blk("databaseView", undefined, { databaseId: "d1", viewId: "v1" }, [], "blk1")], c);
    expect(out).toContain("<caption>Tareas · Todas</caption>");
    expect(out).toContain("<th>Título</th><th>Nombre</th><th>Hecho</th>");
    expect(out).toContain("<td>Uno</td><td>x</td><td>Sí</td>");
    expect(out).toContain("<td>&lt;y&gt;</td><td>No</td>");
  });
  it("sin datos de la vista deja un aviso y no falla", () => {
    const c = ctx();
    expect(html([blk("databaseView", undefined, { databaseId: "d1" }, [], "zz")], c)).toContain("no está disponible");
    expect(c.report.warnings).toHaveLength(1);
  });
});
