// T-409 (e2e de escritorio real): al exportar a PDF desde la interfaz se abre el diálogo de impresión del sistema («Guardar como PDF»)
// con el documento exportado; Escape lo cierra y la app sigue viva. Como en el spike T-023, elegir el destino y guardar el archivo es del diálogo
// del sistema y no se automatiza (no se puede ver ni manejar de forma fiable fuera de una sesión gráfica con gestor de ventanas).
// Corre en un Xwayland aislado sin gestor de ventanas: el foco de teclado se le da al diálogo con XSetInputFocus.
import { describe, it, expect, afterEach } from "vitest";
import { execFileSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { stopApp, find, findX, click, sleep, button, type, run } from "./webdriver";
import { isolatedEnv, launch, ensureWorkspace, newPage, editorEl } from "./helpers";

afterEach(async () => { await stopApp(); });

const PY = `
import ctypes, sys
x11 = ctypes.CDLL("libX11.so.6"); xtst = ctypes.CDLL("libXtst.so.6")
x11.XOpenDisplay.restype = ctypes.c_void_p; x11.XStringToKeysym.restype = ctypes.c_ulong
x11.XDefaultRootWindow.restype = ctypes.c_ulong; x11.XDefaultRootWindow.argtypes = [ctypes.c_void_p]
x11.XKeysymToKeycode.argtypes = [ctypes.c_void_p, ctypes.c_ulong]; x11.XFlush.argtypes = [ctypes.c_void_p]
x11.XQueryTree.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.POINTER(ctypes.c_ulong), ctypes.POINTER(ctypes.c_ulong), ctypes.POINTER(ctypes.POINTER(ctypes.c_ulong)), ctypes.POINTER(ctypes.c_uint)]
x11.XFetchName.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.POINTER(ctypes.c_char_p)]
x11.XSetInputFocus.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_int, ctypes.c_ulong]
xtst.XTestFakeKeyEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
d = x11.XOpenDisplay(None)
title = sys.argv[1].encode()
r = ctypes.c_ulong(); p = ctypes.c_ulong(); kids = ctypes.POINTER(ctypes.c_ulong)(); n = ctypes.c_uint()
x11.XQueryTree(d, x11.XDefaultRootWindow(d), ctypes.byref(r), ctypes.byref(p), ctypes.byref(kids), ctypes.byref(n))
found = False
for i in range(n.value):
    nm = ctypes.c_char_p()
    if x11.XFetchName(d, kids[i], ctypes.byref(nm)) and nm.value == title:
        x11.XSetInputFocus(d, kids[i], 2, 0); found = True
x11.XFlush(d)
for name in sys.argv[2:]:
    k = x11.XKeysymToKeycode(d, x11.XStringToKeysym(name.encode()))
    xtst.XTestFakeKeyEvent(d, k, 1, 0); xtst.XTestFakeKeyEvent(d, k, 0, 0)
x11.XFlush(d)
print("dialogo" if found else "sin-dialogo")
`;
const keys = (display: string, windowTitle: string, ...names: string[]) =>
  execFileSync("python3", ["-I", "-c", PY, windowTitle, ...names], { env: { ...process.env, DISPLAY: display }, encoding: "utf8" }).trim();

describe("exportar a PDF en escritorio (T-409)", () => {
  it("al exportar a PDF se abre el diálogo de impresión del sistema con el documento", async () => {
    const display = ":97";
    // SIGKILL deja el bloqueo del servidor anterior y el siguiente no arrancaría
    for (const f of [`/tmp/.X${display.slice(1)}-lock`, `/tmp/.X11-unix/X${display.slice(1)}`]) rmSync(f, { force: true });
    const xserver = spawn("Xwayland", [display, "-geometry", "1000x800", "-noreset"], { stdio: "ignore" });
    for (let i = 0; i < 40; i++) { try { execFileSync("python3", ["-I", "-c", "import ctypes,sys; x=ctypes.CDLL('libX11.so.6'); x.XOpenDisplay.restype=ctypes.c_void_p; sys.exit(0 if x.XOpenDisplay(b'" + display + "') else 1)"]); break; } catch { await sleep(250); } }
    try {
      await launch({ ...isolatedEnv(), GDK_BACKEND: "x11", DISPLAY: display });
      await ensureWorkspace();
      await newPage("Informe de prueba");
      await type(await editorEl(), "Párrafo que debe salir en el PDF");
      await sleep(600);
      await click(await button("Exportar"));
      await find("[role=alertdialog]");
      await click(await findX('//*[@role="alertdialog"]//label[contains(.,"PDF")]/input'));
      await click(await findX('//*[@role="alertdialog"]//button[normalize-space(.)="Exportar"]'));
      let state = "sin-dialogo";
      for (let i = 0; i < 20 && state !== "dialogo"; i++) { await sleep(500); state = keys(display, "Imprimir"); }
      expect(state).toBe("dialogo");
      await sleep(1500);
      keys(display, "Imprimir", "Escape");
      await sleep(1500);
      // el diálogo se cerró y la app principal sigue respondiendo
      expect(keys(display, "Imprimir")).toBe("sin-dialogo");
      expect(await run<number>("return 1")).toBe(1);
    } finally { xserver.kill("SIGKILL"); }
  }, { timeout: 180_000, retry: 2 });
});
