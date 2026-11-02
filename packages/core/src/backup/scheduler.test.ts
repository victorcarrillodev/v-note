// T-194, T-195, T-196, T-198 (prueba primero): plazos, respaldo al abrir, reintentos y disparo desde el tic.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { FakeGithub } from "../../tests/support/fakeGithub";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { FakeClock } from "../clock";
import { MemoryAssetStore } from "../assets/memoryAssetStore";
import { PageService } from "../pages/pageService";
import { GitHubClient, type BackupError } from "./githubClient";
import { runBackup, type BackupOutcome } from "./runBackup";
import { BackupScheduler, nextDueAt, validateFrequency, RETRY_DELAYS_MIN, type BackupEvent } from "./scheduler";
import type { SqlStore } from "../ports/sqlStore";

const MIN = 60_000, DAY = 86_400_000;
let db: SqlStore;
let clock: FakeClock;
beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  clock = new FakeClock(100 * DAY);
});
const fail = (kind: BackupError["kind"], retryable = true, retryAt?: number): BackupOutcome => ({ status: "failed", error: { kind, message: kind, retryable, ...(retryAt ? { retryAt } : {}) } });
const ok: BackupOutcome = { status: "success", commit: "c1", uploaded: 1, removed: 0, pagesChanged: 1, skipped: [] };
function make(results: BackupOutcome[] | (() => BackupOutcome)) {
  const events: BackupEvent[] = [];
  const run = vi.fn(async () => (typeof results === "function" ? results() : (results.shift() ?? ok)));
  const sched = new BackupScheduler({ store: db, clock, run, onEvent: (e) => events.push(e) });
  return { sched, run, events };
}

describe("plazo (T-194)", () => {
  it("nextDueAt = último éxito + frecuencia; sin éxito previo vence ya", () => {
    expect(nextDueAt(null, 1)).toBe(0);
    expect(nextDueAt(1000, 1)).toBe(1000 + DAY);
    expect(nextDueAt(1000, 3)).toBe(1000 + 3 * DAY);
    expect(nextDueAt(1000, 7)).toBe(1000 + 7 * DAY);
  });
  it("la frecuencia admitida es un entero de 1 a 7 días", () => {
    for (const ok of [1, 2, 3, 7]) expect(validateFrequency(ok).ok).toBe(true);
    for (const bad of [0, 8, 1.5, -1, NaN]) expect(validateFrequency(bad).ok).toBe(false);
  });
  it("por defecto el respaldo está desactivado y con frecuencia diaria", async () => {
    const { sched, run } = make([]);
    expect(await sched.getConfig()).toEqual({ enabled: false, frequencyDays: 1 });
    await sched.onTick();
    expect(run).not.toHaveBeenCalled();
  });
  it("rechaza frecuencias inválidas sin cambiar la configuración", async () => {
    const { sched } = make([]);
    expect((await sched.configure({ enabled: true, frequencyDays: 9 })).ok).toBe(false);
    expect((await sched.getConfig()).frequencyDays).toBe(1);
  });
  it.each([[1], [3], [7]])("con frecuencia de %i días no se ejecuta antes del plazo y sí cuando llega", async (days) => {
    const { sched, run } = make([]);
    await sched.configure({ enabled: true, frequencyDays: days });
    await sched.onTick(); // el primero: nunca hubo respaldo
    expect(run).toHaveBeenCalledTimes(1);
    clock.advance(days * DAY - MIN);
    await sched.onTick();
    expect(run).toHaveBeenCalledTimes(1);
    clock.advance(MIN);
    await sched.onTick();
    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe("respaldo al abrir, una sola vez (T-195, CL-19)", () => {
  it("tres plazos vencidos producen un solo respaldo", async () => {
    const { sched, run } = make([]);
    await sched.configure({ enabled: true, frequencyDays: 1 });
    await sched.onTick();
    run.mockClear();
    clock.advance(3 * DAY + 5 * MIN); // la app estuvo cerrada tres días
    await sched.onTick();
    await sched.onTick();
    await sched.onTick();
    expect(run).toHaveBeenCalledTimes(1);
  });
  it("sobrevive a reiniciar la aplicación (el estado vive en la base)", async () => {
    const a = make([]);
    await a.sched.configure({ enabled: true, frequencyDays: 2 });
    await a.sched.onTick();
    const b = make([]); // nueva instancia, misma base: simula reabrir la app
    clock.advance(DAY);
    await b.sched.onTick();
    expect(b.run).not.toHaveBeenCalled(); // aún no vence
    clock.advance(DAY);
    await b.sched.onTick();
    expect(b.run).toHaveBeenCalledTimes(1);
  });
  it("no ejecuta dos respaldos a la vez aunque lleguen dos tics seguidos", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const events: BackupEvent[] = [];
    const run = vi.fn(async () => { await gate; return ok; });
    const sched = new BackupScheduler({ store: db, clock, run, onEvent: (e) => events.push(e) });
    await sched.configure({ enabled: true, frequencyDays: 1 });
    const first = sched.onTick();
    await Promise.resolve();
    expect(await sched.onTick()).toBeNull();
    release();
    await first;
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe("reintentos (T-196, RF-16)", () => {
  it("usa esperas de 1, 5, 15 y 60 minutos y después da el aviso final", async () => {
    expect(RETRY_DELAYS_MIN).toEqual([1, 5, 15, 60]);
    const { sched, run, events } = make(() => fail("OFFLINE"));
    await sched.configure({ enabled: true, frequencyDays: 1 });
    const times: number[] = [];
    await sched.onTick(); times.push(clock.now());
    for (const delay of RETRY_DELAYS_MIN) {
      clock.advance(delay * MIN - 1);
      await sched.onTick();
      expect(run).toHaveBeenCalledTimes(times.length); // todavía no
      clock.advance(1);
      await sched.onTick(); times.push(clock.now());
    }
    expect(run).toHaveBeenCalledTimes(5);
    expect(events.map((e) => e.type)).toEqual(["failed_will_retry", "failed_will_retry", "failed_will_retry", "failed_will_retry", "failed_final"]);
    expect(events.at(-1)).toMatchObject({ type: "failed_final", error: { kind: "OFFLINE" } });
  });
  it("tras el aviso final no insiste hasta el siguiente plazo", async () => {
    const { sched, run } = make(() => fail("OFFLINE"));
    await sched.configure({ enabled: true, frequencyDays: 1 });
    await sched.onTick();
    for (const d of RETRY_DELAYS_MIN) { clock.advance(d * MIN); await sched.onTick(); }
    run.mockClear();
    clock.advance(DAY - 80 * MIN);
    await sched.onTick();
    expect(run).not.toHaveBeenCalled();
    clock.advance(2 * 60 * MIN);
    await sched.onTick();
    expect(run).toHaveBeenCalledTimes(1);
  });
  it("un error que no se arregla solo (credenciales) avisa de inmediato y no reintenta", async () => {
    const { sched, run, events } = make(() => fail("AUTH", false));
    await sched.configure({ enabled: true, frequencyDays: 1 });
    await sched.onTick();
    clock.advance(2 * 60 * MIN);
    await sched.onTick();
    expect(run).toHaveBeenCalledTimes(1);
    expect(events.map((e) => e.type)).toEqual(["failed_final"]);
  });
  it("si GitHub indica cuándo se restablece el límite, espera hasta entonces", async () => {
    const resetAt = clock.now() + 30 * MIN;
    const { sched, run } = make([fail("RATE_LIMIT", true, resetAt), ok]);
    await sched.configure({ enabled: true, frequencyDays: 1 });
    await sched.onTick();
    clock.advance(10 * MIN); await sched.onTick();
    expect(run).toHaveBeenCalledTimes(1);
    clock.advance(20 * MIN); await sched.onTick();
    expect(run).toHaveBeenCalledTimes(2);
  });
  it("un éxito tras reintentar reinicia el contador y deja el último respaldo exitoso", async () => {
    const { sched, events } = make([fail("OFFLINE"), ok]);
    await sched.configure({ enabled: true, frequencyDays: 1 });
    await sched.onTick();
    clock.advance(MIN); await sched.onTick();
    expect(events.map((e) => e.type)).toEqual(["failed_will_retry", "success"]);
    expect(await sched.getState()).toMatchObject({ lastSuccessAt: clock.now(), attempts: 0, retryAt: null });
  });
  it("«Respaldar ahora» ignora el plazo y el reintento pendiente, y se reinicia al lograrlo", async () => {
    const { sched, run } = make([fail("OFFLINE"), ok]);
    await sched.configure({ enabled: true, frequencyDays: 7 });
    await sched.onTick();
    expect((await sched.runNow())?.status).toBe("success");
    expect(run).toHaveBeenCalledTimes(2);
    expect(await sched.getState()).toMatchObject({ attempts: 0, retryAt: null });
  });
  it("puede lanzarse manualmente aunque el respaldo automático esté desactivado", async () => {
    const { sched, run } = make([]);
    await sched.runNow();
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe("decisión por cambio externo", () => {
  it("avisa, no reintenta y espera a que la persona decida", async () => {
    const { sched, run, events } = make([{ status: "needs_decision", remoteHead: "abc", lastKnown: "xyz" }, ok]);
    await sched.configure({ enabled: true, frequencyDays: 1 });
    await sched.onTick();
    clock.advance(5 * DAY);
    await sched.onTick();
    expect(run).toHaveBeenCalledTimes(1); // pausado
    expect(events.map((e) => e.type)).toEqual(["needs_decision"]);
    await sched.runNow({ onExternalChange: "continue" });
    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenLastCalledWith({ onExternalChange: "continue" });
  });
});

describe("disparo desde el tic con el respaldo real (T-198)", () => {
  it("tres días de tics de un minuto producen un respaldo por día", async () => {
    const gh = new FakeGithub();
    const client = new GitHubClient({ fetch: gh.fetch, token: gh.token, owner: "yo", repo: "r" });
    const svc = new PageService(db, clock);
    await svc.create({ title: "Uno" });
    const sched = new BackupScheduler({
      store: db, clock,
      run: (o) => runBackup({ store: db, assets: new MemoryAssetStore(), client, clock, workspace: { id: "w", name: "n" } }, o),
      onEvent: () => {},
    });
    await sched.configure({ enabled: true, frequencyDays: 1 });
    let commits = 0;
    for (let m = 0; m < 3 * 24 * 60; m++) {
      if (m % (12 * 60) === 0) await svc.create({ title: `p${m}` }); // hay cambios cada 12 h
      const before = gh.headSha();
      await sched.onTick();
      if (gh.headSha() !== before) commits++;
      clock.advance(MIN);
    }
    expect(commits).toBe(3);
  }, 120_000);
});
