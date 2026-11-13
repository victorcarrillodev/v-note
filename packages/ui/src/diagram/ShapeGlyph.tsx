import type { Shape } from "@vnote/core";
import { cx } from "../design/cx";
import { Icon } from "../design/Icon";

const OUTLINE: Record<Exclude<Shape, "note">, string> = {
  terminator: "h-3 w-5 rounded-[var(--radius-full)]",
  process: "h-3.5 w-5 rounded-[var(--radius-xs)]",
  decision: "h-3 w-3 rotate-45 rounded-[var(--radius-xs)]",
  io: "h-3.5 w-5 -skew-x-12 rounded-[var(--radius-xs)]",
};

/** Miniatura de una forma del diagrama para la barra: el mismo contorno que tendrá en el lienzo, con el color del texto. */
export function ShapeGlyph({ shape }: { shape: Shape }) {
  if (shape === "note") return <Icon name="stickyNote" />;
  return <span aria-hidden="true" data-shape-glyph={shape} className={cx("block border-2 border-current", OUTLINE[shape])} />;
}
