import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { defaultBlockSpecs } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";

/** Lenguajes ofrecidos en la cabecera del bloque de código (U-163). */
export const CODE_LANGUAGES = [
  { value: "text", label: "Texto" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "bash", label: "Bash" },
  { value: "json", label: "JSON" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "sql", label: "SQL" },
  { value: "markdown", label: "Markdown" },
] as const;

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

  const known = CODE_LANGUAGES.some((l) => l.value === block.props.language);
  const language = known ? block.props.language : block.props.language || "text";
  return (
    <div data-code-block className="w-full overflow-hidden rounded-md border border-[var(--c-border)] bg-[var(--c-raised)]">
      <div contentEditable={false} className="flex items-center justify-between gap-2 border-b border-[var(--c-border)] px-3 py-1">
        <select
          data-code-language
          aria-label={t("editor.codeLanguage")}
          value={language}
          onChange={(e) => editor.updateBlock(block.id, { props: { language: e.target.value } })}
          className="rounded border border-[var(--c-border)] bg-[var(--c-card)] px-1 text-[length:var(--text-note-size)] text-[var(--c-text)]"
        >
          {CODE_LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.value === "text" ? t("editor.codeText") : l.label}</option>)}
          {!known && language !== "text" ? <option value={language}>{language}</option> : null}
        </select>
        <button
          data-copy-code
          type="button"
          aria-label={t("editor.copyCode")}
          onClick={() => void copy()}
          className="rounded px-2 text-[length:var(--text-note-size)] text-[var(--c-text-muted)] hover:bg-[var(--c-card)] hover:text-[var(--c-text)]"
        >
          {copied ? t("editor.copied") : t("editor.copy")}
        </button>
      </div>
      <pre className="m-0 overflow-x-auto p-3 text-[length:var(--text-ui-small-size)] leading-[var(--text-ui-small-line)]">
        <code ref={attach} data-code-content className="block whitespace-pre font-[family-name:var(--font-mono)] text-[var(--c-text)]" />
      </pre>
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
