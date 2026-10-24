/**
 * Columnas de la migración 0050 (DR8) en `estured_fee_payments`. Mientras la 0050 no esté aplicada, `recordManualFeePayment` repite el
 * UPDATE sin ellas. Sin `server-only`: lo usan también tests y helpers puros.
 */
export const FEE_AUDIT_COLUMNS = ["received_amount", "confirmed_without_receipt", "validated_by_user_id"] as const;

/**
 * ¿El error significa que falta ALGUNA de las columnas de la 0050? Acotado a propósito (a diferencia de `isMissingSchemaError`, que
 * mira cualquier tabla/columna): solo `42703` / `PGRST204` — o el mensaje "column ... does not exist" / "Could not find the ... column"
 * — Y que el mensaje nombre una de las columnas esperadas. Cualquier otro error de base (permisos, constraint, red) NO se confunde con
 * la migración pendiente, para no validar un pago en silencio sin guardar lo que corresponde.
 */
export function isMissingFeeAuditColumnError(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!error) return false;
  const message = error.message ?? "";
  const mentionsColumn = FEE_AUDIT_COLUMNS.some((column) => message.includes(column));
  if (!mentionsColumn) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return /column .* does not exist|could not find the .* column/i.test(message);
}
