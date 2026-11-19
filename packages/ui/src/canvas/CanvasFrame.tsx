import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { GRID, MAX_HEIGHT, MIN_HEIGHT, clampHeight } from "@vnote/core";
import { Icon } from "../design/Icon";
import type { IconName } from "../design/iconMap";
import { cx } from "../design/cx";
import { CanvasControls } from "../diagram/CanvasControls";
import { useGridPrefs, type GridPrefs } from "./gridPrefs";

export type CanvasZoom = { level: number; min: number; max: number; onIn: () => void; onOut: () => void; onFit: () => void; onReset: () => void };
export type CanvasHistory = { canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void };

type Props = {
  testId: string;
  /** Nombre del grupo cuando no está ampliado (p. ej. «Lienzo del diagrama»). */
  label: string;
  /** Alto guardado; sin él se usa `defaultHeight`. */
  height: number | undefined;
  defaultHeight: number;
  /** Se llama UNA vez por gesto, al soltar (o con cada pulsación de teclado): el llamante registra un paso de historial. */
  onHeightChange: (height: number) => void;
  /** Controles propios del bloque (insertar forma, agregar globo…), a la izquierda de la barra. */
  toolbar?: ReactNode;
  zoom: CanvasZoom;
  history: CanvasHistory;
  /** Avisa cuando cambia el ancho disponible (la ventana o la barra lateral): quien dibuja decide si reencuadra. */
  onWidthChange?: (width: number) => void;
  onGridChange?: (grid: GridPrefs) => void;
  children: ReactNode;
};

const TOOL = cx(
  "inline-flex h-8 min-w-8 items-center justify-center rounded-[var(--radius-md)] px-1 text-[var(--c-text-muted)] transition-colors duration-100",
  "[@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:min-w-11",
  "hover:bg-[var(--c-raised)] hover:text-[var(--c-text)] active:bg-[var(--c-border)] disabled:text-[var(--c-text-disabled)] disabled:hover:bg-transparent aria-pressed:bg-[var(--c-raised)] aria-pressed:text-[var(--c-text)]",
);
const FOCUSABLE = "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])";

/**
 * Marca como inertes los elementos hermanos de la cadena de ancestros; devuelve la función que lo deshace.
 * Dentro del editor (contenteditable) no toca nada: el editor vigila su DOM y, al ver atributos nuevos en otros
 * bloques, vuelve a dibujar la zona y desmonta el lienzo recién ampliado (con un mapa u organigrama antes del diagrama,
 * la vista ampliada se cerraba al instante). Ahí basta la trampa de foco del marco; el resto de la app sí queda inerte.
 */
function inertRest(el: HTMLElement): () => void {
  const marked: HTMLElement[] = [];
  let node: HTMLElement | null = el;
  while (node && node !== document.documentElement) {
    const parent: HTMLElement | null = node.parentElement;
    if (!parent) break;
    if (parent.closest("[contenteditable='true']")) { node = parent; continue; }
    for (const sib of Array.from(parent.children) as HTMLElement[]) {
      if (sib === node || sib.hasAttribute("inert") || sib.querySelector("[data-floating-menu]") || sib.matches("script, style, link")) continue;
      sib.setAttribute("inert", ""); marked.push(sib);
    }
    node = parent;
  }
  return () => marked.forEach((m) => m.removeAttribute("inert"));
}

/**
 * Marco compartido de diagramas y mapas (spec 004, DP-1): alto ajustable, vista ampliada, barra de herramientas, zoom,
 * cuadrícula, deshacer/rehacer y aviso de cambio de ancho. Al ampliar, el MISMO componente se coloca en posición fija sobre
 * la ventana (sin remontarlo), de modo que conserva selección, zoom y texto a medio escribir (DP-2, RF-3, CL-9).
 */
export function CanvasFrame({ testId, label, height, defaultHeight, onHeightChange, toolbar, zoom, history, onWidthChange, onGridChange, children }: Props) {
  const { t } = useTranslation();
  const root = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const [grid, setGrid] = useGridPrefs();
  const saved = clampHeight(height, defaultHeight);
  const shown = preview ?? saved;

  useEffect(() => { onGridChange?.(grid); }, [grid, onGridChange]);

  // --- alto: teclado y puntero ---
  const drag = useRef<{ startY: number; startH: number; last: number } | null>(null);
  const keyResize = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const step = (e.shiftKey ? 5 : 1) * GRID * (e.key === "ArrowDown" ? 1 : -1);
    const next = clampHeight(saved + step);
    if (next !== saved) onHeightChange(next);
  };
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { startY: e.clientY, startH: saved, last: saved };
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current; if (!d) return;
    d.last = clampHeight(d.startH + (e.clientY - d.startY));
    setPreview(d.last);
  };
  const up = () => {
    const d = drag.current; drag.current = null;
    if (!d) return;
    setPreview(null);
    if (d.last !== d.startH) onHeightChange(d.last);
  };
  const cancel = () => { drag.current = null; setPreview(null); };

  // --- cambios de ancho ---
  const lastWidth = useRef<number | null>(null);
  useEffect(() => {
    const el = root.current;
    if (!el || !onWidthChange) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0);
      if (w !== lastWidth.current) { lastWidth.current = w; onWidthChange(w); }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [onWidthChange]);

  // --- vista ampliada ---
  const origin = useRef<HTMLElement | null>(null);
  const toggle = useCallback(() => setExpanded((v) => !v), []);
  useEffect(() => {
    if (!expanded || !root.current) return;
    origin.current = document.activeElement as HTMLElement | null;
    const restoreInert = inertRest(root.current);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) setExpanded(false); };
    document.addEventListener("keydown", onKey);
    const back = origin.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      restoreInert();
      document.body.style.overflow = prevOverflow;
      if (back && document.contains(back)) back.focus();
    };
  }, [expanded]);
  const trap = (e: KeyboardEvent<HTMLDivElement>) => {
    // Ctrl/Cmd + Mayús + F amplía o sale (con el foco dentro del lienzo; no choca con los atajos del editor de bloques).
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "f") { e.preventDefault(); setExpanded((v) => !v); return; }
    // Esc con el foco dentro: un contenedor puede detener el evento antes de que llegue al documento, así que también se atiende aquí.
    if (expanded && e.key === "Escape" && !e.nativeEvent.defaultPrevented) { setExpanded(false); return; }
    if (!expanded || e.key !== "Tab") return;
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) return;
    const first = items[0]!, last = items[items.length - 1]!, active = document.activeElement as HTMLElement | null;
    if (!e.currentTarget.contains(active)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  };

  const tool = (icon: IconName, name: string, onClick: () => void, opts: { disabled?: boolean; pressed?: boolean } = {}) => (
    <button type="button" aria-label={name} title={name} onClick={onClick} disabled={opts.disabled} {...(opts.pressed !== undefined ? { "aria-pressed": opts.pressed } : {})} className={TOOL}><Icon name={icon} size={20} /></button>
  );

  return (
    <div
      ref={root} data-testid={testId} data-canvas-frame="" data-expanded={expanded ? "" : undefined}
      role={expanded ? "dialog" : "group"} aria-label={expanded ? t("canvas.frame.expandedView") : label} {...(expanded ? { "aria-modal": true } : {})}
      onKeyDown={trap}
      style={{ width: "100%", ...(expanded ? { position: "fixed" as const } : { height: shown }) }}
      className={cx("group/frame flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--c-border)] bg-[var(--c-card)] transition-colors duration-100 hover:border-[var(--c-border-control)] focus-within:border-[var(--c-border-control)]", expanded && "inset-0 z-[var(--z-sidebar-overlay)] rounded-none bg-[var(--c-canvas)]", !expanded && "relative")}
    >
      <div role="toolbar" aria-label={t("canvas.frame.tools")} className="flex flex-wrap items-center gap-0.5 border-b border-[var(--c-border)] px-1.5 py-1 text-[length:var(--text-ui-size)]">
        {toolbar}
        <span className="flex-1" />
        {tool("undo", t("canvas.frame.undo"), history.onUndo, { disabled: !history.canUndo })}
        {tool("redo", t("canvas.frame.redo"), history.onRedo, { disabled: !history.canRedo })}
        <span aria-hidden="true" className="mx-1 h-5 w-px bg-[var(--c-border)]" />
        <span role="group" aria-label={t("canvas.frame.grid")} className="flex items-center gap-0.5">
          {tool("grid", t("canvas.frame.showGrid"), () => setGrid({ show: !grid.show }), { pressed: grid.show })}
          {tool("snap", t("canvas.frame.snapGrid"), () => setGrid({ snap: !grid.snap }), { pressed: grid.snap })}
        </span>
        <span aria-hidden="true" className="mx-1 h-5 w-px bg-[var(--c-border)]" />
        {tool(expanded ? "exitFullscreen" : "fullscreen", expanded ? t("canvas.frame.exit") : t("canvas.frame.expand"), toggle)}
      </div>
      <div className="relative min-h-0 flex-1">
        {children}
        <CanvasControls zoom={zoom.level} minZoom={zoom.min} maxZoom={zoom.max} onZoomIn={zoom.onIn} onZoomOut={zoom.onOut} onFit={zoom.onFit} onReset={zoom.onReset} />
      </div>
      {!expanded && (
        <div
          role="separator" aria-orientation="horizontal" aria-label={t("canvas.frame.resize")} aria-description={t("canvas.frame.resizeHint")}
          aria-valuenow={shown} aria-valuemin={MIN_HEIGHT} aria-valuemax={MAX_HEIGHT} tabIndex={0}
          onKeyDown={keyResize} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}
          style={{ touchAction: "none" }}
          className="vn-resize-ns flex h-2.5 shrink-0 items-center justify-center border-t border-[var(--c-border)] transition-colors duration-100 hover:bg-[var(--c-raised)] focus-visible:bg-[var(--c-raised)] [@media(pointer:coarse)]:h-5"
        >
          <span aria-hidden="true" className="h-0.5 w-8 rounded-[var(--radius-full)] bg-[var(--c-border-control)] opacity-60" />
        </div>
      )}
    </div>
  );
}
