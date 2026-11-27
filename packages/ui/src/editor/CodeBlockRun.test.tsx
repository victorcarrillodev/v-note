// study-features-2 T-8 (prueba primero): ejecutar el código de un bloque (JavaScript y Python) y ver su salida.
import { describe, it, expect, vi } from "vitest";
import { screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { CodeBlockView } from "./CodeBlock";
import { RunnerProvider, type RunnerApi } from "../runner/RunnerContext";
import type { RunPhase, RunResult } from "../runner/types";

const result = (over: Partial<RunResult> = {}): RunResult => ({ ok: true, stdout: "", stderr: "", ms: 12, ...over });

async function mount(language: string, code: string, runner: RunnerApi | null) {
  const editor = { updateBlock: vi.fn() };
  const view = <CodeBlockView block={{ id: "b1", props: { language } }} editor={editor} contentRef={() => {}} />;
  const r = await renderWithI18n(runner ? <RunnerProvider value={runner}>{view}</RunnerProvider> : view);
  r.container.querySelector("[data-code-content]")!.textContent = code; // el editor real rellena el contenido
  return r;
}
const fakeRunner = (impl: RunnerApi["run"]): RunnerApi & { run: ReturnType<typeof vi.fn> } => ({ run: vi.fn(impl) });
const lastSignal = (r: { run: ReturnType<typeof vi.fn> }): AbortSignal => (r.run.mock.calls.at(-1)![2] as { signal: AbortSignal }).signal;

describe("ejecutar código", () => {
  it("JavaScript: muestra «Ejecutar», corre el texto del bloque y enseña salida, valor y duración", async () => {
    const runner = fakeRunner(async () => result({ stdout: "salida-uno\n", value: "42" }));
    const user = userEvent.setup();
    await mount("javascript", "console.log('x'); 6*7", runner);
    await user.click(screen.getByRole("button", { name: "Ejecutar" }));
    expect(runner.run).toHaveBeenCalledWith("javascript", "console.log('x'); 6*7", expect.anything());
    expect(await screen.findByText(/salida-uno/)).toBeInTheDocument();
    expect(screen.getByText(/42/)).toBeInTheDocument();
    expect(screen.getByText(/12 ms/)).toBeInTheDocument();
  });

  it("los errores y stderr se ven aparte, como error", async () => {
    const runner = fakeRunner(async () => result({ ok: false, stderr: "aviso\n", error: "ReferenceError: x is not defined" }));
    const user = userEvent.setup();
    await mount("javascript", "x", runner);
    await user.click(screen.getByRole("button", { name: "Ejecutar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("ReferenceError: x is not defined");
    expect(screen.getByText(/aviso/)).toBeInTheDocument();
  });

  it("Python avisa que está cargando el intérprete y mientras se ejecuta permite detener", async () => {
    let finish!: (r: RunResult) => void;
    const runner = fakeRunner((_l, _c, o) => new Promise<RunResult>((res) => { finish = res; o?.onPhase?.("loading" as RunPhase); }));
    const user = userEvent.setup();
    await mount("python", "print(1)", runner);
    await user.click(screen.getByRole("button", { name: "Ejecutar" }));
    expect(await screen.findByText("Cargando Python…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ejecutar" })).toBeNull();
    expect(lastSignal(runner).aborted).toBe(false);
    await user.click(screen.getByRole("button", { name: "Detener" }));
    expect(lastSignal(runner).aborted).toBe(true); // solo se cancela ESTA ejecución
    await act(async () => finish(result({ ok: false, cancelled: true, error: "Ejecución detenida" })));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ejecución detenida");
    expect(screen.getByRole("button", { name: "Ejecutar" })).toBeInTheDocument();
  });

  it("el tiempo agotado se explica", async () => {
    const runner = fakeRunner(async () => result({ ok: false, timedOut: true, error: "Tiempo agotado (10 s)" }));
    const user = userEvent.setup();
    await mount("python", "while True: pass", runner);
    await user.click(screen.getByRole("button", { name: "Ejecutar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Tiempo agotado (10 s)");
  });

  it("otros lenguajes, o sin intérprete disponible, no ofrecen «Ejecutar»", async () => {
    await mount("rust", "fn main() {}", fakeRunner(async () => result()));
    expect(screen.queryByRole("button", { name: "Ejecutar" })).toBeNull();
  });
  it("sin proveedor de ejecución (p. ej. fuera de la aplicación) el bloque funciona igual, sin botón", async () => {
    await mount("javascript", "1", null);
    expect(screen.queryByRole("button", { name: "Ejecutar" })).toBeNull();
    expect(screen.getByRole("button", { name: "Copiar código" })).toBeInTheDocument();
  });
  it("un bloque vacío no se ejecuta", async () => {
    const runner = fakeRunner(async () => result());
    const user = userEvent.setup();
    await mount("javascript", "   ", runner);
    await user.click(screen.getByRole("button", { name: "Ejecutar" }));
    expect(runner.run).not.toHaveBeenCalled();
  });

  it("si el bloque se desmonta mientras corre, su ejecución se cancela (no ocupa la cola)", async () => {
    const runner = fakeRunner(() => new Promise<RunResult>(() => {}));
    const user = userEvent.setup();
    const { unmount } = await mount("javascript", "while(true){}", runner);
    await user.click(screen.getByRole("button", { name: "Ejecutar" }));
    const signal = lastSignal(runner);
    unmount();
    expect(signal.aborted).toBe(true);
  });

  it("si el ejecutor lanza una excepción, se muestra el error y el botón vuelve (no se queda «ejecutando»)", async () => {
    const runner = fakeRunner(async () => { throw new Error("SecurityError: Worker bloqueado"); });
    const user = userEvent.setup();
    await mount("javascript", "1", runner);
    await user.click(screen.getByRole("button", { name: "Ejecutar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("SecurityError: Worker bloqueado");
    expect(screen.getByRole("button", { name: "Ejecutar" })).toBeInTheDocument();
  });

  it("los avisos de tiempo agotado, detenido y salida larga salen traducidos al español y al inglés", async () => {
    const cases: [Partial<RunResult>, string, string][] = [
      [{ ok: false, timedOut: true, limitMs: 10_000, error: "Tiempo agotado (10 s)" }, "Tiempo agotado (10 s)", "Timed out (10 s)"],
      [{ ok: false, cancelled: true, error: "Ejecución detenida" }, "Ejecución detenida", "Stopped"],
      [{ ok: false, truncated: true, error: "Salida demasiado larga: se detuvo la ejecución" }, "Salida demasiado larga: se detuvo la ejecución", "Output too long: the run was stopped"],
    ];
    for (const [res, es, en] of cases) {
      for (const [lng, expected] of [[undefined, es], ["en", en]] as const) {
        const runner = fakeRunner(async () => result(res));
        const user = userEvent.setup();
        const r = await (async () => {
          const view = <CodeBlockView block={{ id: "b1", props: { language: "javascript" } }} editor={{ updateBlock: vi.fn() }} contentRef={() => {}} />;
          const out = await renderWithI18n(<RunnerProvider value={runner}>{view}</RunnerProvider>, lng);
          out.container.querySelector("[data-code-content]")!.textContent = "1";
          return out;
        })();
        await user.click(screen.getByRole("button", { name: lng === "en" ? "Run" : "Ejecutar" }));
        expect(await screen.findByRole("alert")).toHaveTextContent(expected);
        r.unmount();
      }
    }
  });

  it("los fallos propios del intérprete (iniciar, caer, no responder, cargar Python) salen traducidos con su detalle", async () => {
    const cases: [Partial<RunResult>, string, string][] = [
      [{ ok: false, errorKey: "start", error: "SecurityError" }, "El intérprete no se pudo iniciar: SecurityError", "The interpreter could not start: SecurityError"],
      [{ ok: false, errorKey: "crashed" }, "El intérprete falló al ejecutar el código", "The interpreter failed while running the code"],
      [{ ok: false, errorKey: "silent" }, "El intérprete no respondió", "The interpreter did not respond"],
      [{ ok: false, errorKey: "pythonLoad", error: "sin red" }, "No se pudo cargar Python: sin red", "Python could not be loaded: sin red"],
    ];
    for (const [res, es, en] of cases) {
      for (const [lng, expected] of [[undefined, es], ["en", en]] as const) {
        const runner = fakeRunner(async () => result(res));
        const user = userEvent.setup();
        const view = <CodeBlockView block={{ id: "b1", props: { language: "javascript" } }} editor={{ updateBlock: vi.fn() }} contentRef={() => {}} />;
        const r = await renderWithI18n(<RunnerProvider value={runner}>{view}</RunnerProvider>, lng);
        r.container.querySelector("[data-code-content]")!.textContent = "1";
        await user.click(screen.getByRole("button", { name: lng === "en" ? "Run" : "Ejecutar" }));
        expect(await screen.findByRole("alert")).toHaveTextContent(expected);
        r.unmount();
      }
    }
  });
});
