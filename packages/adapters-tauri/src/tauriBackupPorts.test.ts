import { describe, it, expect } from "vitest";
import { TauriFolderPort, TauriOAuthPort } from "./tauriBackupPorts";
import type { Invoke } from "./tauriSqlStore";

function fake(handler: (cmd: string, args: any) => unknown) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const calls: { cmd: string; args: unknown }[] = [];
  const invoke: Invoke = async (cmd, args) => { calls.push({ cmd, args }); return handler(cmd, args); };
  return { calls, invoke };
}

describe("TauriFolderPort", () => {
  it("lee y escribe en base64 sobre la carpeta elegida y lista/borra por ruta relativa", async () => {
    const { calls, invoke } = fake((cmd) => (cmd === "folder_read" ? btoa("hola") : cmd === "folder_list" ? ["a.md"] : null));
    const p = new TauriFolderPort(invoke, "/home/u/Respaldo");
    expect(p.label).toBe("Respaldo");
    expect(new TextDecoder().decode((await p.readFile("a.md"))!)).toBe("hola");
    await p.writeFile("x/b.md", new TextEncoder().encode("hey"));
    await p.removeFile("a.md");
    expect(await p.listFiles()).toEqual(["a.md"]);
    expect(calls).toEqual([
      { cmd: "folder_read", args: { root: "/home/u/Respaldo", rel: "a.md" } },
      { cmd: "folder_write", args: { root: "/home/u/Respaldo", rel: "x/b.md", data: btoa("hey") } },
      { cmd: "folder_remove", args: { root: "/home/u/Respaldo", rel: "a.md" } },
      { cmd: "folder_list", args: { root: "/home/u/Respaldo" } },
    ]);
  });
  it("un archivo inexistente es null", async () => {
    const p = new TauriFolderPort(fake(() => null).invoke, "C:\\Datos\\Respaldo");
    expect(await p.readFile("no.md")).toBeNull();
    expect(p.label).toBe("Respaldo");
  });
});

describe("TauriOAuthPort", () => {
  it("escucha en un puerto local, abre el navegador y devuelve la URL completa de retorno", async () => {
    const { calls, invoke } = fake((cmd) => (cmd === "oauth_listen" ? 4567 : cmd === "oauth_wait" ? "/cb?code=abc&state=s" : null));
    const port = new TauriOAuthPort(invoke);
    await port.prepare();
    expect(port.redirectUri).toBe("http://127.0.0.1:4567/cb");
    const url = await port.authorize("https://accounts.google.com/o/oauth2/v2/auth?x=1", port.redirectUri);
    expect(url).toBe("http://127.0.0.1:4567/cb?code=abc&state=s");
    expect(calls.map((c) => c.cmd)).toEqual(["oauth_listen", "oauth_wait", "open_oauth_url"]);
    expect(calls.find((c) => c.cmd === "open_oauth_url")?.args).toEqual({ url: "https://accounts.google.com/o/oauth2/v2/auth?x=1" });
  });
});
