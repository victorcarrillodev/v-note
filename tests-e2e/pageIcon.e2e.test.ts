// Ícono de página en Chrome real: se busca un emoji en el selector, aparece en la cabecera (no en la barra lateral), sobrevive a recargar y se quita.
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Page } from "./cdp";
import { clickButton, ensureSpace, newPage, openFromTree, startWeb, type Web } from "./webHarness";

let web: Web;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => { web = await startWeb(4198, 9358); }, 120000);
afterAll(() => web?.stop());
afterEach(async () => { await web?.closeAll(); });

const clickLabel = (p: Page, label: string) => p.eval(`(() => { const b = document.querySelector('button[aria-label=${JSON.stringify(label)}]'); if (!b) throw new Error('sin botón ' + ${JSON.stringify(label)}); b.click(); })()`);
const treeIcon = (p: Page, title: string) => p.eval<string>(`[...document.querySelectorAll('[role=treeitem]')].find(e => e.getAttribute('aria-label') === ${JSON.stringify(title)})?.querySelector('span[aria-hidden=true]:not(.w-5):not([data-row-title])')?.innerText ?? ''`);

describe("ícono de página (navegador real)", () => {
  it("elegir un emoji por búsqueda lo muestra en la cabecera y no en el árbol, persiste al recargar y se quita desde el selector", async () => {
    const p = await web.open();
    await ensureSpace(p);
    await newPage(p, "Con ícono");
    await clickButton(p, "Añadir ícono");
    await p.waitFor("document.querySelector('input[type=search][aria-label=\"Buscar un emoji…\"]')");
    await p.click("input[type=search]"); await p.typeText("cohete");
    await p.waitFor("!!document.querySelector('button[aria-label^=\"🚀\"]')");
    await clickLabel(p, "🚀 cohete");
    await p.waitFor("document.querySelector('[data-testid=page-icon]')?.innerText.includes('🚀')");
    expect(await treeIcon(p, "Con ícono")).toBe(""); // la barra lateral muestra solo el título

    await p.eval("location.reload()");
    await ensureSpace(p);
    await openFromTree(p, "Con ícono");
    await p.waitFor("document.querySelector('[data-testid=page-icon]')?.innerText.includes('🚀')");

    await clickLabel(p, "Cambiar ícono");
    await p.waitFor("!!document.querySelector('[role=group][aria-label=\"Elegir ícono\"]')");
    await p.eval("[...document.querySelectorAll('[role=group][aria-label=\"Elegir ícono\"] button')].find(b => b.innerText.trim() === 'Quitar').click()");
    await p.waitFor("!document.querySelector('[data-testid=page-icon]')");
    expect(await treeIcon(p, "Con ícono")).toBe("");
  }, 120000);
});
