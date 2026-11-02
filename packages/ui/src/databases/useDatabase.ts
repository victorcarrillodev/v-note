import { useSyncExternalStore } from "react";
import type { DatabaseController, DatabaseSnapshot } from "./databaseController";

export const useDatabase = (c: DatabaseController): DatabaseSnapshot => useSyncExternalStore(c.subscribe, c.getSnapshot, c.getSnapshot);
