// Punto de entrada del Worker del navegador: SQLite WASM sobre OPFS con el VFS "opfs-sahpool" (exige un único escritor por pool).
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { createWorkerHost } from "./wasmSqlStore";

type Pool = Awaited<ReturnType<Awaited<ReturnType<typeof sqlite3InitModule>>["installOpfsSAHPoolVfs"]>>;
const LEGACY = "vnote";
const sqlite3Ready = sqlite3InitModule();
const pools = new Map<string, Promise<Pool>>();

/** Cada espacio usa su propio pool (así pueden estar abiertos varios a la vez). Los datos que ya estuvieran en el pool único anterior se siguen leyendo de él. */
function poolFor(path: string): Promise<Pool> {
  const cached = pools.get(path);
  if (cached) return cached;
  const made = (async () => {
    const sqlite3 = await sqlite3Ready;
    const own = () => sqlite3.installOpfsSAHPoolVfs({ name: `${LEGACY}-${path.replace(/[^A-Za-z0-9]+/g, "-")}`, clearOnInit: false });
    // El sondeo del pool anterior es atómico entre workers: quien lo toma o lo conserva (si ya contiene la base) o lo suelta.
    const locks = (self as unknown as { navigator: { locks?: { request<T>(name: string, fn: () => Promise<T>): Promise<T> } } }).navigator.locks;
    const probe = async (): Promise<Pool | null> => {
      let legacy: Pool;
      try { legacy = await sqlite3.installOpfsSAHPoolVfs({ name: LEGACY, clearOnInit: false }); } catch { return null; }
      if (legacy.getFileNames().includes(path)) return legacy;
      await legacy.removeVfs();
      return null;
    };
    const found = locks ? await locks.request("vnote-legacy-pool", probe) : await probe();
    return found ?? own();
  })();
  pools.set(path, made);
  return made;
}

const host = createWorkerHost(
  async (path) => new (await poolFor(path)).OpfsSAHPoolDb(path),
  async (path) => {
    (await poolFor(path)).unlink(path);
  },
);

(self as unknown as { onmessage: (e: MessageEvent) => void }).onmessage = async (e) => {
  (self as unknown as { postMessage: (m: unknown) => void }).postMessage(await host(e.data));
};
