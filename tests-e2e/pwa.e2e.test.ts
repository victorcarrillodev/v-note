// T-146, T-147, T-148 (e2e real en Chrome): la PWA es instalable, arranca sin red y se puede trabajar sin conexión.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { Page, launchChrome } from "./cdp";

const WEB = resolve(__dirname, "../apps/web");
const SERVER_PORT = 4174, CDP_PORT = 9333;
const URL_ = `http://localhost:${SERVER_PORT}/`;
let server: ChildProcess, chrome: { stop: () => void };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  execFileSync("bunx", ["vite", "build"], { cwd: WEB, stdio: "ignore" });
  await startServer();
  chrome = await launchChrome(CDP_PORT);
}, 120000);
afterAll(() => { chrome?.stop(); stopServer(); });

async function startServer() {
  server = spawn("bunx", ["vite", "preview", "--port", String(SERVER_PORT), "--strictPort"], { cwd: WEB, stdio: "ignore" });
  for (let i = 0; i < 50; i++) { try { await fetch(URL_); return; } catch { await sleep(200); } }
}
function stopServer() {
  server?.kill("SIGKILL");
  try { execFileSync("pkill", ["-f", `vite preview --port ${SERVER_PORT}`]); } catch { /* ya terminó */ }
}
/** Crea el espacio si la app está en el primer inicio, y espera a que la barra lateral esté lista. */
const SPACE_EXPR = `(() => { const l = [...document.querySelectorAll('label')].find(l => l.innerText.trim() === 'Nombre del espacio'); return l && document.getElementById(l.htmlFor); })()`; // el rediseño usa una etiqueta visible, no aria-label
async function ensureSpace(p: Page, name = "Personal") {
  await p.waitFor(`${SPACE_EXPR} || document.querySelector('aside nav')`, 20000);
  if (await p.eval<boolean>(`!!${SPACE_EXPR}`)) {
    await p.eval(`(() => { const i = ${SPACE_EXPR}; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ${JSON.stringify(name)}); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await p.eval("[...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Crear espacio').click()");
  }
  await p.waitFor("document.querySelector('aside nav')", 20000);
}
const swReady = (p: Page) => p.waitFor("navigator.serviceWorker.controller !== null", 30000);

describe("PWA", () => {
  it("T-146: el navegador la considera instalable (manifiesto, iconos y service worker)", async () => {
    const p = await Page.open(CDP_PORT, URL_);
    await p.waitFor("document.readyState === 'complete'");
    await p.eval("navigator.serviceWorker.ready.then(() => true)");
    await sleep(500);
    const manifest = await p.send("Page.getAppManifest");
    expect(manifest.errors ?? []).toEqual([]);
    const parsed = JSON.parse(manifest.data);
    expect(parsed.display).toBe("standalone");
    expect(parsed.icons.length).toBeGreaterThanOrEqual(3);
    const inst = await p.send("Page.getInstallabilityErrors");
    expect(inst.installabilityErrors).toEqual([]);
    await p.close();
  }, 60000);

  it("T-147: tras la primera visita, la app arranca con la red cortada", async () => {
    const p = await Page.open(CDP_PORT, URL_);
    await p.waitFor("document.readyState === 'complete'");
    await p.eval("navigator.serviceWorker.ready.then(() => true)");
    await p.reload(); // el service worker ya controla la página
    await swReady(p);
    // Sin servidor: lo único que puede responder es la caché del service worker.
    stopServer();
    await sleep(500);
    expect(await fetch(URL_).then(() => true, () => false)).toBe(false);
    await p.reload();
    await p.waitFor("document.body.innerText.includes('Espacios de trabajo') || document.body.innerText.includes('Nueva página')", 20000);
    // El .wasm de SQLite también sale de la caché: se puede crear un espacio, que abre la base
    await p.waitFor(`${SPACE_EXPR}`);
    await p.eval(`(() => { const i = ${SPACE_EXPR}; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'Sin red'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await p.eval("[...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Crear espacio').click()");
    await p.waitFor("document.querySelector('aside nav') && document.body.innerText.includes('Nueva página')", 20000);
    await startServer();
    await p.close();
  }, 90000);

  it("T-148: sin red se puede crear, editar, buscar y reordenar; todo persiste al recargar", async () => {
    const p = await Page.open(CDP_PORT, URL_);
    await p.eval("navigator.serviceWorker.ready.then(() => true)");
    await p.reload();
    await swReady(p);
    await p.setOffline(true);
    await p.reload();
    await p.waitFor(`${SPACE_EXPR} || document.querySelector('aside nav')`, 20000);
    if (await p.eval<boolean>(`!!${SPACE_EXPR}`)) {
      await p.eval(`(() => { const i = ${SPACE_EXPR}; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'Personal'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      await p.eval("[...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Crear espacio').click()");
    }
    await p.waitFor("document.querySelector('aside nav')", 20000);

    const titles = () => p.eval<string[]>("[...document.querySelectorAll('[role=treeitem]')].map(e => e.getAttribute('aria-label'))");
    const newPage = async (title: string) => {
      const n = (await titles()).length;
      await p.eval("[...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Nueva página').click()");
      await p.waitFor(`document.querySelectorAll('[role=treeitem]').length === ${n + 1} && document.querySelector('[aria-label="Título de la página"]')?.value === ''`);
      await new Promise((r) => setTimeout(r, 500)); // el título se vuelve a montar al abrir la página: sin pausa se pierde lo escrito
      await sleep(600); // el título se vuelve a montar al abrir la página: sin esta pausa se pierde lo escrito
      await p.click('[aria-label="Título de la página"]');
      await p.typeText(title);
      await p.key("Enter", "Enter", 13);
      await p.waitFor(`[...document.querySelectorAll('[role=treeitem]')].some(e => e.getAttribute('aria-label') === ${JSON.stringify(title)})`);
    };
    await newPage("Alfa"); await newPage("Beta"); await newPage("Gamma");
    expect(await titles()).toEqual(["Alfa", "Beta", "Gamma"]);

    // editar: el texto va al documento
    await p.click('[role=treeitem][aria-label="Beta"]');
    await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')?.value === 'Beta'");
    await sleep(500); // el editor de la página anterior se desmonta y monta el de Beta
    await p.waitFor("document.querySelector('.bn-editor[contenteditable=true]')");
    await p.click(".bn-editor[contenteditable=true]");
    await p.eval("document.querySelector('.bn-editor').focus()");
    await sleep(300);
    await p.typeText("contenido escrito sin conexion");
    await p.waitFor("document.querySelector('.bn-editor').innerText.includes('sin conexion')");
    await sleep(1500); // guardado automático

    // buscar con la paleta (Ctrl+K)
    await p.key("k", "KeyK", 75, 2);
    await p.waitFor("document.querySelector('[cmdk-input]')");
    await p.click("[cmdk-input]");
    await p.typeText("sin conex");
    await p.waitFor("[...document.querySelectorAll('[cmdk-list] [role=option]')].some(o => o.textContent.includes('Beta'))", 10000);
    await p.key("Escape", "Escape", 27);
    await p.waitFor("!document.querySelector('[cmdk-input]')");

    // reordenar arrastrando Gamma por encima de Alfa (ratón real)
    const from = await p.center('[role=treeitem][aria-label="Gamma"]');
    const to = await p.center('[role=treeitem][aria-label="Alfa"]');
    await p.drag(from, { x: to.x, y: to.y - 12 }); // cuarto superior de la fila: «antes de»
    await p.waitFor(`document.querySelector('[role=treeitem]').getAttribute('aria-label') === 'Gamma'`, 8000);
    const reordered = await titles();
    expect(reordered).toEqual(["Gamma", "Alfa", "Beta"]);

    // todo persiste tras recargar, aún sin red
    await sleep(800);
    await p.reload();
    await p.waitFor("document.querySelector('aside nav') && document.querySelectorAll('[role=treeitem]').length === 3", 20000);
    expect(await titles()).toEqual(reordered);
    await sleep(1000); // la barra lateral aún se está montando tras recargar: un clic inmediato se pierde
    await p.click('[role=treeitem][aria-label="Beta"]');
    await p.waitFor("document.querySelector('.bn-editor')?.innerText.includes('sin conexion')", 15000);
    await p.close();
  }, 120000);

  it("T-113: arrastrar una página con sus hijas la mueve completa, y arrastrar «dentro» la anida", async () => {
    const p = await Page.open(CDP_PORT, URL_);
    await p.eval("navigator.serviceWorker.ready.then(() => true)");
    await ensureSpace(p);
    const rowsInfo = () => p.eval<string[]>("[...document.querySelectorAll('[role=treeitem]')].map(e => e.getAttribute('aria-level') + ':' + e.getAttribute('aria-label'))");
    const click = (label: string) => p.eval(`[...document.querySelectorAll('button')].find(b => b.innerText.trim() === ${JSON.stringify(label)}).click()`);
    const rename = async (title: string) => {
      await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')?.value === ''");
      await new Promise((r) => setTimeout(r, 500)); // el título se vuelve a montar al abrir la página: sin pausa se pierde lo escrito
      await sleep(600); // ídem
      await p.click('[aria-label="Título de la página"]'); await p.typeText(title); await p.key("Enter", "Enter", 13);
      await p.waitFor(`[...document.querySelectorAll('[role=treeitem]')].some(e => e.getAttribute('aria-label') === ${JSON.stringify(title)})`);
    };
    const before = (await rowsInfo()).length;
    await click("Nueva página"); await rename("Padre");
    await click("Nueva subpágina"); await rename("Hija");
    await click("Nueva página"); await rename("Otra");
    // Orden esperado al final: ... Padre(1) Hija(2) Otra(1)
    await p.waitFor(`document.querySelectorAll('[role=treeitem]').length === ${before + 3}`);
    const list = await rowsInfo();
    expect(list.slice(-3)).toEqual(["1:Padre", "2:Hija", "1:Otra"]);

    // arrastra «Padre» por debajo de «Otra» (cuarto inferior): su hija debe viajar con ella
    const from = await p.center('[role=treeitem][aria-label="Padre"]');
    const otra = await p.center('[role=treeitem][aria-label="Otra"]');
    await p.drag(from, { x: otra.x, y: otra.y + 12 }); // cuarto inferior de «Otra»: «después de»
    await p.waitFor(`(() => { const l = [...document.querySelectorAll('[role=treeitem]')].map(e => e.getAttribute('aria-label')); return l.indexOf('Otra') < l.indexOf('Padre'); })()`, 8000);
    const after = await rowsInfo();
    expect(after.slice(-3)).toEqual(["1:Otra", "1:Padre", "2:Hija"]);

    // arrastra «Otra» al centro de «Padre»: pasa a ser su hija
    const o = await p.center('[role=treeitem][aria-label="Otra"]');
    const pa = await p.center('[role=treeitem][aria-label="Padre"]');
    await p.drag(o, pa);
    await p.waitFor(`[...document.querySelectorAll('[role=treeitem]')].some(e => e.getAttribute('aria-label') === 'Otra' && e.getAttribute('aria-level') === '2')`, 8000);
    await p.close();
  }, 120000);

  it("T-149/T-150: en el navegador avisa que los respaldos solo corren con la app abierta y que web y escritorio no comparten datos", async () => {
    const p = await Page.open(CDP_PORT, URL_);
    await ensureSpace(p);
    await p.eval("[...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Respaldo').click()");
    await p.waitFor("document.body.innerText.includes('solo se ejecutan mientras la aplicación esté abierta')");
    expect(await p.eval<string>("document.body.innerText")).toContain("no comparten datos");
    await p.close();
  }, 60000);

  it("T-151: una segunda pestaña con el mismo espacio avisa y no permite editar; al liberarse se puede reintentar", async () => {
    const first = await Page.open(CDP_PORT, URL_);
    await ensureSpace(first);
    const second = await Page.open(CDP_PORT, URL_);
    await second.waitFor("document.querySelector('[role=alert]')", 20000);
    expect(await second.eval<string>("document.querySelector('[role=alert]').innerText")).toContain("otra ventana");
    expect(await second.eval<boolean>("![...document.querySelectorAll('button')].some(b => b.innerText.trim() === 'Nueva página')")).toBe(true);
    // la primera sigue funcionando con normalidad
    expect(await first.eval<boolean>("[...document.querySelectorAll('button')].some(b => b.innerText.trim() === 'Nueva página')")).toBe(true);
    await first.close();
    await sleep(500);
    await second.eval("[...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Reintentar').click()");
    await second.waitFor("document.querySelector('aside nav') && [...document.querySelectorAll('button')].some(b => b.innerText.trim() === 'Nueva página')", 20000);
    await second.close();
  }, 90000);

  it("T-134b: al superar 5 000 bloques aparece el aviso para dividir la página y se puede seguir editando", async () => {
    const p = await Page.open(CDP_PORT, URL_);
    await ensureSpace(p);
    await p.eval("[...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Nueva página').click()");
    await p.waitFor("document.querySelector('.bn-editor[contenteditable=true]')");
    await sleep(500);
    await p.eval("document.querySelector('.bn-editor').focus()");
    // Pega 5 100 párrafos (separados por línea en blanco): cada uno pasa a ser un bloque
    await p.eval(`(() => { const dt = new DataTransfer(); dt.setData('text/plain', Array.from({ length: 5100 }, (_, i) => 'linea ' + i).join('\\n\\n')); document.querySelector('.bn-editor').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); })()`);
    await p.waitFor("document.querySelectorAll('.bn-editor .bn-block-outer').length > 5000", 60000);
    await p.waitFor("[...document.querySelectorAll('[role=status]')].some(e => /bloques/.test(e.innerText) && /dividirla/.test(e.innerText))", 15000);
    // sigue siendo editable
    await p.eval("document.querySelector('.bn-editor').focus()");
    await p.typeText("seguimos escribiendo");
    await p.waitFor("document.querySelector('.bn-editor').innerText.includes('seguimos escribiendo')", 15000);
    await p.close();
  }, 180000);

  it("T-134: con 2 000 bloques y Yjs activo, cada tecla tarda de mediana < 50 ms y p95 < 100 ms", async () => {
    const p = await Page.open(CDP_PORT, URL_);
    await ensureSpace(p);
    await p.eval("[...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Nueva página').click()");
    await p.waitFor("document.querySelector('.bn-editor[contenteditable=true]')");
    await sleep(500);
    await p.eval("document.querySelector('.bn-editor').focus()");
    await p.eval(`(() => { const dt = new DataTransfer(); dt.setData('text/plain', Array.from({ length: 2000 }, (_, i) => 'linea ' + i).join('\\n\\n')); document.querySelector('.bn-editor').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); })()`);
    await p.waitFor("document.querySelectorAll('.bn-editor .bn-block-outer').length >= 2000", 60000);
    await sleep(2000);
    const pt = await p.eval<{ x: number; y: number }>("(() => { const all = document.querySelectorAll('.bn-editor .bn-inline-content'); const e = all[all.length - 1]; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + 20, y: r.y + r.height / 2 }; })()");
    await sleep(300);
    const pt2 = await p.eval<{ x: number; y: number }>("(() => { const all = document.querySelectorAll('.bn-editor .bn-inline-content'); const r = all[all.length - 1].getBoundingClientRect(); return { x: r.x + 20, y: r.y + r.height / 2 }; })()");
    void pt;
    await p.mouse("mousePressed", pt2.x, pt2.y); await p.mouse("mouseReleased", pt2.x, pt2.y);
    // Dentro de la página: desde que llega la tecla (fase de captura) hasta que el DOM del editor ya refleja el cambio
    // (ProseMirror + sincronización con Yjs + React). No incluye la latencia de pintado de la pantalla.
    await p.eval(`(() => {
      window.__lat = []; let t0 = 0;
      const ed = document.querySelector('.bn-editor');
      window.addEventListener('keydown', () => { t0 = performance.now(); }, true);
      new MutationObserver(() => { if (t0) { window.__lat.push(performance.now() - t0); t0 = 0; } }).observe(ed, { childList: true, characterData: true, subtree: true });
    })()`);
    const key = async (ch: string) => { await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: ch, text: ch }); await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: ch }); await sleep(30); };
    for (let i = 0; i < 10; i++) await key("a"); // calentamiento
    await p.eval("window.__lat.length = 0");
    for (let i = 0; i < 150; i++) await key("b");
    const samples = (await p.eval<number[]>("window.__lat")).sort((a, b) => a - b);
    expect(samples.length).toBeGreaterThanOrEqual(140);
    const median = samples[Math.floor(samples.length / 2)]!, p95 = samples[Math.floor(samples.length * 0.95)]!;
    console.log(`BENCH 2000 bloques (${samples.length} teclas): mediana ${median.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms`);
    expect(await p.eval<number>("document.querySelectorAll('.bn-editor .bn-block-outer').length")).toBeGreaterThanOrEqual(2000);
    expect(median).toBeLessThan(50);
    expect(p95).toBeLessThan(100);
    await p.close();
  }, 180000);
});
