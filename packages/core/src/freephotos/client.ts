// Fotos libres sin clave (Wikimedia Commons y Picsum). `fetch` inyectado, errores con tipo y solo hosts conocidos.
// Wikimedia Commons: búsqueda (commons.wikimedia.org) e imágenes (upload.wikimedia.org). Picsum: listado y fotos (picsum.photos).
import type { CoverCredit } from "../pages/cover";
import type { UnsplashFetch, UnsplashResult, UnsplashErrorKind } from "../unsplash/client";

export type FreePhotoSource = "commons" | "picsum";
export type FreePhoto = {
  id: string; source: FreePhotoSource; thumbUrl: string; fullUrl: string;
  author: string; authorUrl: string; photoUrl: string; license: string | null; width: number; height: number;
};
export type FreePhotoPage = { results: FreePhoto[]; hasMore: boolean };

export const COMMONS_API_HOST = "commons.wikimedia.org";
export const COMMONS_IMAGE_HOST = "upload.wikimedia.org";
export const PICSUM_HOST = "picsum.photos";
export const FREE_PHOTOS_PAGE_SIZE = 24;
const MAX_WIDTH = 2560;

const MESSAGES: Record<UnsplashErrorKind, string> = {
  offline: "No hay conexión con el servicio de fotos",
  unauthorized: "El servicio de fotos no aceptó la petición",
  rateLimited: "Se alcanzó el límite de peticiones del servicio de fotos",
  server: "El servicio de fotos no respondió como se esperaba",
};
const fail = (kind: UnsplashErrorKind): { ok: false; error: { kind: UnsplashErrorKind; message: string } } => ({ ok: false, error: { kind, message: MESSAGES[kind] } });

const hostIs = (url: unknown, host: string): url is string => {
  if (typeof url !== "string") return false;
  try { const u = new URL(url); return u.protocol === "https:" && u.host === host; } catch { return false; }
};
const https = (v: unknown): v is string => typeof v === "string" && /^https:\/\//.test(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#039;": "'", "&nbsp;": " " };
/** El autor de Commons llega como HTML: se queda solo el texto. */
const plain = (html: string): string => html.replace(/<[^>]*>/g, "").replace(/&(?:amp|lt|gt|quot|#039|nbsp);/g, (m) => ENTITIES[m] ?? m).replace(/\s+/g, " ").trim();

export class FreePhotosClient {
  readonly #fetch: UnsplashFetch;
  constructor(o: { fetch: UnsplashFetch }) { this.#fetch = o.fetch; }

  async #get(url: string): Promise<UnsplashResult<Awaited<ReturnType<UnsplashFetch>>>> {
    let res: Awaited<ReturnType<UnsplashFetch>>;
    try { res = await this.#fetch(url); } catch { return fail("offline"); }
    if (res.status >= 200 && res.status < 300) return { ok: true, value: res };
    if (res.status === 403 || res.status === 429) return fail("rateLimited");
    return fail("server");
  }

  /** Busca fotos horizontales en Wikimedia Commons. */
  async searchCommons(query: string, page = 1): Promise<UnsplashResult<FreePhotoPage>> {
    const q = query.trim();
    if (q === "") return { ok: true, value: { results: [], hasMore: false } };
    const params = new URLSearchParams({
      action: "query", format: "json", origin: "*", generator: "search", gsrnamespace: "6", gsrsearch: `${q} filetype:bitmap`,
      gsrlimit: String(FREE_PHOTOS_PAGE_SIZE), gsroffset: String((page - 1) * FREE_PHOTOS_PAGE_SIZE),
      prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: "360",
    });
    const res = await this.#get(`https://${COMMONS_API_HOST}/w/api.php?${params}`);
    if (!res.ok) return res;
    let body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    try { body = await res.value.json(); } catch { return fail("server"); }
    if (!body || typeof body !== "object") return fail("server");
    const pages: any[] = Object.values(body.query?.pages ?? {}); // eslint-disable-line @typescript-eslint/no-explicit-any
    pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const results: FreePhoto[] = [];
    for (const p of pages) {
      const i = p?.imageinfo?.[0];
      const width = num(i?.width), height = num(i?.height);
      if (!i || !width || !height || width < height || width < 1200) continue; // solo horizontales con resolución útil
      if (!/^image\/(jpeg|png|webp)$/.test(String(i.mime))) continue;
      if (!hostIs(i.url, COMMONS_IMAGE_HOST) || !hostIs(i.thumburl, COMMONS_IMAGE_HOST) || !https(i.descriptionurl)) continue;
      const artist = str(i.extmetadata?.Artist?.value);
      const license = str(i.extmetadata?.LicenseShortName?.value);
      // Más ancho que el original no existe: si cabe se usa el archivo tal cual; si no, la miniatura reescalada a 2 560 px.
      const fullUrl = width <= MAX_WIDTH ? i.url : i.thumburl.replace(/\/\d+px-([^/]+)$/, `/${MAX_WIDTH}px-$1`);
      results.push({ id: `commons:${p.pageid}`, source: "commons", thumbUrl: i.thumburl, fullUrl, author: (artist && plain(artist)) || "Wikimedia Commons", authorUrl: i.descriptionurl, photoUrl: i.descriptionurl, license, width, height });
    }
    return { ok: true, value: { results, hasMore: body.continue !== undefined } };
  }

  /** Galería de Picsum (fotos de Unsplash ya elegidas), sin búsqueda. */
  async listPicsum(page = 1): Promise<UnsplashResult<FreePhotoPage>> {
    const res = await this.#get(`https://${PICSUM_HOST}/v2/list?page=${page}&limit=${FREE_PHOTOS_PAGE_SIZE}`);
    if (!res.ok) return res;
    let body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    try { body = await res.value.json(); } catch { return fail("server"); }
    if (!Array.isArray(body)) return fail("server");
    const results: FreePhoto[] = [];
    for (const r of body) {
      const id = str(r?.id), author = str(r?.author), width = num(r?.width), height = num(r?.height);
      if (!id || !author || !width || !height || !/^\d+$/.test(id) || !https(r.url)) continue;
      results.push({ id: `picsum:${id}`, source: "picsum", thumbUrl: `https://${PICSUM_HOST}/id/${id}/360/240`, fullUrl: `https://${PICSUM_HOST}/id/${id}/${MAX_WIDTH}/1440`, author, authorUrl: r.url, photoUrl: r.url, license: "Unsplash License", width, height });
    }
    return { ok: true, value: { results, hasMore: body.length === FREE_PHOTOS_PAGE_SIZE } };
  }

  /** Descarga la imagen elegida (solo de los hosts conocidos). */
  async download(photo: FreePhoto): Promise<UnsplashResult<Uint8Array>> {
    const host = photo.source === "commons" ? COMMONS_IMAGE_HOST : PICSUM_HOST;
    if (!hostIs(photo.fullUrl, host)) return fail("server");
    const res = await this.#get(photo.fullUrl);
    if (!res.ok) return res;
    try { return { ok: true, value: new Uint8Array(await res.value.arrayBuffer()) }; } catch { return fail("offline"); }
  }
}

/** Crédito que se guarda con la portada. */
export function freePhotoCredit(photo: FreePhoto): CoverCredit {
  return { source: photo.source, photoId: photo.id, author: photo.author, authorUrl: photo.authorUrl, photoUrl: photo.photoUrl, ...(photo.license ? { license: photo.license } : {}) };
}
