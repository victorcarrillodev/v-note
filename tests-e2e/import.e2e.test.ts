// T-397, T-398 (e2e real en Chrome): importar un ZIP de Notion con informe y cancelar una importación grande a la mitad.
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Page } from "./cdp";
import { clickButton, ensureSpace, setValue, startWeb, type Web } from "./webHarness";
import { notionExport, zipOf } from "../packages/core/tests/fixtures/importFixtures";

let web: Web, dir: string;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => { web = await startWeb(4186, 9345); dir = mkdtempSync(join(tmpdir(), "vnote-import-")); }, 120000);
afterAll(() => { web?.stop(); rmSync(dir, { recursive: true, force: true }); });
afterEach(async () => { await web?.closeAll(); });

async function chooseZip(p: Page, path: string) {
  await clickButton(p, "Importar");
  await p.waitFor("document.querySelector('select')", 10000);
  await setValue(p, 'section[aria-label="Importar"] select', "notion");
  await p.waitFor("document.querySelector('input[type=file][accept]')", 10000);
  const doc = await p.send<{ root: { nodeId: number } }>("DOM.getDocument", {});
  const q = await p.send<{ nodeId: number }>("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "input[type=file]" });
  await p.send("DOM.setFileInputFiles", { files: [path], nodeId: q.nodeId });
  await p.waitFor("!document.querySelector('section[aria-label=\"Importar\"] button:disabled') || [...document.querySelectorAll('section[aria-label=\"Importar\"] button')].some(b => b.innerText.trim() === 'Importar' && !b.disabled)", 10000);
}
/** Pulsa «Importar» del formulario (no el de la barra lateral, que tiene el mismo texto). */
const start = (p: Page) => p.eval("[...document.querySelectorAll('section[aria-label=\"Importar\"] button')].find(b => b.innerText.trim() === 'Importar').click()");
const treeTitles = (p: Page) => p.eval<string[]>("[...document.querySelectorAll('[role=treeitem]')].map(e => e.getAttribute('aria-label'))");

describe("importar en la aplicación real", () => {
  it("T-398: un ZIP de Notion se importa y el informe lista lo aproximado, omitido y roto", async () => {
    const p = await web.open();
    await ensureSpace(p);
    const zip = join(dir, "notion.zip");
    writeFileSync(zip, zipOf(notionExport()));
    await chooseZip(p, zip);
    await setValue(p, 'section[aria-label="Importar"] input[placeholder]', "Desde Notion");
    await start(p);
    await p.waitFor("document.querySelector('[role=region][aria-label=\"Informe de importación\"]')", 60000);
    const text = await p.eval<string>("document.querySelector('[role=region][aria-label=\"Informe de importación\"]').innerText");
    for (const s of ["Importado", "Aproximado", "Omitido", "Enlaces rotos", "Inexistente", "Presentación"]) expect(text).toContain(s);
    await clickButton(p, "Abrir lo importado");
    await p.waitFor("[...document.querySelectorAll('[role=treeitem]')].some(e => e.getAttribute('aria-label') === 'Desde Notion')", 15000);
  }, 180000);

  it("T-397: cancelar a la mitad no deja nada importado", async () => {
    const p = await web.open();
    await ensureSpace(p);
    const many = Array.from({ length: 4000 }, (_, i) => ({ path: `Carpeta ${i % 40}/Nota ${i}.md`, data: new TextEncoder().encode(`# Nota ${i}\n\nTexto **largo** ${"palabra ".repeat(60)}\n\n- uno\n- dos\n`) }));
    const zip = join(dir, "grande.zip");
    writeFileSync(zip, zipOf(many));
    await chooseZip(p, zip);
    await setValue(p, 'section[aria-label="Importar"] input[placeholder]', "Grande");
    await start(p);
    await p.waitFor("document.querySelector('progress[role=progressbar]') && Number(document.querySelector('progress[role=progressbar]').getAttribute('aria-valuenow')) > 0", 60000);
    await sleep(300);
    await p.eval("[...document.querySelectorAll('section[aria-label=\"Importar\"] button')].find(b => b.innerText.trim() === 'Cancelar').click()");
    await p.waitFor("document.body.innerText.includes('Importación cancelada')", 60000);
    await sleep(500);
    expect(await treeTitles(p)).not.toContain("Grande");
    // reabrir la vista de páginas: sigue sin haber nada
    expect(await p.eval<number>("document.querySelectorAll('[role=treeitem]').length")).toBe(0);
  }, 240000);
});
