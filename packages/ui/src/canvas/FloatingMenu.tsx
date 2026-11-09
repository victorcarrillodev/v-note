import * as P from "@radix-ui/react-popover";
import { useMemo, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "../design/Icon";
import type { IconName } from "../design/iconMap";
import { anchorVisible, maxMenuHeight, MENU_OFFSET, type Rect, type ScreenPoint } from "./menuGeometry";

export type MenuGroup = { id: string; label: string; icon?: IconName; children: ReactNode };
export type MenuAnchor = { element: HTMLElement | null } | { point: ScreenPoint } | { rect: Rect };

type Props = {
  open: boolean;
  /** Elemento al que se pega el menú, o un punto en coordenadas de pantalla (conectores). */
  anchor: MenuAnchor;
  /** Área visible del lienzo: el menú se oculta si el ancla sale de ella y su alto máximo se calcula sobre ella. */
  area?: Rect | undefined;
  label: string;
  /** Si se da, el contenido se agrupa en una región con ese nombre (compatibilidad con los paneles que sustituye). */
  regionLabel?: string | undefined;
  groups: MenuGroup[];
  onClose: () => void;
  /** Clics en estos elementos no cierran el menú (por ejemplo, otros elementos del lienzo que cambian la selección). */
  keepOpenOn?: ((target: Element) => boolean) | undefined;
};

const FOCUSABLE = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
const isTextual = (el: EventTarget | null) => el instanceof HTMLElement && (el.matches("input:not([type=button]):not([type=checkbox]):not([type=radio]):not([type=range]), textarea, select") || el.isContentEditable);

/**
 * Menú emergente anclado al elemento seleccionado (spec 004, RF-1, RF-2). No es modal y no roba el foco: quien lo abre
 * puede seguir escribiendo. Se cierra con Esc o con un clic fuera, y se oculta mientras su ancla no se ve.
 */
export function FloatingMenu({ open, anchor, area: areaProp, label, regionLabel, groups, onClose, keepOpenOn }: Props) {
  // Un área sin tamaño (sin diseño, como en jsdom) no dice nada sobre qué se ve: se trata como desconocida.
  const area = areaProp && (areaProp.width > 0 || areaProp.height > 0) ? areaProp : undefined;
  const element = "element" in anchor ? anchor.element : null;
  // Un punto es un rectángulo sin tamaño; un rectángulo (p. ej. el contorno de un conector) deja el menú fuera de él.
  const box: Rect | null = "point" in anchor ? { left: anchor.point.x, top: anchor.point.y, width: 0, height: 0 } : "rect" in anchor ? anchor.rect : null;
  const bl = box?.left ?? 0, bt = box?.top ?? 0, bw = box?.width ?? 0, bh = box?.height ?? 0;
  const virtualRef = useMemo(() => ({
    current: box ? { getBoundingClientRect: () => new DOMRect(bl, bt, bw, bh) } : { getBoundingClientRect: () => (element ? element.getBoundingClientRect() : new DOMRect(0, 0, 0, 0)) },
  }), [box !== null, bl, bt, bw, bh, element]); // eslint-disable-line react-hooks/exhaustive-deps
  const visible = box ? anchorVisible(box, area) : element ? anchorVisible(element.getBoundingClientRect(), area) : false;
  const maxHeight = area ? maxMenuHeight(area.height) : Math.floor(window.innerHeight * 0.4);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(e.key) || isTextual(e.target)) return;
    // Se ordena por posición en el documento: algunos motores devuelven los resultados agrupados por selector.
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)].sort((x, y) => (x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    if (items.length === 0) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : e.key === "ArrowRight" || e.key === "ArrowDown" ? (i + 1) % items.length : (i <= 0 ? items.length - 1 : i - 1);
    e.preventDefault();
    items[next]!.focus();
  };

  return (
    <P.Root open={open && visible} modal={false}>
      <P.Anchor virtualRef={virtualRef} />
      <P.Portal>
        <P.Content
          data-floating-menu="" aria-label={label} side="top" align="center" sideOffset={MENU_OFFSET} collisionPadding={8} avoidCollisions sticky="always" updatePositionStrategy="always"
          onOpenAutoFocus={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => { e.preventDefault(); onClose(); }} // preventDefault: marca el Esc como atendido para que un contenedor (la vista ampliada) no actúe también
          onFocusOutside={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => {
            const t = e.target as Element | null;
            if (t && ((element && element.contains(t)) || keepOpenOn?.(t))) { e.preventDefault(); return; }
            onClose();
          }}
          onKeyDown={onKeyDown}
          style={{ maxHeight, overflowY: "auto" }}
          className="z-[var(--z-menu)] max-w-[var(--size-popover-max)] rounded-md border border-[var(--c-border)] bg-[var(--c-card)] p-2 text-[length:var(--text-ui-size)] text-[var(--c-text)] shadow-[var(--elevation-3)]"
        >
          <div className="flex flex-col gap-2" {...(regionLabel ? { role: "region", "aria-label": regionLabel } : {})}>
            {groups.map((g) => (
              <section key={g.id} role="group" aria-label={g.label} className="flex flex-col gap-1">
                <div aria-hidden="true" className="flex items-center gap-1 text-[length:var(--text-ui-small-size)] text-[var(--c-text-muted)]">
                  {g.icon ? <Icon name={g.icon} size={14} /> : null}<span>{g.label}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1">{g.children}</div>
              </section>
            ))}
          </div>
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
