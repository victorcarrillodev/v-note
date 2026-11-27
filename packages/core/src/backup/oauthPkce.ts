import type { FetchLike } from "./githubClient";
import type { Keychain } from "./tokenStore";

export type OAuthProviderId = "google-drive" | "dropbox";

/** Puntos de acceso de cada proveedor. PKCE sin secreto de cliente: nada sensible viaja en la aplicación. */
export const OAUTH_PROVIDERS: Record<OAuthProviderId, { authUrl: string; tokenUrl: string; scope?: string; extra: Record<string, string> }> = {
  "google-drive": {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/drive.file",
    extra: { access_type: "offline", prompt: "consent" },
  },
  dropbox: {
    authUrl: "https://www.dropbox.com/oauth2/authorize",
    tokenUrl: "https://api.dropboxapi.com/oauth2/token",
    extra: { token_access_type: "offline" },
  },
};

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function randomToken(bytes = 32): string {
  return b64url(globalThis.crypto.getRandomValues(new Uint8Array(bytes)));
}

/** Verificador aleatorio (43 caracteres) y su desafío S256 (RFC 7636). */
export async function generatePkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomToken(32);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(new Uint8Array(digest)) };
}

export function buildAuthorizationUrl(i: { provider: OAuthProviderId; clientId: string; redirectUri: string; challenge: string; state: string }): string {
  const p = OAUTH_PROVIDERS[i.provider];
  const u = new URL(p.authUrl);
  u.searchParams.set("client_id", i.clientId);
  u.searchParams.set("redirect_uri", i.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("code_challenge", i.challenge);
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("state", i.state);
  if (p.scope) u.searchParams.set("scope", p.scope);
  for (const [k, v] of Object.entries(p.extra)) u.searchParams.set(k, v);
  return u.toString();
}

export type RedirectResult = { ok: true; code: string } | { ok: false; message: string };

/** Valida la URL a la que vuelve el navegador: el `state` debe coincidir y debe traer el `code`. */
export function parseRedirect(url: string, expectedState: string): RedirectResult {
  let u: URL;
  try { u = new URL(url); } catch { return { ok: false, message: "Redirección inválida" }; }
  if (u.searchParams.get("state") !== expectedState) return { ok: false, message: "La respuesta no corresponde a esta solicitud" };
  const error = u.searchParams.get("error");
  if (error) return { ok: false, message: `Autorización rechazada: ${error}` };
  const code = u.searchParams.get("code");
  return code ? { ok: true, code } : { ok: false, message: "Falta el código de autorización" };
}

export type TokenResult =
  | { ok: true; accessToken: string; refreshToken?: string; expiresIn: number }
  | { ok: false; message: string; retryable: boolean };

async function postToken(fetch: FetchLike, provider: OAuthProviderId, params: Record<string, string>): Promise<TokenResult> {
  let res;
  try {
    res = await fetch(OAUTH_PROVIDERS[provider].tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
    });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e), retryable: true };
  }
  let json: Record<string, unknown> = {};
  try { json = (await res.json()) as Record<string, unknown>; } catch { /* cuerpo vacío */ }
  if (res.status < 200 || res.status >= 300 || typeof json.access_token !== "string") {
    return { ok: false, message: String(json.error_description ?? json.error ?? `HTTP ${res.status}`), retryable: res.status >= 500 || res.status === 429 };
  }
  return {
    ok: true,
    accessToken: json.access_token,
    ...(typeof json.refresh_token === "string" ? { refreshToken: json.refresh_token } : {}),
    expiresIn: Number(json.expires_in ?? 3600),
  };
}

export function exchangeCode(i: { fetch: FetchLike; provider: OAuthProviderId; clientId: string; redirectUri: string; code: string; verifier: string }): Promise<TokenResult> {
  return postToken(i.fetch, i.provider, {
    grant_type: "authorization_code",
    code: i.code,
    client_id: i.clientId,
    redirect_uri: i.redirectUri,
    code_verifier: i.verifier,
  });
}

/**
 * Guarda el refresh token en el llavero del sistema (nunca en disco ni en el respaldo) y entrega access tokens
 * renovados bajo demanda, reutilizando el vigente hasta un minuto antes de caducar.
 */
export class OAuthTokenStore {
  private access: { token: string; expiresAt: number } | null = null;
  private readonly account: string;
  private readonly now: () => number;

  constructor(private d: { keychain: Keychain; fetch: FetchLike; provider: OAuthProviderId; clientId: string; now?: () => number }) {
    this.account = `oauth:${d.provider}`;
    this.now = d.now ?? Date.now;
  }

  async saveRefreshToken(refresh: string): Promise<void> {
    await this.d.keychain.set(this.account, refresh);
    this.access = null;
  }

  async isConnected(): Promise<boolean> {
    return (await this.d.keychain.get(this.account)) !== null;
  }

  async clear(): Promise<void> {
    this.access = null;
    await this.d.keychain.delete(this.account);
  }

  async getAccessToken(): Promise<string | null> {
    if (this.access && this.now() < this.access.expiresAt - 60_000) return this.access.token;
    const refresh = await this.d.keychain.get(this.account);
    if (!refresh) return null;
    const r = await postToken(this.d.fetch, this.d.provider, { grant_type: "refresh_token", refresh_token: refresh, client_id: this.d.clientId });
    // Fallo transitorio (sin red, 5xx, 429): se lanza para que el respaldo se reintente; solo un token revocado cuenta como «sin sesión».
    if (!r.ok) { if (r.retryable) throw new Error(r.message); return null; }
    if (r.refreshToken) await this.d.keychain.set(this.account, r.refreshToken);
    this.access = { token: r.accessToken, expiresAt: this.now() + r.expiresIn * 1000 };
    return r.accessToken;
  }
}

/** Puerto de plataforma: abre el navegador del sistema y devuelve la URL de redirección recibida (bucle local en escritorio). */
export interface OAuthPort {
  authorize(authUrl: string, redirectUri: string): Promise<string>;
  /** Reserva lo necesario (p. ej. un puerto local) antes de conocer `redirectUri`. */
  prepare?(): Promise<void>;
  readonly redirectUri: string;
}

/** Flujo completo de conexión: PKCE → navegador → intercambio → refresh token al llavero. */
export async function connectOAuth(i: { port: OAuthPort; fetch: FetchLike; provider: OAuthProviderId; clientId: string; keychain: Keychain }): Promise<{ ok: true } | { ok: false; message: string }> {
  try { await i.port.prepare?.(); } catch (e) { return { ok: false, message: e instanceof Error ? e.message : String(e) }; }
  const { verifier, challenge } = await generatePkce();
  const state = randomToken(16);
  let redirected: string;
  try {
    redirected = await i.port.authorize(buildAuthorizationUrl({ provider: i.provider, clientId: i.clientId, redirectUri: i.port.redirectUri, challenge, state }), i.port.redirectUri);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
  const parsed = parseRedirect(redirected, state);
  if (!parsed.ok) return parsed;
  const t = await exchangeCode({ fetch: i.fetch, provider: i.provider, clientId: i.clientId, redirectUri: i.port.redirectUri, code: parsed.code, verifier });
  if (!t.ok) return { ok: false, message: t.message };
  if (!t.refreshToken) return { ok: false, message: "El proveedor no entregó un token de renovación" };
  await new OAuthTokenStore({ keychain: i.keychain, fetch: i.fetch, provider: i.provider, clientId: i.clientId }).saveRefreshToken(t.refreshToken);
  return { ok: true };
}
