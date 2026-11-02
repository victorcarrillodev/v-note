// T-005 (prueba primero): pegar HTML con formato y una imagen en WebKitGTK; el HTML inseguro no debe ejecutarse.
import { test, expect, beforeAll, afterAll } from "bun:test";
import { startApp, stopApp, find, click, run } from "./webdriver";

beforeAll(startApp, 60000);
afterAll(stopApp);

test("pegar HTML conserva la negrita y descarta scripts", async () => {
  const editor = await find(".bn-editor[contenteditable=true]");
  await click(editor);
  await run(`
    window.__pwned = false;
    const dt = new DataTransfer();
    dt.setData('text/html', '<p>hola <b>negrita</b></p><script>window.__pwned=true<\\/script><img src=x onerror="window.__pwned=true">');
    dt.setData('text/plain', 'hola negrita');
    document.querySelector('.bn-editor').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  `);
  await Bun.sleep(600);
  const hasBold = await run<boolean>("return !![...document.querySelectorAll('.bn-editor strong, .bn-editor b, .bn-editor [data-style-type=\"bold\"], .bn-editor [style*=\"bold\"]')].find(n => n.innerText.includes('negrita'))");
  const pwned = await run<boolean>("return window.__pwned");
  const scripts = await run<number>("return document.querySelectorAll('.bn-editor script').length");
  expect(hasBold).toBe(true);
  expect(pwned).toBe(false);
  expect(scripts).toBe(0);
}, 60000);

test("pegar una imagen no rompe el editor", async () => {
  const editor = await find(".bn-editor[contenteditable=true]");
  await click(editor);
  const survived = await run<boolean>(`
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([png], 'pixel.png', { type: 'image/png' }));
    try { document.querySelector('.bn-editor').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); } catch (e) { return false; }
    return true;
  `);
  await Bun.sleep(600);
  expect(survived).toBe(true);
  const alive = await run<boolean>("return document.querySelector('.bn-editor') !== null && document.querySelector('.bn-editor').isContentEditable");
  expect(alive).toBe(true);
}, 60000);
