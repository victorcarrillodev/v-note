// Cabecera con portada en Chrome real: ícono centrado en el borde, sin tapar texto, y tres altos de portada. Con E2E_SHOTS=<carpeta> guarda captura.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "./cdp";
import { ensureSpace, newPage, startWeb, type Web } from "./webHarness";

let web: Web;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => { web = await startWeb(4197, 9357); }, 120000);
afterAll(() => web?.stop());

// Un control se identifica por su nombre accesible: `aria-label`, la etiqueta asociada o el texto.
const find = (name: string) => `[...document.querySelectorAll('button, [role=switch]')].find(b => (b.getAttribute('aria-label') ?? '') === ${JSON.stringify(name)} || ((b.id && document.querySelector('label[for="' + b.id + '"]')?.innerText) || b.innerText).trim() === ${JSON.stringify(name)})`;
const press = async (p: Page, name: string) => { await p.waitFor(`!!(${find(name)})`, 8000); await p.eval(`(${find(name)}).click()`); await sleep(250); };

describe("cabecera con portada (navegador real)", () => {
  it("el ícono queda a la mitad del borde, no tapa texto y las etiquetas quedan cerca", async () => {
    const p = await web.open();
    await ensureSpace(p);
    await newPage(p, "Curso de Ciberseguridad");
    await press(p, "Añadir portada");
    await p.waitFor(`!!(${find("Elegir una imagen")})`, 8000);
    await p.eval(`(async () => {
      const c = document.createElement('canvas'); c.width = 800; c.height = 400;
      const g = c.getContext('2d'); g.fillStyle = '#3a8f8f'; g.fillRect(0, 0, 800, 400);
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      const input = document.querySelector('input[type=file]'); const dt = new DataTransfer(); dt.items.add(new File([blob], 'portada.png', { type: 'image/png' })); input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await p.waitFor("!!document.querySelector('[data-testid=cover]')");
    await p.key("Escape", "Escape", 27); await sleep(300);
    await press(p, "Añadir ícono");
    await p.waitFor("!!document.querySelector('input[type=search]')");
    await p.click("input[type=search]"); await p.typeText("cohete");
    await press(p, "🚀 cohete");
    await press(p, "Opciones de la página");
    for (const n of ["Título sobre la portada", "Descripción", "Ícono sobre el borde"]) await press(p, n);
    await press(p, "Opciones de la página"); await sleep(800); // cierra el panel

    const g = await p.eval<{ coverBottom: number; coverH: number; iconMid: number; iconTop: number; descBottom: number; tagsTop: number; iconBottom: number; clickable: boolean }>(`(() => {
      const box = (s) => document.querySelector(s).getBoundingClientRect();
      const cover = box('[data-testid=cover]'), icon = box('[data-testid=page-icon]');
      const desc = [...document.querySelectorAll('[data-testid=cover] button')].find(b => (b.getAttribute('aria-label') ?? '').startsWith('Descripción')).getBoundingClientRect();
      const tags = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Añadir etiqueta').getBoundingClientRect();
      const hit = document.elementFromPoint(icon.x + icon.width / 2, icon.y + icon.height / 2);
      return { coverBottom: cover.bottom, coverH: cover.height, iconMid: icon.y + icon.height / 2, iconTop: icon.top, iconBottom: icon.bottom, descBottom: desc.bottom, tagsTop: tags.top, clickable: !!hit?.closest('[data-testid=page-icon]') };
    })()`);
    // El cuadro del ícono se pinta con cualquiera de los colores de las paletas de 66.
    await press(p, "Opciones de la página") .catch(() => {});
    await p.waitFor("!!document.querySelector('[data-icon-color] [role=radio][data-accent]')", 8000);
    await p.eval("document.querySelectorAll('[data-icon-color] [role=radio][data-accent]')[27].click()");
    await sleep(600);
    expect(await p.eval<number>("document.querySelectorAll('[data-icon-color] [role=radio][data-accent]').length")).toBe(66);
    expect(await p.eval<string>("document.querySelector('[data-testid=page-icon]').style.background")).toContain("rgb(");
    const pad = await p.eval<number>("(() => { const b = document.querySelector('[data-testid=page-icon]').getBoundingClientRect(); const i = document.querySelector('[data-testid=page-icon] [aria-hidden=true]').getBoundingClientRect(); return i.top - b.top; })()");
    expect(pad).toBeGreaterThanOrEqual(16);
    const dir = process.env.E2E_SHOTS;
    if (dir) {
      mkdirSync(dir, { recursive: true });
      const s = await p.send<{ data: string }>("Page.captureScreenshot", { format: "png" });
      writeFileSync(join(dir, "header.png"), Buffer.from(s.data, "base64"));
    }
    console.log("GAPS", g.iconTop - g.descBottom, g.tagsTop - g.iconBottom);
    expect(Math.abs(g.iconMid - g.coverBottom)).toBeLessThanOrEqual(1);
    expect(g.iconTop - g.descBottom).toBeGreaterThanOrEqual(24); // aire arriba del ícono
    expect(g.tagsTop - g.iconBottom).toBeGreaterThanOrEqual(24); // y debajo
    expect(g.tagsTop - g.iconBottom).toBeLessThanOrEqual(28);
    expect(g.coverH).toBeGreaterThanOrEqual(260);
    expect(g.clickable).toBe(true);

    // Al abrir y cerrar la barra lateral la portada acompaña al área en cada fotograma, sin retraso.
    for (let i = 0; i < 2; i++) {
      const lag = await p.eval<number>(`new Promise((done) => {
        let worst = 0; const t0 = performance.now();
        const frame = () => setTimeout(() => {
          const m = document.querySelector('main'), c = document.querySelector('[data-testid=cover-bleed]').getBoundingClientRect();
          worst = Math.max(worst, Math.abs(c.left - m.getBoundingClientRect().left), Math.abs(c.width - m.clientWidth));
          performance.now() - t0 < 450 ? requestAnimationFrame(frame) : done(worst);
        });
        document.querySelector('[aria-controls=barra-lateral]').click(); requestAnimationFrame(frame);
      })`);
      console.log("DESFASE", lag);
      expect(lag).toBeLessThanOrEqual(2);
    }

    // Las tres opciones de alto se distinguen aunque el contenido sobre la portada sea alto.
    const heights: number[] = [];
    for (const name of ["Baja", "Media", "Alta"]) {
      if (!(await p.eval<boolean>(`!!(${find(name)})`))) await press(p, "Ajustes de la portada");
      await press(p, name); await sleep(500);
      heights.push(await p.eval<number>("document.querySelector('[data-testid=cover]').getBoundingClientRect().height"));
    }
    console.log("ALTOS", heights.join(" / "));
    expect(heights[1]! - heights[0]!).toBeGreaterThanOrEqual(50);
    expect(heights[2]! - heights[1]!).toBeGreaterThanOrEqual(50);
  }, 90000);
});
