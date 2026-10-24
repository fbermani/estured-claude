/**
 * ¿El error de Supabase/PostgREST significa "la tabla o columna todavía no existe"? (migración 0044 sin aplicar).
 * Sirve para que el código del Ciclo 59 degrade con elegancia durante el despliegue: se sube el código antes (o después)
 * de aplicar la migración y los flujos existentes (solicitudes, listas, renovaciones, perfil) siguen funcionando sin el
 * "Quiero cambiar". Una vez aplicada la migración nunca se dispara. Sin `server-only`: lo usan también tests y helpers puros.
 */
export function isMissingSchemaError(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!error) return false;
  if (error.code && ["42P01", "42703", "PGRST204", "PGRST205"].includes(error.code)) return true;
  return /could not find the .* (table|column)|does not exist/i.test(error.message ?? "");
}
