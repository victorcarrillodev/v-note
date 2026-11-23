import { readTokens, shade, GRAPH_NODE_COLORS, GRAPH_TOKENS } from "../design/canvasColors";
import { Button } from "../components/Button";
import { IconButton } from "../components/IconButton";
import { ViewLayout } from "../components/ViewLayout";
import { INPUT } from "../components/formStyles";
import { cx } from "../design/cx";
import { Illustration } from "../design/Illustration";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/theme";
import type { GraphData, PageKind, Positions } from "@vnote/core";
import type { WorkspaceController } from "../workspace/controller";
import { computeLayout } from "./layoutRunner";
import { connections, fitTransform, hitNode, nodeRadius, panBy, toScreen, toWorld, zoomAt, type Pt, type Transform } from "./graphGeometry";
import { Checkbox } from "../components/controls";
import { Dropdown } from "../components/ChoiceMenu";

type Category = "page" | "subpage" | "board" | "database" | "trashed";
const CATEGORIES: Category[] = ["page", "subpage", "board", "database", "trashed"];
/** Tipo de elemento de un nodo: la papelera manda; después tablero y base de datos; una nota dentro de otra página es subpágina. */
const categoryOf = (n: { kind: PageKind; trashed: boolean; subpage?: boolean | undefined }): Category =>
  n.trashed ? "trashed" : n.kind === "board" ? "board" : n.kind === "database" ? "database" : n.subpage ? "subpage" : "page";

type Scope = "local" | "all";

/** Vista de grafo (RF-7): páginas como nodos y enlaces como conexiones, dibujados en canvas con zoom y arrastre. */
export function GraphView({ controller, currentPageId, onOpen }: { controller: WorkspaceController; currentPageId: string | null; onOpen: (pageId: string) => void }) {
  const { t } = useTranslation();
  const { themeKey } = useTheme(); // cambia también entre temas de la misma variante: los colores se leen de nuevo
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
  const autoFit = useRef(true); // mientras nadie mueva la vista, se reajusta al encuadre cuando cambia el tamaño
  const live = useRef({ data, positions, tf });
  live.current = { data, positions, tf };

  const local = scope === "local" && currentPageId ? { pageId: currentPageId, depth } : undefined;
  const localKey = local ? `${local.pageId}:${local.depth}` : "";

  // Datos y disposición: se recalculan al cambiar de alcance o de filtros; un cálculo en curso se cancela.
  useEffect(() => {
    const ac = new AbortController();
    setBusy(true);
    autoFit.current = true;
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

  // El contenedor está oculto mientras se calcula (ancho 0): al mostrarse y recibir su ancho real, el grafo se vuelve a encuadrar.
  useEffect(() => { if (autoFit.current && positions.size > 0) setTf(fitTransform(positions, size)); }, [size]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const col = readTokens(c, GRAPH_TOKENS);
    const text = col.text;
    data.edges.forEach((e, i) => {
      const a = positions.get(e.from), b = positions.get(e.to);
      if (!a || !b) return;
      const sa = toScreen(tf, a), sb = toScreen(tf, b);
      const on = highlight?.edges.includes(i) ?? false;
      ctx.beginPath(); ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y);
      ctx.strokeStyle = on ? col.edgeOn : col.edge; ctx.globalAlpha = highlight && !on ? 0.15 : on ? 1 : 0.6; ctx.lineWidth = on ? 2 : 1; ctx.stroke();
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
      const cat = categoryOf(n);
      const base = cat === "trashed" ? col.trashed : GRAPH_NODE_COLORS[cat];
      const rr = Math.max(2, r);
      // Degradado radial (luz arriba a la izquierda) y halo suave: da volumen a los nodos en vez de un círculo plano.
      const grad = base.startsWith("#") ? ctx.createRadialGradient?.(s.x - rr * 0.35, s.y - rr * 0.35, rr * 0.1, s.x, s.y, rr) : undefined;
      if (grad) { grad.addColorStop(0, shade(base, 0.45)); grad.addColorStop(1, shade(base, -0.12)); }
      if (!dim && cat !== "trashed") { ctx.shadowColor = base; ctx.shadowBlur = 10; }
      ctx.fillStyle = grad ?? base; ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowColor = "transparent";
      if (n.id === selected) { ctx.lineWidth = 3; ctx.strokeStyle = col.selected; ctx.stroke(); }
      if (tf.k >= 1.2 || highlight?.nodes.has(n.id) || n.id === currentPageId) {
        ctx.fillStyle = text; ctx.font = "12px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(n.title.trim() || t("app.untitled"), s.x, s.y + Math.max(2, r) + 12);
      }
    }
    ctx.globalAlpha = 1;
    // Para las pruebas automáticas: posición en pantalla de un nodo.
    (c as unknown as { __graph: unknown }).__graph = { screenPos: (id: string): Pt | null => { const p = live.current.positions.get(id); return p ? toScreen(live.current.tf, p) : null; }, selected, nodes: data.nodes.length, edges: data.edges.length, k: tf.k, tx: tf.x, ty: tf.y };
  }, [data, positions, tf, size, highlight, selected, currentPageId, t, themeKey]);

  // Rueda: zoom bajo el cursor (sin pasividad para poder evitar el desplazamiento de la página)
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = c.getBoundingClientRect();
      autoFit.current = false;
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
    d.moved = true; d.x = at.x; d.y = at.y; autoFit.current = false;
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

  const zoomBy = useCallback((f: number) => { autoFit.current = false; setTf((cur) => zoomAt(cur, { x: size.w / 2, y: size.h / 2 }, f)); }, [size]);
  const selNode = data?.nodes.find((n) => n.id === selected) ?? null;
  const neighbours = data && selected ? data.nodes.filter((n) => highlight?.nodes.has(n.id) && n.id !== selected) : [];

  const FILTER = "inline-flex items-center gap-2 text-[length:var(--text-ui-small-size)] font-medium";
  const NOTICE = "mx-auto flex max-w-[var(--size-modal-s)] flex-col items-center gap-3 p-8 text-center text-[var(--c-text-muted)]";

  return (
    <ViewLayout title={t("graph.title")} width="wide">
      <div role="group" aria-label={t("graph.filters")} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius-lg)] border border-[var(--c-border)] bg-[var(--c-card)] px-3 py-2">
        {currentPageId && (
          <label className={FILTER}>{t("graph.scope")}{" "}
            <Dropdown value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
              <option value="local">{t("graph.local")}</option>
              <option value="all">{t("graph.all")}</option>
            </Dropdown>
          </label>
        )}
        {scope === "local" && currentPageId && (
          <label className={FILTER}>{t("graph.depth")}{" "}
            <Dropdown value={depth} onChange={(e) => setDepth(Number(e.target.value))}>
              <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
            </Dropdown>
          </label>
        )}
        <label className={FILTER}>{t("graph.kind")}{" "}
          <Dropdown value={kind} onChange={(e) => setKind(e.target.value as "" | PageKind)}>
            <option value="">{t("graph.anyKind")}</option>
            <option value="note">{t("graph.kinds.note")}</option><option value="board">{t("graph.kinds.board")}</option><option value="database">{t("graph.kinds.database")}</option>
          </Dropdown>
        </label>
        <Checkbox className="text-[length:var(--text-ui-small-size)]" label={t("graph.hideOrphans")} checked={hideOrphans} onChange={setHideOrphans} />
        <Checkbox className="text-[length:var(--text-ui-small-size)]" label={t("graph.includeTrash")} checked={includeTrashed} onChange={setIncludeTrashed} />
        <span role="group" aria-label={t("graph.zoom")} className="ml-auto inline-flex items-center">
          <IconButton icon="zoomIn" label={t("graph.zoomIn")} onClick={() => zoomBy(1.4)} />
          <IconButton icon="zoomOut" label={t("graph.zoomOut")} onClick={() => zoomBy(1 / 1.4)} />
          <IconButton icon="fitView" label={t("graph.fit")} onClick={() => { autoFit.current = true; setTf(fitTransform(positions, size)); }} />
        </span>
      </div>

      <ul aria-label={t("graph.legend.title")} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[length:var(--text-ui-small-size)] text-[var(--c-text-muted)]">
        {CATEGORIES.map((c) => (
          <li key={c} data-legend={c} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: c === "trashed" ? `var(${GRAPH_TOKENS.trashed})` : `radial-gradient(circle at 30% 30%, ${shade(GRAPH_NODE_COLORS[c], 0.45)}, ${GRAPH_NODE_COLORS[c]})`, boxShadow: c === "trashed" ? undefined : `0 0 6px ${GRAPH_NODE_COLORS[c]}` }} />{t(`graph.legend.${c}`)}
          </li>
        ))}
      </ul>

      {busy && <p role="status" className="text-[var(--c-text-muted)]">{t("graph.computing")}</p>}
      {!busy && data && !data.hasLinks && <div role="status" data-testid="graph-empty" className={NOTICE}><Illustration name="pages" /><p>{t("graph.noLinks")}</p></div>}
      {!busy && data && data.hasLinks && data.nodes.length === 0 && <div role="status" className={NOTICE}><Illustration name="search" /><p>{t("graph.noMatches")}</p></div>}

      <div ref={wrap} className={!busy && data && data.nodes.length > 0 && data.hasLinks ? "" : "hidden"}>
        <canvas
          ref={canvas} data-testid="graph-canvas" role="img" aria-label={t("graph.canvas", { nodes: data?.nodes.length ?? 0, edges: data?.edges.length ?? 0 })}
          className="vn-grab rounded-[var(--radius-lg)] border border-[var(--c-border)] bg-[var(--c-card)]" style={{ width: size.w, height: size.h, touchAction: "none" }}
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
        <div role="region" aria-label={t("graph.selection")} className="flex flex-wrap items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--c-border)] bg-[var(--c-card)] px-4 py-3 text-[length:var(--text-ui-size)]">
          <div className="min-w-0 flex-1">
            <p><strong className="font-semibold">{selNode.title.trim() || t("app.untitled")}</strong>{selNode.trashed ? ` ${t("graph.inTrash")}` : ""}</p>
            <p className="text-[length:var(--text-ui-small-size)] text-[var(--c-text-muted)]">{t("graph.connections", { count: neighbours.length })}{neighbours.length ? `: ${neighbours.map((n) => n.title.trim() || t("app.untitled")).join(", ")}` : ""}</p>
          </div>
          {!selNode.trashed && <Button variant="primary" onClick={() => onOpen(selNode.id)}>{t("graph.open")}</Button>}
        </div>
      )}
    </ViewLayout>
  );
}
