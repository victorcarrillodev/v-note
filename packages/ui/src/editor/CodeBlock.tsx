import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { defaultBlockSpecs } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { CODE_LANGUAGES, findLanguage } from "./code/languages";
import { CODE_THEMES, useCodeTheme, type CodeThemeId } from "./code/codeTheme";
import "./code/code.css";
import { Dropdown } from "../components/ChoiceMenu";
import { RunOutput } from "../runner/RunOutput";
import { runnableLanguage, useRunner } from "../runner/RunnerContext";
import type { RunPhase, RunResult } from "../runner/types";

export { CODE_LANGUAGES };

type CodeBlockEditor = { updateBlock: (id: string, update: { props: { language: string } }) => void };
type CodeBlock = { id: string; props: { language: string } };

/** Copia texto al portapapeles; si la API moderna no está disponible usa la selección temporal. */
async function copyText(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // WebKit sin permiso de portapapeles: se intenta la alternativa.
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand("copy");
  } finally {
    area.remove();
  }
}

export function CodeBlockView({ block, editor, contentRef }: { block: CodeBlock; editor: CodeBlockEditor; contentRef: (node: HTMLElement | null) => void }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useCodeTheme();
  const codeRef = useRef<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attach = useCallback(
    (node: HTMLElement | null) => {
      codeRef.current = node;
      contentRef(node);
    },
    [contentRef],
  );

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = async () => {
    await copyText(codeRef.current?.textContent ?? "");
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };

  // Ejecución (JavaScript y Python): la salida vive solo en pantalla, no en el documento.
  const runner = useRunner();
  const [phase, setPhase] = useState<RunPhase | "idle">("idle");
  const [output, setOutput] = useState<RunResult | null>(null);
  const runnable = runnableLanguage(block.props.language);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []); // al desmontar, su ejecución no sigue ocupando la cola
  const run = async () => {
    const code = codeRef.current?.textContent ?? "";
    if (!runner || !runnable || code.trim() === "") return;
    const mine = new AbortController();
    abort.current = mine;
    setOutput(null);
    setPhase("running");
    let result: RunResult;
    try {
      result = await runner.run(runnable, code, { onPhase: setPhase, signal: mine.signal });
    } catch (e) {
      result = { ok: false, stdout: "", stderr: "", ms: 0, errorKey: "start", error: e instanceof Error ? e.message : String(e) };
    }
    if (abort.current === mine) abort.current = null;
    setPhase("idle");
    setOutput(result);
  };

  const found = findLanguage(block.props.language);
  const known = found !== undefined;
  const language = found ? found.value : block.props.language || "text";
  return (
    <div data-code-block className="w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--c-border)]">
      <div contentEditable={false} data-code-bar className="flex items-center justify-between gap-2 border-b border-[var(--c-border)] px-3 py-1">
        <div className="flex items-center gap-2">
        <Dropdown
          data-code-language=""
          aria-label={t("editor.codeLanguage")}
          value={language}
          onChange={(e) => editor.updateBlock(block.id, { props: { language: e.target.value } })}
          size="sm"
        >
          {CODE_LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.value === "text" ? t("editor.codeText") : l.label}</option>)}
          {!known && language !== "text" ? <option value={language}>{language}</option> : null}
        </Dropdown>
          <Dropdown
            data-code-theme-select=""
            aria-label={t("editor.codeTheme")}
            value={theme}
            onChange={(e) => setTheme(e.target.value as CodeThemeId)}
            size="sm"
          >
            {CODE_THEMES.map((th) => <option key={th.value} value={th.value}>{th.label}</option>)}
          </Dropdown>
        </div>
        <div className="flex items-center gap-2">
          {runner && runnable && (phase === "idle"
            ? <button type="button" data-run-code aria-label={t("editor.run.run")} onClick={() => void run()} className="rounded-[var(--radius-sm)] px-2 text-[length:var(--text-note-size)] font-semibold text-[var(--c-accent)] hover:bg-[var(--c-raised)]">{t("editor.run.run")}</button>
            : <>
                <span role="status" className="text-[length:var(--text-note-size)] text-[var(--c-text-muted)]">{phase === "loading" ? t("editor.run.loading", { language: findLanguage(runnable)?.label ?? runnable }) : t("editor.run.running")}</span>
                <button type="button" aria-label={t("editor.run.stop")} onClick={() => abort.current?.abort()} className="rounded-[var(--radius-sm)] px-2 text-[length:var(--text-note-size)] hover:bg-[var(--c-raised)]">{t("editor.run.stop")}</button>
              </>)}
          <button
            data-copy-code
            type="button"
            aria-label={t("editor.copyCode")}
            onClick={() => void copy()}
            className="rounded-[var(--radius-sm)] px-2 text-[length:var(--text-note-size)] opacity-80 hover:bg-[var(--c-raised)] hover:opacity-100"
          >
            {copied ? t("editor.copied") : t("editor.copy")}
          </button>
        </div>
      </div>
      <pre className="m-0 overflow-x-auto p-3 text-[length:var(--text-ui-small-size)] leading-[var(--text-ui-small-line)]">
        <code ref={attach} data-code-content spellCheck={false} className="block whitespace-pre font-[family-name:var(--font-mono)] " />
      </pre>
      {output && <RunOutput result={output} onClear={() => setOutput(null)} />}
    </div>
  );
}

const defaultCode = defaultBlockSpecs.codeBlock;

/** Bloque de código con lenguaje y copia (RF-5.6, U-163). Reemplaza al de BlockNote para añadir la cabecera. */
export const codeBlock = createReactBlockSpec(
  {
    type: "codeBlock",
    propSchema: { language: { default: "text" } },
    content: "plain",
    meta: defaultCode.implementation.meta,
  },
  {
    parse: defaultCode.implementation.parse,
    parseContent: defaultCode.implementation.parseContent,
    toExternalHTML: ({ block, contentRef }) => (
      <pre>
        <code ref={contentRef} className={`language-${block.props.language}`} data-language={block.props.language} />
      </pre>
    ),
    render: ({ block, editor, contentRef }) => <CodeBlockView block={block} editor={editor} contentRef={contentRef} />,
  },
);
