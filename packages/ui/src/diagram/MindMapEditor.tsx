import { coreText } from "../i18n/coreText";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Background, ReactFlow, ReactFlowProvider, ViewportPortal, useReactFlow, useStore, type Node, type NodeProps } from "@xyflow/react";
import { useFlowPageZoom } from "../page/zoom/useFlowPageZoom";
import { useTranslation } from "react-i18next";
import {
  GRID, NODE_H, NODE_W, Snapshots, addChild, addSibling, applyStyleToBranch, branchClip, defaultMapHeight, deleteTreeNode, effectiveBase, findNode, newId, newTree, parseTree, pasteBranch,
  placeNewNode, reflowAuto, renameNode, resolveTreeLayout, serializeTree, setTreeNodeStyle, snapOffset, toggleCollapsed, moveBranch, visibleNodes, type TNode, type TStyle, type Tree,
} from "@vnote/core";
import { CanvasFrame } from "../canvas/CanvasFrame";
import { FloatingMenu, type MenuGroup } from "../canvas/FloatingMenu";
import { useGridPrefs } from "../canvas/gridPrefs";
import { useAltHeld } from "../canvas/useAltHeld";
import { fillFor, strokeFor } from "../design/diagramPalette";
import { cx } from "../design/cx";
import { Icon } from "../design/Icon";
import { SvgLayer } from "../design/SvgLayer";
import { ColorPicker } from "./ColorPicker";
import { hasLowContrast } from "./diagramContrast";
import { useRecents } from "./StylePanels";

const MIN_ZOOM = 0.02, MAX_ZOOM = 4, DRAG_THRESHOLD = 5, PAD = 40;
/** Zoom mínimo al que aún se encuadra el mapa entero al revelar un globo nuevo; por debajo solo se centra el globo. */
const REVEAL_MIN_ZOOM = 0.6;
/** Alto que el menú del globo puede ocupar aunque el lienzo sea bajo: cabe el selector de color sin desplazarse. */
const MENU_MIN_HEIGHT = 260;
const theme = (): "light" | "dark" => (typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
const matches = (q: string) => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(q).matches;

type MindData = {
  id: string; text: string; style: TStyle | undefined; hasChildren: boolean; collapsed: boolean; hidden: number; isRoot: boolean; selected: boolean; editing: boolean; draft: string; label: string; placeholder: string; editLabel: string; side: "left" | "right"; addLabel: string;
  onDown: (e: ReactPointerEvent, id: string) => void; onDraft: (v: string) => void; onCommit: () => void; onEsc: () => void; onFocusNode: (id: string) => void; onAdd: (id: string) => void;
};

/** Globo del mapa: un clic lo selecciona y pone el texto en edición; arrastrar lo mueve con su rama (el gesto lo gestiona el editor). */
const MindNode = memo(function MindNode({ data }: NodeProps<Node<MindData>>) {
  const d = data;
  const fill = fillFor(d.style?.fill ?? (d.isRoot ? "palette:blue" : "palette:white"));
  // Sin color propio el borde es discreto (como una tarjeta); con color elegido se dibuja con ese color y más grueso.
  const border = d.style?.stroke ? (d.style.stroke === "none" ? "2px solid transparent" : `2px solid ${strokeFor(d.style.stroke)}`) : d.isRoot ? `2px solid ${strokeFor("palette:blue")}` : "1px solid var(--c-border-control)";
  return (
    <div className="relative" style={{ width: NODE_W, height: NODE_H }}>
    <div
      role={d.editing ? "group" : "button"} tabIndex={0} aria-label={d.label} data-selected={d.selected ? "true" : "false"} {...(d.editing ? { "aria-current": true } : { "aria-pressed": d.selected })} aria-expanded={d.hasChildren && !d.editing ? !d.collapsed : undefined} data-mind-id={d.id} data-depth="" data-mind-fill={d.style?.fill ?? ""}
      onPointerDown={(e) => d.onDown(e, d.id)} onMouseDown={(e) => e.stopPropagation()} onFocus={() => d.onFocusNode(d.id)}
      style={{ width: NODE_W, height: NODE_H, background: fill, border, color: strokeFor(d.style?.text ?? "palette:ink"), touchAction: "none", boxSizing: "border-box", pointerEvents: "all" }}
      className={cx(
        "nopan relative flex items-center justify-center px-3 text-center text-[length:var(--text-ui-small-size)] leading-4 shadow-[var(--elevation-1)] transition-shadow duration-100 hover:shadow-[var(--elevation-2)]",
        "[@media(pointer:coarse)]:before:absolute [@media(pointer:coarse)]:before:-inset-0.5 [@media(pointer:coarse)]:before:content-['']",
        d.isRoot ? "rounded-[var(--radius-full)] font-semibold" : "rounded-[var(--radius-lg)]", d.selected && "vn-selected", d.editing ? "cursor-text" : "vn-grab",
      )}
    >
      <div data-mind-inner={d.id} className="flex h-full w-full items-center justify-center" style={{ willChange: "transform" }}>
        {d.editing ? (
          <input
            autoFocus aria-label={d.editLabel} value={d.draft} placeholder={d.placeholder} className="nodrag nopan w-full bg-transparent text-center outline-none placeholder:opacity-60" onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => d.onDraft(e.target.value)} onBlur={d.onCommit} onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); d.onCommit(); } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); d.onEsc(); } else if (e.key === "Tab" && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); e.stopPropagation(); d.onAdd(d.id); } else if (!((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "f")) e.stopPropagation(); }}
          />
        ) : (
          <span className={cx("line-clamp-2 break-words", d.text === "" && "opacity-60")} title={d.text}>{d.text === "" ? d.placeholder : d.text}</span>
        )}
      </div>
      {d.collapsed && !d.editing ? (
        <span data-mind-hidden="" aria-hidden="true" className="absolute -right-2 -top-2 rounded-[var(--radius-full)] bg-[var(--c-raised)] px-1.5 text-[length:var(--text-ui-small-size)] leading-4 text-[var(--c-text)] shadow-[var(--elevation-1)]">+{d.hidden}</span>
      ) : null}
    </div>
    {d.selected ? (
      <button
        type="button" data-mind-add={d.id} aria-label={d.addLabel} title={d.addLabel}
        onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }} onClick={(e) => { e.stopPropagation(); d.onAdd(d.id); }}
        style={{ pointerEvents: "all" }}
        className={cx(
          "nodrag nopan absolute top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-[var(--radius-full)] bg-[var(--c-raised)] text-[var(--c-text-muted)] shadow-[var(--elevation-1)] transition-colors duration-100 hover:bg-[var(--c-raised)] hover:text-[var(--c-text)] [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11",
          d.side === "right" ? "left-full ml-2" : "right-full mr-2",
        )}
      ><Icon name="create" size={14} /></button>
    ) : null}
    </div>
  );
});
const nodeTypes = { mind: MindNode };

type Drag = { id: string; branch: string[]; dx: number; dy: number } | null;

/** Líneas al padre en una capa propia (color `line` del hijo); durante un arrastre solo se mueven los extremos de la rama. */
const Lines = memo(function Lines({ tree, layout, drag }: { tree: Tree; layout: Map<string, { x: number; y: number }>; drag: Drag }) {
  const items: { key: string; d: string; color: string }[] = [];
  const inBranch = new Set(drag?.branch ?? []);
  const at = (id: string) => { const p = layout.get(id)!; return inBranch.has(id) ? { x: p.x + drag!.dx, y: p.y + drag!.dy } : p; };
  const walk = (n: TNode) => {
    if (n.collapsed) return;
    for (const c of n.children) {
      const a = at(n.id), b = at(c.id);
      const right = b.x >= a.x;
      const x1 = a.x + (right ? NODE_W / 2 : -NODE_W / 2), x2 = b.x + (right ? -NODE_W / 2 : NODE_W / 2), mx = (x1 + x2) / 2;
      items.push({ key: `${n.id}>${c.id}`, d: `M ${x1} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${x2} ${b.y}`, color: strokeFor(c.style?.line ?? "palette:gray") });
      walk(c);
    }
  };
  walk(tree.root);
  return (
    <SvgLayer width={1} height={1} unbounded>
      {items.map((i) => <path key={i.key} data-edge={i.key} d={i.d} fill="none" stroke={i.color} strokeWidth={1.5} strokeLinecap="round" />)}
    </SvgLayer>
  );
});

const parentIdOf = (n: TNode, id: string): string | null => (n.children.some((c) => c.id === id) ? n.id : n.children.reduce<string | null>((f, c) => f ?? parentIdOf(c, id), null));
const countAll = (n: TNode): number => n.children.reduce((sum, c) => sum + 1 + countAll(c), 0);
const branchIds = (n: TNode): string[] => [n.id, ...(n.collapsed ? [] : n.children.flatMap(branchIds))];

function Inner({ value, onChange }: { value: string; onChange: (data: string) => void }) {
  const { t } = useTranslation();
  const rf = useReactFlow();
  useFlowPageZoom();
  const zoom = useStore((s) => s.transform[2]);
  useStore((s) => s.transform); // la vista cambia al desplazar: reubica el menú y comprueba si el globo sigue a la vista
  const [gridPrefs] = useGridPrefs();
  const altHeld = useAltHeld();
  const snapOn = gridPrefs.snap && !altHeld;
  const snapRef = useRef(snapOn); snapRef.current = snapOn;
  const zoomRef = useRef(zoom); zoomRef.current = zoom;
  const box = useRef<HTMLDivElement>(null);
  const central = t("organizer.mindmap.central");
  const initial = useMemo(() => { const r = value.trim() === "" ? null : parseTree(value); return r && r.ok ? r.value : newTree(central); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const history = useRef(new Snapshots<Tree>(initial, serializeTree));
  const [tree, setTree] = useState<Tree>(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState<{ text: string; undo?: boolean } | null>(null);
  const [status, setStatus] = useState("");
  const [drag, setDrag] = useState<Drag>(null);
  const [recents, pushRecent] = useRecents();
  const lastSaved = useRef(value === "" ? "" : serializeTree(initial));
  const clip = useRef<TNode | null>(null);
  const [, bump] = useState(0);
  const animMs = matches("(prefers-reduced-motion: reduce)") ? 0 : 150;

  const commit = useCallback((next: Tree) => {
    history.current.push(next);
    treeRef.current = history.current.current; // las acciones encadenadas (guardar texto y agregar) leen ya el árbol nuevo
    setTree(history.current.current);
    const text = serializeTree(history.current.current);
    if (text !== lastSaved.current) { lastSaved.current = text; onChange(text); }
    bump((n) => n + 1);
  }, [onChange]);
  const apply = (next: Tree | null) => {
    if (!next) return;
    setTree(next); const text = serializeTree(next); lastSaved.current = text; onChange(text); bump((n) => n + 1);
    setSelected((s) => (s && findNode(next, s) ? s : null));
  };
  useEffect(() => {
    if (value === lastSaved.current || value === "") return;
    const r = parseTree(value);
    if (r.ok) { history.current = new Snapshots<Tree>(r.value, serializeTree); setTree(r.value); lastSaved.current = serializeTree(r.value); }
  }, [value]);

  const layout = useMemo(() => resolveTreeLayout(tree, "mindmap"), [tree]);
  const visible = useMemo(() => visibleNodes(tree), [tree]);
  const contentHeight = useMemo(() => { const ys = [...layout.values()].map((p) => p.y); return Math.max(...ys) - Math.min(...ys) + NODE_H + PAD * 2; }, [layout]);
  const treeRef = useRef(tree); treeRef.current = tree;
  const layoutRef = useRef(layout); layoutRef.current = layout;

  // --- texto del globo ---
  const finishEdit = useCallback(() => {
    setEditing((was) => was ? false : was);
  }, []);
  const commitDraft = useCallback((id: string, text: string) => {
    const n = findNode(treeRef.current, id);
    if (n && n.text !== text) commit(renameNode(treeRef.current, id, text));
  }, [commit]);
  const selectedRef = useRef(selected); selectedRef.current = selected;
  const addRef = useRef<(kind: "child" | "sibling", from?: string) => void>(() => undefined);
  const onAdd = useCallback((id: string) => addRef.current("child", id), []);
  const draftRef = useRef(draft); draftRef.current = draft;
  const editingRef = useRef(editing); editingRef.current = editing;
  const onCommit = useCallback(() => {
    const id = selectedRef.current; if (!id || !editingRef.current) return;
    commitDraft(id, draftRef.current); finishEdit();
  }, [commitDraft, finishEdit]);
  const deselect = useCallback(() => { setSelected(null); setEditing(false); setMenuOpen(false); }, []);
  const onEsc = useCallback(() => { onCommit(); setMenuOpen(false); deselect(); }, [onCommit, deselect]);

  const select = useCallback((id: string, edit: boolean) => {
    const prev = selectedRef.current;
    if (prev && prev !== id && editingRef.current) commitDraft(prev, draftRef.current);
    const n = findNode(treeRef.current, id);
    setSelected(id); setMenuOpen(true); setNotice(null);
    setStatus(t("mmap.selected", { text: n?.text || t("mmap.placeholder") }));
    if (edit) { setDraft(n?.text ?? ""); setEditing(true); } else setEditing(false);
  }, [commitDraft, t]);

  // --- arrastrar una rama (plan B del Hito 0: transformación directa, un solo commit al soltar) ---
  const setTransform = (ids: string[], dx: number, dy: number) => {
    for (const id of ids) { const el = box.current?.querySelector<HTMLElement>(`[data-mind-inner="${CSS.escape(id)}"]`); if (el) el.style.transform = dx === 0 && dy === 0 ? "" : `translate(${dx}px, ${dy}px)`; }
  };
  const onDown = useCallback((e: ReactPointerEvent, id: string) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("input")) return;
    e.stopPropagation();
    const sx = e.clientX, sy = e.clientY;
    const node = findNode(treeRef.current, id)!;
    const ids = branchIds(node), start = layoutRef.current.get(id)!;
    let moved = false, last = { dx: 0, dy: 0 };
    const target = (ev: PointerEvent) => {
      const raw = { x: start.x + (ev.clientX - sx) / zoomRef.current, y: start.y + (ev.clientY - sy) / zoomRef.current };
      if (!snapRef.current && !ev.altKey) return { dx: raw.x - start.x, dy: raw.y - start.y };
      const base = effectiveBase(treeRef.current, id), off = snapOffset(raw, base);
      return { dx: base.x + off.x - start.x, dy: base.y + off.y - start.y };
    };
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) <= DRAG_THRESHOLD) return;
      if (!moved) { moved = true; setMenuOpen(false); }
      last = ev.altKey || !snapRef.current ? { dx: (ev.clientX - sx) / zoomRef.current, dy: (ev.clientY - sy) / zoomRef.current } : target(ev);
      setTransform(ids, last.dx, last.dy);
      setDrag({ id, branch: ids, dx: last.dx, dy: last.dy });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      if (!moved) { select(id, true); return; }
      const t2 = target(ev);
      setTransform(ids, 0, 0); setDrag(null);
      const snap = snapRef.current && !ev.altKey;
      commit(moveBranch(treeRef.current, id, { x: start.x + (snap ? t2.dx : (ev.clientX - sx) / zoomRef.current), y: start.y + (snap ? t2.dy : (ev.clientY - sy) / zoomRef.current) }, { snap }));
      setSelected(id); setMenuOpen(true);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  }, [commit, select]);

  // --- nodos de la librería ---
  const label = useCallback((n: { id: string; text: string }) => `${n.text === "" ? t("mmap.placeholder") : n.text}${n.id === "root" ? ` (${t("mmap.root")})` : ""}`, [t]);
  const rootX = layout.get("root")?.x ?? 0;
  const nodes: Node<MindData>[] = useMemo(() => visible.map((v) => {
    const n = findNode(tree, v.id)!, p = layout.get(v.id)!;
    return {
      id: v.id, type: "mind", position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 }, width: NODE_W, height: NODE_H, draggable: false, selectable: false, focusable: false, connectable: false,
      data: { id: v.id, text: n.text, style: n.style, hasChildren: v.hasChildren, collapsed: v.collapsed, hidden: v.collapsed ? countAll(n) : 0, isRoot: v.id === "root", selected: v.id === selected, editing: editing && v.id === selected, draft, label: label(n), placeholder: t("mmap.placeholder"), editLabel: t("mmap.editText"), side: (layout.get(v.id)?.x ?? 0) < rootX ? "left" : "right", addLabel: t("mmap.quickAdd"), onAdd, onDown, onDraft: setDraft, onCommit, onEsc, onFocusNode: () => undefined },
    };
  }), [visible, tree, layout, rootX, selected, editing, draft, label, t, onDown, onCommit, onEsc, onAdd]);

  // --- vista ---
  const viewportSize = () => ({ w: box.current?.clientWidth ?? 800, h: box.current?.clientHeight ?? 400 });
  const fit = useCallback(() => {
    const xs = [...layoutRef.current.values()].map((p) => p.x), ys = [...layoutRef.current.values()].map((p) => p.y);
    const bw = Math.max(...xs) - Math.min(...xs) + NODE_W + PAD * 2, bh = Math.max(...ys) - Math.min(...ys) + NODE_H + PAD * 2;
    const s = viewportSize();
    const needed = Math.min(s.w / bw, s.h / bh);
    setNotice(needed < MIN_ZOOM ? { text: t("mmap.doesNotFit") } : null);
    void rf.fitView({ padding: 0.1, maxZoom: 1, minZoom: MIN_ZOOM, duration: animMs });
  }, [rf, animMs, t]);
  // Se encuadra el mapa completo al abrir y cada vez que cambia el ancho disponible (ventana, barra lateral o vista ampliada).
  const onWidth = useCallback((w: number) => {
    if (w <= 0) return;
    window.requestAnimationFrame(() => { void rf.fitView({ padding: 0.15, maxZoom: 1, minZoom: MIN_ZOOM }); });
  }, [rf]);

  /**
   * Si el globo queda fuera de lo que se ve, se vuelve a encuadrar: el mapa entero cuando cabe a un zoom legible
   * (sin acercar más de lo que ya estaba), y si no, se centra el globo sin tocar el zoom.
   */
  const reveal = (next: Tree, id: string) => {
    const all = resolveTreeLayout(next, "mindmap"), c = all.get(id), vp = rf.getViewport(), size = viewportSize();
    if (!c) return;
    const x = c.x * vp.zoom + vp.x, y = c.y * vp.zoom + vp.y, hw = (NODE_W / 2) * vp.zoom, hh = (NODE_H / 2) * vp.zoom;
    if (!(x - hw < 0 || x + hw > size.w || y - hh < 0 || y + hh > size.h)) return;
    const xs = [...all.values()].map((p) => p.x), ys = [...all.values()].map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const whole = Math.min(size.w / (maxX - minX + NODE_W + PAD * 2), size.h / (maxY - minY + NODE_H + PAD * 2));
    if (whole >= REVEAL_MIN_ZOOM) void rf.setCenter((minX + maxX) / 2, (minY + maxY) / 2, { zoom: Math.min(vp.zoom, whole), duration: animMs });
    else void rf.setCenter(c.x, c.y, { zoom: vp.zoom, duration: animMs });
  };

  // --- acciones del menú ---
  const current = selected ? findNode(tree, selected) : null;
  const addNew = (kind: "child" | "sibling", from?: string) => {
    const id = from ?? selectedRef.current;
    if (!id) return;
    // El texto que se estaba escribiendo se guarda antes, para que agregar no lo pierda.
    if (editingRef.current && selectedRef.current) commitDraft(selectedRef.current, draftRef.current);
    const base = treeRef.current;
    const r = kind === "child" ? addChild(base, id, "") : addSibling(base, id, "");
    if (!r.ok) { setNotice({ text: coreText(r.error.message) }); return; }
    const next = placeNewNode(r.value.tree, r.value.node.id);
    commit(next); setNotice(null); select(r.value.node.id, true); reveal(next, r.value.node.id);
  };
  addRef.current = addNew;
  const remove = (id: string) => {
    const r = deleteTreeNode(treeRef.current, id);
    if (!r.ok) return;
    const parent = parentIdOf(treeRef.current.root, id);
    commit(r.value.tree); deselect();
    setStatus(t("mmap.removedBranch", { count: r.value.removed }));
    if (r.value.removed > 1) setNotice({ text: t("mmap.removedBranch", { count: r.value.removed }), undo: true });
    if (parent) setSelected(parent);
  };
  const patchStyle = (key: keyof TStyle, v: string) => {
    if (!current) return;
    if (v.startsWith("#")) pushRecent(v);
    const r = setTreeNodeStyle(tree, current.id, key, v);
    if (r.ok) commit(r.value);
  };

  // Tras colocar los globos en el DOM se vuelve a medir el ancla del menú (su visibilidad se calcula al dibujar).
  useEffect(() => { const id = window.requestAnimationFrame(() => bump((n) => n + 1)); return () => window.cancelAnimationFrame(id); }, [selected, layout, menuOpen]);
  const menuAnchorEl = selected ? box.current?.querySelector<HTMLElement>(`[data-mind-id="${CSS.escape(selected)}"]`) ?? null : null;
  const frameArea = box.current ? box.current.getBoundingClientRect() : undefined;
  const st = current?.style ?? {};
  const low = current ? hasLowContrast(st.text ?? "palette:ink", st.fill ?? (current.id === "root" ? "palette:blue" : "palette:white"), 1, theme()) : false;
  const [colorKey, setColorKey] = useState<keyof TStyle | null>(null);
  const GHOST = "inline-flex h-8 items-center justify-center gap-1 rounded-[var(--radius-md)] px-2 text-[length:var(--text-ui-size)] text-[var(--c-text)] transition-colors duration-100 hover:bg-[var(--c-raised)] active:bg-[var(--c-border)] disabled:cursor-not-allowed disabled:text-[var(--c-text-disabled)] disabled:hover:bg-transparent aria-expanded:bg-[var(--c-raised)] [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:min-w-11";
  const SEP = <span aria-hidden="true" className="mx-0.5 h-5 w-px shrink-0 bg-[var(--c-border)]" />;
  const defaults: Record<keyof TStyle, string> = { fill: current?.id === "root" ? "palette:blue" : "palette:white", stroke: current?.id === "root" ? "palette:blue" : "palette:gray", text: "palette:ink", line: "palette:gray" };
  const colorKeys: (keyof TStyle)[] = current?.id === "root" ? ["fill", "stroke", "text"] : ["fill", "stroke", "text", "line"];
  const chip = (key: keyof TStyle) => {
    const v = st[key] ?? defaults[key];
    const paint = v === "none" ? "transparent" : key === "fill" ? fillFor(v) : strokeFor(v);
    return (
      <button key={key} type="button" className={GHOST} aria-label={t(`mmap.${key}`)} aria-expanded={colorKey === key} onClick={() => setColorKey((k) => (k === key ? null : key))}>
        <span aria-hidden="true" className="h-4 w-4 rounded-[var(--radius-full)] border border-[var(--c-border-control)]" style={{ background: paint }} />
        <span>{t(`mmap.${key}`)}</span>
      </button>
    );
  };
  const menuGroups: MenuGroup[] = !current ? [] : [
    { id: "structure", label: t("canvas.menu.structure"), hideLabel: true, children: (
      <>
        <button type="button" className={GHOST} aria-label={t("mmap.addChild")} title={t("mmap.addChildHint")} onClick={() => addNew("child")}><Icon name="addChild" size={16} /><span aria-hidden="true">{t("mmap.child")}</span></button>
        {current.id !== "root" && <button type="button" className={GHOST} aria-label={t("mmap.addSibling")} title={t("mmap.addSibling")} onClick={() => addNew("sibling")}><Icon name="create" size={16} /><span aria-hidden="true">{t("mmap.sibling")}</span></button>}
        {current.children.length > 0 && <>{SEP}<button type="button" className={GHOST} aria-label={current.collapsed ? t("mmap.expand") : t("mmap.collapse")} title={current.collapsed ? t("mmap.expand") : t("mmap.collapse")} onClick={() => commit(toggleCollapsed(tree, current.id))}><Icon name={current.collapsed ? "unfold" : "fold"} size={16} /></button></>}
        {current.id !== "root" && <>{SEP}<button type="button" className={cx(GHOST, "hover:text-[var(--c-danger)]")} aria-label={t("mmap.delete")} title={t("mmap.delete")} onClick={() => remove(current.id)}><Icon name="delete" size={16} /></button></>}
      </>
    ) },
    { id: "appearance", label: t("mmap.colors"), hideLabel: true, children: (
      <div className="flex w-full flex-col gap-1.5 border-t border-[var(--c-border)] pt-1.5">
        <div className="flex flex-wrap items-center gap-0.5">
          {colorKeys.map(chip)}
          {current.children.length > 0 && <>{SEP}<button type="button" className={GHOST} aria-label={t("mmap.applyBranch")} title={t("mmap.applyBranch")} onClick={() => { const r = applyStyleToBranch(tree, current.id); if (r.ok) commit(r.value); }}><Icon name="applyBranch" size={16} /></button></>}
        </div>
        {colorKey && colorKeys.includes(colorKey) ? (
          <div className="px-1 pb-1">
            <ColorPicker label={t(`mmap.${colorKey}`)} role={colorKey === "fill" ? "fill" : colorKey === "text" ? "text" : "stroke"} allowNone={colorKey === "fill" || colorKey === "stroke"} value={st[colorKey] ?? defaults[colorKey]} recents={recents} onChange={(v) => patchStyle(colorKey, v)} />
          </div>
        ) : null}
        {low && <p data-contrast-warning="" role="status" className="px-1 text-[length:var(--text-ui-small-size)] text-[var(--c-warning)]">{t("diagram.lowContrast")}</p>}
      </div>
    ) },
  ];

  // --- teclado (con el foco en un globo o en el lienzo; el campo de texto detiene sus propias teclas) ---
  const moveBy = (id: string, dx: number, dy: number) => {
    const c = layoutRef.current.get(id); if (!c) return;
    commit(moveBranch(treeRef.current, id, { x: c.x + dx, y: c.y + dy }, { snap: snapRef.current }));
  };
  const onKeyDown = (e: ReactKeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("input, select, textarea, [role=separator], [role=toolbar], [data-floating-menu]") || !target.closest("[data-mind-id], [role=application]")) return;
    const id = target.closest("[data-mind-id]")?.getAttribute("data-mind-id") ?? selected;
    const mod = e.ctrlKey || e.metaKey;
    const step = snapRef.current ? GRID * (e.shiftKey ? 5 : 1) : e.shiftKey ? 10 : 1;
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (id && e.key === "Enter") { e.preventDefault(); select(id, true); return; }
    if (id && arrows[e.key]) { e.preventDefault(); moveBy(id, ...arrows[e.key]!); return; }
    if (id && (e.key === "Delete" || e.key === "Backspace")) { if (id !== "root") { e.preventDefault(); remove(id); } return; }
    if (id && mod && e.key.toLowerCase() === "c") { e.preventDefault(); clip.current = branchClip(treeRef.current, id); return; }
    if (id && mod && e.key.toLowerCase() === "v" && clip.current) { e.preventDefault(); const r = pasteBranch(treeRef.current, id, clip.current, newId); if (r.ok) { commit(placeNewNode(r.value.tree, r.value.node.id)); } return; }
    if (mod) return;
    if (e.key === "+" || e.key === "=") { e.preventDefault(); void rf.zoomIn({ duration: animMs }); }
    else if (e.key === "-") { e.preventDefault(); void rf.zoomOut({ duration: animMs }); }
    else if (e.key === "0") { e.preventDefault(); void rf.zoomTo(1, { duration: animMs }); }
    else if (e.key.toLowerCase() === "f") { e.preventDefault(); fit(); }
  };

  return (
    <div onKeyDown={onKeyDown} contentEditable={false} className="w-full">
      <CanvasFrame
        testId="mindmap" label={t("mmap.canvas")} height={tree.view?.height} defaultHeight={defaultMapHeight(contentHeight)}
        onHeightChange={(h) => commit({ ...history.current.current, view: { height: h } })}
        onWidthChange={onWidth}
        toolbar={<button type="button" className={GHOST} aria-label={t("mmap.reflow")} title={t("mmap.reflow")} onClick={() => commit(reflowAuto(history.current.current))}><Icon name="reflow" size={16} /><span aria-hidden="true">{t("mmap.reflowShort")}</span></button>}
        zoom={{ level: zoom, min: MIN_ZOOM, max: MAX_ZOOM, onIn: () => void rf.zoomIn({ duration: animMs }), onOut: () => void rf.zoomOut({ duration: animMs }), onFit: fit, onReset: () => void rf.zoomTo(1, { duration: animMs }) }}
        history={{ canUndo: history.current.canUndo, canRedo: history.current.canRedo, onUndo: () => apply(history.current.undo()), onRedo: () => apply(history.current.redo()) }}
      >
        <div ref={box} className="vn-diagram relative h-full w-full" role="application" aria-label={t("mmap.canvas")}>
          <ReactFlow
            nodes={nodes} edges={[]} nodeTypes={nodeTypes} onlyRenderVisibleElements nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} nodesFocusable={false} zoomOnDoubleClick={false} zoomOnScroll={false}
            minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM} proOptions={{ hideAttribution: true }} onPaneClick={(e) => { if ((e.target as HTMLElement).closest("[data-mind-id]")) return; onCommit(); deselect(); }}
          >
            {gridPrefs.show ? <Background gap={GRID} /> : null}
            <ViewportPortal><Lines tree={tree} layout={layout} drag={drag} /></ViewportPortal>
          </ReactFlow>
        </div>
      </CanvasFrame>
      <p role="status" className="sr-only" data-mind-status="">{status}</p>
      {notice && <p role="status" data-mind-notice="" className="text-sm">{notice.text}{notice.undo ? <> <button type="button" className="underline" onClick={() => { apply(history.current.undo()); setNotice(null); }}>{t("mmap.undo")}</button></> : null}</p>}
      {current && menuAnchorEl ? (
        <FloatingMenu open={menuOpen && !drag} anchor={{ element: menuAnchorEl }} area={frameArea} label={t("canvas.menu.node")} regionLabel={t("organizer.nodePanel")} groups={menuGroups} minHeight={MENU_MIN_HEIGHT}
          onClose={() => { window.setTimeout(() => { onCommit(); setMenuOpen(false); }, 0); }} keepOpenOn={(el) => el.closest("[data-mind-id], [data-mind-add]") !== null} />
      ) : null}
    </div>
  );
}

/** Mapa mental sobre el lienzo compartido (spec 004): globos movibles con su rama, color por globo y rama, menú junto al globo. */
export function MindMapEditor(props: { value: string; onChange: (data: string) => void }) {
  return <ReactFlowProvider><Inner {...props} /></ReactFlowProvider>;
}
