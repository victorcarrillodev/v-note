// T-397, T-398 (prueba primero): interfaz de importación — progreso, cancelación y informe final.
import { describe, it, expect } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FakeClock, MemoryAssetStore, migrate, migrations, PagesRepo } from "@vnote/core";
import { createNodeSqliteStore } from "../../../core/tests/support/nodeSqliteStore";
import { notionExport, obsidianVault, zipOf } from "../../../core/tests/fixtures/importFixtures";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { ImportView } from "./ImportView";
import { choose } from "../../tests/dropdown";

async function setup() {
  const store = await createNodeSqliteStore(":memory:");
  await migrate(store, migrations);
  const clock = new FakeClock(1_000), assets = new MemoryAssetStore();
  const opened: string[] = [];
  await renderWithI18n(<ImportView store={store} assets={assets} clock={clock} onOpen={(id) => opened.push(id)} />);
  return { store, assets, clock, opened, repo: new PagesRepo(store, clock), user: userEvent.setup() };
}
const file = (bytes: Uint8Array, name: string) => new File([bytes as BlobPart], name);

describe("importar (T-398)", () => {
  it("un ZIP de Notion se importa y se muestra el informe con lo importado, aproximado, omitido y roto", async () => {
    const { repo, opened, user } = await setup();
    await choose(user, screen.getByLabelText("Origen"), "notion");
    fireEvent.change(screen.getByLabelText("Nombre de la página contenedora"), { target: { value: "Desde Notion" } });
    fireEvent.change(screen.getByLabelText("Archivo ZIP"), { target: { files: [file(zipOf(notionExport()), "export.zip")] } });
    await user.click(screen.getByRole("button", { name: "Importar" }));
    const report = await screen.findByRole("region", { name: "Informe de importación" }, { timeout: 15000 });
    expect(report).toHaveTextContent("Importado");
    expect(report).toHaveTextContent("Aproximado");
    expect(report).toHaveTextContent("Omitido");
    expect(report).toHaveTextContent("Enlaces rotos");
    expect(report).toHaveTextContent("Inexistente");
    expect((await repo.children(null)).map((p) => p.title)).toEqual(["Desde Notion"]);
    await user.click(screen.getByRole("button", { name: "Abrir lo importado" }));
    expect(opened).toHaveLength(1);
  });
  it("una carpeta de Markdown (Obsidian) también se importa", async () => {
    const { repo, user } = await setup();
    const files = obsidianVault().map((f) => Object.assign(file(f.data, f.path.split("/").pop()!), { webkitRelativePath: `Bóveda/${f.path}` }));
    fireEvent.change(screen.getByLabelText("Carpeta"), { target: { files } });
    await user.click(screen.getByRole("button", { name: "Importar" }));
    await screen.findByRole("region", { name: "Informe de importación" }, { timeout: 15000 });
    expect((await repo.children(null)).length).toBe(1);
  });
  it("un ZIP dañado muestra un error y no escribe nada", async () => {
    const { repo, user } = await setup();
    await choose(user, screen.getByLabelText("Origen"), "notion");
    fireEvent.change(screen.getByLabelText("Archivo ZIP"), { target: { files: [file(new Uint8Array([1, 2, 3]), "malo.zip")] } });
    await user.click(screen.getByRole("button", { name: "Importar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("dañado");
    expect(await repo.children(null)).toEqual([]);
  });
  it("el error es un aviso persistente con ícono de gravedad (U-136, RF-11.2, RF-14.9)", async () => {
    const { user } = await setup();
    await choose(user, screen.getByLabelText("Origen"), "notion");
    fireEvent.change(screen.getByLabelText("Archivo ZIP"), { target: { files: [file(new Uint8Array([1, 2, 3]), "malo.zip")] } });
    await user.click(screen.getByRole("button", { name: "Importar" }));
    const alert = await screen.findByRole("alert");
    expect(alert.querySelector("svg")).not.toBeNull();
    expect(alert).toHaveTextContent("dañado");
  });
  it("sin elegir archivos el botón Importar está desactivado", async () => {
    await setup();
    expect(screen.getByRole("button", { name: "Importar" })).toBeDisabled();
  });
});

describe("progreso y cancelación (T-397)", () => {
  it("muestra el progreso y al cancelar no queda nada importado", async () => {
    const { repo, user } = await setup();
    const many = Array.from({ length: 400 }, (_, i) => ({ path: `n/p${i}.md`, data: new TextEncoder().encode(`# P${i}\n\ntexto ${i}`) }));
    await choose(user, screen.getByLabelText("Origen"), "notion");
    fireEvent.change(screen.getByLabelText("Archivo ZIP"), { target: { files: [file(zipOf(many), "grande.zip")] } });
    await user.click(screen.getByRole("button", { name: "Importar" }));
    const bar = await screen.findByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuemax");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(await screen.findByRole("status", {}, { timeout: 15000 })).toHaveTextContent("cancelada");
    await waitFor(async () => expect(await repo.children(null)).toEqual([]));
  });
});
