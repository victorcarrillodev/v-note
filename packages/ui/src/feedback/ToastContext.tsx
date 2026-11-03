import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createToastStore } from "./toastStore";
import { ToastViewport } from "./ToastViewport";

type Store = ReturnType<typeof createToastStore>;
const Ctx = createContext<Store | null>(null);

/** Cola única de avisos temporales de la aplicación; el visor se monta una sola vez aquí. */
export function ToastProvider({ children, store }: { children: ReactNode; store?: Store }) {
  const s = useMemo(() => store ?? createToastStore(), [store]);
  return <Ctx.Provider value={s}>{children}<ToastViewport store={s} /></Ctx.Provider>;
}

/** Fuera de un proveedor los avisos se descartan: los componentes siguen funcionando en pruebas aisladas. */
const NOOP: Store = createToastStore();
export function useToasts(): Store { return useContext(Ctx) ?? NOOP; }
