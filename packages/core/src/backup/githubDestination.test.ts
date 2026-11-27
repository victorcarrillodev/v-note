import { describe, it, expect } from "vitest";
import { FakeGithub } from "../../tests/support/fakeGithub";
import { syncWithDestination } from "./destination";
import { GitHubDestination } from "./githubDestination";

const enc = new TextEncoder();
const mk = (gh: FakeGithub) =>
  new GitHubDestination({ fetch: gh.fetch, token: gh.token, owner: "o", repo: "r" });

describe("GitHubDestination", () => {
  it("sube solo lo cambiado en un único commit, no crea commits si no hay cambios y descarga todo", async () => {
    const gh = new FakeGithub();
    const dest = mk(gh);
    const v1 = new Map([["app/workspaces.json", enc.encode("{}")], ["workspaces/1/a.md", enc.encode("v1")]]);
    expect((await syncWithDestination(dest, v1, 100)).status).toBe("success");
    const head1 = gh.headSha();
    expect(head1).not.toBeNull();

    expect((await syncWithDestination(dest, v1, 200)).status).toBe("unchanged");
    expect(gh.headSha()).toBe(head1);

    const v2 = new Map([["app/workspaces.json", enc.encode("{}")], ["workspaces/1/a.md", enc.encode("v2")]]);
    expect((await syncWithDestination(dest, v2, 300)).status).toBe("success");
    expect(gh.commits.size).toBe(2);

    const v3 = new Map([["app/workspaces.json", enc.encode("{}")]]);
    expect((await syncWithDestination(dest, v3, 400)).status).toBe("success");
    const dl = await dest.downloadAll();
    expect(dl.ok).toBe(true);
    if (dl.ok) expect([...dl.value.keys()].sort()).toEqual(["app/workspaces.json"]);
  });

  it("checkConnection falla con AUTH si el token es inválido", async () => {
    const gh = new FakeGithub();
    const dest = new GitHubDestination({ fetch: gh.fetch, token: "ghp_mal", owner: "o", repo: "r" });
    const r = await dest.checkConnection();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("AUTH");
  });

  it("si la rama se movió por fuera, falla con REF_CONFLICT y no pierde nada", async () => {
    const gh = new FakeGithub();
    const dest = mk(gh);
    const v1 = new Map([["a.md", enc.encode("1")]]);
    expect((await syncWithDestination(dest, v1, 1)).status).toBe("success");
    gh.inject({ match: /^PATCH .*\/git\/refs\//, status: 422, body: { message: "Update is not a fast forward" } });
    const head = gh.headSha();
    const r = await syncWithDestination(dest, new Map([["a.md", enc.encode("2")]]), 2);
    expect(r.status).toBe("failed");
    if (r.status === "failed") { expect(r.error.kind).toBe("REF_CONFLICT"); expect(r.error.retryable).toBe(true); }
    expect(gh.headSha()).toBe(head);
  });

  it("un token sin permiso de escritura se rechaza en checkConnection", async () => {
    const gh = new FakeGithub();
    gh.canPush = false;
    const r = await mk(gh).checkConnection();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("NO_PERMISSION");
  });
});
