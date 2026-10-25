import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { expireFamilyProposals } from "@/lib/jobs/expireFamilyProposals";
import { expireNegotiationProposals } from "@/lib/jobs/expireNegotiationProposals";
import { expireApplicationRequests } from "@/lib/jobs/expireApplicationRequests";
import { expireEsturedFeeWindows } from "@/lib/jobs/expireEsturedFeeWindows";
import { checkStaleAvailability } from "@/lib/jobs/checkStaleAvailability";
import { notifyWaitlistKeepAlive } from "@/lib/jobs/notifyWaitlistKeepAlive";
import { expireRenewalRequests } from "@/lib/jobs/expireRenewalRequests";
import { expireRenewalOffers } from "@/lib/jobs/expireRenewalOffers";
import { expireOperationalAccess } from "@/lib/jobs/expireOperationalAccess";
import { expireResidenceVerifications } from "@/lib/jobs/expireResidenceVerifications";
import { notifyExpiringVerifications } from "@/lib/jobs/notifyExpiringVerifications";
import { expireStayChangeIntents } from "@/lib/jobs/expireStayChangeIntents";
import { runStayFollowups } from "@/lib/jobs/runStayFollowups";

/**
 * Orquesta los jobs periódicos del proyecto, invocado por
 * `app/api/cron/expire-stale-records/route.ts`. Empezó como los 4 jobs
 * de vencimiento a 48h de docs/07 §31, y se le sumaron (Fase 5.1) los
 * de umbral de días de disponibilidad/lista de espera
 * (`checkStaleAvailability`: 30/15 días, `notifyWaitlistKeepAlive`: 90
 * días) — mismo criterio de un solo endpoint/cron horario en vez de
 * crear infraestructura nueva por cada frecuencia: correr un chequeo de
 * umbral de días cada hora es idempotente y no tiene costo real.
 */
export async function runExpirationJobs(admin: SupabaseClient) {
  const [
    familyProposals,
    negotiationProposals,
    applicationRequests,
    esturedFeeWindows,
    staleAvailability,
    waitlistKeepAlive,
    renewalRequests,
    renewalOffers,
    operationalAccess,
    residenceVerifications,
    stayChangeIntents,
    expiringVerifications,
    stayFollowups,
  ] = await Promise.all([
    expireFamilyProposals(admin),
    expireNegotiationProposals(admin),
    expireApplicationRequests(admin),
    expireEsturedFeeWindows(admin),
    checkStaleAvailability(admin),
    notifyWaitlistKeepAlive(admin),
    expireRenewalRequests(admin),
    expireRenewalOffers(admin),
    expireOperationalAccess(admin),
    expireResidenceVerifications(admin),
    expireStayChangeIntents(admin),
    notifyExpiringVerifications(admin),
    runStayFollowups(admin),
  ]);

  return {
    familyProposals,
    negotiationProposals,
    applicationRequests,
    esturedFeeWindows,
    staleAvailability,
    waitlistKeepAlive,
    renewalRequests,
    renewalOffers,
    operationalAccess,
    residenceVerifications,
    stayChangeIntents,
    expiringVerifications,
    stayFollowups,
  };
}
