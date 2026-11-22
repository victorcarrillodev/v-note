// T-084 a T-090 (prueba primero): espacios de trabajo.
import { describe, it, expect, beforeEach } from "vitest";
import { MemoryConfigStore, MemoryWorkspaceStorage } from "../../tests/support/memoryPorts";
import { para, updateFor } from "../../tests/support/builders";
import { WorkspaceManager } from "./workspaceManager";
import { ensureInbox } from "./inbox";
import { FakeClock } from "../clock";
import { PageService } from "../pages/pageService";
import { PagesRepo } from "../pages/pagesRepo";
import { SearchIndex } from "../search/searchIndex";

let config: MemoryConfigStore;
let storage: MemoryWorkspaceStorage;
let clock: FakeClock;
let mgr: WorkspaceManager;
beforeEach(() => {
  config = new MemoryConfigStore();
  storage = new MemoryWorkspaceStorage();
  clock = new FakeClock(1_000);
  mgr = new WorkspaceManager(config, storage, clock);
});
const must = <T>(r: { ok: boolean; value?: T; error?: unknown }): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value as T;
};

describe("registro persistente (T-084)", () => {
  it("sin archivo, la lista está vacía", async () => {
    expect(must(await mgr.list())).toEqual([]);
  });
  it("persiste y lee el registro entre instancias", async () => {
    const a = must(await mgr.create({ name: "Personal" }));
    const again = new WorkspaceManager(config, storage, clock);
    expect(must(await again.list())).toEqual([a]);
  });
  it("un registro dañado devuelve un error y NO se sobrescribe", async () => {
    config.text = "{esto no es json";
    const r = await mgr.list();
    expect(r.ok === false && r.error.code).toBe("STORAGE");
    const c = await mgr.create({ name: "x" });
    expect(c.ok).toBe(false);
    expect(config.text).toBe("{esto no es json");
  });
  it("un registro de una versión futura se rechaza", async () => {
    config.text = JSON.stringify({ version: 99, workspaces: [] });
    const r = await mgr.list();
    expect(r.ok === false && r.error.code).toBe("UNSUPPORTED_VERSION");
  });
});

describe("crear (T-085)", () => {
  it("crea un espacio con su base migrada al esquema vigente y ubicación por defecto", async () => {
    const w = must(await mgr.create({ name: "Personal" }));
    expect(w).toMatchObject({ name: "Personal", location: `mem://${w.id}` });
    const { store } = must(await mgr.open(w.id));
    const v = await store.query<{ user_version: number }>("PRAGMA user_version");
    expect(v[0]!.user_version).toBeGreaterThanOrEqual(4);
  });
  it("permite elegir otra ubicación", async () => {
    const w = must(await mgr.create({ name: "Trabajo", location: "/mnt/disco/trabajo" }));
    expect(w.location).toBe("/mnt/disco/trabajo");
    expect(storage.stores.has("/mnt/disco/trabajo")).toBe(true);
  });
  it("rechaza nombres vacíos", async () => {
    const r = await mgr.create({ name: "   " });
    expect(r.ok === false && r.error.code).toBe("INVALID");
  });
});

describe("renombrar y cambiar de espacio (T-086)", () => {
  it("renombra y persiste", async () => {
    const w = must(await mgr.create({ name: "A" }));
    must(await mgr.rename(w.id, "B"));
    expect(must(await mgr.list()).map((x) => x.name)).toEqual(["B"]);
  });
  it("abrir otro espacio devuelve su propia base; abrir dos veces reutiliza la conexión", async () => {
    const a = must(await mgr.create({ name: "A" })); const b = must(await mgr.create({ name: "B" }));
    const sa = must(await mgr.open(a.id)).store; const sb = must(await mgr.open(b.id)).store;
    expect(sa).not.toBe(sb);
    expect(must(await mgr.open(a.id)).store).toBe(sa);
  });
  it("abrir un espacio inexistente devuelve NOT_FOUND", async () => {
    const r = await mgr.open("no-existe");
    expect(r.ok === false && r.error.code).toBe("NOT_FOUND");
  });
  it("CL-35: si la ubicación no está disponible avisa y no crea una base vacía", async () => {
    const w = must(await mgr.create({ name: "Externo", location: "/mnt/usb/x" }));
    const before = storage.opened;
    storage.missing.add("/mnt/usb/x");
    const mgr2 = new WorkspaceManager(config, storage, clock);
    const r = await mgr2.open(w.id);
    expect(r.ok === false && r.error.code).toBe("STORAGE");
    expect(r.ok === false && r.error.details).toMatchObject({ location: "/mnt/usb/x", reason: "UNAVAILABLE" });
    expect(storage.opened).toBe(before); // no se intentó abrir/crear nada
  });
});

describe("predeterminado para captura (T-087)", () => {
  it("el primer espacio queda como predeterminado y solo uno puede serlo", async () => {
    const a = must(await mgr.create({ name: "A" })); const b = must(await mgr.create({ name: "B" }));
    expect(must(await mgr.list()).filter((w) => w.isCaptureDefault).map((w) => w.id)).toEqual([a.id]);
    must(await mgr.setCaptureDefault(b.id));
    expect(must(await mgr.list()).filter((w) => w.isCaptureDefault).map((w) => w.id)).toEqual([b.id]);
  });
  it("marcar un espacio inexistente devuelve NOT_FOUND y no cambia nada", async () => {
    const a = must(await mgr.create({ name: "A" }));
    expect((await mgr.setCaptureDefault("x")).ok).toBe(false);
    expect(must(await mgr.list()).find((w) => w.id === a.id)!.isCaptureDefault).toBe(true);
  });
});

describe("eliminar (T-088, CL-29, CL-30)", () => {
  it("prepareDelete informa el último respaldo exitoso o que no hay ninguno", async () => {
    const a = must(await mgr.create({ name: "A" }));
    expect(must(await mgr.prepareDelete(a.id))).toEqual({ name: "A", lastBackupAt: null, hasNoBackup: true });
    const { store } = must(await mgr.open(a.id));
    await store.exec("INSERT OR REPLACE INTO meta(key, value) VALUES ('last_backup_at', '5000')");
    expect(must(await mgr.prepareDelete(a.id))).toEqual({ name: "A", lastBackupAt: 5000, hasNoBackup: false });
  });
  it("prepareDelete con la carpeta no disponible avisa que no se pudo comprobar, sin abrir nada", async () => {
    const a = must(await mgr.create({ name: "A" }));
    await mgr.closeWorkspace(a.id);
    storage.missing.add(a.location);
    const opened = storage.opened;
    expect(must(await mgr.prepareDelete(a.id))).toMatchObject({ name: "A", backupUnknown: true });
    expect(storage.opened).toBe(opened);
  });
  it("si el almacenamiento falla al borrar, devuelve error y conserva el registro", async () => {
    const a = must(await mgr.create({ name: "A" }));
    storage.remove = async () => { throw new Error("permiso denegado"); };
    const r = await mgr.delete(a.id, { typedName: "A" });
    expect(r.ok === false && r.error.code).toBe("STORAGE");
    expect(must(await mgr.list())).toHaveLength(1);
  });
  it("sin escribir el nombre exacto no se elimina nada", async () => {
    const a = must(await mgr.create({ name: "Mi Espacio" }));
    for (const typed of ["", "mi espacio", "Mi Espacio ", "otro"]) {
      const r = await mgr.delete(a.id, { typedName: typed });
      expect(r.ok === false && r.error.code).toBe("NEEDS_CONFIRMATION");
    }
    expect(must(await mgr.list())).toHaveLength(1);
    expect(storage.removed).toEqual([]);
  });
  it("con el nombre exacto elimina el registro y los datos", async () => {
    const a = must(await mgr.create({ name: "Mi Espacio" }));
    must(await mgr.delete(a.id, { typedName: "Mi Espacio" }));
    expect(must(await mgr.list())).toEqual([]);
    expect(storage.removed).toEqual([a.location]);
  });
  it("CL-30: si se elimina el predeterminado, queda sin predeterminado hasta elegir otro", async () => {
    const a = must(await mgr.create({ name: "A" })); const b = must(await mgr.create({ name: "B" }));
    must(await mgr.delete(a.id, { typedName: "A" }));
    expect(must(await mgr.list()).map((w) => w.isCaptureDefault)).toEqual([false]);
    expect(must(await mgr.captureDefault())).toBeNull();
    must(await mgr.setCaptureDefault(b.id));
    expect(must(await mgr.captureDefault())?.id).toBe(b.id);
  });
});

describe("aislamiento (T-089)", () => {
  it("la búsqueda de un espacio no ve el contenido de otro", async () => {
    const a = must(await mgr.create({ name: "A" })); const b = must(await mgr.create({ name: "B" }));
    const sa = must(await mgr.open(a.id)).store; const sb = must(await mgr.open(b.id)).store;
    const pa = must(await new PageService(sa, clock).create({ title: "Secreto de A" }));
    must(await new PageService(sa, clock).saveUpdate(pa.id, updateFor([para("tortillas")])));
    expect(await new SearchIndex(sa, clock).search({ query: "tortillas" })).toHaveLength(1);
    expect(await new SearchIndex(sb, clock).search({ query: "tortillas" })).toEqual([]);
    expect(await new PagesRepo(sb, clock).children(null)).toEqual([]);
  });
});

describe("bandeja de entrada (T-090, CL-16)", () => {
  it("se crea la primera vez y se reutiliza después", async () => {
    const w = must(await mgr.create({ name: "A" }));
    const { store } = must(await mgr.open(w.id));
    const i1 = must(await ensureInbox(store, clock, "Bandeja de entrada"));
    const i2 = must(await ensureInbox(store, clock, "Bandeja de entrada"));
    expect(i1.id).toBe(i2.id);
    expect(i1.title).toBe("Bandeja de entrada");
    expect(i1.parentId).toBeNull();
  });
  it("si se elimina definitivamente, se recrea", async () => {
    const w = must(await mgr.create({ name: "A" }));
    const { store } = must(await mgr.open(w.id));
    const svc = new PageService(store, clock);
    const i1 = must(await ensureInbox(store, clock, "Bandeja"));
    await svc.deletePermanently(i1.id, { confirm: true }).catch(() => {});
    const repo = new PagesRepo(store, clock);
    await repo.trash(i1.id);
    await repo.deletePermanently(i1.id, { confirm: true });
    const i2 = must(await ensureInbox(store, clock, "Bandeja"));
    expect(i2.id).not.toBe(i1.id);
  });
  it("si está en la papelera, se crea una nueva y la vieja queda en la papelera", async () => {
    const w = must(await mgr.create({ name: "A" }));
    const { store } = must(await mgr.open(w.id));
    const repo = new PagesRepo(store, clock);
    const i1 = must(await ensureInbox(store, clock, "Bandeja"));
    await repo.trash(i1.id);
    const i2 = must(await ensureInbox(store, clock, "Bandeja"));
    expect(i2.id).not.toBe(i1.id);
    expect((await repo.trashList()).map((t) => t.page.id)).toEqual([i1.id]);
  });
  it("si la persona la movió dentro de otra página, sigue siendo la bandeja", async () => {
    const w = must(await mgr.create({ name: "A" }));
    const { store } = must(await mgr.open(w.id));
    const repo = new PagesRepo(store, clock);
    const i1 = must(await ensureInbox(store, clock, "Bandeja"));
    const carpeta = must(await repo.create({ title: "Carpeta" }));
    must(await repo.move(i1.id, carpeta.id));
    expect(must(await ensureInbox(store, clock, "Bandeja")).id).toBe(i1.id);
  });
});

describe("carpeta elegida al crear (T-157, RF-25)", () => {
  it("se crea en la carpeta indicada", async () => {
    const w = must(await mgr.create({ name: "Casa", location: "/discos/casa" }));
    expect(w.location).toBe("/discos/casa");
  });
  it("una carpeta que ya usa otro espacio se rechaza: dos espacios nunca comparten base", async () => {
    must(await mgr.create({ name: "A", location: "/discos/x" }));
    const r = await mgr.create({ name: "B", location: "/discos/x/" });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe("CONFLICT");
    expect(must(await mgr.list())).toHaveLength(1);
  });
});
