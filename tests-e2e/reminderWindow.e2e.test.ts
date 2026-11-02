// T-307 (e2e de escritorio real): la ventana pequeña de recordatorio y sus tres acciones.
import { describe, it, expect, afterEach } from "vitest";
import { stopApp, find, run, sleep, windowHandles, currentHandle, switchWindow, click, button } from "./webdriver";
import { isolatedEnv, launch, ensureWorkspace } from "./helpers";

afterEach(async () => { await stopApp(); });

const open = (title: string) => run(`window.__TAURI_INTERNALS__.invoke('show_reminder', { workspaceId: 'w', pageId: 'p', taskId: 't', title: ${JSON.stringify(title)}, when: '2026-03-05 09:00' }); return 1;`);
async function popup(main: string): Promise<void> {
  let handles: string[] = [];
  for (let i = 0; i < 60 && handles.length < 2; i++) { await sleep(250); handles = await windowHandles(); }
  expect(handles.length).toBe(2);
  await switchWindow(handles.find((h) => h !== main)!);
  await find('[role="alertdialog"]', 20000);
}
const closed = async () => { for (let i = 0; i < 40 && (await windowHandles()).length > 1; i++) await sleep(250); return (await windowHandles()).length === 1; };

describe("ventana de recordatorio en escritorio (T-307)", () => {
  it("aparece con el título y la hora; Hecho la cierra y la app principal sigue viva", async () => {
    await launch({ ...isolatedEnv() });
    await ensureWorkspace();
    const main = await currentHandle();
    await open("Pagar luz & agua");
    await popup(main);
    const text = await run<string>("return document.querySelector('[role=alertdialog]').innerText");
    expect(text).toContain("Pagar luz & agua");
    expect(text).toContain("2026-03-05 09:00");
    await click(await button("Hecho"));
    expect(await closed()).toBe(true);
    await switchWindow(main);
    expect(await run<boolean>("return !!document.querySelector('aside nav')")).toBe(true);
  });
  it("Posponer (1 hora) cierra la ventana", async () => {
    await launch({ ...isolatedEnv() });
    await ensureWorkspace();
    const main = await currentHandle();
    await open("Llamar");
    await popup(main);
    await run("const s = document.querySelector('select'); s.value = '1h'; s.dispatchEvent(new Event('change', { bubbles: true })); return 1;");
    expect(await closed()).toBe(true);
  });
  it("Abrir cierra la ventana y pide a la principal abrir la tarea", async () => {
    await launch({ ...isolatedEnv() });
    await ensureWorkspace();
    const main = await currentHandle();
    await run("window.__vnoteOpened = []; window.__TAURI_INTERNALS__.invoke('plugin:event|listen', { event: 'vnote://open-task', target: { kind: 'Any' }, handler: window.__TAURI_INTERNALS__.transformCallback((e) => window.__vnoteOpened.push(e.payload)) }); return 1;");
    await open("Revisar");
    await popup(main);
    await click(await button("Abrir"));
    expect(await closed()).toBe(true);
    await switchWindow(main);
    for (let i = 0; i < 20 && (await run<number>("return window.__vnoteOpened.length")) === 0; i++) await sleep(250);
    expect(await run("return window.__vnoteOpened[0]")).toEqual({ workspaceId: "w", pageId: "p" });
  });
});
