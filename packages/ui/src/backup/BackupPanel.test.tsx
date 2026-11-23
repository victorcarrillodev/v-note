// T-204 a T-211 (prueba primero): el panel de respaldo contra el servicio real y el servidor GitHub falso.
import { describe, it, expect } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BackupService, FakeClock, GitHubTokenStore, MemoryKeychain, MemoryAssetStore, migrate, migrations, PageService } from "@vnote/core";
import { createNodeSqliteStore } from "../../../core/tests/support/nodeSqliteStore";
import { FakeGithub } from "../../../core/tests/support/fakeGithub";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { BackupPanel } from "./BackupPanel";
import { choose, dropdownOptions } from "../../tests/dropdown";

async function setup(opts: { broken?: boolean } = {}) {
  const db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  const gh = new FakeGithub();
  const clock = new FakeClock(Date.UTC(2026, 9, 30, 14, 0));
  const kc = opts.broken
    ? { get: async () => { throw new Error("sin llavero"); }, set: async () => { throw new Error("sin llavero"); }, delete: async () => {} }
    : new MemoryKeychain();
  const service = new BackupService({ store: db, assets: new MemoryAssetStore(), clock, workspace: { id: "ws", name: "Personal" }, tokens: new GitHubTokenStore(kc, "ws"), fetch: gh.fetch });
  await new PageService(db, clock).create({ title: "Nota" });
  await renderWithI18n(<BackupPanel service={service} />);
  return { service, gh, clock, db, user: userEvent.setup() };
}
async function fillAndConnect(user: ReturnType<typeof userEvent.setup>, gh: FakeGithub, over: { token?: string; owner?: string; repo?: string } = {}) {
  await user.type(await screen.findByLabelText("Token de GitHub"), over.token ?? gh.token);
  await user.type(screen.getByLabelText("Propietario"), over.owner ?? "yo");
  await user.type(screen.getByLabelText("Repositorio"), over.repo ?? "respaldo");
  await user.click(screen.getByRole("button", { name: "Conectar" }));
}

describe("conectar (T-204)", () => {
  it("antes de conectar solo se ve el formulario", async () => {
    await setup();
    expect(await screen.findByLabelText("Token de GitHub")).toHaveAttribute("type", "password");
    expect(screen.queryByRole("button", { name: "Respaldar ahora" })).toBeNull();
  });
  it("con datos válidos conecta contra el servidor y muestra el repositorio y el panel de estado", async () => {
    const { user, gh, service } = await setup();
    await fillAndConnect(user, gh);
    expect(await screen.findByText("yo/respaldo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Respaldar ahora" })).toBeInTheDocument();
    expect((await service.getSettings()).enabled).toBe(true);
  });
  it("un token inválido muestra la causa y no conecta", async () => {
    const { user, gh, service } = await setup();
    await fillAndConnect(user, gh, { token: "ghp_malo" });
    expect(await screen.findByRole("alert")).toHaveTextContent(/credenciales|token/i);
    expect((await service.getSettings()).owner).toBeNull();
  });
  it("el token no se muestra en pantalla después de conectar", async () => {
    const { user, gh } = await setup();
    await fillAndConnect(user, gh);
    await screen.findByText("yo/respaldo");
    expect(document.body.innerHTML).not.toContain(gh.token);
  });
  it("sin llavero avisa que el token solo se conserva durante la sesión", async () => {
    const { user, gh } = await setup({ broken: true });
    await fillAndConnect(user, gh);
    expect(await screen.findByText(/no se guardó|solo durante esta sesión/i)).toBeInTheDocument();
  });
  it("desconectar vuelve al formulario", async () => {
    const { user, gh } = await setup();
    await fillAndConnect(user, gh);
    await user.click(await screen.findByRole("button", { name: "Desconectar" }));
    expect(await screen.findByLabelText("Token de GitHub")).toBeInTheDocument();
  });
});

describe("repositorio público (T-205)", () => {
  it("advierte y, sin confirmar, no guarda nada", async () => {
    const { user, gh, service } = await setup();
    gh.isPrivate = false;
    await fillAndConnect(user, gh);
    const warn = await screen.findByRole("alertdialog");
    expect(within(warn).getByText("Repositorio público")).toBeInTheDocument();
    await user.click(within(warn).getByRole("button", { name: "Cancelar" }));
    expect((await service.getSettings()).owner).toBeNull();
    expect(screen.queryByText("yo/respaldo")).toBeNull();
  });
  it("con confirmación explícita lo acepta", async () => {
    const { user, gh, service } = await setup();
    gh.isPrivate = false;
    await fillAndConnect(user, gh);
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Usar de todos modos" }));
    expect(await screen.findByText("yo/respaldo")).toBeInTheDocument();
    expect((await service.getSettings()).owner).toBe("yo");
  });
});

describe("frecuencia (T-206)", () => {
  it("por defecto 1 día; se elige de 1 a 7 y se guarda", async () => {
    const { user, gh, service } = await setup();
    await fillAndConnect(user, gh);
    const select = await screen.findByLabelText("Frecuencia del respaldo");
    expect(select).toHaveAttribute("data-value", "1");
    expect((await dropdownOptions(select)).map((o) => o.value)).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
    await choose(user, select, "3");
    await waitFor(async () => expect((await service.getSettings()).frequencyDays).toBe(3));
    expect(screen.getByLabelText("Frecuencia del respaldo")).toHaveAttribute("data-value", "3");
  });
});

describe("respaldar ahora y estado (T-207, T-208)", () => {
  it("crea un commit en el repositorio y actualiza último éxito, próximo plazo e historial", async () => {
    const { user, gh } = await setup();
    await fillAndConnect(user, gh);
    expect(await screen.findByText(/último respaldo: nunca/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Respaldar ahora" }));
    await waitFor(() => expect(gh.headSha()).not.toBeNull());
    expect(await screen.findByText(/próximo respaldo:/i)).toBeInTheDocument();
    expect(screen.queryByText(/último respaldo: nunca/i)).toBeNull();
    const history = screen.getByRole("list", { name: "Historial de respaldos" });
    expect(within(history).getAllByRole("listitem")).toHaveLength(1);
    expect(history).toHaveTextContent(/éxito|correcto/i);
  });
  it("deshabilita el botón mientras se respalda para evitar dobles clics", async () => {
    const { user, gh } = await setup();
    await fillAndConnect(user, gh);
    const btn = await screen.findByRole("button", { name: "Respaldar ahora" });
    const p = user.click(btn);
    await p;
    await waitFor(() => expect(gh.headSha()).not.toBeNull());
    expect(gh.commits.size).toBe(1);
  });
});

describe("avisos de fallo (T-209, T-210)", () => {
  it("el aviso de fallo usa el sistema unificado: ícono de gravedad, causa y reintento en el mismo aviso (U-134, RF-11.2, RF-14.9)", async () => {
    const { user, gh } = await setup();
    await fillAndConnect(user, gh);
    gh.offline = true;
    await user.click(await screen.findByRole("button", { name: "Respaldar ahora" }));
    const alert = await screen.findByRole("alert");
    expect(alert.querySelector("svg")).not.toBeNull();
    expect(within(alert).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
  it("muestra la causa con un botón para reintentar, que funciona", async () => {
    const { user, gh } = await setup();
    await fillAndConnect(user, gh);
    gh.offline = true;
    await user.click(await screen.findByRole("button", { name: "Respaldar ahora" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/sin conexión/i);
    gh.offline = false;
    await user.click(within(alert).getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(gh.headSha()).not.toBeNull();
  });
  it.each([
    ["credenciales", () => undefined as unknown, /credenciales|token/i, "AUTH"],
    ["límite", () => undefined as unknown, /límite de uso/i, "RATE_LIMIT"],
  ])("causa %s con texto propio", async (_n, _s, re, kind) => {
    const { user, gh } = await setup();
    await fillAndConnect(user, gh);
    if (kind === "AUTH") gh.token = "caducado";
    else gh.inject({ match: /./, status: 403, body: { message: "API rate limit exceeded" }, headers: { "x-ratelimit-remaining": "0" }, times: 99 });
    await user.click(await screen.findByRole("button", { name: "Respaldar ahora" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(re);
  });
  it("repositorio lleno: explica el límite y sugiere qué hacer", async () => {
    const { user, gh } = await setup();
    await fillAndConnect(user, gh);
    gh.maxRepoBytes = 1;
    await user.click(await screen.findByRole("button", { name: "Respaldar ahora" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/repositorio.*(límite|lleno)/i);
    expect(within(alert).getByText(/usar otro repositorio/i)).toBeInTheDocument();
    expect(within(alert).getByText(/quitar adjuntos pesados/i)).toBeInTheDocument();
  });
});

describe("decisión por cambio externo (T-211)", () => {
  async function withExternal() {
    const ctx = await setup();
    await fillAndConnect(ctx.user, ctx.gh);
    await ctx.user.click(await screen.findByRole("button", { name: "Respaldar ahora" }));
    await waitFor(() => expect(ctx.gh.headSha()).not.toBeNull());
    await ctx.gh.externalCommit({ "otro.txt": "alguien más" });
    await new PageService(ctx.db, ctx.clock).create({ title: "Nueva" });
    await ctx.user.click(screen.getByRole("button", { name: "Respaldar ahora" }));
    return ctx;
  }
  it("pregunta antes de continuar y no sube nada mientras tanto", async () => {
    const { gh } = await withExternal();
    const dlg = await screen.findByRole("alertdialog");
    expect(dlg).toHaveTextContent(/cambió fuera de la aplicación|alguien más escribió/i);
    expect(gh.commits.size).toBe(2); // el primero propio y el externo
  });
  it("continuar sube encima del cambio externo y cierra el aviso", async () => {
    const { gh } = await withExternal();
    const user = userEvent.setup();
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Continuar" }));
    await waitFor(() => expect(gh.commits.size).toBe(3));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });
  it("cancelar no sube nada y avisa que el respaldo automático queda en pausa", async () => {
    const { gh } = await withExternal();
    const user = userEvent.setup();
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(gh.commits.size).toBe(2);
    expect(await screen.findByText(/en pausa/i)).toBeInTheDocument();
  });
});
