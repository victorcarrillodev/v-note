export const ERROR_CODES = [
  "NOT_FOUND",
  "INVALID",
  "CONFLICT",
  "CYCLE",
  "NEEDS_CONFIRMATION",
  "UNSUPPORTED_VERSION",
  "STORAGE",
  "CANCELLED",
  "LOCKED",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export type AppError = { code: ErrorCode; message: string; details?: Record<string, unknown> };
export type Ok<T> = { ok: true; value: T };
export type Err<E = AppError> = { ok: false; error: E };
export type Result<T, E = AppError> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E = AppError>(error: E): Err<E> => ({ ok: false, error });
export const isOk = <T, E>(r: Result<T, E>): r is Ok<T> => r.ok;
export const isErr = <T, E>(r: Result<T, E>): r is Err<E> => !r.ok;

export function appError(code: ErrorCode, message: string, details?: Record<string, unknown>): AppError {
  return details === undefined ? { code, message } : { code, message, details };
}

export function unwrap<T>(r: Result<T>): T {
  if (r.ok) return r.value;
  throw new Error(`${r.error.code}: ${r.error.message}`);
}

export function mapResult<T, U, E>(r: Result<T, E>, f: (v: T) => U): Result<U, E> {
  return r.ok ? ok(f(r.value)) : r;
}
