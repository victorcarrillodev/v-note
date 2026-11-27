// study-features-2 T-8 (e2e real en Chrome): ejecutar JavaScript y Python en un bloque de código con la CSP EXACTA de la app de escritorio.
// Sirve la versión web construida con las cabeceras de seguridad de `tauri.conf.json` y comprueba que QuickJS y Pyodide cargan sin romper la CSP.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { Page, launchChrome } from "./cdp";
import { ensureSpace, newPage, setValue } from "./webHarness";

const WEB = resolve(__dirname, "../apps/web");
const DIST = join(WEB, "dist");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MIME: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".zip": "application/zip", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2" };

const conf = JSON.parse(readFileSync(resolve(__dirname, "../apps/desktop/src-tauri/tauri.conf.json"), "utf8")) as { app: { security: { csp: Record<string, string> } } };
const CSP = Object.entries(conf.app.security.csp).map(([k, v]) => `${k} ${v}`).join("; ");

let server: Server, url: string, chrome: { stop(): void };
let page: Page;
const violations: string[] = [];

beforeAll(async () => {
  execFileSync("bunx", ["vite", "build"], { cwd: WEB, stdio: "ignore" });
  server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? "/").split("?")[0]!);
    let file = join(DIST, path === "/" ? "index.html" : path);
    if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, "index.html");
    res.setHeader("Content-Type", MIME[extname(file)] ?? "application/octet-stream");
    res.setHeader("Content-Security-Policy", CSP); // la misma política que la app de escritorio
    res.end(readFileSync(file));
  });
  await new Promise<void>((r) => server.listen(4197, r));
  url = "http://localhost:4197/";
  chrome = await launchChrome(9397);
  page = await Page.open(9397, url);
}, 240_000);
afterAll(async () => { await page?.close().catch(() => {}); chrome?.stop(); server?.close(); });

const output = () => page.eval<string>("document.querySelector('.bn-editor [data-run-output]')?.innerText ?? ''");
const runCode = async (language: string, code: string, waitMs: number) => {
  await setValue(page, ".bn-editor [data-code-language]", language);
  await page.click(".bn-editor [data-code-content]");
  await page.key("a", "KeyA", 65, 2); // Ctrl+A: reemplaza lo que hubiera
  await page.typeText(code);
  await sleep(300);
  await page.eval("document.querySelector('.bn-editor [data-run-output] button')?.click()"); // limpia la salida anterior
  await page.click(".bn-editor [data-run-code]");
  await page.waitFor("!!document.querySelector('.bn-editor [data-run-output]')", waitMs);
  return output();
};

describe("ejecutar código con la CSP de escritorio", () => {
  it("JavaScript (QuickJS) y Python (Pyodide) corren en el Worker sin violar la CSP y sin salir a la red", async () => {
    await ensureSpace(page);
    await newPage(page, "Código ejecutable");
    await page.click(".bn-editor");
    await page.typeText("/");
    await sleep(500);
    await page.typeText("código");
    await sleep(500);
    await page.key("Enter", "Enter", 13);
    await sleep(500);
    expect(await page.eval<boolean>("!!document.querySelector('.bn-editor [data-run-code]')")).toBe(false); // «text»: aún no se puede ejecutar

    const js = await runCode("javascript", "console.log('hola desde js'); 6 * 7", 30_000);
    expect(js).toContain("hola desde js");
    expect(js).toContain("42");

    const iso = await runCode("javascript", "typeof fetch + ',' + typeof window + ',' + typeof document", 30_000);
    expect(iso).toContain("undefined,undefined,undefined");

    const py = await runCode("python", "print(sum(range(5)))", 180_000);
    expect(py).toContain("10");

    // Con el intérprete cargado, el código no puede abrir la red ni el almacenamiento aunque alcance el ámbito global con `import js`.
    // Una sola línea: el editor de código reindenta los saltos de línea tecleados; `exec` los lleva dentro de la cadena.
    const blocked = await runCode("python", String.raw`exec("import js\ntry:\n    js.fetch('/')\n    print('abierto')\nexcept BaseException:\n    print('bloqueado')")`, 60_000);
    expect(blocked).toContain("bloqueado");
    expect(blocked).not.toContain("abierto");

    // Desvíos que encontró la revisión: `fetch` e `indexedDB` viven en WorkerGlobalScope.prototype, y el espacio de trabajo web está en OPFS (`navigator.storage`).
    const bypass = await runCode("python", String.raw`exec("import js\nroot = js.globalThis\nup = js.Object.getPrototypeOf(js.Object.getPrototypeOf(root))\nprint('fetch-proto', up.fetch is None)\nprint('fetch-self', root.fetch is None)\nprint('idb', up.indexedDB is None and root.indexedDB is None)\nprint('caches', up.caches is None and root.caches is None)\nprint('opfs', js.navigator.storage is None)\nprint('xhr', root.XMLHttpRequest is None)\nprint('ws', root.WebSocket is None)\nprint('importScripts', up.importScripts is None and root.importScripts is None)")`, 60_000);
    for (const probe of ["fetch-proto True", "fetch-self True", "idb True", "caches True", "opfs True", "xhr True", "ws True", "importScripts True"]) expect(bypass, probe).toContain(probe);

    const errors = [...page.errors, ...violations].filter((e) => /Content Security Policy|Refused to|violates/i.test(e));
    expect(errors).toEqual([]);
  }, 600_000);
});
