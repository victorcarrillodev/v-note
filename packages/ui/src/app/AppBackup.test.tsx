// Integración del respaldo y la restauración en la aplicación (T-204, T-208, T-218, T-220; RF-19): vistas, ticks y avisos de la web.
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { BackupService, FakeClock, GitHubTokenStore, MemoryAssetStore, MemoryKeychain, RestoreSource, WorkspaceManager, type AssetStore } from "@vnote/core";
import { FakeGithub } from "../../../core/tests/support/fakeGithub";
import { MemoryConfigStore, MemoryWorkspaceStorage } from "../../../core/tests/support/memoryPorts";
import { createI18n } from "../i18n";
import { MemoryPreferences } from "../theme/theme";
import { App } from "./App";

async function mount(opts: { platform?: "desktop" | "web"; existing?: boolean } = {}) {
  const gh = new FakeGithub();
  const clock = new FakeClock(Date.UTC(2026, 9, 30, 14, 0));
  const workspaces = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), clock);
  if (opts.existing !== false) await workspaces.create({ name: "Personal" });
  const keychain = new MemoryKeychain();
  const assets = new Map<string, AssetStore>();
  const assetsFor = (l: string) => { if (!assets.has(l)) assets.set(l, new MemoryAssetStore()); return assets.get(l)!; };
  const tickers = new Set<() => void>();
  const i18n = await createI18n();
  const user = userEvent.setup();
  render(
    <I18nextProvider i18n={i18n}>
      <App
        services={{
          workspaces, clock,
          backup: {
            platform: opts.platform ?? "desktop",
            assetsFor,
            createService: (ws, store) => new BackupService({ store, assets: assetsFor(ws.location), clock, workspace: { id: ws.id, name: ws.name }, tokens: new GitHubTokenStore(keychain, ws.id), fetch: gh.fetch }),
            createRestoreSource: () => new RestoreSource({ fetch: gh.fetch }),
            onTick: (cb) => { tickers.add(cb); return () => tickers.delete(cb); },
          },
        }}
        preferences={new MemoryPreferences()}
      />
    </I18nextProvider>,
  );
  return { gh, user, workspaces, clock, tick: async () => { for (const t of [...tickers]) t(); await Promise.resolve(); } };
}
const connectBackup = async (user: ReturnType<typeof userEvent.setup>, gh: FakeGithub) => {
  await user.click(await screen.findByRole("button", { name: "Respaldo" }));
  await user.type(await screen.findByLabelText("Token de GitHub"), gh.token);
  await user.type(screen.getByLabelText("Propietario"), "yo");
  await user.type(screen.getByLabelText("Repositorio"), "respaldo");
  await user.click(screen.getByRole("button", { name: "Conectar" }));
  await screen.findByText("yo/respaldo");
};

describe("respaldo en la aplicación", () => {
  it("hay un acceso a la vista de respaldo desde la barra lateral", async () => {
    const { user } = await mount();
    await user.click(await screen.findByRole("button", { name: "Respaldo" }));
    expect(await screen.findByRole("heading", { name: "Respaldo en GitHub" })).toBeInTheDocument();
  });
  it("conectado, el tic ejecuta el respaldo cuando vence (RF-15)", async () => {
    const { user, gh, tick } = await mount();
    await connectBackup(user, gh);
    expect(gh.headSha()).toBeNull();
    await tick();
    await waitFor(() => expect(gh.headSha()).not.toBeNull());
  });
  it("un tic sin respaldo configurado no hace nada ni falla", async () => {
    const { gh, tick } = await mount();
    await screen.findByRole("button", { name: "Respaldo" });
    await tick();
    expect(gh.requests).toEqual([]);
  });
  it("en la web avisa que los respaldos programados solo corren con la app abierta y que web y escritorio no comparten datos (RF-19)", async () => {
    const { user } = await mount({ platform: "web" });
    await user.click(await screen.findByRole("button", { name: "Respaldo" }));
    expect(await screen.findByText(/solo se ejecutan mientras la aplicación esté abierta/i)).toBeInTheDocument();
    expect(screen.getByText(/no comparten datos/i)).toBeInTheDocument();
  });
  it("en el escritorio no muestra ese aviso", async () => {
    const { user } = await mount({ platform: "desktop" });
    await user.click(await screen.findByRole("button", { name: "Respaldo" }));
    await screen.findByRole("heading", { name: "Respaldo en GitHub" });
    expect(screen.queryByText(/solo se ejecutan mientras/i)).toBeNull();
  });
});

describe("restauración en la aplicación", () => {
  it("con espacios existentes hay un acceso «Restaurar desde GitHub»", async () => {
    const { user } = await mount();
    await user.click(await screen.findByRole("button", { name: "Restaurar desde GitHub" }));
    expect(await screen.findByRole("heading", { name: "Restaurar desde GitHub" })).toBeInTheDocument();
  });
  it("primer inicio sin espacios: la pantalla inicial ofrece «Restaurar desde GitHub» (equipo nuevo)", async () => {
    const { user } = await mount({ existing: false });
    expect(await screen.findByRole("heading", { name: "Espacios de trabajo" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Restaurar desde GitHub" }));
    expect(await screen.findByLabelText("Token de GitHub")).toBeInTheDocument();
  });
  it("cancelar la restauración vuelve a donde se estaba", async () => {
    const { user } = await mount();
    await user.click(await screen.findByRole("button", { name: "Restaurar desde GitHub" }));
    await user.click(await screen.findByRole("button", { name: "Cancelar" }));
    expect(await screen.findByRole("button", { name: "Nueva página" })).toBeInTheDocument();
  });
});

// T-221: recorrido completo a través de la interfaz contra el servidor GitHub falso (respaldo y luego restauración como espacio nuevo).
describe("respaldo y restauración de extremo a extremo (T-221; RF-15, RF-17)", () => {
  it("crea una página, la respalda, y la restaura como espacio nuevo con la misma página", async () => {
    const { user, gh, tick, workspaces } = await mount();
    await user.click(await screen.findByRole("button", { name: "Nueva página" }));
    const title = await screen.findByLabelText("Título de la página");
    await user.type(title, "Receta de mole{Enter}");
    await waitFor(() => expect(screen.getAllByRole("treeitem", { name: "Receta de mole" }).length).toBeGreaterThan(0));

    await connectBackup(user, gh);
    await tick();
    await waitFor(() => expect(gh.headSha()).not.toBeNull());
    const files = [...gh.trees.get(gh.commits.get(gh.headSha()!)!.tree)!.keys()];
    expect(files.some((f) => f.startsWith("pages/") && f.includes("receta-de-mole"))).toBe(true);

    await user.click(await screen.findByRole("button", { name: "Restaurar desde GitHub" }));
    await user.type(await screen.findByLabelText("Token de GitHub"), gh.token);
    await user.type(screen.getByLabelText("Propietario"), "yo");
    await user.type(screen.getByLabelText("Repositorio"), "respaldo");
    await user.click(screen.getByRole("button", { name: "Conectar" }));
    await user.click(await screen.findByRole("radio"));
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    const name = await screen.findByLabelText("Nombre del espacio nuevo");
    await user.clear(name);
    await user.type(name, "Restaurado");
    await user.click(screen.getByRole("button", { name: "Restaurar" }));

    expect(await screen.findByRole("treeitem", { name: "Receta de mole" })).toBeInTheDocument();
    const list = await workspaces.list();
    expect(list.ok && list.value.map((w) => w.name).sort()).toEqual(["Personal", "Restaurado"]);
    expect(await screen.findByText("Restaurado")).toBeInTheDocument(); // el espacio abierto es el restaurado
  });
});
