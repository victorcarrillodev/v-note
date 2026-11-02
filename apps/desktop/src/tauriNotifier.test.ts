// T-307 (prueba primero): además de la notificación del sistema, un recordatorio abre la ventana pequeña.
import { describe, it, expect, vi } from "vitest";

const send = vi.fn();
vi.mock("@tauri-apps/plugin-notification", () => ({ isPermissionGranted: async () => true, requestPermission: async () => "granted", sendNotification: (n: unknown) => send(n) }));
import { TauriNotifier } from "./tauriNotifier";

describe("TauriNotifier (T-307)", () => {
  it("un recordatorio de una tarea manda la notificación y abre la ventana con su espacio, página y tarea", async () => {
    const invoke = vi.fn(async () => undefined);
    await new TauriNotifier(invoke).notify({ title: "Pagar luz", body: "2026-03-05 09:00", tag: "t1", workspaceId: "w1", pageId: "p1" });
    expect(send).toHaveBeenCalledWith({ title: "Pagar luz", body: "2026-03-05 09:00" });
    expect(invoke).toHaveBeenCalledWith("show_reminder", { workspaceId: "w1", pageId: "p1", taskId: "t1", title: "Pagar luz", when: "2026-03-05 09:00" });
  });
  it("un aviso agrupado (sin tarea concreta) solo notifica", async () => {
    const invoke = vi.fn(async () => undefined);
    await new TauriNotifier(invoke).notify({ title: "Recordatorios vencidos", body: "3 pendientes", tag: "group" });
    expect(invoke).not.toHaveBeenCalled();
  });
  it("si la ventana no se puede abrir, la notificación igual salió y no lanza", async () => {
    send.mockClear();
    const invoke = vi.fn(async () => { throw new Error("sin ventana"); });
    await expect(new TauriNotifier(invoke).notify({ title: "T", body: "b", tag: "t", workspaceId: "w", pageId: "p" })).resolves.toBeUndefined();
    expect(send).toHaveBeenCalled();
  });
});
