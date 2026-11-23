/**
 * Extensión de ProseMirror para los bloques de código: resaltado por gramática (decoraciones, el texto no cambia)
 * y autocompletado con una lista flotante. El contenido sigue siendo texto plano del documento (Yjs, exportación y
 * búsqueda no cambian).
 */
import { createExtension } from "@blocknote/core";
import { Plugin, PluginKey, TextSelection, type EditorState } from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";
import type { Node as PMNode } from "prosemirror-model";
import { completionsFor, type Completion } from "./complete";
import { ensureLanguage, isReady, tokenize, type Token } from "./tokenize";
import { findLanguage } from "./languages";
import { backspaceEdit, enterEdit, typedEdit, type Edit } from "./pairs";

const BLOCK = "codeBlock";
const key = new PluginKey<DecorationSet>("vn-code");
const cache = new WeakMap<PMNode, { lang: string; tokens: Token[] }>();

function tokensOf(node: PMNode): Token[] {
  const lang = String(node.attrs.language ?? "text");
  const hit = cache.get(node);
  if (hit && hit.lang === lang) return hit.tokens;
  const text = node.textContent;
  const tokens = text.length === node.content.size ? tokenize(text, lang) : [];
  // Solo se guarda si la gramática ya estaba lista; si no, se vuelve a calcular al cargarla.
  if (isReady(findLanguage(lang))) cache.set(node, { lang, tokens });
  return tokens;
}

function decorate(doc: PMNode, request: (lang: string) => void): DecorationSet {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== BLOCK) return true;
    const lang = String(node.attrs.language ?? "text");
    if (!isReady(findLanguage(lang))) request(lang);
    for (const t of tokensOf(node)) decos.push(Decoration.inline(pos + 1 + t.from, pos + 1 + t.to, { class: t.cls }));
    return false;
  });
  return DecorationSet.create(doc, decos);
}

/** Bloque de código donde está el cursor (sin selección), con el texto y el cursor relativo. */
function cursorInCode(state: EditorState): { node: PMNode; start: number; offset: number } | null {
  const { $from, empty } = state.selection;
  if (!empty || $from.parent.type.name !== BLOCK) return null;
  return { node: $from.parent, start: $from.start(), offset: $from.parentOffset };
}

class Popup {
  private el: HTMLDivElement | null = null;
  items: Completion[] = [];
  index = 0;
  constructor(private readonly label: string) {}
  get open(): boolean { return this.el !== null; }
  show(view: EditorView, items: Completion[], at: number, onPick: (i: number) => void): void {
    this.items = items;
    this.index = Math.min(this.index, items.length - 1);
    const doc = view.dom.ownerDocument;
    if (!this.el) {
      this.el = doc.createElement("div");
      this.el.className = "vn-code-complete";
      this.el.setAttribute("role", "listbox");
      this.el.setAttribute("aria-label", this.label);
      doc.body.appendChild(this.el);
    }
    const rect = view.coordsAtPos(at);
    this.el.style.left = `${Math.round(rect.left)}px`;
    this.el.style.top = `${Math.round(rect.bottom + 4)}px`;
    this.el.replaceChildren(...items.map((it, i) => {
      const row = doc.createElement("div");
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", String(i === this.index));
      row.className = "vn-code-complete-item";
      row.dataset.kind = it.kind;
      row.textContent = it.label;
      row.addEventListener("mousedown", (e) => { e.preventDefault(); onPick(i); });
      return row;
    }));
    this.el.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: "nearest" });
  }
  move(delta: number): void {
    if (!this.el) return;
    this.index = (this.index + delta + this.items.length) % this.items.length;
    this.el.querySelectorAll("[role=option]").forEach((n, i) => n.setAttribute("aria-selected", String(i === this.index)));
  }
  hide(): void { this.el?.remove(); this.el = null; this.index = 0; }
}

/** Crea la extensión; `label` es el nombre accesible de la lista de sugerencias (texto de la interfaz). */
export function codeExtension(label: string) {
  const popup = new Popup(label);
  let dismissedAt = -1;
  let explicit = false;
  let viewRef: EditorView | null = null;
  // Pide cargar la gramática y, al llegar, vuelve a pintar los bloques de ese lenguaje.
  const request = (lang: string): void => {
    void ensureLanguage(lang).then(() => { const v = viewRef; if (v && v.dom.isConnected) v.dispatch(v.state.tr.setMeta(key, true)); });
  };

  const refresh = (view: EditorView): void => {
    const cur = cursorInCode(view.state);
    if (!cur) return popup.hide();
    const text = cur.node.textContent;
    const abs = cur.start + cur.offset;
    if (dismissedAt === abs) return popup.hide();
    const items = completionsFor(String(cur.node.attrs.language ?? "text"), text, cur.offset, explicit);
    if (items.length === 0) return popup.hide();
    popup.show(view, items, abs, (i) => accept(view, i));
  };

  const accept = (view: EditorView, i: number): void => {
    const cur = cursorInCode(view.state);
    const item = popup.items[i];
    if (!cur || !item) return popup.hide();
    const abs = cur.start + cur.offset;
    popup.hide();
    view.dispatch(view.state.tr.insertText(item.label, abs - item.replace, abs));
    view.focus();
  };

  /** Aplica una edición relativa al bloque (texto + cursor) como una sola transacción. */
  const apply = (view: EditorView, start: number, e: Edit): true => {
    const tr = view.state.tr.insertText(e.text, start + e.from, start + e.to);
    view.dispatch(tr.setSelection(TextSelection.create(tr.doc, start + e.cursor)));
    return true;
  };
  const langOf = (node: PMNode): string => String(node.attrs.language ?? "text");

  const plugin = new Plugin<DecorationSet>({
    key,
    state: {
      init: (_, state) => decorate(state.doc, request),
      apply: (tr, old) => (tr.docChanged || tr.getMeta(key) ? decorate(tr.doc, request) : old),
    },
    props: {
      decorations: (state) => key.getState(state),
      handleTextInput(view, from, to, text) {
        const $f = view.state.doc.resolve(from);
        if ($f.parent.type.name !== BLOCK || !view.state.doc.resolve(to).sameParent($f)) return false;
        const start = $f.start();
        const e = typedEdit($f.parent.textContent, from - start, to - start, text, langOf($f.parent));
        return e ? apply(view, start, e) : false;
      },
      handleKeyDown(view, event) {
        if (event.key === " " && (event.ctrlKey || event.metaKey) && cursorInCode(view.state)) {
          explicit = true; dismissedAt = -1; refresh(view); explicit = false;
          return popup.open;
        }
        if (!popup.open) {
          const cur = cursorInCode(view.state);
          if (!cur || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false;
          const text = cur.node.textContent;
          const e = event.key === "Backspace" ? backspaceEdit(text, cur.offset, langOf(cur.node)) : event.key === "Enter" ? enterEdit(text, cur.offset, langOf(cur.node)) : null;
          return e ? apply(view, cur.start, e) : false;
        }
        if (event.key === "ArrowDown") { popup.move(1); return true; }
        if (event.key === "ArrowUp") { popup.move(-1); return true; }
        if (event.key === "Enter" || event.key === "Tab") { accept(view, popup.index); return true; }
        if (event.key === "Escape") {
          const cur = cursorInCode(view.state);
          dismissedAt = cur ? cur.start + cur.offset : -1;
          popup.hide();
          return true;
        }
        return false;
      },
      handleDOMEvents: { blur: () => { popup.hide(); return false; } },
    },
    view(view) {
      viewRef = view;
      return {
        update(v, prev) {
          if (v.state.doc !== prev.doc) { dismissedAt = -1; refresh(v); }
          else if (!v.state.selection.eq(prev.selection)) popup.hide();
        },
        destroy() { popup.hide(); viewRef = null; },
      };
    },
  });

  return createExtension({ key: "vnCode", prosemirrorPlugins: [plugin] });
}
