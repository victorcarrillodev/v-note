// T-223 (RNF-5): toda la red de la aplicación web se intercepta; el uso normal solo toca su propio origen y, al respaldar, solo api.github.com.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { Page, launchChrome } from "./cdp";

const WEB = resolve(__dirname, "../apps/web");
const SERVER_PORT = 4176, CDP_PORT = 9335;
const ORIGIN = `localhost:${SERVER_PORT}`;
const URL_ = `http://${ORIGIN}/`;
let server: ChildProcess, chrome: { stop: () => void };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  execFileSync("bunx", ["vite", "build"], { cwd: WEB, stdio: "ignore" });
  server = spawn("bunx", ["vite", "preview", "--port", String(SERVER_PORT), "--strictPort"], { cwd: WEB, stdio: "ignore" });
  for (let i = 0; i < 50; i++) { try { await fetch(URL_); break; } catch { await sleep(200); } }
  chrome = await launchChrome(CDP_PORT);
}, 120000);
afterAll(() => { chrome?.stop(); server?.kill("SIGKILL"); try { execFileSync("pkill", ["-f", `vite preview --port ${SERVER_PORT}`]); } catch { /* ya terminó */ } });

const hosts = (p: Page) => [...new Set(p.requests.filter((u) => /^https?:/.test(u)).map((u) => new URL(u).host))].sort();
const clickText = (p: Page, text: string) => p.eval(`[...document.querySelectorAll('button')].find(b => b.innerText.trim() === ${JSON.stringify(text)}).click()`);
const SPACE_INPUT = 'input[aria-label="Nombre del espacio"]';
const setInput = (p: Page, selector: string, value: string) =>
  p.eval(`(() => { const i = document.querySelector(${JSON.stringify(selector)}); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ${JSON.stringify(value)}); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);

describe("privacidad (T-223, RNF-5)", () => {
  it("uso normal completo: ninguna petición sale del origen de la aplicación", async () => {
    const p = await Page.open(CDP_PORT, URL_);
    await p.waitFor(`document.querySelector('${SPACE_INPUT}') || document.querySelector('aside nav')`, 20000);
    await setInput(p, SPACE_INPUT, "Personal"); await clickText(p, "Crear espacio");
    await p.waitFor("document.querySelector('aside nav')", 20000);
    await clickText(p, "Nueva página");
    await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')?.value === ''");
    await p.click('[aria-label="Título de la página"]'); await p.typeText("Privada"); await p.key("Enter", "Enter", 13);
    await p.waitFor("document.querySelector('.bn-editor[contenteditable=true]')");
    await p.eval("document.querySelector('.bn-editor').focus()"); await sleep(300);
    await p.typeText("contenido personal"); await sleep(1500);
    await p.key("k", "KeyK", 75, 2); await p.waitFor("document.querySelector('[cmdk-input]')");
    await p.typeText("priv"); await sleep(800); await p.key("Escape", "Escape", 27);
    await clickText(p, "Ajustes"); await sleep(300);
    await clickText(p, "Respaldo"); await sleep(500);
    await p.reload(); await p.waitFor("document.querySelector('aside nav')", 20000);
    expect(p.requests.length).toBeGreaterThan(5); // de verdad se observó la red
    expect(hosts(p)).toEqual([ORIGIN]);
    await p.close();
  }, 120000);

  it("cambiar de tema y exportar con «Tema actual» no genera ninguna petición de red (spec 006, RNF-1)", async () => {
    const p = await Page.open(CDP_PORT, URL_);
    await p.waitFor(`document.querySelector('${SPACE_INPUT}') || document.querySelector('aside nav')`, 20000);
    if (await p.eval<boolean>(`!!document.querySelector('${SPACE_INPUT}')`)) { await setInput(p, SPACE_INPUT, "Personal"); await clickText(p, "Crear espacio"); }
    await p.waitFor("document.querySelector('aside nav')", 20000);
    await clickText(p, "Nueva página");
    await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')?.value === ''");
    await p.click('[aria-label="Título de la página"]'); await p.typeText("Con tema"); await p.key("Enter", "Enter", 13);
    await p.waitFor("document.querySelector('.bn-editor[contenteditable=true]')");
    await clickText(p, "Ajustes");
    await p.waitFor("document.querySelector('input[name=theme]')", 20000);
    for (const id of ["oceano", "grafito", "ambar"]) await p.eval(`document.querySelector('input[name=theme][value=${id}]').click()`);
    expect(await p.eval<string>("document.documentElement.getAttribute('data-palette')")).toBe("ambar");
    await p.eval("document.querySelector('[role=treeitem]').click()");
    await p.waitFor("document.querySelector('.bn-editor[contenteditable=true]')");
    await clickText(p, "Exportar"); await p.waitFor("document.querySelector('[role=alertdialog]')");
    await p.eval("[...document.querySelectorAll('[role=alertdialog] input[name=export-look]')][1].click()");
    await p.eval("[...document.querySelectorAll('[role=alertdialog] button')].find(b => b.innerText.trim() === 'Exportar').click()");
    await p.waitFor("!document.querySelector('[role=alertdialog]')", 20000); // la exportación terminó y el diálogo se cerró
    expect(p.requests.length).toBeGreaterThan(0);
    expect(hosts(p)).toEqual([ORIGIN]);
    await p.close();
  }, 120000);

  it("al conectar y respaldar, lo único que sale es hacia api.github.com (la respuesta se simula; nada real sale)", async () => {
    const p = await Page.open(CDP_PORT, URL_);
    await p.fake("api.github.com", 200, { private: true, default_branch: "main", permissions: { push: true } });
    await p.waitFor("document.querySelector('aside nav')", 20000);
    await clickText(p, "Respaldo");
    await p.waitFor("document.querySelector('input[type=password]')");
    const byLabel = (text: string, value: string) =>
      p.eval(`(() => { const l = [...document.querySelectorAll('label')].find(x => x.innerText.trim().startsWith(${JSON.stringify(text)})); const i = l.querySelector('input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ${JSON.stringify(value)}); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await byLabel("Token de GitHub", "ghp_TOKENDEPRUEBA0123456789abcdefghijkl");
    await byLabel("Propietario", "yo");
    await byLabel("Repositorio", "respaldo");
    await clickText(p, "Conectar");
    await sleep(2000);
    const ext = hosts(p).filter((h) => h !== ORIGIN);
    expect(ext).toEqual(["api.github.com"]);
    // y el token nunca viaja a nadie más ni queda en el almacenamiento del navegador
    expect(await p.eval<boolean>("Object.keys(localStorage).every(k => !localStorage.getItem(k).includes('ghp_TOKENDEPRUEBA'))")).toBe(true);
    await p.close();
  }, 90000);
});
