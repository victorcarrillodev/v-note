// T-204 a T-211 (lógica; prueba primero): servicio de respaldo de un espacio: conexión, frecuencia, estado, avisos y decisiones.
import { describe, it, expect, beforeEach } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { FakeGithub } from "../../tests/support/fakeGithub";
import { para, updateFor } from "../../tests/support/builders";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { FakeClock } from "../clock";
import { MemoryAssetStore } from "../assets/memoryAssetStore";
import { PageService } from "../pages/pageService";
import { GitHubTokenStore, MemoryKeychain } from "./tokenStore";
import { BackupService } from "./backupService";
import { serveBackup, BackupWorkerClient } from "./backupWorker";
import type { SqlStore } from "../ports/sqlStore";

const MIN = 60_000, DAY = 86_400_000;
let db: SqlStore, gh: FakeGithub, clock: FakeClock, svc: BackupService, tokens: GitHubTokenStore, assets: MemoryAssetStore, pages: PageService;
const T0 = Date.UTC(2026, 9, 30, 14, 0);
beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  gh = new FakeGithub();
  clock = new FakeClock(T0);
  assets = new MemoryAssetStore();
  tokens = new GitHubTokenStore(new MemoryKeychain(), "ws");
  svc = new BackupService({ store: db, assets, clock, workspace: { id: "ws", name: "Personal" }, tokens, fetch: gh.fetch });
  pages = new PageService(db, clock);
  const p = await pages.create({ title: "Nota" });
  if (p.ok) await pages.saveUpdate(p.value.id, updateFor([para("hola")]));
});
const connect = (o: Partial<Parameters<BackupService["connect"]>[0]> = {}) => svc.connect({ token: gh.token, owner: "yo", repo: "respaldo", ...o });

describe("conexión (T-204, T-205)", () => {
  it("con un repositorio privado guarda la configuración, el token y activa el respaldo diario", async () => {
    const r = await connect();
    expect(r).toEqual({ ok: true, value: { isPrivate: true, tokenPersisted: true } });
    expect(await svc.getSettings()).toEqual({ owner: "yo", repo: "respaldo", branch: "main", frequencyDays: 1, enabled: true, hasToken: true });
    expect(await tokens.get()).toBe(gh.token);
  });
  it("un repositorio público exige confirmación y, sin ella, NO se guarda nada (ni el token)", async () => {
    gh.isPrivate = false;
    const r = await connect();
    expect(r.ok === false && r.error.code).toBe("NEEDS_CONFIRMATION");
    expect(r.ok === false && r.error.details).toMatchObject({ reason: "PUBLIC_REPO" });
    expect(await svc.getSettings()).toMatchObject({ owner: null, repo: null, enabled: false, hasToken: false });
    expect(await tokens.get()).toBeNull();
  });
  it("con confirmación explícita se acepta un repositorio público", async () => {
    gh.isPrivate = false;
    const r = await connect({ confirmPublic: true });
    expect(r).toEqual({ ok: true, value: { isPrivate: false, tokenPersisted: true } });
    expect((await svc.getSettings()).owner).toBe("yo");
  });
  it.each([
    ["token inválido", () => { gh.token = "otro"; }, "AUTH"],
    ["repositorio inexistente", () => gh.inject({ match: /GET \/repos\/yo\/respaldo$/, status: 404, body: { message: "Not Found" } }), "REPO_NOT_FOUND"],
    ["sin permiso de escritura", () => { gh.canPush = false; }, "NO_PERMISSION"],
    ["sin conexión", () => { gh.offline = true; }, "OFFLINE"],
  ])("%s: falla con la causa y no guarda nada", async (_n, setup, kind) => {
    const real = gh.token;
    setup();
    const r = await svc.connect({ token: real, owner: "yo", repo: "respaldo" });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error.details).toMatchObject({ kind });
    expect(await svc.getSettings()).toMatchObject({ owner: null, hasToken: false, enabled: false });
  });
  it("valida los datos antes de llamar a la red", async () => {
    const before = gh.requests.length;
    for (const bad of [{ token: "" }, { owner: "  " }, { repo: "" }, { owner: "a/b" }, { repo: "con espacio" }]) expect((await connect(bad)).ok).toBe(false);
    expect(gh.requests.length).toBe(before);
  });
  it("sin llavero, el token queda solo en la sesión y se avisa", async () => {
    const broken = { get: async () => { throw new Error("sin llavero"); }, set: async () => { throw new Error("sin llavero"); }, delete: async () => {} };
    const s = new BackupService({ store: db, assets, clock, workspace: { id: "ws", name: "n" }, tokens: new GitHubTokenStore(broken, "ws"), fetch: gh.fetch });
    expect(await s.connect({ token: gh.token, owner: "yo", repo: "respaldo" })).toEqual({ ok: true, value: { isPrivate: true, tokenPersisted: false } });
  });
  it("desconectar borra el token, el repositorio y desactiva el respaldo", async () => {
    await connect();
    await svc.disconnect();
    expect(await svc.getSettings()).toEqual({ owner: null, repo: null, branch: "main", frequencyDays: 1, enabled: false, hasToken: false });
    expect(await tokens.get()).toBeNull();
  });
});

describe("frecuencia (T-206)", () => {
  it("por defecto es 1 día y acepta de 1 a 7", async () => {
    await connect();
    for (const d of [1, 2, 3, 7]) { expect((await svc.setFrequency(d)).ok).toBe(true); expect((await svc.getSettings()).frequencyDays).toBe(d); }
  });
  it("rechaza valores fuera de rango y conserva el anterior", async () => {
    await connect(); await svc.setFrequency(3);
    for (const bad of [0, 8, 2.5]) expect((await svc.setFrequency(bad)).ok).toBe(false);
    expect((await svc.getSettings()).frequencyDays).toBe(3);
  });
});

describe("«Respaldar ahora» y estado (T-207, T-208)", () => {
  it("produce un commit en el repositorio y actualiza el estado", async () => {
    await connect();
    const out = await svc.runNow();
    expect(out?.status).toBe("success");
    expect(gh.headSha()).not.toBeNull();
    const st = await svc.getStatus();
    expect(st.lastSuccessAt).toBe(T0);
    expect(st.nextDueAt).toBe(T0 + DAY);
    expect(st.history.map((h) => h.status)).toEqual(["success"]);
    expect(st.alert).toBeNull();
  });
  it("muestra el último éxito, el próximo plazo y el historial (más reciente primero)", async () => {
    await connect(); await svc.setFrequency(2);
    await svc.runNow();
    clock.advance(3 * DAY);
    await pages.create({ title: "Otra" });
    await svc.runNow();
    gh.offline = true;
    clock.advance(DAY);
    await svc.runNow();
    const st = await svc.getStatus();
    expect(st.history.map((h) => h.status)).toEqual(["failed", "success", "success"]);
    expect(st.lastSuccessAt).toBe(T0 + 3 * DAY);
    expect(st.nextDueAt).toBeNull(); // hay un reintento pendiente: se informa por separado
    expect(st.retryAt).not.toBeNull();
  });
  it("antes de conectar no hay próximo plazo ni respaldo posible, y runNow no lanza", async () => {
    const st = await svc.getStatus();
    expect(st).toMatchObject({ lastSuccessAt: null, nextDueAt: null, enabled: false, connected: false });
    const out = await svc.runNow();
    expect(out).toMatchObject({ status: "failed", error: { kind: "UNKNOWN" } });
  });
  it("el historial se limita a las últimas 20 ejecuciones", async () => {
    await connect();
    for (let i = 0; i < 25; i++) { clock.advance(MIN); await pages.create({ title: `p${i}` }); await svc.runNow(); }
    expect((await svc.getStatus()).history).toHaveLength(20);
  });
  it("tick() ejecuta el respaldo cuando vence y no antes", async () => {
    await connect();
    await svc.tick();
    expect(gh.headSha()).not.toBeNull();
    const head = gh.headSha();
    clock.advance(DAY - MIN);
    await pages.create({ title: "x" });
    await svc.tick();
    expect(gh.headSha()).toBe(head);
    clock.advance(MIN);
    await svc.tick();
    expect(gh.headSha()).not.toBe(head);
  });
});

describe("avisos de fallo (T-209, T-210)", () => {
  it.each([
    ["OFFLINE", () => { gh.offline = true; }, true],
    ["AUTH", () => { gh.token = "caducado"; }, false],
    ["REPO_NOT_FOUND", () => gh.inject({ match: /./, status: 404, body: { message: "Not Found" }, times: 99 }), false],
    ["NO_PERMISSION", () => gh.inject({ match: /./, status: 403, body: { message: "Resource not accessible" }, times: 99 }), false],
    ["RATE_LIMIT", () => gh.inject({ match: /./, status: 403, body: { message: "API rate limit exceeded" }, headers: { "x-ratelimit-remaining": "0" }, times: 99 }), true],
  ])("%s: aviso visible con la causa", async (kind, setup, retryable) => {
    await connect();
    const realToken = gh.token;
    setup();
    await svc.runNow();
    const alert = (await svc.getStatus()).alert;
    expect(alert).toMatchObject({ type: "failed", kind, retryable });
    expect(alert && "message" in alert && alert.message.length).toBeGreaterThan(0);
    expect(JSON.stringify(alert)).not.toContain(realToken);
  });
  it("repositorio lleno: el aviso incluye sugerencias para resolverlo (RF-16)", async () => {
    await connect();
    gh.maxRepoBytes = 1;
    await svc.runNow();
    const alert = (await svc.getStatus()).alert;
    expect(alert).toMatchObject({ type: "failed", kind: "REPO_FULL" });
    expect(alert && "suggestions" in alert && alert.suggestions).toEqual(["USE_OTHER_REPO", "REMOVE_HEAVY_ATTACHMENTS"]);
  });
  it("reintentar tras arreglar el problema limpia el aviso", async () => {
    await connect();
    gh.offline = true;
    await svc.runNow();
    expect((await svc.getStatus()).alert).not.toBeNull();
    gh.offline = false;
    await svc.runNow();
    expect((await svc.getStatus()).alert).toBeNull();
  });
  it("el aviso sobrevive a reiniciar la aplicación (se deduce del historial)", async () => {
    await connect();
    gh.offline = true;
    await svc.runNow();
    const again = new BackupService({ store: db, assets, clock, workspace: { id: "ws", name: "n" }, tokens, fetch: gh.fetch });
    expect((await again.getStatus()).alert).toMatchObject({ type: "failed", kind: "OFFLINE" });
  });
  it("un fallo no modifica las notas", async () => {
    await connect();
    const before = JSON.stringify(await db.query("SELECT * FROM pages ORDER BY id"));
    gh.offline = true;
    await svc.runNow();
    expect(JSON.stringify(await db.query("SELECT * FROM pages ORDER BY id"))).toBe(before);
  });
});

describe("cambio externo (T-211, CL-18)", () => {
  it("avisa que la rama cambió y espera la decisión sin subir nada", async () => {
    await connect(); await svc.runNow();
    const external = await gh.externalCommit({ "otro.txt": "alguien" });
    await pages.create({ title: "Nueva" });
    await svc.runNow();
    expect((await svc.getStatus()).alert).toEqual({ type: "needs_decision", remoteHead: external });
    expect(gh.headSha()).toBe(external);
  });
  it("continuar: el respaldo va encima del cambio externo y el aviso desaparece", async () => {
    await connect(); await svc.runNow();
    const external = await gh.externalCommit({ "otro.txt": "alguien" });
    await pages.create({ title: "Nueva" });
    await svc.runNow();
    await svc.resolveExternalChange("continue");
    expect(gh.commits.get(gh.headSha()!)!.parents).toEqual([external]);
    expect((await svc.getStatus()).alert).toBeNull();
  });
  it("cancelar: no sube nada, oculta el aviso y no insiste en cada tic", async () => {
    await connect(); await svc.runNow();
    const external = await gh.externalCommit({ "otro.txt": "alguien" });
    await pages.create({ title: "Nueva" });
    await svc.runNow();
    await svc.resolveExternalChange("cancel");
    clock.advance(5 * DAY);
    await svc.tick();
    expect(gh.headSha()).toBe(external);
    expect((await svc.getStatus()).alert).toBeNull();
  });
});

describe("suscripciones", () => {
  it("avisa a los suscriptores cuando termina un respaldo y deja de hacerlo al cancelar", async () => {
    await connect();
    let n = 0;
    const off = svc.subscribe(() => n++);
    await svc.runNow();
    expect(n).toBeGreaterThan(0);
    off();
    const m = n;
    await pages.create({ title: "x" });
    await svc.runNow();
    expect(n).toBe(m);
  });
});

describe("respaldo con worker (T-190)", () => {
  it("«Respaldar ahora» delega el trabajo pesado en el worker y obtiene el mismo resultado", async () => {
    const { port1, port2 } = new MessageChannel();
    serveBackup(port1 as never, { fetch: gh.fetch });
    const withWorker = new BackupService({ store: db, assets, clock, workspace: { id: "ws", name: "Personal" }, tokens, fetch: gh.fetch, worker: new BackupWorkerClient(port2 as never) });
    await withWorker.connect({ token: gh.token, owner: "yo", repo: "respaldo" });
    const before = gh.requests.length;
    const out = await withWorker.runNow();
    expect(out?.status).toBe("success");
    expect(gh.headSha()).not.toBeNull();
    expect(gh.requests.length).toBeGreaterThan(before);
    expect((await withWorker.getStatus()).history[0]?.status).toBe("success");
    port1.close(); port2.close();
  });
});
