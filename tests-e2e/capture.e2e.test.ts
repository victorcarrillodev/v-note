// T-374…T-379, T-382 (e2e real en Chrome): captura rápida dentro de la app — borrador, bandeja, espacio predeterminado y clasificar notas.
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Page } from "./cdp";
import { clickButton, ensureSpace, newPage, openFromTree, setValue, startWeb, type Web } from "./webHarness";

let web: Web;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => { web = await startWeb(4185, 9344); }, 120000);
afterAll(() => web?.stop());
afterEach(async () => { await web?.closeAll(); });

const dialog = "[role=dialog][aria-label=\"Captura rápida\"]";
const openCapture = async (p: Page) => { await clickButton(p, "Captura rápida"); await p.waitFor(`document.querySelector('${dialog} textarea')`, 10000); };
const closed = (p: Page) => p.waitFor(`!document.querySelector('${dialog}')`, 10000);
const treeTitles = (p: Page) => p.eval<string[]>("[...document.querySelectorAll('[role=treeitem]')].map(e => e.getAttribute('aria-label'))");

describe("captura rápida en la aplicación real", () => {
  it("T-374/T-376/T-375/T-382: borrador continuo, cancelar lo conserva y confirmar lo guarda en la bandeja", async () => {
    const p = await web.open();
    await ensureSpace(p);
    await openCapture(p);
    await p.click(`${dialog} textarea`); await p.typeText("Llamar a Ana sobre el contrato");
    await sleep(700); // el borrador se guarda solo
    await p.key("Escape", "Escape", 27);
    await closed(p);
    // T-376: al volver a abrirla el borrador sigue ahí, con aviso y botón para descartarlo
    await openCapture(p);
    expect(await p.eval<string>(`document.querySelector('${dialog} textarea').value`)).toBe("Llamar a Ana sobre el contrato");
    expect(await p.eval<string>(`document.querySelector('${dialog}').innerText`)).toContain("Borrador recuperado");
    // sobrevive a recargar la página (también si se cerró la aplicación)
    await p.reload();
    await p.waitFor("document.querySelector('aside nav')", 20000);
    await openCapture(p);
    expect(await p.eval<string>(`document.querySelector('${dialog} textarea').value`)).toBe("Llamar a Ana sobre el contrato");
    // T-375: confirmar guarda en la Bandeja y cierra
    await p.eval(`[...document.querySelectorAll('${dialog} button')].find(b => b.innerText.trim() === 'Guardar en la bandeja').click()`);
    await closed(p);
    await p.waitFor("[...document.querySelectorAll('[role=treeitem]')].some(e => e.getAttribute('aria-label') === 'Bandeja de entrada')", 10000);
    // el borrador ya no existe
    await openCapture(p);
    expect(await p.eval<string>(`document.querySelector('${dialog} textarea').value`)).toBe("");
    await p.key("Escape", "Escape", 27); await closed(p);
  }, 180000);

  it("T-376: descartar el borrador lo elimina", async () => {
    const p = await web.open();
    await ensureSpace(p);
    await openCapture(p);
    await p.click(`${dialog} textarea`); await p.typeText("descartar esto");
    await sleep(700);
    await p.eval(`[...document.querySelectorAll('${dialog} button')].find(b => b.innerText.trim() === 'Descartar borrador').click()`);
    await sleep(300);
    expect(await p.eval<string>(`document.querySelector('${dialog} textarea').value`)).toBe("");
    await p.key("Escape", "Escape", 27); await closed(p);
    await openCapture(p);
    expect(await p.eval<string>(`document.querySelector('${dialog}').innerText`)).not.toContain("Borrador recuperado");
  }, 120000);

  it("T-379/T-377: clasificar una nota de la bandeja (mover a una página y convertir en tarjeta) y espacio predeterminado", async () => {
    const p = await web.open();
    await ensureSpace(p);
    await newPage(p, "Destino");
    await clickButton(p, "Nuevo tablero");
    await p.waitFor("document.querySelector('section[role=group][aria-label=\"Por hacer\"]')", 15000);
    for (const text of ["nota para mover", "nota para tarjeta"]) {
      await openCapture(p);
      await p.click(`${dialog} textarea`); await p.typeText(text);
      await p.eval(`[...document.querySelectorAll('${dialog} button')].find(b => b.innerText.trim() === 'Guardar en la bandeja').click()`);
      await closed(p);
      await sleep(300);
    }
    // abrir la nota desde la bandeja (expandir si hace falta)
    await p.waitFor("[...document.querySelectorAll('[role=treeitem]')].some(e => e.getAttribute('aria-label') === 'Bandeja de entrada')", 10000);
    const openNote = async (title: string) => {
      if (!(await treeTitles(p)).includes(title)) {
        await p.eval("document.querySelector('[role=treeitem][aria-label=\"Bandeja de entrada\"] button').click()");
        await p.waitFor(`[...document.querySelectorAll('[role=treeitem]')].some(e => e.getAttribute('aria-label') === ${JSON.stringify(title)})`, 10000);
      }
      await openFromTree(p, title);
    };
    await openNote("nota para mover");
    await p.waitFor("document.querySelector('[role=region][aria-label=\"Nota de la bandeja\"]')", 10000);
    await p.click('[role=region][aria-label="Nota de la bandeja"] input[aria-label="Buscar página de destino"]'); await p.typeText("Dest");
    await p.waitFor("document.querySelector('button[aria-label=\"Mover a Destino\"]')", 10000);
    await p.eval("document.querySelector('button[aria-label=\"Mover a Destino\"]').click()");
    await p.waitFor("!document.querySelector('[role=region][aria-label=\"Nota de la bandeja\"]')", 10000);
    expect(await p.eval<string>("document.body.innerText")).toContain("La nota salió de la bandeja");

    await openNote("nota para tarjeta");
    await p.waitFor("document.querySelector('[role=region][aria-label=\"Nota de la bandeja\"] select')", 10000);
    await p.eval("[...document.querySelectorAll('[role=region][aria-label=\"Nota de la bandeja\"] button')].find(b => b.innerText.trim() === 'Crear tarjeta').click()");
    await p.waitFor("!document.querySelector('[role=region][aria-label=\"Nota de la bandeja\"]')", 10000);
  }, 240000);

  it("T-377/T-378: espacio predeterminado, captura sin abrirlo y elegir otro si se eliminó", async () => {
    const p = await web.open();
    await ensureSpace(p, "Personal");
    const spaces = () => clickButton(p, "Espacios de trabajo");
    // crear un segundo espacio: queda abierto, pero el predeterminado sigue siendo Personal
    await spaces();
    await p.waitFor("document.querySelector('input[aria-label=\"Nombre del espacio\"]')", 10000);
    await setValue(p, 'input[aria-label="Nombre del espacio"]', "Trabajo");
    await clickButton(p, "Crear espacio");
    await p.waitFor("document.querySelector('aside')?.innerText.startsWith('Trabajo')", 15000); // el espacio nuevo queda abierto
    // T-375: la captura va al predeterminado aunque esté abierto otro espacio
    await openCapture(p);
    expect(await p.eval<string>(`document.querySelector('${dialog}').innerText`)).toContain("«Personal»");
    await p.click(`${dialog} textarea`); await p.typeText("para Personal");
    await p.eval(`[...document.querySelectorAll('${dialog} button')].find(b => b.innerText.trim() === 'Guardar en la bandeja').click()`);
    await closed(p);
    expect(await treeTitles(p)).not.toContain("Bandeja de entrada"); // el espacio abierto (Trabajo) no la tiene
    // T-377: cambiar el predeterminado en el gestor de espacios
    await spaces();
    await p.waitFor("document.querySelector('button[aria-label=\"Usar Trabajo para la captura rápida\"]')", 10000);
    await p.eval("document.querySelector('button[aria-label=\"Usar Trabajo para la captura rápida\"]').click()");
    await p.waitFor("document.querySelector('button[aria-label=\"Usar Trabajo para la captura rápida\"]').getAttribute('aria-pressed') === 'true'", 10000);
    await p.eval("document.querySelector('button[aria-label=\"Abrir Personal\"]').click()");
    await p.waitFor("document.querySelector('aside nav')", 15000);
    await p.waitFor("[...document.querySelectorAll('[role=treeitem]')].some(e => e.getAttribute('aria-label') === 'Bandeja de entrada')", 10000); // la nota anterior cayó en Personal
    await openCapture(p);
    expect(await p.eval<string>(`document.querySelector('${dialog}').innerText`)).toContain("«Trabajo»");
    await p.key("Escape", "Escape", 27); await closed(p);
    // T-378: eliminar el predeterminado (Trabajo) obliga a elegir otro en la siguiente captura
    await spaces();
    await p.eval("document.querySelector('button[aria-label=\"Eliminar espacio Trabajo\"]').click()");
    await p.waitFor("document.querySelector('[role=alertdialog] input')", 10000);
    await p.click("[role=alertdialog] input"); await p.typeText("Trabajo");
    await p.eval("[...document.querySelectorAll('[role=alertdialog] button')].find(b => b.innerText.trim() === 'Eliminar').click()");
    await p.waitFor("!document.querySelector('button[aria-label=\"Abrir Trabajo\"]')", 10000);
    await p.eval("document.querySelector('button[aria-label=\"Abrir Personal\"]').click()");
    await p.waitFor("document.querySelector('aside nav')", 15000);
    await clickButton(p, "Captura rápida");
    await p.waitFor(`document.querySelector('${dialog}')?.innerText.includes('Elige el espacio')`, 10000);
    expect(await p.eval<boolean>(`!document.querySelector('${dialog} textarea')`)).toBe(true);
    await p.eval(`document.querySelector('${dialog} button[aria-label="Usar Personal para la captura rápida"]').click()`);
    await p.waitFor(`document.querySelector('${dialog} textarea')`, 10000);
  }, 240000);
});
