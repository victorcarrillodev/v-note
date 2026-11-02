// Medición (no es un test): latencia por tecla según el tamaño de la página, con Yjs activo.
import { startApp, stopApp, find, runAsync } from "./webdriver";
await startApp();
await find(".bn-editor[contenteditable=true]");
for (const n of [500, 1000, 2000, 5000]) {
  const r = await runAsync<{ n: number; loadMs: number; p50: number; p95: number }>(`
    const done = arguments[arguments.length-1];
    (async () => {
      const ed = window.__editor;
      const blocks = Array.from({ length: ${n} }, (_, i) => ({ type: 'paragraph', content: 'Bloque número ' + i + ' con algo de texto para simular contenido real.' }));
      const t0 = performance.now();
      ed.replaceBlocks(ed.document, blocks);
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
      const loadMs = performance.now() - t0;
      ed.setTextCursorPosition(ed.document[Math.floor(${n}/2)], 'end'); ed.focus();
      const s = [];
      for (let i = 0; i < 20; i++) { const t = performance.now(); ed.insertInlineContent('x'); await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0))); s.push(performance.now() - t); }
      s.sort((a, b) => a - b);
      done({ n: ${n}, loadMs: Math.round(loadMs), p50: Math.round(s[10]), p95: Math.round(s[19]) });
    })();
  `);
  console.log(JSON.stringify(r));
}
await stopApp();
