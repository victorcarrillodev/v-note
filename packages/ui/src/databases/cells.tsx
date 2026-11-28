import { coreText } from "../i18n/coreText";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { COMPUTED_TYPES, type CellValue, type DateValue, type ErrorValue, type Property, type Result } from "@vnote/core";
import { Checkbox } from "../components/controls";
import { Dropdown } from "../components/ChoiceMenu";
import { DateInput } from "../components/DateInput";
import { INPUT } from "../components/formStyles";

export type CellProps = {
  prop: Property;
  value: CellValue | ErrorValue | null | undefined;
  /** Devuelve el resultado de guardar (con el error del núcleo si el valor no es válido). */
  onCommit: (raw: unknown) => Promise<Result<unknown>>;
};

const isError = (v: unknown): v is ErrorValue => typeof v === "object" && v !== null && "error" in v;

/** Texto para mostrar un valor (también el de las propiedades calculadas). */
export function useFormatValue() {
  const { t } = useTranslation();
  return (prop: Property, v: CellValue | ErrorValue | null | undefined): string => {
    if (isError(v)) return `⚠ ${coreText(v.error.message)}`;
    if (v === null || v === undefined) return prop.type === "rollup" || prop.type === "relation" ? "" : "";
    if (prop.type === "checkbox") return v === true ? t("databases.checked") : t("databases.unchecked");
    if (prop.type === "relation") return Array.isArray(v) ? t("databases.linked", { count: v.length }) : "";
    if (prop.type === "files") return Array.isArray(v) ? (v as { name: string }[]).map((f) => f.name).join(", ") : "";
    if (prop.type === "select" || prop.type === "status") return prop.config.options?.find((o) => o.id === v)?.name ?? String(v);
    if (prop.type === "multi_select") return Array.isArray(v) ? v.map((id) => prop.config.options?.find((o) => o.id === id)?.name ?? id).join(", ") : "";
    if (typeof v === "object" && !Array.isArray(v) && "start" in v) { const d = v as DateValue; return d.end ? `${d.start} → ${d.end}` : d.start; }
    if (typeof v === "boolean") return v ? t("databases.checked") : t("databases.unchecked");
    return String(v);
  };
}

function ErrorNote({ message }: { message: string | null }) {
  return message ? <span role="alert" className="block text-xs text-[var(--c-danger)]">{message}</span> : null;
}

/** Editor de una celda según el tipo de la propiedad (RF-22). Las propiedades calculadas son de solo lectura. */
export function CellEditor({ prop, value, onCommit }: CellProps) {
  const { t } = useTranslation();
  const format = useFormatValue();
  const [draft, setDraft] = useState<string>(typeof value === "number" || typeof value === "string" ? String(value) : "");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Se sincroniza con el valor guardado, salvo que la persona esté escribiendo justo ahora en este campo
  useEffect(() => { if (document.activeElement !== inputRef.current) setDraft(typeof value === "number" || typeof value === "string" ? String(value) : ""); }, [value]);

  const commit = async (raw: unknown) => {
    const r = await onCommit(raw);
    setError(r.ok ? null : (r.error as { message: string }).message);
    return r.ok;
  };

  if (COMPUTED_TYPES.has(prop.type)) {
    return <span className={isError(value) ? "text-[var(--c-danger)]" : ""} title={isError(value) ? coreText(value.error.message) : undefined}>{format(prop, value)}</span>;
  }

  switch (prop.type) {
    case "checkbox":
      return <Checkbox ariaLabel={prop.name} checked={value === true} onChange={(v) => void commit(v)} />;
    case "select":
    case "status":
      return (
        <>
          <Dropdown aria-label={prop.name} value={typeof value === "string" ? value : ""} onChange={(e) => void commit(e.target.value === "" ? null : e.target.value)} className="w-full">
            <option value="">{t("databases.noValue")}</option>
            {(prop.config.options ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Dropdown>
          <ErrorNote message={error} />
        </>
      );
    case "multi_select": {
      const current = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div role="group" aria-label={prop.name} className="flex flex-wrap gap-2">
          {(prop.config.options ?? []).map((o) => (
            <Checkbox key={o.id} className="text-sm" label={o.name} checked={current.includes(o.id)} onChange={(v) => void commit(v ? [...current, o.id] : current.filter((x) => x !== o.id))} />
          ))}
        </div>
      );
    }
    case "date": {
      const d = value && typeof value === "object" && "start" in value ? (value as DateValue) : null;
      const asTask = prop.config.asTask === true;
      return (
        <>
          <DateInput
            type={d?.start?.includes("T") ? "datetime-local" : "date"}
            aria-label={t("databases.startDate", { name: prop.name })}
            value={d?.start ?? ""}
            onChange={(e) => void commit(e.target.value === "" ? null : { ...(d ?? {}), start: e.target.value })}
          />
          {asTask && (
            <div className="mt-1 flex flex-col gap-1 text-xs">
              <DateInput type="datetime-local" disabled={!d} aria-label={t("databases.remindAt", { name: prop.name })} value={d?.remind ?? ""} onChange={(e) => { if (!d) return; const { remind: _r, ...rest } = d; void commit(e.target.value === "" ? rest : { ...rest, remind: e.target.value }); }} />
              <Dropdown aria-label={t("task.repeat")} disabled={!d} value={d?.repeat?.freq ?? ""} onChange={(e) => { if (!d) return; const { repeat: _p, ...rest } = d; void commit(e.target.value === "" ? rest : { ...rest, repeat: { freq: e.target.value, interval: 1 } }); }}>
                <option value="">{t("task.never")}</option><option value="daily">{t("task.daily")}</option><option value="weekly">{t("task.weekly")}</option><option value="monthly">{t("task.monthly")}</option><option value="yearly">{t("task.yearly")}</option>
              </Dropdown>
            </div>
          )}
          <ErrorNote message={error} />
        </>
      );
    }
    case "files":
      return <span>{format(prop, value)}</span>;
    default: // texto, número, enlace, correo, teléfono
      return (
        <>
          <input
            ref={inputRef}
            type="text"
            inputMode={prop.type === "number" ? "decimal" : undefined}
            aria-label={prop.name}
            value={draft}
            aria-invalid={error ? true : undefined}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => { const cur = typeof value === "number" || typeof value === "string" ? String(value) : ""; const typed = e.currentTarget.value; /* se lee del campo: el borrador puede ir un render por detrás si se pulsa Enter justo al escribir */ if (typed !== cur) void commit(typed); }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            className="w-full"
          />
          <ErrorNote message={error} />
        </>
      );
  }
}
