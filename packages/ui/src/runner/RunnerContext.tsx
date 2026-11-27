import { createContext, useContext } from "react";
import type { RunCallOptions } from "./codeRunner";
import type { RunResult, RunnableLanguage } from "./types";

/** Lo que el bloque de código necesita para ejecutar. Cada ejecución se detiene con la señal que entrega (`opts.signal`). */
export type RunnerApi = {
  run(lang: RunnableLanguage, code: string, opts?: RunCallOptions): Promise<RunResult>;
};
const Ctx = createContext<RunnerApi | null>(null);
export const RunnerProvider = Ctx.Provider;
/** Sin proveedor (p. ej. fuera de la aplicación) no hay ejecución y el bloque funciona solo como editor. */
export const useRunner = (): RunnerApi | null => useContext(Ctx);

/** Lenguaje del bloque → lenguaje ejecutable (o `null` si no se puede ejecutar). */
export function runnableLanguage(language: string): RunnableLanguage | null {
  return language === "javascript" ? "javascript" : language === "python" ? "python" : null;
}
