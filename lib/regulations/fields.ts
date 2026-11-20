/**
 * Campos `{...}` del reglamento modelo y cómo se completan en el asistente (DR59 b). Lógica pura, sin I/O.
 * Los campos con opciones fijas son de opción múltiple; el resto es hora, número o texto. No cambia el texto legal del modelo:
 * solo reemplaza cada `{campo}` por el valor elegido. El resultado sigue siendo texto plano.
 */

export type FieldKind = "text" | "time" | "number" | "select";
export type FieldDef = { label: string; kind: FieldKind; options?: readonly string[] };

const sel = (label: string, options: readonly string[]): FieldDef => ({ label, kind: "select", options });
const time = (label: string): FieldDef => ({ label, kind: "time" });
const num = (label: string): FieldDef => ({ label, kind: "number" });

const NOTICE_DAYS = ["7 días", "15 días", "30 días", "60 días"] as const;

/** Campos con control propio. El resto cae en texto libre con el nombre del campo como etiqueta. */
export const FIELD_DEFS: Readonly<Record<string, FieldDef>> = {
  moneda_cobro: sel("Moneda de cobro", ["USD", "ARS"]),
  frecuencia_matricula: sel("Frecuencia de la matrícula", ["única", "anual", "semestral"]),
  medio_comunicacion: sel("Medio para comunicar cambios", ["correo electrónico", "WhatsApp", "cartelera de la residencia"]),
  anticipacion_cambios: sel("Anticipación de los cambios", ["7 días", "15 días", "30 días"]),
  anticipacion_ajuste: sel("Anticipación de los ajustes", ["15 días", "30 días", "60 días"]),
  periodicidad_ajuste: sel("Periodicidad de los ajustes", ["mensual", "trimestral", "semestral", "anual"]),
  preaviso_ausencia: sel("Preaviso de ausencia", NOTICE_DAYS),
  preaviso_egreso: sel("Preaviso de egreso", NOTICE_DAYS),
  plazo_devolucion_deposito: sel("Plazo de devolución del depósito", ["7 días", "15 días", "30 días"]),
  medios_de_pago: sel("Medios de pago", ["transferencia bancaria", "efectivo", "transferencia bancaria o efectivo"]),
  tipo_agua_caliente: sel("Agua caliente", ["central", "termotanque eléctrico", "termotanque a gas", "calefón"]),
  politica_ausencias: sel("Ausencias sobre la mensualidad", ["no generan descuento", "generan descuento si se avisa a tiempo", "se acuerdan caso por caso"]),
  edad_minima: num("Edad mínima"),
  edad_maxima: num("Edad máxima"),
  dia_inicio_pago: num("Día de inicio del pago"),
  dia_fin_pago: num("Día de fin del pago"),
  noches_maximas: num("Noches máximas de pernocte"),
  hora_silencio: time("Hora desde la que se guarda silencio"),
  hora_siesta_inicio: time("Inicio de la siesta"),
  hora_siesta_fin: time("Fin de la siesta"),
  hora_cierre: time("Hora de cierre"),
  hora_circulacion_nocturna: time("Hora de circulación nocturna"),
  hora_cocina_inicio: time("La cocina abre"),
  hora_cocina_fin: time("La cocina cierra"),
  hora_espacios_inicio: time("Los espacios comunes abren"),
  hora_espacios_fin: time("Los espacios comunes cierran"),
  hora_cierre_terraza: time("Cierre de la terraza"),
};

export function fieldDef(name: string): FieldDef {
  return FIELD_DEFS[name] ?? { label: name.replace(/_/g, " "), kind: "text" };
}

/** Campos pendientes de un texto, sin el nombre de la residencia (que el asistente ya completa solo). */
export function pendingFields(body: string): string[] {
  return Array.from(new Set(Array.from(body.matchAll(/\{([a-z0-9_]+)\}/gi), (m) => m[1]))).filter((f) => f !== "nombre_residencia");
}

/** Reemplaza cada `{campo}` que tenga valor. Los campos sin valor quedan entre llaves (y bloquean la publicación, como siempre). */
export function fillFields(body: string, values: Readonly<Record<string, string>>): string {
  return body.replace(/\{([a-z0-9_]+)\}/gi, (match, name: string) => {
    const v = values[name]?.trim();
    return v ? v : match;
  });
}

const MAX_FIELDS = 300;
const MAX_VALUE = 200;

/** Sanea los valores guardados en el borrador local. */
export function sanitizeFieldValues(raw: unknown): Record<string, string> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>).slice(0, MAX_FIELDS)) {
    if (!/^[a-z0-9_]+$/i.test(key) || typeof value !== "string") continue;
    out[key] = value.slice(0, MAX_VALUE);
  }
  return out;
}
