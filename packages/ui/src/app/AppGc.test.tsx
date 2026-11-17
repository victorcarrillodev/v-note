// E-062 (RF-2.8): al abrir el espacio se borran en segundo plano los archivos sin uso.
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { BackupService, FakeClock, GitHubTokenStore, MemoryAssetStore, MemoryKeychain, RestoreSource, WorkspaceManager, type AssetStore } from "@vnote/core";
import { FakeGithub } from "../../../core/tests/support/fakeGithub";
import { MemoryConfigStore, MemoryWorkspaceStorage } from "../../../core/tests/support/memoryPorts";
import { createI18n } from "../i18n";
import { MemoryPreferences } from "../theme/theme";
import { App } from "./App";

async function mount(assetsFor: (l: string) => AssetStore) {
  const gh = new FakeGithub();
  const clock = new FakeClock(Date.UTC(2026, 9, 30, 14, 0));
  const workspaces = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), clock);
  await workspaces.create({ name: "Personal" });
  const keychain = new MemoryKeychain();
  const i18n = await createI18n();
  render(
    <I18nextProvider i18n={i18n}>
      <App
        services={{
          workspaces, clock,
          backup: {
            platform: "desktop", assetsFor,
            createService: (ws, store) => new BackupService({ store, assets: assetsFor(ws.location), clock, workspace: { id: ws.id, name: ws.name }, tokens: new GitHubTokenStore(keychain, ws.id), fetch: gh.fetch }),
            createRestoreSource: () => new RestoreSource({ fetch: gh.fetch }),
            onTick: () => () => {},
          },
        }}
        preferences={new MemoryPreferences()}
      />
    </I18nextProvider>,
  );
}

describe("limpieza de archivos al abrir el espacio (E-062)", () => {
  it("borra un huérfano sin bloquear el arranque", async () => {
    const store = new MemoryAssetStore();
    const orphan = (await store.put(new Uint8Array([1, 2, 3]))).hash;
    await mount(() => store);
    await screen.findByText("Personal");
    await waitFor(async () => expect(await store.has(orphan)).toBe(false));
  });
  it("si el almacén falla, el espacio se abre igual", async () => {
    const broken = Object.assign(Object.create(new MemoryAssetStore()) as MemoryAssetStore, { list: async () => { throw new Error("sin acceso"); } });
    await mount(() => broken);
    expect(await screen.findByText("Personal")).toBeInTheDocument();
  });
});
