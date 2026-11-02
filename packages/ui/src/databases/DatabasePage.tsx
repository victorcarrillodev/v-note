import { useEffect, useState } from "react";
import type { WorkspaceController } from "../workspace/controller";
import type { DatabaseController } from "./databaseController";
import { DatabaseView } from "./DatabaseView";

/** Página cuyo contenido es una base de datos o un tablero: carga su controlador y abre las filas como páginas completas. */
export function DatabasePage({ controller, pageId }: { controller: WorkspaceController; pageId: string }) {
  const [db, setDb] = useState<DatabaseController | null>(null);
  useEffect(() => {
    let cancelled = false;
    setDb(null);
    void controller.openDatabase(pageId).then((c) => { if (!cancelled) setDb(c); });
    return () => { cancelled = true; };
  }, [controller, pageId]);
  if (!db) return null;
  return <DatabaseView controller={db} showTitle={false} onOpenRow={(id) => void controller.refresh().then(() => controller.select(id))} />;
}
