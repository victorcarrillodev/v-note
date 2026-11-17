// Worker de la portada (DP-4): decodifica y codifica fuera del hilo de la interfaz (RNF-4).
import { browserEncodeDeps, CoverImageError, decodeAndEncode } from "./encode";

type Reply = { ok: true; jpeg: Uint8Array; sourceWidth: number; sourceHeight: number } | { ok: false; code: "corrupt" };

self.onmessage = async (e: MessageEvent<{ bytes: Uint8Array }>) => {
  let reply: Reply;
  try {
    const r = await decodeAndEncode(e.data.bytes, browserEncodeDeps());
    reply = { ok: true, ...r };
  } catch (err) {
    reply = { ok: false, code: err instanceof CoverImageError ? err.code : "corrupt" };
  }
  (self as unknown as { postMessage(m: Reply, t?: Transferable[]): void }).postMessage(reply, reply.ok ? [reply.jpeg.buffer] : []);
};
