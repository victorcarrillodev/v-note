import { useEffect, useState } from "react";

/** ¿Está pulsada la tecla Alt? Sirve para suspender el acomodo a la cuadrícula mientras se arrastra (spec 004, RF-18). */
export function useAltHeld(): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === "Alt") setHeld(true); };
    const up = (e: KeyboardEvent) => { if (e.key === "Alt") setHeld(false); };
    const off = () => setHeld(false);
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", off);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", off); };
  }, []);
  return held;
}
