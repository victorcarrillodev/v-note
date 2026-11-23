// T-121, T-122 (prueba primero): el menú «/» y los atajos de Markdown insertan los bloques estándar en la app real.
import { describe, it, expect } from "vitest";
import { stopApp, click, type, sleep, run } from "./webdriver";
import { isolatedEnv, launch, ensureWorkspace, newPage, editorEl, editorText, chooseOption } from "./helpers";

const ENTER = String.fromCharCode(0xe007);
const env = isolatedEnv();
const count = (sel: string) => run<number>(`return document.querySelectorAll('.bn-editor ${sel.replace(/'/g, "\\'")}').length`);

async function freshEditor(title: string) {
  await newPage(title);
  const ed = await editorEl();
  await click(ed);
  return ed;
}

describe("atajos de Markdown (T-121)", () => {
  const cases: [string, string, string][] = [
    ["# ", '[data-content-type="heading"] h1', "encabezado 1"],
    ["## ", '[data-content-type="heading"] h2', "encabezado 2"],
    ["### ", '[data-content-type="heading"] h3', "encabezado 3"],
    ["- ", '[data-content-type="bulletListItem"]', "lista con viñetas"],
    ["1. ", '[data-content-type="numberedListItem"]', "lista numerada"],
    ["[] ", '[data-content-type="checkListItem"]', "lista de tareas"],
    ["> ", '[data-content-type="quote"]', "cita"],
  ];
  it("cada atajo crea su bloque", async () => {
    await launch(env);
    try {
      await ensureWorkspace();
      for (const [keys, sel, name] of cases) {
        const ed = await freshEditor(`MD ${name}`);
        await type(ed, `${keys}texto`);
        await sleep(300);
        expect(await count(sel), name).toBeGreaterThan(0);
      }
    } finally { await stopApp(); }
  });
});

describe("menú «/» (T-121, T-122)", () => {
  it("aparece al escribir «/» y filtra por texto", async () => {
    await launch(env);
    try {
      await ensureWorkspace();
      const ed = await freshEditor("Menú slash");
      await type(ed, "/");
      await sleep(400);
      expect(await run<number>("return document.querySelectorAll('.bn-suggestion-menu .bn-suggestion-menu-item').length")).toBeGreaterThan(5);
      await type(ed, "cita");
      await sleep(300);
      expect(await run<number>("return document.querySelectorAll('.bn-suggestion-menu .bn-suggestion-menu-item').length")).toBeLessThan(4);
      await type(ed, ENTER);
      await sleep(300);
      expect(await count('[data-content-type="quote"]')).toBeGreaterThan(0);
    } finally { await stopApp(); }
  });

  const items: [string, string, string][] = [
    ["encabezado 1", '[data-content-type="heading"]', "Encabezado 1"],
    ["lista con viñetas", '[data-content-type="bulletListItem"]', "viñetas"],
    ["lista numerada", '[data-content-type="numberedListItem"]', "numerada"],
    ["verificaci", '[data-content-type="checkListItem"]', "tareas"],
    ["código", '[data-content-type="codeBlock"]', "código"],
    ["tabla", '[data-content-type="table"]', "tabla"],
    ["imagen", '[data-content-type="image"]', "imagen"],
    ["archivo", '[data-content-type="file"]', "archivo"],
  ];
  it("inserta cada bloque estándar desde el menú", async () => {
    await launch(env);
    try {
      await ensureWorkspace();
      for (const [query, sel, name] of items) {
        const ed = await freshEditor(`Slash ${name}`);
        await type(ed, `/${query}`);
        await sleep(400);
        await type(ed, ENTER);
        await sleep(400);
        expect(await count(sel), name).toBeGreaterThan(0);
      }
    } finally { await stopApp(); }
  });
});

describe("bloques propios (T-123, T-125)", () => {
  it("T-123: inserta un aviso y se puede escribir y cambiar su tipo", async () => {
    await launch(env);
    try {
      await ensureWorkspace();
      const ed = await freshEditor("Aviso");
      await type(ed, "/aviso");
      await sleep(400);
      await type(ed, ENTER);
      await sleep(400);
      expect(await count('[data-content-type="callout"]')).toBe(1);
      await type(ed, "Cuidado con esto");
      await sleep(300);
      expect(await run<string>("return document.querySelector('.bn-editor [data-content-type=\"callout\"]').innerText")).toContain("Cuidado con esto");
      await chooseOption('.bn-editor [data-content-type="callout"] [role=combobox]', "danger");
      await sleep(400);
      expect(await run<string>("return document.querySelector('.bn-editor [data-callout-variant]').getAttribute('data-callout-variant')")).toBe("danger");
    } finally { await stopApp(); }
  });

  it("T-125: inserta un enlace web y se ve la tarjeta; sobrevive al reiniciar", async () => {
    await launch(env);
    try {
      await ensureWorkspace();
      const ed = await freshEditor("Enlace");
      await type(ed, "/enlace web");
      await sleep(400);
      await type(ed, ENTER);
      await sleep(500);
      const input = await (await import("./webdriver")).find('.bn-editor input[aria-label="Dirección del enlace"]');
      await click(input);
      await type(input, "https://example.com/pagina" + ENTER);
      await sleep(600);
      expect(await count("a[data-link-card]")).toBe(1);
      expect(await run<string>("return document.querySelector('.bn-editor a[data-link-card]').innerText")).toContain("example.com");
      await sleep(1200);
    } finally { await stopApp(); }
    await launch(env);
    try {
      await ensureWorkspace();
      const { findX } = await import("./webdriver");
      await click(await findX('//*[@role="treeitem" and @aria-label="Enlace"]'));
      await editorEl();
      await sleep(800);
      expect(await count("a[data-link-card]")).toBe(1);
    } finally { await stopApp(); }
  });
});

describe("divisor y desplegable (T-124)", () => {
  it("inserta un divisor y una lista plegable que se expande y se pliega", async () => {
    await launch(env);
    try {
      await ensureWorkspace();
      const ed = await freshEditor("Divisor");
      await type(ed, "/divisor");
      await sleep(400);
      await type(ed, ENTER);
      await sleep(400);
      expect(await count('[data-content-type="divider"]')).toBeGreaterThan(0);

      await type(ed, "/plegable");
      await sleep(400);
      await type(ed, ENTER);
      await sleep(400);
      await type(ed, "Título" + ENTER + String.fromCharCode(0xe004) + "Contenido oculto");
      await sleep(400);
      expect(await count('[data-content-type="toggleListItem"]')).toBeGreaterThan(0);
      const expanded = () => run<string>("return document.querySelector('.bn-editor .bn-toggle-button').getAttribute('aria-expanded')");
      const visibleChild = () => run<boolean>("const g = document.querySelector('.bn-editor .bn-toggle-slot .bn-block-group'); return !!g && g.getBoundingClientRect().height > 0");
      expect(await expanded()).toBe("true");
      expect(await visibleChild()).toBe(true);
      await click(await (await import("./webdriver")).find(".bn-editor .bn-toggle-button"));
      await sleep(300);
      expect(await expanded()).toBe("false");
      expect(await visibleChild()).toBe(false);
      await click(await (await import("./webdriver")).find(".bn-editor .bn-toggle-button"));
      await sleep(300);
      expect(await visibleChild()).toBe(true);
    } finally { await stopApp(); }
  });
});

describe("bloque de código (U-163)", () => {
  it("tiene lenguaje, copia el contenido y confirma «Copiado» durante 1,5 s", async () => {
    const { find } = await import("./webdriver");
    await launch(env);
    try {
      await ensureWorkspace();
      const ed = await freshEditor("Código");
      await type(ed, "/código");
      await sleep(400);
      await type(ed, ENTER);
      await sleep(500);
      expect(await count('[data-content-type="codeBlock"]')).toBe(1);
      await chooseOption(".bn-editor [data-code-language]", "javascript");
      await sleep(300);
      expect(await run<string>("return document.querySelector('.bn-editor [data-code-language]').getAttribute('data-value')")).toBe("javascript");
      await run("try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__copiado = t; } }, configurable: true }); } catch (e) { window.__clipboardError = String(e); } window.__copiado = null;");
      await click(await find('.bn-editor [data-code-content]'));
      await type(ed, "const a = 1;");
      await sleep(300);
      await click(await find('.bn-editor [data-copy-code]'));
      await sleep(200);
      const button = () => run<string>("return document.querySelector('.bn-editor [data-copy-code]').innerText");
      expect(await button()).toContain("Copiado");
      expect(await run<string | null>("return window.__copiado")).toContain("const a = 1;");
      await sleep(1600);
      expect(await button()).toContain("Copiar");
    } finally { await stopApp(); }
  });
});

describe("color y resaltado (T-126)", () => {
  it("aplica color de texto y resaltado al texto seleccionado", async () => {
    const { find } = await import("./webdriver");
    await launch(env);
    try {
      await ensureWorkspace();
      const ed = await freshEditor("Colores");
      await type(ed, "colorear esto");
      const selectAll = () => run("const e=document.querySelector('.bn-editor'); e.focus(); document.execCommand('selectAll');");
      const pick = async (testId: string) => {
        for (let i = 0; i < 10; i++) {
          await selectAll();
          await sleep(400);
          if (await run<boolean>("return !!document.querySelector('.bn-toolbar button[aria-label=\"Colores\"]')")) break;
        }
        await click(await find('.bn-toolbar button[aria-label="Colores"]'));
        await sleep(300);
        await click(await find(`[data-test="${testId}"]`));
        await sleep(400);
      };
      await pick("text-color-red");
      await pick("background-color-yellow");
      const html = await run<string>("return document.querySelector('.bn-editor').innerHTML");
      expect(html).toMatch(/data-style-type="textColor" data-value="red"/);
      expect(html).toMatch(/data-style-type="backgroundColor" data-value="yellow"/);
      expect(await run<string>("return document.querySelector('.bn-editor').innerText")).toContain("colorear esto");
    } finally { await stopApp(); }
  });
});

describe("deshacer y rehacer (T-131)", () => {
  const CTRL = String.fromCharCode(0xe009);
  const SHIFT = String.fromCharCode(0xe008);
  it("deshace y rehace, también después de salir de la página y volver", async () => {
    const { clickX } = await import("./webdriver");
    await launch(env);
    try {
      await ensureWorkspace();
      const ed = await freshEditor("Deshacer");
      await type(ed, "primera");
      await sleep(700); // fuera de la ventana de agrupación del historial
      await type(ed, ENTER + "segunda");
      await sleep(500);
      expect(await editorText()).toContain("segunda");
      await type(ed, CTRL + "z" + CTRL);
      await sleep(400);
      expect(await editorText()).not.toContain("segunda");
      expect(await editorText()).toContain("primera");
      await type(ed, CTRL + SHIFT + "z" + SHIFT + CTRL);
      await sleep(400);
      expect(await editorText()).toContain("segunda");

      // Salir y volver: el contenido sigue y se puede seguir editando, deshaciendo y rehaciendo sin errores ni corrupción.
      await newPage("Otra");
      await clickX('//*[@role="treeitem" and @aria-label="Deshacer"]');
      await editorEl();
      await sleep(800);
      expect(await editorText()).toContain("segunda");
      const ed2 = await editorEl(); // se vuelve a buscar tras la espera: el editor puede haberse remontado
      await click(ed2);
      await type(ed2, ENTER + "tercera");
      await sleep(500);
      await type(ed2, CTRL + "z" + CTRL);
      await sleep(400);
      const afterUndo = await editorText();
      expect(afterUndo).not.toContain("tercera");
      expect(afterUndo).toContain("primera");
      await type(ed2, CTRL + SHIFT + "z" + SHIFT + CTRL);
      await sleep(400);
      expect(await editorText()).toContain("tercera");
    } finally { await stopApp(); }
  });
});
