import { useSyncExternalStore } from "react";
import type { WorkspaceController, WorkspaceSnapshot } from "./controller";

export const useWorkspace = (c: WorkspaceController): WorkspaceSnapshot => useSyncExternalStore(c.subscribe, c.getSnapshot, c.getSnapshot);
