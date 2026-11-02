// T-003 (prueba primero): BlockNote funciona dentro de la ventana de Tauri en WebKitGTK.
import { test, expect, beforeAll, afterAll } from "bun:test";
import { startApp, stopApp, find, click, type, run } from "./webdriver";

beforeAll(startApp, 60000);
afterAll(stopApp);

test("se puede escribir texto en el editor", async () => {
  const editor = await find(".bn-editor[contenteditable=true]");
  await click(editor);
  await type(editor, "Hola mundo");
  const text = await run<string>("return document.querySelector('.bn-editor').innerText");
  expect(text).toContain("Hola mundo");
}, 60000);

test("el atajo de Markdown crea un encabezado", async () => {
  const editor = await find(".bn-editor[contenteditable=true]");
  await click(editor);
  await type(editor, "\uE006# Titulo");
  const n = await run<number>("return document.querySelectorAll('[data-content-type=\"heading\"]').length");
  expect(n).toBeGreaterThan(0);
}, 60000);
