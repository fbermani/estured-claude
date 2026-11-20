/**
 * Mensaje de WhatsApp con el que una residencia comparte su ficha (propuesta A de la ficha, sección «Compartir tu ficha»).
 * Lógica PURA y testeable (sin React ni servidor): la plantilla con placeholders `{LINK}`, `{PRICE_FROM}`…, la validación que vale
 * en el servidor, la resolución con los datos reales de la residencia y la URL `wa.me`.
 *
 * Reglas del producto:
 *  - Es un botón MANUAL (`https://wa.me/?text=…`): nunca la API de WhatsApp Business.
 *  - Todo monto en USD lleva «USD» (nunca «US$») y su referencia en ARS (`usdToArsRounded` con la cotización vigente).
 *  - Si falta un dato, se omite la LÍNEA entera (nunca queda una llave sin resolver ni un hueco).
 *  - La plantilla guardada tiene como máximo 1.000 caracteres, contiene `{LINK}` y solo placeholders conocidos.
 */
import { formatArs, formatUsd, usdToArsRounded } from "@/lib/mock/exchange";
import { monthsLabel } from "@/lib/residences/fichaConditions";
import { describeEnrollmentFee } from "@/lib/residences/enrollmentFee";
import { abbreviateUniversity } from "@/lib/residences/universityLabel";
import { depositModeLabel, type DepositMode } from "@/lib/applications/reservationMoney";

/** Máximo de caracteres del mensaje (de la plantilla guardada y del texto ya resuelto). */
export const SHARE_TEMPLATE_MAX = 1000;

export type SharePlaceholderKey = "LINK" | "PRICE_FROM" | "PRICE_FROM_ARS" | "ZONE" | "UNIVERSITY" | "STAY_CONDITIONS";

export const SHARE_PLACEHOLDERS: { key: SharePlaceholderKey; label: string; description: string; example: string }[] = [
  { key: "LINK", label: "Link", description: "El link de tu ficha en EstuRed (obligatorio).", example: "https://estured.vercel.app/r/tu-residencia" },
  { key: "PRICE_FROM", label: "Precio desde", description: "El precio mensual más bajo, en USD.", example: "190" },
  { key: "PRICE_FROM_ARS", label: "Precio desde en ARS", description: "Referencia en pesos de ese precio, según el dólar de hoy.", example: "281.000" },
  { key: "ZONE", label: "Barrio", description: "El barrio de tu ficha.", example: "Palermo" },
  { key: "UNIVERSITY", label: "Universidad cercana", description: "La universidad más cercana que cargaste.", example: "U. de Palermo" },
  { key: "STAY_CONDITIONS", label: "Condiciones", description: "Estadía mínima, matrícula y depósito.", example: "Estadía mínima de 6 meses, sin matrícula" },
];

const KNOWN_KEYS: ReadonlySet<string> = new Set(SHARE_PLACEHOLDERS.map((p) => p.key));

/** Plantilla original (texto del dueño del producto). Se usa cuando la residencia no guardó una propia. */
export const DEFAULT_SHARE_TEMPLATE = [
  "Hola, gracias por escribirnos. Te paso nuestra ficha en EstuRed con fotos, precios y las respuestas a las consultas más frecuentes: {LINK}",
  "- Habitaciones desde USD {PRICE_FROM} por mes (referencia ≈ ARS {PRICE_FROM_ARS}, valor referencial)",
  "- {ZONE}, cerca de {UNIVERSITY}",
  "- {STAY_CONDITIONS}",
  "Ahí tenés toda nuestra info, y también podés ver detalles de nuestra comunidad y las vacantes! Si te gusta, desde ahí podés hacer tu reserva directamente, aprobamos tu solicitud, hacés el primer pago y listo!",
].join("\n");

export type ShareValues = Partial<Record<SharePlaceholderKey, string | null | undefined>>;

/** Normaliza lo que llega del formulario: saltos de línea `\n`, sin caracteres de control (salvo el salto) ni espacios al final de cada línea. */
export function normalizeShareTemplate(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();
}

export type ShareTemplateCheck = { ok: true; template: string } | { ok: false; error: string };

/**
 * Validación de la plantilla (la que vale es la del servidor). Falla con un mensaje en español accionable:
 * vacío, más de 1.000 caracteres, sin `{LINK}`, placeholders desconocidos, llaves sueltas o «US$».
 * `resolvedLength` (opcional) es el largo del texto ya resuelto con los datos reales: también tiene que entrar en el máximo.
 */
export function validateShareTemplate(raw: unknown, opts: { resolvedLength?: number } = {}): ShareTemplateCheck {
  const template = normalizeShareTemplate(raw);
  if (template === "") return { ok: false, error: "Escribí el mensaje: no puede quedar vacío." };
  if (template.length > SHARE_TEMPLATE_MAX) {
    return { ok: false, error: `El mensaje es muy largo: el máximo son ${SHARE_TEMPLATE_MAX.toLocaleString("es-AR")} caracteres y tiene ${template.length.toLocaleString("es-AR")}.` };
  }
  const unknown: string[] = [];
  for (const m of template.matchAll(/\{([^{}]*)\}/g)) {
    if (!KNOWN_KEYS.has(m[1]) && !unknown.includes(m[1])) unknown.push(m[1]);
  }
  if (unknown.length > 0) {
    return { ok: false, error: `No reconocemos ${unknown.length === 1 ? "este dato" : "estos datos"}: ${unknown.map((u) => `{${u}}`).join(", ")}. Usá solo los botones de «Datos que se completan solos».` };
  }
  // Llaves que no forman un placeholder completo (`{LINK`, `LINK}`, `{{LINK}}`): saldrían tal cual en el WhatsApp.
  if (/[{}]/.test(template.replace(/\{[^{}]*\}/g, ""))) {
    return { ok: false, error: "Hay una llave { o } suelta. Cada dato va completo, por ejemplo {LINK}." };
  }
  if (!template.includes("{LINK}")) {
    return { ok: false, error: "Falta el dato {LINK}: sin el link, tu ficha no llega a quien recibe el mensaje." };
  }
  if (/US\$/i.test(template)) {
    return { ok: false, error: "Escribí «USD» en vez de «US$»: así se muestran todos los montos en EstuRed." };
  }
  if (opts.resolvedLength != null && opts.resolvedLength > SHARE_TEMPLATE_MAX) {
    return { ok: false, error: `Con tus datos, el mensaje queda de ${opts.resolvedLength.toLocaleString("es-AR")} caracteres: acortalo para que entre en ${SHARE_TEMPLATE_MAX.toLocaleString("es-AR")}.` };
  }
  return { ok: true, template };
}

/**
 * Resuelve la plantilla con los datos. Una línea con algún dato que falta (`null`, `undefined` o vacío) se OMITE entera, sin dejar huecos:
 * así nunca sale una llave sin resolver ni un renglón vacío. `{LINK}` es obligatorio: si no llega, devuelve la plantilla sin tocar
 * (no pasa: el servidor siempre lo arma). Las líneas en blanco que escribió la residencia se conservan (de a una).
 */
export function resolveShareMessage(template: string, values: ShareValues): string {
  const out: string[] = [];
  for (const line of normalizeShareTemplate(template).split("\n")) {
    let missing = false;
    const resolved = line.replace(/\{([A-Z_]+)\}/g, (whole, key: string) => {
      if (!KNOWN_KEYS.has(key)) return whole;
      const v = values[key as SharePlaceholderKey];
      if (typeof v !== "string" || v.trim() === "") {
        missing = true;
        return "";
      }
      return v.trim();
    });
    if (missing) continue;
    // Una sola línea en blanco seguida como máximo, y ninguna al principio.
    if (resolved.trim() === "" && (out.length === 0 || out[out.length - 1] === "")) continue;
    out.push(resolved);
  }
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out.join("\n");
}

/** `https://wa.me/?text=…`: abre WhatsApp con el mensaje armado y que la persona elija a quién enviarlo. Botón manual, sin API. */
export function buildWhatsappShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/** Link público de la ficha para compartir: `<base>/r/<slug>` (la ruta corta que redirige a la ficha). */
export function buildShareLink(baseUrl: string, slug: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/r/${encodeURIComponent(slug)}`;
}

/** Marca de origen del link que va DENTRO del mensaje de WhatsApp (`?ref=wa`): la ficha la ignora; sirve para distinguir estas visitas en los logs. */
export const SHARE_REF_PARAM = "ref";
export const SHARE_REF_WHATSAPP = "wa";

/** Link del mensaje de WhatsApp: el link corto con `?ref=wa`. «Copiar link» usa el link limpio (`buildShareLink`). */
export function buildWhatsappMessageLink(baseUrl: string, slug: string): string {
  return `${buildShareLink(baseUrl, slug)}?${SHARE_REF_PARAM}=${SHARE_REF_WHATSAPP}`;
}

export type ShareDataInput = {
  link: string;
  /** Precio «desde» en USD (mismo criterio de la ficha) o `null` si no hay tipos con precio. */
  fromPriceUsd: number | null;
  arsPerUsd: number;
  zone: string | null;
  /** Nombre completo (del listado) de la universidad más cercana, o `null`. */
  nearestUniversityName: string | null;
  minimumStayMonths: number | null;
  enrollmentFeeMode: "one_month" | "manual" | null;
  enrollmentFeeUsd: number | null;
  depositUsd: number | null;
  depositMode: DepositMode | null;
};

/** «USD 300 (≈ ARS 444.000)»: todo monto en USD sale con su referencia en pesos. */
function usdWithArs(usd: number, arsPerUsd: number): string {
  return `${formatUsd(usd)} (≈ ${formatArs(usdToArsRounded(usd, arsPerUsd))})`;
}

/**
 * Resumen de las condiciones de estadía para `{STAY_CONDITIONS}`: estadía mínima, matrícula (solo se dice «sin matrícula» cuando la
 * residencia declaró que no cobra) y depósito. `null` si no hay ningún dato para afirmar.
 */
export function buildStayConditions(input: Pick<ShareDataInput, "minimumStayMonths" | "enrollmentFeeMode" | "enrollmentFeeUsd" | "depositUsd" | "depositMode" | "arsPerUsd">): string | null {
  const parts: string[] = [];
  if (input.minimumStayMonths != null && input.minimumStayMonths > 0) parts.push(`estadía mínima de ${monthsLabel(input.minimumStayMonths)}`);
  const enrollment = describeEnrollmentFee({ enrollmentFeeMode: input.enrollmentFeeMode, enrollmentFeeUsd: input.enrollmentFeeUsd });
  if (enrollment.kind === "none") parts.push("sin matrícula");
  else if (enrollment.kind === "one_month") parts.push("matrícula de un mes");
  else if (enrollment.kind === "fixed") parts.push(`matrícula de ${usdWithArs(enrollment.usd, input.arsPerUsd)}`);
  if (input.depositUsd != null && input.depositUsd > 0) parts.push(`depósito de ${usdWithArs(input.depositUsd, input.arsPerUsd)}`);
  else if (input.depositMode) parts.push(`depósito de ${depositModeLabel(input.depositMode).toLowerCase()}`);
  if (parts.length === 0) return null;
  const text = parts.join(", ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Los valores de cada placeholder a partir de los datos reales de la residencia. `{PRICE_FROM}` y `{PRICE_FROM_ARS}` salen SIEMPRE juntos
 * (sin cotización no se afirma un monto en pesos, y sin precio no hay ninguno de los dos): el texto de la plantilla ya lleva «USD» y «ARS».
 */
export function buildShareValues(input: ShareDataInput): Record<SharePlaceholderKey, string | null> {
  const hasPrice = input.fromPriceUsd != null && input.fromPriceUsd > 0 && Number.isFinite(input.arsPerUsd) && input.arsPerUsd > 0;
  return {
    LINK: input.link,
    PRICE_FROM: hasPrice ? formatUsd(input.fromPriceUsd as number).replace(/^USD\s+/, "") : null,
    PRICE_FROM_ARS: hasPrice ? formatArs(usdToArsRounded(input.fromPriceUsd as number, input.arsPerUsd)).replace(/^ARS\s+/, "") : null,
    ZONE: input.zone?.trim() || null,
    UNIVERSITY: input.nearestUniversityName?.trim() ? abbreviateUniversity(input.nearestUniversityName) : null,
    STAY_CONDITIONS: buildStayConditions(input),
  };
}
