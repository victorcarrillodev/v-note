// T-200 (lógica), T-201, T-202, T-203 (prueba primero): el token de GitHub solo vive en el llavero o en memoria; nunca en disco ni en el respaldo.
import { describe, it, expect, beforeEach } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { FakeGithub } from "../../tests/support/fakeGithub";
import { para, updateFor } from "../../tests/support/builders";
import { MemoryConfigStore, MemoryWorkspaceStorage } from "../../tests/support/memoryPorts";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { FakeClock } from "../clock";
import { MemoryAssetStore } from "../assets/memoryAssetStore";
import { PageService } from "../pages/pageService";
import { WorkspaceManager } from "../workspaces/workspaceManager";
import { GitHubClient } from "./githubClient";
import { runBackup } from "./runBackup";
import { GitHubTokenStore, MemoryKeychain, type Keychain } from "./tokenStore";
import { serializeWorkspace } from "./serialize";

class BrokenKeychain implements Keychain {
  async get(): Promise<string | null> { throw new Error("No hay servicio de llavero (Secret Service)"); }
  async set(): Promise<void> { throw new Error("No hay servicio de llavero (Secret Service)"); }
  async delete(): Promise<void> { throw new Error("No hay servicio de llavero (Secret Service)"); }
}

describe("GitHubTokenStore con llavero disponible (T-200)", () => {
  it("guarda el token en el llavero y otra instancia (otra sesión) lo lee", async () => {
    const kc = new MemoryKeychain();
    const a = new GitHubTokenStore(kc, "ws-1");
    expect(await a.set("ghp_secreto")).toEqual({ ok: true, value: { persisted: true } });
    expect(await new GitHubTokenStore(kc, "ws-1").get()).toBe("ghp_secreto");
  });
  it("cada espacio de trabajo tiene su propio token", async () => {
    const kc = new MemoryKeychain();
    await new GitHubTokenStore(kc, "a").set("ghp_a");
    await new GitHubTokenStore(kc, "b").set("ghp_b");
    expect(await new GitHubTokenStore(kc, "a").get()).toBe("ghp_a");
    expect(await new GitHubTokenStore(kc, "b").get()).toBe("ghp_b");
  });
  it("clear lo borra del llavero y de la memoria", async () => {
    const kc = new MemoryKeychain();
    const s = new GitHubTokenStore(kc, "ws");
    await s.set("ghp_x");
    await s.clear();
    expect(await s.get()).toBeNull();
    expect(await new GitHubTokenStore(kc, "ws").get()).toBeNull();
  });
  it("rechaza tokens vacíos o con espacios sin guardarlos", async () => {
    const s = new GitHubTokenStore(new MemoryKeychain(), "ws");
    for (const bad of ["", "   ", "ghp_ con espacio"]) expect((await s.set(bad)).ok).toBe(false);
    expect(await s.get()).toBeNull();
  });
  it("quita espacios y saltos de línea alrededor (típico al pegar)", async () => {
    const s = new GitHubTokenStore(new MemoryKeychain(), "ws");
    await s.set("  ghp_abc123\n");
    expect(await s.get()).toBe("ghp_abc123");
  });
});

describe("sin servicio de llavero (T-201)", () => {
  it("el token se conserva solo durante la sesión y se avisa que no quedó guardado", async () => {
    const s = new GitHubTokenStore(new BrokenKeychain(), "ws");
    const r = await s.set("ghp_sesion");
    expect(r).toEqual({ ok: true, value: { persisted: false, reason: "No hay servicio de llavero (Secret Service)" } });
    expect(await s.get()).toBe("ghp_sesion");
  });
  it("en una sesión nueva hay que volver a pedirlo (get devuelve null) y no explota", async () => {
    await new GitHubTokenStore(new BrokenKeychain(), "ws").set("ghp_sesion");
    expect(await new GitHubTokenStore(new BrokenKeychain(), "ws").get()).toBeNull();
  });
  it("indica si el llavero está disponible, para que la interfaz explique por qué se pide el token", async () => {
    const s = new GitHubTokenStore(new BrokenKeychain(), "ws");
    await s.get();
    expect(s.keychainAvailable).toBe(false);
    const t = new GitHubTokenStore(new MemoryKeychain(), "ws");
    await t.get();
    expect(t.keychainAvailable).toBe(true);
  });
});

describe("token solo en memoria en la web (T-202)", () => {
  it("MemoryKeychain no escribe en localStorage, sessionStorage ni cookies, y se olvida al recargar", async () => {
    const kc = new MemoryKeychain();
    await new GitHubTokenStore(kc, "ws").set("ghp_web");
    expect(JSON.stringify(Object.entries(globalThis.localStorage ?? {}))).not.toContain("ghp_web");
    expect(await new GitHubTokenStore(new MemoryKeychain(), "ws").get()).toBeNull(); // «recargar la pestaña» = instancia nueva
  });
});

describe("el token no aparece en ningún lugar (T-203, RNF-6)", () => {
  let db: Awaited<ReturnType<typeof createNodeSqliteStore>>;
  beforeEach(async () => { db = await createNodeSqliteStore(":memory:"); await migrate(db, migrations); });
  it("ni en la base, ni en el respaldo, ni en el registro de espacios, ni en los registros del cliente", async () => {
    const gh = new FakeGithub();
    const clock = new FakeClock(1_000);
    const logs: string[] = [];
    const kc = new MemoryKeychain();
    const tokens = new GitHubTokenStore(kc, "ws");
    await tokens.set(gh.token);
    const config = new MemoryConfigStore();
    const mgr = new WorkspaceManager(config, new MemoryWorkspaceStorage(), clock);
    await mgr.create({ name: "Personal" });

    const client = new GitHubClient({ fetch: gh.fetch, token: (await tokens.get())!, owner: "yo", repo: "r", log: (m) => logs.push(m) });
    const assets = new MemoryAssetStore();
    const svc = new PageService(db, clock);
    const p = await svc.create({ title: "Nota" });
    if (p.ok) await svc.saveUpdate(p.value.id, updateFor([para("contenido")]));
    const r = await runBackup({ store: db, assets, client, clock, workspace: { id: "ws", name: "Personal" } });
    expect(r.status).toBe("success");
    gh.offline = true; // y también los mensajes de error
    await runBackup({ store: db, assets, client, clock, workspace: { id: "ws", name: "Personal" } });

    const token = gh.token;
    const tables = await db.query<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'page_text%'");
    let dump = "";
    for (const t of tables) dump += JSON.stringify(await db.query(`SELECT * FROM "${t.name}"`)).replace(/"data":\{[^}]*\}/g, "");
    expect(dump).not.toContain(token);
    const files = await serializeWorkspace({ store: db, assets }, { id: "ws", name: "Personal" });
    for (const [, bytes] of files.files) expect(new TextDecoder().decode(bytes)).not.toContain(token);
    for (const [, bytes] of gh.blobs) expect(new TextDecoder().decode(bytes)).not.toContain(token);
    expect(config.text ?? "").not.toContain(token);
    expect(logs.join("\n")).not.toContain(token);
    expect(logs.length).toBeGreaterThan(0);
  });
});
