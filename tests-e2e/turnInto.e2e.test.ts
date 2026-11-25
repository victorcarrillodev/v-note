// «Convertir en» desde el asa del bloque, en Chrome real. Con E2E_SHOTS=<carpeta> guarda una captura.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ensureSpace, newPage, startWeb, type Web } from "./webHarness";

let web: Web;
beforeAll(async () => { web = await startWeb(4198, 9358); }, 120000);
afterAll(() => web?.stop());

const item = (text: string) => `[...document.querySelectorAll('[role=menuitem]')].find(b => b.innerText.trim() === ${JSON.stringify(text)})`;

describe("convertir un bloque desde el asa (navegador real)", () => {
  it("un título pasa a ser aviso destacado conservando el texto", async () => {
    const p = await web.open();
    await ensureSpace(p);
    await newPage(p, "Convertir");
    await p.eval("document.querySelector('.bn-editor').focus()");
    for (const ch of "# ") await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: ch, text: ch });
    await p.typeText("¿Qué es la Ciberseguridad?");
    await p.waitFor("!!document.querySelector('.bn-editor [data-content-type=heading]')");
    const r = await p.eval<{ x: number; y: number }>("(() => { const r = document.querySelector('.bn-editor [data-content-type=heading]').getBoundingClientRect(); return { x: r.x + 20, y: r.y + r.height / 2 }; })()");
    await p.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: r.x, y: r.y });
    await p.waitFor("!!document.querySelector('.bn-side-menu [draggable=true]')", 8000);
    await p.click(".bn-side-menu [draggable=true]");
    await p.waitFor(`!!(${item("Convertir en")})`, 8000);
    expect(await p.eval<string[]>("[...document.querySelectorAll('.bn-drag-handle-menu [role=menuitem]')].map(b => b.innerText.trim())")).toEqual(["Convertir en", "Colores", "Eliminar"]);
    expect(await p.eval<boolean>(`(() => { const s = (${item("Eliminar")}).querySelector('span[class*=c-danger]'); return !!s && getComputedStyle(s).color !== getComputedStyle(${item("Colores")}).color; })()`)).toBe(true);
    const out = process.env.E2E_SHOTS;
    if (out) {
      mkdirSync(out, { recursive: true });
      await new Promise((done) => setTimeout(done, 500));
      const m = await p.send<{ data: string }>("Page.captureScreenshot", { format: "png" });
      writeFileSync(join(out, "drag-menu.png"), Buffer.from(m.data, "base64"));
    }
    await new Promise((done) => setTimeout(done, 2000));
    expect(await p.eval<boolean>(`!!(${item("Convertir en")})`)).toBe(true);
    // Al pasar de un submenú a otro, el anterior se quita de inmediato (sin superponerse).
    const hover = async (label: string) => {
      await p.eval(`(${item(label)}).setAttribute('data-e2e-h', ${JSON.stringify(label)})`);
      const c = await p.center(`[data-e2e-h="${label}"]`);
      await p.mouse("mouseMoved", c.x - 5, c.y);
      await p.mouse("mouseMoved", c.x, c.y);
      await new Promise((done) => setTimeout(done, 60));
    };
    const open = () => p.eval<{ turn: boolean; menus: number }>(`({ turn: !!(${item("Aviso destacado")}), menus: document.querySelectorAll('[role=menu]').length })`);
    await hover("Convertir en");
    expect(await open()).toEqual({ turn: true, menus: 2 });
    await hover("Colores");
    expect(await open()).toEqual({ turn: false, menus: 2 });
    await hover("Convertir en");
    expect(await open()).toEqual({ turn: true, menus: 2 });
    await hover("Eliminar");
    expect(await open()).toEqual({ turn: false, menus: 1 });
    await hover("Convertir en");
    await p.waitFor(`!!(${item("Aviso destacado")})`, 8000);
    const dir = process.env.E2E_SHOTS;
    if (dir) {
      mkdirSync(dir, { recursive: true });
      const s = await p.send<{ data: string }>("Page.captureScreenshot", { format: "png" });
      writeFileSync(join(dir, "turn-into.png"), Buffer.from(s.data, "base64"));
    }
    await p.eval(`(${item("Aviso destacado")}).setAttribute('data-e2e-callout', '')`);
    await p.click("[data-e2e-callout]");
    await p.waitFor("!!document.querySelector('.bn-editor [data-content-type=callout]')", 8000);
    expect(await p.eval<string>("document.querySelector('.bn-editor [data-content-type=callout]').innerText")).toContain("¿Qué es la Ciberseguridad?");
  }, 60000);
});
