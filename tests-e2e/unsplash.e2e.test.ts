// Spec 005, fase 4 (e2e real en Chrome): privacidad de Unsplash (E-172 a E-174) y portada de Unsplash sin red (E-175).
// Toda la red se intercepta: nada real sale; se observan las peticiones, sus cabeceras y su cuerpo.
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Page } from "./cdp";
import { clickButton, clickTab, ensureSpace, newPage, openFromTree, startWeb, type Web } from "./webHarness";

let web: Web;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const PORT = 4198;
const ORIGIN = `localhost:${PORT}`;
beforeAll(async () => { web = await startWeb(PORT, 9358); }, 120000);
afterAll(() => web?.stop());
afterEach(async () => { await web?.closeAll(); });

const KEY = "clave-de-prueba-unsplash-0123456789";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const q = (s: string) => JSON.stringify(s);
const labelled = (name: string) => `(() => { const n = ${q(name)}; const ctl = [...document.querySelectorAll('button, [role=switch], [role=tab], input, a')]; return ctl.find(b => { if ((b.getAttribute('aria-label') ?? '').trim() === n) return true; const l = b.id ? document.querySelector('label[for="' + b.id + '"]') : null; return ((l ? l.innerText : b.innerText) ?? '').trim() === n; }); })()`;
const click = (p: Page, name: string) => p.eval(`(() => { const b = ${labelled(name)}; if (!b) throw new Error('sin control ' + ${q(name)}); b.click(); })()`);
const setInput = (p: Page, name: string, value: string) => p.eval(`(() => { const i = ${labelled(name)}; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ${q(value)}); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
const hosts = (p: Page) => [...new Set(p.requests.filter((u) => /^https?:/.test(u)).map((u) => new URL(u).host))].sort();

const photo = (id: string) => ({
  id, width: 6000, height: 4000,
  urls: { raw: `https://images.unsplash.com/${id}?ixid=x`, thumb: `https://images.unsplash.com/${id}-thumb` },
  links: { html: `https://unsplash.com/photos/${id}`, download_location: `https://api.unsplash.com/photos/${id}/download?ixid=x` },
  user: { name: `Autor ${id}`, links: { html: `https://unsplash.com/@${id}` } },
});
/** Simula Unsplash: la API (búsqueda y aviso de descarga) y las imágenes. */
async function fakeUnsplash(p: Page) {
  await p.route("api.unsplash.com", (u) => u.pathname === "/search/photos"
    ? { status: 200, contentType: "application/json", body: JSON.stringify({ total_pages: 1, results: [photo("a"), photo("b")] }) }
    : { status: 200, contentType: "application/json", body: JSON.stringify({ url: "x" }) });
  await p.route("images.unsplash.com", () => ({ status: 200, contentType: "image/png", body: PNG }));
}
async function enableUnsplash(p: Page) {
  await clickButton(p, "Ajustes");
  await p.waitFor(`!!${labelled("Activar Unsplash")}`, 10000);
  await click(p, "Activar Unsplash");
  await setInput(p, "Clave de acceso de Unsplash", KEY);
  await click(p, "Guardar clave");
  await p.waitFor("document.body.innerText.includes('Clave guardada')", 5000);
  // Ajustes es un panel lateral modal: se cierra para poder usar el resto de la pantalla
  await p.eval("(document.querySelector('[data-drawer] button[aria-label=\"Cerrar\"]'))?.click()");
  await p.waitFor("!document.querySelector('[data-drawer-overlay]')", 5000);
}
async function pickFromUnsplash(p: Page) {
  await click(p, "Añadir portada");
  await p.waitFor(`!!${labelled("Unsplash")}`, 10000);
  await sleep(700); // el diálogo se desliza al abrirse: un clic a mitad de la animación cae en el fondo y lo cierra
  await clickTab(p, "Unsplash"); // las pestañas de Radix se activan con el ratón
  const box = 'input[type=search][aria-label="Buscar en Unsplash"]'; // hay otros campos de búsqueda en la pantalla
  await p.waitFor(`document.querySelector(${q(box)})`, 5000);
  await p.waitFor("document.querySelector('[aria-label=\"Resultados de Unsplash\"] button')", 10000); // al abrir la pestaña ya carga un tema al azar
  await p.click(box); await p.typeText("mar"); await click(p, "Buscar");
  await sleep(1200); // la búsqueda escrita reemplaza a la selección inicial
  await p.waitFor("document.querySelector('[aria-label=\"Resultados de Unsplash\"] button')", 10000);
}
const withPage = async (title = "Privada") => {
  const p = await web.open();
  await ensureSpace(p);
  await newPage(p, title);
  await p.eval("document.querySelector('.bn-editor').focus()"); await sleep(300);
  await p.typeText("contenido personal secreto"); await sleep(1500);
  return p;
};

describe("privacidad: Unsplash apagado (E-172, RNF-2, RF-9.4)", () => {
  it("con Unsplash apagado, ninguna petición sale del origen aunque se use el selector de portada", async () => {
    const p = await withPage("Privada apagada");
    await click(p, "Añadir portada");
    await p.waitFor(`!!${labelled("Colores")}`, 10000);
    expect(await p.eval<boolean>(`!${labelled("Unsplash")}`)).toBe(true); // la pestaña no existe
    await clickTab(p, "Colores");
    await p.waitFor("document.querySelector('[data-swatch]')", 5000);
    await p.eval("document.querySelector('[data-swatch]').click()");
    await p.waitFor("document.querySelector('[data-testid=cover]')", 5000);
    await clickButton(p, "Ajustes"); await sleep(400);
    await p.reload(); await p.waitFor("document.querySelector('aside nav')", 20000);
    expect(p.requests.length).toBeGreaterThan(5);
    expect(hosts(p)).toEqual([ORIGIN]);
  }, 120000);
});

describe("privacidad: Unsplash encendido con una búsqueda (E-173, RF-9.3, RNF-2)", () => {
  it("solo se habla con api.unsplash.com e images.unsplash.com y nada de la página sale", async () => {
    const p = await withPage("Privada nueva");
    await fakeUnsplash(p);
    await enableUnsplash(p);
    await openFromTree(p, "Privada nueva");
    await pickFromUnsplash(p);
    expect(hosts(p)).toEqual([ORIGIN, "api.unsplash.com", "images.unsplash.com"].sort());
    // solo se pide lo necesario: la búsqueda (un tema inicial y lo escrito en el buscador) y miniaturas
    const api = p.seen.filter((r) => new URL(r.url).host === "api.unsplash.com");
    expect(api.map((r) => new URL(r.url).pathname)).toEqual(["/search/photos", "/search/photos"]); // el tema inicial al azar y la búsqueda escrita
    expect(new URL(api[1]!.url).searchParams.get("query")).toBe("mar");
    // ni el título ni el contenido de las páginas viajan en ninguna dirección, cabecera o cuerpo
    const everything = JSON.stringify(p.seen);
    expect(everything).not.toContain("Privada nueva");
    expect(everything).not.toContain("secreto");
    expect(everything).not.toContain("contenido");
    // la clave solo va en la cabecera de la API; nunca en una dirección ni hacia las imágenes
    for (const r of p.seen) {
      expect(r.url).not.toContain(KEY);
      const auth = r.headers.Authorization ?? r.headers.authorization;
      if (new URL(r.url).host === "api.unsplash.com") expect(auth).toBe(`Client-ID ${KEY}`);
      else expect(auth).toBeUndefined();
    }
    // elegir una foto: aviso de descarga y la imagen sin clave
    await p.eval("document.querySelector('[aria-label=\"Resultados de Unsplash\"] button').click()");
    await p.waitFor("document.querySelector('[data-testid=cover] img')", 20000);
    const after = p.seen.map((r) => `${new URL(r.url).host}${new URL(r.url).pathname}`);
    expect(after.filter((x) => x.startsWith("api.unsplash.com/photos/")).length).toBe(1);
    const download = p.seen.find((r) => r.url.includes("w=2560"))!;
    expect(new URL(download.url).searchParams.get("fm")).toBe("jpg");
    expect(download.headers.Authorization ?? download.headers.authorization).toBeUndefined();
    expect(await p.eval<boolean>(`Object.keys(localStorage).every(k => !localStorage.getItem(k).includes(${q(KEY)}))`)).toBe(true);
  }, 180000);
});

describe("privacidad: el respaldo sigue llegando solo a GitHub (E-174, RNF-2)", () => {
  it("con Unsplash encendido, conectar el respaldo solo habla con api.github.com", async () => {
    const p = await withPage("Respaldada");
    await fakeUnsplash(p);
    await p.fake("api.github.com", 200, { private: true, default_branch: "main", permissions: { push: true } });
    await enableUnsplash(p);
    await clickButton(p, "Respaldo");
    await p.waitFor("document.querySelector('input[type=password]')", 10000);
    const field = (text: string, value: string) => p.eval(`(() => { const l = [...document.querySelectorAll('label')].find(x => x.innerText.trim().startsWith(${q(text)})); const i = l.querySelector('input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ${q(value)}); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await field("Token de GitHub", "ghp_TOKENDEPRUEBA0123456789abcdefghijkl");
    await field("Propietario", "yo"); await field("Repositorio", "respaldo");
    await click(p, "Conectar");
    await sleep(2500);
    expect(hosts(p).filter((h) => h !== ORIGIN)).toEqual(["api.github.com"]); // Unsplash no se toca si no se busca
    expect(p.seen).toEqual([]);
  }, 150000);
});

describe("portada de Unsplash sin red (E-175, RNF-1)", () => {
  it("una portada de Unsplash ya guardada se ve con su crédito sin conexión", async () => {
    const p = await withPage("Con foto");
    await fakeUnsplash(p);
    await enableUnsplash(p);
    await openFromTree(p, "Con foto");
    await pickFromUnsplash(p);
    await p.eval("document.querySelector('[aria-label=\"Resultados de Unsplash\"] button').click()");
    await p.waitFor("document.querySelector('[data-testid=cover] img')", 20000);
    expect(await p.eval<string>("document.querySelector('[data-testid=cover-credit]').innerText")).toContain("Autor a");
    expect(await p.eval<string>("document.querySelector('[data-testid=cover-credit] a').href")).toContain("utm_medium=referral");
    await p.key("Escape", "Escape", 27);
    await clickButton(p, "Nueva página");
    await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')?.value === ''");
    await new Promise((r) => setTimeout(r, 500)); // el título se vuelve a montar al abrir la página: sin pausa se pierde lo escrito
    const before = p.seen.length;
    await p.setOffline(true);
    try {
      await openFromTree(p, "Con foto").catch(async () => { await p.eval("[...document.querySelectorAll('[role=treeitem]')].find(e => e.getAttribute('aria-label') === 'Con foto').click()"); });
      await p.waitFor("document.querySelector('[data-testid=cover] img')", 20000);
      expect(await p.eval<boolean>("(() => { const i = document.querySelector('[data-testid=cover] img'); return i.src.startsWith('blob:') && i.complete && i.naturalWidth > 0; })()")).toBe(true);
      expect(await p.eval<string>("document.querySelector('[data-testid=cover-credit]').innerText")).toContain("Autor a");
      expect(p.seen.length).toBe(before); // nada vuelve a pedirse a Unsplash
    } finally { await p.setOffline(false); }
  }, 180000);
});
