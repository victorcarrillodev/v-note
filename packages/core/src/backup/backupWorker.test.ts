// T-190 (prueba primero): el respaldo completo corre detrás de un puerto de mensajes (un Worker en producción) y se puede cancelar.
import { describe, it, expect, beforeEach } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { FakeGithub } from "../../tests/support/fakeGithub";
import { para, updateFor } from "../../tests/support/builders";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { FakeClock } from "../clock";
import { MemoryAssetStore } from "../assets/memoryAssetStore";
import { PageService } from "../pages/pageService";
import { GitHubClient } from "./githubClient";
import { runBackup } from "./runBackup";
import { serveBackup, BackupWorkerClient, runBackupInWorker } from "./backupWorker";
import type { SqlStore } from "../ports/sqlStore";

let db: SqlStore;
let gh: FakeGithub;
let assets: MemoryAssetStore;
let clock: FakeClock;
let svc: PageService;
const T0 = Date.UTC(2026, 9, 30, 14, 0);
beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  gh = new FakeGithub();
  assets = new MemoryAssetStore();
  clock = new FakeClock(T0);
  svc = new PageService(db, clock);
});
async function page(title: string, body: string) {
  const p = await svc.create({ title, parentId: null });
  if (!p.ok) throw new Error("x");
  await svc.saveUpdate(p.value.id, updateFor([para(body)]));
  return p.value;
}
/** Un par de puertos en memoria, como los de un Worker real: los mensajes se clonan y llegan de forma asíncrona. */
function pair() {
  const { port1, port2 } = new MessageChannel();
  serveBackup(port1 as never, { fetch: gh.fetch });
  const client = new BackupWorkerClient(port2 as never);
  return { client, close: () => { port1.close(); port2.close(); } };
}
const flatHead = (g: FakeGithub) => [...g.trees.get(g.commits.get(g.headSha()!)!.tree)!.entries()].sort();
const conn = () => ({ token: gh.token, owner: "yo", repo: "r" });
const deps = (client: BackupWorkerClient) => ({ store: db, assets, clock, workspace: { id: "ws", name: "Personal" }, worker: client, connection: conn() });

describe("respaldo completo en un worker (T-190)", () => {
  it("respalda un espacio de ejemplo y deja el commit y el historial", async () => {
    await page("Uno", "hola");
    await page("Dos", "mundo");
    const { client, close } = pair();
    const out = await runBackupInWorker(deps(client));
    expect(out.status).toBe("success");
    const runs = await db.query<{ status: string; commit_sha: string }>("SELECT status, commit_sha FROM backup_runs");
    expect(runs).toHaveLength(1);
    expect(runs[0]!.status).toBe("success");
    expect(runs[0]!.commit_sha).toBe(gh.headSha());
    close();
  });

  it("produce exactamente el mismo árbol que el respaldo en el hilo principal", async () => {
    await page("Uno", "hola");
    const { client, close } = pair();
    await runBackupInWorker(deps(client));
    const viaWorker = flatHead(gh);

    const gh2 = new FakeGithub();
    await runBackup({ store: db, assets, client: new GitHubClient({ fetch: gh2.fetch, token: gh2.token, owner: "yo", repo: "r" }), clock, workspace: { id: "ws", name: "Personal" } });
    expect(viaWorker).toEqual(flatHead(gh2));
    close();
  });

  it("un segundo respaldo sin cambios no crea commit", async () => {
    await page("Uno", "hola");
    const { client, close } = pair();
    await runBackupInWorker(deps(client));
    const head = gh.headSha();
    const second = await runBackupInWorker(deps(client));
    expect(second.status).toBe("unchanged");
    expect(gh.headSha()).toBe(head);
    close();
  });

  it("cancelar antes de empezar devuelve «cancelado» y no toca el servidor", async () => {
    await page("Uno", "hola");
    const { client, close } = pair();
    const ac = new AbortController();
    ac.abort();
    const out = await runBackupInWorker(deps(client), { signal: ac.signal });
    expect(out.status).toBe("cancelled");
    expect(gh.headSha()).toBeNull();
    close();
  });

  it("un fallo del servidor llega como «failed» sin modificar los datos locales", async () => {
    await page("Uno", "hola");
    gh.inject({ match: /GET .*\/git\/ref\/heads\/main$/, status: 401, body: { message: "Bad credentials" } });
    const before = await db.query("SELECT id, title FROM pages ORDER BY id");
    const { client, close } = pair();
    const out = await runBackupInWorker(deps(client));
    expect(out.status).toBe("failed");
    expect(await db.query("SELECT id, title FROM pages ORDER BY id")).toEqual(before);
    close();
  });

  it("el token solo viaja al worker en memoria: no queda en la base", async () => {
    await page("Uno", "hola");
    const { client, close } = pair();
    await runBackupInWorker(deps(client));
    const dump = JSON.stringify(await db.query("SELECT * FROM backup_runs")) + JSON.stringify(await db.query("SELECT * FROM meta"));
    expect(dump).not.toContain(gh.token);
    close();
  });
});
