// T-316…T-321 (prueba primero): respaldar y restaurar bases de datos y recordatorios; la ida y vuelta es la identidad.
import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { FakeClock } from "../clock";
import { MemoryAssetStore } from "../assets/memoryAssetStore";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { DatabaseService } from "../databases/databaseService";
import { BoardService } from "../databases/boardService";
import { ViewService } from "../databases/viewService";
import { PageService } from "../pages/pageService";
import type { SqlStore } from "../ports/sqlStore";
import { TaskService } from "../tasks/taskService";
import type { Block } from "../blocks/types";
import { restoreFromFiles, validateBackup } from "./restore";
import { serializeWorkspace } from "./serialize";

const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };
const dec = new TextDecoder();
const newStore = async () => { const d = await createNodeSqliteStore(":memory:"); await migrate(d, migrations); return d; };
const ser = async (store: SqlStore) => (await serializeWorkspace({ store, assets: new MemoryAssetStore() }, { id: "w1", name: "Espacio" })).files;
const text = (files: Map<string, Uint8Array>, path: string) => dec.decode(files.get(path)!);

/** Un espacio con dos bases relacionadas, fórmula, rollup, vistas, un tablero y tareas con recordatorios. */
async function sample(store: SqlStore) {
  const clock = new FakeClock(Date.UTC(2026, 2, 5, 12, 0));
  const dbs = new DatabaseService(store, clock), views = new ViewService(store), boards = new BoardService(dbs, views), pages = new PageService(store, clock);
  const proy = must(await dbs.createDatabase({ name: "Proyectos" })).id, tar = must(await dbs.createDatabase({ name: "Tareas" })).id;
  const costo = must(await dbs.addProperty(proy, { name: "Costo", type: "number" })).id;
  const prio = must(await dbs.addProperty(proy, { name: "Prioridad", type: "select", config: { options: [{ id: "a", name: "Alta" }, { id: "b", name: "Baja" }] } })).id;
  const fecha = must(await dbs.addProperty(proy, { name: "Entrega", type: "date", config: { asTask: true } })).id;
  const horas = must(await dbs.addProperty(tar, { name: "Horas", type: "number" })).id;
  const rel = must(await dbs.addRelation(proy, { name: "Tareas", targetDatabaseId: tar, pairedName: "Proyecto" }));
  must(await dbs.addFormula(proy, { name: "Doble", expression: 'prop("Costo") * 2' }));
  must(await dbs.addRollup(proy, { name: "Horas totales", relationPropertyId: rel.property.id, targetPropertyId: horas, fn: "sum" }));
  const p1 = must(await dbs.addRow(proy, { title: "P1", values: { [costo]: 10, [prio]: "a", [fecha]: { start: "2026-03-10", remind: "2026-03-09T08:00", repeat: { freq: "weekly", interval: 1 } } } }));
  const t1 = must(await dbs.addRow(tar, { title: "T1", values: { [horas]: 4 } }));
  must(await dbs.linkRows(rel.property.id, p1.pageId, t1.pageId));
  must(await views.create(proy, { name: "Caras", type: "list", config: { filter: { type: "condition", property: costo, op: "gt", value: 5 }, sorts: [{ property: costo, direction: "desc" }] } }));
  const board = must(await boards.createBoard({ name: "Kanban" }));
  must(await boards.createCard(board.databaseId, { title: "Tarjeta", columnId: "in_progress" }));
  const note = must(await pages.create({ title: "Nota con tarea" })).id;
  const blocks: Block[] = [{ id: "tk1", type: "task", props: { checked: false, due: "2026-03-12", remindAt: "2026-03-11T09:00", recurrence: "" }, content: [{ type: "text", text: "Hacer algo", styles: {} }], children: [] }];
  let nowLocal = "2026-03-11T10:00";
  const tasks = new TaskService(store, clock, { async setSchedule() {}, async setDone() {} }, () => nowLocal);
  await tasks.indexPage(note, blocks); await tasks.indexDatabase(dbs, proy);
  await tasks.markFired((await tasks.list()).find((t) => t.title === "Hacer algo")!.id);
  void nowLocal;
  return { dbs, tasks, proy, tar, p1 };
}

describe("serializar bases de datos y recordatorios (T-316, T-317)", () => {
  it("una base por archivo databases/<id>.json con definición, propiedades, vistas, filas y vínculos", async () => {
    const store = await newStore();
    const s = await sample(store);
    const files = await ser(store);
    const paths = [...files.keys()].filter((p) => p.startsWith("databases/")).sort();
    expect(paths).toHaveLength(3); // Proyectos, Tareas y Kanban
    const proy = JSON.parse(text(files, `databases/${s.proy}.json`));
    expect(proy.name).toBe("Proyectos");
    expect(proy.properties.map((p: { name: string }) => p.name)).toEqual(["Costo", "Prioridad", "Entrega", "Tareas", "Doble", "Horas totales"]);
    expect(proy.views.map((v: { type: string }) => v.type)).toEqual(["table", "list"]);
    expect(proy.rows).toHaveLength(1);
    expect(proy.rows[0].values[proy.properties[0].id]).toBe(10);
    expect(proy.links).toHaveLength(1);
    // lo calculado (fórmula, rollup) no se guarda como dato: se recalcula
    expect(JSON.stringify(proy.rows[0].values)).not.toContain('"20"');
    expect(Object.keys(proy.rows[0].values)).toHaveLength(3);
  });
  it("sin bases ni tareas no aparece ningún archivo nuevo (los espacios antiguos siguen igual)", async () => {
    const store = await newStore();
    const files = await ser(store);
    expect([...files.keys()].some((p) => p.startsWith("databases/") || p === "reminders.json")).toBe(false);
  });
  it("reminders.json trae las tareas con su fecha, aviso y recurrencia, y el estado de cada aviso", async () => {
    const store = await newStore();
    await sample(store);
    const r = JSON.parse(text(await ser(store), "reminders.json"));
    expect(r.tasks.map((t: { title: string }) => t.title).sort()).toEqual(["Hacer algo", "P1"]);
    const p1 = r.tasks.find((t: { title: string }) => t.title === "P1");
    expect(p1).toMatchObject({ due: "2026-03-10", remindAt: "2026-03-09T08:00", recurrence: { freq: "weekly", interval: 1 } });
    expect(r.states).toHaveLength(1);
    expect(r.states[0]).toMatchObject({ state: "fired", occurrence: "2026-03-11T09:00" });
  });
  it("es determinista: dos serializaciones seguidas dan los mismos bytes", async () => {
    const store = await newStore();
    await sample(store);
    const a = await ser(store), b = await ser(store);
    expect([...a.keys()].sort()).toEqual([...b.keys()].sort());
    for (const [k, v] of a) expect(dec.decode(b.get(k)!), k).toBe(dec.decode(v));
  });
});

describe("restaurar bases de datos y recordatorios (T-318, T-319)", () => {
  it("restaura todo: los datos y lo calculado coinciden con el original", async () => {
    const src = await newStore();
    const s = await sample(src);
    const files = await ser(src);
    const dst = await newStore();
    const r = await restoreFromFiles(files, { store: dst, assets: new MemoryAssetStore() });
    expect(r.ok).toBe(true);
    const clock = new FakeClock(Date.UTC(2026, 2, 5, 12, 0));
    const restored = new DatabaseService(dst, clock);
    for (const id of [s.proy, s.tar]) {
      expect(await restored.getRows(id)).toEqual(await s.dbs.getRows(id));
      expect(await restored.listProperties(id)).toEqual(await s.dbs.listProperties(id));
    }
    const views = new ViewService(dst);
    expect((await views.list(s.proy)).map((v) => v.name)).toEqual(["Tabla", "Caras"]);
  });
  it("restaura las tareas y el estado de los avisos", async () => {
    const src = await newStore();
    await sample(src);
    const dst = await newStore();
    expect((await restoreFromFiles(await ser(src), { store: dst, assets: new MemoryAssetStore() })).ok).toBe(true);
    const tasks = new TaskService(dst, new FakeClock(1), { async setSchedule() {}, async setDone() {} }, () => "2026-03-11T10:00");
    expect((await tasks.list()).map((t) => t.title).sort()).toEqual(["Hacer algo", "P1"]);
    const t = (await tasks.list()).find((x) => x.title === "Hacer algo")!;
    expect(await tasks.getState(t.id)).toMatchObject({ state: "fired", occurrence: "2026-03-11T09:00" });
    // «Hacer algo» ya estaba disparado: no se vuelve a avisar; «P1» (semanal, vencida) sí es nueva
    expect((await tasks.dueReminders({ onlyNew: true })).map((d) => d.task.title)).toEqual(["P1"]);
  });
  it("es la identidad: serializar → restaurar → serializar da los mismos archivos, byte a byte", async () => {
    const src = await newStore();
    await sample(src);
    const a = await ser(src);
    const dst = await newStore();
    await restoreFromFiles(a, { store: dst, assets: new MemoryAssetStore() });
    const b = await ser(dst);
    expect([...b.keys()].sort()).toEqual([...a.keys()].sort());
    for (const [k, v] of a) expect(dec.decode(b.get(k)!), k).toBe(dec.decode(v));
  });
  it("valida antes de escribir: una base que apunta a una página inexistente rechaza todo el respaldo", async () => {
    const src = await newStore();
    const s = await sample(src);
    const files = await ser(src);
    const d = JSON.parse(text(files, `databases/${s.proy}.json`));
    d.rows[0].pageId = "no-existe";
    files.set(`databases/${s.proy}.json`, new TextEncoder().encode(JSON.stringify(d)));
    expect((await validateBackup(files)).ok).toBe(false);
    const dst = await newStore();
    expect((await restoreFromFiles(files, { store: dst, assets: new MemoryAssetStore() })).ok).toBe(false);
    expect((await dst.query("SELECT * FROM pages")).length).toBe(0);
    expect((await dst.query("SELECT * FROM databases")).length).toBe(0);
  });
  it("un archivo de base de datos dañado o con un tipo de propiedad desconocido se rechaza con un mensaje claro", async () => {
    const src = await newStore();
    const s = await sample(src);
    const files = await ser(src);
    files.set(`databases/${s.proy}.json`, new TextEncoder().encode("{ roto"));
    const bad = await validateBackup(files);
    expect(!bad.ok && bad.error.message).toContain(`databases/${s.proy}.json`);
    const files2 = await ser(src);
    const d = JSON.parse(text(files2, `databases/${s.proy}.json`));
    d.properties[0].type = "holograma";
    files2.set(`databases/${s.proy}.json`, new TextEncoder().encode(JSON.stringify(d)));
    expect((await validateBackup(files2)).ok).toBe(false);
  });
  it("un respaldo antiguo sin bases ni recordatorios sigue restaurándose", async () => {
    const src = await newStore();
    const pages = new PageService(src, new FakeClock(1));
    must(await pages.create({ title: "Solo una nota" }));
    const dst = await newStore();
    expect((await restoreFromFiles(await ser(src), { store: dst, assets: new MemoryAssetStore() })).ok).toBe(true);
    expect((await dst.query("SELECT title FROM pages")).map((r) => (r as { title: string }).title)).toEqual(["Solo una nota"]);
  });
});

describe("propiedad de ida y vuelta con bases de datos (T-320)", () => {
  it("para estructuras aleatorias, restaurar y volver a serializar no cambia ningún byte", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ kind: fc.constantFrom("text", "number", "checkbox", "date", "select"), name: fc.stringMatching(/^[A-Za-z]{1,6}$/) }), { minLength: 1, maxLength: 4 }),
        fc.array(fc.record({ title: fc.stringMatching(/^[a-z ]{0,8}$/), num: fc.integer({ min: -50, max: 50 }), flag: fc.boolean(), day: fc.integer({ min: 1, max: 28 }) }), { maxLength: 5 }),
        async (propSpecs, rowSpecs) => {
          const src = await newStore();
          const svc = new DatabaseService(src, new FakeClock(5_000));
          const d = must(await svc.createDatabase({ name: "Aleatoria" })).id;
          const props: { id: string; type: string }[] = [];
          for (const [i, p] of propSpecs.entries()) {
            const r = await svc.addProperty(d, { name: `${p.name}${i}`, type: p.kind as never, ...(p.kind === "select" ? { config: { options: [{ id: "o1", name: "Uno" }, { id: "o2", name: "Dos" }] } } : {}) });
            if (r.ok) props.push({ id: r.value.id, type: p.kind });
          }
          for (const row of rowSpecs) {
            const values: Record<string, unknown> = {};
            for (const p of props) values[p.id] = p.type === "number" ? row.num : p.type === "checkbox" ? row.flag : p.type === "date" ? `2026-03-${String(row.day).padStart(2, "0")}` : p.type === "select" ? "o1" : row.title;
            must(await svc.addRow(d, { title: row.title, values }));
          }
          const a = await ser(src);
          const dst = await newStore();
          const r = await restoreFromFiles(a, { store: dst, assets: new MemoryAssetStore() });
          expect(r.ok).toBe(true);
          const b = await ser(dst);
          expect([...b.keys()].sort()).toEqual([...a.keys()].sort());
          for (const [k, v] of a) expect(dec.decode(b.get(k)!), k).toBe(dec.decode(v));
        },
      ),
      { numRuns: 60 },
    );
  }, 120_000);
});

describe("archivo dorado con bases de datos (T-321, RNF-7)", () => {
  it("la salida para un espacio de ejemplo con bases, tablero y recordatorios no cambia sin querer", async () => {
    // Ids deterministas para poder comparar con un archivo de referencia
    let n = 0;
    const spy = vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(() => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}` as `${string}-${string}-${string}-${string}-${string}`);
    try {
      const store = await newStore();
      await sample(store);
      const files = await ser(store);
      const snapshot = Object.fromEntries([...files.entries()].filter(([k]) => k.startsWith("databases/") || k === "reminders.json").sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => [k, dec.decode(v)]));
      expect(Object.keys(snapshot)).toHaveLength(4);
      await expect(JSON.stringify(snapshot, null, 2) + "\n").toMatchFileSnapshot("../../tests/golden/backup-v1-databases.json");
    } finally { spy.mockRestore(); }
  });
});
