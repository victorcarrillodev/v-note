// @vitest-environment node
// study-features-2 T-8 (prueba primero): Python aislado (Pyodide en WebAssembly) con el intérprete real.
import { describe, it, expect, beforeAll } from "vitest";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { createPythonEngine, lockdownGlobals, LOCKED_GLOBALS } from "./pythonEngine";

let engine: ReturnType<typeof createPythonEngine>;
beforeAll(() => {
  engine = createPythonEngine(async () => {
    const { loadPyodide } = await import("pyodide");
    // Vitest reescribe las rutas del paquete: se indica la carpeta real con el intérprete.
    const indexURL = `${dirname(createRequire(import.meta.url).resolve("pyodide"))}/`;
    return loadPyodide({ indexURL }) as never;
  });
}, 60_000);

describe("Python aislado", () => {
  it("print, varios argumentos y el valor de la última expresión", async () => {
    const r = await engine.run('print("hola", 2)\n1 + 1');
    expect(r).toMatchObject({ ok: true, stdout: "hola 2\n", stderr: "", value: "2" });
  }, 60_000);

  it("stderr y las excepciones se informan sin lanzar", async () => {
    const e = await engine.run('import sys\nprint("mal", file=sys.stderr)');
    expect(e.stderr).toBe("mal\n");
    const z = await engine.run("print('antes')\n1/0");
    expect(z).toMatchObject({ ok: false, stdout: "antes\n" });
    expect(z.error).toContain("ZeroDivisionError");
    const s = await engine.run("def (:");
    expect(s.ok).toBe(false);
    expect(s.error).toContain("SyntaxError");
  }, 60_000);

  it("la biblioteca estándar funciona", async () => {
    const r = await engine.run("import math, json\nprint(json.dumps({'raiz': math.sqrt(16)}))");
    expect(r.stdout).toBe('{"raiz": 4.0}\n');
  }, 60_000);

  it("cada ejecución parte de cero y input() no se queda esperando", async () => {
    await engine.run("secreto = 123");
    const r = await engine.run("print('secreto' in globals())");
    expect(r.stdout).toBe("False\n");
    const i = await engine.run("input('?')");
    expect(i.ok).toBe(false);
    expect(i.error).toMatch(/EOFError|input/);
  }, 60_000);

  it("la salida sin salto de línea de una ejecución no se cuela en la siguiente (ni tras truncar)", async () => {
    const a = await engine.run('print("sin salto", end="")');
    expect(a.stdout).toBe("sin salto");
    const b = await engine.run('print("b")');
    expect(b.stdout).toBe("b\n");
    await engine.run('for i in range(100000):\n    print("x" * 50)', { maxOutputChars: 200 });
    const c = await engine.run('print("limpio")');
    expect(c.stdout).toBe("limpio\n");
  }, 60_000);

  it("si el tope solo se pasa en el vaciado final (línea sin salto), también se marca como truncada", async () => {
    const r = await engine.run('print("abcdefghij", end="")', { maxOutputChars: 5 });
    expect(r.truncated).toBe(true);
    expect(r.ok).toBe(false);
    expect(r.stdout).toBe("abcde");
  }, 60_000);

  it("los fallos de carga llevan una clave traducible y el detalle técnico aparte", async () => {
    const broken = createPythonEngine(async () => { throw new Error("sin red"); });
    const r = await broken.run("1");
    expect(r).toMatchObject({ ok: false, errorKey: "pythonLoad", error: "sin red" });
  });

  it("pedir más memoria de la que hay falla con MemoryError y no tumba el intérprete", async () => {
    const r = await engine.run("x = [0] * 10**11");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/MemoryError|OverflowError/);
    expect((await engine.run("print(1)")).stdout).toBe("1\n");
  }, 60_000);

  it("limita la salida", async () => {
    const r = await engine.run('for i in range(100000):\n    print("x" * 50)', { maxOutputChars: 500 });
    expect(r.stdout.length).toBeLessThanOrEqual(500);
    expect(r.ok).toBe(false);
    expect(r.truncated).toBe(true);
    expect(r.stdout).not.toMatch(/truncad/i);
    expect(r.error).toBeUndefined();
  }, 60_000);
});

describe("aislamiento del Worker: cadena de prototipos", () => {
  /** Un ámbito como el de un Worker real: `fetch` e `indexedDB` viven en prototipos, no en el objeto. */
  const workerLikeScope = () => {
    const base = { fetch: () => "red", indexedDB: {}, caches: {}, importScripts: () => 1 };
    const mid = Object.create(base);            // WorkerGlobalScope.prototype
    const scope = Object.create(mid) as Record<string, unknown>; // DedicatedWorkerGlobalScope
    scope.XMLHttpRequest = class {};
    const navProto = { storage: { getDirectory: () => "opfs" }, locks: {}, sendBeacon: () => true };
    scope.navigator = Object.create(navProto);
    scope.postMessage = () => "canal";
    return { scope, base, mid, navProto };
  };

  it("quita fetch, indexedDB, caches e importScripts también en los prototipos (no solo sombrearlos)", () => {
    const { scope, base, mid } = workerLikeScope();
    lockdownGlobals(scope);
    for (const name of ["fetch", "indexedDB", "caches", "importScripts"]) {
      expect(typeof scope[name], name).toBe("undefined");
      expect(typeof (mid as Record<string, unknown>)[name], `${name} en el prototipo`).toBe("undefined");
      expect(typeof (Object.getPrototypeOf(Object.getPrototypeOf(scope)) as Record<string, unknown>)[name], `${name} dos niveles arriba`).toBe("undefined");
      expect(typeof (base as Record<string, unknown>)[name], `${name} en la base`).toBe("undefined");
    }
    expect(typeof scope.postMessage).toBe("function");
  });

  it("quita el almacenamiento del navegador (OPFS), los bloqueos y el envío de balizas desde navigator", () => {
    const { scope, navProto } = workerLikeScope();
    lockdownGlobals(scope);
    const nav = scope.navigator as Record<string, unknown>;
    for (const name of ["storage", "locks", "sendBeacon"]) {
      expect(typeof nav[name], name).toBe("undefined");
      expect(typeof (navProto as Record<string, unknown>)[name], `${name} en el prototipo`).toBe("undefined");
    }
  });

  it("navigator queda reducido a una lista corta de permitidos: una API nueva (storageBuckets) se cierra por defecto", () => {
    const navProto = {
      userAgent: "x", language: "es", languages: ["es"], onLine: true, hardwareConcurrency: 4, platform: "Linux",
      storage: { getDirectory: () => 1 }, storageBuckets: { open: () => 1 }, serviceWorker: {}, locks: {}, sendBeacon: () => true,
      gpu: {}, usb: {}, bluetooth: {}, credentials: {}, clipboard: {}, mediaDevices: {}, apiDeNavegadorFutura: { fetchAlgo: () => 1 },
    };
    const scope: Record<string, unknown> = { navigator: Object.create(navProto), postMessage: () => 1 };
    lockdownGlobals(scope);
    const nav = scope.navigator as Record<string, unknown>;
    for (const keep of ["userAgent", "language", "languages", "onLine", "hardwareConcurrency", "platform"]) expect(nav[keep], keep).toBeDefined();
    for (const gone of ["storage", "storageBuckets", "serviceWorker", "locks", "sendBeacon", "gpu", "usb", "bluetooth", "credentials", "clipboard", "mediaDevices", "apiDeNavegadorFutura"]) {
      expect(typeof nav[gone], gone).toBe("undefined");
    }
  });

  it("también se cierran WebSocketStream y las APIs de envío en segundo plano", () => {
    for (const n of ["WebSocketStream", "WebTransport", "RTCPeerConnection", "EventSource"]) expect(LOCKED_GLOBALS).toContain(n);
  });

  it("no se puede recuperar subiendo por los prototipos con getPrototypeOf", () => {
    const { scope } = workerLikeScope();
    lockdownGlobals(scope);
    let proto: object | null = scope;
    while (proto && proto !== Object.prototype) {
      expect(typeof (proto as Record<string, unknown>).fetch).toBe("undefined");
      proto = Object.getPrototypeOf(proto);
    }
  });

  it("es idempotente: llamarlo dos veces no falla", () => {
    const { scope } = workerLikeScope();
    lockdownGlobals(scope);
    expect(() => lockdownGlobals(scope)).not.toThrow();
  });
});

describe("aislamiento del Worker", () => {
  it("después de cargar el intérprete se quitan la red y el almacenamiento del ámbito global", () => {
    const scope: Record<string, unknown> = {};
    for (const name of LOCKED_GLOBALS) if (!name.includes(".")) scope[name] = () => "disponible";
    scope.navigator = { sendBeacon: () => true };
    scope.postMessage = () => "se conserva"; // el canal con la aplicación debe seguir
    lockdownGlobals(scope);
    for (const name of LOCKED_GLOBALS) if (!name.includes(".")) expect(typeof scope[name], name).toBe("undefined");
    expect(typeof (scope.navigator as { sendBeacon: unknown }).sendBeacon).toBe("undefined");
    expect(typeof scope.postMessage).toBe("function");
  });
  it("lo bloqueado incluye red, sockets, almacenamiento y carga de scripts", () => {
    for (const n of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "indexedDB", "caches", "importScripts", "BroadcastChannel", "Worker", "SharedWorker", "navigator.storage", "navigator.locks", "navigator.serviceWorker"]) expect(LOCKED_GLOBALS).toContain(n);
  });
  it("tras el bloqueo no se pueden restaurar desde el ámbito, ni reasignar ni redefinir", () => {
    "use strict";
    const scope: Record<string, unknown> = { fetch: () => 1 };
    lockdownGlobals(scope);
    expect(() => { scope.fetch = () => 1; }).toThrow();
    expect(() => Object.defineProperty(scope, "fetch", { value: () => 1 })).toThrow();
    expect(scope.fetch).toBeUndefined();
  });
});

describe("carga del intérprete", () => {
  it("si la carga falla una vez, la siguiente ejecución vuelve a intentarlo en vez de quedarse rota", async () => {
    let attempts = 0;
    const flaky = createPythonEngine(async () => {
      attempts++;
      if (attempts === 1) throw new Error("red caída");
      const { loadPyodide } = await import("pyodide");
      return loadPyodide({ indexURL: `${dirname(createRequire(import.meta.url).resolve("pyodide"))}/` }) as never;
    });
    const first = await flaky.run("1");
    expect(first.ok).toBe(false);
    expect(first.error).toContain("red caída");
    const second = await flaky.run("1 + 1");
    expect(second).toMatchObject({ ok: true, value: "2" });
    expect(attempts).toBe(2);
  }, 60_000);
});
