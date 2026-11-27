// Integración del respaldo unificado en la aplicación: respaldar todos los espacios en una carpeta y restaurarlos como espacios nuevos.
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { BackupService, FakeClock, GitHubTokenStore, MemoryAssetStore, MemoryKeychain, RestoreSource, WorkspaceManager, type AssetStore, type FolderSyncPort } from "@vnote/core";
import { MemoryConfigStore, MemoryWorkspaceStorage } from "../../../core/tests/support/memoryPorts";
import { createI18n } from "../i18n";
import { MemoryPreferences } from "../theme/theme";
import { App } from "./App";

async function mount() {
  const clock = new FakeClock(Date.UTC(2026, 10, 27, 12, 0));
  const workspaces = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), clock);
  await workspaces.create({ name: "Personal" });
  await workspaces.create({ name: "Estudio" });
  const assets = new Map<string, AssetStore>();
  const assetsFor = (l: string) => { if (!assets.has(l)) assets.set(l, new MemoryAssetStore()); return assets.get(l)!; };
  const disk = new Map<string, Uint8Array>();
  const writes: string[] = [];
  const folderPort = (path: string): FolderSyncPort => ({
    label: path,
    readFile: async (p) => disk.get(p) ?? null,
    writeFile: async (p, b) => { writes.push(p); disk.set(p, b); },
    removeFile: async (p) => { disk.delete(p); },
    listFiles: async () => [...disk.keys()],
  });
  const keychain = new MemoryKeychain();
  const noNet = (async () => { throw new Error("sin red"); }) as never;
  const i18n = await createI18n();
  const user = userEvent.setup();
  render(
    <I18nextProvider i18n={i18n}>
      <App
        services={{
          workspaces, clock,
          backup: { platform: "desktop", assetsFor, createService: (ws, store) => new BackupService({ store, assets: assetsFor(ws.location), clock, workspace: { id: ws.id, name: ws.name }, tokens: new GitHubTokenStore(keychain, ws.id), fetch: noNet }), createRestoreSource: () => new RestoreSource({ fetch: noNet }), onTick: () => () => {} },
          unifiedBackup: { keychain, fetch: noNet, folderPort, pickFolder: async () => "/respaldo" },
          pickFolder: async () => "/respaldo",
        }}
        preferences={new MemoryPreferences()}
      />
    </I18nextProvider>,
  );
  return { user, workspaces, disk, writes };
}

describe("respaldo unificado en la aplicación", () => {
  it("respalda todos los espacios en la carpeta elegida y no reescribe si nada cambió", async () => {
    const { user, workspaces, disk, writes } = await mount();
    await user.click(await screen.findByRole("button", { name: "Respaldo" }));
    await user.click(await screen.findByRole("button", { name: "Elegir carpeta" }));
    await screen.findByText("/respaldo");
    await user.click(screen.getByRole("button", { name: "Respaldar ahora" }));
    await waitFor(() => expect(disk.has("backup-manifest.json")).toBe(true), { timeout: 15_000 });
    const ids = (await workspaces.list()) as { ok: true; value: { id: string }[] };
    for (const w of ids.value) expect([...disk.keys()].some((k) => k.startsWith(`workspaces/${w.id}/`))).toBe(true);
    expect(disk.has("app/workspaces.json")).toBe(true);

    writes.length = 0;
    await user.click(screen.getByRole("button", { name: "Respaldar ahora" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Respaldar ahora" })).toBeEnabled(), { timeout: 15_000 });
    expect(writes).toEqual([]);
  }, 30_000);

  it("restaurar todo crea los espacios como nuevos sin tocar los actuales", async () => {
    const { user, workspaces } = await mount();
    await user.click(await screen.findByRole("button", { name: "Respaldo" }));
    await user.click(await screen.findByRole("button", { name: "Elegir carpeta" }));
    await screen.findByText("/respaldo");
    await user.click(screen.getByRole("button", { name: "Respaldar ahora" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Respaldar ahora" })).toBeEnabled(), { timeout: 15_000 });
    await user.click(screen.getByRole("button", { name: "Restaurar todo" }));
    await user.click(await screen.findByRole("button", { name: "Restaurar" }));
    expect(await screen.findByText("Se restauraron 2 espacios.", {}, { timeout: 15_000 })).toBeInTheDocument();
    const list = (await workspaces.list()) as { ok: true; value: { name: string }[] };
    expect(list.value.map((w) => w.name).sort()).toEqual(["Estudio", "Estudio (restaurado)", "Personal", "Personal (restaurado)"]);
  }, 30_000);
});
