export type SaveStatus = { kind: "saved" } | { kind: "saving" } | { kind: "error"; message: string };
export type SaveEvent = { type: "edit" } | { type: "saved" } | { type: "failed"; message: string } | { type: "retry" };

/** Estado de guardado de la cabecera. Un error es persistente: seguir editando no lo oculta; solo reintentar y guardar lo resuelve. */
export function saveStatusReducer(s: SaveStatus, e: SaveEvent): SaveStatus {
  switch (e.type) {
    case "edit": return s.kind === "error" ? s : { kind: "saving" };
    case "saved": return { kind: "saved" };
    case "failed": return { kind: "error", message: e.message };
    case "retry": return { kind: "saving" };
  }
}
