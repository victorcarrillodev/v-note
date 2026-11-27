// @vitest-environment node
// study-features-2 T-8 (prueba primero): motor de JavaScript aislado (QuickJS en WebAssembly): sin acceso al navegador ni a la red.
import { describe, it, expect } from "vitest";
import { runJs } from "./jsEngine";

describe("JavaScript aislado", () => {
  it("captura console.log (varios argumentos y objetos) y el valor de la última expresión", async () => {
    const r = await runJs('console.log("hola", 2, {a: [1, 2]}); 6 * 7');
    expect(r).toMatchObject({ ok: true, stdout: 'hola 2 {"a":[1,2]}\n', stderr: "", value: "42" });
    expect(r.ms).toBeGreaterThanOrEqual(0);
  });

  it("console.error y console.warn van a stderr", async () => {
    const r = await runJs('console.error("mal"); console.warn("ojo")');
    expect(r.stdout).toBe("");
    expect(r.stderr).toBe("mal\nojo\n");
  });

  it("un error de sintaxis o de ejecución se informa sin lanzar", async () => {
    const syntax = await runJs("let = ;");
    expect(syntax.ok).toBe(false);
    expect(syntax.error).toMatch(/syntax|unexpected/i);
    const thrown = await runJs('console.log("antes"); throw new Error("explotó")');
    expect(thrown).toMatchObject({ ok: false, stdout: "antes\n" });
    expect(thrown.error).toContain("explotó");
  });

  it("un bucle infinito se corta por tiempo y no congela nada", async () => {
    const t0 = Date.now();
    const r = await runJs("while (true) {}", { timeoutMs: 300 });
    expect(r.ok).toBe(false);
    expect(r.timedOut).toBe(true);
    expect(Date.now() - t0).toBeLessThan(3000);
  });

  it("no ve el navegador, el sistema ni la red", async () => {
    const r = await runJs('console.log([typeof window, typeof document, typeof process, typeof require, typeof fetch, typeof XMLHttpRequest, typeof localStorage, typeof WebSocket].join(","))');
    expect(r.stdout).toBe("undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined\n");
    const net = await runJs('fetch("https://example.com")');
    expect(net.ok).toBe(false);
    expect(net.error).toMatch(/fetch/);
  });

  it("limita la salida y la memoria sin tumbar la aplicación", async () => {
    const t0 = Date.now();
    const big = await runJs('for (let i = 0; i < 1e9; i++) console.log("x".repeat(50))', { maxOutputChars: 1000, timeoutMs: 10_000 });
    expect(big.stdout.length).toBeLessThan(1200);
    expect(big.ok).toBe(false);
    expect(big.truncated).toBe(true);
    expect(big.stdout).not.toMatch(/truncad/i); // sin texto de idioma dentro de la salida
    expect(big.error).toBeUndefined();
    expect(big.timedOut).toBeUndefined();
    expect(Date.now() - t0).toBeLessThan(2000); // se detiene al pasarse del tope; no espera a que termine el bucle
    const mem = await runJs("const a = []; while (true) a.push(new Array(1e5).fill(1));", { memoryBytes: 16 * 1024 * 1024, timeoutMs: 5000 });
    expect(mem.ok).toBe(false);
  });

  it("las promesas pendientes se resuelven antes de terminar", async () => {
    const r = await runJs('Promise.resolve(1).then((v) => console.log("p", v + 1)); console.log("sync")');
    expect(r.stdout).toBe("sync\np 2\n");
  });

  it("cada ejecución parte de cero: nada queda entre una y otra", async () => {
    await runJs("globalThis.secreto = 123");
    const r = await runJs("console.log(typeof secreto)");
    expect(r.stdout).toBe("undefined\n");
  });
});
