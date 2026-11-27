// Verificación en la app de escritorio real (WebKitGTK, CSP de producción): código ejecutable, bloques de estudio, zoom y PDF adjunto.
import { it, expect } from "vitest";
import * as wd from "./webdriver";
import { resolve } from "node:path";
import { isolatedEnv, ensureWorkspace, newPage, editorEl, chooseOption } from "./helpers";
const { startApp, stopApp, run, click, type, sleep } = wd;
const ENTER = String.fromCharCode(0xe007);
// Binario de producción (CSP real y archivos empaquetados). La app es de instancia única: si hay otra abierta, ejecutar con `dbus-run-session`.
const RELEASE = resolve(__dirname, "../apps/desktop/src-tauri/target/release/vnote-desktop");

const until = async (script: string, ms = 30_000) => {
  const t0 = Date.now();
  while (!(await run<boolean>(`return !!(${script})`))) {
    if (Date.now() - t0 > ms) throw new Error(`Tiempo agotado: ${script}`);
    await sleep(250);
  }
};
const slash = async (q: string) => { const e = await editorEl(); await type(e, "/"); await sleep(500); await type(e, q); await sleep(800); await type(e, ENTER); await sleep(1500); };

/** PDF mínimo válido de una página con una línea de texto. */
function tinyPdf(text: string): string {
  const stream = `BT /F1 24 Tf 40 100 Td (${text}) Tj ET`;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  let out = "%PDF-1.4\n";
  const offsets = objects.map((o, i) => { const at = out.length; out += `${i + 1} 0 obj\n${o}\nendobj\n`; return at; });
  const xref = out.length;
  out += `xref\n0 6\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return out;
}

it("escritorio: CSP, código ejecutable, estudio, zoom y PDF", async () => {
  await startApp(RELEASE, isolatedEnv());
  try {
    await ensureWorkspace();
    await run("window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));");
    await newPage("estudio"); await click(await editorEl()); await slash("algoritmo");
    await until("document.querySelector('[data-testid=mermaid-drawing] svg') && document.querySelector('.bn-editor .katex')");
    await run("for (let i = 0; i < 5; i++) document.querySelector('[data-testid=page-zoom]').dispatchEvent(new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true }))");
    await sleep(800);
    expect(await run<string>("return document.querySelector('[data-testid=page-zoom]').style.getPropertyValue('--page-zoom')")).not.toBe("1");
    await run("document.querySelector('[aria-label=\\\"Restablecer zoom\\\"]').click()");
    await newPage("codigo"); await click(await editorEl()); await slash("código");
    for (const [language, code, expected, ms] of [["javascript", "6 * 7", "42", 30_000], ["python", "print(sum(range(5)))", "10", 180_000]] as const) {
      await chooseOption(".bn-editor [data-code-language]", language);
      await click(await wd.find(".bn-editor [data-code-content]"));
      await type(await editorEl(), String.fromCharCode(0xe009) + "a" + String.fromCharCode(0xe000));
      await type(await editorEl(), code);
      await sleep(500);
    await click(await wd.find(".bn-editor [data-run-code]"));
      await until(`document.querySelector('.bn-editor [data-run-output]')?.innerText.includes('${expected}')`, ms);
    }
    await newPage("conpdf"); await click(await editorEl());
    await run("const data = new DataTransfer(); data.items.add(new File([arguments[0]], 'teoria.pdf', { type: 'application/pdf' })); document.querySelector('.bn-editor').dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));", [tinyPdf("Teorema de Bayes")]);
    const preview = "[...document.querySelectorAll('button')].find(b => b.textContent === 'Previsualizar teoria.pdf')";
    await until(preview);
    await sleep(4000);
    await run(`${preview}.click()`);
    await until("(() => { const c = document.querySelector('[data-testid=note-surface] canvas'); return c && c.width >= 400 && c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 0 && v < 100); })()");
    await run("document.querySelector('[role=dialog] button').click()");
    await sleep(500);
    await run("[...document.querySelectorAll('aside button')].find(b => b.innerText.includes('Buscar')).click()");
    await sleep(800);
    await type(await wd.find("[cmdk-input]"), "Bayes");
    await until("document.querySelector('[cmdk-list]')?.innerText.includes('conpdf')", 15_000);

    expect(await run<string[]>("return window.__csp")).toEqual([]);
  } finally { await stopApp(); }
}, 400_000);
