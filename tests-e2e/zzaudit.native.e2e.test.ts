import { it } from "vitest";
import { writeFileSync } from "node:fs";
import * as wd from "./webdriver";
import { isolatedEnv, launch, ensureWorkspace, newPage, editorEl } from "./helpers";
const { stopApp, run, click, type, sleep } = wd;
const ENTER = "";

it("auditoría en la app real", async () => {
  await launch(isolatedEnv());
  try {
    await ensureWorkspace();
    await run("window.__errs = []; const o = console.error; console.error = (...a) => { window.__errs.push(a.map(String).join(' ').slice(0,200)); o(...a); }; window.addEventListener('error', e => window.__errs.push(String(e.message))); window.addEventListener('unhandledrejection', e => window.__errs.push('rej ' + String(e.reason))); document.addEventListener('securitypolicyviolation', e => window.__errs.push('CSP ' + e.violatedDirective + ' ' + e.blockedURI));");
    const errs = async (tag: string) => console.log("ERRS", tag, await run<string>("const r = JSON.stringify([...new Set(window.__errs)]).slice(0,900); window.__errs = []; return r"));
    const shot = async (n: string) => { const r = await fetch("http://127.0.0.1:4444/session/" + (globalThis as any).__sid + "/screenshot").catch(() => null); void r; void n; };
    void shot; void writeFileSync;
    const slash = async (q: string) => { const ed = await editorEl(); await type(ed, "/"); await sleep(500); await type(ed, q); await sleep(800); await type(ed, ENTER); await sleep(2500); };

    await newPage("algo"); await click(await editorEl()); await slash("algoritmo");
    console.log("TIPOS", await run<string>("return [...document.querySelectorAll('.bn-editor [data-content-type]')].map(e => e.dataset.contentType).join(',')"));
    console.log("MERMAID", await run<string>("const d = document.querySelector('[data-testid=mermaid-drawing] svg'); const a = document.querySelector('.vn-study [role=alert]'); return d ? 'svg ' + Math.round(d.getBoundingClientRect().width) + 'x' + Math.round(d.getBoundingClientRect().height) + ' styled=' + getComputedStyle(d.querySelector('.node rect, .node polygon, rect')).fill : (a ? a.innerText : 'nada')"));
    console.log("KATEX", await run<string>("return !!document.querySelector('.bn-editor .katex') + ' fonts=' + [...document.fonts].filter(f => f.family.includes('KaTeX') && f.status === 'loaded').length + ' errored=' + [...document.fonts].filter(f => f.status === 'error').length"));
    await errs("algoritmo");

    for (const q of ["apuntes", "comparativa"]) {
      await newPage(q); await click(await editorEl()); await slash(q);
      console.log("TIPOS", q, await run<number>("return document.querySelectorAll('.bn-editor [data-content-type]').length"));
    }
    await errs("plantillas");

    // Zoom con Ctrl + rueda: tamaños y posición de clic en la app real
    const probe = "const t = document.querySelector('.bn-editor table td'); const m = document.querySelector('main'); return JSON.stringify({ font: getComputedStyle(document.querySelector('.bn-editor')).fontSize, scrollX: m.scrollWidth - m.clientWidth, z: document.querySelector('[data-testid=page-zoom]').style.getPropertyValue('--page-zoom') })";
    await run("for (let i = 0; i < 5; i++) document.querySelector('[data-testid=page-zoom]').dispatchEvent(new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true }))");
    await sleep(800);
    console.log("ZOOM150", await run<string>(probe));
    await run("document.querySelector('[aria-label=\"Restablecer zoom\"]').click()");

    // Diagrama de lienzo con zoom aplicado ANTES de abrir la página
    await newPage("lienzo"); await click(await editorEl()); await slash("diagrama de flujo");
    await run("document.querySelector('[data-canvas-frame] [role=toolbar] button')?.click()"); await sleep(1200);
    await run("for (let i = 0; i < 5; i++) document.querySelector('[data-testid=page-zoom]').dispatchEvent(new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true }))");
    await sleep(1000);
    const flow = "return document.querySelector('.react-flow__viewport')?.style.transform ?? 'sin lienzo'";
    console.log("FLOW vivo", await run<string>(flow));
    await click(await wd.findX('//*[@role="treeitem" and @aria-label="apuntes"]')); await sleep(800);
    await click(await wd.findX('//*[@role="treeitem" and @aria-label="lienzo"]')); await sleep(2500);
    console.log("FLOW reabierto", await run<string>(flow));
    await run("document.querySelector('[aria-label=\"Restablecer zoom\"]')?.click()");
    await errs("zoom");

    // Tarjeta: escribir y pasar enseguida a Repaso (sin esperar el guardado)
    await newPage("tarjetas"); await click(await editorEl()); await slash("tarjeta de estudio");
    const q = await wd.find(".vn-flashcard label:nth-of-type(1) textarea"); await click(q); await type(q, "Pregunta rápida");
    await click(await wd.button("Repaso")); await sleep(1500);
    console.log("REPASO", await run<string>("return document.querySelector('main').innerText.replace(/\\n+/g, ' | ').slice(0,250)"));
    await errs("tarjetas");
  } finally { await stopApp(); }
}, 200000);
