import { appError, err, ok, type Result } from "../result";

/** Lo mínimo de `fetch` que usa la consulta (se inyecta: navegador, Tauri o pruebas). */
export type UpdateFetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ status: number; json(): Promise<unknown> }>;
export type UpdateInfo = { available: false } | { available: true; version: string; url: string };

const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const DOWNLOAD = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/releases\/[^\s]*$/;

type Parsed = { nums: [number, number, number]; pre: boolean };
function parse(v: string): Parsed | null {
  const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(-[0-9A-Za-z.-]+)?(?:\+.*)?$/.exec(v.trim());
  if (!m) return null;
  return { nums: [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)], pre: m[4] !== undefined };
}

/** Compara versiones numéricas (1 si a > b, -1 si a < b). Una versión ilegible no es mayor ni menor (0). Un prelanzamiento es anterior a su versión final. */
export function compareVersions(a: string, b: string): number {
  const x = parse(a), y = parse(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i++) if (x.nums[i] !== y.nums[i]) return x.nums[i]! > y.nums[i]! ? 1 : -1;
  return x.pre === y.pre ? 0 : x.pre ? -1 : 1;
}

/**
 * Consulta anónima a GitHub Releases (RF-19, P-2): no envía token ni datos de la persona, solo pregunta cuál es la última versión.
 * `repo` es «propietario/nombre»; vacío = el aviso está desactivado y no se consulta nada.
 */
export async function checkForUpdate(o: { fetch: UpdateFetch; repo: string; current: string }): Promise<Result<UpdateInfo>> {
  if (o.repo.trim() === "") return ok({ available: false });
  if (!REPO.test(o.repo)) return err(appError("INVALID", "El repositorio de actualizaciones no es válido", { field: "repo" }));
  let res;
  try {
    res = await o.fetch(`https://api.github.com/repos/${o.repo}/releases/latest`, { headers: { Accept: "application/vnd.github+json" } });
  } catch {
    return err(appError("CONFLICT", "No se pudo comprobar si hay una versión nueva"));
  }
  if (res.status !== 200) return err(appError("CONFLICT", `GitHub respondió ${res.status} al buscar actualizaciones`, { status: res.status }));
  let body: unknown;
  try { body = await res.json(); } catch { return ok({ available: false }); }
  const r = body as { tag_name?: unknown; html_url?: unknown; draft?: unknown; prerelease?: unknown } | null;
  if (!r || typeof r.tag_name !== "string" || typeof r.html_url !== "string" || r.draft === true || r.prerelease === true) return ok({ available: false });
  if (!DOWNLOAD.test(r.html_url)) return ok({ available: false });
  if (compareVersions(r.tag_name, o.current) <= 0) return ok({ available: false });
  return ok({ available: true, version: r.tag_name.replace(/^v/, ""), url: r.html_url });
}
