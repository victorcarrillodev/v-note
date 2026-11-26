// Bloques de estudio en Chrome real: ecuación, Mermaid, plantilla y repaso de una tarjeta.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync } from "node:fs";
import { startWeb, ensureSpace, newPage, clickButton, type Web } from "./webHarness";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let web: Web;
beforeAll(async () => { web = await startWeb(4209, 9409); }, 180000);
afterAll(async () => { await web?.closeAll(); web?.stop(); });

describe("estudio (web)", () => {
  it("plantilla de algoritmo, ecuación, diagrama y tarjeta con repaso", async () => {
    const p = await web.open();
    await ensureSpace(p);
    await newPage(p, "Búsqueda binaria");
    await p.click(".bn-editor");
    const slash = async (q: string) => { await p.typeText("/"); await sleep(300); await p.typeText(q); await sleep(500); await p.key("Enter", "Enter", 13); await sleep(900); };
    await slash("Algoritmo");
    await p.waitFor("!!document.querySelector('[data-testid=mermaid-drawing] svg')", 20000);
    expect(await p.eval<boolean>("!!document.querySelector('.bn-editor .katex')")).toBe(true);
    const shot = async (name: string) => { const s = await p.send("Page.captureScreenshot", {}); if (process.env.SHOTS) writeFileSync(`${process.env.SHOTS}/${name}.png`, Buffer.from(s.data, "base64")); };
    await p.eval("document.querySelector('[data-testid=mermaid-drawing]').scrollIntoView({ block: 'start' })"); await sleep(400);
    await shot("study-page");

    // Una tarjeta al final y su repaso.
    await p.eval("(() => { const e = document.querySelector('.bn-editor'); e.focus(); const all = e.querySelectorAll('.bn-inline-content'); const r = document.createRange(); r.selectNodeContents(all[all.length-1]); r.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(r); })()");
    await sleep(200); await p.key("Enter", "Enter", 13); await sleep(200);
    await slash("Tarjeta");
    await p.eval("document.querySelector('.vn-flashcard').scrollIntoView({ block: 'center' })"); await sleep(400); // el clic real necesita que esté a la vista
    await p.click(".vn-flashcard label:nth-of-type(1) textarea"); await p.typeText("¿Complejidad?");
    await p.click(".vn-flashcard label:nth-of-type(2) textarea"); await p.typeText("O(log n)");
    await sleep(1500);
    await clickButton(p, "Repaso");
    await sleep(1500);
    await p.waitFor("document.body.innerText.includes('¿Complejidad?') && document.body.innerText.includes('Mostrar respuesta')", 10000);
    await clickButton(p, "Mostrar respuesta"); await sleep(300);
    await shot("study-review");
    await clickButton(p, "Bien");
    await p.waitFor("document.body.innerText.includes('No quedan tarjetas por repasar hoy.')", 10000);
    // Al volver a la página, la tarjeta muestra su próximo repaso.
    await p.eval("[...document.querySelectorAll('[role=treeitem]')].find(e => e.getAttribute('aria-label') === 'Búsqueda binaria').click()");
    await p.waitFor("document.querySelector('.vn-flashcard')?.innerText.includes('Próximo repaso')", 10000);
    expect(p.errors).toEqual([]);
  }, 150000);
});
