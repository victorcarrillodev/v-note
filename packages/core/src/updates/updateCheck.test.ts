// T-166 (prueba primero): aviso de versión nueva. Una consulta anónima a GitHub Releases; sin datos del usuario (RNF-5).
import { describe, it, expect } from "vitest";
import { compareVersions, checkForUpdate, type UpdateFetch } from "./updateCheck";

const release = (tag: string, extra: Record<string, unknown> = {}) => ({ tag_name: tag, html_url: `https://github.com/yo/notas-app/releases/tag/${tag}`, draft: false, prerelease: false, ...extra });
const fetchOf = (status: number, body: unknown, seen: string[] = []): UpdateFetch => async (url) => {
  seen.push(url);
  return { status, json: async () => body };
};

describe("compareVersions", () => {
  it.each([
    ["0.0.2", "0.0.1", 1], ["0.1.0", "0.0.9", 1], ["1.0.0", "0.9.9", 1], ["0.0.1", "0.0.1", 0],
    ["0.0.1", "0.0.2", -1], ["0.10.0", "0.9.0", 1], ["v1.2.3", "1.2.3", 0], ["1.2", "1.2.0", 0], ["1.0.0", "1.0.0-beta.1", 1],
  ])("%s vs %s = %i", (a, b, r) => expect(compareVersions(a, b)).toBe(r));
  it("una versión ilegible no se considera mayor ni menor", () => {
    expect(compareVersions("abc", "0.0.1")).toBe(0);
    expect(compareVersions("0.0.1", "")).toBe(0);
  });
});

describe("checkForUpdate", () => {
  it("una versión remota mayor muestra el aviso con la página de descarga", async () => {
    const r = await checkForUpdate({ fetch: fetchOf(200, release("v0.2.0")), repo: "yo/notas-app", current: "0.0.1" });
    expect(r).toEqual({ ok: true, value: { available: true, version: "0.2.0", url: "https://github.com/yo/notas-app/releases/tag/v0.2.0" } });
  });
  it("la misma versión o una menor no avisa", async () => {
    expect(await checkForUpdate({ fetch: fetchOf(200, release("v0.0.1")), repo: "yo/notas-app", current: "0.0.1" })).toEqual({ ok: true, value: { available: false } });
    expect(await checkForUpdate({ fetch: fetchOf(200, release("v0.0.1")), repo: "yo/notas-app", current: "0.3.0" })).toEqual({ ok: true, value: { available: false } });
  });
  it("ignora borradores y prelanzamientos", async () => {
    expect((await checkForUpdate({ fetch: fetchOf(200, release("v9.0.0", { prerelease: true })), repo: "yo/notas-app", current: "0.0.1" }))).toEqual({ ok: true, value: { available: false } });
    expect((await checkForUpdate({ fetch: fetchOf(200, release("v9.0.0", { draft: true })), repo: "yo/notas-app", current: "0.0.1" }))).toEqual({ ok: true, value: { available: false } });
  });
  it("consulta solo api.github.com y no envía credenciales ni datos", async () => {
    const seen: string[] = [];
    let headers: unknown;
    const f: UpdateFetch = async (url, init) => { seen.push(url); headers = init?.headers; return { status: 200, json: async () => release("v0.0.1") }; };
    await checkForUpdate({ fetch: f, repo: "yo/notas-app", current: "0.0.1" });
    expect(seen).toEqual(["https://api.github.com/repos/yo/notas-app/releases/latest"]);
    expect(JSON.stringify(headers ?? {}).toLowerCase()).not.toContain("authorization");
  });
  it("sin repositorio configurado no consulta nada", async () => {
    const seen: string[] = [];
    const r = await checkForUpdate({ fetch: fetchOf(200, release("v9.0.0"), seen), repo: "", current: "0.0.1" });
    expect(r).toEqual({ ok: true, value: { available: false } });
    expect(seen).toEqual([]);
  });
  it("rechaza un repositorio con formato inválido sin consultar", async () => {
    const seen: string[] = [];
    const r = await checkForUpdate({ fetch: fetchOf(200, release("v9.0.0"), seen), repo: "../x?y=1", current: "0.0.1" });
    expect(r.ok).toBe(false);
    expect(seen).toEqual([]);
  });
  it("sin red o con error del servidor devuelve error controlado (nunca lanza)", async () => {
    const boom: UpdateFetch = async () => { throw new Error("offline"); };
    expect((await checkForUpdate({ fetch: boom, repo: "yo/notas-app", current: "0.0.1" })).ok).toBe(false);
    expect((await checkForUpdate({ fetch: fetchOf(500, {}), repo: "yo/notas-app", current: "0.0.1" })).ok).toBe(false);
    expect((await checkForUpdate({ fetch: fetchOf(404, {}), repo: "yo/notas-app", current: "0.0.1" })).ok).toBe(false);
  });
  it("una respuesta sin forma esperada no produce aviso", async () => {
    expect(await checkForUpdate({ fetch: fetchOf(200, { foo: 1 }), repo: "yo/notas-app", current: "0.0.1" })).toEqual({ ok: true, value: { available: false } });
  });
  it("solo acepta direcciones de descarga https de github.com", async () => {
    const r = await checkForUpdate({ fetch: fetchOf(200, release("v1.0.0", { html_url: "javascript:alert(1)" })), repo: "yo/notas-app", current: "0.0.1" });
    expect(r).toEqual({ ok: true, value: { available: false } });
  });
});
