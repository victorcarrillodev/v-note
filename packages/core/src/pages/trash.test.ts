// T-057 a T-062 (prueba primero): papelera con retención de 30 días (RF-2, CL-33).
import { describe, it, expect, beforeEach } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { FakeClock } from "../clock";
import { PagesRepo, type Page } from "./pagesRepo";
import { TRASH_RETENTION_DAYS } from "./trash";
import type { SqlStore } from "../ports/sqlStore";

const DAY = 86_400_000;
let db: SqlStore;
let clock: FakeClock;
let pages: PagesRepo;
beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  clock = new FakeClock(10 * DAY);
  pages = new PagesRepo(db, clock);
});
const mk = async (title: string, parentId: string | null = null): Promise<Page> => {
  const r = await pages.create({ title, parentId });
  if (!r.ok) throw new Error("no se pudo crear");
  return r.value;
};
const count = async () => (await db.query<{ n: number }>("SELECT count(*) AS n FROM pages"))[0]!.n;

describe("enviar a la papelera (T-057)", () => {
  it("marca la página y todos sus descendientes sin borrar ninguna fila", async () => {
    const a = await mk("a"); const b = await mk("b", a.id); const c = await mk("c", b.id); await mk("otra");
    expect((await pages.trash(a.id)).ok).toBe(true);
    expect(await count()).toBe(4); // nada desaparece
    expect((await pages.children(null)).map((p) => p.title)).toEqual(["otra"]);
    const rows = await db.query<{ id: string; deleted_root_id: string | null; deleted_at: number }>("SELECT id, deleted_root_id, deleted_at FROM pages WHERE deleted_at IS NOT NULL");
    expect(rows.map((r) => r.id).sort()).toEqual([a.id, b.id, c.id].sort());
    expect(new Set(rows.map((r) => r.deleted_root_id))).toEqual(new Set([a.id]));
    expect(rows.every((r) => r.deleted_at === 10 * DAY)).toBe(true);
  });
  it("una página inexistente devuelve NOT_FOUND", async () => {
    const r = await pages.trash("x");
    expect(r.ok === false && r.error.code).toBe("NOT_FOUND");
  });
});

describe("listar con días restantes (T-058)", () => {
  it("calcula 30, 15 y 1 días con el reloj simulado y solo lista las raíces eliminadas", async () => {
    const a = await mk("a"); await mk("hija", a.id);
    await pages.trash(a.id);
    let list = await pages.trashList();
    expect(list.map((t) => [t.page.title, t.daysLeft])).toEqual([["a", 30]]);
    clock.advance(15 * DAY);
    expect((await pages.trashList())[0]!.daysLeft).toBe(15);
    clock.advance(14 * DAY + DAY / 2);
    expect((await pages.trashList())[0]!.daysLeft).toBe(1); // queda medio día: se muestra 1
    expect(TRASH_RETENTION_DAYS).toBe(30);
    list = await pages.trashList();
    expect(list).toHaveLength(1);
  });
});

describe("restaurar (T-059)", () => {
  it("vuelve a su lugar original con todo su subárbol", async () => {
    const r = await mk("raíz"); const a = await mk("a", r.id); const b = await mk("b", a.id);
    await pages.trash(a.id);
    expect((await pages.restore(a.id)).ok).toBe(true);
    expect((await pages.children(r.id)).map((p) => p.title)).toEqual(["a"]);
    expect((await pages.children(a.id)).map((p) => p.id)).toEqual([b.id]);
    expect(await pages.trashList()).toEqual([]);
  });
  it("va a la raíz si el padre original ya no existe (eliminado)", async () => {
    const r = await mk("raíz"); const a = await mk("a", r.id);
    await pages.trash(a.id);
    await pages.trash(r.id);
    const res = await pages.restore(a.id);
    expect(res.ok && res.value.parentId).toBeNull();
    expect((await pages.children(null)).map((p) => p.title)).toEqual(["a"]);
  });
  it("restaurar algo que no está en la papelera devuelve NOT_FOUND", async () => {
    const a = await mk("a");
    const r = await pages.restore(a.id);
    expect(r.ok === false && r.error.code).toBe("NOT_FOUND");
  });
});

describe("borrado definitivo (T-060) y vaciar (T-062)", () => {
  it("exige confirmación explícita", async () => {
    const a = await mk("a"); await pages.trash(a.id);
    const r = await pages.deletePermanently(a.id, { confirm: false });
    expect(r.ok === false && r.error.code).toBe("NEEDS_CONFIRMATION");
    expect(await count()).toBe(1);
    expect((await pages.deletePermanently(a.id, { confirm: true })).ok).toBe(true);
    expect(await count()).toBe(0);
  });
  it("solo permite borrar definitivamente lo que está en la papelera", async () => {
    const a = await mk("a");
    const r = await pages.deletePermanently(a.id, { confirm: true });
    expect(r.ok === false && r.error.code).toBe("NOT_FOUND");
    expect(await count()).toBe(1);
  });
  it("borra el subárbol completo junto con su raíz", async () => {
    const a = await mk("a"); const b = await mk("b", a.id); await mk("c", b.id); await mk("viva");
    await pages.trash(a.id);
    await pages.deletePermanently(a.id, { confirm: true });
    expect(await count()).toBe(1);
  });
  it("vaciar la papelera exige confirmación y no toca las páginas vivas", async () => {
    const a = await mk("a"); const b = await mk("b"); await mk("viva");
    await pages.trash(a.id); await pages.trash(b.id);
    expect((await pages.emptyTrash({ confirm: false })).ok).toBe(false);
    expect(await count()).toBe(3);
    const r = await pages.emptyTrash({ confirm: true });
    expect(r.ok && r.value).toEqual({ removed: 2 });
    expect(await count()).toBe(1);
  });
});

describe("purga automática a los 30 días (T-061, CL-33)", () => {
  it("borra solo lo que lleva 30 días o más, incluso si la app estuvo cerrada mucho tiempo", async () => {
    const vieja = await mk("vieja"); const reciente = await mk("reciente");
    await pages.trash(vieja.id);
    clock.advance(20 * DAY);
    await pages.trash(reciente.id);
    clock.advance(9 * DAY); // vieja: 29 días, reciente: 9
    expect(await pages.purgeExpired()).toEqual({ removed: 0 });
    clock.advance(DAY); // vieja: 30 días
    expect(await pages.purgeExpired()).toEqual({ removed: 1 });
    expect((await pages.trashList()).map((t) => t.page.title)).toEqual(["reciente"]);
    clock.advance(365 * DAY); // app cerrada un año
    expect(await pages.purgeExpired()).toEqual({ removed: 1 });
    expect(await count()).toBe(0);
  });
});
