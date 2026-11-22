// E-164 a E-171 (RF-2.1, RF-2.4 a RF-2.6, RF-9.4, CL-8, CL-9, CL-10): pestaña Unsplash del selector de portada.
import { describe, it, expect } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryAssetStore, MemoryKeychain, UnsplashClient, type UnsplashFetch } from "@vnote/core";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { makeController } from "../../tests/withController";
import { PageHeader } from "../page/PageHeader";
import { UNSPLASH_PREFERENCE, UnsplashProvider, type UnsplashRuntime } from "./UnsplashContext";
import { MemoryPreferences } from "../theme/theme";
import { resources } from "../i18n";
import { findMissingKeys } from "../i18n/keys";

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 1, 2, 3];
const raw = (id: string, over: Record<string, unknown> = {}) => ({
  id, width: 6000, height: 4000,
  urls: { raw: `https://images.unsplash.com/${id}?ixid=x`, thumb: `https://images.unsplash.com/${id}?w=200` },
  links: { html: `https://unsplash.com/photos/${id}`, download_location: `https://api.unsplash.com/photos/${id}/download?ixid=x` },
  user: { name: `Autor ${id}`, links: { html: `https://unsplash.com/@${id}` } },
  ...over,
});

type Behaviour = { search?: (page: number) => { status?: number; json?: unknown } | Error; track?: () => { status?: number } | Error; image?: () => { status?: number } | Error | Promise<{ status?: number } | Error> };
function fakeFetch(b: Behaviour = {}) {
  const urls: string[] = [];
  const fetch: UnsplashFetch = async (url, init) => {
    urls.push(url);
    const u = new URL(url);
    let r: { status?: number; json?: unknown } | Error;
    if (u.pathname === "/search/photos") r = (b.search ?? ((p) => ({ json: { total_pages: 2, results: p === 1 ? [raw("a"), raw("b")] : [raw("c")] } })))(Number(u.searchParams.get("page")));
    else if (u.host === "api.unsplash.com") r = (b.track ?? (() => ({})))();
    else r = await (b.image ?? (() => ({})))();
    if (r instanceof Error) throw r;
    void init;
    return { status: r.status ?? 200, headers: { get: () => null }, json: async () => r.json ?? {}, arrayBuffer: async () => new Uint8Array(JPEG).buffer };
  };
  return { fetch, urls };
}

async function setup(opts: { enabled?: boolean; key?: string | null; behaviour?: Behaviour; supported?: boolean; assets?: boolean; cover?: string; coverCredit?: object } = {}) {
  const { controller } = await makeController();
  const r = await controller.createPage(null, "Página");
  if (!r.ok) throw new Error("x");
  if (opts.cover) await controller.setPageProps(r.value.id, { cover: opts.cover, ...(opts.coverCredit ? { coverCredit: opts.coverCredit as never } : {}) });
  const prefs = new MemoryPreferences();
  if (opts.enabled !== false) prefs.set(UNSPLASH_PREFERENCE, "1");
  const keychain = new MemoryKeychain();
  if (opts.key !== null) await keychain.set("unsplash-access-key", opts.key ?? "clave-de-prueba");
  const net = fakeFetch(opts.behaviour);
  const runtime: UnsplashRuntime = { platform: "desktop", keychain, fetch: net.fetch, createClient: (o) => new UnsplashClient(o) };
  const assets = opts.assets === false ? undefined : new MemoryAssetStore();
  const optimize = async () => ({ jpeg: new Uint8Array([0xff, 0xd8, 0xff, 9]), sourceWidth: 2560, sourceHeight: 1600 });
  await renderWithI18n(
    <UnsplashProvider runtime={opts.supported === false ? undefined : runtime} preferences={prefs}>
      <PageHeader controller={controller} pageId={r.value.id} assets={assets} optimize={optimize} />
    </UnsplashProvider>,
  );
  const page = () => { const f = (ns: ReturnType<typeof controller.getSnapshot>["tree"]): any => ns.flatMap((n) => (n.page.id === r.value.id ? [n.page] : f(n.children)))[0]; return f(controller.getSnapshot().tree); };
  return { controller, id: r.value.id, page, assets, keychain, net, user: userEvent.setup() };
}
const open = async (user: ReturnType<typeof userEvent.setup>) => { await user.click(screen.getByRole("button", { name: /Añadir portada|Cambiar portada/ })); await screen.findByRole("group", { name: "Portada de la página" }); };
const openUnsplash = async (user: ReturnType<typeof userEvent.setup>) => { await open(user); await user.click(await screen.findByRole("tab", { name: "Unsplash" })); };
const search = async (user: ReturnType<typeof userEvent.setup>, q = "mar") => { await user.type(await screen.findByRole("searchbox", { name: "Buscar en Unsplash" }), `${q}{Enter}`); };

describe("la pestaña solo aparece con Unsplash activado (E-164, RF-9.4)", () => {
  it("activado: Subir, Unsplash, Colores y Degradados", async () => {
    const { user } = await setup();
    await open(user);
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Subir", "Unsplash", "Colores", "Degradados"]);
  });
  it("apagado, no existe", async () => {
    const { user, net } = await setup({ enabled: false });
    await open(user);
    expect(screen.queryByRole("tab", { name: "Unsplash" })).toBeNull();
    expect(net.urls).toEqual([]);
  });
  it("sin el servicio del cascarón, no existe", async () => {
    const { user } = await setup({ supported: false });
    await open(user);
    expect(screen.queryByRole("tab", { name: "Unsplash" })).toBeNull();
  });
  it("sin almacén de archivos no se puede guardar la foto: no existe", async () => {
    const { user } = await setup({ assets: false });
    await open(user);
    expect(screen.queryByRole("tab", { name: "Unsplash" })).toBeNull();
  });
  it("abrir el selector con Unsplash encendido carga una sola búsqueda inicial al azar", async () => {
    const { user, net } = await setup();
    await openUnsplash(user);
    await screen.findByRole("searchbox", { name: "Buscar en Unsplash" });
    await screen.findByRole("button", { name: "Foto de Autor a" });
    expect(net.urls.map((u) => new URL(u).pathname)).toEqual(["/search/photos"]);
  });
});

describe("búsqueda con miniaturas (E-165)", () => {
  it("muestra las miniaturas y «Más resultados» añade la página siguiente", async () => {
    const { user, net } = await setup();
    await openUnsplash(user);
    await search(user, "montañas");
    const list = await screen.findByRole("list", { name: "Resultados de Unsplash" });
    expect(within(list).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Foto de Autor a", "Foto de Autor b"]);
    expect(list.querySelector("img")!.getAttribute("src")).toBe("https://images.unsplash.com/a?w=200");
    await user.click(screen.getByRole("button", { name: "Más resultados" }));
    await waitFor(() => expect(within(screen.getByRole("list", { name: "Resultados de Unsplash" })).getAllByRole("button")).toHaveLength(3));
    expect(screen.queryByRole("button", { name: "Más resultados" })).toBeNull(); // era la última página
    expect(net.urls.map((u) => new URL(u).searchParams.get("page"))).toEqual(["1", "1", "2"]);
    expect(new URL(net.urls[1]!).searchParams.get("query")).toBe("montañas");
  });
  it("una búsqueda sin resultados lo dice", async () => {
    const { user } = await setup({ behaviour: { search: () => ({ json: { total_pages: 0, results: [] } }) } });
    await openUnsplash(user);
    await search(user, "nada");
    expect(await screen.findByText("No hay fotos para esa búsqueda.")).toBeInTheDocument();
  });
});

describe("elegir una foto (E-166, RF-2.5, D-14)", () => {
  it("avisa de la descarga, descarga, optimiza y deja portada y crédito en UNA entrada del historial", async () => {
    const { user, page, controller, id, assets, net } = await setup();
    await openUnsplash(user);
    await search(user);
    await user.click(await screen.findByRole("button", { name: "Foto de Autor a" }));
    await waitFor(() => expect(page().cover).toMatch(/^asset:[0-9a-f]{64}$/));
    // primero el aviso de descarga a la API, después la imagen, sin la clave
    expect(net.urls.slice(2).map((u) => new URL(u).host)).toEqual(["api.unsplash.com", "images.unsplash.com"]);
    expect(page().coverCredit).toMatchObject({ source: "unsplash", photoId: "a", author: "Autor a" });
    expect(new URL(page().coverCredit.authorUrl).searchParams.get("utm_medium")).toBe("referral");
    expect((await assets!.list()).length).toBe(1);
    // el selector se cierra y el crédito se ve
    await waitFor(() => expect(screen.queryByRole("group", { name: "Portada de la página" })).toBeNull());
    expect(await screen.findByTestId("cover-credit")).toHaveTextContent("Autor a");
    // una sola entrada: un deshacer devuelve las dos cosas
    await controller.undoPageProps(id);
    expect(page().cover).toBeNull();
    expect(page().coverCredit).toBeNull();
  });
  it("mientras descarga muestra el progreso y lo quita al terminar", async () => {
    let release!: () => void;
    const gate = new Promise<{ status: number }>((r) => { release = () => r({ status: 200 }); });
    const { user, page } = await setup({ behaviour: { image: () => gate } });
    await openUnsplash(user);
    await search(user);
    await user.click(await screen.findByRole("button", { name: "Foto de Autor a" }));
    expect((await screen.findAllByText("Descargando la foto…")).length).toBeGreaterThan(0);
    expect(page().cover).toBeNull(); // todavía no cambia nada
    release();
    await waitFor(() => expect(page().cover).toMatch(/^asset:/));
    await waitFor(() => expect(screen.queryByText("Descargando la foto…")).toBeNull());
  });
});

describe("errores en la pestaña (E-167, RF-2.6)", () => {
  const cases: [string, Behaviour, string][] = [
    ["sin red", { search: () => new TypeError("Failed to fetch") }, "No hay conexión con Unsplash"],
    ["límite de búsquedas", { search: () => ({ status: 403 }) }, "Se alcanzó el límite de búsquedas"],
    ["servidor", { search: () => ({ status: 500 }) }, "Unsplash no respondió como se esperaba"],
  ];
  it.each(cases)("%s: muestra su mensaje y las demás pestañas siguen funcionando", async (_n, behaviour, text) => {
    const { user, page } = await setup({ behaviour });
    await openUnsplash(user);
    await search(user);
    expect(await screen.findByRole("alert")).toHaveTextContent(text);
    await user.click(screen.getByRole("tab", { name: "Degradados" }));
    await user.click(screen.getByRole("button", { name: "Cielo" }));
    expect(page().cover).toBe("gradient:sky");
  });
  it("el mensaje se traduce al inglés", async () => {
    expect(findMissingKeys(resources["es-MX"].translation.unsplash as never, resources.en.translation.unsplash as never)).toEqual({ missingInB: [], missingInA: [] });
  });
});

describe("fallo de red al descargar (E-168, CL-8)", () => {
  it("la portada anterior no cambia y no queda ningún archivo", async () => {
    const { user, page, assets } = await setup({ cover: "gradient:sage", behaviour: { image: () => new TypeError("Failed to fetch") } });
    await open(user);
    await user.click(await screen.findByRole("tab", { name: "Unsplash" }));
    await search(user);
    await user.click(await screen.findByRole("button", { name: "Foto de Autor a" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No hay conexión con Unsplash");
    expect(page().cover).toBe("gradient:sage");
    expect(page().coverCredit).toBeNull();
    expect(await assets!.list()).toEqual([]);
  });
  it("si falla el aviso de descarga tampoco se descarga ni cambia nada", async () => {
    const { user, page, net } = await setup({ behaviour: { track: () => ({ status: 500 }) } });
    await openUnsplash(user);
    await search(user);
    await user.click(await screen.findByRole("button", { name: "Foto de Autor a" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("no respondió");
    expect(page().cover).toBeNull();
    expect(net.urls.some((u) => new URL(u).host === "images.unsplash.com" && !u.includes("/search"))).toBe(false);
  });
});

describe("clave borrada o revocada (E-169, CL-9)", () => {
  it("sin clave, la pestaña la pide y con ella aparece la búsqueda", async () => {
    const { user, keychain } = await setup({ key: null });
    await openUnsplash(user);
    expect(await screen.findByText("Escribe tu clave de acceso de Unsplash para buscar fotos.")).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).toBeNull();
    await user.type(screen.getByLabelText("Clave de acceso de Unsplash"), "mi-clave");
    await user.click(screen.getByRole("button", { name: "Guardar clave" }));
    expect(await screen.findByRole("searchbox", { name: "Buscar en Unsplash" })).toBeInTheDocument();
    expect(await keychain.get("unsplash-access-key")).toBe("mi-clave");
  });
  it("una clave revocada (401) se borra y la pestaña la vuelve a pedir", async () => {
    const { user, keychain } = await setup({ behaviour: { search: () => ({ status: 401 }) } });
    await openUnsplash(user); // la búsqueda inicial ya recibe el 401
    expect(await screen.findByText("Unsplash no aceptó la clave. Escríbela de nuevo.")).toBeInTheDocument();
    expect(await keychain.get("unsplash-access-key")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });
  it("una clave rechazada al elegir la foto también se vuelve a pedir y no cambia la portada", async () => {
    const { user, page, keychain } = await setup({ behaviour: { track: () => ({ status: 401 }) } });
    await openUnsplash(user);
    await search(user);
    await user.click(await screen.findByRole("button", { name: "Foto de Autor a" }));
    expect(await screen.findByText("Unsplash no aceptó la clave. Escríbela de nuevo.")).toBeInTheDocument();
    expect(page().cover).toBeNull();
    expect(await keychain.get("unsplash-access-key")).toBeNull();
  });
});

describe("desactivar Unsplash con portadas guardadas (E-170, CL-10)", () => {
  const hash = "ab".repeat(32);
  const credit = { source: "unsplash", photoId: "a", author: "Ana", authorUrl: "https://unsplash.com/@a?utm_source=app", photoUrl: "https://unsplash.com/photos/a?utm_source=app" };
  it("la portada se sigue viendo, con su crédito, y no sale ninguna petición", async () => {
    const { net, assets } = await (async () => {
      const s = await setup({ enabled: false, cover: `asset:${hash}`, coverCredit: credit });
      await s.assets!.put(new Uint8Array(JPEG));
      return s;
    })();
    expect(await screen.findByTestId("cover")).toHaveAttribute("data-cover-kind", "asset");
    expect(screen.getByTestId("cover-credit")).toHaveTextContent("Ana");
    expect(screen.getByRole("link", { name: "Unsplash" })).toHaveAttribute("href", credit.photoUrl);
    expect(net.urls).toEqual([]);
    void assets;
  });
});
