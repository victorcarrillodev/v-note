// R-028 y R-031 (e2e real en Chrome): sin contorno azul tras un clic, con anillo al navegar con teclado; puntero de mano en botones reales.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Page } from "./cdp";
import { clickButton, ensureSpace, startWeb, type Web } from "./webHarness";

let web: Web;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => { web = await startWeb(4193, 9352); }, 120000);
afterAll(() => web?.stop());

async function openBlock(p: Page, query: string, selector: string) {
  await ensureSpace(p); await clickButton(p, "Nueva página");
  await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')?.value === ''");
  await p.click('[aria-label="Título de la página"]'); await p.typeText("Foco"); await p.key("Enter", "Enter", 13);
  await p.waitFor("document.querySelector('.bn-editor[contenteditable=true]')");
  await p.eval("document.querySelector('.bn-editor').focus()"); await sleep(300);
  await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: "/", text: "/" }); await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: "/" });
  await sleep(400); await p.typeText(query); await sleep(500); await p.key("Enter", "Enter", 13);
  await p.waitFor(`document.querySelector('${selector}')`, 10000);
}

/** Elementos visibles con contorno o sombra del color de acento. */
const ACCENT_RING = `(() => {
  const hex = getComputedStyle(document.documentElement).getPropertyValue('--c-accent').trim();
  const probe = document.createElement('i'); probe.style.color = hex; document.body.appendChild(probe);
  const accent = getComputedStyle(probe).color; probe.remove();
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if ((s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 && s.outlineColor === accent) || (s.boxShadow && s.boxShadow.includes(accent)))
      out.push(el.tagName.toLowerCase() + '.' + String(el.className || '').slice(0, 40) + (el === document.activeElement ? ' (activo)' : ''));
  }
  return out;
})()`;

describe("foco: sin anillo azul con ratón, con anillo con teclado", () => {
  it("R-028: tras clics de ratón en el editor y en el mapa no queda ningún contorno de acento", async () => {
    const p = await web.open();
    await openBlock(p, "mapa mental", "[data-testid=mindmap]");
    await p.click("[data-testid=mindmap] [data-node-id=root]"); await sleep(300);
    expect(await p.eval<string[]>(ACCENT_RING), "tras clic en el globo").toEqual([]);
    await p.click("[data-testid=mindmap] [role=region] input"); await sleep(300);
    expect(await p.eval<string[]>(ACCENT_RING), "tras clic en un campo de texto").toEqual([]);
    expect(await p.eval<string>("document.documentElement.getAttribute('data-input')")).toBe("pointer");
    // el campo de texto sí muestra el borde reforzado neutro
    const border = await p.eval<{ c: string; muted: string }>(`(() => { const i = document.querySelector('[data-testid=mindmap] [role=region] input'); const probe = document.createElement('i'); probe.style.color = getComputedStyle(document.documentElement).getPropertyValue('--c-text-muted'); document.body.appendChild(probe); const muted = getComputedStyle(probe).color; probe.remove(); return { c: getComputedStyle(i).borderTopColor, muted }; })()`);
    expect(border.c).toBe(border.muted);
    await p.click(".bn-editor"); await sleep(300);
    expect(await p.eval<string[]>(ACCENT_RING), "tras clic en el editor").toEqual([]);
  }, 150000);

  it("con Tab vuelve el anillo de foco y la modalidad pasa a teclado", async () => {
    await web.closeAll();
    const p = await web.open();
    await openBlock(p, "mapa mental", "[data-testid=mindmap]");
    await p.click("[data-testid=mindmap] [data-node-id=root]"); await sleep(200);
    await p.key("Tab", "Tab", 9); await sleep(300);
    expect(await p.eval<string>("document.documentElement.getAttribute('data-input')")).toBe("keyboard");
    const ring = await p.eval<string[]>(ACCENT_RING);
    expect(ring.length, "debe verse el anillo en el elemento enfocado").toBeGreaterThan(0);
  }, 150000);
});

describe("puntero de mano en botones reales (R-031, RF-4)", () => {
  it("todo botón visible resuelve a pointer, o a not-allowed si está deshabilitado", async () => {
    await web.closeAll();
    const p = await web.open();
    await openBlock(p, "diagrama", "[data-testid=diagram] .react-flow");
    const bad = await p.eval<string[]>(`(() => {
      const out = [];
      for (const el of document.querySelectorAll('button, [role=button], [role=menuitem], [role=tab], a[href]')) {
        const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
        const cur = getComputedStyle(el).cursor, disabled = el.disabled || el.getAttribute('aria-disabled') === 'true';
        const want = disabled ? 'not-allowed' : 'pointer';
        if (cur !== want) out.push((el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40) + ' → ' + cur + ' (esperado ' + want + ')');
      }
      return out; })()`);
    expect(bad).toEqual([]);
  }, 150000);
});
