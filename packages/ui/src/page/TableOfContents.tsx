import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Popover } from "../components/Popover";
import { Icon } from "../design/Icon";
import { TOC_MIN_VIEWPORT, TOC_WIDTH } from "./tocLayout";
import { shouldShowToc, type Heading } from "@vnote/core";

export type JumpBehavior = "smooth" | "auto";

const prefersReducedMotion = (): boolean => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Las rayitas se ven en cualquier ancho de página (también «completo»); solo en ventanas estrechas pasan a ser un menú. */
function useFits(): boolean {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w >= TOC_MIN_VIEWPORT;
}

/** Bordes izquierdo y derecho del área que se desplaza (la que contiene la página), para pegar las rayitas a sus márgenes. */
function useMargins(anchor: { current: HTMLElement | null }, active: boolean) {
  const [m, setM] = useState({ left: 8, right: 16 });
  useLayoutEffect(() => {
    if (!active) return;
    let host = anchor.current?.parentElement ?? null;
    while (host && !/(auto|scroll)/.test(getComputedStyle(host).overflowY)) host = host.parentElement;
    const measure = () => {
      if (!host) return;
      const r = host.getBoundingClientRect();
      setM({ left: r.left + 8, right: Math.max(0, window.innerWidth - r.right) + 16 });
    };
    measure();
    const observer = typeof ResizeObserver === "function" && host ? new ResizeObserver(measure) : null;
    if (host) observer?.observe(host);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [anchor, active]);
  return m;
}

/** Cuando la cabecera (portada, título, etiquetas o acciones) pasa por el sitio de unas rayitas, estas se apartan por debajo y vuelven después. */
function useCovered(active: boolean) {
  const rails = useRef<Record<"left" | "right", HTMLElement | null>>({ left: null, right: null });
  const [covered, setCovered] = useState({ left: false, right: false });
  useEffect(() => {
    if (!active) return;
    const check = () => {
      const content = [...document.querySelectorAll('[data-testid="page-header"] :is(button, a, textarea, input), [data-testid="cover"]')].map((e) => e.getBoundingClientRect());
      const hit = (el: HTMLElement | null) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return content.some((c) => c.width > 0 && c.left < r.right && c.right > r.left && c.top < r.bottom && c.bottom > r.top);
      };
      const next = { left: hit(rails.current.left), right: hit(rails.current.right) };
      setCovered((prev) => (prev.left === next.left && prev.right === next.right ? prev : next));
    };
    check();
    const timer = setInterval(check, 500); // la portada y las fuentes terminan de colocarse sin ningún evento
    document.addEventListener("scroll", check, true);
    window.addEventListener("resize", check);
    return () => { clearInterval(timer); document.removeEventListener("scroll", check, true); window.removeEventListener("resize", check); };
  }, [active]);
  return { rails, covered };
}

const CLOSE_DELAY_MS = 300;

const DASH = ["w-6", "w-4", "w-3"];

/** Tabla de contenidos: rayitas en ambos márgenes que se detallan al pasar el ratón; menú «En esta página» si no caben (RF-5.8). */
export function TableOfContents({ headings, activeId, onJump }: { headings: readonly Heading[]; activeId: string | null; onJump: (id: string, behavior: JumpBehavior) => void }) {
  const { t } = useTranslation();
  const wide = useFits();
  const anchor = useRef<HTMLSpanElement>(null);
  const margins = useMargins(anchor, wide && shouldShowToc(headings));
  // Panel abierto con estado propio: `:hover` de CSS no actúa en equipos que se declaran sin puntero fino.
  const [open, setOpen] = useState<"left" | "right" | null>(null);
  const closing = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { rails, covered } = useCovered(wide && shouldShowToc(headings));
  useEffect(() => () => clearTimeout(closing.current), []);
  const show = (side: "left" | "right") => { clearTimeout(closing.current); setOpen(side); };
  // Se cierra con un pequeño margen de tiempo: salirse un instante al ir hacia un título no lo hace desaparecer.
  const hide = () => { clearTimeout(closing.current); closing.current = setTimeout(() => setOpen(null), CLOSE_DELAY_MS); };
  if (!shouldShowToc(headings)) return null;
  const label = t("toc.title");
  const jump = (id: string) => onJump(id, prefersReducedMotion() ? "auto" : "smooth");
  // La lista tiene desplazamiento propio: con cientos de encabezados no alarga la página (CL-12).
  const list = (testId: string) => (
    <ul data-testid={testId} className="flex max-h-[min(60vh,32rem)] flex-col gap-1 overflow-y-auto">
      {headings.map((h) => (
        <li key={h.id} style={{ paddingInlineStart: `calc(${Math.max(0, h.level - 1)} * var(--space-3))` }}>
          <a
            href={`#${h.id}`}
            {...(h.id === activeId ? { "aria-current": "location" as const } : {})}
            onClick={(e) => { e.preventDefault(); jump(h.id); }}
            className={`block truncate rounded px-2 py-1 text-[length:var(--text-ui-small-size)] hover:bg-[var(--c-raised)] ${h.id === activeId ? "font-semibold text-[var(--c-accent)]" : "text-[var(--c-text-muted)]"}`}
          >{h.text}</a>
        </li>
      ))}
    </ul>
  );
  const rail = (side: "left" | "right") => (
    <nav
      aria-label={side === "right" ? label : `${label} (${t("toc.leftSide")})`}
      data-testid={side === "right" ? "toc-floating" : "toc-floating-left"}
      style={{ [side]: margins[side] }}
      ref={(el) => { rails.current[side] = el; }}
      {...(covered[side] ? { "data-covered": "" } : {})}
      onPointerEnter={() => show(side)}
      onPointerLeave={hide}
      onFocus={() => show(side)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) hide(); }}
      className={`fixed top-1/2 -translate-y-1/2 transition-opacity duration-200 motion-reduce:transition-none ${open === side ? "z-40" : "z-10"} ${covered[side] && open !== side ? "pointer-events-none opacity-0" : ""}`}
    >
      <div aria-hidden="true" className={`flex max-h-[min(60vh,32rem)] flex-col gap-2.5 overflow-hidden px-1 py-2 ${side === "right" ? "items-end" : "items-start"}`}>
        {headings.map((h) => (
          <span key={h.id} data-toc-dash="" className={`block h-1 shrink-0 rounded-full ${DASH[Math.min(h.level, 3) - 1]} ${h.id === activeId ? "bg-[var(--c-accent)]" : "bg-[var(--c-border-control)]"}`} />
        ))}
      </div>
      <div
        style={{ width: TOC_WIDTH }}
        className={`absolute top-1/2 -translate-y-1/2 rounded-[var(--radius-lg)] border border-[var(--c-border)] bg-[var(--c-card)] p-1 shadow-[var(--elevation-3)] transition-opacity duration-150 motion-reduce:transition-none ${open === side ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"} ${side === "right" ? "right-0" : "left-0"}`}
      >
        {list(side === "right" ? "toc-list" : "toc-list-left")}
      </div>
    </nav>
  );
  if (wide) return <><span ref={anchor} hidden />{createPortal(<>{rail("left")}{rail("right")}</>, document.body)}</>;
  return (
    <Popover trigger={<button type="button" className="inline-flex items-center gap-1 text-[length:var(--text-ui-small-size)] text-[var(--c-text-muted)]"><Icon name="toc" size={16} />{label}</button>}>
      {list("toc-list")}
    </Popover>
  );
}
