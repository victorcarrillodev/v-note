// Cliente mínimo de WebDriver (sin dependencias) para automatizar la app real en WebKitGTK vía tauri-driver.
import { spawn, type ChildProcess } from "node:child_process";
import { homedir } from "node:os";

const PORT = 4444;
const BASE = `http://127.0.0.1:${PORT}`;
export const APP_BIN = new URL("../../src-tauri/target/debug/spike-tauri-base", import.meta.url).pathname;

let driver: ChildProcess | undefined;
let sessionId = "";

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json: any = await res.json();
  if (!res.ok) throw new Error(`${method} ${path}: ${JSON.stringify(json.value)}`);
  return json.value;
}

async function killStale() {
  // Libera drivers huérfanos de ejecuciones anteriores que fallaron antes de llamar a stopApp().
  const out = await Bun.$`ss -ltnp`.quiet().nothrow().text();
  for (const m of out.matchAll(/:(4444|4445)\s.*?pid=(\d+)/g)) {
    try { process.kill(Number(m[2]), "SIGKILL"); } catch {}
  }
  await Bun.sleep(300);
}

export async function startApp() {
  await killStale();
  driver = spawn(`${homedir()}/.cargo/bin/tauri-driver`, ["--port", String(PORT)], { stdio: "ignore" });
  for (let i = 0; i < 50; i++) {
    try { await fetch(`${BASE}/status`); break; } catch { await Bun.sleep(200); }
  }
  const v = await call("POST", "/session", {
    capabilities: { alwaysMatch: { browserName: "wry", "tauri:options": { application: APP_BIN } } },
  });
  sessionId = v.sessionId;
  await call("POST", `/session/${sessionId}/timeouts`, { script: 240000 });
}

export async function stopApp() {
  try { await call("DELETE", `/session/${sessionId}`); } catch {}
  driver?.kill("SIGTERM");
}

const s = (p: string) => `/session/${sessionId}${p}`;
const EL = "element-6066-11e4-a52e-4f735466cecf";

export async function find(css: string, timeoutMs = 15000): Promise<string> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    try { const e = await call("POST", s("/element"), { using: "css selector", value: css }); return e[EL]; }
    catch (err) { if (Date.now() > end) throw err; await Bun.sleep(250); }
  }
}
export const click = (el: string) => call("POST", s(`/element/${el}/click`), {});
export const type = (el: string, text: string) => call("POST", s(`/element/${el}/value`), { text });
export const run = <T = unknown>(script: string, args: unknown[] = []) => call("POST", s("/execute/sync"), { script, args }) as Promise<T>;

export const action = (actions: unknown[]) => call("POST", s("/actions"), { actions });
export const rect = (el: string) => call("GET", s(`/element/${el}/rect`)) as Promise<{ x: number; y: number; width: number; height: number }>;
export const releaseActions = () => call("DELETE", s("/actions"));

export const runAsync = <T = unknown>(script: string, args: unknown[] = []) => call("POST", s("/execute/async"), { script, args }) as Promise<T>;
