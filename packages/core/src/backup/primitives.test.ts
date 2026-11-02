// T-169, T-171, T-172, T-177 (prueba primero): piezas deterministas del respaldo.
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fc from "fast-check";
import { stableJson } from "./stableJson";
import { slugify, buildPagePaths } from "./paths";
import { blocksToMarkdown } from "./markdown";
import { gitBlobSha, gitTreeSha } from "./gitHash";
import { defaultProps, type Block, type Inline, type InlineText } from "../blocks/types";

describe("JSON estable (T-169)", () => {
  it("ordena las claves recursivamente, usa 2 espacios y termina en un solo salto de línea", () => {
    expect(stableJson({ b: 1, a: { d: 2, c: [3, { z: 1, y: 2 }] } })).toBe('{\n  "a": {\n    "c": [\n      3,\n      {\n        "y": 2,\n        "z": 1\n      }\n    ],\n    "d": 2\n  },\n  "b": 1\n}\n');
  });
  it("mismo objeto con distinto orden de claves produce los mismos bytes", () => {
    expect(stableJson({ a: 1, b: 2, c: { x: 1, y: 2 } })).toBe(stableJson({ c: { y: 2, x: 1 }, b: 2, a: 1 }));
  });
  it("no usa retornos de carro y omite las claves undefined", () => {
    const out = stableJson({ a: "x\r\ny", b: undefined, c: null });
    expect(out).not.toContain("\r\n");
    expect(out).toContain('"c": null');
    expect(out).not.toContain("undefined");
    expect(out).not.toContain('"b"');
  });
  it("propiedad: cualquier permutación de claves da la misma salida", () => {
    fc.assert(fc.property(fc.dictionary(fc.string({ minLength: 1, maxLength: 6 }), fc.oneof(fc.integer(), fc.string(), fc.boolean(), fc.constant(null))), (o) => {
      const reversed = Object.fromEntries(Object.entries(o).reverse());
      return stableJson(o) === stableJson(reversed);
    }), { numRuns: 300 });
  });
  it("conserva los acentos y emojis sin escapar", () => {
    expect(stableJson({ t: "canción 🎵 ñ" })).toContain("canción 🎵 ñ");
  });
});

describe("rutas estables (T-172)", () => {
  it("slugify quita acentos y caracteres raros, y limita la longitud", () => {
    expect(slugify("Canción: ¡Ñandú & Café!")).toBe("cancion-nandu-cafe");
    expect(slugify("   ")).toBe("sin-titulo");
    expect(slugify("../../etc/passwd")).toBe("etc-passwd");
    expect(slugify("a".repeat(100)).length).toBeLessThanOrEqual(40);
    expect(slugify("CON")).not.toBe(""); // nombres reservados de Windows se siguen pudiendo escribir
    expect(slugify("🎵🎵")).toBe("sin-titulo");
  });
  const page = (id: string, title: string, parentId: string | null = null, position = "a0") => ({ id, title, parentId, position });
  it("construye la ruta por jerarquía con título e id corto, y una carpeta para los que tienen hijas", () => {
    const paths = buildPagePaths([
      page("11111111-aaaa", "Proyectos", null, "a0"),
      page("22222222-bbbb", "Ideas", "11111111-aaaa", "a0"),
      page("33333333-cccc", "Diario", null, "a1"),
    ]);
    expect(paths.get("11111111-aaaa")).toBe("pages/proyectos--11111111.md");
    expect(paths.get("22222222-bbbb")).toBe("pages/proyectos--11111111/ideas--22222222.md");
    expect(paths.get("33333333-cccc")).toBe("pages/diario--33333333.md");
  });
  it("títulos repetidos o con caracteres raros nunca colisionan", () => {
    const pages = Array.from({ length: 50 }, (_, i) => page(`${String(i).padStart(8, "0")}-x`, i % 2 ? "Igual" : "¿¿??", null, `a${i}`));
    const paths = [...buildPagePaths(pages).values()];
    expect(new Set(paths).size).toBe(paths.length);
    for (const p of paths) expect(p).toMatch(/^pages\/[a-z0-9-]+--[0-9a-f]+\.md$/);
  });
  it("si dos ids comparten los primeros 8 caracteres, alarga el id para evitar la colisión (determinista)", () => {
    const a = buildPagePaths([page("abcdef12-0001", "X"), page("abcdef12-0002", "X")]);
    const b = buildPagePaths([page("abcdef12-0002", "X"), page("abcdef12-0001", "X")]);
    expect(new Set(a.values()).size).toBe(2);
    expect([...a.entries()].sort()).toEqual([...b.entries()].sort());
  });
  it("renombrar una página no cambia su ruta de datos, solo la del Markdown (id estable)", () => {
    const antes = buildPagePaths([page("12345678-zz", "Viejo")]).get("12345678-zz")!;
    const despues = buildPagePaths([page("12345678-zz", "Nuevo")]).get("12345678-zz")!;
    expect(antes).not.toBe(despues);
    expect(antes.split("--")[1]).toBe(despues.split("--")[1]);
  });
});

const txt = (text: string, styles: Record<string, true | string> = {}): InlineText => ({ type: "text", text, styles });
const blk = (type: string, content: Block["content"], props: Record<string, unknown> = {}, children: Block[] = []): Block => ({ id: "x", type, props, content, children });
const P = (t: string, type: Parameters<typeof defaultProps>[0] = "paragraph") => blk(type, [txt(t)], defaultProps(type));

describe("Markdown legible (T-171)", () => {
  it.each([
    ["párrafo", [P("Hola")], "Hola\n"],
    ["encabezados", [blk("heading", [txt("Uno")], { level: 1 }), blk("heading", [txt("Dos")], { level: 2 }), blk("heading", [txt("Tres")], { level: 3 })], "# Uno\n\n## Dos\n\n### Tres\n"],
    ["viñetas", [P("a", "bulletListItem"), P("b", "bulletListItem")], "- a\n- b\n"],
    ["numerada", [P("a", "numberedListItem"), P("b", "numberedListItem"), P("c", "numberedListItem")], "1. a\n2. b\n3. c\n"],
    ["tareas", [blk("checkListItem", [txt("hecha")], { checked: true }), blk("checkListItem", [txt("falta")], { checked: false })], "- [x] hecha\n- [ ] falta\n"],
    ["cita", [P("sabia", "quote")], "> sabia\n"],
    ["divisor", [P("a"), blk("divider", undefined, {}), P("b")], "a\n\n---\n\nb\n"],
    ["código", [blk("codeBlock", [txt("const a = 1;\nlog(a)")], { language: "ts" })], "```ts\nconst a = 1;\nlog(a)\n```\n"],
    ["código sin lenguaje", [blk("codeBlock", [txt("x")], { language: "text" })], "```\nx\n```\n"],
    ["imagen", [blk("image", undefined, { url: "asset:abc", caption: "Mi gato", name: "gato.png" })], "![Mi gato](asset:abc)\n"],
    ["archivo", [blk("file", undefined, { url: "asset:def", name: "doc.pdf", caption: "" })], "[doc.pdf](asset:def)\n"],
    ["tabla", [blk("table", { type: "table", rows: [[[txt("A")], [txt("B")]], [[txt("1")], [txt("2")]]] })], "| A | B |\n| --- | --- |\n| 1 | 2 |\n"],
    ["hijos anidados", [blk("bulletListItem", [txt("padre")], {}, [P("hijo", "bulletListItem")])], "- padre\n  - hijo\n"],
  ])("%s", (_n, blocks, expected) => {
    expect(blocksToMarkdown(blocks as Block[])).toBe(expected);
  });
  it("estilos en línea", () => {
    const md = blocksToMarkdown([blk("paragraph", [txt("a "), txt("neg", { bold: true }), txt(" "), txt("cur", { italic: true }), txt(" "), txt("tac", { strike: true }), txt(" "), txt("cod", { code: true }), txt(" "), txt("sub", { underline: true })])]);
    expect(md).toBe("a **neg** *cur* ~~tac~~ `cod` <u>sub</u>\n");
  });
  it("enlaces", () => {
    expect(blocksToMarkdown([blk("paragraph", [{ type: "link", href: "https://x.test", content: [txt("sitio")] }])])).toBe("[sitio](https://x.test)\n");
  });
  it("escapa los caracteres especiales de Markdown en el texto normal", () => {
    expect(blocksToMarkdown([P("1 * 2 _ 3 # [x]")])).toBe("1 \\* 2 \\_ 3 \\# \\[x\\]\n");
  });
  it("una página vacía produce un archivo vacío y es determinista", () => {
    expect(blocksToMarkdown([])).toBe("");
    const b = [P("x")];
    expect(blocksToMarkdown(b)).toBe(blocksToMarkdown(JSON.parse(JSON.stringify(b))));
  });
});

describe("huellas Git (T-177)", () => {
  const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  const enc = (s: string) => new TextEncoder().encode(s);
  it("la huella de un blob coincide con git hash-object", async () => {
    const dir = mkdtempSync(join(tmpdir(), "vnote-git-"));
    git(dir, "init", "-q");
    for (const content of ["", "hola\n", "canción ñ\n", "x".repeat(10_000)]) {
      writeFileSync(join(dir, "f"), content);
      expect(await gitBlobSha(enc(content))).toBe(git(dir, "hash-object", "f"));
    }
  });
  it("la huella de un árbol con carpetas anidadas coincide con git write-tree", async () => {
    const dir = mkdtempSync(join(tmpdir(), "vnote-git-"));
    git(dir, "init", "-q");
    const files: Record<string, string> = {
      "workspace.json": "{}\n", "pages/a--1.md": "A\n", "pages/a--1/b--2.md": "B\n", "pages-extra.txt": "x\n", "data/1.json": "{}\n", "assets/ff": "bytes",
    };
    const shas = new Map<string, string>();
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(join(dir, path, ".."), { recursive: true });
      writeFileSync(join(dir, path), content);
      shas.set(path, await gitBlobSha(enc(content)));
    }
    git(dir, "add", "-A");
    expect(await gitTreeSha(shas)).toBe(git(dir, "write-tree"));
  });
  it("un árbol vacío tiene la huella conocida de git", async () => {
    expect(await gitTreeSha(new Map())).toBe("4b825dc642cb6eb9a060e54bf8d69288fbee4904");
  });
});
