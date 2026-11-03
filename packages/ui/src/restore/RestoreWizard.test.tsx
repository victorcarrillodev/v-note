// T-218, T-219, T-220 (prueba primero): asistente de restauración contra el servidor GitHub falso.
import { describe, it, expect } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FakeClock, GitHubClient, MemoryAssetStore, PageService, PagesRepo, RestoreSource, WorkspaceManager, runBackup, type AssetStore, type Workspace } from "@vnote/core";
import { FakeGithub } from "../../../core/tests/support/fakeGithub";
import { MemoryConfigStore, MemoryWorkspaceStorage } from "../../../core/tests/support/memoryPorts";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { RestoreWizard } from "./RestoreWizard";

async function setup(opts: { backups?: number; existing?: boolean } = {}) {
  const gh = new FakeGithub();
  const clock = new FakeClock(Date.UTC(2026, 9, 30, 14, 0));
  const mgr = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), clock);
  const assets = new Map<string, AssetStore>();
  const assetsFor = (loc: string) => { if (!assets.has(loc)) assets.set(loc, new MemoryAssetStore()); return assets.get(loc)!; };
  // Un espacio de origen que se respalda; después, según la prueba, se conserva o se elimina (equipo nuevo).
  const src = await mgr.create({ name: "Casa" });
  if (!src.ok) throw new Error("x");
  const opened = await mgr.open(src.value.id);
  if (!opened.ok) throw new Error("x");
  const svc = new PageService(opened.value.store, clock);
  await svc.create({ title: "Proyectos" }); await svc.create({ title: "Ideas" });
  const client = new GitHubClient({ fetch: gh.fetch, token: gh.token, owner: "yo", repo: "r" });
  for (let i = 0; i < (opts.backups ?? 1); i++) {
    await svc.create({ title: `extra${i}` });
    await runBackup({ store: opened.value.store, assets: assetsFor(src.value.location), client, clock, workspace: { id: src.value.id, name: "Casa" } }, { onExternalChange: "continue" });
    clock.advance(86_400_000);
  }
  let target = mgr;
  if (opts.existing === false) target = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), clock); // equipo nuevo, sin espacios
  const done: Workspace[] = [];
  const cancelled = { n: 0 };
  const source = new RestoreSource({ fetch: gh.fetch });
  const user = userEvent.setup();
  await renderWithI18n(<RestoreWizard source={source} workspaces={target} assetsFor={assetsFor} onDone={(w) => done.push(w)} onCancel={() => cancelled.n++} />);
  return { gh, mgr: target, done, cancelled, user, source, srcWs: src.value };
}
async function connect(user: ReturnType<typeof userEvent.setup>, gh: FakeGithub, token = gh.token) {
  await user.type(await screen.findByLabelText("Token de GitHub"), token);
  await user.type(screen.getByLabelText("Propietario"), "yo");
  await user.type(screen.getByLabelText("Repositorio"), "r");
  await user.click(screen.getByRole("button", { name: "Conectar" }));
}

describe("restaurar como espacio nuevo (T-218, T-220)", () => {
  it("equipo nuevo: conectar, elegir un respaldo y restaurar sin tener ningún espacio", async () => {
    const { user, gh, mgr, done } = await setup({ existing: false });
    await connect(user, gh);
    const list = await screen.findByRole("radiogroup", { name: "Respaldos disponibles" });
    expect(within(list).getAllByRole("radio")).toHaveLength(1);
    await user.click(within(list).getAllByRole("radio")[0]!);
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.queryByRole("radio", { name: /reemplazar/i })).toBeNull(); // sin espacios no hay qué reemplazar
    expect(screen.getByLabelText("Nombre del espacio nuevo")).toHaveValue("Casa (restaurado)");
    await user.click(screen.getByRole("button", { name: "Restaurar" }));
    await waitFor(() => expect(done).toHaveLength(1));
    const all = await mgr.list();
    expect(all.ok && all.value.map((w) => w.name)).toEqual(["Casa (restaurado)"]);
    expect(await screen.findByRole("status")).toHaveTextContent(/restaurado/i);
  });
  it("con espacios existentes añade uno nuevo sin tocar los demás", async () => {
    const { user, gh, mgr, done } = await setup({ existing: true });
    await connect(user, gh);
    await user.click(within(await screen.findByRole("radiogroup", { name: "Respaldos disponibles" })).getAllByRole("radio")[0]!);
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    const name = screen.getByLabelText("Nombre del espacio nuevo");
    await user.clear(name); await user.type(name, "Copia");
    await user.click(screen.getByRole("button", { name: "Restaurar" }));
    await waitFor(() => expect(done).toHaveLength(1));
    const all = await mgr.list();
    expect(all.ok && all.value.map((w) => w.name).sort()).toEqual(["Casa", "Copia"]);
  });
  it("muestra los respaldos por fecha, el más reciente primero", async () => {
    const { user, gh } = await setup({ backups: 3 });
    await connect(user, gh);
    const radios = within(await screen.findByRole("radiogroup", { name: "Respaldos disponibles" })).getAllByRole("radio");
    expect(radios).toHaveLength(3);
  });
  it("un repositorio sin respaldos lo dice con claridad", async () => {
    const { user, gh } = await setup({ backups: 0 });
    await connect(user, gh);
    expect(await screen.findByText("No hay respaldos en este repositorio.")).toBeInTheDocument();
  });
  it("token inválido: muestra el error y no avanza", async () => {
    const { user, gh } = await setup();
    await connect(user, gh, "ghp_malo");
    expect(await screen.findByRole("alert")).toHaveTextContent(/credenciales|token/i);
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });
  it("un respaldo de una versión futura se rechaza y no crea nada", async () => {
    const { user, gh, mgr } = await setup({ existing: false });
    await gh.externalCommit({ "workspace.json": '{"formatVersion": 99, "id":"x","name":"n","pageCount":0}' }, "main", "futuro");
    await connect(user, gh);
    await user.click(within(await screen.findByRole("radiogroup", { name: "Respaldos disponibles" })).getAllByRole("radio")[0]!);
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await user.click(screen.getByRole("button", { name: "Restaurar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/versión más nueva/i);
    const all = await mgr.list();
    expect(all.ok && all.value).toEqual([]);
  });
  it("el error es un aviso persistente con ícono de gravedad (U-135, RF-11.2, RF-14.9)", async () => {
    const { user, gh } = await setup();
    await connect(user, gh, "ghp_malo");
    const alert = await screen.findByRole("alert");
    expect(alert.querySelector("svg")).not.toBeNull();
    expect(alert).toHaveTextContent(/credenciales|token/i);
  });
  it("cancelar en cualquier momento avisa a quien lo usa", async () => {
    const { user, cancelled } = await setup();
    await user.click(await screen.findByRole("button", { name: "Cancelar" }));
    expect(cancelled.n).toBe(1);
  });
});

describe("reemplazar un espacio (T-219)", () => {
  async function toReplace() {
    const ctx = await setup({ existing: true });
    await connect(ctx.user, ctx.gh);
    await ctx.user.click(within(await screen.findByRole("radiogroup", { name: "Respaldos disponibles" })).getAllByRole("radio")[0]!);
    await ctx.user.click(screen.getByRole("button", { name: "Siguiente" }));
    await ctx.user.click(screen.getByRole("radio", { name: /reemplazar un espacio existente/i }));
    return ctx;
  }
  it("muestra qué se sustituye y exige escribir el nombre exacto", async () => {
    const { user } = await toReplace();
    expect(await screen.findByText(/se sustituirán/i)).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: "Reemplazar" });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText(/escribe «Casa» para confirmar/i), "casa");
    expect(confirm).toBeDisabled();
    await user.clear(screen.getByLabelText(/escribe «Casa» para confirmar/i));
    await user.type(screen.getByLabelText(/escribe «Casa» para confirmar/i), "Casa");
    expect(confirm).toBeEnabled();
  });
  it("cancelar deja todo intacto", async () => {
    const { user, mgr, srcWs, cancelled } = await toReplace();
    await user.click(await screen.findByRole("button", { name: "Cancelar" }));
    expect(cancelled.n).toBe(1);
    const all = await mgr.list();
    expect(all.ok && all.value.map((w) => w.id)).toEqual([srcWs.id]);
  });
  it("confirmar reemplaza: queda un solo espacio con el contenido del respaldo", async () => {
    const { user, mgr, srcWs, done } = await toReplace();
    await screen.findByText(/se sustituirán/i);
    await user.type(screen.getByLabelText(/escribe «Casa» para confirmar/i), "Casa");
    await user.click(screen.getByRole("button", { name: "Reemplazar" }));
    const dlg = await screen.findByRole("alertdialog"); // U-147: confirmación estándar antes de sustituir
    expect(dlg).toHaveTextContent("Casa");
    await user.click(within(dlg).getByRole("button", { name: "Reemplazar" }));
    await waitFor(() => expect(done).toHaveLength(1));
    const all = await mgr.list();
    expect(all.ok && all.value.map((w) => w.name)).toEqual(["Casa"]);
    expect(all.ok && all.value[0]!.id).not.toBe(srcWs.id);
    const opened = await mgr.open(done[0]!.id);
    if (!opened.ok) throw new Error("x");
    expect((await new PagesRepo(opened.value.store, new FakeClock(1)).tree()).map((n) => n.page.title).sort()).toEqual(["Ideas", "Proyectos", "extra0"]);
  });
  it("cancelar el diálogo final de reemplazo deja todo intacto (U-147)", async () => {
    const { user, mgr, srcWs, done } = await toReplace();
    await screen.findByText(/se sustituirán/i);
    await user.type(screen.getByLabelText(/escribe «Casa» para confirmar/i), "Casa");
    await user.click(screen.getByRole("button", { name: "Reemplazar" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));
    expect(done).toHaveLength(0);
    const all = await mgr.list();
    expect(all.ok && all.value.map((w) => w.id)).toEqual([srcWs.id]);
  });
});
