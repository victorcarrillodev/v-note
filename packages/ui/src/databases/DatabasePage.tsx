import { useEffect, useState } from "react";
import type { WorkspaceController } from "../workspace/controller";
import type { DatabaseController } from "./databaseController";
import { DatabaseView } from "./DatabaseView";
import { Skeleton } from "../components/Skeleton";
import type { AssetStore } from "@vnote/core";
import { DatabaseAssetsContext } from "./AssetsContext";

/** Página cuyo contenido es una base de datos o un tablero: carga su controlador y abre las filas como páginas completas. */
export function DatabasePage({ controller, pageId, assets }: { controller: WorkspaceController; pageId: string; assets?: AssetStore | undefined }) {
  const [db, setDb] = useState<DatabaseController | null>(null);
  useEffect(() => {
    let cancelled = false;
    setDb(null);
    void controller.openDatabase(pageId).then((c) => { if (!cancelled) setDb(c); });
    return () => { cancelled = true; };
  }, [controller, pageId]);
  // Mientras se abre la base, el esqueleto reserva el espacio para que la página no salte (RF-12.4).
  if (!db) return <div className="p-4"><Skeleton height={240} /></div>;
  return (
    <DatabaseAssetsContext.Provider value={assets}>
      <DatabaseView controller={db} showTitle={false} onOpenRow={(id) => void controller.refresh().then(() => controller.select(id))} />
    </DatabaseAssetsContext.Provider>
  );
}
