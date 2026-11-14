import { it, beforeAll, afterAll } from "vitest";
import { writeFileSync } from "node:fs";
import { Page } from "./cdp";
import { clickButton, ensureSpace, newPage, setValue, startWeb, type Web } from "./webHarness";
let web: Web;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => { web = await startWeb(4187, 9346); }, 120000);
afterAll(() => web?.stop());
const DIR = "/tmp/claude-1000/-home-vic-Escritorio-proyectos-personal-v-note/72324876-8405-4b44-9c2b-b6ae34b133f9/scratchpad/shots/";
const shot = async (p: Page, name: string) => { const s = await p.send("Page.captureScreenshot", { format: "png" }) as { data: string }; writeFileSync(DIR + name + ".png", Buffer.from(s.data, "base64")); };
const tryStep = async (name: string, f: () => Promise<unknown>) => { try { await f(); } catch (e) { console.log("SKIP", name, String(e).slice(0, 160)); } };
const side = (p: Page, text: string) => p.eval(`[...document.querySelectorAll('aside a, aside button')].find(b => b.innerText.trim() === ${JSON.stringify(text)}).click()`);
it("pantallas", async () => {
  const p = await web.open();
  await shot(p, "s00-bienvenida-cargando");
  await p.waitFor("document.querySelector('label') || document.querySelector('aside nav')", 20000); await sleep(500);
  await shot(p, "s01-bienvenida");
  await ensureSpace(p); await sleep(500);
  await shot(p, "s02-vacio");
  await newPage(p, "Plan de lanzamiento");
  await p.eval("document.querySelector('.bn-editor').focus()"); await p.typeText("Primera nota con algo de texto para ver el cuerpo."); await sleep(500);
  await shot(p, "s03-pagina");
  await tryStep("duplicar", async () => { await clickButton(p, "Duplicar"); await sleep(400); await shot(p, "s04-menu-duplicar"); await clickButton(p, "Duplicar"); });
  await tryStep("exportar", async () => { await clickButton(p, "Exportar"); await sleep(800); await shot(p, "s05-exportar"); await p.key("Escape", "Escape", 27); await sleep(300); });
  await tryStep("paleta", async () => { await clickButton(p, "Buscar\nCtrl+K").catch(() => p.eval("[...document.querySelectorAll('aside button')].find(b => b.innerText.includes('Buscar')).click()")); await sleep(600); await shot(p, "s06-paleta"); await p.key("Escape", "Escape", 27); await sleep(300); });
  await tryStep("bd", async () => {
    await clickButton(p, "Nueva base de datos");
    await p.waitFor("[...document.querySelectorAll('button')].some(b => b.innerText.trim() === 'Nueva fila')");
    for (const name of ["Taco", "Metro"]) {
      await clickButton(p, "Nueva fila");
      await p.waitFor("document.querySelector('[role=row][aria-label=\"Sin título\"] input')");
      await p.click('[role=row][aria-label="Sin título"] input[aria-label^="Título de la fila"]');
      await p.typeText(name); await p.key("Enter", "Enter", 13);
      await p.waitFor(`document.querySelector('[role=row][aria-label="${name}"]')`);
    }
    await sleep(400); await shot(p, "s07-tabla");
    await clickButton(p, "Nueva propiedad"); await sleep(500); await shot(p, "s08-nueva-propiedad");
    await setValue(p, '[aria-label="Nombre de la propiedad"]', "Fecha");
    await setValue(p, 'select[aria-label="Tipo de propiedad"]', "date");
    await clickButton(p, "Añadir propiedad"); await sleep(500);
    await setValue(p, 'select[aria-label="Tipo de vista nueva"]', "calendar");
    await clickButton(p, "Nueva vista"); await p.waitFor("document.querySelector('[role=grid]')"); await sleep(400);
    await shot(p, "s09-calendario");
    await clickButton(p, "Semana"); await sleep(600); await shot(p, "s10-semana");
  });
  await tryStep("tablero", async () => { await clickButton(p, "Nuevo tablero"); await sleep(1200); await shot(p, "s11-tablero"); });
  for (const [i, name] of ["Papelera", "Captura rápida", "Grafo", "Importar", "Recordatorios", "Ajustes", "Respaldo", "Restaurar desde GitHub"].entries()) {
    await tryStep(name, async () => { await side(p, name); await sleep(900); await shot(p, "s" + (12 + i) + "-" + name.toLowerCase().replace(/[^a-z]+/g, "-")); await p.key("Escape", "Escape", 27); await sleep(200); });
  }
  await tryStep("espacios", async () => {
    await p.click("aside button"); await p.waitFor("document.querySelector('[role=menuitem]')", 5000); await sleep(200); await shot(p, "s20-menu-espacio");
    await p.eval("[...document.querySelectorAll('[role=menuitem]')].find(e => e.innerText.trim() === 'Gestionar espacios').click()"); await sleep(800); await shot(p, "s21-espacios");
  });
  await p.close();
}, 240000);
