import * as D from "@radix-ui/react-dropdown-menu";
import { cx } from "../design/cx";
import { IconButton } from "./IconButton";
import type { IconName } from "../design/iconMap";
import { Icon } from "../design/Icon";

export type MenuItem = { label: string; onSelect: () => void; danger?: boolean; icon?: IconName };

/** Menú de acciones con teclado completo (flechas, Inicio, Fin, búsqueda por letra, Escape devuelve el foco). */
export function Menu({ label, items, icon = "more" }: { label: string; items: MenuItem[]; icon?: IconName }) {
  return (
    <D.Root>
      <D.Trigger asChild><IconButton icon={icon} label={label} /></D.Trigger>
      <D.Portal>
        <D.Content sideOffset={4} align="end" className="z-[var(--z-menu)] min-w-44 rounded-md border border-[var(--c-border)] bg-[var(--c-card)] p-1 text-[length:var(--text-ui-size)] shadow-[var(--elevation-3)]">
          {items.map((it) => (
            <D.Item key={it.label} onSelect={it.onSelect} className={cx("flex h-8 cursor-pointer items-center gap-2 rounded px-2 outline-none data-[highlighted]:bg-[var(--c-raised)]", it.danger ? "text-[var(--c-danger)]" : "text-[var(--c-text)]")}>
              {it.icon && <Icon name={it.icon} />}
              {it.label}
            </D.Item>
          ))}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
