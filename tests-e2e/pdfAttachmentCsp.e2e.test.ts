// backlog-b7-b11 T-4 y T-6 (e2e en Chrome): un PDF adjunto se lee, se busca, se previsualiza y se anota con la CSP EXACTA de escritorio.
// pdfjs corre en su Worker: aquí se comprueba que carga sin romper la política.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { Page, launchChrome } from "./cdp";
import { ensureSpace, newPage } from "./webHarness";

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
  await new Promise<void>((r) => server.listen(4196, r));
  url = "http://localhost:4196/";
  chrome = await launchChrome(9396);
  page = await Page.open(9396, url);
}, 240_000);
afterAll(async () => { await page?.close().catch(() => {}); chrome?.stop(); server?.close(); });

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

describe("adjuntos PDF con la CSP de escritorio", () => {
  it("se dibuja, se anota y su texto aparece en la búsqueda", async () => {
    await ensureSpace(page);
    await newPage(page, "Apuntes con PDF");
    await page.click(".bn-editor");
    // Pegar un archivo en el editor crea el bloque de archivo y lo guarda como adjunto.
    await page.eval(`(() => { const data = new DataTransfer(); data.items.add(new File([${JSON.stringify(tinyPdf("Teorema de Bayes"))}], "teoria.pdf", { type: "application/pdf" })); document.querySelector('.bn-editor').dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })); })()`);
    const preview = "[...document.querySelectorAll('button')].find(b => b.textContent === 'Previsualizar teoria.pdf')";
    await page.waitFor(`!!${preview}`, 20_000);
    await sleep(4000); // lectura del PDF para la búsqueda
    await page.eval(`${preview}.click()`);
    // El lienzo deja de estar vacío cuando pdfjs termina de dibujar.
    await page.waitFor("(() => { const c = document.querySelector('[data-testid=note-surface] canvas'); if (!c || c.width < 400) return false; return c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 0 && v < 100 && c.getContext('2d')); })()", 30_000);
    await page.eval("document.querySelector('[role=dialog] textarea').scrollIntoView({ block: 'center' })");
    await sleep(400);
    await page.click("[role=dialog] textarea");
    await page.typeText("repasar esto");
    await page.eval("document.querySelector('[role=dialog] button[type=submit]').click()");
    await page.waitFor("document.querySelector('[role=dialog] ol')?.innerText.includes('repasar esto')", 10_000);
    await page.key("Escape", "Escape", 27);
    await sleep(500);
    expect(await page.eval<boolean>("!!document.querySelector('[role=dialog]')")).toBe(false);
    await page.eval("[...document.querySelectorAll('aside button')].find(b => b.innerText.includes('Buscar')).click()");
    await sleep(500);
    await page.typeText("Bayes");
    await page.waitFor("document.querySelector('[cmdk-list]')?.innerText.includes('Apuntes con PDF')", 15_000);

    const errors = [...page.errors, ...violations].filter((e) => /Content Security Policy|Refused to|violates/i.test(e));
    expect(errors).toEqual([]);
  }, 200_000);
});
