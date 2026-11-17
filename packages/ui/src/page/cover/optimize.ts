import { browserEncodeDeps, CoverImageError, decodeAndEncode, type EncodeDeps, type EncodedCover } from "./encode";

type WorkerLike = { postMessage(m: unknown): void; terminate(): void; onmessage: ((e: { data: unknown }) => void) | null; onerror: ((e?: unknown) => void) | null };
export type OptimizeDeps = { createWorker?: () => WorkerLike | null; main?: EncodeDeps };

const defaultWorker = (): WorkerLike | null =>
  typeof Worker === "undefined" ? null : (new Worker(new URL("./imageWorker.ts", import.meta.url), { type: "module" }) as unknown as WorkerLike);

/** Alternativa sin worker (DP-4): cede el turno para que la interfaz pinte el indicador y trabaja en el hilo principal. */
async function inMainThread(bytes: Uint8Array, main: EncodeDeps | undefined): Promise<EncodedCover> {
  await new Promise<void>((r) => setTimeout(r, 0));
  return decodeAndEncode(bytes, main ?? browserEncodeDeps());
}

type Reply = { ok: true; jpeg: Uint8Array; sourceWidth: number; sourceHeight: number } | { ok: false; code: "corrupt" };

/**
 * Reduce, aplana y codifica la imagen a JPEG. Usa un worker si existe; si el worker no arranca o falla por sí mismo
 * se repite en el hilo principal. Una imagen dañada se informa tal cual (reintentar no la arregla).
 */
export async function optimizeCover(bytes: Uint8Array, deps: OptimizeDeps = {}): Promise<EncodedCover> {
  let worker: WorkerLike | null = null;
  try { worker = (deps.createWorker ?? defaultWorker)(); } catch { worker = null; }
  if (!worker) return inMainThread(bytes, deps.main);
  const w = worker;
  try {
    const reply = await new Promise<Reply>((resolve, reject) => {
      w.onmessage = (e) => resolve(e.data as Reply);
      w.onerror = () => reject(new Error("worker"));
      w.postMessage({ bytes });
    });
    if (!reply.ok) throw new CoverImageError(reply.code);
    return { jpeg: reply.jpeg, sourceWidth: reply.sourceWidth, sourceHeight: reply.sourceHeight };
  } catch (e) {
    if (e instanceof CoverImageError) throw e;
    return inMainThread(bytes, deps.main);
  } finally {
    w.terminate();
  }
}
