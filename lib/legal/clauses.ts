/**
 * Casillas de aceptación con texto legal propio (LEG-012). Módulo puro: lo usan los formularios (cliente) para mostrar el texto y
 * `lib/legal/consentVersion.ts` (servidor) para versionarlo con hash. Si cambiás un texto, actualizá su versión en `versions.ts`.
 */

/** Casilla del fee al informar «Ya pagué» (se guarda como consentimiento `estured_fee_terms`). */
export const FEE_ACKNOWLEDGEMENT_LABEL =
  "Leí la política del fee: tengo 10 días corridos para arrepentirme desde «Botón de arrepentimiento» y, fuera de ese derecho, el fee no se reembolsa automáticamente ante una cancelación.";

/** Casilla de responsabilidad al dar de alta una residencia (`residence_responsibility`). */
export const RESIDENCE_RESPONSIBILITY_LABEL =
  "Entiendo que la residencia solo se publica tras la verificación presencial del equipo de EstuRed, y que soy responsable de la veracidad de la información que cargo, incluidos mis datos de cobro.";
