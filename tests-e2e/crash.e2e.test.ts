// T-133: matar el proceso (SIGKILL) a mitad de escritura no corrompe nada: al reabrir, todo lo confirmado sigue y la app arranca limpia.
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { stopApp, click, type, sleep, run, findX } from "./webdriver";
import { isolatedEnv, launch, ensureWorkspace, newPage, editorEl, editorText } from "./helpers";

const env = isolatedEnv();
/** SIGKILL a la app y a TODOS sus descendientes (los procesos de WebKit quedarían huérfanos y saturarían la máquina). Solo toca lo que cuelga de la app lanzada por la prueba. */
const descendants = (pid: number): number[] => {
  let kids: number[] = [];
  try { kids = execFileSync("pgrep", ["-P", String(pid)], { encoding: "utf8" }).split(/\s+/).filter(Boolean).map(Number); } catch { /* sin hijos */ }
  return kids.flatMap((k) => [...descendants(k), k]);
};
const killHard = () => {
  let pids: number[] = [];
  try { pids = execFileSync("pgrep", ["-x", "vnote-desktop"], { encoding: "utf8" }).split(/\s+/).filter(Boolean).map(Number); } catch { return; }
  for (const root of pids) for (const pid of [...descendants(root), root]) { try { process.kill(pid, "SIGKILL"); } catch { /* ya terminó */ } }
};

describe("caída del proceso (T-133, RF-4)", () => {
  it("SIGKILL tras escribir: lo guardado sobrevive y la base no queda corrupta", async () => {
    await launch(env);
    try {
      await ensureWorkspace();
      await newPage("Resistente");
      const ed = await editorEl();
      await click(ed);
      await type(ed, "texto confirmado");
      await sleep(1500); // pasa el guardado automático
      // Escritura en curso: se teclea y se mata el proceso sin darle tiempo a terminar
      await type(ed, " y esto se escribe justo antes de la caída");
      killHard();
    } finally { await stopApp().catch(() => {}); killHard(); }
    await sleep(500);

    await launch(env);
    try {
      await ensureWorkspace();
      await click(await findX('//*[@role="treeitem" and @aria-label="Resistente"]'));
      await editorEl();
      await sleep(1000);
      const text = await editorText();
      expect(text).toContain("texto confirmado"); // lo confirmado no se perdió
      // Sin avisos de error ni de corrupción
      expect(await run<number>("return document.querySelectorAll('[role=alert]').length")).toBe(0);
      // y la base sigue siendo plenamente utilizable: se puede seguir escribiendo y guardar
      const ed = await editorEl();
      await click(ed);
      await type(ed, " continuamos");
      await sleep(1500);
      expect(await editorText()).toContain("continuamos");
    } finally { await stopApp(); killHard(); }

    // y una tercera apertura confirma que lo posterior a la recuperación también persistió
    await launch(env);
    try {
      await ensureWorkspace();
      await click(await findX('//*[@role="treeitem" and @aria-label="Resistente"]'));
      await editorEl();
      await sleep(1000);
      expect(await editorText()).toContain("continuamos");
    } finally { await stopApp(); killHard(); }
  });
});
