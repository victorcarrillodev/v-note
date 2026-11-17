import { createContext, useContext, type ReactNode } from "react";
import type { Heading } from "@vnote/core";
import type { JumpBehavior } from "../page/TableOfContents";

/** Lista viva de encabezados de la página y cómo saltar a uno: la comparten el índice flotante y el bloque «Índice» (DP-12). */
export type TocApi = { headings: readonly Heading[]; jump: (id: string, behavior: JumpBehavior) => void };
const Ctx = createContext<TocApi>({ headings: [], jump: () => {} });
export const TocProvider = ({ value, children }: { value: TocApi; children: ReactNode }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;
export const useToc = (): TocApi => useContext(Ctx);
