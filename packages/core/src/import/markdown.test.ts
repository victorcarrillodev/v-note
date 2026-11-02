// T-386, T-388 (prueba primero): Markdown → modelo canónico de bloques.
import { describe, it, expect } from "vitest";
import { markdownToBlocks } from "./markdown";
import type { Block } from "../blocks/types";

const text = (t: string, styles: Record<string, true | string> = {}) => ({ type: "text" as const, text: t, styles });
const strip = (bs: Block[]): unknown[] => bs.map((b) => ({ type: b.type, props: b.props, content: b.content, children: strip(b.children) }));
const one = (md: string) => markdownToBlocks(md).blocks;

describe("Markdown a bloques (T-386)", () => {
  it("párrafos con negrita, cursiva, tachado, código y enlaces", () => {
    const [b] = one("Hola **fuerte** y *suave* con ~~tachado~~, `código` y [sitio](https://a.b).");
    expect(b!.type).toBe("paragraph");
    expect(b!.content).toEqual([
      text("Hola "), text("fuerte", { bold: true }), text(" y "), text("suave", { italic: true }), text(" con "), text("tachado", { strike: true }),
      text(", "), text("código", { code: true }), text(" y "), { type: "link", href: "https://a.b", content: [text("sitio")] }, text("."),
    ]);
  });
  it("encabezados de nivel 1 a 3; los más profundos se aproximan a nivel 3 y se reportan", () => {
    const r = markdownToBlocks("# Uno\n\n## Dos\n\n### Tres\n\n#### Cuatro");
    expect(r.blocks.map((b) => [b.type, b.props.level])).toEqual([["heading", 1], ["heading", 2], ["heading", 3], ["heading", 3]]);
    expect(r.approximations.some((a) => /nivel 4/.test(a))).toBe(true);
  });
  it("listas con viñetas, numeradas, de tareas y anidadas", () => {
    const bs = one("- a\n  - a1\n- b\n\n1. uno\n2. dos\n\n- [ ] pendiente\n- [x] hecha");
    expect(strip(bs).map((b) => (b as { type: string }).type)).toEqual(["bulletListItem", "bulletListItem", "numberedListItem", "numberedListItem", "checkListItem", "checkListItem"]);
    expect(bs[0]!.children.map((c) => c.type)).toEqual(["bulletListItem"]);
    expect(bs[0]!.children[0]!.content).toEqual([text("a1")]);
    expect(bs[4]!.props.checked).toBe(false);
    expect(bs[5]!.props.checked).toBe(true);
  });
  it("citas, divisores y bloques de código con su lenguaje", () => {
    const bs = one("> cita\n\n---\n\n```ts\nconst x = 1;\n```");
    expect(bs.map((b) => b.type)).toEqual(["quote", "divider", "codeBlock"]);
    expect(bs[0]!.content).toEqual([text("cita")]);
    expect(bs[2]!.props.language).toBe("ts");
    expect(bs[2]!.content).toEqual([text("const x = 1;")]);
  });
  it("tablas", () => {
    const [b] = one("| A | B |\n|---|---|\n| 1 | **2** |");
    expect(b!.type).toBe("table");
    expect(b!.content).toEqual({ type: "table", rows: [[[text("A")], [text("B")]], [[text("1")], [text("2", { bold: true })]]] });
  });
  it("una imagen sola en su párrafo es un bloque de imagen y se anota para resolver el archivo", () => {
    const r = markdownToBlocks("![diagrama](img/a.png)");
    expect(r.blocks.map((b) => b.type)).toEqual(["image"]);
    expect(r.blocks[0]!.props).toMatchObject({ url: "img/a.png", caption: "diagrama" });
    expect(r.images).toEqual([{ blockId: r.blocks[0]!.id, src: "img/a.png" }]);
  });
  it("HTML y elementos sin equivalente se conservan como texto y se reportan", () => {
    const r = markdownToBlocks("<div>hola</div>\n\nTexto con nota[^1].\n\n[^1]: la nota");
    expect(r.blocks.length).toBeGreaterThan(0);
    expect(r.approximations.length).toBeGreaterThan(0);
    expect(JSON.stringify(r.blocks)).toContain("hola");
  });
  it("el encabezado YAML se quita sin romper el contenido", () => {
    const r = markdownToBlocks("---\ntags: [a]\n---\n\n# Título\n\ntexto");
    expect(r.blocks.map((b) => b.type)).toEqual(["heading", "paragraph"]);
    expect(r.approximations.some((a) => /encabezado/i.test(a))).toBe(true);
  });
  it("texto vacío da una lista vacía; las líneas en blanco no crean bloques", () => {
    expect(one("")).toEqual([]);
    expect(one("\n\n\n")).toEqual([]);
  });
});

describe("enlaces [[ ]] de Obsidian (T-388)", () => {
  it("se leen como menciones sin resolver; el alias se descarta y se reporta (la mención muestra el título vigente)", () => {
    const r = markdownToBlocks("Ver [[Otra nota]] y [[Plan|el plan]].", { wikilinks: true });
    expect(r.blocks[0]!.content).toEqual([text("Ver "), { type: "mention", pageId: "", title: "Otra nota" }, text(" y "), { type: "mention", pageId: "", title: "Plan" }, text(".")]);
    expect(r.approximations.some((a) => /alias/i.test(a))).toBe(true);
  });
  it("sin la opción, se dejan como texto", () => {
    const [b] = markdownToBlocks("Ver [[Otra]]").blocks;
    expect(b!.content).toEqual([text("Ver [[Otra]]")]);
  });
});
