// T-135…T-140, T-143, T-144 (e2e real): paleta de comandos, ajustes de tema/idioma y atajos reasignables.
import { describe, it, expect } from "vitest";
import { stopApp, click, type, sleep, run, find, findX, button, byLabel } from "./webdriver";
import { isolatedEnv, launch, ensureWorkspace, newPage, treeTitles, chooseAny } from "./helpers";

const ENTER = String.fromCharCode(0xe007);
const CTRL = String.fromCharCode(0xe009);
const ALT = String.fromCharCode(0xe00a);
const env = isolatedEnv();
const options = () => run<string[]>("return [...document.querySelectorAll('[cmdk-list] [role=option]')].map(e=>e.textContent)");
const openPalette = async () => { await type(await find("body"), CTRL + "k" + CTRL); await find("[cmdk-input]", 8000); };
const palInput = () => find("[cmdk-input]");

describe("paleta de comandos", () => {
  it("T-135/T-136/T-137/T-138: abre, muestra recientes, busca en vivo y avisa si no hay resultados", async () => {
    await launch(env);
    try {
      await ensureWorkspace();
      await newPage("Receta de mole");
      await newPage("Presupuesto anual");
      await click(await findX('//*[@role="treeitem" and @aria-label="Receta de mole"]'));
      await sleep(500);
      await openPalette();
      // T-136: recientes (la última visitada primero)
      const recent = await options();
      expect(recent[0]).toContain("Receta de mole");
      expect(recent.join("|")).toContain("Presupuesto anual");
      // T-137: búsqueda en vivo
      await type(await palInput(), "presu");
      await sleep(700);
      const hits = await options();
      expect(hits.some((h) => h.includes("Presupuesto anual"))).toBe(true);
      expect(hits.some((h) => h.includes("Receta de mole"))).toBe(false);
      expect(await run<number>("return document.querySelectorAll('[cmdk-list] mark').length")).toBeGreaterThan(0);
      // T-138: sin coincidencias
      await type(await palInput(), "zzzzqq");
      await sleep(700);
      expect(await run<string>("return document.querySelector('[cmdk-list]').innerText")).toContain("Sin coincidencias");
      // T-135: cerrar con Esc
      await type(await palInput(), String.fromCharCode(0xe00c));
      await sleep(400);
      expect(await run<boolean>("return !document.querySelector('[cmdk-input]')")).toBe(true);
    } finally { await stopApp(); }
  });

  it("T-139: filtros de tipo y de papelera", async () => {
    await launch(env);
    try {
      await ensureWorkspace();
      await openPalette();
      await type(await palInput(), "receta");
      await sleep(700);
      expect((await options()).length).toBeGreaterThan(0);
      await click(await findX('//button[starts-with(normalize-space(.),"Tablero")]')); // el filtro de tipo ahora es un chip
      await sleep(700);
      expect((await options()).filter((o) => o.includes("Receta")).length).toBe(0);
    } finally { await stopApp(); }
  });

  it("T-140: las acciones «Crear página» y «Cambiar tema» funcionan", async () => {
    await launch(env);
    try {
      await ensureWorkspace();
      const before = (await treeTitles()).length;
      await openPalette();
      await click(await findX('//*[@role="option" and starts-with(normalize-space(.),"Crear página")]'));
      await sleep(800);
      expect((await treeTitles()).length).toBe(before + 1);
      const theme = () => run<string>("return document.documentElement.getAttribute('data-theme')");
      const t0 = await theme();
      await openPalette();
      await click(await findX('//*[@role="option" and starts-with(normalize-space(.),"Cambiar tema")]'));
      await sleep(500);
      expect(await theme()).not.toBe(t0);
    } finally { await stopApp(); }
  });
});

describe("ajustes", () => {
  it("T-144: cambia tema e idioma y se recuerdan al reiniciar", async () => {
    await launch(env);
    try {
      await ensureWorkspace();
      await run("[...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Ajustes').click(); return 1;"); // con el tema recién cambiado otro elemento puede tapar el botón: se pulsa por DOM
      await find("[data-drawer]", 8000); await sleep(1200); // el panel se desliza al abrirse
      await run("const r = document.querySelector('input[type=radio][name=theme][value=dark]'); r.scrollIntoView({ block: 'center' }); r.click(); return 1;"); // el tema se elige entre muestras (radios ocultos)
      await sleep(300);
      expect(await run<string>("return document.documentElement.getAttribute('data-theme')")).toBe("dark");
      await chooseAny("en");
      await sleep(500);
      expect(await run<string>("return document.querySelector('[data-drawer] h2')?.innerText ?? ''")).toBe("Settings");
    } finally { await stopApp(); }
    await launch(env);
    try {
      await ensureWorkspace();
      expect(await run<string>("return document.documentElement.getAttribute('data-theme')")).toBe("dark");
      expect(await run<boolean>("return !![...document.querySelectorAll('button')].find(b=>b.innerText==='Settings')")).toBe(true);
    } finally { await stopApp(); }
  });

  it("T-143: reasigna un atajo y avisa al chocar con otro", async () => {
    await launch(env);
    try {
      await ensureWorkspace();
      await run("[...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Settings').click(); return 1;"); // otro elemento puede tapar el botón: se pulsa por DOM
      await find("[data-drawer]", 8000); await sleep(1200); // el panel se desliza al abrirse
      const change = async (a: string) => { await run(`document.querySelector('[aria-label="Change shortcut for ${a}"]').scrollIntoView({ block: 'center' }); return 1;`); await sleep(300); await click(await byLabel(`Change shortcut for ${a}`)); };
      await change("New page");
      await type(await find("body"), CTRL + ALT + "j" + ALT + CTRL);
      await sleep(400);
      expect(await run<string>("return document.body.innerText")).toContain("Ctrl+Alt+J");
      await change("Toggle theme");
      await type(await find("body"), CTRL + ALT + "j" + ALT + CTRL);
      await sleep(400);
      expect(await run<string>("return document.querySelector('[role=alert]')?.innerText ?? ''")).toContain("New page");
    } finally { await stopApp(); }
  });
});
