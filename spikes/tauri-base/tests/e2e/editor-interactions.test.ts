// T-004 (prueba primero): menú "/", arrastre de bloques y pegado en WebKitGTK.
import { test, expect, beforeAll, afterAll } from "bun:test";
import { startApp, stopApp, find, click, type, run, action, rect } from "./webdriver";

beforeAll(startApp, 60000);
afterAll(stopApp);

const texts = () => run<string[]>("return [...document.querySelectorAll('.bn-block-content')].map(b => b.innerText.trim())");

test("el menú / aparece y filtra", async () => {
  const editor = await find(".bn-editor[contenteditable=true]");
  await click(editor);
  await type(editor, "/head");
  const menu = await find(".bn-suggestion-menu", 5000);
  expect(menu).toBeTruthy();
  const items = await run<string[]>("return [...document.querySelectorAll('.bn-suggestion-menu-item')].map(i => i.innerText)");
  expect(items.join(" ").toLowerCase()).toContain("heading");
  await type(editor, ""); // Escape
}, 60000);

test("pegar texto plano inserta el texto", async () => {
  const editor = await find(".bn-editor[contenteditable=true]");
  await click(editor);
  await run(`
    const el = document.querySelector('.bn-editor');
    const dt = new DataTransfer();
    dt.setData('text/plain', 'texto pegado');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  `);
  await Bun.sleep(300);
  expect((await texts()).join("|")).toContain("texto pegado");
}, 60000);

test("arrastrar un bloque cambia el orden", async () => {
  const editor = await find(".bn-editor[contenteditable=true]");
  await click(editor);
  await run("document.querySelector('.bn-editor').focus()");
  await type(editor, "\uE006Uno\uE006Dos\uE006Tres");
  const before = await texts();
  const iUno = before.findIndex((t) => t === "Uno");
  const iTres = before.findIndex((t) => t === "Tres");
  expect(iUno).toBeGreaterThan(-1);
  const blocks = await run<string[]>("return [...document.querySelectorAll('.bn-block-outer')].map((_, i) => i)");
  const els = [] as string[];
  // localizar bloques por texto y arrastrar "Uno" bajo "Tres" con el asa lateral
  const posUno = await run<{ x: number; y: number }>(`const b=[...document.querySelectorAll('.bn-block-content')].find(b=>b.innerText.trim()==='Uno'); const r=b.getBoundingClientRect(); return {x:r.x+10,y:r.y+r.height/2}`);
  const posTres = await run<{ x: number; y: number }>(`const b=[...document.querySelectorAll('.bn-block-content')].find(b=>b.innerText.trim()==='Tres'); const r=b.getBoundingClientRect(); return {x:r.x+10,y:r.y+r.height+4}`);
  await action([{ type: "pointer", id: "m", parameters: { pointerType: "mouse" }, actions: [{ type: "pointerMove", x: Math.round(posUno.x), y: Math.round(posUno.y) }] }]);
  await Bun.sleep(400);
  const handle = await run<{ x: number; y: number } | null>(`const h=document.querySelector('.bn-side-menu [draggable=true]'); if(!h) return null; const r=h.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}`);
  expect(handle).not.toBeNull();
  // WebDriver no genera arrastres HTML5 nativos; se disparan los eventos con un DataTransfer compartido.
  await run(`
    const handle = document.querySelector('.bn-side-menu [draggable=true]');
    const target = [...document.querySelectorAll('.bn-block-content')].find(b => b.innerText.trim()==='Tres');
    const dt = new DataTransfer();
    const fire = (el, type, y) => el.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true, clientX: target.getBoundingClientRect().x + 20, clientY: y }));
    const r = target.getBoundingClientRect();
    fire(handle, 'dragstart', handle.getBoundingClientRect().y);
    fire(target, 'dragenter', r.y + r.height - 2);
    fire(target, 'dragover', r.y + r.height - 2);
    fire(target, 'drop', r.y + r.height - 2);
    fire(handle, 'dragend', r.y);
  `);
  await Bun.sleep(500);
  const after = await texts();
  const aUno = after.findIndex((t) => t === "Uno");
  const aTres = after.findIndex((t) => t === "Tres");
  expect(aUno).toBeGreaterThan(aTres);
}, 90000);
