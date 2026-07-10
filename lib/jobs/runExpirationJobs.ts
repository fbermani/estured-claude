import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { expireFamilyProposals } from "@/lib/jobs/expireFamilyProposals";
import { expireNegotiationProposals } from "@/lib/jobs/expireNegotiationProposals";
import { expireApplicationRequests } from "@/lib/jobs/expireApplicationRequests";
import { expireEsturedFeeWindows } from "@/lib/jobs/expireEsturedFeeWindows";

/**
 * Orquesta los 4 jobs de vencimiento a 48h documentados en docs/07 §31
 * (todos con la misma frecuencia — cada hora), invocado por
 * `app/api/cron/expire-stale-records/route.ts`. Un solo endpoint y un
 * solo `cron.schedule` en vez de 4 — misma frecuencia, menos superficie
 * operativa que mantener (un secret, un webhook), sin perder separación
 * de responsabilidades a nivel de código.
 */
export async function runExpirationJobs(admin: SupabaseClient) {
  const [familyProposals, negotiationProposals, applicationRequests, esturedFeeWindows] = await Promise.all([
    expireFamilyProposals(admin),
    expireNegotiationProposals(admin),
    expireApplicationRequests(admin),
    expireEsturedFeeWindows(admin),
  ]);

  return { familyProposals, negotiationProposals, applicationRequests, esturedFeeWindows };
}
