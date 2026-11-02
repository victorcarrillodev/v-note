import type { Result } from "../result";
import { normalizeCombo } from "./shortcuts";

/** Registro de un atajo que funciona aunque la aplicación esté en segundo plano (solo escritorio; RF-13). */
export interface GlobalShortcutService {
  /** Registra el atajo (o lo quita con `null`). Falla si el sistema no lo permite o lo usa otro programa (CL-15). */
  set(combo: string | null): Promise<Result<void>>;
}

/** Formato del plugin nativo: `Mod` pasa a `CommandOrControl`. */
export function toNativeCombo(combo: string): string {
  return normalizeCombo(combo).split("+").map((p) => (p === "Mod" ? "CommandOrControl" : p)).join("+");
}
