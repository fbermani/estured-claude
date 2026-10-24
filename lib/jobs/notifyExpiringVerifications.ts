import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { notifyResidenceTeam } from "@/lib/residences/notifyResidenceTeam";
import { EXPIRY_WARNING_DAYS } from "@/lib/residences/verificationReview";

/**
 * Aviso a 30 días del vencimiento de la verificación anual (Ciclo 70, DR7; docs/09 §7.5 pide además 60/7 días y el
 * del día: pendientes). Cuelga del cron horario existente, sin migración. Para no repetir el aviso en cada corrida,
 * el evento queda en el audit log (`residence_verification_expiry_warned`) y no se vuelve a avisar si ya hay uno
 * posterior a la última aprobación. Best-effort: nunca lanza.
 */
export async function notifyExpiringVerifications(admin: SupabaseClient): Promise<{ warnedCount: number }> {
  try {
    const now = new Date();
    const limit = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await admin
      .from("residence_verifications")
      .select("residence_id, approved_at, residences!inner(id, status)")
      .eq("status", "approved")
      .eq("residences.status", "verified_active")
      .gt("expires_at", now.toISOString())
      .lte("expires_at", limit);
    if (error) {
      console.error("[jobs] notifyExpiringVerifications query failed:", error);
      return { warnedCount: 0 };
    }

    let warnedCount = 0;
    for (const row of rows ?? []) {
      const residenceId = row.residence_id as string;
      let alreadyWarned = admin
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("entity_type", "residences")
        .eq("entity_id", residenceId)
        .eq("action", "residence_verification_expiry_warned");
      if (row.approved_at) alreadyWarned = alreadyWarned.gte("created_at", row.approved_at as string);
      const { count, error: logError } = await alreadyWarned;
      if (logError) {
        console.error("[jobs] notifyExpiringVerifications audit lookup failed:", logError);
        continue;
      }
      if ((count ?? 0) > 0) continue;

      // Primero el registro (evita repetir si el envío tarda), después el aviso.
      const logged = await createAuditLog(admin, {
        actorUserId: null,
        actorRole: "system",
        action: "residence_verification_expiry_warned",
        entityType: "residences",
        entityId: residenceId,
        newValue: { warning_days: EXPIRY_WARNING_DAYS },
        source: "system",
        isSystemAction: true,
      });
      if (!logged) continue;
      await notifyResidenceTeam(admin, { residenceId, event: "verification_expiring", entityId: residenceId });
      warnedCount += 1;
    }
    return { warnedCount };
  } catch (error) {
    console.error("[jobs] notifyExpiringVerifications failed:", error);
    return { warnedCount: 0 };
  }
}
