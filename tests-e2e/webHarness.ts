// Arnés común de los e2e de la versión web: construye la app, la sirve y abre Chrome por CDP.
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { Page, launchChrome } from "./cdp";

const WEB = resolve(__dirname, "../apps/web");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type Web = { url: string; open(query?: string): Promise<Page>; grant(permissions: string[]): Promise<void>; /** Cierra todas las pestañas abiertas (también tras un fallo: una pestaña olvidada retiene la base en OPFS). */ closeAll(): Promise<void>; stop(): void };

export async function startWeb(serverPort: number, cdpPort: number): Promise<Web> {
  execFileSync("bunx", ["vite", "build"], { cwd: WEB, stdio: "ignore" });
  const url = `http://localhost:${serverPort}/`;
  const server: ChildProcess = spawn("bunx", ["vite", "preview", "--port", String(serverPort), "--strictPort"], { cwd: WEB, stdio: "ignore" });
  for (let i = 0; i < 50; i++) { try { await fetch(url); break; } catch { await sleep(200); } }
  const chrome = await launchChrome(cdpPort);
  const pages: Page[] = [];
  return {
    url,
    open: async (query = "") => { const p = await Page.open(cdpPort, url + query); pages.push(p); return p; },
    grant: (permissions) => Page.grant(cdpPort, url.replace(/\/$/, ""), permissions),
    closeAll: async () => { for (const p of pages.splice(0)) await p.close().catch(() => {}); },
    stop: () => {
      chrome.stop(); server.kill("SIGKILL");
      try { execFileSync("pkill", ["-f", `vite preview --port ${serverPort}`]); } catch { /* ya terminó */ }
    },
  };
}

const SPACE_INPUT = 'input[aria-label="Nombre del espacio"]';
export const clickButton = (p: Page, text: string) => p.eval(`[...document.querySelectorAll('button')].find(b => b.innerText.trim() === ${JSON.stringify(text)} || b.getAttribute('aria-label') === ${JSON.stringify(text)}).click()`);
export const setValue = (p: Page, selector: string, value: string) =>
  p.eval(`(() => { const i = document.querySelector(${JSON.stringify(selector)}); const proto = i instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype; const set = Object.getOwnPropertyDescriptor(proto, 'value').set; set.call(i, ${JSON.stringify(value)}); i.dispatchEvent(new Event(i instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); })()`);

/** Crea el espacio si es el primer inicio y espera la barra lateral. */
export async function ensureSpace(p: Page, name = "Personal") {
  await p.waitFor(`document.querySelector('${SPACE_INPUT}') || document.querySelector('aside nav')`, 20000);
  if (await p.eval<boolean>(`!!document.querySelector('${SPACE_INPUT}')`)) {
    await setValue(p, SPACE_INPUT, name);
    await clickButton(p, "Crear espacio");
  }
  await p.waitFor("document.querySelector('aside nav')", 20000);
}

/** Crea una página con ese título y espera al editor. */
export async function newPage(p: Page, title: string) {
  await clickButton(p, "Nueva página");
  await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')?.value === ''");
  await p.click('[aria-label="Título de la página"]'); await p.typeText(title); await p.key("Enter", "Enter", 13);
  await p.waitFor("document.querySelector('.bn-editor[contenteditable=true]')");
  await sleep(300);
}
export const openFromTree = async (p: Page, title: string) => {
  await p.eval(`[...document.querySelectorAll('[role=treeitem]')].find(e => e.getAttribute('aria-label') === ${JSON.stringify(title)}).click()`);
  await p.waitFor(`document.querySelector('[aria-label="Título de la página"]')?.value === ${JSON.stringify(title)}`, 10000);
  await p.waitFor("document.querySelector('.bn-editor[contenteditable=true]')");
  await sleep(300);
};
/** Escribe `trigger` + `query` en el editor y elige el primer resultado del menú. */
export async function mention(p: Page, trigger: "@" | "[[", query: string) {
  await p.eval("document.querySelector('.bn-editor').focus()");
  await p.eval("(() => { const e = document.querySelector('.bn-editor'); const r = document.createRange(); r.selectNodeContents(e.lastElementChild ?? e); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); })()");
  for (const ch of trigger) { await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: ch, text: ch }); await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: ch }); }
  await sleep(400); await p.typeText(query); await sleep(600);
  await p.key("Enter", "Enter", 13); await sleep(500);
}
