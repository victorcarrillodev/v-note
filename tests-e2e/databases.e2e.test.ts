// T-265, T-266, T-283, T-284 (e2e real en Chrome): bases de datos y tableros kanban, con arrastre de ratón y persistencia.
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Page } from "./cdp";
import { clickButton, clickTab, ensureSpace, optionValue, setValue, startWeb, type Web } from "./webHarness";

let web: Web;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => { web = await startWeb(4177, 9336); }, 120000);
afterAll(() => web?.stop());
afterEach(async () => { await web?.closeAll(); });

const cardTitles = (p: Page, column: string) => p.eval<string[]>(`[...document.querySelectorAll('section[role=group][aria-label=${JSON.stringify(column)}] article')].map(a => a.getAttribute('aria-label'))`);

describe("base de datos en la aplicación real", () => {
  it("T-266: crear una base, añadir una propiedad y editar celdas; todo persiste al recargar", async () => {
    const p = await web.open();
    await ensureSpace(p);
    await clickButton(p, "Nueva base de datos");
    await p.waitFor("[...document.querySelectorAll('button')].some(b => b.innerText.trim() === 'Nuevo')");
    await clickButton(p, "Nueva propiedad");
    await p.waitFor("document.querySelector('[aria-label=\"Nombre de la propiedad\"]')");
    await setValue(p, '[aria-label="Nombre de la propiedad"]', "Monto");
    await setValue(p, '[role=combobox][aria-label="Tipo de propiedad"]', "number");
    await clickButton(p, "Añadir propiedad");
    await p.waitFor("[...document.querySelectorAll('[role=columnheader]')].some(h => h.innerText.includes('Monto'))");
    await clickButton(p, "Nuevo");
    await p.waitFor("document.querySelectorAll('[role=row][aria-label]').length >= 1");
    // título de la fila (teclado real)
    await p.click('input[aria-label^="Título de la fila"]');
    await p.typeText("Café"); await p.key("Enter", "Enter", 13);
    await p.waitFor("document.querySelector('[role=row][aria-label=\"Café\"]')");
    // valor numérico
    await p.click('[role=row][aria-label="Café"] input[aria-label="Monto"]');
    await p.typeText("45.5"); await p.key("Enter", "Enter", 13);
    await p.waitFor("document.querySelector('[role=row][aria-label=\"Café\"] input[aria-label=\"Monto\"]').value === '45.5' && document.activeElement === document.body");
    await sleep(700); // que se guarde y se relea antes de seguir editando
    // un valor inválido muestra el error y conserva el anterior
    await p.click('[role=row][aria-label="Café"] input[aria-label="Monto"]');
    await p.key("a", "KeyA", 65, 2); await p.typeText("abc");
    await p.key("Enter", "Enter", 13);
    await p.waitFor("document.querySelector('[role=alert]')");
    await sleep(800);
    await p.reload();
    await p.waitFor("document.querySelector('aside nav')", 20000);
    await p.click('[role=treeitem]');
    await p.waitFor("document.querySelector('[role=row][aria-label=\"Café\"]')", 15000);
    expect(await p.eval<string>("document.querySelector('[role=row][aria-label=\"Café\"] input[aria-label=\"Monto\"]').value")).toBe("45.5");
    await p.close();
  }, 120000);

  it("T-265: crear otra vista y cambiar entre vistas", async () => {
    const p = await web.open();
    await p.waitFor("document.querySelector('aside nav')", 20000);
    await p.click('[role=treeitem]');
    await p.waitFor("document.querySelector('[role=tab]')");
    await setValue(p, '[role=combobox][aria-label="Tipo de vista nueva"]', "list");
    await clickButton(p, "Nueva vista");
    await p.waitFor("[...document.querySelectorAll('[role=tab]')].some(t => t.innerText.trim() === 'Lista' && t.getAttribute('aria-selected') === 'true')");
    // T-271: la vista lista muestra la fila con su valor
    await p.waitFor("[...document.querySelectorAll('li')].some(li => li.innerText.includes('Café') && li.innerText.includes('45.5'))", 8000);
    // T-272: la galería muestra una tarjeta por fila
    await setValue(p, '[role=combobox][aria-label="Tipo de vista nueva"]', "gallery");
    await clickButton(p, "Nueva vista");
    await p.waitFor("document.querySelector('article[aria-label=\"Café\"]')", 8000);
    await clickTab(p, "Tabla");
    await p.waitFor("[...document.querySelectorAll('[role=tab]')].some(t => t.innerText.trim() === 'Tabla' && t.getAttribute('aria-selected') === 'true')");
    await p.close();
  }, 60000);
});

describe("fórmulas y filtros en la aplicación real", () => {
  it("T-269: la fórmula muestra su vista previa y el error en español; al guardarla, la columna calcula", async () => {
    const p = await web.open();
    await p.waitFor("document.querySelector('aside nav')", 20000);
    await p.click("[role=treeitem]");
    await p.waitFor("document.querySelector('[role=tab]')", 15000);
    await clickButton(p, "Nueva propiedad");
    await p.waitFor("document.querySelector('[aria-label=\"Nombre de la propiedad\"]')");
    await setValue(p, '[aria-label="Nombre de la propiedad"]', "Doble");
    await setValue(p, '[role=combobox][aria-label="Tipo de propiedad"]', "formula");
    await p.waitFor("document.querySelector('input[aria-label=\"Fórmula\"]')");
    await p.click('input[aria-label="Fórmula"]');
    await p.typeText('prop("Monto") / 0');
    await p.waitFor("document.querySelector('[role=status][aria-label=\"Vista previa de la fórmula\"]')?.innerText.includes('cero')", 8000);
    await setValue(p, 'input[aria-label="Fórmula"]', 'prop("Monto") * 2');
    await p.waitFor("document.querySelector('[role=status][aria-label=\"Vista previa de la fórmula\"]')?.innerText.includes('91')", 8000);
    await clickButton(p, "Añadir propiedad");
    await p.waitFor("[...document.querySelectorAll('[role=columnheader]')].some(h => h.innerText.includes('Doble'))");
    await p.waitFor("document.querySelector('[role=row][aria-label=\"Café\"]').innerText.includes('91')", 8000);
    await p.close();
  }, 60000);

  it("T-270: el panel de filtros filtra las filas y se puede quitar el filtro", async () => {
    const p = await web.open();
    await p.waitFor("document.querySelector('aside nav')", 20000);
    await p.click("[role=treeitem]");
    await p.waitFor("document.querySelector('[role=tab]')", 15000);
    await clickTab(p, "Tabla");
    await clickButton(p, "Filtros y orden");
    await p.waitFor("document.querySelector('[role=region][aria-label=\"Filtros y orden\"]')");
    await clickButton(p, "Añadir filtro");
    const monto = await optionValue(p, '[role=combobox][aria-label="Propiedad del filtro 1"]', "Monto");
    await setValue(p, '[role=combobox][aria-label="Propiedad del filtro 1"]', monto);
    await setValue(p, '[role=combobox][aria-label="Operador del filtro 1"]', "gt");
    await p.click('input[aria-label="Valor del filtro 1"]');
    await p.typeText("100");
    await p.waitFor("document.querySelectorAll('[role=row][aria-label=\"Café\"]').length === 0", 8000);
    await clickButton(p, "Quitar filtro 1");
    await p.waitFor("document.querySelector('[role=row][aria-label=\"Café\"]')", 8000);
    await p.close();
  }, 60000);
});

describe("vista de base de datos dentro de una nota", () => {
  it("T-264/T-277: se inserta con «/», muestra la misma base y un cambio hecho en la nota se ve en la base original", async () => {
    const p = await web.open();
    await p.waitFor("document.querySelector('aside nav')", 20000);
    await clickButton(p, "Nueva página");
    await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')?.value === ''");
    await p.click('[aria-label="Título de la página"]'); await p.typeText("Resumen"); await p.key("Enter", "Enter", 13);
    await p.waitFor("document.querySelector('.bn-editor[contenteditable=true]')");
    await p.eval("document.querySelector('.bn-editor').focus()"); await sleep(300);
    await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: "/", text: "/" }); await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: "/" });
    await sleep(400); await p.typeText("vista de base"); await sleep(500); await p.key("Enter", "Enter", 13);
    await p.waitFor("document.querySelector('.bn-editor [role=combobox][aria-label=\"Base de datos\"]')", 8000);
    await clickButton(p, "Insertar base de datos");
    await p.waitFor("document.querySelector('.bn-editor [role=row][aria-label=\"Café\"]')", 10000);
    // editar dentro de la nota
    await p.click('.bn-editor [role=row][aria-label="Café"] input[aria-label="Monto"]');
    await p.key("a", "KeyA", 65, 2); await p.typeText("99"); await p.key("Enter", "Enter", 13);
    await p.waitFor("document.querySelector('.bn-editor [role=row][aria-label=\"Café\"] input[aria-label=\"Monto\"]').value === '99' && document.activeElement === document.body", 8000);
    await sleep(900);
    // y en la base original
    await p.eval("[...document.querySelectorAll('[role=treeitem]')].find(e => e.getAttribute('aria-label') !== 'Resumen').click()");
    await p.waitFor("document.querySelector('[role=row][aria-label=\"Café\"] input[aria-label=\"Monto\"]')", 10000);
    expect(await p.eval<string>("document.querySelector('[role=row][aria-label=\"Café\"] input[aria-label=\"Monto\"]').value")).toBe("99");
    await p.close();
  }, 90000);
});

describe("calendario y línea de tiempo en la aplicación real", () => {
  const pad = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  const ym = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const openFirst = async (p: Page) => { await p.waitFor("document.querySelector('aside nav')", 20000); await p.click("[role=treeitem]"); await p.waitFor("document.querySelector('[role=tab]')", 15000); };
  const newView = async (p: Page, type: string) => {
    await setValue(p, '[role=combobox][aria-label="Tipo de vista nueva"]', type);
    await clickButton(p, "Nueva vista");
  };

  it("T-273/T-274: la fila aparece en su día y arrastrarla a otro día cambia su fecha", async () => {
    const p = await web.open();
    await openFirst(p);
    // propiedad de fecha + valor
    await clickButton(p, "Nueva propiedad");
    await p.waitFor("document.querySelector('[aria-label=\"Nombre de la propiedad\"]')");
    await setValue(p, '[aria-label="Nombre de la propiedad"]', "Fecha");
    await setValue(p, '[role=combobox][aria-label="Tipo de propiedad"]', "date");
    await clickButton(p, "Añadir propiedad");
    await p.waitFor("document.querySelector('[role=row][aria-label=\"Café\"] input[aria-label^=\"Fecha de inicio\"]')");
    await setValue(p, '[role=row][aria-label="Café"] input[aria-label^="Fecha de inicio"]', `${ym}-10`);
    await sleep(500);
    await newView(p, "calendar");
    await p.waitFor("document.querySelector('[role=grid]')");
    const cellOf = (day: number) => `[role=gridcell]:not([data-outside])[aria-label^="${day} de"]`;
    await p.waitFor(`document.querySelector('${cellOf(10)} button')`, 8000);
    const from = await p.center(`${cellOf(10)} button`);
    const to = await p.center(cellOf(14));
    await p.drag(from, to);
    await p.waitFor(`document.querySelector('${cellOf(14)} button')`, 8000);
    expect(await p.eval<number>(`document.querySelectorAll('${cellOf(10)} button').length`)).toBe(0);
    await p.close();
  }, 90000);

  it("T-275/T-276: la barra se mueve arrastrándola y se alarga con el borde derecho", async () => {
    const p = await web.open();
    await openFirst(p);
    await clickTab(p, "Calendario");
    await newView(p, "timeline");
    await p.waitFor("document.querySelector('button[aria-label^=\"Café:\"]')", 8000);
    const label = () => p.eval<string>(`document.querySelector('button[aria-label^="Café:"]').getAttribute('aria-label')`);
    expect(await label()).toBe(`Café: ${ym}-14`);
    // mover +2 días (32 px por día)
    const bar = await p.center('button[aria-label^="Café:"] span');
    await p.drag(bar, { x: bar.x + 64, y: bar.y });
    await p.waitFor(`document.querySelector('button[aria-label="Café: ${ym}-16"]')`, 8000);
    // alargar +3 días con el borde derecho
    const handle = await p.center('button[aria-label^="Café:"] [data-resize]');
    await p.drag(handle, { x: handle.x + 96, y: handle.y });
    await p.waitFor(`document.querySelector('button[aria-label="Café: ${ym}-16 → ${ym}-19"]')`, 8000);
    await sleep(500);
    await p.reload();
    await p.waitFor("document.querySelector('aside nav')", 20000);
    await p.click("[role=treeitem]");
    await p.waitFor("document.querySelector('[role=tab]')", 15000);
    await clickTab(p, "Línea de tiempo");
    await p.waitFor(`document.querySelector('button[aria-label="Café: ${ym}-16 → ${ym}-19"]')`, 8000);
    await p.close();
  }, 90000);
});

describe("tablero kanban en la aplicación real", () => {
  it("T-283/T-284: crear tarjetas, arrastrar entre columnas con el ratón y conservar columna y orden al recargar", async () => {
    const p = await web.open();
    await ensureSpace(p);
    await clickButton(p, "Nuevo tablero");
    await p.waitFor("document.querySelector('section[role=group][aria-label=\"Por hacer\"]')");
    for (const title of ["Alfa", "Beta"]) {
      await p.eval(`document.querySelector('section[role=group][aria-label="Por hacer"] button[aria-label="Nueva tarjeta"]').click()`);
      await p.waitFor("document.querySelector('section[role=group][aria-label=\"Por hacer\"] input[aria-label=\"Título de la nueva tarjeta\"]')");
      await p.click('section[role=group][aria-label="Por hacer"] input[aria-label="Título de la nueva tarjeta"]');
      await p.typeText(title); await p.key("Enter", "Enter", 13);
      await p.waitFor(`document.querySelector('section[role=group][aria-label="Por hacer"] article[aria-label=${JSON.stringify(title)}]')`);
    }
    expect(await cardTitles(p, "Por hacer")).toEqual(["Alfa", "Beta"]);

    // Arrastrar «Alfa» a la columna «Hecho» (ratón real)
    const from = await p.center('section[role=group][aria-label="Por hacer"] article[aria-label="Alfa"] span');
    const to = await p.center('section[role=group][aria-label="Hecho"]');
    await p.drag(from, to);
    await p.waitFor(`document.querySelector('section[role=group][aria-label="Hecho"] article[aria-label="Alfa"]')`, 8000);
    expect(await cardTitles(p, "Por hacer")).toEqual(["Beta"]);
    expect(await cardTitles(p, "Hecho")).toEqual(["Alfa"]);

    // Arrastrar «Beta» a «Hecho» por encima de «Alfa» (orden dentro de la columna)
    const b = await p.center('section[role=group][aria-label="Por hacer"] article[aria-label="Beta"] span');
    const a = await p.center('section[role=group][aria-label="Hecho"] article[aria-label="Alfa"]');
    await p.drag(b, { x: a.x, y: a.y - 18 });
    await p.waitFor(`document.querySelector('section[role=group][aria-label="Hecho"] article[aria-label="Beta"]')`, 8000);
    expect(await cardTitles(p, "Hecho")).toEqual(["Beta", "Alfa"]);

    await sleep(800);
    await p.reload();
    await p.waitFor("document.querySelector('aside nav')", 20000);
    await p.eval("[...document.querySelectorAll('[role=treeitem]')].at(-1).click()");
    await p.waitFor(`document.querySelector('section[role=group][aria-label="Hecho"] article')`, 15000);
    expect(await cardTitles(p, "Hecho")).toEqual(["Beta", "Alfa"]);
    expect(await cardTitles(p, "Por hacer")).toEqual([]);
    await p.close();
  }, 120000);

  it("T-286: abrir una tarjeta la muestra como página completa con el editor y se puede escribir", async () => {
    const p = await web.open();
    await p.waitFor("document.querySelector('aside nav')", 20000);
    await p.eval("[...document.querySelectorAll('[role=treeitem]')].at(-1).click()");
    await p.waitFor(`document.querySelector('button[aria-label="Abrir Alfa"]')`, 15000);
    await p.eval(`document.querySelector('button[aria-label="Abrir Alfa"]').click()`);
    await p.waitFor("document.querySelector('.bn-editor[contenteditable=true]')", 15000);
    expect(await p.eval<string>("document.querySelector('[aria-label=\"Título de la página\"]').value")).toBe("Alfa");
    await p.eval("document.querySelector('.bn-editor').focus()");
    await p.typeText("detalle de la tarjeta");
    await p.waitFor("document.querySelector('.bn-editor').innerText.includes('detalle de la tarjeta')");
    await p.close();
  }, 60000);
});
