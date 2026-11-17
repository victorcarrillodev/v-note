// E-152 a E-157 y E-159 (RF-2.4 a RF-2.6, RF-9.2, D-14, DP-10, DP-11): cliente de Unsplash con `fetch` inyectado.
import { describe, it, expect } from "vitest";
import { brand } from "../brand";
import { UnsplashClient, unsplashCredit, type UnsplashFetch, type UnsplashPhoto } from "./client";

const KEY = "clave-secreta-abc123";
type Call = { url: string; headers: Record<string, string> };

const raw = (over: Record<string, unknown> = {}) => ({
  id: "abc", width: 6000, height: 4000,
  urls: { raw: "https://images.unsplash.com/photo-1?ixid=x", thumb: "https://images.unsplash.com/photo-1?w=200" },
  links: { html: "https://unsplash.com/photos/abc", download_location: "https://api.unsplash.com/photos/abc/download?ixid=x" },
  user: { name: "Ana Pérez", links: { html: "https://unsplash.com/@ana" } },
  ...over,
});
const searchBody = { total: 100, total_pages: 5, results: [raw(), raw({ id: "def" })] };

function fake(handler: (call: Call) => { status?: number; headers?: Record<string, string>; json?: unknown; bytes?: number[] } | Error) {
  const calls: Call[] = [];
  const f: UnsplashFetch = async (url, init) => {
    const call = { url, headers: init?.headers ?? {} };
    calls.push(call);
    const r = handler(call);
    if (r instanceof Error) throw r;
    const headers = r.headers ?? {};
    return { status: r.status ?? 200, headers: { get: (n: string) => headers[n.toLowerCase()] ?? headers[n] ?? null }, json: async () => r.json ?? {}, arrayBuffer: async () => new Uint8Array(r.bytes ?? [1, 2, 3]).buffer };
  };
  return { f, calls };
}
const make = (h: Parameters<typeof fake>[0] = () => ({ json: searchBody })) => { const t = fake(h); return { ...t, client: new UnsplashClient({ fetch: t.f, key: KEY }) }; };
const photo = (): UnsplashPhoto => ({ id: "abc", thumbUrl: "https://images.unsplash.com/photo-1?w=200", rawUrl: "https://images.unsplash.com/photo-1?ixid=x", downloadLocation: "https://api.unsplash.com/photos/abc/download?ixid=x", author: "Ana Pérez", authorUrl: "https://unsplash.com/@ana", photoUrl: "https://unsplash.com/photos/abc", width: 6000, height: 4000 });

describe("search (E-152, E-153)", () => {
  it("pide la dirección, los parámetros y las cabeceras del contrato", async () => {
    const { client, calls } = make();
    await client.search("montañas azules", 2);
    const u = new URL(calls[0]!.url);
    expect(u.origin + u.pathname).toBe("https://api.unsplash.com/search/photos");
    expect(Object.fromEntries(u.searchParams)).toEqual({ query: "montañas azules", page: "2", per_page: "24", orientation: "landscape" });
    expect(calls[0]!.headers).toEqual({ Authorization: `Client-ID ${KEY}`, "Accept-Version": "v1" });
  });
  it("la página por omisión es la 1 y una búsqueda vacía no sale a la red", async () => {
    const { client, calls } = make();
    await client.search("sol");
    expect(new URL(calls[0]!.url).searchParams.get("page")).toBe("1");
    const r = await client.search("   ");
    expect(r.ok && r.value).toEqual({ results: [], totalPages: 0 });
    expect(calls).toHaveLength(1);
  });
  it("convierte la respuesta en resultados con autor, enlaces y tamaño", async () => {
    const { client } = make();
    const r = await client.search("sol");
    if (!r.ok) throw new Error("x");
    expect(r.value.totalPages).toBe(5);
    expect(r.value.results[0]).toEqual(photo());
    expect(r.value.results.map((p) => p.id)).toEqual(["abc", "def"]);
  });
  it("descarta resultados mal formados o con direcciones de otros servidores", async () => {
    const { client } = make(() => ({ json: { total_pages: 1, results: [
      raw({ id: "ok" }),
      raw({ id: "malo1", urls: { raw: "https://evil.example/x", thumb: "https://images.unsplash.com/t" } }),
      raw({ id: "malo2", links: { html: "https://unsplash.com/p", download_location: "https://evil.example/download" } }),
      raw({ id: "malo3", user: { name: "", links: { html: "https://unsplash.com/@x" } } }),
      { id: "malo4" }, null, "x",
    ] } }));
    const r = await client.search("sol");
    expect(r.ok && r.value.results.map((p) => p.id)).toEqual(["ok"]);
  });
  it("una respuesta que no es lo esperado da error de servidor", async () => {
    const { client } = make(() => ({ json: "no es un objeto" }));
    const r = await client.search("sol");
    expect(!r.ok && r.error.kind).toBe("server");
  });
});

describe("trackDownload y download (E-154, E-155)", () => {
  it("trackDownload pide la dirección de descarga con la misma autorización", async () => {
    const { client, calls } = make();
    expect((await client.trackDownload(photo())).ok).toBe(true);
    expect(calls[0]!.url).toBe(photo().downloadLocation);
    expect(calls[0]!.headers.Authorization).toBe(`Client-ID ${KEY}`);
  });
  it("download pide w=2560&fm=jpg&q=85 y NO envía la clave", async () => {
    const { client, calls } = make(() => ({ bytes: [9, 8, 7] }));
    const r = await client.download(photo());
    if (!r.ok) throw new Error("x");
    expect([...r.value]).toEqual([9, 8, 7]);
    const u = new URL(calls[0]!.url);
    expect(u.host).toBe("images.unsplash.com");
    expect(u.searchParams.get("w")).toBe("2560"); expect(u.searchParams.get("fm")).toBe("jpg"); expect(u.searchParams.get("q")).toBe("85");
    expect(u.searchParams.get("ixid")).toBe("x"); // conserva los parámetros que ya traía
    expect(Object.keys(calls[0]!.headers)).toEqual([]);
    expect(JSON.stringify(calls[0])).not.toContain(KEY);
  });
  it("download con una dirección sin parámetros usa «?»", async () => {
    const { client, calls } = make();
    await client.download({ ...photo(), rawUrl: "https://images.unsplash.com/photo-2" });
    expect(calls[0]!.url).toBe("https://images.unsplash.com/photo-2?w=2560&fm=jpg&q=85");
  });
  it("elegir una foto avisa de la descarga ANTES de descargar (D-14)", async () => {
    const { client, calls } = make();
    const r = await client.fetchPhoto(photo());
    expect(r.ok).toBe(true);
    expect(calls.map((c) => new URL(c.url).host)).toEqual(["api.unsplash.com", "images.unsplash.com"]);
  });
  it("si el aviso de descarga falla, no se descarga la imagen", async () => {
    const { client, calls } = make((c) => (c.url.includes("/download") ? { status: 401 } : {}));
    const r = await client.fetchPhoto(photo());
    expect(!r.ok && r.error.kind).toBe("unauthorized");
    expect(calls).toHaveLength(1);
  });
  it("no sale a servidores que no son de Unsplash", async () => {
    const { client, calls } = make();
    expect((await client.trackDownload({ ...photo(), downloadLocation: "https://evil.example/d" })).ok).toBe(false);
    expect((await client.download({ ...photo(), rawUrl: "https://evil.example/x" })).ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe("errores con tipo (E-156)", () => {
  const kind = async (h: Parameters<typeof fake>[0]) => { const r = await make(h).client.search("sol"); return r.ok ? "ok" : r.error.kind; };
  it("sin red → offline", async () => { expect(await kind(() => new TypeError("Failed to fetch"))).toBe("offline"); });
  it("401 → unauthorized", async () => { expect(await kind(() => ({ status: 401 }))).toBe("unauthorized"); });
  it("403 → rateLimited", async () => { expect(await kind(() => ({ status: 403 }))).toBe("rateLimited"); });
  it("429 → rateLimited", async () => { expect(await kind(() => ({ status: 429 }))).toBe("rateLimited"); });
  it("un error con X-Ratelimit-Remaining: 0 → rateLimited", async () => { expect(await kind(() => ({ status: 400, headers: { "x-ratelimit-remaining": "0" } }))).toBe("rateLimited"); });
  it("500 y demás → server", async () => { expect(await kind(() => ({ status: 500 }))).toBe("server"); expect(await kind(() => ({ status: 404 }))).toBe("server"); });
  it("una respuesta correcta con el cupo agotado no es un error", async () => { expect(await kind(() => ({ json: searchBody, headers: { "x-ratelimit-remaining": "0" } }))).toBe("ok"); });
  it("un JSON ilegible → server", async () => {
    const f: UnsplashFetch = async () => ({ status: 200, headers: { get: () => null }, json: async () => { throw new Error("json"); }, arrayBuffer: async () => new ArrayBuffer(0) });
    const r = await new UnsplashClient({ fetch: f, key: KEY }).search("sol");
    expect(!r.ok && r.error.kind).toBe("server");
  });
});

describe("la clave nunca aparece (E-157, RF-9.2)", () => {
  it("ningún error la contiene, ni siquiera cuando el fallo de red la menciona", async () => {
    const cases: Parameters<typeof fake>[0][] = [
      () => new TypeError(`fallo con Client-ID ${KEY}`), () => ({ status: 401 }), () => ({ status: 403 }), () => ({ status: 500 }),
      () => ({ json: { errors: [`mala clave ${KEY}`] }, status: 401 }),
    ];
    for (const h of cases) {
      const { client } = make(h);
      for (const r of [await client.search("sol"), await client.trackDownload(photo()), await client.download(photo()), await client.fetchPhoto(photo())]) {
        if (!r.ok) { expect(JSON.stringify(r.error)).not.toContain(KEY); expect(r.error.message.length).toBeGreaterThan(0); }
      }
    }
  });
  it("el cliente no se vuelca con la clave al convertirlo en texto", () => {
    expect(JSON.stringify(new UnsplashClient({ fetch: fake(() => ({})).f, key: KEY }))).not.toContain(KEY);
  });
  it("una clave vacía no crea un cliente utilizable", async () => {
    const r = await new UnsplashClient({ fetch: fake(() => ({})).f, key: "  " }).search("sol");
    expect(!r.ok && r.error.kind).toBe("unauthorized");
  });
});

describe("crédito con utm (E-159, RF-2.5)", () => {
  it("añade utm_source (nombre de la app de brand) y utm_medium=referral a los dos enlaces", () => {
    const c = unsplashCredit(photo());
    for (const url of [c.authorUrl, c.photoUrl]) {
      const u = new URL(url);
      expect(u.searchParams.get("utm_source")).toBe(brand.name);
      expect(u.searchParams.get("utm_medium")).toBe("referral");
    }
    expect(c).toMatchObject({ source: "unsplash", photoId: "abc", author: "Ana Pérez" });
  });
});
