// T-103 (prueba primero): una segunda ejecución no abre otro editor: termina y la primera sigue viva (CL-22).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { startApp, stopApp, find, run, DESKTOP_BIN, sleep } from "./webdriver";

beforeAll(async () => { await startApp(); await find("#root"); });
afterAll(stopApp);

describe("instancia única", () => {
  it("la segunda ejecución termina por sí sola y la primera sigue respondiendo", async () => {
    const second = spawn(DESKTOP_BIN, [], { stdio: "ignore" });
    const outcome = await new Promise<"exit" | "timeout">((res) => {
      second.on("exit", () => res("exit"));
      setTimeout(() => res("timeout"), 15_000);
    });
    if (outcome === "timeout") second.kill("SIGKILL");
    expect(outcome).toBe("exit");
    await sleep(300);
    expect(await run<string>("return document.getElementById('root') ? 'viva' : 'muerta'")).toBe("viva");
  });
});
