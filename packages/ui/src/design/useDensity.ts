import { useEffect, useState } from "react";

export type Density = "comfortable" | "compact";
export const rowHeightFor = (d: Density): number => (d === "compact" ? 28 : 32);
const read = (): Density => (typeof document !== "undefined" && document.documentElement.getAttribute("data-density") === "compact" ? "compact" : "comfortable");

/** Densidad actual de la interfaz (atributo `data-density` del documento), reactiva a los cambios de ajustes. */
export function useDensity(): Density {
  const [d, setD] = useState<Density>(read);
  useEffect(() => {
    setD(read());
    const mo = new MutationObserver(() => setD(read()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-density"] });
    return () => mo.disconnect();
  }, []);
  return d;
}
