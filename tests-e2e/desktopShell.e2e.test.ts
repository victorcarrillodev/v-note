// T-017, T-019, T-020, T-380 (e2e de escritorio real): menú de la bandeja, foco de la ventana de recordatorio y atajo global.
// La bandeja se maneja por D-Bus (com.canonical.dbusmenu, el mismo protocolo que usa el panel del sistema).
// El atajo global se dispara con XTest sobre XWayland: el plugin de atajos solo existe en X11, así que la app se arranca con GDK_BACKEND=x11.
import { describe, it, expect, afterEach } from "vitest";
import { execFileSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { stopApp, find, run, runAsync, sleep, windowHandles, currentHandle, switchWindow } from "./webdriver";
import { isolatedEnv, launch, ensureWorkspace } from "./helpers";

afterEach(async () => {
  await stopApp();
  try { execFileSync("pkill", ["-x", "vnote-desktop"]); } catch { /* ya terminó */ }
});

const sh = (cmd: string, args: string[]) => execFileSync(cmd, args, { encoding: "utf8" });
const invoke = (cmd: string, args = "{}") => runAsync<unknown>(`const done = arguments[arguments.length-1]; window.__TAURI_INTERNALS__.invoke('${cmd}', ${args}).then((v) => done(v === undefined ? null : v), (e) => done({ error: String(e) }));`);
const pidOfApp = () => sh("pgrep", ["-x", "vnote-desktop"]).trim().split("\n")[0]!;
const alive = () => { try { sh("pgrep", ["-x", "vnote-desktop"]); return true; } catch { return false; } };

/** Nombre único del bus y ruta del menú de la bandeja del proceso, y los ids de sus elementos por etiqueta. */
function trayMenu(pid: string) {
  const names = sh("busctl", ["--user", "list", "--no-legend"]).split("\n").filter((l) => l.split(/\s+/)[1] === pid).map((l) => l.split(/\s+/)[0]!);
  for (const name of names) {
    let tree = "";
    try { tree = sh("busctl", ["--user", "tree", name, "--list"]); } catch { continue; }
    const path = tree.split("\n").find((l) => /NotificationItem\/.*\/Menu$/.test(l));
    if (!path) continue;
    const layout = sh("busctl", ["--user", "call", name, path, "com.canonical.dbusmenu", "GetLayout", "iias", "0", "--", "-1", "0"]);
    const items = new Map<string, number>();
    for (const m of layout.matchAll(/\(ia\{sv\}av\) (\d+) 1 "label" s "((?:[^"\\]|\\.)*)"/g)) items.set(decode(m[2]!), Number(m[1]));
    return { name, path, items };
  }
  throw new Error("la bandeja no está en el bus de sesión");
}
/** busctl escribe los acentos como escapes octales UTF-8 («r\303\241pida»). */
const decode = (s: string) => Buffer.from(s.replace(/\\(\d{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8))), "latin1").toString("utf8");
const clickMenu = (t: ReturnType<typeof trayMenu>, label: string) => {
  const id = t.items.get(label);
  if (id === undefined) throw new Error(`no hay «${label}» en el menú: ${[...t.items.keys()].join(", ")}`);
  sh("busctl", ["--user", "call", t.name, t.path, "com.canonical.dbusmenu", "Event", "isvu", String(id), "clicked", "i", "0", "0"]);
};
const waitHandles = async (n: number, atLeast = true) => {
  let h: string[] = [];
  for (let i = 0; i < 60; i++) { h = await windowHandles(); if (atLeast ? h.length >= n : h.length === n) break; await sleep(250); }
  return h;
};

describe("bandeja del sistema (T-017)", () => {
  it("el menú tiene Abrir, Captura rápida y Salir y cada opción responde", async () => {
    await launch({ ...isolatedEnv(), VNOTE_QUIT_ON_CLOSE: "" });
    await ensureWorkspace();
    const main = await currentHandle();
    const tray = trayMenu(pidOfApp());
    expect([...tray.items.keys()]).toEqual(["Abrir", "Captura rápida", "Salir"]);

    // Captura rápida: se abre la ventana de captura
    clickMenu(tray, "Captura rápida");
    const handles = await waitHandles(2);
    expect(handles.length).toBe(2);
    await switchWindow(handles.find((h) => h !== main)!);
    await find('[aria-label="Nota rápida"]', 20000);
    await run("window.__TAURI_INTERNALS__.invoke('plugin:window|close', { label: 'capture' }).catch(() => {}); return 1;");
    await waitHandles(1, false);
    await switchWindow(main);

    // Abrir: con la ventana principal oculta, vuelve a verse
    await run("window.__TAURI_INTERNALS__.invoke('plugin:window|close', { label: 'main' }).catch(() => {}); return 1;");
    await sleep(800);
    expect(await invoke("window_visible")).toBe(false);
    clickMenu(tray, "Abrir");
    for (let i = 0; i < 40 && (await invoke("window_visible")) !== true; i++) await sleep(250);
    expect(await invoke("window_visible")).toBe(true);

    // Salir: el proceso termina
    clickMenu(tray, "Salir");
    for (let i = 0; i < 40 && alive(); i++) await sleep(250);
    expect(alive()).toBe(false);
  }, { timeout: 180_000, retry: 2 });
});

describe("ventana de recordatorio y foco (T-019)", () => {
  const withOtherApp = async (env: Record<string, string>, check: (isFocused: (l: string) => Promise<unknown>) => Promise<void>) => {
    await launch({ ...isolatedEnv(), ...env });
    await ensureWorkspace();
    const isFocused = (label: string) => invoke("plugin:window|is_focused", `{ label: '${label}' }`);
    // «Otra app»: una ventana ajena que toma el foco al abrirse
    const other = spawn("zenity", ["--info", "--title=Otra aplicación", "--text=Aplicación en uso", "--timeout=60"], { stdio: "ignore" });
    try {
      for (let i = 0; i < 40 && (await isFocused("main")) !== false; i++) await sleep(250);
      expect(await isFocused("main")).toBe(false); // el foco ya no está en la app
      await invoke("show_reminder", "{ workspaceId: 'w', pageId: 'p', taskId: 't', title: 'Sin robar foco', when: '2026-03-05 09:00' }");
      await sleep(1500);
      await check(isFocused);
    } finally { other.kill("SIGKILL"); }
  };

  it("en Wayland nativo no abre ventana (solo la notificación del sistema) y no toma el foco", async () => {
    await withOtherApp({ GDK_BACKEND: "wayland" }, async (isFocused) => {
      expect((await windowHandles()).length).toBe(1);
      expect(await isFocused("main")).toBe(false);
    });
  }, { timeout: 120_000, retry: 2 });

  it("con X11 la ventana de recordatorio aparece sin quitarle el foco a la otra aplicación", async () => {
    await withOtherApp({ GDK_BACKEND: "x11" }, async (isFocused) => {
      expect((await waitHandles(2)).length).toBe(2);
      expect(await isFocused("reminder")).toBe(false);
      expect(await isFocused("main")).toBe(false);
    });
  }, { timeout: 120_000, retry: 2 });
});

/** Pulsa Ctrl+Alt+N con XTest (inyección de teclado a nivel de servidor X, como si fuera el teclado físico). */
function pressCtrlAltN(display: string) {
  const py = `
import ctypes, sys
x11 = ctypes.CDLL("libX11.so.6"); xtst = ctypes.CDLL("libXtst.so.6")
x11.XOpenDisplay.restype = ctypes.c_void_p
x11.XStringToKeysym.restype = ctypes.c_ulong
x11.XKeysymToKeycode.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
x11.XFlush.argtypes = [ctypes.c_void_p]
xtst.XTestFakeKeyEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
d = x11.XOpenDisplay(None)
if not d: sys.exit("sin servidor X")
def kc(name): return x11.XKeysymToKeycode(d, x11.XStringToKeysym(name))
keys = [kc(b"Control_L"), kc(b"Alt_L"), kc(b"n")]
for k in keys: xtst.XTestFakeKeyEvent(d, k, 1, 0)
for k in reversed(keys): xtst.XTestFakeKeyEvent(d, k, 0, 0)
x11.XFlush(d)
`;
  execFileSync("python3", ["-I", "-c", py], { env: { ...process.env, DISPLAY: display } });
}

describe("atajo global (T-020, T-380)", () => {
  it("se registra y, pulsado mientras otra ventana tiene el foco, abre la captura rápida", async () => {
    // Servidor X11 propio y aislado (Xwayland «rootful»): el XWayland de la sesión no entrega XTest a los atajos globales,
    // y el plugin de atajos solo funciona sobre X11. La app corre dentro con GDK_BACKEND=x11.
    const display = ":98";
    // SIGKILL deja el bloqueo del servidor anterior y el siguiente no arrancaría
    for (const f of [`/tmp/.X${display.slice(1)}-lock`, `/tmp/.X11-unix/X${display.slice(1)}`]) rmSync(f, { force: true });
    const xserver = spawn("Xwayland", [display, "-geometry", "800x600", "-noreset"], { stdio: "ignore" });
    try {
      for (let i = 0; i < 40; i++) { try { execFileSync("python3", ["-I", "-c", "import ctypes,sys; x=ctypes.CDLL('libX11.so.6'); x.XOpenDisplay.restype=ctypes.c_void_p; sys.exit(0 if x.XOpenDisplay(b'" + display + "') else 1)"]); break; } catch { await sleep(250); } }
      await launch({ ...isolatedEnv(), GDK_BACKEND: "x11", DISPLAY: display });
      await ensureWorkspace();
      const main = await currentHandle();
      const registered = await invoke("capture_shortcut_set", "{ combo: 'CommandOrControl+Alt+N' }");
      expect(registered).toBeNull(); // null = registrado; {error} = el sistema no lo permite
      await sleep(500);
      pressCtrlAltN(display);
      const handles = await waitHandles(2);
      expect(handles.length).toBe(2);
      await switchWindow(handles.find((h) => h !== main)!);
      await find('[aria-label="Nota rápida"]', 20000);
      expect(await run<string>("return document.title")).toContain("Captura");
    } finally { xserver.kill("SIGKILL"); }
  }, { timeout: 180_000, retry: 2 });
});
