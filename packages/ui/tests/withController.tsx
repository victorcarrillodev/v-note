// Utilidad de PRUEBA: controlador real del núcleo sobre una base en memoria.
import { FakeClock, migrate, migrations } from "@vnote/core";
import { createNodeSqliteStore } from "../../core/tests/support/nodeSqliteStore";
import { WorkspaceController } from "../src/workspace/controller";

export async function makeController() {
  const db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  const clock = new FakeClock(1_000);
  const controller = new WorkspaceController(db, clock);
  await controller.refresh();
  return { controller, db, clock };
}
