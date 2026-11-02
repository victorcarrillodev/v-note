// T-105 (prueba primero): configuración de la app y almacenamiento de espacios sobre los comandos nativos.
import { describe, it, expect } from "vitest";
import { TauriAppConfigStore, TauriWorkspaceStorage } from "./tauriWorkspaceStorage";
import type { Invoke } from "./tauriSqlStore";

type Call = { cmd: string; args: unknown };
function fake(handler: (c: Call) => unknown) {
  const calls: Call[] = [];
  const invoke: Invoke = async (cmd, args) => { calls.push({ cmd, args }); return handler({ cmd, args }); };
  return { calls, invoke };
}

describe("TauriAppConfigStore", () => {
  it("lee y escribe a través de los comandos de configuración", async () => {
    const { calls, invoke } = fake(({ cmd }) => (cmd === "config_read" ? "{\"version\":1}" : null));
    const s = new TauriAppConfigStore(invoke);
    expect(await s.read()).toBe("{\"version\":1}");
    await s.write("{\"version\":1,\"workspaces\":[]}");
    expect(calls.map((c) => c.cmd)).toEqual(["config_read", "config_write"]);
    expect(calls[1]!.args).toEqual({ text: "{\"version\":1,\"workspaces\":[]}" });
  });
  it("si no hay archivo devuelve null", async () => {
    const { invoke } = fake(() => null);
    expect(await new TauriAppConfigStore(invoke).read()).toBeNull();
  });
});

describe("TauriWorkspaceStorage", () => {
  const dirs = { dataDir: "/home/u/.local/share/app" };
  it("la ubicación por defecto cuelga de la carpeta de datos de la aplicación", async () => {
    const { invoke } = fake(({ cmd }) => (cmd === "app_dirs" ? dirs : null));
    const s = await TauriWorkspaceStorage.create(invoke);
    expect(s.defaultLocation("abc")).toBe("/home/u/.local/share/app/workspaces/abc");
  });
  it("exists consulta al lado nativo", async () => {
    const { calls, invoke } = fake(({ cmd }) => (cmd === "app_dirs" ? dirs : cmd === "path_exists" ? false : null));
    const s = await TauriWorkspaceStorage.create(invoke);
    expect(await s.exists("/mnt/usb/x")).toBe(false);
    expect(calls.at(-1)).toEqual({ cmd: "path_exists", args: { path: "/mnt/usb/x" } });
  });
  it("open abre la base space.db dentro de la carpeta del espacio", async () => {
    const { calls, invoke } = fake(({ cmd }) => (cmd === "app_dirs" ? dirs : cmd === "db_open" ? 5 : null));
    const s = await TauriWorkspaceStorage.create(invoke);
    await s.open("/datos/mi-espacio");
    expect(calls.at(-1)).toEqual({ cmd: "db_open", args: { path: "/datos/mi-espacio/space.db" } });
  });
  it("remove borra solo los archivos del espacio (comando acotado)", async () => {
    const { calls, invoke } = fake(({ cmd }) => (cmd === "app_dirs" ? dirs : null));
    const s = await TauriWorkspaceStorage.create(invoke);
    await s.remove("/datos/mi-espacio");
    expect(calls.at(-1)).toEqual({ cmd: "workspace_remove", args: { dir: "/datos/mi-espacio" } });
  });
  it("assetsDir devuelve la carpeta de adjuntos de un espacio", async () => {
    const { invoke } = fake(({ cmd }) => (cmd === "app_dirs" ? dirs : null));
    const s = await TauriWorkspaceStorage.create(invoke);
    expect(s.assetsDir("/datos/mi-espacio")).toBe("/datos/mi-espacio/assets");
  });
});
