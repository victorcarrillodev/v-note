import { useEffect, useRef } from "react";
import { useReactFlow, useStore } from "@xyflow/react";
import { usePageZoom } from "./zoomContext";

/** Lo dibujado en un lienzo crece con el zoom de la página; el marco y sus controles no. Respeta el zoom propio del lienzo (se multiplica). */
export function useFlowPageZoom(): void {
  const factor = usePageZoom();
  const flow = useReactFlow();
  const ready = useStore((s) => s.width > 0);
  const applied = useRef(1);
  useEffect(() => {
    if (!ready || applied.current === factor) return;
    // Un cuadro después, para que el encuadre inicial del lienzo no deshaga el cambio.
    const frame = window.requestAnimationFrame(() => {
      void flow.zoomTo(flow.getZoom() * (factor / applied.current));
      applied.current = factor;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [factor, ready, flow]);
}
