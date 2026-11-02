// T-119, T-120, T-132 (prueba primero): el editor funciona, guarda solo y conserva el contenido al cambiar de página y al reiniciar.
import { describe, it, expect } from "vitest";
import { stopApp, click, type, sleep, byLabel, findX } from "./webdriver";
import { isolatedEnv, launch, ensureWorkspace, newPage, editorEl, editorText, treeTitles } from "./helpers";

const env = isolatedEnv();

describe("editor de bloques", () => {
  it("T-119: se puede escribir y el texto se ve", async () => {
    await launch(env);
    try {
      await ensureWorkspace();
      await newPage("Página A");
      const ed = await editorEl();
      await click(ed);
      await type(ed, "Hola desde el editor");
      expect(await editorText()).toContain("Hola desde el editor");
      await sleep(1200); // margen del guardado automático
    } finally { await stopApp(); }
  });

  it("T-120: al reiniciar, el texto sigue ahí sin haber guardado nada a mano", async () => {
    await launch(env);
    try {
      await ensureWorkspace();
      const item = await findX('//*[@role="treeitem" and @aria-label="Página A"]');
      await click(item);
      await editorEl();
      await sleep(800);
      expect(await editorText()).toContain("Hola desde el editor");
    } finally { await stopApp(); }
  });

  it("T-132: escribir, cambiar de página, volver: el contenido sigue intacto", async () => {
    await launch(env);
    try {
      await ensureWorkspace();
      await click(await findX('//*[@role="treeitem" and @aria-label="Página A"]'));
      await newPage("Página B");
      const ed = await editorEl();
      await click(ed);
      await type(ed, "Contenido de B");
      await click(await findX('//*[@role="treeitem" and @aria-label="Página A"]')); // cambia de página al instante (sin esperar el guardado)
      await sleep(500);
      expect(await editorText()).toContain("Hola desde el editor");
      expect(await editorText()).not.toContain("Contenido de B");
      await click(await findX('//*[@role="treeitem" and @aria-label="Página B"]'));
      await editorEl();
      await sleep(500);
      expect(await editorText()).toContain("Contenido de B");
      expect(await treeTitles()).toEqual(["Página A", "Página B"]);
    } finally { await stopApp(); }
    void byLabel;
  });
});
