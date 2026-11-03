/** Esqueleto neutro que reserva el espacio (sin saltos de diseño). Estático con «reducir movimiento». */
export function Skeleton({ height, width }: { height: number; width?: number }) {
  return <div aria-hidden="true" style={{ height, ...(width ? { width } : {}) }} className="animate-pulse rounded bg-[var(--c-raised)] motion-reduce:animate-none" />;
}
