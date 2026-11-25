// Índice en los márgenes (Chrome real): rayitas a ambos lados y panel con los títulos al pasar el ratón.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ensureSpace, newPage, startWeb, type Web } from "./webHarness";

let web: Web;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => { web = await startWeb(4196, 9356); }, 120000);
afterAll(() => web?.stop());

describe("índice en los márgenes (navegador real)", () => {
  it("está a ambos lados, sin tapar el texto, y se detalla con el ratón encima", async () => {
    const p = await web.open();
    await ensureSpace(p);
    await newPage(p, "Índice");
    await p.eval("document.querySelector('.bn-editor').focus()");
    for (const title of ["Introducción", "Herramientas", "Conclusiones"]) {
      for (const ch of "# ") await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: ch, text: ch });
      await p.typeText(title); await p.key("Enter", "Enter", 13);
    }
    await p.waitFor("!!document.querySelector('[data-testid=toc-floating-left]') && !!document.querySelector('[data-testid=toc-floating]')", 10000);
    const state = () => p.eval<{ opacity: string; leftX: number; rightX: number; textL: number; textR: number }>(`(() => {
      const l = document.querySelector('[data-testid=toc-floating-left]'), r = document.querySelector('[data-testid=toc-floating]');
      const t = document.querySelector('.bn-editor').getBoundingClientRect();
      return { opacity: getComputedStyle(r.querySelector('ul').parentElement).opacity, leftX: l.getBoundingClientRect().right, rightX: r.getBoundingClientRect().left, textL: t.left, textR: t.right };
    })()`);
    const before = await state();
    expect(before.opacity).toBe("0");
    expect(before.leftX).toBeLessThan(before.textL);
    expect(before.rightX).toBeGreaterThan(before.textR - 60);
    const c = await p.center("[data-testid=toc-floating]");
    await p.mouse("mouseMoved", c.x - 3, c.y);
    await p.mouse("mouseMoved", c.x, c.y);
    await sleep(400);
    expect((await state()).opacity).toBe("1");
    // Se va hasta un título del panel (fuera de las rayitas), sigue abierto y el clic navega.
    await p.eval("[...document.querySelectorAll('[data-testid=toc-floating] a')].find(a => a.innerText.trim() === 'Conclusiones').setAttribute('data-e2e-go', '')");
    const link = await p.center("[data-e2e-go]");
    for (let i = 1; i <= 8; i++) await p.mouse("mouseMoved", c.x + ((link.x - 60 - c.x) * i) / 8, c.y + ((link.y - c.y) * i) / 8);
    await sleep(600);
    expect((await state()).opacity).toBe("1");
    await p.eval("window.__jumped = ''; Element.prototype.scrollIntoView = function () { window.__jumped = this.textContent; }");
    await p.click("[data-e2e-go]");
    await sleep(300);
    expect(await p.eval<string>("window.__jumped")).toContain("Conclusiones");
    const dir = process.env.E2E_SHOTS;
    if (dir) {
      mkdirSync(dir, { recursive: true });
      const s = await p.send<{ data: string }>("Page.captureScreenshot", { format: "png" });
      writeFileSync(join(dir, "toc.png"), Buffer.from(s.data, "base64"));
    }
  }, 90000);
});
