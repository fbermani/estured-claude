/**
 * Catálogo de medios de pago (DR63 (a), `docs/00`). Constante de código, sin migración: se amplía agregando una entrada.
 * Módulo puro (sin `server-only`): lo usan el servidor, la pantalla «Cobro de la reserva» y los tests.
 *
 * Aclaración de términos: «MercadoPago» de este catálogo es un pago a la cuenta de quien cobra (la residencia). No es el proveedor
 * `mercado_pago` de `PaymentProvider`, que cobra el fee EstuRed en forma automática.
 */

export const PAYMENT_METHOD_KEYS = [
  "cash",
  "mercadopago",
  "transfer_ars",
  "transfer_usd",
  "belo",
  "prex",
  "uala",
  "brubank",
  "paypal",
  "airtm",
  "western_union",
  "other",
] as const;

export type PaymentMethodKey = (typeof PAYMENT_METHOD_KEYS)[number];

export interface PaymentMethodInfo {
  key: PaymentMethodKey;
  /** Nombre en español para la interfaz. */
  label: string;
  /** Qué dato cargar (alias, CBU, usuario o instrucciones), en voseo. */
  detailsHint: string;
  /** Solo `other`: la residencia escribe el nombre del medio (2 a 60 caracteres). */
  requiresLabel: boolean;
}

export const PAYMENT_METHODS: readonly PaymentMethodInfo[] = [
  { key: "cash", label: "Efectivo", detailsHint: "Indicá cómo se entrega el efectivo: dirección, días y horarios.", requiresLabel: false },
  { key: "mercadopago", label: "MercadoPago", detailsHint: "Escribí el alias o el CVU de tu cuenta y el nombre del titular.", requiresLabel: false },
  { key: "transfer_ars", label: "Transferencia en pesos", detailsHint: "Escribí el CBU o CVU, el alias y el titular de la cuenta en pesos.", requiresLabel: false },
  { key: "transfer_usd", label: "Transferencia en dólares", detailsHint: "Escribí el CBU o CVU, el alias y el titular de la cuenta en dólares.", requiresLabel: false },
  { key: "belo", label: "Belo", detailsHint: "Escribí tu usuario o alias de Belo.", requiresLabel: false },
  { key: "prex", label: "Prex", detailsHint: "Escribí tu número de cuenta o alias de Prex.", requiresLabel: false },
  { key: "uala", label: "Ualá", detailsHint: "Escribí tu CVU o alias de Ualá.", requiresLabel: false },
  { key: "brubank", label: "Brubank", detailsHint: "Escribí tu CVU o alias de Brubank.", requiresLabel: false },
  { key: "paypal", label: "PayPal", detailsHint: "Escribí el email o el enlace de PayPal.Me de tu cuenta.", requiresLabel: false },
  { key: "airtm", label: "Airtm", detailsHint: "Escribí el email de tu cuenta de Airtm.", requiresLabel: false },
  { key: "western_union", label: "Western Union", detailsHint: "Escribí el nombre completo del titular y el país donde se cobra el giro.", requiresLabel: false },
  { key: "other", label: "Otro", detailsHint: "Escribí los datos de la cuenta y cómo se paga.", requiresLabel: true },
];

/** Máximo de medios aceptados por residencia (coincide con el check de la migración 0102). */
export const MAX_ACCEPTED_PAYMENT_METHODS = 30;
/** Largo del dato de cobro (alias, CBU, usuario o instrucciones), después de recortar espacios. */
export const PAYMENT_DETAILS_MIN = 1;
export const PAYMENT_DETAILS_MAX = 500;
/** Largo del nombre libre del medio «Otro». */
export const PAYMENT_LABEL_MIN = 2;
export const PAYMENT_LABEL_MAX = 60;

export function isPaymentMethodKey(value: unknown): value is PaymentMethodKey {
  return typeof value === "string" && (PAYMENT_METHOD_KEYS as readonly string[]).includes(value);
}

export function paymentMethodInfo(key: string): PaymentMethodInfo | null {
  return PAYMENT_METHODS.find((m) => m.key === key) ?? null;
}

/** Nombre para mostrar: el del catálogo; en «Otro», el nombre libre si lo hay. Una clave desconocida se muestra como «Otro». */
export function paymentMethodLabel(key: string, customLabel?: string | null): string {
  if (key === "other") {
    const label = (customLabel ?? "").trim();
    return label.length > 0 ? label : "Otro";
  }
  return paymentMethodInfo(key)?.label ?? "Otro";
}

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Valida la lista de medios aceptados: arreglo de claves del catálogo, sin repetidos, máximo 30. Devuelve las claves en el orden del
 * catálogo (estable). No descarta nada en silencio: una clave desconocida o repetida es un error.
 */
export function normalizePaymentMethodKeys(input: unknown): Checked<PaymentMethodKey[]> {
  if (!Array.isArray(input)) return { ok: false, error: "La lista de medios de pago no es válida." };
  if (input.length > MAX_ACCEPTED_PAYMENT_METHODS) return { ok: false, error: `Elegí hasta ${MAX_ACCEPTED_PAYMENT_METHODS} medios de pago.` };
  const seen = new Set<string>();
  for (const item of input) {
    if (!isPaymentMethodKey(item)) return { ok: false, error: "Hay un medio de pago que no existe en el catálogo." };
    if (seen.has(item)) return { ok: false, error: "Un medio de pago está repetido." };
    seen.add(item);
  }
  return { ok: true, value: PAYMENT_METHOD_KEYS.filter((k) => seen.has(k)) };
}

/** Caracteres de control (salvo salto de línea y tabulación): no tienen lugar en un dato de cobro. */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

/** Dato de cobro: texto de 1 a 500 caracteres (recortado). Admite saltos de línea (instrucciones). */
export function validatePaymentDetails(input: unknown, methodName = "este medio"): Checked<string> {
  if (typeof input !== "string") return { ok: false, error: `Cargá los datos de cobro de ${methodName}.` };
  const value = input.replace(/\r\n/g, "\n").trim();
  if (value.length < PAYMENT_DETAILS_MIN) return { ok: false, error: `Cargá los datos de cobro de ${methodName}.` };
  if (value.length > PAYMENT_DETAILS_MAX) return { ok: false, error: `Los datos de cobro de ${methodName} admiten hasta ${PAYMENT_DETAILS_MAX} caracteres.` };
  if (CONTROL_CHARS.test(value)) return { ok: false, error: `Los datos de cobro de ${methodName} tienen caracteres que no podemos guardar.` };
  return { ok: true, value };
}

/** Nombre libre del medio «Otro»: 2 a 60 caracteres (recortado), una sola línea. */
export function validatePaymentLabel(input: unknown): Checked<string> {
  if (typeof input !== "string") return { ok: false, error: `Escribí el nombre del medio «Otro» (de ${PAYMENT_LABEL_MIN} a ${PAYMENT_LABEL_MAX} caracteres).` };
  if (/[\r\n]/.test(input.trim())) return { ok: false, error: "El nombre del medio tiene que ir en una sola línea." };
  const value = input.trim();
  if (value.length < PAYMENT_LABEL_MIN || value.length > PAYMENT_LABEL_MAX)
    return { ok: false, error: `El nombre del medio «Otro» tiene que tener entre ${PAYMENT_LABEL_MIN} y ${PAYMENT_LABEL_MAX} caracteres.` };
  if (CONTROL_CHARS.test(value)) return { ok: false, error: "El nombre del medio tiene caracteres que no podemos guardar." };
  return { ok: true, value };
}

/**
 * Vista enmascarada de un dato de cobro para la pantalla (antes de «Mostrar»): cuatro puntos y los últimos 4 caracteres. No revela el
 * largo ni el contenido. Mismo criterio que `maskTail` de `paymentSettingsValidation`, pero sin depender de ese módulo desde el cliente.
 */
export function maskPaymentDetails(value: string | null | undefined, visible = 4): string {
  const compact = (value ?? "").replace(/\s+/g, " ").trim();
  if (compact.length === 0) return "—";
  return compact.length <= visible ? "••••" : `•••• ${compact.slice(-visible)}`;
}
