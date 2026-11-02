import type { InstanceLock, InstanceLockHandle } from "@vnote/core";

export interface LockManagerLike {
  request<T>(name: string, opts: { ifAvailable: true }, cb: (lock: object | null) => Promise<T> | T): Promise<T>;
}

/** Bloqueo entre pestañas/ventanas con la API Web Locks: se mantiene mientras no se libere o se cierre la pestaña. */
export class WebInstanceLock implements InstanceLock {
  /** `null` = sin soporte de Web Locks; sin argumento se detecta el del navegador. */
  constructor(private locks: LockManagerLike | null = (globalThis.navigator as { locks?: LockManagerLike } | undefined)?.locks ?? null) {}

  async acquire(name: string): Promise<InstanceLockHandle | null> {
    const locks = this.locks;
    if (!locks) throw new Error("Este navegador no admite Web Locks; no se puede garantizar que solo haya un editor");
    return new Promise<InstanceLockHandle | null>((resolveHandle, reject) => {
      locks
        .request(`vnote:${name}`, { ifAvailable: true }, (lock) => {
          if (!lock) {
            resolveHandle(null);
            return undefined;
          }
          // El bloqueo se conserva hasta que se resuelva esta promesa.
          return new Promise<void>((release) => {
            let released = false;
            resolveHandle({
              release: async () => {
                if (released) return;
                released = true;
                release();
              },
            });
          });
        })
        .catch(reject);
    });
  }
}
