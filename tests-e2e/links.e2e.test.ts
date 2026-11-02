// T-359, T-361, T-362, T-363, T-364 (e2e real en Chrome): menciones con @ y [[, retroenlaces, renombrar, enlace roto y ciclos.
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Page } from "./cdp";
import { clickButton, ensureSpace, mention, newPage, openFromTree, startWeb, type Web } from "./webHarness";

let web: Web;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => { web = await startWeb(4183, 9342); }, 120000);
afterAll(() => web?.stop());
afterEach(async () => { await web?.closeAll(); });

const mentions = (p: Page) => p.eval<{ id: string; state: string; text: string }[]>("[...document.querySelectorAll('[data-mention]')].map(m => ({ id: m.dataset.mention, state: m.dataset.state, text: m.innerText.replace(/\\s+/g, ' ').trim() }))");
const backlinkTitles = (p: Page) => p.eval<string[]>("[...document.querySelectorAll('section[aria-label=\"Enlaces a esta página\"] li')].map(li => li.innerText.trim())");

describe("enlaces entre páginas en la aplicación real", () => {
  it("T-359…T-364: mención, retroenlace, renombrar, papelera y ciclo", async () => {
    const p = await web.open();
    await ensureSpace(p);
    await newPage(p, "Destino");
    await newPage(p, "Origen");

    // T-359: @ abre el menú con búsqueda de páginas e inserta una mención
    await mention(p, "@", "Dest");
    let ms = await mentions(p);
    expect(ms).toHaveLength(1);
    expect(ms[0]!.text).toBe("@Destino");
    // también con [[
    await mention(p, "[[", "Dest");
    expect(await mentions(p)).toHaveLength(2);

    // T-361: la página de destino lista a Origen en sus retroenlaces (una sola vez); y abrir la mención lleva al destino
    await sleep(1200);
    await p.eval("document.querySelector('[data-mention] button').click()");
    await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')?.value === 'Destino'", 10000);
    await p.waitFor("document.querySelector('section[aria-label=\"Enlaces a esta página\"]')", 10000);
    await sleep(500);
    expect(await backlinkTitles(p)).toEqual(["Origen"]);

    // T-364: ciclo — Destino también menciona a Origen; ambos se listan mutuamente
    await mention(p, "@", "Orig");
    await sleep(1200);
    await openFromTree(p, "Origen");
    await p.waitFor("document.querySelector('section[aria-label=\"Enlaces a esta página\"] li')", 10000);
    expect(await backlinkTitles(p)).toEqual(["Destino"]);

    // T-362: renombrar el destino mantiene el enlace, con el título nuevo
    await openFromTree(p, "Destino");
    await p.click('[aria-label="Título de la página"]');
    await p.key("a", "KeyA", 65, 2); // Ctrl+A selecciona el título
    await p.typeText("Destino nuevo"); await p.key("Enter", "Enter", 13);
    await sleep(800);
    await openFromTree(p, "Origen");
    await p.waitFor("document.querySelector('[data-mention]')?.innerText.includes('Destino nuevo')", 10000);
    expect((await mentions(p)).every((m) => m.text === "@Destino nuevo")).toBe(true);

    // T-363: con el destino en la papelera la mención lo indica y ofrece restaurar
    await openFromTree(p, "Destino nuevo");
    await clickButton(p, "Eliminar");
    await sleep(800);
    await openFromTree(p, "Origen");
    await p.waitFor("document.querySelector('[data-mention][data-state=trashed]')", 10000);
    const trashed = (await mentions(p))[0]!;
    expect(trashed.text).toContain("(en la papelera)");
    expect(trashed.text).toContain("Restaurar");
    await p.eval("[...document.querySelectorAll('[data-mention][data-state=trashed] button')].find(b => b.innerText.trim() === 'Restaurar').click()");
    await p.waitFor("document.querySelector('[data-mention][data-state=ok]')", 10000);
    expect((await mentions(p))[0]!.text).toBe("@Destino nuevo");
  }, 240000);
});
