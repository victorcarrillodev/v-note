import { describe, it, expect } from "vitest";
import { MemoryKeychain } from "./tokenStore";
import {
  OAUTH_PROVIDERS,
  OAuthTokenStore,
  buildAuthorizationUrl,
  connectOAuth,
  exchangeCode,
  generatePkce,
  parseRedirect,
} from "./oauthPkce";

const sha256b64url = async (s: string) => {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return btoa(String.fromCharCode(...new Uint8Array(d))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const jsonRes = (status: number, body: unknown) => ({ status, headers: { get: () => null }, json: async () => body, text: async () => JSON.stringify(body) });

describe("PKCE", () => {
  it("genera un verifier válido y un challenge S256 que coincide", async () => {
    const { verifier, challenge } = await generatePkce();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(challenge).toBe(await sha256b64url(verifier));
  });

  it("arma la URL de autorización de Google y de Dropbox con S256, state y acceso offline", () => {
    const g = new URL(buildAuthorizationUrl({ provider: "google-drive", clientId: "cid", redirectUri: "http://127.0.0.1:5000/cb", challenge: "ch", state: "st" }));
    expect(g.origin + g.pathname).toBe(OAUTH_PROVIDERS["google-drive"].authUrl);
    expect(g.searchParams.get("code_challenge_method")).toBe("S256");
    expect(g.searchParams.get("code_challenge")).toBe("ch");
    expect(g.searchParams.get("state")).toBe("st");
    expect(g.searchParams.get("access_type")).toBe("offline");
    expect(g.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/drive.file");
    const d = new URL(buildAuthorizationUrl({ provider: "dropbox", clientId: "cid", redirectUri: "http://127.0.0.1:5000/cb", challenge: "ch", state: "st" }));
    expect(d.searchParams.get("token_access_type")).toBe("offline");
    expect(d.searchParams.get("response_type")).toBe("code");
  });

  it("parseRedirect acepta el code con el state correcto y rechaza state ajeno o errores", () => {
    expect(parseRedirect("http://127.0.0.1:5000/cb?code=abc&state=st", "st")).toEqual({ ok: true, code: "abc" });
    expect(parseRedirect("http://127.0.0.1:5000/cb?code=abc&state=otro", "st").ok).toBe(false);
    expect(parseRedirect("http://127.0.0.1:5000/cb?error=access_denied&state=st", "st").ok).toBe(false);
  });

  it("exchangeCode envía verifier y client_id sin secreto y devuelve los tokens", async () => {
    let body = "";
    const f = async (_u: string, init?: { body?: string }) => { body = String(init?.body); return jsonRes(200, { access_token: "A", refresh_token: "R", expires_in: 3600 }); };
    const r = await exchangeCode({ fetch: f as never, provider: "dropbox", clientId: "cid", redirectUri: "http://127.0.0.1:5000/cb", code: "abc", verifier: "ver" });
    expect(r).toEqual({ ok: true, accessToken: "A", refreshToken: "R", expiresIn: 3600 });
    const p = new URLSearchParams(body);
    expect(p.get("code_verifier")).toBe("ver");
    expect(p.get("grant_type")).toBe("authorization_code");
    expect(p.has("client_secret")).toBe(false);
  });
});

describe("OAuthTokenStore", () => {
  it("renueva el access token con el refresh guardado en el llavero y lo reutiliza hasta que caduca", async () => {
    const kc = new MemoryKeychain();
    let now = 0;
    let refreshes = 0;
    const f = async () => { refreshes++; return jsonRes(200, { access_token: `A${refreshes}`, expires_in: 3600 }); };
    const store = new OAuthTokenStore({ keychain: kc, fetch: f as never, provider: "google-drive", clientId: "cid", now: () => now });
    await store.saveRefreshToken("R");
    expect(await kc.get("oauth:google-drive")).toBe("R");
    expect(await store.getAccessToken()).toBe("A1");
    expect(await store.getAccessToken()).toBe("A1");
    now = 3_600_000;
    expect(await store.getAccessToken()).toBe("A2");
    await store.clear();
    expect(await store.getAccessToken()).toBeNull();
  });
});

describe("connectOAuth", () => {
  it("prepara el puerto, valida el state, intercambia el código y guarda el refresh en el llavero", async () => {
    const kc = new MemoryKeychain();
    let prepared = false;
    const port = {
      get redirectUri() { return prepared ? "http://127.0.0.1:4567/cb" : "http://127.0.0.1:0/cb"; },
      prepare: async () => { prepared = true; },
      authorize: async (url: string) => `http://127.0.0.1:4567/cb?code=abc&state=${new URL(url).searchParams.get("state")}`,
    };
    const f = async () => jsonRes(200, { access_token: "A", refresh_token: "R", expires_in: 3600 });
    const r = await connectOAuth({ port, fetch: f as never, provider: "dropbox", clientId: "cid", keychain: kc });
    expect(r).toEqual({ ok: true });
    expect(prepared).toBe(true);
    expect(await kc.get("oauth:dropbox")).toBe("R");
  });
  it("si la redirección trae otro state no guarda nada", async () => {
    const kc = new MemoryKeychain();
    const port = { redirectUri: "http://127.0.0.1:1/cb", authorize: async () => "http://127.0.0.1:1/cb?code=abc&state=falso" };
    const r = await connectOAuth({ port, fetch: (async () => jsonRes(200, {})) as never, provider: "dropbox", clientId: "cid", keychain: kc });
    expect(r.ok).toBe(false);
    expect(await kc.get("oauth:dropbox")).toBeNull();
  });

  it("un fallo transitorio al renovar (red caída o 5xx) lanza para reintentar; un token revocado devuelve null", async () => {
    const mk = (f: unknown) => new OAuthTokenStore({ keychain: kc, fetch: f as never, provider: "dropbox", clientId: "cid" });
    const kc = new MemoryKeychain();
    await kc.set("oauth:dropbox", "R");
    await expect(mk(async () => { throw new TypeError("Failed to fetch"); }).getAccessToken()).rejects.toThrow();
    await expect(mk(async () => jsonRes(503, {})).getAccessToken()).rejects.toThrow();
    expect(await mk(async () => jsonRes(400, { error: "invalid_grant" })).getAccessToken()).toBeNull();
  });
});
