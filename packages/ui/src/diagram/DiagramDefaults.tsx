import { createContext, useContext } from "react";
import type { DiagramDefaults, EdgeStyle, NodeStyle, Route } from "@vnote/core";

/** Estilos predeterminados de diagramas del espacio abierto (plan 003, §7.6). Los aporta la página; sin servicio, el editor usa los del sistema. */
export type DiagramDefaultsApi = {
  load(): Promise<DiagramDefaults>;
  saveShape(style: NodeStyle): Promise<void>;
  saveEdge(style: EdgeStyle, route: Route): Promise<void>;
  reset(): Promise<void>;
};
const Ctx = createContext<DiagramDefaultsApi | null>(null);
export const DiagramDefaultsProvider = Ctx.Provider;
export const useDiagramDefaults = (): DiagramDefaultsApi | null => useContext(Ctx);
