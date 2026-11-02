/** Identificador estable y único (UUID v4). */
export const newId = (): string => globalThis.crypto.randomUUID();
