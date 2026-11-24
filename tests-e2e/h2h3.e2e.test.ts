// U-133 a U-250 (spec 002, H2 y H3, e2e real en Chrome): «Deshacer», papelera, ancho completo, tabla, calendario semanal y modal de tarea.
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Page } from "./cdp";
import { clickButton, clickTab, ensureSpace, newPage, setValue, startWeb, type Web } from "./webHarness";

let web: Web;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => { web = await startWeb(4195, 9355); }, 120000);
afterAll(() => web?.stop());
afterEach(async () => { await web?.closeAll(); });

const treeTitles = (p: Page) => p.eval<string[]>("[...document.querySelectorAll('[role=treeitem]')].map(e => e.getAttribute('aria-label'))");
const byLabel = (text: string) => `(() => { const l = [...document.querySelectorAll('label')].find(l => l.innerText.trim() === ${JSON.stringify(text)}); return l && document.getElementById(l.htmlFor); })()`;

describe("«Deshacer» y papelera (U-144, U-148)", () => {
  it("eliminar muestra el aviso con «Deshacer» y deshacer devuelve la página; la papelera confirma nombrando lo eliminado", async () => {
    const p = await web.open();
    await ensureSpace(p);
    await newPage(p, "Para borrar");
    await clickButton(p, "Eliminar");
    await p.waitFor("![...document.querySelectorAll('[role=treeitem]')].some(e => e.getAttribute('aria-label') === 'Para borrar')", 8000);
    await p.waitFor("[...document.querySelectorAll('[data-toast-viewport] button')].some(b => b.innerText.trim() === 'Deshacer')", 8000);
    await clickButton(p, "Deshacer");
    await p.waitFor("[...document.querySelectorAll('[role=treeitem]')].some(e => e.getAttribute('aria-label') === 'Para borrar')", 8000);
    expect(await treeTitles(p)).toContain("Para borrar");

    // otra vez a la papelera y eliminar para siempre: el diálogo nombra la página y cancelar no borra
    await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')", 5000).catch(() => {});
    await clickButton(p, "Eliminar");
    await p.waitFor("![...document.querySelectorAll('[role=treeitem]')].some(e => e.getAttribute('aria-label') === 'Para borrar')", 8000);
    await p.eval("[...document.querySelectorAll('a, button')].find(b => b.innerText.trim() === 'Papelera').click()");
    await p.waitFor("[...document.querySelectorAll('button')].some(b => b.getAttribute('aria-label') === 'Eliminar definitivamente Para borrar')", 8000);
    await clickButton(p, "Eliminar definitivamente Para borrar");
    await p.waitFor("document.querySelector('[role=alertdialog]')", 5000);
    expect(await p.eval<string>("document.querySelector('[role=alertdialog]').innerText")).toContain("Para borrar");
    await p.eval("[...document.querySelectorAll('[role=alertdialog] button')].find(b => b.innerText.trim() === 'Cancelar').click()");
    await sleep(300);
    expect(await p.eval<boolean>("!!document.querySelector('[aria-label=\"Eliminar definitivamente Para borrar\"]')")).toBe(true);
    await p.close();
  }, 90000);
});

describe("ancho completo (U-171, E-121, E-122)", () => {
  it("elegir «Completo» en las opciones de la página persiste tras recargar", async () => {
    const p = await web.open();
    await ensureSpace(p);
    await newPage(p, "Ancha");
    const width = () => p.eval<string>("document.querySelector('[data-testid=page-style-scope]').style.getPropertyValue('--size-reading-width')");
    const widthSelect = `(() => { const l = [...document.querySelectorAll('label')].find(l => l.innerText.trim() === 'Ancho de la página'); return document.getElementById(l.htmlFor); })()`;
    const open = async () => { await p.eval("document.querySelector('button[aria-label=\"Opciones de la página\"]').click()"); await p.waitFor(`!!${widthSelect}`); };
    expect(await p.eval<boolean>("![...document.querySelectorAll('[role=switch]')].some(s => document.querySelector('label[for=\"' + s.id + '\"]')?.innerText.trim() === 'Ancho completo')")).toBe(true); // ya no hay interruptor en la cabecera
    expect(await width()).toBe("");
    await open();
    await setValue(p, `[id="${await p.eval<string>(`${widthSelect}.id`)}"]`, "full");
    await p.waitFor("document.querySelector('[data-testid=page-style-scope]').style.getPropertyValue('--size-reading-width') === 'none'", 5000);
    await sleep(2500); // el volcado a OPFS es asíncrono
    await p.reload();
    await p.waitFor("document.querySelector('aside nav')", 20000);
    await p.eval("document.querySelector('[role=treeitem]').click()");
    await p.waitFor("document.querySelector('[data-testid=page-style-scope]')", 15000);
    expect(await width()).toBe("none");
    await open();
    expect(await p.eval<string>(`${widthSelect}.getAttribute("data-value")`)).toBe("full");
    await p.close();
  }, 120000);
});


describe("tabla con palabra clave y calendario semanal (U-197, U-229, U-233)", () => {
  it("la palabra clave filtra filas y el modal de la franja crea una tarea que aparece sin recargar", async () => {
    const p = await web.open();
    await ensureSpace(p);
    await clickButton(p, "Nueva base de datos");
    await p.waitFor("[...document.querySelectorAll('button')].some(b => b.innerText.trim() === 'Nueva fila')");
    for (const name of ["Taco", "Metro"]) {
      await clickButton(p, "Nueva fila");
      await p.waitFor("document.querySelector('[role=row][aria-label=\"Sin título\"] input')");
      await p.click('[role=row][aria-label="Sin título"] input[aria-label^="Título de la fila"]');
      await p.typeText(name); await p.key("Enter", "Enter", 13);
      await p.waitFor(`document.querySelector('[role=row][aria-label="${name}"]')`);
    }
    await p.click('input[type=search][aria-label="Buscar en esta base"]');
    await p.typeText("tac");
    await p.waitFor("!document.querySelector('[role=row][aria-label=\"Metro\"]') && document.querySelector('[role=row][aria-label=\"Taco\"]')", 8000);
    await p.eval("(() => { const i = document.querySelector('input[type=search]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true })); })()");
    await p.waitFor("document.querySelector('[role=row][aria-label=\"Metro\"]')", 8000);

    // propiedad de fecha + vista de calendario en modo semana
    await clickButton(p, "Nueva propiedad");
    await p.waitFor("document.querySelector('[aria-label=\"Nombre de la propiedad\"]')");
    await setValue(p, '[aria-label="Nombre de la propiedad"]', "Fecha");
    await setValue(p, '[role=combobox][aria-label="Tipo de propiedad"]', "date");
    await clickButton(p, "Añadir propiedad");
    await sleep(500);
    await setValue(p, '[role=combobox][aria-label="Tipo de vista nueva"]', "calendar");
    await clickButton(p, "Nueva vista");
    await p.waitFor("document.querySelector('[role=grid]')");
    await clickButton(p, "Semana");
    await p.waitFor("document.querySelector('[role=grid][aria-label=\"Calendario semanal\"]')", 8000);
    await p.eval("document.querySelector('[data-slot$=\"T10:00\"]').scrollIntoView({ block: 'center' })");
    await p.click('[data-slot$="T10:00"]');
    await p.waitFor("document.querySelector('[role=dialog]')", 8000);
    expect(await p.eval<string>(`${byLabel("Hora de inicio")}.value`)).toBe("10:00");
    await sleep(500); // el diálogo enfoca su campo al abrirse: sin pausa se pierde lo escrito
    await p.click('[role=dialog] input[id]'); // el primer campo es el título
    await p.typeText("Dentista");
    await clickButton(p, "Guardar");
    // si la franja de hoy ya pasó (según la hora a la que corra la prueba) la app pregunta antes de guardar: se confirma
    await sleep(500);
    if (await p.eval<boolean>("[...document.querySelectorAll('[role=dialog] button')].some(b => b.innerText.trim() === 'Guardar como vencida')")) await clickButton(p, "Guardar como vencida");
    await p.waitFor("[...document.querySelectorAll('[role=grid] button')].some(b => b.getAttribute('aria-label')?.startsWith('Dentista 10:00'))", 10000);
    await p.close();
  }, 120000);
});
