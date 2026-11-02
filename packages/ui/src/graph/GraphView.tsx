import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GraphData, PageKind, Positions } from "@vnote/core";
import type { WorkspaceController } from "../workspace/controller";
import { computeLayout } from "./layoutRunner";
import { connections, fitTransform, hitNode, nodeRadius, panBy, toScreen, toWorld, zoomAt, type Pt, type Transform } from "./graphGeometry";

const KIND_COLOR: Record<PageKind, string> = { note: "#3b82f6", board: "#16a34a", database: "#f97316" };
type Scope = "local" | "all";

/** Vista de grafo (RF-7): páginas como nodos y enlaces como conexiones, dibujados en canvas con zoom y arrastre. */
export function GraphView({ controller, currentPageId, onOpen }: { controller: WorkspaceController; currentPageId: string | null; onOpen: (pageId: string) => void }) {
  const { t } = useTranslation();
  const [scope, setScope] = useState<Scope>(currentPageId ? "local" : "all");
  const [depth, setDepth] = useState(1);
  const [includeTrashed, setIncludeTrashed] = useState(false);
  const [hideOrphans, setHideOrphans] = useState(false);
  const [kind, setKind] = useState<"" | PageKind>("");
  const [data, setData] = useState<GraphData | null>(null);
  const [positions, setPositions] = useState<Positions>(new Map());
  const [busy, setBusy] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [tf, setTf] = useState<Transform>({ x: 0, y: 0, k: 1 });
  const [size, setSize] = useState({ w: 800, h: 480 });
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef({ data, positions, tf });
  live.current = { data, positions, tf };

  const local = scope === "local" && currentPageId ? { pageId: currentPageId, depth } : undefined;
  const localKey = local ? `${local.pageId}:${local.depth}` : "";

  // Datos y disposición: se recalculan al cambiar de alcance o de filtros; un cálculo en curso se cancela.
  useEffect(() => {
    const ac = new AbortController();
    setBusy(true);
    void (async () => {
      const g = await controller.buildGraph({ ...(local ? { local } : {}), includeTrashed, hideOrphans, ...(kind ? { kinds: [kind] } : {}) });
      if (ac.signal.aborted) return;
      const pos = await computeLayout(g, ac.signal);
      if (!pos || ac.signal.aborted) return;
      setData(g); setPositions(pos); setSelected(null);
      setTf(fitTransform(pos, live.current ? sizeRef.current : { w: 800, h: 480 }));
      setBusy(false);
    })();
    return () => ac.abort();
  }, [controller, localKey, includeTrashed, hideOrphans, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const sizeRef = useRef(size);
  sizeRef.current = size;
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setSize({ w: Math.max(200, el.clientWidth), h: 480 }));
    ro.observe(el);
    setSize({ w: Math.max(200, el.clientWidth), h: 480 });
    return () => ro.disconnect();
  }, []);

  const highlight = useMemo(() => (data && selected ? connections(data, selected) : null), [data, selected]);

  // Dibujo
  useEffect(() => {
    const c = canvas.current;
    if (!c || !data) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(size.w * dpr); c.height = Math.round(size.h * dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    const text = getComputedStyle(c).color || "#111";
    data.edges.forEach((e, i) => {
      const a = positions.get(e.from), b = positions.get(e.to);
      if (!a || !b) return;
      const sa = toScreen(tf, a), sb = toScreen(tf, b);
      const on = highlight?.edges.includes(i) ?? false;
      ctx.beginPath(); ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y);
      ctx.strokeStyle = on ? "#2563eb" : "#94a3b8"; ctx.globalAlpha = highlight && !on ? 0.15 : on ? 1 : 0.6; ctx.lineWidth = on ? 2 : 1; ctx.stroke();
    });
    ctx.globalAlpha = 1;
    for (const n of data.nodes) {
      const p = positions.get(n.id);
      if (!p) continue;
      const s = toScreen(tf, p);
      if (s.x < -20 || s.y < -20 || s.x > size.w + 20 || s.y > size.h + 20) continue;
      const r = nodeRadius(n.degree) * Math.min(tf.k, 2);
      const dim = highlight && !highlight.nodes.has(n.id);
      ctx.globalAlpha = dim ? 0.2 : 1;
      ctx.beginPath(); ctx.arc(s.x, s.y, Math.max(2, r), 0, Math.PI * 2);
      ctx.fillStyle = n.trashed ? "#9ca3af" : KIND_COLOR[n.kind]; ctx.fill();
      if (n.id === selected) { ctx.lineWidth = 3; ctx.strokeStyle = "#111827"; ctx.stroke(); }
      if (tf.k >= 1.2 || highlight?.nodes.has(n.id) || n.id === currentPageId) {
        ctx.fillStyle = text; ctx.font = "12px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(n.title.trim() || t("app.untitled"), s.x, s.y + Math.max(2, r) + 12);
      }
    }
    ctx.globalAlpha = 1;
    // Para las pruebas automáticas: posición en pantalla de un nodo.
    (c as unknown as { __graph: unknown }).__graph = { screenPos: (id: string): Pt | null => { const p = live.current.positions.get(id); return p ? toScreen(live.current.tf, p) : null; }, selected, nodes: data.nodes.length, edges: data.edges.length, k: tf.k, tx: tf.x, ty: tf.y };
  }, [data, positions, tf, size, highlight, selected, currentPageId, t]);

  // Rueda: zoom bajo el cursor (sin pasividad para poder evitar el desplazamiento de la página)
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = c.getBoundingClientRect();
      setTf((cur) => zoomAt(cur, { x: e.clientX - r.left, y: e.clientY - r.top }, Math.exp(-e.deltaY * 0.0015)));
    };
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
  }, [data]);

  // Arrastre: sobre un nodo lo mueve; sobre el fondo desplaza la vista. Un clic sin mover selecciona.
  const drag = useRef<{ mode: "node" | "pan"; id: string | null; x: number; y: number; moved: boolean } | null>(null);
  const localPoint = (e: React.PointerEvent): Pt => { const r = canvas.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const onPointerDown = (e: React.PointerEvent) => {
    if (!data || e.button !== 0) return;
    const at = localPoint(e);
    const hit = hitNode(data, positions, tf, at);
    drag.current = { mode: hit ? "node" : "pan", id: hit, x: at.x, y: at.y, moved: false };
    canvas.current?.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const at = localPoint(e);
    const dx = at.x - d.x, dy = at.y - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true; d.x = at.x; d.y = at.y;
    if (d.mode === "pan") setTf((cur) => panBy(cur, dx, dy));
    else if (d.id) {
      const id = d.id;
      setPositions((cur) => { const w = toWorld(live.current.tf, at); const next = new Map(cur); next.set(id, w); return next; });
    }
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) setSelected(d.id);
  };

  const zoomBy = useCallback((f: number) => setTf((cur) => zoomAt(cur, { x: size.w / 2, y: size.h / 2 }, f)), [size]);
  const selNode = data?.nodes.find((n) => n.id === selected) ?? null;
  const neighbours = data && selected ? data.nodes.filter((n) => highlight?.nodes.has(n.id) && n.id !== selected) : [];

  return (
    <section aria-label={t("graph.title")} className="p-4">
      <h1 className="text-xl font-semibold">{t("graph.title")}</h1>
      <div role="group" aria-label={t("graph.filters")} className="my-2 flex flex-wrap items-center gap-3 text-sm">
        {currentPageId && (
          <label>{t("graph.scope")}{" "}
            <select value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
              <option value="local">{t("graph.local")}</option>
              <option value="all">{t("graph.all")}</option>
            </select>
          </label>
        )}
        {scope === "local" && currentPageId && (
          <label>{t("graph.depth")}{" "}
            <select value={depth} onChange={(e) => setDepth(Number(e.target.value))}>
              <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
            </select>
          </label>
        )}
        <label>{t("graph.kind")}{" "}
          <select value={kind} onChange={(e) => setKind(e.target.value as "" | PageKind)}>
            <option value="">{t("graph.anyKind")}</option>
            <option value="note">{t("graph.kinds.note")}</option><option value="board">{t("graph.kinds.board")}</option><option value="database">{t("graph.kinds.database")}</option>
          </select>
        </label>
        <label><input type="checkbox" checked={hideOrphans} onChange={(e) => setHideOrphans(e.target.checked)} /> {t("graph.hideOrphans")}</label>
        <label><input type="checkbox" checked={includeTrashed} onChange={(e) => setIncludeTrashed(e.target.checked)} /> {t("graph.includeTrash")}</label>
        <span role="group" aria-label={t("graph.zoom")}>
          <button type="button" onClick={() => zoomBy(1.4)}>{t("graph.zoomIn")}</button>{" "}
          <button type="button" onClick={() => zoomBy(1 / 1.4)}>{t("graph.zoomOut")}</button>{" "}
          <button type="button" onClick={() => setTf(fitTransform(positions, size))}>{t("graph.fit")}</button>
        </span>
      </div>

      {busy && <p role="status" className="opacity-70">{t("graph.computing")}</p>}
      {!busy && data && !data.hasLinks && <p role="status" data-testid="graph-empty">{t("graph.noLinks")}</p>}
      {!busy && data && data.hasLinks && data.nodes.length === 0 && <p role="status">{t("graph.noMatches")}</p>}

      <div ref={wrap} className={!busy && data && data.nodes.length > 0 && data.hasLinks ? "" : "hidden"}>
        <canvas
          ref={canvas} data-testid="graph-canvas" role="img" aria-label={t("graph.canvas", { nodes: data?.nodes.length ?? 0, edges: data?.edges.length ?? 0 })}
          style={{ width: size.w, height: size.h, touchAction: "none", border: "1px solid #94a3b8", borderRadius: 6, cursor: "grab" }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
          onDoubleClick={(e) => { if (!data) return; const r = canvas.current!.getBoundingClientRect(); const hit = hitNode(data, positions, tf, { x: e.clientX - r.left, y: e.clientY - r.top }); if (hit) onOpen(hit); }}
        />
        {/* Alternativa accesible: la misma información como lista operable con teclado */}
        <ul aria-label={t("graph.nodeList")} className="sr-only">
          {(data?.nodes ?? []).slice(0, 300).map((n) => (
            <li key={n.id}><button type="button" onClick={() => setSelected(n.id)}>{n.title.trim() || t("app.untitled")}</button></li>
          ))}
        </ul>
      </div>

      {selNode && (
        <div role="region" aria-label={t("graph.selection")} className="mt-2 rounded border p-2 text-sm">
          <p><strong>{selNode.title.trim() || t("app.untitled")}</strong>{selNode.trashed ? ` ${t("graph.inTrash")}` : ""}</p>
          <p>{t("graph.connections", { count: neighbours.length })}{neighbours.length ? `: ${neighbours.map((n) => n.title.trim() || t("app.untitled")).join(", ")}` : ""}</p>
          {!selNode.trashed && <button type="button" onClick={() => onOpen(selNode.id)}>{t("graph.open")}</button>}
        </div>
      )}
    </section>
  );
}
