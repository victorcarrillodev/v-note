import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useBlockNoteEditor, useComponentsContext, useEditorSelectionChange } from "@blocknote/react";
import { UNDERLINE_COLORS, UNDERLINE_KINDS, type UnderlineColor, type UnderlineKind } from "@vnote/core";
import { activeUnderline, applyUnderline, lastUnderline, removeUnderline, type UnderlineEditor } from "./underlineActions";
import { Icon } from "../design/Icon";
import { cx } from "../design/cx";

const OPTION = "inline-flex min-h-8 items-center justify-center rounded-[var(--radius-md)] border border-transparent px-2 text-[length:var(--text-ui-size)] hover:bg-[var(--c-raised)] focus-visible:bg-[var(--c-raised)] aria-pressed:border-[var(--c-accent)] aria-pressed:bg-[var(--c-raised)]";
const SWATCH = "h-6 w-6 justify-self-center rounded-full border border-[var(--c-border-control)] transition-transform duration-100 hover:scale-110 aria-pressed:ring-2 aria-pressed:ring-[var(--c-accent)] aria-pressed:ring-offset-1 [@media(pointer:coarse)]:h-9 [@media(pointer:coarse)]:w-9";

/**
 * Botón de la barra de formato: «Subrayado con estilo». Abre un panel con los tres trazos (liso, difuminado y marcatextos)
 * y los colores; cada elección se aplica al texto seleccionado al instante y el panel queda abierto para probar otra.
 * La barra de BlockNote recorta lo que sobresale, así que el panel va en un portal con posición fija bajo el botón. Pulsarlo no
 * quita el foco del editor (`mousedown` cancelado): la selección y la barra se quedan como están.
 */
export function UnderlineButton() {
  const { t } = useTranslation();
  const editor = useBlockNoteEditor();
  const Components = useComponentsContext();
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  const [, bump] = useState(0);
  const root = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEditorSelectionChange(() => bump((n) => n + 1), editor);
  // Colocar el panel bajo el botón (y dentro de la ventana) al abrir y mientras se desplaza o cambia el tamaño.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = root.current?.getBoundingClientRect();
      if (!r) return;
      const w = panel.current?.offsetWidth ?? 256;
      setAt({ left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)), top: r.bottom + 6 });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => { window.removeEventListener("scroll", place, true); window.removeEventListener("resize", place); };
  }, [open]);
  // Se cierra al sacar el cursor del botón y del panel (con un pequeño margen para cruzar el hueco entre ambos); elegir una opción NO lo cierra.
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const over = useRef({ button: false, panel: false });
  const cancelLeave = () => { if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = undefined; } };
  const entered = useRef(false);
  const hover = (part: "button" | "panel", inside: boolean) => {
    over.current[part] = inside;
    cancelLeave();
    if (inside && part === "panel") entered.current = true;
    if (!inside && entered.current) leaveTimer.current = setTimeout(() => { if (!over.current.button && !over.current.panel) setOpen(false); }, 250);
  };
  useEffect(() => { if (!open) { entered.current = false; over.current = { button: false, panel: false }; cancelLeave(); } }, [open]);
  useEffect(() => cancelLeave, []);
  // Cerrar con Escape o al pulsar fuera del botón y su panel.
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { const n = e.target as Node; if (!root.current?.contains(n) && !panel.current?.contains(n)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("keydown", esc, true);
    return () => { document.removeEventListener("pointerdown", away, true); document.removeEventListener("keydown", esc, true); };
  }, [open]);
  if (!Components || !editor.isEditable) return null;

  const blocks = editor.getSelection()?.blocks ?? [editor.getTextCursorPosition().block];
  if (!blocks.some((b) => Array.isArray(b.content) && b.type !== "codeBlock")) return null;

  const ed = editor as unknown as UnderlineEditor;
  const active = activeUnderline(ed);
  const shown = active ?? lastUnderline();
  const apply = (kind: UnderlineKind, color: UnderlineColor) => { applyUnderline(ed, { kind, color }); bump((n) => n + 1); };
  const remove = () => { removeUnderline(ed); setOpen(false); editor.focus(); };
  const keepSelection = (e: { preventDefault(): void }) => e.preventDefault(); // pulsar el panel no debe quitarle la selección al texto

  return (
    <span ref={root} className="inline-flex items-center">
      <span className="inline-flex" onPointerEnter={() => hover("button", true)} onPointerLeave={() => hover("button", false)}>
      <Components.FormattingToolbar.Button
        className="bn-button" label={t("editor.underline.button")} mainTooltip={t("editor.underline.button")} secondaryTooltip={t("editor.underline.shortcut")}
        icon={<Icon name="highlighter" size={16} />} isSelected={active !== null || open} onClick={() => setOpen((o) => !o)}
      />
      </span>
      {open && createPortal(
        <div
          ref={panel} role="group" aria-label={t("editor.underline.title")} onMouseDown={keepSelection} onPointerEnter={() => hover("panel", true)} onPointerLeave={() => hover("panel", false)}
          style={{ position: "fixed", left: at?.left ?? 0, top: at?.top ?? 0, visibility: at ? "visible" : "hidden" }}
          className="z-[calc(var(--z-menu)+1)] flex w-72 flex-col gap-2.5 rounded-[var(--radius-md)] border border-[var(--c-border)] bg-[var(--c-card)] p-2 text-[var(--c-text)] shadow-[var(--elevation-3)]"
        >
          <div role="group" aria-label={t("editor.underline.kind")} className="grid grid-cols-3 gap-1">
            {UNDERLINE_KINDS.map((kind: UnderlineKind) => (
              <button key={kind} type="button" aria-pressed={shown.kind === kind} title={t(`editor.underline.kinds.${kind}`)} aria-label={t(`editor.underline.kinds.${kind}`)}
                className={cx(OPTION, "flex-col gap-1 py-2")} onClick={() => apply(kind, shown.color)}>
                <span className="ul px-1 text-[length:var(--text-ui-size)] leading-tight" data-ul-kind={kind} data-ul-color={shown.color}>{t("editor.underline.sample")}</span>
                <span className="text-[length:var(--text-note-size)] text-[var(--c-text-muted)]">{t(`editor.underline.kinds.${kind}`)}</span>
              </button>
            ))}
          </div>
          <div role="group" aria-label={t("editor.underline.color")} className="grid grid-cols-9 gap-1">
            {UNDERLINE_COLORS.map((color: UnderlineColor) => (
              <button key={color} type="button" aria-pressed={shown.color === color} title={t(`editor.underline.colors.${color}`)} aria-label={t(`editor.underline.colors.${color}`)}
                className={SWATCH} style={{ background: `var(--underline-${color})` }} onClick={() => apply(shown.kind, color)} />
            ))}
          </div>
          {active && <button type="button" className={cx(OPTION, "justify-start text-[var(--c-text-muted)]")} onClick={remove}>{t("editor.underline.remove")}</button>}
        </div>,
        document.body,
      )}
    </span>
  );
}
