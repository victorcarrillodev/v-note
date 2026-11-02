// T-373, T-381, T-382 (parte nativa), T-383, T-384 (e2e de escritorio real): ventana de captura, argumento interno, atajo no disponible.
import { describe, it, expect, afterEach } from "vitest";
import { spawn } from "node:child_process";
import { DESKTOP_BIN, stopApp, find, run, sleep, windowHandles, currentHandle, switchWindow, type as typeInto, click, button } from "./webdriver";
import { isolatedEnv, launch, ensureWorkspace } from "./helpers";

afterEach(async () => { await stopApp(); });

const hasInbox = () => run<boolean>("return [...document.querySelectorAll('[role=treeitem]')].some(e => e.getAttribute('aria-label') === 'Bandeja de entrada')");

describe("captura rápida en escritorio", () => {
  it("T-373/T-383/T-375: una segunda ejecución con --capture abre la ventana de captura de la instancia en curso y la nota llega a la bandeja", async () => {
    await launch({ ...isolatedEnv() });
    await ensureWorkspace();
    const main = await currentHandle();
    const second = spawn(DESKTOP_BIN, ["--capture"], { stdio: "ignore" });
    const outcome = await new Promise<"exit" | "timeout">((res) => { second.on("exit", () => res("exit")); setTimeout(() => res("timeout"), 15_000); });
    if (outcome === "timeout") second.kill("SIGKILL");
    expect(outcome).toBe("exit"); // la segunda ejecución solo reenvía la orden
    let handles: string[] = [];
    for (let i = 0; i < 60 && handles.length < 2; i++) { await sleep(250); handles = await windowHandles(); }
    expect(handles.length).toBe(2);
    await switchWindow(handles.find((h) => h !== main)!);
    const area = await find('[aria-label="Nota rápida"]', 20000);
    expect(await run<string>("return document.title")).toContain("Captura");
    await typeInto(area, "nota desde la ventana de captura");
    await sleep(400);
    await click(await button("Guardar en la bandeja"));
    // la ventana se cierra sola y la principal muestra la bandeja sin recargar
    for (let i = 0; i < 40 && (await windowHandles()).length > 1; i++) await sleep(250);
    expect((await windowHandles()).length).toBe(1);
    await switchWindow(main);
    for (let i = 0; i < 40 && !(await hasInbox()); i++) await sleep(250);
    expect(await hasInbox()).toBe(true);
  });

  it("T-382: la orden nativa de abrir la captura (la misma que usa la bandeja del sistema) crea la ventana", async () => {
    await launch({ ...isolatedEnv() });
    await ensureWorkspace();
    const main = await currentHandle();
    await run("window.__TAURI_INTERNALS__.invoke('open_capture'); return 1;");
    let handles: string[] = [];
    for (let i = 0; i < 60 && handles.length < 2; i++) { await sleep(250); handles = await windowHandles(); }
    expect(handles.length).toBe(2);
    await switchWindow(handles.find((h) => h !== main)!);
    await find('[aria-label="Nota rápida"]', 20000);
  });

  it("T-381/T-384: si el sistema no permite el atajo global, Ajustes avisa y muestra la orden para asignar uno del sistema", async () => {
    await launch({ ...isolatedEnv(), VNOTE_FORCE_SHORTCUT_FAIL: "1" });
    await ensureWorkspace();
    await click(await button("Ajustes"));
    await find('[aria-label="Atajo global de captura"]', 20000);
    const read = () => run<string>("return document.querySelector('[aria-label=\"Atajo global de captura\"]').innerText");
    for (let i = 0; i < 40 && !(await read()).includes("no está disponible"); i++) await sleep(250);
    const text = await read();
    expect(text).toContain("no está disponible");
    expect(text).toContain("--capture");
    expect(text).toContain("la captura sigue disponible");
  });
});
