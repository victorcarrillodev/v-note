import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Popover } from "../components/Popover";
import { Icon } from "../design/Icon";
import { BREAKPOINTS } from "../layout/layoutMode";
import { shouldShowToc, type Heading } from "./toc";

export type JumpBehavior = "smooth" | "auto";

const prefersReducedMotion = (): boolean => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function useWideEnough(): boolean {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w >= BREAKPOINTS.wide;
}

/** Tabla de contenidos: columna lateral en ventanas amplias, menú «En esta página» en las demás (RF-5.8). */
export function TableOfContents({ headings, activeId, onJump }: { headings: readonly Heading[]; activeId: string | null; onJump: (id: string, behavior: JumpBehavior) => void }) {
  const { t } = useTranslation();
  const wide = useWideEnough();
  if (!shouldShowToc(headings)) return null;
  const label = t("toc.title");
  const jump = (id: string) => onJump(id, prefersReducedMotion() ? "auto" : "smooth");
  const list = (
    <ul className="flex flex-col gap-1">
      {headings.map((h) => (
        <li key={h.id} style={{ paddingInlineStart: `calc(${Math.max(0, h.level - 1)} * var(--space-3))` }}>
          <a
            href={`#${h.id}`}
            {...(h.id === activeId ? { "aria-current": "location" as const } : {})}
            onClick={(e) => { e.preventDefault(); jump(h.id); }}
            className={`block truncate rounded px-2 py-1 text-[length:var(--text-ui-small-size)] hover:bg-[var(--c-raised)] ${h.id === activeId ? "font-semibold text-[var(--c-text)]" : "text-[var(--c-text-muted)]"}`}
          >{h.text}</a>
        </li>
      ))}
    </ul>
  );
  if (wide) return <nav aria-label={label} className="absolute left-full top-0 ml-6 max-h-[calc(100vh-var(--space-12))] w-56 overflow-y-auto">{list}</nav>;
  return (
    <Popover trigger={<button type="button" className="inline-flex items-center gap-1 text-[length:var(--text-ui-small-size)] text-[var(--c-text-muted)]"><Icon name="toc" size={16} />{label}</button>}>
      {list}
    </Popover>
  );
}
