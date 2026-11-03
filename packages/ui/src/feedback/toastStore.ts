export type ToastTone = "success" | "info";
export type ToastInput = { key: string; tone: ToastTone; message: string; undo?: { label: string; run: () => void } };
export type Toast = ToastInput & { id: number; duration: number };
type Snapshot = { visible: Toast[]; queued: Toast[] };

export const MAX_VISIBLE = 3;
const DURATION = { normal: 5000, withUndo: 8000 } as const;

/**
 * Cola de avisos TEMPORALES (nivel 1 de la matriz de avisos). Un mismo evento (misma clave) actualiza el aviso en vez de apilar otro;
 * como máximo 3 visibles y el resto espera. Los errores accionables NO caben aquí: son persistentes y viven en su contexto.
 */
export function createToastStore() {
  let seq = 0;
  let all: Toast[] = [];
  let snap: Snapshot = { visible: [], queued: [] };
  const listeners = new Set<() => void>();
  const recompute = () => { snap = { visible: all.slice(0, MAX_VISIBLE), queued: all.slice(MAX_VISIBLE) }; listeners.forEach((l) => l()); };
  return {
    getSnapshot: (): Snapshot => snap,
    subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
    add(input: ToastInput): number {
      if ((input.tone as string) === "error") throw new Error("Un error accionable es un aviso persistente en su contexto, no un aviso temporal");
      const duration = input.undo ? DURATION.withUndo : DURATION.normal;
      const existing = all.find((t) => t.key === input.key);
      if (existing) { all = all.map((t) => (t === existing ? { ...input, id: existing.id, duration } : t)); recompute(); return existing.id; }
      const id = ++seq;
      all = [...all, { ...input, id, duration }];
      recompute();
      return id;
    },
    dismiss(id: number) { all = all.filter((t) => t.id !== id); recompute(); },
  };
}

/** Almacén único de la aplicación. */
export const toastStore = createToastStore();
