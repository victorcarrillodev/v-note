import { serveGraphLayout } from "@vnote/core";

// El cálculo de fuerzas corre fuera del hilo de la interfaz (D-31).
serveGraphLayout(self as never);
