import * as T from "@radix-ui/react-tabs";
import { useEffect, useRef, useState } from "react";
import { cx } from "../design/cx";
import { Icon } from "../design/Icon";
import type { IconName } from "../design/iconMap";

/** Pestañas (vistas de una base): flechas para moverse; subrayado de acento y peso mayor en la activa; desvanecimiento si no caben. */
export function Tabs({ label, value, onChange, tabs }: { label: string; value: string; onChange: (v: string) => void; tabs: { value: string; label: string; icon?: IconName }[] }) {
  const list = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const check = () => setOverflow(el.scrollWidth > el.clientWidth);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tabs.length]);
  return (
    <T.Root value={value} onValueChange={onChange}>
      <div className="relative" {...(overflow ? { "data-overflow": "" } : {})}>
        <T.List ref={list} aria-label={label} className="flex gap-1 overflow-x-auto border-b border-[var(--c-border)]">
          {tabs.map((t) => (
            <T.Trigger key={t.value} value={t.value} aria-controls={undefined} className={cx("-mb-px h-8 shrink-0 border-b-2 px-3 text-[length:var(--text-ui-size)]", t.value === value ? "border-[var(--c-accent)] font-semibold text-[var(--c-text)]" : "border-transparent text-[var(--c-text-muted)] hover:text-[var(--c-text)]")}>
              <span className="inline-flex items-center gap-1.5">{t.icon && <Icon name={t.icon} size={16} />}{t.label}</span>
            </T.Trigger>
          ))}
        </T.List>
        {overflow && <span aria-hidden="true" className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-[var(--c-canvas)] to-transparent" />}
      </div>
    </T.Root>
  );
}
