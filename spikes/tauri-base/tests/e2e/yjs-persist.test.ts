// T-007 (prueba primero): el editor usa un documento Yjs cuyo estado binario se guarda en un archivo y se restaura al reabrir.
import { test, expect } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { startApp, stopApp, find, click, type, run } from "./webdriver";

const DOC = new URL("../../out/doc.bin", import.meta.url).pathname;

test("el texto escrito sobrevive al cerrar y reabrir la app", async () => {
  if (existsSync(DOC)) rmSync(DOC);
  await startApp();
  let editor = await find(".bn-editor[contenteditable=true]");
  await click(editor);
  await type(editor, "persistente");
  await Bun.sleep(1500); // margen para el guardado
  await stopApp();
  expect(existsSync(DOC)).toBe(true);

  await startApp();
  editor = await find(".bn-editor[contenteditable=true]");
  await Bun.sleep(800);
  const text = await run<string>("return document.querySelector('.bn-editor').innerText");
  await stopApp();
  expect(text).toContain("persistente");
}, 120000);
