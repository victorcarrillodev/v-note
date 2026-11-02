// T-015 a T-020 (pruebas primero): tic nativo, bandeja, notificación, ventana secundaria, atajo global, instancia única y llavero.
import { test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { startApp, stopApp, find, runAsync, run, APP_BIN } from "./webdriver";

const OUT = (f: string) => new URL(`../../out/${f}`, import.meta.url).pathname;
const invoke = <T = unknown>(cmd: string, args: Record<string, unknown> = {}) =>
  runAsync<{ ok?: T; err?: string }>(
    `const done = arguments[arguments.length-1];
     window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)}).then(v => done({ok: v}), e => done({err: String(e)}));`,
  );

beforeAll(async () => {
  for (const f of ["quick.log", "doc.bin"]) if (existsSync(OUT(f))) rmSync(OUT(f));
  process.env.SPIKE_TICK_MS = "500";
  await startApp();
  await find(".bn-editor[contenteditable=true]");
}, 90000);
afterAll(stopApp);

test("T-015/T-016: el tic llega al webview aunque la ventana esté oculta (bandeja)", async () => {
  let t0 = 0;
  for (let i = 0; i < 20 && t0 === 0; i++) { await Bun.sleep(300); t0 = await run<number>("return window.__ticks"); }
  expect(t0).toBeGreaterThan(0);
  expect((await invoke("hide_main")).err).toBeUndefined();
  await Bun.sleep(3000);
  const t1 = await run<number>("return window.__ticks");
  expect(t1 - t0).toBeGreaterThanOrEqual(4);
  await invoke("show_main");
}, 30000);

test("T-017: el icono de bandeja existe", async () => {
  expect((await invoke<boolean>("tray_status")).ok).toBe(true);
});

test("T-018: la notificación del sistema se emite", async () => {
  const mon = spawn("dbus-monitor", ["--session", "interface='org.freedesktop.Notifications',member='Notify'"], { stdio: ["ignore", "pipe", "ignore"] });
  let seen = "";
  mon.stdout.on("data", (d) => (seen += d.toString()));
  await Bun.sleep(500);
  expect((await invoke("notify", { title: "Prueba v-note", body: "recordatorio de prueba" })).err).toBeUndefined();
  await Bun.sleep(1500);
  mon.kill();
  expect(seen).toContain("Prueba v-note");
}, 30000);

test("T-019: se abre una ventana secundaria", async () => {
  const before = (await invoke<number>("window_count")).ok!;
  expect((await invoke("open_reminder")).err).toBeUndefined();
  await Bun.sleep(800);
  expect((await invoke<number>("window_count")).ok).toBe(before + 1);
}, 30000);

test("T-020: registro del atajo global (se registra el resultado)", async () => {
  const r = await invoke<boolean>("register_shortcut");
  writeFileSync(OUT("shortcut.json"), JSON.stringify(r));
  console.log("ATAJO GLOBAL:", JSON.stringify(r), "sesión:", process.env.XDG_SESSION_TYPE);
  expect(r.ok !== undefined || r.err !== undefined).toBe(true); // no se cae, devuelve un resultado explícito
});

test("T-021: una segunda ejecución reenvía el argumento a la instancia en ejecución y termina", async () => {
  const second = spawn(APP_BIN, ["--quick-capture"], { stdio: "ignore" });
  const code = await new Promise<number | null>((res) => { second.on("exit", res); setTimeout(() => res(-999), 15000); });
  expect(code).not.toBe(-999);
  await Bun.sleep(500);
  expect(existsSync(OUT("quick.log"))).toBe(true);
  expect(readFileSync(OUT("quick.log"), "utf8")).toContain("--quick-capture");
}, 40000);

test("T-022: llavero del sistema (guardar, leer, borrar) con error controlado si no hay servicio", async () => {
  const set = await invoke("keyring_set", { value: "token-de-prueba" });
  if (set.err) {
    console.log("LLAVERO NO DISPONIBLE:", set.err);
    expect(set.err.length).toBeGreaterThan(0); // fallo controlado, no excepción sin atrapar
    return;
  }
  expect((await invoke<string>("keyring_get")).ok).toBe("token-de-prueba");
  expect((await invoke("keyring_delete")).err).toBeUndefined();
  expect((await invoke("keyring_get")).err).toBeDefined();
});
