export type NotificationPermission = "granted" | "denied" | "prompt";
export type OutgoingNotification = { title: string; body: string; tag?: string; /** Para abrir la tarea desde la ventana de recordatorio (RF-11). */ workspaceId?: string; pageId?: string };

/** Notificaciones del sistema: en el navegador usa la API Notification; en escritorio, el plugin de Tauri (RF-11). */
export interface Notifier {
  permission(): Promise<NotificationPermission>;
  request(): Promise<NotificationPermission>;
  notify(n: OutgoingNotification): Promise<void>;
}

/** Notificador de PRUEBAS: guarda lo enviado. */
export class MemoryNotifier implements Notifier {
  sent: OutgoingNotification[] = [];
  requested = 0;
  constructor(private state: NotificationPermission = "granted", private afterRequest: NotificationPermission = "denied") {}
  async permission() { return this.state; }
  async request() { this.requested++; this.state = this.afterRequest; return this.state; }
  async notify(n: OutgoingNotification) { this.sent.push(n); }
}

/** API Notification del navegador (solo mientras la aplicación está abierta, RF-19). */
export class WebNotifier implements Notifier {
  private api = (globalThis as { Notification?: typeof Notification }).Notification;
  async permission(): Promise<NotificationPermission> {
    if (!this.api) return "denied";
    return this.api.permission === "default" ? "prompt" : (this.api.permission as NotificationPermission);
  }
  async request(): Promise<NotificationPermission> {
    if (!this.api) return "denied";
    const r = await this.api.requestPermission();
    return r === "default" ? "prompt" : (r as NotificationPermission);
  }
  async notify(n: OutgoingNotification): Promise<void> {
    if (!this.api || this.api.permission !== "granted") return;
    new this.api(n.title, { body: n.body, ...(n.tag ? { tag: n.tag } : {}) });
  }
}
