/**
 * Control 19 (kit ND1): los errores de Postgres traen en `details` valores reales de la fila («Key (email)=(…) already exists»,
 * «Failing row contains (…)»). Cientos de `console.error` pasan el objeto entero, así que se limpia en un solo lugar y no en cada llamada.
 * Se conservan `code`, `message` y `hint`, que alcanzan para diagnosticar.
 */
const OMITTED = "[omitido]";
const INSTALLED = Symbol.for("estured.logRedaction");
const METHODS = ["error", "warn", "log", "info", "debug"] as const;

type DbErrorLike = { code?: unknown; message?: unknown; hint?: unknown; details?: unknown };

function isDbError(value: object): value is DbErrorLike {
  return "code" in value && "details" in value;
}

export function redactLogArg(arg: unknown, depth = 0): unknown {
  if (typeof arg !== "object" || arg === null) return arg;
  if (isDbError(arg)) {
    return { code: arg.code, message: arg.message, hint: arg.hint, details: arg.details ? OMITTED : arg.details };
  }
  // Un solo nivel: cubre `console.error("…", { error })` sin recorrer objetos arbitrarios.
  if (depth === 0 && Object.getPrototypeOf(arg) === Object.prototype) {
    return Object.fromEntries(Object.entries(arg).map(([key, value]) => [key, redactLogArg(value, 1)]));
  }
  return arg;
}

export function installLogRedaction(target: Console = console): void {
  const marked = target as Console & { [INSTALLED]?: boolean };
  if (marked[INSTALLED]) return;
  marked[INSTALLED] = true;
  for (const method of METHODS) {
    const original = target[method].bind(target);
    target[method] = (...args: unknown[]) => original(...args.map((arg) => redactLogArg(arg)));
  }
}
