// T-120 (prueba primero): sesión de edición de un documento: guarda los cambios automáticamente, sin perder ninguno.
import { describe, it, expect, beforeEach, vi } from "vitest";
import * as Y from "yjs";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { FakeClock } from "../clock";
import { PageService } from "../pages/pageService";
import { DocStore } from "./docStore";
import { DocSession } from "./docSession";
import type { SqlStore } from "../ports/sqlStore";

let db: SqlStore;
let clock: FakeClock;
let svc: PageService;
let docs: DocStore;
let pageId: string;
beforeEach(async () => {
  vi.useFakeTimers();
  db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  clock = new FakeClock(1);
  svc = new PageService(db, clock);
  docs = new DocStore(db, clock);
  const p = await svc.create({ title: "p" });
  if (!p.ok) throw new Error("x");
  pageId = p.value.id;
});
const text = async (id = pageId) => {
  const l = await docs.load(id);
  if (!l.ok) throw new Error("x");
  return l.value.getText("t").toString();
};
const rows = async () => (await db.query<{ n: number }>("SELECT count(*) AS n FROM page_docs"))[0]!.n;

describe("DocSession", () => {
  it("abre un documento vacío y expone el Y.Doc", async () => {
    const s = await DocSession.open(svc, docs, pageId, { debounceMs: 100 });
    expect(s.doc.getText("t").toString()).toBe("");
    await s.dispose();
  });
  it("carga el contenido guardado previamente", async () => {
    const a = await DocSession.open(svc, docs, pageId, { debounceMs: 100 });
    a.doc.getText("t").insert(0, "hola");
    await a.flush();
    await a.dispose();
    const b = await DocSession.open(svc, docs, pageId, { debounceMs: 100 });
    expect(b.doc.getText("t").toString()).toBe("hola");
    await b.dispose();
  });
  it("guarda tras la pausa de escritura (debounce) y junta varios cambios en una sola fila", async () => {
    const s = await DocSession.open(svc, docs, pageId, { debounceMs: 200 });
    const t = s.doc.getText("t");
    t.insert(0, "a"); t.insert(1, "b"); t.insert(2, "c");
    expect(await rows()).toBe(0); // todavía no
    await vi.advanceTimersByTimeAsync(250);
    expect(await text()).toBe("abc");
    expect(await rows()).toBe(1);
    await s.dispose();
  });
  it("flush guarda de inmediato lo pendiente", async () => {
    const s = await DocSession.open(svc, docs, pageId, { debounceMs: 10_000 });
    s.doc.getText("t").insert(0, "urgente");
    await s.flush();
    expect(await text()).toBe("urgente");
    await s.dispose();
  });
  it("dispose guarda lo pendiente antes de cerrar (cambiar de página no pierde nada)", async () => {
    const s = await DocSession.open(svc, docs, pageId, { debounceMs: 10_000 });
    s.doc.getText("t").insert(0, "antes de cerrar");
    await s.dispose();
    expect(await text()).toBe("antes de cerrar");
  });
  it("tras dispose los cambios del documento ya no se guardan ni fallan", async () => {
    const s = await DocSession.open(svc, docs, pageId, { debounceMs: 10 });
    await s.dispose();
    s.doc.getText("t").insert(0, "tarde");
    await vi.advanceTimersByTimeAsync(100);
    expect(await text()).toBe("");
  });
  it("las actualizaciones recibidas del propio guardado/carga no se reenvían (sin bucles)", async () => {
    const s = await DocSession.open(svc, docs, pageId, { debounceMs: 10 });
    s.doc.getText("t").insert(0, "x");
    await vi.advanceTimersByTimeAsync(50);
    await vi.advanceTimersByTimeAsync(500);
    expect(await rows()).toBe(1);
    await s.dispose();
  });
  it("si el guardado falla, conserva lo pendiente, avisa y lo reintenta sin perder nada", async () => {
    const errors: string[] = [];
    let fail = true;
    const flaky = new PageService(db, clock);
    const orig = flaky.saveUpdate.bind(flaky);
    flaky.saveUpdate = async (id, u) => (fail ? { ok: false as const, error: { code: "STORAGE" as const, message: "disco lleno" } } : orig(id, u));
    const s = await DocSession.open(flaky, docs, pageId, { debounceMs: 10, retryMs: 100, onError: (m) => errors.push(m) });
    s.doc.getText("t").insert(0, "importante");
    await vi.advanceTimersByTimeAsync(50);
    expect(errors).toEqual(["disco lleno"]);
    expect(await text()).toBe("");
    fail = false;
    await vi.advanceTimersByTimeAsync(300);
    expect(await text()).toBe("importante");
    await s.dispose();
  });
  it("T-163 (CL-20): con el disco lleno lo ya guardado se conserva intacto y se avisa en cada fallo", async () => {
    const errors: string[] = [];
    let fail = false;
    const flaky = new PageService(db, clock);
    const orig = flaky.saveUpdate.bind(flaky);
    flaky.saveUpdate = async (id, u) => (fail ? { ok: false as const, error: { code: "STORAGE" as const, message: "disco lleno" } } : orig(id, u));
    const s = await DocSession.open(flaky, docs, pageId, { debounceMs: 10, retryMs: 100, onError: (m) => errors.push(m) });
    s.doc.getText("t").insert(0, "confirmado");
    await vi.advanceTimersByTimeAsync(50);
    expect(await text()).toBe("confirmado");
    fail = true;
    s.doc.getText("t").insert(10, " pendiente");
    await vi.advanceTimersByTimeAsync(350);
    expect(errors.length).toBeGreaterThanOrEqual(2); // avisa en el primer fallo y en los reintentos
    expect(await text()).toBe("confirmado"); // lo confirmado no se pierde ni se corrompe
    fail = false;
    await vi.advanceTimersByTimeAsync(300);
    expect(await text()).toBe("confirmado pendiente");
    await s.dispose();
  });
  it("compacta cuando se acumulan muchas actualizaciones", async () => {
    const s = await DocSession.open(svc, docs, pageId, { debounceMs: 1, compactAfter: 5 });
    for (let i = 0; i < 8; i++) {
      s.doc.getText("t").insert(i, String(i));
      await vi.advanceTimersByTimeAsync(5);
    }
    await s.flush();
    expect(await rows()).toBeLessThan(8);
    expect(await text()).toBe("01234567");
    await s.dispose();
  });
  it("un documento externo (por ejemplo, otro editor) puede aplicarse sin reenviarse como cambio propio", async () => {
    const s = await DocSession.open(svc, docs, pageId, { debounceMs: 10 });
    const other = new Y.Doc();
    other.getText("t").insert(0, "remoto");
    Y.applyUpdate(s.doc, Y.encodeStateAsUpdate(other), "remote");
    await vi.advanceTimersByTimeAsync(50);
    expect(await rows()).toBe(0);
    await s.dispose();
  });
});
