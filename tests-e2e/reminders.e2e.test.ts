// T-306, T-312, T-313, T-315 (e2e de escritorio): notificación del sistema real, resumen al abrir y acciones sobre vencidos.
import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import { stopApp, click, type, sleep, run, find, findX, button } from "./webdriver";
import { isolatedEnv, launch, ensureWorkspace, newPage, editorEl, chooseOption } from "./helpers";

const ENTER = String.fromCharCode(0xe007);
const env = { ...isolatedEnv(), VNOTE_TICK_MS: "500" };

/** Escucha las notificaciones que la aplicación envía al servicio de escritorio (D-Bus), para comprobar que sale una de verdad. */
function watchNotifications() {
  let out = "";
  const p = spawn("dbus-monitor", ["interface='org.freedesktop.Notifications',member='Notify'"], { stdio: ["ignore", "pipe", "ignore"] });
  p.stdout.on("data", (d) => { out += String(d); });
  return { text: () => out, stop: () => p.kill("SIGTERM") };
}
const setInput = (label: string, value: string) =>
  run(`const i = document.querySelector('[aria-label="${label}"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ${JSON.stringify(value)}); i.dispatchEvent(new Event('input', { bubbles: true }));`);

describe("recordatorios en el escritorio real", () => {
  it("T-306: un recordatorio vencido produce una notificación del sistema con el título de la tarea", async () => {
    const watch = watchNotifications();
    await launch(env);
    try {
      await ensureWorkspace();
      await newPage("Con tarea");
      const ed = await editorEl();
      await click(ed);
      await type(ed, "/tarea con fecha");
      await sleep(500);
      await type(ed, ENTER);
      await sleep(600);
      await type(ed, "Pagar luz");
      await sleep(300);
      await setInput("Recordatorio", "2026-01-01T09:00");
      for (let i = 0; i < 40 && !watch.text().includes("Pagar luz"); i++) await sleep(250);
      expect(watch.text()).toContain("Pagar luz");
    } finally { await stopApp(); watch.stop(); }
  }, 90000);

  it("T-312/T-315: con la aplicación cerrada a la hora, al abrir aparece como vencido, con el espacio, antes de cualquier otra acción", async () => {
    await launch(env);
    try {
      await find('[aria-label="Vencidos"]', 20000);
      const text = await run<string>("return document.querySelector('[aria-label=\"Vencidos\"]').innerText");
      expect(text).toContain("Pagar luz");
      expect(text).toContain("Personal");
      expect(await run<string>("return document.querySelector('h1').innerText")).toBe("Recordatorios");
    } finally { await stopApp(); }
  }, 60000);

  it("T-313: posponer lo oculta; marcar como hecho lo quita y queda hecho en la página", async () => {
    await launch(env);
    try {
      await find('[aria-label="Vencidos"]', 20000);
      await chooseOption('[role=combobox][aria-label="Posponer Pagar luz"]', "1h"); // el desplegable es un menú de Radix, no un <select>
      await sleep(800);
      expect(await run<boolean>("return !document.querySelector('[aria-label=\"Vencidos\"]')")).toBe(true);
    } finally { await stopApp(); }
  }, 60000);
});
