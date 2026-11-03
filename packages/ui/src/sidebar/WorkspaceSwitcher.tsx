import * as D from "@radix-ui/react-dropdown-menu";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Workspace, WorkspaceManager } from "@vnote/core";
import { Icon } from "../design/Icon";
import { Logo } from "../identity/Logo";

/** Selector del espacio activo: logotipo, nombre y menú con los espacios, y «Gestionar espacios» (plan 10.2). */
export function WorkspaceSwitcher({ manager, active, onOpen, onManage }: { manager: WorkspaceManager; active: { id: string; name: string }; onOpen: (id: string) => void; onManage: () => void }) {
  const { t } = useTranslation();
  const [list, setList] = useState<Workspace[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (open) void manager.list().then((r) => { if (r.ok) setList(r.value); }); }, [open, manager]);
  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <D.Trigger asChild>
        <button type="button" className="flex h-9 w-full items-center gap-2 rounded px-2 text-left hover:bg-[var(--c-raised)]">
          <Logo size={20} />
          <span className="sr-only">{t("workspace.activeLabel")}</span>{" "}
          <span className="min-w-0 flex-1 truncate text-[length:var(--text-ui-size)] font-semibold">{active.name}</span>
          <Icon name="collapse" size={14} />
        </button>
      </D.Trigger>
      <D.Portal>
        <D.Content sideOffset={4} align="start" className="z-[var(--z-menu)] min-w-56 rounded-md border border-[var(--c-border)] bg-[var(--c-card)] p-1 text-[length:var(--text-ui-size)] shadow-[var(--elevation-3)]">
          {list.map((w) => (
            <D.Item key={w.id} onSelect={() => onOpen(w.id)} className="flex h-8 cursor-pointer items-center gap-2 rounded px-2 outline-none data-[highlighted]:bg-[var(--c-raised)]">
              <span className="w-4">{w.id === active.id && <Icon name="check" />}</span>
              {w.name}
            </D.Item>
          ))}
          <D.Separator className="my-1 h-px bg-[var(--c-border)]" />
          <D.Item onSelect={onManage} className="flex h-8 cursor-pointer items-center gap-2 rounded px-2 outline-none data-[highlighted]:bg-[var(--c-raised)]">
            <span className="w-4"><Icon name="settings" /></span>
            {t("sidebar.manageWorkspaces")}
          </D.Item>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
