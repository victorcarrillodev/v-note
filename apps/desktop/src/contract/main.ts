import { invoke } from "@tauri-apps/api/core";
import { TauriAssetStore, TauriSqlStore } from "@vnote/adapters-tauri";
import { runSqlStoreContract } from "@vnote/core/src/ports/sqlStore.contract";
import { runAssetStoreContract } from "@vnote/core/src/assets/assetStore.contract";
import { runAll } from "./vitestShim";

runSqlStoreContract("SQLite nativo (Tauri)", () => TauriSqlStore.open(invoke, ":memory:"));

runAssetStoreContract("carpeta nativa (Tauri)", async () => new TauriAssetStore(invoke, `/tmp/vnote-e2e-assets-${crypto.randomUUID()}`));

runAll().then((results) => {
  (window as unknown as { __contractResult: unknown }).__contractResult = results;
  document.getElementById("out")!.textContent = results.map((r) => `${r.ok ? "✓" : "✗"} ${r.name}${r.error ? " — " + r.error : ""}`).join("\n");
});
