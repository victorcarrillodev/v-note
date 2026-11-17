import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Popover } from "../components/Popover";
import { Icon } from "../design/Icon";
import { tocFits, TOC_WIDTH } from "./tocLayout";
import { shouldShowToc, type Heading } from "@vnote/core";

export type JumpBehavior = "smooth" | "auto";

const prefersReducedMotion = (): boolean => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** ¿Cabe la columna lateral en el margen del contenido? Se reevalúa al cambiar el tamaño de la ventana (RF-7.7). */
function useFits(contentWidth: number): boolean {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return tocFits(w, contentWidth);
}

/** Tabla de contenidos: columna lateral en ventanas amplias, menú «En esta página» en las demás (RF-5.8). */
export function TableOfContents({ headings, activeId, onJump, contentWidth = 720 }: { headings: readonly Heading[]; activeId: string | null; onJump: (id: string, behavior: JumpBehavior) => void; contentWidth?: number }) {
  const { t } = useTranslation();
  const wide = useFits(contentWidth);
  if (!shouldShowToc(headings)) return null;
  const label = t("toc.title");
  const jump = (id: string) => onJump(id, prefersReducedMotion() ? "auto" : "smooth");
  // La lista tiene desplazamiento propio: con cientos de encabezados no alarga la página (CL-12).
  const list = (
    <ul data-testid="toc-list" className="flex max-h-[min(60vh,32rem)] flex-col gap-1 overflow-y-auto">
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
  if (wide) return <nav aria-label={label} data-testid="toc-floating" style={{ width: TOC_WIDTH }} className="absolute left-full top-0 ml-6">{list}</nav>;
  return (
    <Popover trigger={<button type="button" className="inline-flex items-center gap-1 text-[length:var(--text-ui-small-size)] text-[var(--c-text-muted)]"><Icon name="toc" size={16} />{label}</button>}>
      {list}
    </Popover>
  );
}
