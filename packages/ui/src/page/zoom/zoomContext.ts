import { createContext, useContext } from "react";

/** Factor de zoom del contenido de la página (1 = 100 %). */
export const ZoomContext = createContext(1);
export const usePageZoom = (): number => useContext(ZoomContext);
