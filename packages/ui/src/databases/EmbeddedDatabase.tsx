import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { DatabaseController } from "./databaseController";
import { DatabaseView } from "./DatabaseView";

export type DatabaseEmbedServices = {
  list(): Promise<{ id: string; name: string }[]>;
  open(databaseId: string): Promise<DatabaseController | null>;
  /** Abre una fila (página) de la base; si falta, el botón de abrir no se muestra. */
  openRow?: (pageId: string) => void;
};
const Ctx = createContext<DatabaseEmbedServices | null>(null);
export const DatabaseEmbedProvider = ({ value, children }: { value: DatabaseEmbedServices; children: ReactNode }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;
export const useDatabaseEmbed = () => useContext(Ctx);

/** Elegir qué base de datos mostrar en el bloque (T-264). */
export function DatabasePicker({ onPick }: { onPick: (databaseId: string) => void }) {
  const { t } = useTranslation();
  const svc = useDatabaseEmbed();
  const [list, setList] = useState<{ id: string; name: string }[] | null>(null);
  const [chosen, setChosen] = useState("");
  useEffect(() => { void svc?.list().then((l) => { setList(l); setChosen(l[0]?.id ?? ""); }); }, [svc]);
  if (!list) return null;
  if (list.length === 0) return <p className="text-sm opacity-70">{t("embed.none")}</p>;
  return (
    <div className="flex items-center gap-2" contentEditable={false}>
      <label className="flex items-center gap-2">{t("embed.pick")}
        <select aria-label={t("embed.pick")} value={chosen} onChange={(e) => setChosen(e.target.value)}>
          {list.map((d) => <option key={d.id} value={d.id}>{d.name.trim() === "" ? t("app.untitled") : d.name}</option>)}
        </select>
      </label>
      <button type="button" onClick={() => chosen && onPick(chosen)}>{t("embed.insert")}</button>
    </div>
  );
}

/** La misma base de datos, vista dentro de una nota: lo que se edite aquí se ve en la base original y al revés (RF-22). */
export function EmbeddedDatabaseView({ databaseId, viewId, onViewChange }: { databaseId: string; viewId: string; onViewChange: (viewId: string) => void }) {
  const { t } = useTranslation();
  const svc = useDatabaseEmbed();
  const [state, setState] = useState<{ controller: DatabaseController | null } | null>(null);
  const reported = useRef(viewId);

  useEffect(() => {
    let off = () => {};
    let cancelled = false;
    void svc?.open(databaseId).then(async (c) => {
      if (cancelled) return;
      if (c && viewId && c.getSnapshot().views.some((v) => v.id === viewId)) await c.setActiveView(viewId);
      if (cancelled) return;
      setState({ controller: c });
      if (c) off = c.subscribe(() => {
        const id = c.getSnapshot().activeViewId;
        if (id && id !== reported.current) { reported.current = id; onViewChange(id); }
      });
    });
    return () => { cancelled = true; off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svc, databaseId]);

  if (!state) return null;
  if (!state.controller) return <p role="note" className="rounded border p-2 text-sm">{t("embed.gone")}</p>;
  return <DatabaseView controller={state.controller} showTitle={false} {...(svc?.openRow ? { onOpenRow: svc.openRow } : {})} />;
}
