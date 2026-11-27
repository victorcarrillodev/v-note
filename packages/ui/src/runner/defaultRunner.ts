import { CodeRunner } from "./codeRunner";

/** Ejecutor de código de la aplicación: un Worker del intérprete, creado a demanda. `null` si el entorno no admite Workers. */
export function createBrowserRunner(): CodeRunner | null {
  if (typeof Worker === "undefined") return null;
  return new CodeRunner(() => new Worker(new URL("./runner.worker.ts", import.meta.url), { type: "module" }) as never);
}
