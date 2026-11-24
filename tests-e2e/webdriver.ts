// Arnés mínimo de WebDriver (sin dependencias) para automatizar la app de escritorio real vía tauri-driver (WebKitGTK).
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { homedir } from "node:os";
import { resolve } from "node:path";

const PORT = 4444;
const BASE = `http://127.0.0.1:${PORT}`;
export const DESKTOP_BIN = resolve(__dirname, "../apps/desktop/src-tauri/target/debug/vnote-desktop");
const EL = "element-6066-11e4-a52e-4f735466cecf";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let driver: ChildProcess | undefined;
let sessionId = "";

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json: any = await res.json();
  if (!res.ok) throw new Error(`${method} ${path}: ${JSON.stringify(json.value)}`);
  return json.value;
}

function killStale() {
  // Libera drivers huérfanos de ejecuciones que fallaron antes de llamar a stopApp().
  let out = "";
  try { out = execFileSync("ss", ["-ltnp"], { encoding: "utf8" }); } catch { return; }
  for (const m of out.matchAll(/:(4444|4445)\s.*?pid=(\d+)/g)) {
    try { process.kill(Number(m[2]), "SIGKILL"); } catch { /* ya terminó */ }
  }
}

export async function startApp(binary = DESKTOP_BIN, env: Record<string, string> = {}) {
  killStale();
  await sleep(300);
  driver = spawn(`${homedir()}/.cargo/bin/tauri-driver`, ["--port", String(PORT)], { stdio: "ignore", env: { ...process.env, ...env } });
  for (let i = 0; i < 50; i++) { try { await fetch(`${BASE}/status`); break; } catch { await sleep(200); } }
  const v = await call("POST", "/session", { capabilities: { alwaysMatch: { browserName: "wry", "tauri:options": { application: binary } } } });
  sessionId = v.sessionId;
  await call("POST", `/session/${sessionId}/timeouts`, { script: 240000, pageLoad: 60000 });
}

export async function stopApp() {
  try { await call("DELETE", `/session/${sessionId}`); } catch { /* sesión ya cerrada */ }
  driver?.kill("SIGTERM");
}

const s = (p: string) => `/session/${sessionId}${p}`;
export const goto = (url: string) => call("POST", s("/url"), { url });
export const run = <T = unknown>(script: string, args: unknown[] = []) => call("POST", s("/execute/sync"), { script, args }) as Promise<T>;
export const runAsync = <T = unknown>(script: string, args: unknown[] = []) => call("POST", s("/execute/async"), { script, args }) as Promise<T>;
export async function find(css: string, timeoutMs = 15000): Promise<string> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    try { return (await call("POST", s("/element"), { using: "css selector", value: css }))[EL]; }
    catch (e) { if (Date.now() > end) throw e; await sleep(250); }
  }
}
export const findX = async (xpath: string, timeoutMs = 15000): Promise<string> => {
  const end = Date.now() + timeoutMs;
  for (;;) {
    try { return (await call("POST", s("/element"), { using: "xpath", value: xpath }))[EL]; }
    catch (e) { if (Date.now() > end) throw e; await sleep(250); }
  }
};
/** Un elemento que aún se anima (aparece, se desliza) rechaza el clic con «click intercepted»: se reintenta hasta que se asienta. */
export async function click(el: string, attempts = 12): Promise<void> {
  for (let i = 0; ; i++) {
    try { await call("POST", s(`/element/${el}/click`), {}); return; } catch (e) {
      if (i >= attempts - 1 || !/click intercepted/.test(String(e))) throw e;
      await sleep(250);
    }
  }
}
export const type = (el: string, text: string) => call("POST", s(`/element/${el}/value`), { text });
export const clear = (el: string) => call("POST", s(`/element/${el}/clear`), {});
export const text = async (el: string) => (await call("GET", s(`/element/${el}/text`))) as string;
export const button = (name: string) => findX(`//button[normalize-space(.)="${name}" or @aria-label="${name}"]`);
export const byLabel = (label: string) => find(`[aria-label="${label}"]`);
/** Ventanas abiertas de la aplicación y cambio entre ellas (p. ej. principal y captura rápida). */
export const windowHandles = () => call("GET", s("/window/handles")) as Promise<string[]>;
export const currentHandle = () => call("GET", s("/window")) as Promise<string>;
export const switchWindow = (handle: string) => call("POST", s("/window"), { handle });
export { sleep };

/** Busca un elemento por XPath y lo pulsa; si la interfaz lo re-renderiza justo en medio (referencia obsoleta), lo reintenta. */
export async function clickX(xpath: string, attempts = 4): Promise<void> {
  for (let i = 0; ; i++) {
    try { await click(await findX(xpath)); return; } catch (e) {
      if (i >= attempts - 1 || !/stale element|no such element/.test(String(e))) throw e;
      await sleep(250);
    }
  }
}
