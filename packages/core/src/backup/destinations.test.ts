import { describe, it, expect } from "vitest";
import { syncWithDestination } from "./destination";
import { DropboxDestination } from "./dropboxDestination";
import { GoogleDriveDestination } from "./googleDriveDestination";
import { LocalFolderDestination, type FolderSyncPort } from "./localFolderDestination";

const enc = new TextEncoder();

describe("BackupDestination implementations", () => {
  it("LocalFolderDestination escribe solo cambios, borra huérfanos y descarga todo", async () => {
    const disk = new Map<string, Uint8Array>();
    const writes: string[] = [];
    const port: FolderSyncPort = {
      label: "Mi Disco",
      readFile: async (p) => disk.get(p) ?? null,
      writeFile: async (p, b) => { writes.push(p); disk.set(p, b); },
      removeFile: async (p) => { disk.delete(p); },
      listFiles: async () => [...disk.keys()],
    };
    const dest = new LocalFolderDestination(port);

    const v1 = new Map([["app/workspaces.json", enc.encode("{}")], ["workspaces/1/a.md", enc.encode("v1")]]);
    const r1 = await syncWithDestination(dest, v1, 100);
    expect(r1.status).toBe("success");
    expect(writes).toEqual(["app/workspaces.json", "workspaces/1/a.md", "backup-manifest.json"]);

    writes.length = 0;
    const rUnchanged = await syncWithDestination(dest, v1, 200);
    expect(rUnchanged.status).toBe("unchanged");
    expect(writes).toEqual([]);

    const dl = await dest.downloadAll();
    expect(dl.ok).toBe(true);
    if (dl.ok) expect([...dl.value.keys()].sort()).toEqual(["app/workspaces.json", "workspaces/1/a.md"]);
  });

  it("GoogleDriveDestination usa PATCH sobre el mismo fileId sin crear duplicados", async () => {
    const files = new Map<string, { id: string; name: string; body: string }>();
    let seq = 0;
    const calls: string[] = [];

    const fetchMock = async (url: string, init?: { method?: string; body?: string }) => {
      const method = init?.method ?? "GET";
      calls.push(`${method} ${url.split("?")[0]}`);
      if (url.includes("/drive/v3/files?")) {
        const m = [...files.values()].find((f) => f.name === "backup-manifest.json");
        return { ok: true, status: 200, text: async () => "", json: async () => ({ files: m ? [{ id: m.id }] : [] }) };
      }
      if (url.includes("?alt=media")) {
        const id = url.split("/files/")[1]!.split("?")[0]!;
        const f = [...files.values()].find((x) => x.id === id);
        return { ok: !!f, status: f ? 200 : 404, text: async () => f?.body ?? "", json: async () => JSON.parse(f!.body) };
      }
      if (method === "POST" && url.includes("uploadType=multipart")) {
        const id = `gd-${++seq}`;
        const raw = init?.body ?? "";
        const name = raw.match(/"name":"([^"]+)"/)?.[1] ?? "unknown";
        const content = raw.split("\r\n\r\n")[2]?.split("\r\n--")[0] ?? "";
        files.set(id, { id, name, body: content });
        return { ok: true, status: 200, text: async () => "", json: async () => ({ id }) };
      }
      if (method === "PATCH") {
        const id = url.split("/files/")[1]!.split("?")[0]!;
        const f = files.get(id)!;
        f.body = init?.body ?? "";
        return { ok: true, status: 200, text: async () => "", json: async () => ({ id }) };
      }
      return { ok: true, status: 200, text: async () => "", json: async () => ({}) };
    };

    const drive = new GoogleDriveDestination({ fetch: fetchMock as never, getAccessToken: async () => "tok", folderId: "root" });
    await syncWithDestination(drive, new Map([["a.md", enc.encode("hola")]]), 100);
    const countAfterFirst = files.size;

    calls.length = 0;
    await syncWithDestination(drive, new Map([["a.md", enc.encode("hola-editado")]]), 200);
    expect(files.size).toBe(countAfterFirst); // cero archivos duplicados
    expect(calls.some((c) => c.startsWith("PATCH"))).toBe(true);
    expect(calls.some((c) => c.startsWith("POST"))).toBe(false);
  });

  it("DropboxDestination usa overwrite + mute y descarga archivos", async () => {
    const dbx = new Map<string, string>();
    const modes: string[] = [];

    const fetchMock = async (url: string, init?: { headers?: Record<string, string>; body?: string }) => {
      const arg = init?.headers?.["Dropbox-API-Arg"] ? JSON.parse(init.headers["Dropbox-API-Arg"]) : null;
      if (url.endsWith("/files/download")) {
        const body = dbx.get(arg.path);
        if (body === undefined) return { ok: false, status: 409, text: async () => "not_found", json: async () => ({}) };
        return { ok: true, status: 200, text: async () => body, json: async () => JSON.parse(body) };
      }
      if (url.endsWith("/files/upload")) {
        modes.push(`${arg.mode}:${String(arg.mute)}`);
        dbx.set(arg.path, init?.body ?? "");
        return { ok: true, status: 200, text: async () => "", json: async () => ({}) };
      }
      return { ok: true, status: 200, text: async () => "", json: async () => ({}) };
    };

    const dest = new DropboxDestination({ fetch: fetchMock as never, getAccessToken: async () => "tok" });
    const r = await syncWithDestination(dest, new Map([["a.md", enc.encode("contenido")]]), 100);
    expect(r.status).toBe("success");
    expect(modes.every((m) => m === "overwrite:true")).toBe(true);

    const dl = await dest.downloadAll();
    expect(dl.ok).toBe(true);
    if (dl.ok) expect(new TextDecoder().decode(dl.value.get("a.md"))).toBe("contenido");
  });
});
