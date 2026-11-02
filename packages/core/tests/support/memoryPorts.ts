// Adaptadores EN MEMORIA de los puertos de plataforma, solo para pruebas.
import { createNodeSqliteStore } from "./nodeSqliteStore";
import type { AppConfigStore, WorkspaceStorage } from "../../src/workspaces/ports";
import type { SqlStore } from "../../src/ports/sqlStore";

export class MemoryConfigStore implements AppConfigStore {
  constructor(public text: string | null = null) {}
  async read() { return this.text; }
  async write(text: string) { this.text = text; }
}

export class MemoryWorkspaceStorage implements WorkspaceStorage {
  stores = new Map<string, SqlStore>();
  missing = new Set<string>();
  removed: string[] = [];
  opened = 0;
  defaultLocation(id: string) { return `mem://${id}`; }
  async exists(location: string) { return !this.missing.has(location) && (this.stores.has(location) || true); }
  async open(location: string) {
    this.opened++;
    let s = this.stores.get(location);
    if (!s) { s = await createNodeSqliteStore(":memory:"); this.stores.set(location, s); }
    return s;
  }
  async remove(location: string) { this.removed.push(location); this.stores.delete(location); }
}
