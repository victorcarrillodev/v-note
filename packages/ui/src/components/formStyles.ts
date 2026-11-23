/** Clases compartidas de los formularios de las vistas (etiqueta encima del control, control de 32 px con borde de control). */
export const FIELD = "flex flex-col gap-1 text-[length:var(--text-ui-small-size)] font-medium text-[var(--c-text)]";
export const INPUT = "h-8 w-full rounded-[var(--radius-md)] border border-[var(--c-border-control)] bg-[var(--c-card)] px-2.5 outline-none hover:bg-[var(--c-raised)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--c-accent)] text-[length:var(--text-ui-size)] font-normal text-[var(--c-text)] placeholder:text-[var(--c-text-placeholder)] disabled:cursor-not-allowed disabled:opacity-60";
/** Texto secundario bajo un título o junto a un dato. */
export const MUTED = "text-[length:var(--text-ui-small-size)] text-[var(--c-text-muted)]";
/** Como `INPUT`, pero cabe en una fila junto a otros controles (ancho flexible en vez de toda la línea). */
export const INPUT_INLINE = INPUT.replace("w-full", "min-w-0 flex-1 basis-40");
