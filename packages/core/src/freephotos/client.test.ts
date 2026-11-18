import { describe, it, expect } from "vitest";
import { FreePhotosClient, freePhotoCredit } from "./client";
import { parseCoverCredit } from "../pages/cover";
import type { UnsplashFetch } from "../unsplash/client";

const reply = (body: unknown, status = 200): ReturnType<UnsplashFetch> => Promise.resolve({ status, headers: { get: () => null }, json: async () => body, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer });
const THUMB = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Foto.jpg/360px-Foto.jpg";
const commons = (over: Record<string, unknown> = {}) => ({
  query: { pages: { "1": { pageid: 1, index: 1, imageinfo: [{ width: 4000, height: 2000, mime: "image/jpeg", url: "https://upload.wikimedia.org/wikipedia/commons/a/ab/Foto.jpg", thumburl: THUMB, descriptionurl: "https://commons.wikimedia.org/wiki/File:Foto.jpg", extmetadata: { Artist: { value: '<a href="x">Ana &amp; Luis</a>' }, LicenseShortName: { value: "CC BY-SA 4.0" } }, ...over }] } } },
  continue: { gsroffset: 24 },
});

describe("FreePhotosClient", () => {
  it("Commons: devuelve fotos horizontales con autor en texto, licencia y miniatura a 2 560 px", async () => {
    const c = new FreePhotosClient({ fetch: () => reply(commons()) });
    const r = await c.searchCommons("montañas");
    expect(r.ok && r.value.hasMore).toBe(true);
    const p = r.ok ? r.value.results[0]! : null;
    expect(p?.author).toBe("Ana & Luis");
    expect(p?.license).toBe("CC BY-SA 4.0");
    expect(p?.fullUrl).toContain("/2560px-Foto.jpg");
  });
  it("Commons: descarta verticales, de baja resolución o de otro host", async () => {
    for (const over of [{ width: 1000, height: 2000 }, { width: 800, height: 600 }, { url: "https://evil.example/x.jpg" }]) {
      const r = await new FreePhotosClient({ fetch: () => reply(commons(over)) }).searchCommons("x");
      expect(r.ok && r.value.results).toEqual([]);
    }
  });
  it("Commons: una búsqueda vacía no hace ninguna petición", async () => {
    let calls = 0;
    const r = await new FreePhotosClient({ fetch: () => { calls++; return reply({}); } }).searchCommons("  ");
    expect(r.ok && r.value.results).toEqual([]);
    expect(calls).toBe(0);
  });
  it("Picsum: lista la galería y arma las URL por id", async () => {
    const c = new FreePhotosClient({ fetch: () => reply([{ id: "10", author: "Paul", width: 5000, height: 3333, url: "https://unsplash.com/photos/abc", download_url: "x" }]) });
    const r = await c.listPicsum();
    const p = r.ok ? r.value.results[0]! : null;
    expect(p?.thumbUrl).toBe("https://picsum.photos/id/10/360/240");
    expect(p?.fullUrl).toBe("https://picsum.photos/id/10/2560/1440");
  });
  it("errores con tipo: sin red, límite y servidor", async () => {
    const off = await new FreePhotosClient({ fetch: () => Promise.reject(new Error("x")) }).listPicsum();
    expect(!off.ok && off.error.kind).toBe("offline");
    const lim = await new FreePhotosClient({ fetch: () => reply({}, 429) }).listPicsum();
    expect(!lim.ok && lim.error.kind).toBe("rateLimited");
    const srv = await new FreePhotosClient({ fetch: () => reply({}, 500) }).listPicsum();
    expect(!srv.ok && srv.error.kind).toBe("server");
  });
  it("descarga solo de los hosts conocidos", async () => {
    const c = new FreePhotosClient({ fetch: () => reply({}) });
    const base = { id: "a", thumbUrl: "", author: "A", authorUrl: "https://a.example", photoUrl: "https://a.example", license: null, width: 1, height: 1 };
    expect((await c.download({ ...base, source: "commons", fullUrl: "https://evil.example/x.jpg" })).ok).toBe(false);
    expect((await c.download({ ...base, source: "picsum", fullUrl: "https://picsum.photos/id/1/2560/1440" })).ok).toBe(true);
  });
  it("el crédito se guarda y se vuelve a leer con la licencia", () => {
    const credit = freePhotoCredit({ id: "commons:1", source: "commons", thumbUrl: "", fullUrl: "", author: "Ana", authorUrl: "https://a.example/x", photoUrl: "https://a.example/x", license: "CC BY 4.0", width: 1, height: 1 });
    expect(parseCoverCredit(JSON.stringify(credit))).toEqual(credit);
  });
});
