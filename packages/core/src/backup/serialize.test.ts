// T-168, T-170, T-173, T-174, T-175, T-176 (prueba primero): el espacio completo se serializa a archivos de forma determinista.
import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import * as Y from "yjs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { MemoryAssetStore } from "../assets/memoryAssetStore";
import { toYjs } from "../blocks/toYjs";
import { fromYjs } from "../blocks/fromYjs";
import { defaultProps, type Block } from "../blocks/types";
import { serializeWorkspace, FORMAT_VERSION } from "./serialize";
import type { SqlStore } from "../ports/sqlStore";

let db: SqlStore;
let assets: MemoryAssetStore;
beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  assets = new MemoryAssetStore();
});

const para = (id: string, text: string, extra: Partial<Block> = {}): Block => ({ id, type: "paragraph", props: defaultProps("paragraph"), content: [{ type: "text", text, styles: {} }], children: [], ...extra });

async function addPage(id: string, title: string, parentId: string | null, position: string, blocks: Block[] = [], opts: { deletedAt?: number; deletedRootId?: string; favorite?: boolean; icon?: string; kind?: string } = {}) {
  await db.exec(
    "INSERT INTO pages(id, parent_id, position, title, icon, kind, favorite, created_at, updated_at, deleted_at, deleted_root_id) VALUES (?, ?, ?, ?, ?, ?, ?, 1000, 2000, ?, ?)",
    [id, parentId, position, title, opts.icon ?? null, opts.kind ?? "note", opts.favorite ? 1 : 0, opts.deletedAt ?? null, opts.deletedRootId ?? null],
  );
  if (blocks.length) {
    const doc = new Y.Doc();
    toYjs(blocks, doc.getXmlFragment("doc"));
    await db.exec("INSERT INTO page_docs(page_id, seq, kind, data, created_at) VALUES (?, 0, 'snapshot', ?, 1)", [id, Y.encodeStateAsUpdate(doc)]);
  }
}
const ser = (name = "Personal") => serializeWorkspace({ store: db, assets }, { id: "ws-1", name });
const text = (files: Map<string, Uint8Array>, path: string) => new TextDecoder().decode(files.get(path));

describe("workspace.json (T-168)", () => {
  it("lleva la versión del formato, el id, el nombre y el conteo de páginas", async () => {
    await addPage("aaaaaaaa-1", "Uno", null, "a0");
    const { files } = await ser();
    expect(JSON.parse(text(files, "workspace.json"))).toEqual({ formatVersion: FORMAT_VERSION, id: "ws-1", name: "Personal", pageCount: 1 });
    expect(text(files, "workspace.json").endsWith("}\n")).toBe(true);
  });
  it("la versión del formato es 1", () => expect(FORMAT_VERSION).toBe(1));
});

describe("JSON sin pérdida por página (T-170)", () => {
  it("contiene todo el modelo canónico (estilos, colores, enlaces, anidados) y los metadatos", async () => {
    const f = JSON.parse(readFileSync(resolve(__dirname, "../../tests/fixtures/basic.json"), "utf8"));
    const y = new Y.Doc();
    Y.applyUpdate(y, Uint8Array.from(atob(f.update), (c) => c.charCodeAt(0)));
    const blocks = fromYjs(y.getXmlFragment("doc"));
    await addPage("bbbbbbbb-2", "Rica", null, "a0", blocks, { favorite: true, icon: "📓" });
    const { files } = await ser();
    const data = JSON.parse(text(files, "data/bbbbbbbb-2.json"));
    expect(data.blocks).toEqual(blocks);
    expect(data).toMatchObject({ id: "bbbbbbbb-2", parentId: null, title: "Rica", icon: "📓", favorite: true, kind: "note", createdAt: 1000, updatedAt: 2000, deletedAt: null });
  });
  it("una página sin documento tiene la lista de bloques vacía", async () => {
    await addPage("cccccccc-3", "Vacía", null, "a0");
    expect(JSON.parse(text((await ser()).files, "data/cccccccc-3.json")).blocks).toEqual([]);
  });
  it("se restauran los bloques exactamente: JSON -> Yjs -> bloques es la identidad", async () => {
    const blocks = [para("p1", "uno"), para("p2", "dos", { children: [para("p3", "hijo")] })];
    await addPage("dddddddd-4", "X", null, "a0", blocks);
    const data = JSON.parse(text((await ser()).files, "data/dddddddd-4.json"));
    const y = new Y.Doc();
    toYjs(data.blocks, y.getXmlFragment("doc"));
    expect(fromYjs(y.getXmlFragment("doc"))).toEqual(blocks);
  });
});

describe("Markdown y estructura de carpetas", () => {
  it("genera un Markdown por página viva con la ruta jerárquica", async () => {
    await addPage("11111111-a", "Proyectos", null, "a0", [para("p1", "Hola mundo")]);
    await addPage("22222222-b", "Ideas", "11111111-a", "a0", [para("p2", "Una idea")]);
    const { files } = await ser();
    expect(text(files, "pages/proyectos--11111111.md")).toBe("Hola mundo\n");
    expect(text(files, "pages/proyectos--11111111/ideas--22222222.md")).toBe("Una idea\n");
  });
  it("las páginas en la papelera no tienen Markdown pero sí JSON y entrada en trash.json (T-174)", async () => {
    await addPage("33333333-c", "Borrada", null, "a0", [para("p", "x")], { deletedAt: 5555, deletedRootId: "33333333-c" });
    await addPage("44444444-d", "Hija borrada", "33333333-c", "a0", [], { deletedAt: 5555, deletedRootId: "33333333-c" });
    const { files } = await ser();
    expect([...files.keys()].filter((k) => k.startsWith("pages/"))).toEqual([]);
    expect(files.has("data/33333333-c.json")).toBe(true);
    expect(JSON.parse(text(files, "trash.json"))).toEqual([
      { id: "33333333-c", deletedAt: 5555, deletedRootId: "33333333-c" },
      { id: "44444444-d", deletedAt: 5555, deletedRootId: "33333333-c" },
    ]);
  });
  it("sin papelera, trash.json es una lista vacía", async () => {
    expect(JSON.parse(text((await ser()).files, "trash.json"))).toEqual([]);
  });
});

describe("adjuntos (T-173)", () => {
  it("se guardan con el hash como nombre y el mismo contenido da un solo archivo", async () => {
    const a = await assets.put(new Uint8Array([1, 2, 3]));
    await assets.put(new Uint8Array([1, 2, 3]));
    const b = await assets.put(new Uint8Array([9]));
    const { files } = await ser();
    const keys = [...files.keys()].filter((k) => k.startsWith("assets/")).sort();
    expect(keys).toEqual([`assets/${a.hash}`, `assets/${b.hash}`].sort());
    expect([...files.get(`assets/${a.hash}`)!]).toEqual([1, 2, 3]);
  });
  it("omite y lista los adjuntos que superan el límite de GitHub", async () => {
    const big = await assets.put(new Uint8Array(20));
    const small = await assets.put(new Uint8Array(3));
    const r = await serializeWorkspace({ store: db, assets }, { id: "w", name: "n" }, { maxAssetBytes: 10 });
    expect(r.skipped).toEqual([{ hash: big.hash, size: 20 }]);
    expect(r.files.has(`assets/${big.hash}`)).toBe(false);
    expect(r.files.has(`assets/${small.hash}`)).toBe(true);
  });
});

describe("archivo dorado (T-175)", () => {
  it("un espacio de ejemplo produce exactamente el árbol de archivos de referencia", async () => {
    await addPage("0a1b2c3d-1", "Inicio", null, "a0", [para("b1", "Bienvenida"), { id: "b2", type: "heading", props: { ...defaultProps("heading"), level: 2 }, content: [{ type: "text", text: "Tareas", styles: {} }], children: [] }], { favorite: true, icon: "🏠" });
    await addPage("4e5f6a7b-2", "Ideas & Notas", "0a1b2c3d-1", "a0", [{ id: "b3", type: "checkListItem", props: { ...defaultProps("checkListItem"), checked: true }, content: [{ type: "text", text: "Hecho", styles: { bold: true } }], children: [] }]);
    await addPage("8c9d0e1f-3", "Vieja", null, "a1", [para("b4", "borrada")], { deletedAt: 9000, deletedRootId: "8c9d0e1f-3" });
    await assets.put(new TextEncoder().encode("adjunto de ejemplo"));
    const { files } = await ser("Ejemplo");
    const snapshot = Object.fromEntries([...files.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => [k, k.startsWith("assets/") ? `base64:${btoa(String.fromCharCode(...v))}` : new TextDecoder().decode(v)]));
    await expect(JSON.stringify(snapshot, null, 2) + "\n").toMatchFileSnapshot("../../tests/golden/backup-v1.json");
  });
});

describe("determinismo (T-176)", () => {
  it("propiedad: el mismo contenido da los mismos bytes, sin importar el orden de inserción ni cuántas veces se serialice", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.tuple(fc.stringMatching(/^[A-Za-zñé ]{0,8}$/), fc.stringMatching(/^[a-z ]{0,20}$/)), { minLength: 1, maxLength: 8 }), fc.integer({ min: 0, max: 1000 }), async (pagesSpec, seed) => {
        const build = async (order: number[]) => {
          const d = await createNodeSqliteStore(":memory:");
          await migrate(d, migrations);
          const a = new MemoryAssetStore();
          const prev = db;
          db = d;
          for (const i of order) {
            const [title, body] = pagesSpec[i]!;
            await addPage(`${String(i).padStart(8, "0")}-id`, title, i > 0 && i % 3 === 0 ? `${String(i - 1).padStart(8, "0")}-id` : null, `a${String(i).padStart(3, "0")}`, [para(`b${i}`, body)]);
          }
          const r = await serializeWorkspace({ store: d, assets: a }, { id: "w", name: "n" });
          db = prev;
          return [...r.files.entries()].sort(([x], [y]) => (x < y ? -1 : 1)).map(([k, v]) => `${k}=${[...v].join(",")}`);
        };
        const idx = pagesSpec.map((_, i) => i);
        const forward = await build(idx);
        const shuffled = [...idx].sort((x, y) => ((x * 7919 + seed) % 13) - ((y * 7919 + seed) % 13) || x - y);
        // los hijos deben insertarse después de su padre por la clave foránea
        const ordered = shuffled.filter((i) => i % 3 !== 0 || i === 0).concat(shuffled.filter((i) => i % 3 === 0 && i !== 0)).sort((a, b) => (a % 3 === 0 && a !== 0 ? 1 : 0) - (b % 3 === 0 && b !== 0 ? 1 : 0));
        return JSON.stringify(forward) === JSON.stringify(await build(ordered)) && JSON.stringify(forward) === JSON.stringify(await build(idx));
      }),
      { numRuns: 100 },
    );
  }, 60_000);
});
