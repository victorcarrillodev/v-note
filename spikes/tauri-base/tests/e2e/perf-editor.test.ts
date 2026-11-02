// T-006 (prueba primero): escritura en una página de 10 000 bloques (RNF-2). Presupuesto: p95 < 100 ms por tecla.
import { test, expect, beforeAll, afterAll } from "bun:test";
import { startApp, stopApp, find, runAsync as run } from "./webdriver";
import { appendFileSync } from "node:fs";

beforeAll(startApp, 60000);
afterAll(stopApp);

test("10 000 bloques: latencia de escritura dentro del presupuesto", async () => {
  await find(".bn-editor[contenteditable=true]");
  const result = await run<{ loadMs: number; p50: number; p95: number; max: number }>(`
    const ed = window.__editor;
    const blocks = Array.from({ length: 10000 }, (_, i) => ({ type: 'paragraph', content: 'Bloque número ' + i + ' con algo de texto para simular contenido real.' }));
    const t0 = performance.now();
    ed.replaceBlocks(ed.document, blocks);
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
    const loadMs = performance.now() - t0;
    ed.setTextCursorPosition(ed.document[5000], 'end');
    ed.focus();
    const samples = [];
    for (let i = 0; i < 30; i++) {
      const s = performance.now();
      ed.insertInlineContent('x');
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
      samples.push(performance.now() - s);
    }
    samples.sort((a, b) => a - b);
    return { loadMs, p50: samples[15], p95: samples[28], max: samples[29] };
  `.replace(/^/, "const done = arguments[arguments.length-1]; (async()=>{").replace(/return \{ loadMs[^}]*\};\s*$/, "done({ loadMs, p50: samples[15], p95: samples[28], max: samples[29] });})();"));
  appendFileSync(new URL("../../out/perf.log", import.meta.url).pathname, JSON.stringify(result) + "\n");
  console.log("RNF-2 10 000 bloques:", result);
  expect(result.p95).toBeLessThan(100);
}, 180000);
