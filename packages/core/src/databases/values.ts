import { appError, err, ok, type Result } from "../result";
import { isValidHash } from "../assets/hash";
import { isValidLocal, validateRecurrence, type Recurrence } from "../tasks/recurrence";

export const PROPERTY_TYPES = [
  "text", "number", "select", "multi_select", "date", "checkbox", "url", "email", "phone", "files", "status",
  "created_time", "last_edited_time", "relation", "rollup", "formula",
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export type SelectOption = { id: string; name: string; color?: string };
export type PropertyConfig = {
  options?: SelectOption[];
  [key: string]: unknown;
};

export const STATUS_OPTIONS: SelectOption[] = [
  { id: "todo", name: "Por hacer" },
  { id: "in_progress", name: "En curso" },
  { id: "done", name: "Hecho" },
];

/** Fecha de una propiedad. `remind` (hora flotante) y `repeat` solo se usan cuando la propiedad es una tarea (RF-11). */
export type DateValue = { start: string; end?: string; remind?: string; repeat?: Recurrence };
export type FileRef = { hash: string; name: string; size: number };
export type CellValue = string | number | boolean | string[] | DateValue | FileRef[] | null;

export const defaultConfig = (type: PropertyType): PropertyConfig =>
  type === "status" ? { options: STATUS_OPTIONS.map((o) => ({ ...o })) } : type === "select" || type === "multi_select" ? { options: [] } : {};

/** Tipos cuyo valor se calcula y nunca se escribe a mano. */
export const COMPUTED_TYPES: ReadonlySet<PropertyType> = new Set(["created_time", "last_edited_time", "relation", "rollup", "formula"]);

const invalid = (message: string, reason: string) => err(appError("INVALID", message, { reason }));
const isBlank = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

/** `YYYY-MM-DD` o `YYYY-MM-DDTHH:mm` con fecha real (año bisiesto incluido). */
export function isValidDateString(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return false;
  if (m[4] !== undefined) return Number(m[4]) < 24 && Number(m[5]) < 60;
  return true;
}

const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const PHONE_CHARS = /^\+?[\d\s().-]+$/;

/** Valida y normaliza el valor de una celda; `null` significa «vacío» (la celda se borra). */
export function validateValue(type: PropertyType, config: PropertyConfig, raw: unknown): Result<CellValue> {
  if (COMPUTED_TYPES.has(type)) return invalid("Esta propiedad se calcula sola y no se puede editar", "READ_ONLY");
  if (type === "checkbox") {
    if (raw === null || raw === undefined) return ok(false);
    return typeof raw === "boolean" ? ok(raw) : invalid("Una casilla solo puede estar marcada o desmarcada", "TYPE");
  }
  if (isBlank(raw) && type !== "files" && type !== "multi_select") return ok(null);

  switch (type) {
    case "text":
      return typeof raw === "string" ? ok(raw) : invalid("El texto debe ser una cadena", "TYPE");
    case "number": {
      const n = typeof raw === "string" ? Number(raw.trim()) : raw;
      return typeof n === "number" && Number.isFinite(n) ? ok(n) : invalid("Escribe un número válido", "TYPE");
    }
    case "select":
    case "status": {
      if (typeof raw !== "string") return invalid("Elige una opción", "TYPE");
      const options = config.options ?? (type === "status" ? STATUS_OPTIONS : []);
      return options.some((o) => o.id === raw) ? ok(raw) : invalid("Esa opción no existe", "OPTION");
    }
    case "multi_select": {
      if (raw === null || raw === undefined) return ok(null);
      if (!Array.isArray(raw)) return invalid("Elige una lista de opciones", "TYPE");
      const options = config.options ?? [];
      const ids = new Set<string>();
      for (const v of raw) {
        if (typeof v !== "string" || !options.some((o) => o.id === v)) return invalid("Alguna opción no existe", "OPTION");
        ids.add(v);
      }
      const ordered = options.filter((o) => ids.has(o.id)).map((o) => o.id);
      return ok(ordered.length ? ordered : null);
    }
    case "date": {
      const o = typeof raw === "string" ? { start: raw } : raw;
      if (!o || typeof o !== "object" || Array.isArray(o)) return invalid("Fecha no válida", "TYPE");
      const { start, end, remind, repeat } = o as { start?: unknown; end?: unknown; remind?: unknown; repeat?: unknown };
      if (typeof start !== "string" || !isValidDateString(start)) return invalid("La fecha de inicio no es válida", "DATE");
      const out: DateValue = { start };
      if (end !== undefined && end !== null && end !== "") {
        if (typeof end !== "string" || !isValidDateString(end)) return invalid("La fecha de fin no es válida", "DATE");
        if (end < start) return invalid("La fecha de fin no puede ser anterior a la de inicio", "RANGE");
        out.end = end;
      }
      if (remind !== undefined && remind !== null && remind !== "") {
        if (typeof remind !== "string" || !isValidLocal(remind)) return invalid("La fecha del recordatorio no es válida", "REMIND");
        out.remind = remind;
      }
      if (repeat !== undefined && repeat !== null) {
        const r = validateRecurrence(repeat);
        if (!r.ok) return r;
        out.repeat = r.value;
      }
      return ok(out);
    }
    case "url": {
      if (typeof raw !== "string") return invalid("El enlace debe ser texto", "TYPE");
      const s = raw.trim();
      try {
        const u = new URL(s);
        if ((u.protocol !== "http:" && u.protocol !== "https:") || !u.hostname || /\s/.test(s)) return invalid("Solo se admiten enlaces http o https", "URL");
        return ok(s);
      } catch {
        return invalid("El enlace no es válido", "URL");
      }
    }
    case "email":
      return typeof raw === "string" && EMAIL.test(raw.trim()) ? ok(raw.trim()) : invalid("El correo no es válido", "EMAIL");
    case "phone": {
      if (typeof raw !== "string") return invalid("El teléfono debe ser texto", "TYPE");
      const s = raw.trim();
      const digits = s.replace(/\D/g, "").length;
      return PHONE_CHARS.test(s) && digits >= 7 && digits <= 15 ? ok(s) : invalid("El teléfono no es válido", "PHONE");
    }
    case "files": {
      if (raw === null || raw === undefined) return ok(null);
      if (!Array.isArray(raw)) return invalid("Los archivos deben ser una lista", "TYPE");
      const out: FileRef[] = [];
      const seen = new Set<string>();
      for (const f of raw) {
        const r = f as Partial<FileRef> | null;
        if (!r || typeof r.hash !== "string" || !isValidHash(r.hash)) return invalid("Un archivo tiene una referencia no válida", "FILE");
        if (typeof r.name !== "string" || r.name.trim() === "") return invalid("Un archivo necesita nombre", "FILE");
        if (typeof r.size !== "number" || !Number.isFinite(r.size) || r.size < 0) return invalid("Un archivo tiene un tamaño no válido", "FILE");
        const key = `${r.hash}\u0000${r.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ hash: r.hash, name: r.name, size: r.size });
      }
      return ok(out.length ? out : null);
    }
    default:
      return invalid("Tipo de propiedad sin validación", "TYPE");
  }
}
