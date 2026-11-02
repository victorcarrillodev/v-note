export interface InstanceLockHandle {
  release(): Promise<void>;
}

/** Puerto: garantiza que un solo contexto edita un espacio de trabajo a la vez (CL-22). `null` = ya lo tiene otro. */
export interface InstanceLock {
  acquire(name: string): Promise<InstanceLockHandle | null>;
}
