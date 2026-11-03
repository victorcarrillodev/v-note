import { SvgLayer } from "../design/SvgLayer";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  NODE_H, NODE_W, addChild, addSibling, deleteTreeNode, findNode, layoutTree, moveTreeNode, newTree, parseTree, renameNode, serializeTree, toggleCollapsed, visibleNodes, type Tree,
  EVENT_H, EVENT_W, addEvent, deleteEvent, moveEvent, parseTimeline, placeEvents, renameEvent, serializeTimeline, sortedEvents, DAY_W, type Timeline,
  addCol, addItem, addRow, deleteCol, deleteItem, deleteRow, editItem, moveItem, parseMatrix, renameCol, renameRow, serializeMatrix, template2x2, type Matrix,
} from "@vnote/core";

/** Estado local de un organizador: se parte del texto guardado en el bloque, se guarda en cada cambio y se acepta un reemplazo externo. */
function useModel<T>(value: string, parse: (text: string) => { ok: true; value: T } | { ok: false }, fallback: () => T, serialize: (m: T) => string, onChange: (data: string) => void) {
  const initial = useMemo(() => { const r = parse(value); return r.ok ? r.value : fallback(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [model, setModel] = useState<T>(initial);
  const lastSaved = useRef(value === "" ? "" : serialize(initial));
  useEffect(() => {
    if (value === lastSaved.current || value === "") return;
    const r = parse(value);
    if (r.ok) { setModel(r.value); lastSaved.current = serialize(r.value); }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const commit = useCallback((next: T) => { setModel(next); const text = serialize(next);
 lastSaved.current = text; onChange(text); }, [onChange, serialize]);
  return [model, commit] as const;
}

/** Arrastre con puntero: avisa al soltar, con el elemento que quedó bajo el puntero (solo si se movió de verdad). */
function startDrag(e: ReactPointerEvent, onDrop: (dx: number, dy: number, under: Element | null) => void) {
  if (e.button !== 0) return;
  const sx = e.clientX, sy = e.clientY;
  let moved = false;
  const move = (ev: PointerEvent) => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 5) moved = true; };
  const up = (ev: PointerEvent) => {
    window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
    if (moved) onDrop(ev.clientX - sx, ev.clientY - sy, document.elementFromPoint(ev.clientX, ev.clientY));
  };
  window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
}

const box: CSSProperties = { border: "1px solid var(--c-border-control)", borderRadius: 6, background: "var(--c-card)", overflow: "auto", position: "relative" };
const panelStyle: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: 8, borderTop: "1px solid var(--c-border)" };

type Props = { value: string; onChange: (data: string) => void };

// ---------- Mapa mental y organigrama ----------
export function TreeEditor({ kind, value, onChange }: Props & { kind: "mindmap" | "orgchart" }) {
  const { t } = useTranslation();
  const central = t(kind === "mindmap" ? "organizer.mindmap.central" : "organizer.orgchart.central");
  const [tree, commit] = useModel<Tree>(value, (text) => (text.trim() === "" ? { ok: true, value: newTree(central) } : parseTree(text)), () => newTree(central), serializeTree, onChange);
  const [selected, setSelected] = useState<string>("root");
  const [notice, setNotice] = useState<string | null>(null);
  const layout = useMemo(() => layoutTree(tree, kind), [tree, kind]);
  const visible = useMemo(() => visibleNodes(tree), [tree]);
  const PAD = 20;
  const xs = [...layout.values()].map((p) => p.x), ys = [...layout.values()].map((p) => p.y);
  const minX = Math.min(...xs) - NODE_W / 2 - PAD, minY = Math.min(...ys) - NODE_H / 2 - PAD;
  const width = Math.max(...xs) + NODE_W / 2 + PAD - minX, height = Math.max(...ys) + NODE_H / 2 + PAD - minY;
  const pos = (id: string) => { const p = layout.get(id)!; return { left: p.x - minX - NODE_W / 2, top: p.y - minY - NODE_H / 2 }; };
  const parents = useMemo(() => {
    const out: [string, string][] = [];
    const walk = (n: Tree["root"]) => { if (n.collapsed) return; for (const c of n.children) { out.push([n.id, c.id]); walk(c); } };
    walk(tree.root);
    return out;
  }, [tree]);

  const current = findNode(tree, selected) ?? tree.root;
  const label = (id: string, text: string) => `${text === "" ? t("organizer.untitled") : text}${id === "root" ? ` (${t("organizer.rootRole")})` : ""}`;

  const act = (r: { ok: true; value: Tree } | { ok: false; error: { message: string } }) => { if (r.ok) { setNotice(null); commit(r.value); } else setNotice(r.error.message); };
  const onAddChild = () => {
 const r = addChild(tree, current.id, t("organizer.newNode")); if (r.ok) { setNotice(null); commit(r.value.tree); setSelected(r.value.node.id); } };
  const onAddSibling = () => { const r = addSibling(tree, current.id, t("organizer.newNode")); if (r.ok) { setNotice(null); commit(r.value.tree); setSelected(r.value.node.id); } else setNotice(r.error.message); };
  const onDelete = () => { const r = deleteTreeNode(tree, current.id); if (r.ok) { commit(r.value.tree); setSelected("root"); setNotice(t("organizer.removed", { count: r.value.removed })); } else setNotice(r.error.message); };
  const drop = (id: string, under: Element | null) => {
    const targetId = under?.closest("[data-node-id]")?.getAttribute("data-node-id");
    if (!targetId || targetId === id) return;
    act((() => { const r = moveTreeNode(tree, id, targetId, findNode(tree, targetId)?.children.length ?? 0); return r.ok ? r : { ok: false as const, error: r.error }; })());
    setSelected(id);
  };

  const nodeStyle = (id: string, active: boolean): CSSProperties => ({
    position: "absolute", ...pos(id), width: NODE_W, height: NODE_H, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    border: `2px solid ${active ? "var(--c-accent)" : "var(--c-text)"}`, borderRadius: kind === "mindmap" ? 999 : 4, background: id === "root" ? "var(--chip-info-bg)" : "var(--c-raised)", cursor: id === "root" ? "pointer" : "grab", font: "inherit", touchAction: "none",
  });

  return (
    <div data-testid={kind} aria-label={t(`organizer.${kind}.canvas`)} role="group" style={{ margin: "8px 0" }}>
      <div style={{ ...box, maxHeight: 420 }}>
        <div style={{ position: "relative", width, height }}>
          <SvgLayer width={width} height={height}>
            {parents.map(([a, b]) => {
              const pa = layout.get(a)!, pb = layout.get(b)!;
              return <line key={`${a}-${b}`} data-edge={`${a}>${b}`} x1={pa.x - minX} y1={pa.y - minY} x2={pb.x - minX} y2={pb.y - minY} stroke="var(--c-text-muted)" strokeWidth={2} />;
            })}
          </SvgLayer>
          {visible.map((n) => (
            <button key={n.id} type="button" data-node-id={n.id} data-depth={n.depth} aria-label={label(n.id, n.text)} aria-pressed={n.id === current.id}
              aria-expanded={n.hasChildren ? !n.collapsed : undefined} style={nodeStyle(n.id, n.id === current.id)}
              onClick={() => setSelected(n.id)} onPointerDown={(e) => { if (n.id !== "root") startDrag(e, (_dx, _dy, under) => drop(n.id, under)); }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{n.text}</span>{n.collapsed ? <span aria-hidden="true">{" +"}</span> : null}
            </button>
          ))}
        </div>
      </div>
      <div role="region" aria-label={t("organizer.nodePanel")} style={panelStyle}>
        <label>{t("organizer.text")}{" "}
          <input value={current.text} onChange={(e) => commit(renameNode(tree, current.id, e.target.value))} />
        </label>
        <button type="button" onClick={onAddChild}>{t("organizer.addChild")}</button>
        <button type="button" onClick={onAddSibling} disabled={current.id === "root"}>{t("organizer.addSibling")}</button>
        {current.children.length > 0 ? <button type="button" onClick={() => commit(toggleCollapsed(tree, current.id))}>{current.collapsed ? t("organizer.expand") : t("organizer.collapse")}</button> : null}
        <button type="button" onClick={onDelete} disabled={current.id === "root"}>{t("organizer.delete")}</button>
      </div>
      {notice ? <p role="status" style={{ margin: "4px 8px" }}>{notice}</p> : null}
    </div>
  );
}

// ---------- Línea de tiempo ----------
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export function TimelineEditor({ value, onChange }: Props) {
  const { t } = useTranslation();
  const [tl, commit] = useModel<Timeline>(value, parseTimeline, () => ({ events: [] }), serializeTimeline, onChange);
  const [date, setDate] = useState(""), [title, setTitle] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const placed = useMemo(() => placeEvents(tl), [tl]);
  const byId = useMemo(() => new Map(tl.events.map((e) => [e.id, e])), [tl]);
  const width = Math.max(300, ...placed.map((p) => p.x + EVENT_W + 20));
  const height = Math.max(60, ...placed.map((p) => p.y + EVENT_H + 20));
  const current = selected ? byId.get(selected) : undefined;
  const ordered = sortedEvents(tl);

  const onAdd = () => {
    const r = addEvent(tl, { date, title: title.trim() === "" ? t("organizer.newEvent") : title });
    if (!r.ok) { setNotice(t("organizer.timeline.invalidDate")); return; }
    setNotice(null); commit(r.value.timeline); setSelected(r.value.event.id); setTitle("");
  };
  const setDateOf = (id: string, d: string) => { const r = moveEvent(tl, id, d); if (r.ok) { setNotice(null); commit(r.value); } else setNotice(t("organizer.timeline.invalidDate")); };

  return (
    <div data-testid="timeline" role="group" aria-label={t("organizer.timeline.canvas")} style={{ margin: "8px 0" }}>
      <div style={panelStyle}>
        <label>{t("organizer.timeline.date")}{" "}<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label>{t("organizer.timeline.title")}{" "}<input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onAdd(); }} /></label>
        <button type="button" onClick={onAdd}>{t("organizer.timeline.add")}</button>
      </div>
      <div style={{ ...box, maxHeight: 320 }}>
        <ol style={{ position: "relative", width, height, margin: 0, padding: 0, listStyle: "none" }}>
          {ordered.map((ev) => {
            const p = placed.find((q) => q.id === ev.id)!;
            return (
              <li key={ev.id} style={{ position: "absolute", left: p.x + 10, top: p.y + 10, width: EVENT_W, height: EVENT_H }}>
                <button type="button" data-event-id={ev.id} data-date={ev.date} data-lane={p.lane} aria-pressed={ev.id === selected}
                  style={{ width: "100%", height: "100%", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", border: `2px solid ${ev.id === selected ? "var(--c-accent)" : "var(--c-text)"}`, borderRadius: 4, background: "var(--chip-warning-bg)", cursor: "grab", font: "inherit", touchAction: "none" }}
                  onClick={() => setSelected(ev.id)}
                  onPointerDown={(e) => startDrag(e, (dx) => { const days = Math.round(dx / DAY_W); if (days !== 0) { setSelected(ev.id); setDateOf(ev.id, addDays(ev.date, days)); } })}>
                  {ev.title} · {ev.date}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      {current ? (
        <div role="region" aria-label={t("organizer.timeline.panel")} style={panelStyle}>
          <label>{t("organizer.timeline.title")}{" "}<input value={current.title} onChange={(e) => commit(renameEvent(tl, current.id, e.target.value))} /></label>
          <label>{t("organizer.timeline.date")}{" "}<input type="date" value={current.date} onChange={(e) => { if (e.target.value) setDateOf(current.id, e.target.value); }} /></label>
          <button type="button" onClick={() => { commit(deleteEvent(tl, current.id)); setSelected(null); }}>{t("organizer.delete")}</button>
        </div>
      ) : null}
      {notice ? <p role="status" style={{ margin: "4px 8px" }}>{notice}</p> : null}
    </div>
  );
}

// ---------- Matriz ----------
export function MatrixEditor({ value, onChange }: Props) {
  const { t } = useTranslation();
  const [m, commit] = useModel<Matrix>(value, (text) => (text.trim() === "" ? { ok: true, value: template2x2() } : parseMatrix(text)), template2x2, serializeMatrix, onChange);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const add = (row: string, col: string) => {
    const key = `${row}|${col}`, text = (draft[key] ?? "").trim();
    if (text === "") return;
    const r = addItem(m, row, col, text);
    if (r.ok) { commit(r.value.matrix); setDraft((d) => ({ ...d, [key]: "" })); }
  };
  const remove = (r: { ok: true; value: { matrix: Matrix; removedItems: number } } | { ok: false; error: { message: string } }) => {
    if (r.ok) { commit(r.value.matrix); setNotice(r.value.removedItems > 0 ? t("organizer.matrix.removedItems", { count: r.value.removedItems }) : null); } else setNotice(r.error.message);
  };
  const drop = (itemId: string, under: Element | null) => {
    const cell = under?.closest("[data-cell]");
    const row = cell?.getAttribute("data-row"), col = cell?.getAttribute("data-col");
    if (!row || !col) return;
    const r = moveItem(m, itemId, row, col);
    if (r.ok) commit(r.value);
  };

  const cellStyle: CSSProperties = { border: "1px solid var(--c-border-control)", padding: 6, verticalAlign: "top", minWidth: 150, background: "var(--c-card)" };
  return (
    <div data-testid="matrix" role="group" aria-label={t("organizer.matrix.canvas")} style={{ margin: "8px 0" }}>
      <div style={{ ...box, maxHeight: 420 }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <td style={{ ...cellStyle, minWidth: 0 }} />
              {m.cols.map((c, i) => (
                <th key={c.id} scope="col" style={cellStyle}>
                  <input aria-label={t("organizer.matrix.colTitle", { n: i + 1 })} value={c.title} onChange={(e) => commit(renameCol(m, c.id, e.target.value))} />
                  <button type="button" aria-label={t("organizer.matrix.deleteCol", { n: i + 1 })} onClick={() => remove(deleteCol(m, c.id))}>✕</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {m.rows.map((r, ri) => (
              <tr key={r.id}>
                <th scope="row" style={cellStyle}>
                  <input aria-label={t("organizer.matrix.rowTitle", { n: ri + 1 })} value={r.title} onChange={(e) => commit(renameRow(m, r.id, e.target.value))} />
                  <button type="button" aria-label={t("organizer.matrix.deleteRow", { n: ri + 1 })} onClick={() => remove(deleteRow(m, r.id))}>✕</button>
                </th>
                {m.cols.map((c) => (
                  <td key={c.id} data-cell="" data-row={r.id} data-col={c.id} style={cellStyle}>
                    {m.items.filter((i) => i.row === r.id && i.col === c.id).map((i) => (
                      <div key={i.id} data-item-id={i.id} style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 4 }}>
                        <button type="button" aria-label={t("organizer.matrix.move", { text: i.text })} style={{ cursor: "grab", touchAction: "none" }} onPointerDown={(e) => startDrag(e, (_dx, _dy, under) => drop(i.id, under))}>⠿</button>
                        <input aria-label={t("organizer.matrix.item", { text: i.text })} value={i.text} onChange={(e) => commit(editItem(m, i.id, e.target.value))} />
                        <button type="button" aria-label={t("organizer.matrix.deleteItem", { text: i.text })} onClick={() => commit(deleteItem(m, i.id))}>✕</button>
                      </div>
                    ))}
                    <input aria-label={t("organizer.matrix.newItem", { row: r.title, col: c.title })} placeholder={t("organizer.matrix.newItemPlaceholder")} value={draft[`${r.id}|${c.id}`] ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, [`${r.id}|${c.id}`]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") add(r.id, c.id); }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={panelStyle}>
        <button type="button" onClick={() => { const r = addRow(m, ""); if (r.ok) commit(r.value); }}>{t("organizer.matrix.addRow")}</button>
        <button type="button" onClick={() => { const r = addCol(m, ""); if (r.ok) commit(r.value); }}>{t("organizer.matrix.addCol")}</button>
      </div>
      {notice ? <p role="status" style={{ margin: "4px 8px" }}>{notice}</p> : null}
    </div>
  );
}
