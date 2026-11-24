import { Icon } from "../design/Icon";
import type { IconName } from "../design/iconMap";

export type SidebarLink = { id: string; label: string; icon: IconName; onClick: () => void };

/** Accesos secundarios de la barra lateral: agrupados, con jerarquía visual menor (texto suave de 13 px) para que el contenido sea el protagonista. */
export function SidebarLinks({ groups }: { groups: SidebarLink[][] }) {
  return (
    <div className="flex shrink-0 flex-col gap-3 p-2">
      {groups.map((g, i) => (
        <div key={i} role="group" className="flex flex-col">
          {g.map((l) => (
            <button key={l.id} type="button" onClick={l.onClick} className="flex h-8 items-center gap-2 rounded px-2 text-left text-[length:var(--text-ui-small-size)] text-[var(--c-text-muted)] hover:bg-[var(--c-raised)] hover:text-[var(--c-text)]">
              <Icon name={l.icon} />
              {l.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
