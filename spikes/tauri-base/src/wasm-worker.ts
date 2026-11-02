import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

let db: any;
const ready = (async () => {
  const sqlite3 = await sqlite3InitModule();
  const pool = await sqlite3.installOpfsSAHPoolVfs({ name: "vnote-spike", clearOnInit: false });
  db = new pool.OpfsSAHPoolDb("/spike.db");
  return sqlite3.version.libVersion;
})();

self.onmessage = async (e: MessageEvent) => {
  const { id, sql, bind } = e.data;
  try {
    const version = await ready;
    const rows = db.exec({ sql, bind, returnValue: "resultRows", rowMode: "object" });
    (self as any).postMessage({ id, rows, version });
  } catch (err) {
    (self as any).postMessage({ id, error: String(err) });
  }
};
