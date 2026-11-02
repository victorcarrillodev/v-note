// Arnés mínimo del protocolo de Chrome (CDP) para los e2e de la versión web/PWA. Sin dependencias: usa el WebSocket de Node.
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const CHROME = process.env.CHROME_BIN ?? "/usr/bin/google-chrome-stable";

export class Page {
  private id = 0;
  /** Errores de la página (excepciones y console.error), para diagnosticar y para exigir que no haya. */
  errors: string[] = [];
  /** Todas las URLs que la página intentó pedir (para la prueba de privacidad). */
  requests: string[] = [];
  private fakes: { host: string; status: number; body: unknown }[] = [];
  /** Responde con datos falsos a las peticiones a `host` (la petición real nunca sale) y deja pasar el resto. */
  async fake(host: string, status: number, body: unknown) {
    this.fakes.push({ host, status, body });
    await this.send("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
  }
  private async onPaused(params: any) {
    const url = new URL(params.request.url);
    const f = this.fakes.find((x) => x.host === url.host);
    if (!f) { await this.send("Fetch.continueRequest", { requestId: params.requestId }).catch(() => {}); return; }
    await this.send("Fetch.fulfillRequest", {
      requestId: params.requestId, responseCode: f.status,
      responseHeaders: [{ name: "content-type", value: "application/json" }, { name: "access-control-allow-origin", value: "*" }, { name: "access-control-allow-headers", value: "*" }],
      body: Buffer.from(JSON.stringify(f.body)).toString("base64"),
    }).catch(() => {});
  }
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private constructor(private ws: WebSocket, private port: number, private targetId: string) {
    ws.addEventListener("message", (ev) => {
      const m = JSON.parse(String(ev.data));
      if (m.method === "Network.requestWillBeSent") this.requests.push(m.params.request.url);
      if (m.method === "Fetch.requestPaused") void this.onPaused(m.params);
      if (m.method === "Runtime.exceptionThrown") this.errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
      if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") this.errors.push(m.params.args.map((a: any) => a.value ?? a.description).join(" "));
      if (m.id && this.pending.has(m.id)) {
        const p = this.pending.get(m.id)!;
        this.pending.delete(m.id);
        m.error ? p.reject(new Error(`${m.error.message}`)) : p.resolve(m.result);
      }
    });
  }
  /** Concede un permiso del navegador (p. ej. "notifications") al origen de `origin`. */
  static async grant(port: number, origin: string, permissions: string[]) {
    const v: any = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    const ws = new WebSocket(v.webSocketDebuggerUrl);
    await new Promise<void>((res) => ws.addEventListener("open", () => res()));
    await new Promise<void>((res) => { ws.addEventListener("message", () => res()); ws.send(JSON.stringify({ id: 1, method: "Browser.grantPermissions", params: { origin, permissions } })); });
    ws.close();
  }
  static async open(port: number, url = "about:blank"): Promise<Page> {
    const t: any = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" })).json();
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise<void>((res, rej) => { ws.addEventListener("open", () => res()); ws.addEventListener("error", () => rej(new Error("CDP ws"))); });
    const p = new Page(ws, port, t.id);
    await p.send("Page.enable"); await p.send("Runtime.enable"); await p.send("Network.enable");
    await p.waitFor(`location.href.startsWith(${JSON.stringify(url)}) && document.readyState === "complete"`);
    return p;
  }
  send(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  async eval<T = unknown>(expression: string): Promise<T> {
    const r = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value as T;
  }
  async goto(url: string) { await this.send("Page.navigate", { url }); await sleep(300); await this.waitFor("document.readyState === 'complete'"); }
  async reload() { await this.send("Page.reload"); await sleep(300); await this.waitFor("document.readyState === 'complete'"); }
  async waitFor(cond: string, timeout = 15000) {
    const t0 = Date.now();
    for (;;) {
      try { if (await this.eval<boolean>(`!!(${cond})`)) return; } catch { /* la página aún navega */ }
      if (Date.now() - t0 > timeout) throw new Error(`Tiempo agotado esperando: ${cond}`);
      await sleep(120);
    }
  }
  setOffline(offline: boolean) { return this.send("Network.emulateNetworkConditions", { offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }); }
  /** Texto escrito como teclado real en el elemento enfocado. */
  async typeText(text: string) { await this.send("Input.insertText", { text }); }
  async key(key: string, code = key, vk = 0, modifiers = 0) {
    await this.send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: vk, modifiers });
    await this.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vk, modifiers });
  }
  async center(selector: string): Promise<{ x: number; y: number }> {
    return this.eval(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  }
  async mouse(type: "mousePressed" | "mouseReleased" | "mouseMoved", x: number, y: number) {
    await this.send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1 });
  }
  async click(selector: string) { const { x, y } = await this.center(selector); await this.mouse("mouseMoved", x, y); await this.mouse("mousePressed", x, y); await this.mouse("mouseReleased", x, y); }
  async drag(from: { x: number; y: number }, to: { x: number; y: number }) {
    await this.mouse("mouseMoved", from.x, from.y); await this.mouse("mousePressed", from.x, from.y);
    for (let i = 1; i <= 12; i++) { await this.mouse("mouseMoved", from.x + ((to.x - from.x) * i) / 12, from.y + ((to.y - from.y) * i) / 12); await sleep(25); }
    await this.mouse("mouseReleased", to.x, to.y);
  }
  /** Cierra la pestaña de verdad (libera, por ejemplo, los bloqueos de OPFS que retiene). */
  async close() { this.ws.close(); await fetch(`http://127.0.0.1:${this.port}/json/close/${this.targetId}`).catch(() => {}); await sleep(300); }
}

export async function launchChrome(port: number): Promise<{ proc: ChildProcess; stop: () => void }> {
  const dir = mkdtempSync(join(tmpdir(), "vnote-chrome-"));
  const proc = spawn(CHROME, ["--headless=new", "--no-sandbox", "--disable-gpu", `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, "--window-size=1280,900", "about:blank"], { stdio: "ignore" });
  for (let i = 0; i < 60; i++) { try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch { await sleep(200); } }
  // Al terminar se borra el perfil (pesa ~130 MB y /tmp está en memoria)
  return { proc, stop: () => { proc.kill("SIGKILL"); setTimeout(() => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* ya no está */ } }, 500); } };
}
