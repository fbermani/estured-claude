import { MIN_PUBLISH_PHOTOS } from "@/lib/residences/photos";
import { evaluateCollectionRequirement, type ReservationCollectionConfig } from "@/lib/residences/reservationCollection";

/**
 * Requisitos para ENVIAR una residencia a revisión (decisión del dueño, 2026-11-20, `docs/00` DR59). Función pura, sin `server-only`:
 * la usan el formulario del perfil (checklist en vivo con lo que se está editando) y la server action `saveResidenceProfile`
 * (que la recalcula siempre desde la base + el formulario enviado; nunca confía en conteos del cliente).
 *
 * Lista de requisitos obligatorios (supuestos reversibles, ver `docs/00` DR59):
 * 1. Datos básicos: nombre, barrio y dirección (se fijan al registrarse), eslogan y descripción de más de 20 caracteres.
 *    El perfil no tiene un campo de contacto propio: no se exige.
 * 2. Al menos 1 servicio y, aparte, al menos 1 área común (los ítems «Otro» pendientes de aprobación no cuentan).
 * 3. Al menos 1 regla de convivencia (reglas principales o su resumen).
 * 4. Reglamento: una versión PUBLICADA propia (`own`) o adaptada del modelo (`model` adaptado); el modelo base sin adaptar y un borrador
 *    no cuentan. Un PDF de reglamento cargado (`residence_rules_document`, no rechazado) también cuenta.
 * 5. Al menos 3 preguntas esenciales listas (elegidas y sin campos `{…}` pendientes).
 * 6. Al menos 2 universidades cercanas.
 * 7. Al menos 1 tipo de habitación, todos con tarifa mayor a 0.
 * 8. Al menos 3 fotos propias subidas (las pendientes de revisión cuentan; las rechazadas no).
 * 9. Condiciones de reserva completas: ajuste de tarifa, pago inicial coherente con lo que se cobra, matrícula y depósito excluyentes,
 *    matrícula manual con monto y, si cobra mes vacío, su porcentaje.
 * 10. Cobro de la reserva (DR63): «Contacto directo por WhatsApp», o «Cobro con medios habilitados» con al menos 1 medio y los datos de
 *    cobro de cada medio aceptado cargados (aprobados o pendientes de aprobación: la primera carga la aprueba el admin al verificar).
 *    Sin ninguna opción elegida no cumple. Si el entorno no tiene la migración 0102 (`reservationCollection: null`), no se exige.
 *
 * Condicionales (solo se exigen si la residencia eligió la opción): depósito con monto, y salida anticipada con costos Y condiciones.
 * No son obligatorias: promociones, mínimo de estadía («Sin mínimo» es una elección válida), cláusulas del depósito, documentos
 * que se piden a residentes.
 */

/** Cantidad mínima de preguntas esenciales listas para enviar. */
export const MIN_ESSENTIAL_FAQS_TO_SUBMIT = 3;
/** Mínimo de universidades cercanas para enviar. */
export const MIN_UNIVERSITIES_TO_SUBMIT = 2;
/** Largo mínimo (exclusivo) de la descripción: más de 20 caracteres. */
export const MIN_DESCRIPTION_CHARS = 20;

export type SubmitReadinessKey =
  | "basics"
  | "services"
  | "commonAreas"
  | "rules"
  | "regulation"
  | "faq"
  | "universities"
  | "roomTypes"
  | "photos"
  | "conditions"
  | "collection"
  | "deposit"
  | "earlyExit";

export interface SubmitReadinessItem {
  key: SubmitReadinessKey;
  /** Frase corta (sustantivo) para la lista y para el mensaje de lo que falta. */
  label: string;
  ok: boolean;
  /** Los ítems condicionales (depósito, salida anticipada) solo aparecen cuando aplican y entonces son obligatorios. */
  required: boolean;
  /** Qué falta, accionable y en voseo (solo si `ok` es falso). */
  hint?: string;
  /** Dónde se completa: ruta absoluta de otra pantalla o ancla (`#perfil-…`) dentro del perfil. */
  href?: string;
  /** 0 a 1: avance parcial (fotos, preguntas, universidades) para la barra de fortaleza. `ok` ⇒ 1. */
  progress: number;
}

export interface SubmitReadiness {
  items: SubmitReadinessItem[];
  /** Todos los ítems obligatorios cumplidos. */
  canSubmit: boolean;
  /** Obligatorios sin cumplir, en el orden de la lista. */
  missing: SubmitReadinessItem[];
}

type Amount = number | "" | null | undefined;

/** Condiciones de reserva tal como las necesita el chequeo: ya normalizadas (el cliente las arma de su borrador y el servidor de lo parseado). */
export interface SubmitReadinessConditions {
  adjustmentPolicy: string;
  initialPaymentMode: string;
  initialPaymentUsd: Amount;
  enrollmentEnabled: boolean;
  enrollmentFeeMode: string | null;
  enrollmentFeeUsd: Amount;
  depositEnabled: boolean;
  /** Meses de renta ("" o null = monto fijo en USD). */
  depositMode: string | null;
  depositUsd: Amount;
  emptyMonthsEnabled: boolean;
  emptyMonthChargePercent: Amount;
  earlyExitCostsText: string;
  earlyExitConditionsText: string;
}

export interface SubmitReadinessInput {
  /** Se usa para armar los enlaces a las pantallas que completan cada requisito. */
  residenceId: string;
  name: string;
  zone: string;
  addressLine: string;
  tagline: string;
  description: string;
  services: number;
  commonAreas: number;
  /** Texto de las reglas principales (una por línea) o el resumen guardado. */
  rulesSummary: string;
  nearUniversities: number;
  roomTypesCount: number;
  /** Todos los tipos de habitación tienen tarifa mayor a 0. */
  roomTypesPriced: boolean;
  /** Fotos propias subidas, sin las rechazadas. */
  photos: number;
  /** `null` = la lectura de reglamentos no está disponible en este entorno (migración pendiente): el requisito no se exige. */
  regulationPublished: boolean | null;
  /** Hay un PDF de reglamento cargado (no rechazado). */
  rulesPdf: boolean;
  /** `null` = el catálogo de preguntas no está disponible en este entorno: el requisito no se exige. */
  essentialFaqsReady: number | null;
  /** Cobro de la reserva (DR63), lo que se guardó en su pantalla. `null` = no se puede leer en este entorno (migración 0102 pendiente): no se exige. */
  reservationCollection: ReservationCollectionConfig | null;
  conditions: SubmitReadinessConditions;
}

const positive = (n: Amount): boolean => typeof n === "number" && Number.isFinite(n) && n > 0;
const filled = (s: string | null | undefined): boolean => (s ?? "").trim().length > 0;
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const joinList = (parts: string[]): string => (parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`);

/** Lo que falta de las condiciones de reserva, una frase por problema (vacío = completas). */
function conditionsProblems(c: SubmitReadinessConditions): string[] {
  const problems: string[] = [];
  if (!filled(c.adjustmentPolicy)) problems.push("elegí cada cuánto se ajusta la tarifa");
  if (c.initialPaymentMode === "custom_usd" && !positive(c.initialPaymentUsd)) problems.push("indicá el monto fijo del pago inicial");
  if (c.initialPaymentMode === "enrollment_only" && !c.enrollmentEnabled) problems.push("el pago inicial es solo la matrícula, pero no cobrás matrícula");
  if (c.initialPaymentMode === "deposit_only" && !c.depositEnabled) problems.push("el pago inicial es el depósito, pero no pedís depósito");
  if (c.enrollmentEnabled && c.depositEnabled) problems.push("elegí matrícula o depósito (no pueden ir los dos)");
  if (c.enrollmentEnabled && c.enrollmentFeeMode === "manual" && !positive(c.enrollmentFeeUsd)) problems.push("indicá el monto de la matrícula");
  if (c.emptyMonthsEnabled) {
    const pct = c.emptyMonthChargePercent;
    if (typeof pct !== "number" || !Number.isFinite(pct) || pct <= 0 || pct > 100) problems.push("indicá el porcentaje del mes vacío (de 1 a 100)");
  }
  return problems;
}

/** ¿Eligió informar una salida anticipada? Sí, si escribió costos o condiciones (no hay un interruptor aparte). */
export function earlyExitChosen(c: Pick<SubmitReadinessConditions, "earlyExitCostsText" | "earlyExitConditionsText">): boolean {
  return filled(c.earlyExitCostsText) || filled(c.earlyExitConditionsText);
}

export function computeSubmitReadiness(input: SubmitReadinessInput): SubmitReadiness {
  const base = `/residence/${input.residenceId}`;
  const items: SubmitReadinessItem[] = [];
  const push = (item: Omit<SubmitReadinessItem, "required" | "progress"> & { required?: boolean; progress?: number }) => {
    items.push({ required: true, ...item, hint: item.ok ? undefined : item.hint, progress: item.ok ? 1 : Math.max(0, Math.min(0.99, item.progress ?? 0)) });
  };

  // 1. Datos básicos
  const basicsMissing: string[] = [];
  if (!filled(input.name)) basicsMissing.push("el nombre");
  if (!filled(input.zone)) basicsMissing.push("el barrio");
  if (!filled(input.addressLine)) basicsMissing.push("la dirección");
  if (!filled(input.tagline)) basicsMissing.push("el eslogan");
  if (input.description.trim().length <= MIN_DESCRIPTION_CHARS) basicsMissing.push(`la descripción (más de ${MIN_DESCRIPTION_CHARS} caracteres)`);
  push({
    key: "basics",
    label: "Datos básicos",
    ok: basicsMissing.length === 0,
    hint: `Completá ${joinList(basicsMissing)}.`,
    href: "#perfil-datos",
    progress: (5 - basicsMissing.length) / 5,
  });

  // 2. Servicios y áreas comunes
  push({ key: "services", label: "Al menos 1 servicio", ok: input.services > 0, hint: "Marcá los servicios que incluye tu residencia.", href: "#perfil-servicios" });
  push({ key: "commonAreas", label: "Al menos 1 área común", ok: input.commonAreas > 0, hint: "Marcá las áreas comunes que tiene tu residencia.", href: "#perfil-areas" });

  // 3. Reglas
  push({ key: "rules", label: "Al menos 1 regla de convivencia", ok: filled(input.rulesSummary), hint: "Sumá al menos una regla principal (por ejemplo, el horario de silencio).", href: "#perfil-reglas" });

  // 4. Reglamento (publicado o PDF)
  if (input.regulationPublished !== null || input.rulesPdf) {
    push({
      key: "regulation",
      label: "Reglamento publicado",
      ok: input.regulationPublished === true || input.rulesPdf,
      hint: "Publicá tu reglamento (propio o adaptado del modelo) o cargá el PDF. Un borrador no alcanza.",
      href: `${base}/regulation`,
    });
  }

  // 5. Preguntas esenciales
  if (input.essentialFaqsReady !== null) {
    const ready = Math.max(0, Math.floor(input.essentialFaqsReady));
    const left = Math.max(0, MIN_ESSENTIAL_FAQS_TO_SUBMIT - ready);
    push({
      key: "faq",
      label: `Al menos ${MIN_ESSENTIAL_FAQS_TO_SUBMIT} preguntas esenciales listas`,
      ok: left === 0,
      hint: `Elegí y completá ${left} ${plural(left, "pregunta esencial más", "preguntas esenciales más")} en Preguntas frecuentes (${Math.min(ready, MIN_ESSENTIAL_FAQS_TO_SUBMIT)} de ${MIN_ESSENTIAL_FAQS_TO_SUBMIT}).`,
      href: `${base}/faq`,
      progress: Math.min(ready, MIN_ESSENTIAL_FAQS_TO_SUBMIT) / MIN_ESSENTIAL_FAQS_TO_SUBMIT,
    });
  }

  // 6. Universidades
  {
    const left = Math.max(0, MIN_UNIVERSITIES_TO_SUBMIT - input.nearUniversities);
    push({
      key: "universities",
      label: `Al menos ${MIN_UNIVERSITIES_TO_SUBMIT} universidades cercanas`,
      ok: left === 0,
      hint: `Elegí ${left} ${plural(left, "universidad más", "universidades más")} (${Math.min(input.nearUniversities, MIN_UNIVERSITIES_TO_SUBMIT)} de ${MIN_UNIVERSITIES_TO_SUBMIT}).`,
      href: "#perfil-universidades",
      progress: Math.min(input.nearUniversities, MIN_UNIVERSITIES_TO_SUBMIT) / MIN_UNIVERSITIES_TO_SUBMIT,
    });
  }

  // 7. Tipos de habitación con tarifa
  push({
    key: "roomTypes",
    label: "Al menos 1 tipo de habitación con tarifa",
    ok: input.roomTypesCount > 0 && input.roomTypesPriced,
    hint: input.roomTypesCount === 0 ? "Agregá al menos un tipo de habitación." : "Cada tipo de habitación necesita una tarifa mayor a 0.",
    href: "#perfil-habitaciones",
    progress: input.roomTypesCount > 0 ? 0.5 : 0,
  });

  // 8. Fotos propias
  {
    const photos = Number.isFinite(input.photos) ? Math.max(0, Math.floor(input.photos)) : 0;
    const left = Math.max(0, MIN_PUBLISH_PHOTOS - photos);
    push({
      key: "photos",
      label: `Al menos ${MIN_PUBLISH_PHOTOS} fotos propias`,
      ok: left === 0,
      hint: photos === 0 ? `Cargá al menos ${MIN_PUBLISH_PHOTOS} fotos de tu residencia.` : `Sumá ${left === 1 ? "1 foto más" : `${left} fotos más`} (hacen falta ${MIN_PUBLISH_PHOTOS}).`,
      href: "#perfil-fotos",
      progress: Math.min(photos, MIN_PUBLISH_PHOTOS) / MIN_PUBLISH_PHOTOS,
    });
  }

  // 9. Condiciones de reserva
  {
    const problems = conditionsProblems(input.conditions);
    push({
      key: "conditions",
      label: "Condiciones de reserva completas",
      ok: problems.length === 0,
      hint: problems.length > 0 ? `${problems[0][0].toUpperCase()}${problems[0].slice(1)}${problems.length > 1 ? ` (y ${problems.length - 1} ${plural(problems.length - 1, "ajuste más", "ajustes más")})` : ""}.` : undefined,
      href: "#perfil-condiciones",
      progress: 0.5,
    });
  }

  // 10. Cobro de la reserva (DR63): se configura en su propia pantalla; el servidor lo recalcula desde la base.
  if (input.reservationCollection !== null) {
    const collection = evaluateCollectionRequirement(input.reservationCollection);
    push({
      key: "collection",
      label: "Cobro de la reserva",
      ok: collection.ok,
      hint: collection.hint,
      href: `${base}/collection`,
      progress: collection.progress,
    });
  }

  // Condicionales
  const c = input.conditions;
  if (c.depositEnabled) {
    push({
      key: "deposit",
      label: "Monto del depósito",
      ok: filled(c.depositMode) || positive(c.depositUsd),
      hint: "Pediste depósito: indicá el monto (en USD) o cuántos meses de renta.",
      href: "#perfil-condiciones",
      progress: 0.5,
    });
  }
  if (earlyExitChosen(c)) {
    const both = filled(c.earlyExitCostsText) && filled(c.earlyExitConditionsText);
    push({
      key: "earlyExit",
      label: "Salida anticipada completa",
      ok: both,
      hint: `Completá ${filled(c.earlyExitCostsText) ? "las condiciones" : "los costos"} de salida anticipada, o dejá ambos campos vacíos.`,
      href: "#perfil-condiciones",
      progress: 0.5,
    });
  }

  const missing = items.filter((i) => i.required && !i.ok);
  return { items, canSubmit: missing.length === 0, missing };
}

/**
 * Mensaje (voseo) cuando el envío se rechaza: cuántos requisitos faltan y cuáles, con la pista de cada uno.
 * Vacío si no falta nada.
 */
export function submitBlockedMessage(readiness: SubmitReadiness): string {
  const n = readiness.missing.length;
  if (n === 0) return "";
  const list = readiness.missing.map((i) => (i.hint ? `${i.label}: ${i.hint}` : i.label)).join(" · ");
  return `Todavía no podés enviar la residencia a revisión: te ${plural(n, "falta 1 requisito", `faltan ${n} requisitos`)}. ${list}`;
}

/** Titular de la tarjeta: lo que el dueño tiene que saber a simple vista. `canSend` = además puede enviar (es el dueño y el estado lo permite). */
export function readinessHeadline(readiness: SubmitReadiness, canSend: boolean): string {
  const n = readiness.missing.length;
  if (n === 0) return canSend ? "Ya podés enviar para revisión." : "Cumplís todos los requisitos.";
  return canSend ? `Te ${plural(n, "falta 1 requisito", `faltan ${n} requisitos`)} para enviar.` : `Te ${plural(n, "falta 1 requisito", `faltan ${n} requisitos`)}.`;
}
