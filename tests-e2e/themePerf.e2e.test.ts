// Spec 006 (T-086, RNF-3): cambiar de tema en una página larga (≥ 2000 bloques) tarda menos de 100 ms hasta el siguiente fotograma.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startWeb, ensureSpace, newPage, type Web } from "./webHarness";

let web: Web;
beforeAll(async () => { web = await startWeb(4192, 9392); }, 180000);
afterAll(async () => { await web?.closeAll(); web?.stop(); });

describe("rendimiento del cambio de tema", () => {
  it("con más de 2000 bloques el cambio llega al siguiente fotograma en menos de 100 ms", async () => {
    const p = await web.open();
    await ensureSpace(p);
    await newPage(p, "Larga");
    await p.waitFor("document.querySelector('.bn-editor[contenteditable=true]')", 20000);
    // Crea 2050 bloques con Enter (el editor no admite pegar texto sintético por CDP): cada pulsación tarda unos 10 ms.
    await p.eval("document.querySelector('.bn-editor').focus()");
    for (let i = 0; i < 2050; i++) { await p.typeText("Línea " + i); await p.key("Enter", "Enter", 13); }
    await p.waitFor("document.querySelectorAll('.bn-block-outer').length >= 2000", 60000);
    const blocks = await p.eval<number>("document.querySelectorAll('.bn-block-outer').length");
    expect(blocks).toBeGreaterThanOrEqual(2000);
    // Cada cambio se mide dos veces: hasta recalcular estilos y maquetar (síncrono) y hasta el segundo fotograma.
    const run = (seq: [string, string | null][]) => p.eval<{ sync: number; frame: number }[]>(`new Promise((resolve) => {
      const root = document.documentElement; const seq = ${JSON.stringify(seq)}; const out = []; let i = 0;
      const step = () => {
        if (i >= seq.length) { resolve(out); return; }
        const [theme, palette] = seq[i++];
        const t0 = performance.now();
        root.setAttribute('data-theme', theme); if (palette) root.setAttribute('data-palette', palette); else root.removeAttribute('data-palette');
        getComputedStyle(document.body).color; document.body.offsetHeight;
        const sync = performance.now() - t0;
        requestAnimationFrame(() => requestAnimationFrame(() => { out.push({ sync, frame: performance.now() - t0 }); setTimeout(step, 50); }));
      };
      step();
    })`);
    const base = await run([["light", null], ["dark", null], ["light", null], ["dark", null]]);
    const colors = await run([["light", "oceano"], ["dark", "esmeralda"], ["light", "bosque"], ["dark", "grafito"], ["light", "atardecer"], ["dark", "medianoche"]]);
    console.log("base (Claro/Oscuro):", JSON.stringify(base.map((x) => [Math.round(x.sync), Math.round(x.frame)])));
    console.log("temas de color:", JSON.stringify(colors.map((x) => [Math.round(x.sync), Math.round(x.frame)])));
    const ms = Math.max(...colors.map((x) => x.frame));
    console.log(`cambio de tema con ${blocks} bloques: peor de 6 cambios = ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(100);
    await p.close();
  }, 300000);
});
