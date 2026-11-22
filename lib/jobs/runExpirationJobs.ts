import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { expireFamilyProposals } from "@/lib/jobs/expireFamilyProposals";
import { expireNegotiationProposals } from "@/lib/jobs/expireNegotiationProposals";
import { expireApplicationRequests } from "@/lib/jobs/expireApplicationRequests";
import { remindResidencePayments } from "@/lib/jobs/remindResidencePayments";
import { remindFeePayments } from "@/lib/jobs/remindFeePayments";
import { expireEsturedFeeWindows } from "@/lib/jobs/expireEsturedFeeWindows";
import { checkStaleAvailability } from "@/lib/jobs/checkStaleAvailability";
import { notifyWaitlistKeepAlive } from "@/lib/jobs/notifyWaitlistKeepAlive";
import { expireWaitlistByMonth } from "@/lib/jobs/expireWaitlistByMonth";
import { expireRenewalRequests } from "@/lib/jobs/expireRenewalRequests";
import { expireRenewalOffers } from "@/lib/jobs/expireRenewalOffers";
import { expireOperationalAccess } from "@/lib/jobs/expireOperationalAccess";
import { expireResidenceVerifications } from "@/lib/jobs/expireResidenceVerifications";
import { notifyExpiringVerifications } from "@/lib/jobs/notifyExpiringVerifications";
import { expireStayChangeIntents } from "@/lib/jobs/expireStayChangeIntents";
import { runStayFollowups } from "@/lib/jobs/runStayFollowups";
import { notifyArrivalReminders } from "@/lib/jobs/notifyArrivalReminders";
import { runGuardianConfirmationJob } from "@/lib/residents/guardianConfirmation";
import { flushQueuedPush } from "@/lib/push/dispatch";

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
  // DR40: el vencimiento por mes corre ANTES del recordatorio de 90 días (si no, a alguien se le pediría «confirmá que seguís» y enseguida «venció»).
  const waitlistMonthExpiryPromise = expireWaitlistByMonth(admin);
  const waitlistKeepAlivePromise = waitlistMonthExpiryPromise.then(() => notifyWaitlistKeepAlive(admin));
  const [
    familyProposals,
    negotiationProposals,
    applicationRequests,
    esturedFeeWindows,
    staleAvailability,
    waitlistKeepAlive,
    waitlistMonthExpiry,
    renewalRequests,
    renewalOffers,
    operationalAccess,
    residenceVerifications,
    stayChangeIntents,
    expiringVerifications,
    stayFollowups,
    arrivalReminders,
    guardianConfirmations,
    residencePaymentReminders,
    feePaymentReminders,
  ] = await Promise.all([
    expireFamilyProposals(admin),
    expireNegotiationProposals(admin),
    expireApplicationRequests(admin),
    expireEsturedFeeWindows(admin),
    checkStaleAvailability(admin),
    waitlistKeepAlivePromise,
    waitlistMonthExpiryPromise,
    expireRenewalRequests(admin),
    expireRenewalOffers(admin),
    expireOperationalAccess(admin),
    expireResidenceVerifications(admin),
    expireStayChangeIntents(admin),
    notifyExpiringVerifications(admin),
    runStayFollowups(admin),
    notifyArrivalReminders(admin),
    runGuardianConfirmationJob(admin),
    // DR63: recordatorios y alerta del pago a la residencia. Va en el mismo Promise.all: los vencimientos excluyen los pagos avisados por fecha, no por orden.
    remindResidencePayments(admin),
    // DR64 (f): recordatorios y alerta del fee de EstuRed. Idempotente con marcas `*_sent_at`; no vence nada.
    remindFeePayments(admin),
  ]);
  // DR61: los push generados entre las 0:00 y las 8:59 (Argentina) salen en la primera corrida desde las 9:00.
  const queuedPush = await flushQueuedPush(admin);

  return {
    queuedPush,
    familyProposals,
    negotiationProposals,
    applicationRequests,
    esturedFeeWindows,
    staleAvailability,
    waitlistKeepAlive,
    waitlistMonthExpiry,
    renewalRequests,
    renewalOffers,
    operationalAccess,
    residenceVerifications,
    stayChangeIntents,
    expiringVerifications,
    stayFollowups,
    arrivalReminders,
    guardianConfirmations,
    residencePaymentReminders,
    feePaymentReminders,
  };
}
