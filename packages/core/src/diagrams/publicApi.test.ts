// R-020: las funciones de cuadrícula, vista e historial se exportan desde el índice público del paquete.
import { describe, it, expect } from "vitest";
import * as core from "../index";

describe("API pública de la spec 004 (núcleo base)", () => {
  it("exporta cuadrícula, vista e historial genérico", () => {
    for (const name of ["GRID", "snap", "snapPoint", "snapBox", "snapOffset", "DEFAULT_DIAGRAM_HEIGHT", "MIN_HEIGHT", "MAX_HEIGHT", "clampHeight", "defaultMapHeight", "readView", "writeView", "Snapshots", "DiagramHistory"]) {
      expect(core, name).toHaveProperty(name);
    }
  });
});
