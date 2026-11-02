import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { readZip, type AssetStore, type Clock, type ImportKind, type ImportReport, type ReportItem, type SourceFile, type SqlStore } from "@vnote/core";
import { runImport, type ImportProgress } from "./runImport";

type Source = "folder" | "obsidian" | "notion";
type State =
  | { phase: "idle" }
  | { phase: "working"; progress: ImportProgress | null }
  | { phase: "done"; containerId: string; report: ImportReport }
  | { phase: "cancelled" }
  | { phase: "error"; message: string };

const readBytes = (f: Blob): Promise<Uint8Array> =>
  typeof f.arrayBuffer === "function"
    ? f.arrayBuffer().then((b) => new Uint8Array(b))
    : new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer)); r.onerror = () => reject(r.error); r.readAsArrayBuffer(f); });

/** Importar Markdown, una bóveda de Obsidian o el ZIP de Notion a una página contenedora nueva (RF-23). */
export function ImportView({ store, assets, clock, onOpen, parentId }: { store: SqlStore; assets: AssetStore; clock: Clock; onOpen: (pageId: string) => void; parentId?: string | null }) {
  const { t } = useTranslation();
  const [source, setSource] = useState<Source>("folder");
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<File[]>([]);
  const [state, setState] = useState<State>({ phase: "idle" });
  const abort = useRef<AbortController | null>(null);
  const isZip = source === "notion";

  const start = async () => {
    const ac = new AbortController();
    abort.current = ac;
    setState({ phase: "working", progress: null });
    try {
      let files: SourceFile[];
      let title = name.trim();
      if (isZip) {
        const zip = readZip(await readBytes(picked[0]!));
        if (!zip.ok) { setState({ phase: "error", message: zip.error.message }); return; }
        files = zip.value;
        title ||= picked[0]!.name.replace(/\.zip$/i, "");
      } else {
        const withPath = picked.map((f) => ({ f, rel: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name }));
        const root = withPath[0]?.rel.includes("/") ? withPath[0]!.rel.split("/")[0]! : "";
        title ||= root || t("import.defaultName");
        files = await Promise.all(withPath.map(async ({ f, rel }) => ({ path: root && rel.startsWith(`${root}/`) ? rel.slice(root.length + 1) : rel, data: await readBytes(f) })));
      }
      const kind: ImportKind = source === "obsidian" ? "obsidian" : source === "notion" ? "notion" : "markdown";
      const out = await runImport({ store, assets, clock, files, kind, name: title, ...(parentId !== undefined ? { parentId } : {}), signal: ac.signal, onProgress: (progress) => setState({ phase: "working", progress }) });
      if (out.status === "done") setState({ phase: "done", containerId: out.containerId, report: out.report });
      else if (out.status === "cancelled") setState({ phase: "cancelled" });
      else setState({ phase: "error", message: out.message });
    } catch (e) {
      setState({ phase: "error", message: e instanceof Error ? e.message : String(e) });
    }
  };

  const working = state.phase === "working";
  return (
    <section aria-label={t("import.title")} className="flex max-w-3xl flex-col gap-3 p-4">
      <h1 className="text-xl font-semibold">{t("import.title")}</h1>
      <p className="text-sm opacity-80">{t("import.intro")}</p>
      <label className="flex flex-col gap-1">{t("import.source")}
        <select value={source} disabled={working} onChange={(e) => { setSource(e.target.value as Source); setPicked([]); }} className="rounded border px-2 py-1">
          <option value="folder">{t("import.sources.folder")}</option>
          <option value="obsidian">{t("import.sources.obsidian")}</option>
          <option value="notion">{t("import.sources.notion")}</option>
        </select>
      </label>
      {isZip ? (
        <label className="flex flex-col gap-1">{t("import.zip")}
          <input type="file" accept=".zip,application/zip" disabled={working} onChange={(e) => setPicked([...(e.target.files ?? [])])} />
        </label>
      ) : (
        <label className="flex flex-col gap-1">{t("import.folder")}
          <input type="file" multiple disabled={working} {...({ webkitdirectory: "" } as Record<string, string>)} onChange={(e) => setPicked([...(e.target.files ?? [])])} />
        </label>
      )}
      <label className="flex flex-col gap-1">{t("import.containerName")}
        <input value={name} disabled={working} placeholder={t("import.defaultName")} onChange={(e) => setName(e.target.value)} className="rounded border px-2 py-1" />
      </label>
      <div className="flex gap-2">
        <button type="button" disabled={working || picked.length === 0} onClick={() => void start()}>{t("import.start")}</button>
        {working && <button type="button" onClick={() => abort.current?.abort()}>{t("import.cancel")}</button>}
      </div>

      {state.phase === "working" && (
        <div>
          <p role="status">{state.progress ? t(state.progress.phase === "analyze" ? "import.analyzing" : "import.saving", { done: state.progress.done, total: state.progress.total }) : t("import.reading")}</p>
          <progress aria-label={t("import.progress")} value={state.progress?.done ?? 0} max={Math.max(1, state.progress?.total ?? 1)} aria-valuemax={Math.max(1, state.progress?.total ?? 1)} aria-valuenow={state.progress?.done ?? 0} role="progressbar" className="w-full" />
        </div>
      )}
      {state.phase === "cancelled" && <p role="status">{t("import.cancelled")}</p>}
      {state.phase === "error" && <p role="alert" className="rounded border border-red-500 bg-red-50 p-2 text-red-900">{state.message}</p>}
      {state.phase === "done" && <Report report={state.report} onOpen={() => onOpen(state.containerId)} />}
    </section>
  );
}

function Report({ report, onOpen }: { report: ImportReport; onOpen: () => void }) {
  const { t } = useTranslation();
  const sections: [string, ReportItem[]][] = [
    [t("import.report.imported"), report.imported], [t("import.report.approximated"), report.approximated],
    [t("import.report.omitted"), report.omitted], [t("import.report.broken"), report.brokenLinks],
  ];
  return (
    <section role="region" aria-label={t("import.report.title")} className="flex flex-col gap-2 rounded border p-3">
      <h2 className="font-semibold">{t("import.report.title")}</h2>
      {sections.map(([label, items]) => (
        <details key={label} open={items.length > 0 && label !== sections[0]![0]}>
          <summary>{label} ({items.length})</summary>
          <ul className="ml-4 list-disc text-sm">{items.map((i, n) => <li key={n}><code>{i.path}</code>: {i.message}</li>)}</ul>
        </details>
      ))}
      <button type="button" className="self-start" onClick={onOpen}>{t("import.open")}</button>
    </section>
  );
}
