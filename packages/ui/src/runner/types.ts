/** Lenguajes que se pueden ejecutar dentro de la aplicación. */
export type RunnableLanguage = "javascript" | "python";

export type RunOptions = {
  /** Tiempo máximo de ejecución (ms). */
  timeoutMs?: number;
  /** Tope de texto de salida (caracteres); lo que sobra se descarta con un aviso. */
  maxOutputChars?: number;
  /** Tope de memoria del intérprete (solo JavaScript; Python se limita por tiempo). */
  memoryBytes?: number;
};

export type RunResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  /** Valor de la última expresión, ya como texto. */
  value?: string;
  /** Detalle técnico del intérprete (excepción, mensaje de Python…), tal cual. Si hay `errorKey`, es solo el detalle de ese aviso. */
  error?: string;
  /** Fallo propio de la ejecución (no del código): la interfaz lo traduce y le añade `error` como detalle. */
  errorKey?: "start" | "crashed" | "silent" | "pythonLoad";
  timedOut?: boolean;
  /** La persona detuvo la ejecución. */
  cancelled?: boolean;
  /** La salida superó el tope y se detuvo la ejecución. */
  truncated?: boolean;
  /** Límite de tiempo (ms) que se agotó, para mostrarlo traducido. */
  limitMs?: number;
  /** Duración total (ms). */
  ms: number;
};

/** Fases que el Worker comunica mientras trabaja. */
export type RunPhase = "loading" | "running";

/** Mensajes entre la aplicación y el Worker del intérprete. */
export type RunRequest = { id: number; lang: RunnableLanguage; code: string; opts: RunOptions };
export type RunMessage = { id: number; phase: RunPhase } | { id: number; result: RunResult };
