import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import type { Notifier, NotificationPermission, OutgoingNotification } from "@vnote/ui";

type Invoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

/** Notificaciones del sistema con el plugin oficial de Tauri (RF-11). */
export class TauriNotifier implements Notifier {
  constructor(private invoke: Invoke = tauriInvoke) {}

  async permission(): Promise<NotificationPermission> {
    try { return (await isPermissionGranted()) ? "granted" : "prompt"; } catch { return "denied"; }
  }
  async request(): Promise<NotificationPermission> {
    try { const r = await requestPermission(); return r === "granted" ? "granted" : r === "denied" ? "denied" : "prompt"; } catch { return "denied"; }
  }
  async notify(n: OutgoingNotification): Promise<void> {
    sendNotification({ title: n.title, body: n.body });
    // Un recordatorio de una tarea concreta abre además la ventana pequeña (Abrir, Hecho, Posponer) sin quitar el foco.
    if (n.workspaceId && n.pageId && n.tag) {
      await this.invoke("show_reminder", { workspaceId: n.workspaceId, pageId: n.pageId, taskId: n.tag, title: n.title, when: n.body }).catch(() => {});
    }
  }
}
