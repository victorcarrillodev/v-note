import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dropdown } from "../components/ChoiceMenu";
import { Button } from "../components/Button";
import { Icon } from "../design/Icon";
import "./study.css";

/** Puntos de partida para cada tipo de diagrama. */
export const MERMAID_EXAMPLES = {
  flow: "graph TD\n  A[Inicio] --> B{¿Condición?}\n  B -- Sí --> C[Procesar]\n  B -- No --> D[Fin]",
  sequence: "sequenceDiagram\n  Cliente->>Servidor: Petición\n  Servidor-->>Cliente: Respuesta",
  classes: "classDiagram\n  class Pila {\n    +push(x)\n    +pop()\n  }",
  states: "stateDiagram-v2\n  [*] --> Pendiente\n  Pendiente --> Hecho\n  Hecho --> [*]",
} as const;

type Drawing = { svg: string } | { error: string } | null;
const REDRAW_MS = 300;

/** Mermaid se descarga solo cuando hay un diagrama que dibujar. `strict`: sin scripts ni HTML del usuario. */
async function draw(id: string, code: string, dark: boolean): Promise<string> {
  const { default: mermaid } = await import("mermaid");
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: dark ? "dark" : "default" });
  await mermaid.parse(code); // con un error de sintaxis, `render` dejaría restos en el documento
  return (await mermaid.render(id, code)).svg;
}

/** Diagrama escrito como texto (Mermaid): dibujo arriba y código editable. */
export function MermaidView({ code, editable, onChange, render = draw }: { code: string; editable: boolean; onChange: (code: string) => void; render?: typeof draw }) {
  const { t } = useTranslation();
  const id = `vn-mermaid-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [draft, setDraft] = useState(code);
  const [editing, setEditing] = useState(code.trim() === "");
  const [drawing, setDrawing] = useState<Drawing>(null);
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === "dark");
  useEffect(() => setDraft(code), [code]);
  const change = (value: string) => { setDraft(value); onChange(value); };
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => setDark(document.documentElement.dataset.theme === "dark"));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (draft.trim() === "") { setDrawing(null); return; }
    let alive = true;
    const timer = setTimeout(() => {
      render(id, draft, dark).then((svg) => { if (alive) setDrawing({ svg }); }, (e: unknown) => { if (alive) setDrawing({ error: e instanceof Error ? e.message : String(e) }); });
    }, REDRAW_MS);
    return () => { alive = false; clearTimeout(timer); };
  }, [draft, dark, id, render]);
  return (
    <div className="vn-study" contentEditable={false}>
      <div className="vn-study-head">
        <Icon name="graph" size={16} /><strong>{t("study.mermaid.slash")}</strong>
        {editable && (
          <>
            {/* Los ejemplos solo se ofrecen con el bloque vacío o recién abierto: nunca pisan código sin querer. */}
            {editing && draft.trim() === "" && (
              <Dropdown aria-label={t("study.mermaid.example")} value="" onChange={(e) => { const k = e.target.value as keyof typeof MERMAID_EXAMPLES; if (MERMAID_EXAMPLES[k]) change(MERMAID_EXAMPLES[k]); }}>
                <option value="">{t("study.mermaid.example")}</option>
                {Object.keys(MERMAID_EXAMPLES).map((k) => <option key={k} value={k}>{t(`study.mermaid.${k}`)}</option>)}
              </Dropdown>
            )}
            <Button size="sm" variant="ghost" aria-expanded={editing} onClick={() => setEditing((v) => !v)}>{editing ? t("study.mermaid.hide") : t("study.mermaid.show")}</Button>
          </>
        )}
      </div>
      <div className="vn-study-body">
        {drawing && "svg" in drawing && <div className="vn-mermaid flex justify-center overflow-x-auto" data-testid="mermaid-drawing" dangerouslySetInnerHTML={{ __html: drawing.svg }} />}
        {drawing && "error" in drawing && <p role="alert" className="whitespace-pre-wrap text-[length:var(--text-ui-small-size)] text-[var(--c-danger)]">{t("study.mermaid.error")} {drawing.error}</p>}
        {draft.trim() === "" && <p className="text-center text-[length:var(--text-ui-small-size)] text-[var(--c-text-muted)]">{t("study.mermaid.empty")}</p>}
        {editable && editing && (
          <textarea
            rows={Math.min(16, Math.max(5, draft.split("\n").length))} spellCheck={false} aria-label={t("study.mermaid.source")} placeholder={"graph TD\n  A --> B"} className="vn-study-source vn-study-mono" value={draft}
            onChange={(e) => change(e.target.value)} onKeyDown={(e) => e.stopPropagation()}
          />
        )}
      </div>
    </div>
  );
}
