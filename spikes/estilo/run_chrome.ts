// Carga index.html en Chrome (versión web) con el arnés e2e del proyecto e imprime el resultado.
import { join } from "node:path";
import { launchChrome, Page } from "../../tests-e2e/cdp";
const page = process.argv[2] ?? "index.html";
const server = Bun.serve({ port: 0, fetch: async (req) => { const f = Bun.file(join(import.meta.dir, new URL(req.url).pathname.slice(1) || "index.html")); return (await f.exists()) ? new Response(f) : new Response("", { status: 404 }); } });
const chrome = await launchChrome(9361);
try {
  const p = await Page.open(9361, `http://127.0.0.1:${server.port}/${page}`);
  await p.waitFor("window.__result", 120000);
  console.log(JSON.stringify(await p.eval("window.__result")));
} finally { chrome.stop(); server.stop(true); }
