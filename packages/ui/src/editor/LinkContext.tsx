import { createContext, useContext } from "react";
import type { LinkTarget } from "@vnote/core";

/** Lo que una mención necesita de la aplicación: ver a qué apunta ahora, abrirla y, si está en la papelera, restaurarla. */
export type LinkApi = {
  resolve(pageId: string): Promise<LinkTarget>;
  open(pageId: string): void;
  restore(pageId: string): Promise<void>;
};
const Ctx = createContext<LinkApi | null>(null);
export const LinkProvider = Ctx.Provider;
export const useLinks = (): LinkApi | null => useContext(Ctx);
