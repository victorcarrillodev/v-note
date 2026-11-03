import { saveStatusReducer, type SaveEvent, type SaveStatus } from "./saveStatus";

/** Almacén externo del estado de guardado de la página abierta (alimentado por la sesión del documento, leído por la cabecera). */
export function createSaveStatusStore() {
  let state: SaveStatus = { kind: "saved" };
  let retryFn: (() => void) | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  return {
    getSnapshot: () => state,
    subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
    dispatch(e: SaveEvent) { const next = saveStatusReducer(state, e); if (next !== state && (next.kind !== state.kind || (next.kind === "error" && state.kind === "error" && next.message !== state.message))) { state = next; emit(); } },
    setRetry(fn: (() => void) | null) { retryFn = fn; },
    retry() { this.dispatch({ type: "retry" }); retryFn?.(); },
    reset() { state = { kind: "saved" }; retryFn = null; emit(); },
  };
}

/** Almacén único de la aplicación. */
export const saveStatusStore = createSaveStatusStore();
