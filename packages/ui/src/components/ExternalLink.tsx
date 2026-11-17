import type { AnchorHTMLAttributes } from "react";
import { useOpenExternal } from "../app/services";

/** Enlace a una página externa: en escritorio lo abre el sistema (`openExternal`); en la web, el enlace normal en otra pestaña. */
export function ExternalLink({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const open = useOpenExternal();
  return (
    <a
      {...rest}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        onClick?.(e);
        if (open && !e.defaultPrevented) { e.preventDefault(); open(href); }
      }}
    />
  );
}
