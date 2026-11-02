// T-127, T-128 (prueba primero): adjuntos reales al AssetStore del espacio; mismo nombre coexiste; aviso de más de 100 MB.
import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync, readdirSync, existsSync, openSync, ftruncateSync, closeSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { stopApp, click, type, sleep, run, find } from "./webdriver";
import { isolatedEnv, launch, ensureWorkspace, newPage, editorEl } from "./helpers";

const ENTER = String.fromCharCode(0xe007);
const env = isolatedEnv();
const work = join(tmpdir(), `vnote-attach-${Date.now()}`);

function assetFiles(): string[] {
  const root = join(env.VNOTE_DATA_DIR, "workspaces");
  if (!existsSync(root)) return [];
  return readdirSync(root).flatMap((id) => {
    const d = join(root, id, "assets");
    return existsSync(d) ? readdirSync(d).filter((f) => /^[0-9a-f]{64}$/.test(f)) : [];
  });
}

async function attach(path: string) {
  const ed = await editorEl();
  const hasFile = await run<boolean>("return !!document.querySelector('.bn-editor [data-content-type=\"file\"]')");
  // Con un archivo ya insertado, se escribe en el párrafo vacío que queda al final.
  await click(hasFile ? await find('.bn-editor .bn-block-outer:last-child [data-content-type="paragraph"] .bn-inline-content') : ed);
  await sleep(300);
  await type(ed, "/archivo");
  await sleep(400);
  await type(ed, ENTER);
  await sleep(500);
  // Abre el panel «Subir» del bloque de archivo y envía la ruta al <input type=file>
  await run("const tab=[...document.querySelectorAll('.bn-editor button, .bn-panel button, [role=tab]')].find(b=>/subir|upload/i.test(b.textContent||'')); tab?.click();");
  await sleep(300);
  const input = await find('input[type="file"]', 8000);
  await type(input, path);
  await sleep(1500);
}

describe("adjuntos (T-127, T-128)", () => {
  it("T-127: dos adjuntos con el mismo nombre y distinto contenido coexisten", async () => {
    mkdirSync(join(work, "a"), { recursive: true });
    mkdirSync(join(work, "b"), { recursive: true });
    writeFileSync(join(work, "a", "doc.txt"), "contenido A");
    writeFileSync(join(work, "b", "doc.txt"), "contenido B");
    await launch(env);
    try {
      await ensureWorkspace();
      await newPage("Adjuntos");
      await attach(join(work, "a", "doc.txt"));
      await attach(join(work, "b", "doc.txt"));
      expect(await run<number>("return document.querySelectorAll('.bn-editor [data-content-type=\"file\"]').length")).toBe(2);
      expect(await run<string>("return document.querySelector('.bn-editor').innerText")).toContain("doc.txt");
      await sleep(1000);
      expect(assetFiles().length).toBe(2);
    } finally { await stopApp(); }
  });

  it("T-128: un archivo de más de 100 MB se adjunta pero avisa que no se respaldará", async () => {
    const big = join(work, "grande.bin");
    const fd = openSync(big, "w");
    ftruncateSync(fd, 100 * 1024 * 1024 + 1); // archivo disperso: no ocupa disco real
    closeSync(fd);
    await launch(env);
    try {
      await ensureWorkspace();
      await newPage("Grande");
      await attach(big);
      await sleep(3000);
      const notice = await run<string>("return [...document.querySelectorAll('[role=status]')].map(e=>e.innerText).join('|')");
      expect(notice).toMatch(/100 MB/);
      expect(notice).toContain("grande.bin");
    } finally { await stopApp(); }
  });
});
