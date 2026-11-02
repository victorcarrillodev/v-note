// Prueba primero: la app nunca debe quedar en blanco, aunque el archivo guardado esté dañado.
import { test, expect } from "bun:test";
import { existsSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { startApp, stopApp, find, run } from "./webdriver";

const DOC = new URL("../../out/doc.bin", import.meta.url).pathname;
const CORRUPT = DOC + ".corrupt";

test("con un archivo dañado la app abre un editor vacío y conserva el archivo dañado", async () => {
  for (const f of [DOC, CORRUPT]) if (existsSync(f)) rmSync(f);
  writeFileSync(DOC, Buffer.from([1, 2, 3]));
  await startApp();
  try {
    await find(".bn-editor[contenteditable=true]", 20000);
    const aviso = await run<string>("return document.querySelector('[data-testid=aviso]')?.innerText ?? ''");
    expect(aviso).toContain("dañado");
  } finally {
    await stopApp();
  }
  expect(existsSync(CORRUPT)).toBe(true);
  expect([...readFileSync(CORRUPT)]).toEqual([1, 2, 3]);
}, 90000);
