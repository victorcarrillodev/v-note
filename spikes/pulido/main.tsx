// Spike R-004 y R-005 (desechable): menú anclado a un punto virtual que sigue al lienzo, y clic frente a arrastre sobre un nodo con campo de texto.
import { StrictMode, useCallback, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ReactFlow, ReactFlowProvider, useNodesState, useOnViewportChange, useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import * as Popover from "@radix-ui/react-popover";

declare global { interface Window { __log: string[]; __api: { popRect: () => DOMRect | null; expectedPoint: () => { x: number; y: number }; editing: () => string | null; selected: () => string | null } } }
window.__log = [];

const DRAG_PX = 5;
function Bubble({ id, data }: NodeProps) {
  const d = data as { text: string; editing: string | null; setEditing: (id: string | null) => void; select: (id: string) => void };
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const isEditing = d.editing === id;
  return (
    <div
      data-bubble={id} style={{ width: 160, height: 40, border: "2px solid #333", borderRadius: 20, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}
      onPointerDown={(e) => { start.current = { x: e.clientX, y: e.clientY, moved: false }; }}
      onPointerMove={(e) => { const s = start.current; if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > DRAG_PX) s.moved = true; }}
      onPointerUp={() => { const s = start.current; start.current = null; if (s && !s.moved) { d.select(id); d.setEditing(id); window.__log.push("clic:" + id); } else if (s) window.__log.push("arrastre:" + id); }}
    >
      {isEditing ? <input className="nodrag" autoFocus defaultValue={d.text} data-input={id} onBlur={() => d.setEditing(null)} /> : <span>{d.text}</span>}
    </div>
  );
}
const nodeTypes = { bubble: Bubble };

function Spike() {
  const rf = useReactFlow();
  const [editing, setEditing] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [nodes, , onNodesChange] = useNodesState<Node>([
    { id: "a", type: "bubble", position: { x: 80, y: 80 }, data: {} },
    { id: "b", type: "bubble", position: { x: 380, y: 160 }, data: {} },
  ]);
  const edgePoint = { x: 300, y: 130 }; // punto del lienzo (conector virtual)
  useOnViewportChange({ onChange: () => setTick((t) => t + 1) });
  const rect = useCallback(() => { const s = rf.flowToScreenPosition(edgePoint); return new DOMRect(s.x, s.y, 0, 0); }, [rf, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const virtualRef = useMemo(() => ({ current: { getBoundingClientRect: rect } }), [rect]);
  const withData = useMemo(() => nodes.map((n) => ({ ...n, data: { text: n.id === "a" ? "Hijo" : "Otro", editing, setEditing, select: setSelected } })), [nodes, editing]);
  window.__api = {
    popRect: () => document.querySelector("[data-pop]")?.getBoundingClientRect() ?? null,
    expectedPoint: () => rf.flowToScreenPosition(edgePoint),
    editing: () => editing, selected: () => selected,
  };
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ReactFlow nodes={withData} edges={[]} nodeTypes={nodeTypes} onNodesChange={onNodesChange} fitView={false} proOptions={{ hideAttribution: true }} />
      <Popover.Root open modal={false}>
        <Popover.Anchor virtualRef={virtualRef} />
        <Popover.Portal>
          <Popover.Content data-pop side="top" sideOffset={8} onOpenAutoFocus={(e) => e.preventDefault()} style={{ background: "#eee", border: "1px solid #999", padding: 4 }}>Menú del conector</Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<StrictMode><ReactFlowProvider><Spike /></ReactFlowProvider></StrictMode>);
