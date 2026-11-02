// T-308, T-309, T-310, T-314 (e2e web en Chrome): notificación del navegador, fijar fecha/aviso/repetición y recorrido completo.
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Page } from "./cdp";
import { clickButton, ensureSpace, setValue, startWeb, type Web } from "./webHarness";

let web: Web;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => { web = await startWeb(4178, 9337); }, 120000);
afterAll(() => web?.stop());
afterEach(async () => { await web?.closeAll(); });

/** Registra cada `new Notification(...)` del navegador para poder comprobarlo. */
const hookNotifications = (p: Page) => p.send("Page.addScriptToEvaluateOnNewDocument", { source: `window.__notes = []; const N = window.Notification; window.Notification = function (title, o) { window.__notes.push({ title, body: o && o.body }); }; window.Notification.permission = 'granted'; window.Notification.requestPermission = async () => 'granted';` });

describe("recordatorios en el navegador", () => {
  it("T-308/T-309/T-310/T-314: fijar fecha, aviso y repetición; notifica; abrir, posponer y completar", async () => {
    const p = await web.open("?vnote-tick=500");
    await hookNotifications(p);
    await p.reload();
    await ensureSpace(p);
    // una página con una tarea (T-290/T-309)
    await clickButton(p, "Nueva página");
    await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')?.value === ''");
    await p.click('[aria-label="Título de la página"]'); await p.typeText("Pendientes"); await p.key("Enter", "Enter", 13);
    await p.waitFor("document.querySelector('.bn-editor[contenteditable=true]')");
    await p.eval("document.querySelector('.bn-editor').focus()"); await sleep(300);
    await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: "/", text: "/" }); await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: "/" }); // el menú se abre con la tecla
    await sleep(400); await p.typeText("tarea con fecha"); await sleep(500); await p.key("Enter", "Enter", 13); await sleep(500);
    await p.typeText("Pagar luz");
    await p.waitFor("document.querySelector('.bn-editor input[type=datetime-local]')");
    // fecha límite, repetición diaria (T-310) y un aviso ya pasado
    await setValue(p, '.bn-editor input[type=date][aria-label="Fecha límite"]', "2026-01-01");
    await setValue(p, '.bn-editor select[aria-label="Repetir"]', "daily");
    await setValue(p, '.bn-editor input[aria-label="Recordatorio"]', "2026-01-01T09:00");
    await p.waitFor("document.querySelector('.bn-editor [role=note]')", 5000); // T-299: avisa que ya pasó
    // T-308: el navegador recibe una notificación con el título de la tarea
    await p.waitFor("window.__notes.some(n => n.title === 'Pagar luz')", 20000);
    // T-314: el resumen lista el vencido (una sola entrada, aunque se acumularon muchas repeticiones); se abre la tarea
    await clickButton(p, "Recordatorios");
    await p.waitFor("document.querySelector('[aria-label=\"Vencidos\"]')?.innerText.includes('Pagar luz')", 15000);
    expect(await p.eval<number>("document.querySelectorAll('[aria-label=\"Vencidos\"] li').length")).toBe(1);
    await clickButton(p, "Abrir Pagar luz");
    await p.waitFor("document.querySelector('.bn-editor')?.innerText.includes('Pagar luz')", 10000);
    // completar una tarea que se repite: no se cierra, pasa a la siguiente repetición desde la fecha original (CL-32)
    await clickButton(p, "Recordatorios");
    await p.waitFor("document.querySelector('button[aria-label=\"Marcar como hecho Pagar luz\"]')");
    await clickButton(p, "Marcar como hecho Pagar luz");
    await sleep(1200); // se escribe la nueva repetición en la página; el vencido sigue, porque la serie sigue atrasada
    await clickButton(p, "Abrir Pagar luz");
    await p.waitFor("document.querySelector('.bn-editor input[aria-label=\"Fecha límite\"]')?.value === '2026-01-02'", 10000);
    // posponer: desaparece de vencidos
    await clickButton(p, "Recordatorios");
    await p.waitFor("document.querySelector('select[aria-label=\"Posponer Pagar luz\"]')");
    await setValue(p, 'select[aria-label="Posponer Pagar luz"]', "tomorrow");
    await p.waitFor("!document.querySelector('[aria-label=\"Vencidos\"]')", 8000);
    await p.close();
  }, 120000);
});
