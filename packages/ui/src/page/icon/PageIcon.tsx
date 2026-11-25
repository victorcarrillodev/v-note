import { parseIcon, type AssetStore } from "@vnote/core";
import { cx } from "../../design/cx";
import { useCoverImage } from "../cover/useCoverImage";

/**
 * Ícono de una página: un emoji (texto) o una imagen subida (`asset:`). `size` en píxeles.
 * Sin almacén o mientras carga la imagen no se pinta nada (ocupa el mismo lugar, sin saltos).
 */
export function PageIcon({ icon, assets, size, className, ...rest }: { icon: string | null | undefined; assets?: AssetStore | undefined; size: number; className?: string; "data-testid"?: string }) {
  const parsed = parseIcon(icon);
  const url = useCoverImage(assets, parsed?.kind === "image" ? parsed.hash : null);
  if (!parsed) return null;
  const box = { width: size, height: size };
  if (parsed.kind === "image") {
    return <span aria-hidden="true" {...rest} style={box} className={cx("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-sm", className)}>{url && <img src={url} alt="" draggable={false} className="h-full w-full object-cover" />}</span>;
  }
  return <span aria-hidden="true" {...rest} style={{ fontSize: size, minWidth: size, height: size }} className={cx("inline-flex shrink-0 items-center justify-center whitespace-nowrap leading-none", className)}>{parsed.text}</span>;
}
