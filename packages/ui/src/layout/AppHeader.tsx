import { useSyncExternalStore } from "react";
import type { Page, PageNode } from "@vnote/core";
import type { WorkspaceController } from "../workspace/controller";
import { useWorkspace } from "../workspace/useController";
import { HeaderBar } from "./HeaderBar";
import { saveStatusStore } from "./saveStatusStore";
import { PageOptionsMenu } from "../page/options/PageOptionsMenu";

function find(tree: readonly PageNode[], id: string): Page | null {
  const stack = [...tree];
  while (stack.length) { const n = stack.pop()!; if (n.page.id === id) return n.page; stack.push(...n.children); }
  return null;
}

/** Cabecera del marco para la página abierta: ruta de ancestros + página actual, y estado de guardado. */
export function AppHeader({ controller, onNavigate, now }: { controller: WorkspaceController; onNavigate: (id: string) => void; now: () => number }) {
  const snap = useWorkspace(controller);
  const status = useSyncExternalStore(saveStatusStore.subscribe, saveStatusStore.getSnapshot);
  const current = snap.selectedId ? find(snap.tree, snap.selectedId) : null;
  const crumbs = current ? [...snap.breadcrumbs, current].map((p) => ({ id: p.id, title: p.title })) : [];
  return (
    <>
      <HeaderBar crumbs={crumbs} onNavigate={onNavigate} status={status} onRetry={() => saveStatusStore.retry()} {...(current ? { lastEditedAt: current.updatedAt, now: now() } : {})} />
      {current && <PageOptionsMenu controller={controller} pageId={current.id} />}
    </>
  );
}
