import { describe, it, expect } from "vitest";
import { createDestination } from "./destinationFactory";
import { MemoryKeychain } from "./tokenStore";
import type { FolderSyncPort } from "./localFolderDestination";

const port: FolderSyncPort = { label: "x", readFile: async () => null, writeFile: async () => {}, removeFile: async () => {}, listFiles: async () => [] };
const deps = { fetch: (async () => ({ status: 200, headers: { get: () => null }, json: async () => ({}), text: async () => "" })) as never, keychain: new MemoryKeychain(), folderPort: () => port };

describe("createDestination", () => {
  it("crea el destino según la configuración", async () => {
    const l = await createDestination({ kind: "local-folder" }, deps);
    expect(l.ok && l.value.kind).toBe("local-folder");
    const gd = await createDestination({ kind: "google-drive", clientId: "c", folderId: "f" }, deps);
    expect(gd.ok && gd.value.kind).toBe("google-drive");
    const db = await createDestination({ kind: "dropbox", clientId: "c" }, deps);
    expect(db.ok && db.value.kind).toBe("dropbox");
  });
  it("GitHub exige token del llavero y falla con un error claro si falta", async () => {
    const miss = await createDestination({ kind: "github", owner: "o", repo: "r" }, deps);
    expect(miss.ok).toBe(false);
    await deps.keychain.set("github:backup", "ghp_x");
    const ok = await createDestination({ kind: "github", owner: "o", repo: "r" }, deps);
    expect(ok.ok && ok.value.kind).toBe("github");
  });
  it("rechaza configuraciones incompletas", async () => {
    expect((await createDestination({ kind: "google-drive", clientId: "", folderId: "f" }, deps)).ok).toBe(false);
    expect((await createDestination({ kind: "github", owner: "", repo: "r" }, deps)).ok).toBe(false);
  });
});
