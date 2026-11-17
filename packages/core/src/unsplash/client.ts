// Cliente de Unsplash (plan 005, §9.1, DP-10, DP-11): `fetch` inyectado, errores con tipo y la clave siempre fuera de mensajes y registros.
// Solo habla con `api.unsplash.com` (búsqueda y aviso de descarga, con la clave) e `images.unsplash.com` (la imagen, sin la clave).
import { brand } from "../brand";
import type { CoverCredit } from "../pages/cover";

export type UnsplashErrorKind = "offline" | "unauthorized" | "rateLimited" | "server";
/** Cada tipo lleva un texto neutro; la interfaz muestra el suyo traducido (RF-2.6). */
export type UnsplashError = { kind: UnsplashErrorKind; message: string };
export type UnsplashResult<T> = { ok: true; value: T } | { ok: false; error: UnsplashError };

/** Lo mínimo de `fetch` que usa el cliente. Se inyecta: el navegador, el cliente HTTP de Tauri o el servidor falso de las pruebas. */
export type UnsplashFetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

export type UnsplashPhoto = {
  id: string; thumbUrl: string; rawUrl: string; downloadLocation: string;
  author: string; authorUrl: string; photoUrl: string; width: number; height: number;
};
export type UnsplashPage = { results: UnsplashPhoto[]; totalPages: number };

export const UNSPLASH_API_HOST = "api.unsplash.com";
export const UNSPLASH_IMAGE_HOST = "images.unsplash.com";
export const UNSPLASH_PAGE_SIZE = 24;
const MESSAGES: Record<UnsplashErrorKind, string> = {
  offline: "No hay conexión con Unsplash",
  unauthorized: "Unsplash no aceptó la clave de acceso",
  rateLimited: "Se alcanzó el límite de búsquedas de Unsplash",
  server: "Unsplash no respondió como se esperaba",
};
const fail = (kind: UnsplashErrorKind): { ok: false; error: UnsplashError } => ({ ok: false, error: { kind, message: MESSAGES[kind] } });

const hostIs = (url: unknown, host: string): url is string => {
  if (typeof url !== "string") return false;
  try { const u = new URL(url); return u.protocol === "https:" && u.host === host; } catch { return false; }
};
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

/** Un resultado de la API → foto; `null` si falta algo o apunta a un servidor que no es de Unsplash. */
function toPhoto(r: any): UnsplashPhoto | null { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!r || typeof r !== "object") return null;
  const id = str(r.id), raw = r.urls?.raw, thumb = r.urls?.thumb ?? r.urls?.small, dl = r.links?.download_location;
  const author = str(r.user?.name), authorUrl = r.user?.links?.html, photoUrl = r.links?.html;
  const width = num(r.width), height = num(r.height);
  if (!id || !author || !width || !height) return null;
  if (!hostIs(raw, UNSPLASH_IMAGE_HOST) || !hostIs(thumb, UNSPLASH_IMAGE_HOST) || !hostIs(dl, UNSPLASH_API_HOST)) return null;
  if (typeof authorUrl !== "string" || typeof photoUrl !== "string" || !/^https:\/\//.test(authorUrl) || !/^https:\/\//.test(photoUrl)) return null;
  return { id, thumbUrl: thumb, rawUrl: raw, downloadLocation: dl, author, authorUrl, photoUrl, width, height };
}

export class UnsplashClient {
  // La clave va en un campo privado de la clase (no enumerable): nunca sale en `JSON.stringify` ni en un volcado del objeto.
  readonly #key: string;
  readonly #fetch: UnsplashFetch;
  constructor(o: { fetch: UnsplashFetch; key: string }) { this.#fetch = o.fetch; this.#key = o.key.trim(); }

  #auth(): Record<string, string> { return { Authorization: `Client-ID ${this.#key}`, "Accept-Version": "v1" }; }

  /** Quita la clave de cualquier texto, por si un fallo de red o una respuesta la repite. */
  #clean(text: string): string { return this.#key ? text.split(this.#key).join("[clave]") : text; }

  async #get(url: string, headers?: Record<string, string>): Promise<UnsplashResult<Awaited<ReturnType<UnsplashFetch>>>> {
    let res: Awaited<ReturnType<UnsplashFetch>>;
    try { res = await this.#fetch(url, headers ? { headers } : undefined); } catch (e) { void this.#clean(String(e)); return fail("offline"); }
    if (res.status >= 200 && res.status < 300) return { ok: true, value: res };
    if (res.status === 401) return fail("unauthorized");
    if (res.status === 403 || res.status === 429 || res.headers.get("x-ratelimit-remaining") === "0") return fail("rateLimited");
    return fail("server");
  }

  async search(query: string, page = 1): Promise<UnsplashResult<UnsplashPage>> {
    const q = query.trim();
    if (q === "") return { ok: true, value: { results: [], totalPages: 0 } };
    if (!this.#key) return fail("unauthorized");
    const url = `https://${UNSPLASH_API_HOST}/search/photos?${new URLSearchParams({ query: q, page: String(page), per_page: String(UNSPLASH_PAGE_SIZE), orientation: "landscape" })}`;
    const res = await this.#get(url, this.#auth());
    if (!res.ok) return res;
    let body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    try { body = await res.value.json(); } catch { return fail("server"); }
    if (!body || typeof body !== "object" || !Array.isArray(body.results)) return fail("server");
    const results = (body.results as unknown[]).map(toPhoto).filter((p): p is UnsplashPhoto => p !== null);
    return { ok: true, value: { results, totalPages: typeof body.total_pages === "number" ? body.total_pages : 0 } };
  }

  /** Avisa a Unsplash de que se eligió la foto (requisito de su guía, D-14). */
  async trackDownload(photo: UnsplashPhoto): Promise<UnsplashResult<void>> {
    if (!this.#key) return fail("unauthorized");
    if (!hostIs(photo.downloadLocation, UNSPLASH_API_HOST)) return fail("server");
    const res = await this.#get(photo.downloadLocation, this.#auth());
    return res.ok ? { ok: true, value: undefined } : res;
  }

  /** La imagen a 2 560 px en JPEG 0,85, de `images.unsplash.com` y SIN la clave (DP-11). */
  async download(photo: UnsplashPhoto): Promise<UnsplashResult<Uint8Array>> {
    if (!hostIs(photo.rawUrl, UNSPLASH_IMAGE_HOST)) return fail("server");
    const url = `${photo.rawUrl}${photo.rawUrl.includes("?") ? "&" : "?"}w=2560&fm=jpg&q=85`;
    const res = await this.#get(url);
    if (!res.ok) return res;
    try { return { ok: true, value: new Uint8Array(await res.value.arrayBuffer()) }; } catch { return fail("offline"); }
  }

  /** Elegir una foto: primero el aviso de descarga y solo si sale bien, la imagen. */
  async fetchPhoto(photo: UnsplashPhoto): Promise<UnsplashResult<Uint8Array>> {
    const tracked = await this.trackDownload(photo);
    if (!tracked.ok) return tracked;
    return this.download(photo);
  }
}

/** Crédito que se guarda con la portada: enlaces al autor y a la foto con la marca de origen que pide Unsplash (RF-2.5). */
export function unsplashCredit(photo: UnsplashPhoto): CoverCredit {
  const tag = (url: string) => { const u = new URL(url); u.searchParams.set("utm_source", brand.name); u.searchParams.set("utm_medium", "referral"); return u.toString(); };
  return { source: "unsplash", photoId: photo.id, author: photo.author, authorUrl: tag(photo.authorUrl), photoUrl: tag(photo.photoUrl) };
}
