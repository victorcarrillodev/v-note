// T-158…T-161 (prueba primero): validar la carpeta destino, copiar, verificar huellas y conmutar solo entonces; interrupciones no pierden ni duplican nada.
import { describe, it, expect, beforeEach } from "vitest";
import { FakeClock } from "../clock";
import { WorkspaceManager } from "./workspaceManager";
import { moveWorkspace, validateTargetFolder, type FolderOps } from "./moveWorkspace";
import { MemoryConfigStore, MemoryWorkspaceStorage } from "../../tests/support/memoryPorts";

class FakeFolders implements FolderOps {
  trees = new Map<string, Map<string, string>>(); // carpeta -> (ruta relativa -> contenido)
  info = new Map<string, { exists: boolean; writable: boolean; freeBytes: number }>();
  calls: string[] = [];
  failCopyAfter: number | null = null; // copia solo N archivos y falla
  corruptOnCopy = false;
  failRemoveOld = false;
  async inspect(p: string) { this.calls.push(`inspect:${p}`); return this.info.get(p) ?? { exists: false, writable: false, freeBytes: 0 }; }
  async sizeOf(p: string) { return [...(this.trees.get(p)?.values() ?? [])].reduce((n, c) => n + c.length, 0); }
  async copyTree(from: string, to: string) {
    this.calls.push(`copy:${from}->${to}`);
    const src = this.trees.get(from) ?? new Map();
    const dst = new Map<string, string>();
    this.trees.set(to, dst);
    let n = 0;
    for (const [k, v] of src) {
      if (this.failCopyAfter !== null && n >= this.failCopyAfter) throw new Error("interrumpido");
      dst.set(k, this.corruptOnCopy && n === 0 ? v + "X" : v);
      n++;
    }
  }
  async checksums(p: string) { return Object.fromEntries(this.trees.get(p) ?? []); }
  async removeTree(p: string) { this.calls.push(`remove:${p}`); if (this.failRemoveOld && !p.includes("/dest/")) throw new Error("bloqueado"); this.trees.delete(p); }
}

const clock = new FakeClock(1_000);
let config: MemoryConfigStore, storage: MemoryWorkspaceStorage, mgr: WorkspaceManager, fs: FakeFolders;
let ws: { id: string; location: string };

beforeEach(async () => {
  config = new MemoryConfigStore();
  storage = new MemoryWorkspaceStorage();
  mgr = new WorkspaceManager(config, storage, clock);
  fs = new FakeFolders();
  const r = await mgr.create({ name: "Personal" });
  if (!r.ok) throw new Error("x");
  ws = r.value;
  fs.trees.set(ws.location, new Map([["space.db", "db-bytes"], ["assets/aa", "adjunto-1"], ["assets/bb", "adjunto-2"]]));
  fs.info.set("/mnt/dest", { exists: true, writable: true, freeBytes: 1_000_000 });
});
const location = async () => { const l = await mgr.list(); if (!l.ok) throw new Error("x"); return l.value[0]!.location; };

describe("validar carpeta destino (T-158)", () => {
  it("rechaza una carpeta que no existe", async () => {
    const r = await validateTargetFolder(fs, "/nada", 10);
    expect(r.ok === false && r.error.details).toMatchObject({ reason: "FOLDER_MISSING" });
  });
  it("rechaza una carpeta sin permiso de escritura", async () => {
    fs.info.set("/ro", { exists: true, writable: false, freeBytes: 1e9 });
    const r = await validateTargetFolder(fs, "/ro", 10);
    expect(r.ok === false && r.error.details).toMatchObject({ reason: "NOT_WRITABLE" });
  });
  it("rechaza una carpeta sin espacio suficiente, indicando lo que falta", async () => {
    fs.info.set("/lleno", { exists: true, writable: true, freeBytes: 5 });
    const r = await validateTargetFolder(fs, "/lleno", 100);
    expect(r.ok === false && r.error.details).toMatchObject({ reason: "NO_SPACE", neededBytes: 100, freeBytes: 5 });
  });
  it("acepta una carpeta válida", async () => {
    expect((await validateTargetFolder(fs, "/mnt/dest", 100)).ok).toBe(true);
  });
  it("con una carpeta inválida no se copia ni se cambia nada y se conserva la ubicación", async () => {
    const before = await location();
    const r = await moveWorkspace(mgr, fs, ws.id, "/nada");
    expect(r.ok).toBe(false);
    expect(fs.calls.some((c) => c.startsWith("copy:") || c.startsWith("remove:"))).toBe(false);
    expect(await location()).toBe(before);
  });
});

describe("mover con verificación (T-159, T-160)", () => {
  it("copia todas las páginas y adjuntos, verifica y conmuta la ubicación", async () => {
    const r = await moveWorkspace(mgr, fs, ws.id, "/mnt/dest");
    expect(r.ok).toBe(true);
    const now = await location();
    expect(now).toBe(`/mnt/dest/${ws.id}`);
    expect(Object.keys(await fs.checksums(now)).sort()).toEqual(["assets/aa", "assets/bb", "space.db"]);
  });
  it("tras mover, la ubicación anterior se elimina (sin duplicados)", async () => {
    await moveWorkspace(mgr, fs, ws.id, "/mnt/dest");
    expect(fs.trees.has(ws.location)).toBe(false);
  });
  it("si no se puede borrar la anterior, el movimiento sigue siendo válido y se avisa", async () => {
    fs.failRemoveOld = true;
    const r = await moveWorkspace(mgr, fs, ws.id, "/mnt/dest");
    expect(r.ok && r.value.oldRemoved).toBe(false);
    expect(await location()).toBe(`/mnt/dest/${ws.id}`);
  });
  it("la copia con huellas distintas NO conmuta: el registro no cambia y se limpia la copia parcial", async () => {
    fs.corruptOnCopy = true;
    const before = await location();
    const r = await moveWorkspace(mgr, fs, ws.id, "/mnt/dest");
    expect(r.ok === false && r.error.details).toMatchObject({ reason: "VERIFY_FAILED" });
    expect(await location()).toBe(before);
    expect(fs.trees.has(`/mnt/dest/${ws.id}`)).toBe(false);
    expect(fs.trees.has(before)).toBe(true);
  });
  it("después de mover, el espacio se abre desde la nueva ubicación", async () => {
    await moveWorkspace(mgr, fs, ws.id, "/mnt/dest");
    const before = storage.opened;
    const o = await mgr.open(ws.id);
    expect(o.ok).toBe(true);
    expect(storage.opened).toBe(before + 1);
    expect(o.ok && o.value.workspace.location).toBe(`/mnt/dest/${ws.id}`);
  });
  it("un espacio inexistente devuelve NOT_FOUND", async () => {
    const r = await moveWorkspace(mgr, fs, "no-existe", "/mnt/dest");
    expect(r.ok === false && r.error.code).toBe("NOT_FOUND");
  });
});

describe("inyección de fallos (T-161, CL-36)", () => {
  it("interrumpir la copia a la mitad deja la ubicación anterior intacta, válida y sin copia parcial", async () => {
    fs.failCopyAfter = 1;
    const before = await location();
    const r = await moveWorkspace(mgr, fs, ws.id, "/mnt/dest");
    expect(r.ok).toBe(false);
    expect(await location()).toBe(before);
    expect(fs.trees.get(before)!.size).toBe(3); // nada se perdió
    expect(fs.trees.has(`/mnt/dest/${ws.id}`)).toBe(false); // ni se duplicó
    expect(await storage.exists(before)).toBe(true); // sigue siendo la ubicación válida y utilizable
  });
  it("si falla al guardar el registro, se revierte: la anterior sigue válida y no queda copia", async () => {
    const orig = config.write.bind(config);
    config.write = async () => { throw new Error("disco lleno"); };
    const before = await location();
    const r = await moveWorkspace(mgr, fs, ws.id, "/mnt/dest");
    config.write = orig;
    expect(r.ok).toBe(false);
    expect(await location()).toBe(before);
    expect(fs.trees.has(`/mnt/dest/${ws.id}`)).toBe(false);
    expect(fs.trees.get(before)!.size).toBe(3);
  });
});
