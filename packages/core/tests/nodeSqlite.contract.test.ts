// T-038/T-039 (prueba primero): el adaptador de pruebas cumple el contrato.
import { runSqlStoreContract } from "../src/ports/sqlStore.contract";
import { createNodeSqliteStore } from "./support/nodeSqliteStore";

runSqlStoreContract("node:sqlite (adaptador de pruebas)", () => createNodeSqliteStore(":memory:"));
