import { serveBackup } from "@vnote/core";

// El trabajo pesado del respaldo (huellas, diferencias y subida a GitHub) corre fuera del hilo de la interfaz (D-31, RNF-12).
serveBackup(self as never);
