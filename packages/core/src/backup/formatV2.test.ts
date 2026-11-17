// Respaldo formato v2 (plan 005, §11). Tareas E-063 a E-071.
import { describe, it, expect, beforeEach } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { para, updateFor } from "../../tests/support/builders";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { FakeClock } from "../clock";
import { MemoryAssetStore } from "../assets/memoryAssetStore";
import { PageService } from "../pages/pageService";
import { PagesRepo } from "../pages/pagesRepo";
import { loadPageDefaultStyle, savePageDefaultStyle } from "../pages/pageDefaults";
import type { SqlStore } from "../ports/sqlStore";
import { serializeWorkspace, FORMAT_VERSION } from "./serialize";
import { restoreFromFiles, validateBackup } from "./restore";

const must = <T>(r: { ok: boolean; value?: T; error?: unknown }): T => { if (!r.ok) throw new Error(JSON.stringify(r.error)); return r.value as T; };
const dec = new TextDecoder(), enc = new TextEncoder();
const credit = { source: "unsplash" as const, photoId: "abc", author: "Ana", authorUrl: "https://unsplash.com/@ana", photoUrl: "https://unsplash.com/photos/abc" };
const HASH = "a".repeat(64);

let db: SqlStore, clock: FakeClock, svc: PageService, repo: PagesRepo;
const fresh = async () => { const s = await createNodeSqliteStore(":memory:"); await migrate(s, migrations); return s; };
beforeEach(async () => { db = await fresh(); clock = new FakeClock(1_000); svc = new PageService(db, clock); repo = new PagesRepo(db, clock); });

const ser = async (store = db) => serializeWorkspace({ store, assets: new MemoryAssetStore() }, { id: "ws", name: "P" });
const pageJson = async (id: string, store = db) => JSON.parse(dec.decode((await ser(store)).files.get(`data/${id}.json`)!));
const restore = async (files: Map<string, Uint8Array>) => {
  const target = await fresh();
  const r = await restoreFromFiles(files, { store: target, assets: new MemoryAssetStore() });
  expect(r.ok).toBe(true);
  return target;
};
const edit = (files: Map<string, Uint8Array>, id: string, fn: (j: Record<string, unknown>) => void) => {
  const out = new Map(files);
  const j = JSON.parse(dec.decode(out.get(`data/${id}.json`)!));
  fn(j);
  out.set(`data/${id}.json`, enc.encode(JSON.stringify(j)));
  return out;
};

describe("serialize v2 (E-063 a E-065)", () => {
  it("una página sin estilo no escribe ningún campo nuevo (E-063)", async () => {
    const p = must(await svc.create({ title: "A" }));
    const j = await pageJson(p.id);
    for (const k of ["style", "description", "locked", "coverCredit", "fullWidth"]) expect(j).not.toHaveProperty(k);
  });
  it("escribe style, description, locked y coverCredit solo cuando no son los predeterminados (E-063)", async () => {
    const p = must(await svc.create({ title: "A" }));
    must(await repo.setProps(p.id, { cover: `asset:${HASH}`, coverCredit: credit, style: { accent: "blue", spacing: { width: "full" } }, description: "Resumen", locked: true }));
    expect(await pageJson(p.id)).toMatchObject({ cover: `asset:${HASH}`, coverCredit: credit, style: { accent: "blue", spacing: { width: "full" } }, description: "Resumen", locked: true });
  });
  it("deja de escribir fullWidth y sube formatVersion a 2 (E-064)", async () => {
    const p = must(await svc.create({ title: "A" }));
    must(await repo.setStyle(p.id, { spacing: { width: "full" } }));
    expect(await pageJson(p.id)).not.toHaveProperty("fullWidth");
    expect(FORMAT_VERSION).toBe(2);
    expect(JSON.parse(dec.decode((await ser()).files.get("workspace.json")!)).formatVersion).toBe(2);
  });
  it("page-defaults.json solo existe si hay predeterminado (E-065)", async () => {
    expect((await ser()).files.has("page-defaults.json")).toBe(false);
    await savePageDefaultStyle(db, { accent: "green" });
    expect(JSON.parse(dec.decode((await ser()).files.get("page-defaults.json")!))).toEqual({ accent: "green" });
  });
});

describe("restore v2 (E-066 a E-069)", () => {
  const withVersion = async (v: number) => { const f = new Map((await ser()).files); f.set("workspace.json", enc.encode(JSON.stringify({ formatVersion: v, id: "ws", name: "P", pageCount: 0 }))); return f; };
  it("acepta las versiones 1 y 2 y rechaza las mayores (E-066)", async () => {
    expect((await validateBackup(await withVersion(1))).ok).toBe(true);
    expect((await validateBackup(await withVersion(2))).ok).toBe(true);
    const r = await validateBackup(await withVersion(3));
    expect(!r.ok && r.error.code).toBe("UNSUPPORTED_VERSION");
  });
  it("un respaldo v1 con fullWidth pasa a ancho completo (E-067)", async () => {
    const p = must(await svc.create({ title: "A" }));
    const files = edit(await withVersion(1).then(async (f) => new Map([...(await ser()).files, ["workspace.json", f.get("workspace.json")!]])), p.id, (j) => { j.fullWidth = true; });
    const page = must(await new PagesRepo(await restore(files), clock).get(p.id));
    expect(page.style).toEqual({ spacing: { width: "full" } });
  });
  it("un respaldo v1 sin fullWidth queda en el estilo predeterminado (CL-14)", async () => {
    const p = must(await svc.create({ title: "A" }));
    const f = new Map((await ser()).files); f.set("workspace.json", enc.encode(JSON.stringify({ formatVersion: 1, id: "ws", name: "P", pageCount: 1 })));
    expect(must(await new PagesRepo(await restore(f), clock).get(p.id)).style).toEqual({});
  });
  it("un valor dañado se descarta sin abortar (E-068)", async () => {
    const p = must(await svc.create({ title: "A" }));
    must(await repo.setProps(p.id, { cover: `asset:${HASH}`, coverCredit: credit, style: { accent: "blue" }, description: "Hola", locked: true }));
    const files = edit((await ser()).files, p.id, (j) => { j.style = "roto"; j.cover = "nada:raro"; j.coverCredit = { source: "otra" }; j.description = 42; j.locked = "sí"; });
    const page = must(await new PagesRepo(await restore(files), clock).get(p.id));
    expect(page).toMatchObject({ style: {}, cover: null, coverCredit: null, description: null, locked: false });
  });
  it("un estilo con valores fuera de rango se sanea y la descripción larga se recorta a 280 (E-068)", async () => {
    const p = must(await svc.create({ title: "A" }));
    const files = edit((await ser()).files, p.id, (j) => { j.style = { accent: "magenta", spacing: { width: "wide" } }; j.description = `uno\ndos ${"x".repeat(400)}`; });
    const page = must(await new PagesRepo(await restore(files), clock).get(p.id));
    expect(page.style).toEqual({ spacing: { width: "wide" } });
    expect(page.description).toHaveLength(280);
    expect(page.description).not.toContain("\n");
  });
  it("el crédito sin portada de archivo se descarta", async () => {
    const p = must(await svc.create({ title: "A" }));
    const files = edit((await ser()).files, p.id, (j) => { j.cover = "gradient:sky"; j.coverCredit = credit; });
    expect(must(await new PagesRepo(await restore(files), clock).get(p.id)).coverCredit).toBeNull();
  });
  it("page-defaults.json se restaura a meta; uno dañado se ignora (E-069)", async () => {
    await savePageDefaultStyle(db, { accent: "green", spacing: { width: "narrow" } });
    const files = (await ser()).files;
    expect(await loadPageDefaultStyle(await restore(files))).toEqual({ accent: "green", spacing: { width: "narrow" } });
    const broken = new Map(files); broken.set("page-defaults.json", enc.encode("no es json"));
    expect(await loadPageDefaultStyle(await restore(broken))).toEqual({});
  });
});

describe("respaldo v1 de referencia (E-067)", () => {
  it("el archivo dorado v1 se restaura completo y se vuelve a escribir como v2", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const golden = JSON.parse(readFileSync(resolve(__dirname, "../../tests/golden/backup-v1.json"), "utf8")) as Record<string, string>;
    const files = new Map(Object.entries(golden).map(([k, v]) => [k, k.startsWith("assets/") ? Uint8Array.from(atob(v.slice("base64:".length)), (c) => c.charCodeAt(0)) : enc.encode(v)]));
    const target = await restore(files);
    const again = await ser(target);
    expect(JSON.parse(dec.decode(again.files.get("workspace.json")!))).toMatchObject({ formatVersion: 2, pageCount: 3 });
    expect([...again.files.keys()].filter((k) => k.startsWith("data/")).sort()).toEqual([...files.keys()].filter((k) => k.startsWith("data/")).sort());
  });
});

describe("ida y vuelta v2 (E-070)", () => {
  it("restaurar y volver a serializar da los mismos bytes, y un estado igual da los mismos bytes", async () => {
    const a = must(await svc.create({ title: "A" }));
    const b = must(await svc.create({ title: "B" }));
    await svc.saveUpdate(a.id, updateFor([para("hola")]));
    must(await repo.setProps(a.id, { cover: `asset:${HASH}`, coverCredit: credit, style: { accent: "blue", cover: { height: "high", radius: [1, 2, 3, 4] }, toc: { maxLevel: 2 } }, description: "Resumen", locked: true }));
    must(await repo.setStyle(b.id, { spacing: { width: "full" } }));
    await savePageDefaultStyle(db, { accent: "red" });
    const first = await ser();
    expect([...(await ser()).files].map(([k, v]) => [k, dec.decode(v)])).toEqual([...first.files].map(([k, v]) => [k, dec.decode(v)]));
    const second = await ser(await restore(first.files));
    expect([...second.files.keys()].sort()).toEqual([...first.files.keys()].sort());
    for (const [path, bytes] of first.files) expect(dec.decode(second.files.get(path)!)).toBe(dec.decode(bytes));
  });
});

describe("Markdown legible (E-071)", () => {
  it("la descripción va en cursiva bajo el título y el estilo no aparece", async () => {
    const p = must(await svc.create({ title: "A" }));
    await svc.saveUpdate(p.id, updateFor([para("cuerpo")]));
    must(await repo.setProps(p.id, { description: "Una línea", style: { accent: "blue" } }));
    const md = [...(await ser()).files].find(([k]) => k.endsWith(".md"))!;
    expect(dec.decode(md[1])).toBe("*Una línea*\n\ncuerpo\n");
    expect(dec.decode(md[1])).not.toContain("blue");
  });
  it("sin descripción el Markdown no cambia", async () => {
    const p = must(await svc.create({ title: "A" }));
    await svc.saveUpdate(p.id, updateFor([para("cuerpo")]));
    expect(dec.decode([...(await ser()).files].find(([k]) => k.endsWith(".md"))![1])).toBe("cuerpo\n");
  });
});
