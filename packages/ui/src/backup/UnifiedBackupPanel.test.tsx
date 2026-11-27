import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryKeychain } from "@vnote/core";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { choose, dropdownOptions } from "../../tests/dropdown";
import { MemoryPreferences } from "../theme/theme";
import { UnifiedBackupPanel } from "./UnifiedBackupPanel";
import { loadUnifiedConfig } from "./unifiedConfig";

function fakeController() {
  let status = { state: "idle" as const, lastSyncAt: null as number | null };
  const listeners = new Set<(s: typeof status) => void>();
  return {
    status: () => status,
    onStatus: (cb: (s: typeof status) => void) => { listeners.add(cb); return () => void listeners.delete(cb); },
    syncNow: vi.fn(async () => ({ status: "unchanged" as const, manifest: null })),
    setContinuous: vi.fn(),
    destinationChanged: vi.fn(),
  };
}

async function setup(over: Partial<React.ComponentProps<typeof UnifiedBackupPanel>> = {}) {
  const user = userEvent.setup();
  const controller = fakeController();
  const prefs = new MemoryPreferences();
  const keychain = new MemoryKeychain();
  const onRestoreAll = vi.fn();
  const r = await renderWithI18n(
    <UnifiedBackupPanel controller={controller as never} preferences={prefs} keychain={keychain} fetch={(async () => ({})) as never}
      pickFolder={async () => "/home/u/Respaldo"} oauth={{ redirectUri: "http://127.0.0.1:1/cb", authorize: async () => "" }} onRestoreAll={onRestoreAll} {...over} />,
  );
  return { user, controller, prefs, keychain, onRestoreAll, ...r };
}

describe("UnifiedBackupPanel", () => {
  it("elige carpeta local con el diálogo nativo y la recuerda", async () => {
    const { user, prefs } = await setup();
    await user.click(screen.getByRole("button", { name: "Elegir carpeta" }));
    expect(await screen.findByText("/home/u/Respaldo")).toBeInTheDocument();
    expect(loadUnifiedConfig(prefs).folderPath).toBe("/home/u/Respaldo");
  });

  it("GitHub: guarda el token en el llavero (no en las preferencias) y el repositorio en la configuración", async () => {
    const { user, prefs, keychain, controller } = await setup();
    await choose(user, screen.getByLabelText("Destino del respaldo"), "github");
    await user.type(screen.getByLabelText("Token de GitHub"), "ghp_secreto");
    await user.type(screen.getByLabelText("Propietario"), "yo");
    await user.type(screen.getByLabelText("Repositorio"), "notas");
    await user.click(screen.getByRole("button", { name: "Guardar destino" }));
    await waitFor(async () => expect(await keychain.get("github:backup")).toBe("ghp_secreto"));
    expect(JSON.stringify(prefs.get("backup_unified"))).not.toContain("ghp_secreto");
    expect(loadUnifiedConfig(prefs).destination).toEqual({ kind: "github", owner: "yo", repo: "notas" });
    expect(controller.destinationChanged).toHaveBeenCalled();
    expect((screen.getByLabelText("Token de GitHub") as HTMLInputElement).value).toBe("");
  });

  it("«Respaldar ahora» sincroniza y el modo continuo se activa y se recuerda", async () => {
    const { user, controller, prefs } = await setup();
    await user.click(screen.getByRole("button", { name: "Respaldar ahora" }));
    expect(controller.syncNow).toHaveBeenCalledTimes(1);
    await choose(user, screen.getByLabelText("Respaldo continuo"), "true");
    expect(controller.setContinuous).toHaveBeenCalledWith(true);
    expect(loadUnifiedConfig(prefs).continuous).toBe(true);
  });

  it("restaurar todo avisa a la aplicación", async () => {
    const { user, onRestoreAll } = await setup();
    await user.click(screen.getByRole("button", { name: "Restaurar todo" }));
    expect(onRestoreAll).toHaveBeenCalledTimes(1);
  });

  it("sin puerto OAuth (web) no ofrece Drive ni Dropbox, y sin carpeta nativa no ofrece carpeta local", async () => {
    await setup({ oauth: undefined, pickFolder: undefined });
    const opts = await dropdownOptions(screen.getByLabelText("Destino del respaldo"));
    expect(opts.map((o) => o.value)).toEqual(["github"]);
  });

  it("si el llavero falla al conectar, muestra el error y no deja el botón bloqueado", async () => {
    const keychain = { get: async () => null, set: async () => { throw new Error("llavero bloqueado"); }, delete: async () => {} };
    const { user } = await setup({ keychain: keychain as never, fetch: (async () => ({ status: 200, headers: { get: () => null }, json: async () => ({ access_token: "A", refresh_token: "R", expires_in: 3600 }), text: async () => "" })) as never, oauth: { redirectUri: "http://127.0.0.1:1/cb", authorize: async (url: string) => `http://127.0.0.1:1/cb?code=c&state=${new URL(url).searchParams.get("state")}` } });
    await choose(user, screen.getByLabelText("Destino del respaldo"), "dropbox");
    await user.type(screen.getByLabelText("Client ID de OAuth"), "cid");
    await user.click(screen.getByRole("button", { name: "Guardar destino" }));
    await user.click(screen.getByRole("button", { name: "Conectar cuenta" }));
    expect(await screen.findByText(/llavero bloqueado/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Conectar cuenta" })).toBeEnabled();
  });

  it("si el llavero falla al guardar el token de GitHub, avisa y no pierde el formulario", async () => {
    const keychain = { get: async () => null, set: async () => { throw new Error("sin llavero"); }, delete: async () => {} };
    const { user } = await setup({ keychain: keychain as never });
    await choose(user, screen.getByLabelText("Destino del respaldo"), "github");
    await user.type(screen.getByLabelText("Token de GitHub"), "ghp_x");
    await user.click(screen.getByRole("button", { name: "Guardar destino" }));
    expect(await screen.findByText(/sin llavero/)).toBeInTheDocument();
  });
});
