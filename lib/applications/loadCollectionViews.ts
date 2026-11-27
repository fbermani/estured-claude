import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCollectionView, type CollectionChoiceView } from "@/lib/applications/collectionChoiceView";
import { loadCollectionChoice } from "@/lib/applications/collectionChoiceDb";
import { buildPaymentReportView, type PaymentReportView } from "@/lib/applications/paymentReportView";
import { loadOpenPaymentCaseIds } from "@/lib/applications/paymentSupportCase";

/**
 * Vista del cobro de la reserva para las solicitudes de la bandeja de la residencia que lo necesitan (`contact_established` y
 * `residence_payment_pending`). Service role, columnas explícitas. NUNCA lee `details` en la salida ni `instructions_snapshot`: la
 * vista solo lleva claves, nombres de medio, montos y el aviso del estudiante (fechas, motivo, si hay comprobante) (el staff y el dueño reciben lo mismo, no hay datos de cobro en el cliente).
 *
 * Degrada: sin la migración 0102 o ante un error de lectura devuelve un mapa vacío y la pantalla sigue como antes de DR63.
 */
export async function loadCollectionViews(
  admin: SupabaseClient,
  params: {
    residenceId: string;
    isOwner: boolean;
    apps: { id: string; status: string; contactTarget: string | null; snapshotId: string | null }[];
  },
): Promise<Map<string, CollectionChoiceView>> {
  const out = new Map<string, CollectionChoiceView>();
  const relevant = params.apps.filter((a) => a.status === "contact_established" || a.status === "residence_payment_pending");
  if (relevant.length === 0) return out;

  const load = await loadCollectionChoice(admin, params.residenceId);
  if (load.kind !== "ok") return out;

  const ids = relevant.map((a) => a.id);
  const columns = await admin.from("application_requests").select("id, preferred_payment_method, collection_mode").in("id", ids);
  if (columns.error) {
    if (!["42703", "PGRST204"].includes(columns.error.code ?? "")) console.error("[collection-views] columns read failed:", columns.error.code, columns.error.message);
    return out;
  }
  const columnsById = new Map(
    ((columns.data ?? []) as { id: string; preferred_payment_method: string | null; collection_mode: string | null }[]).map((r) => [r.id, r]),
  );

  const snapshotIds = [...new Set(relevant.map((a) => a.snapshotId).filter((id): id is string => Boolean(id)))];
  const snapshotsById = new Map<string, Record<string, unknown>>();
  if (snapshotIds.length > 0) {
    const { data, error } = await admin
      .from("application_snapshots")
      .select("id, reservation_payment_amount_usd, reservation_payment_amount_ars, monthly_price_usd, exchange_rate_ars_per_usd")
      .in("id", snapshotIds);
    if (error) console.error("[collection-views] snapshots read failed:", error.code, error.message);
    for (const s of (data ?? []) as Record<string, unknown>[]) snapshotsById.set(s.id as string, s);
  }

  const pendingIds = relevant.filter((a) => a.status === "residence_payment_pending").map((a) => a.id);
  const paymentsById = new Map<string, { chosenMethod: string | null; expectedUsd: number | null; expectedArs: number | null }>();
  const reportsById = new Map<string, PaymentReportView>();
  if (pendingIds.length > 0) {
    const { data, error } = await admin
      .from("external_residence_payments")
      .select(
        "application_request_id, status, chosen_method, expected_amount_usd, expected_amount_ars, student_reported_paid_at, student_proof_file_id, student_payment_issue_at, student_payment_issue_reason, student_payment_issue_resolved_at, amount_reported_usd, amount_reported_ars, payment_concept, payment_method_to_residence, dispute_reason, reopen_count",
      )
      .in("application_request_id", pendingIds);
    if (error) console.error("[collection-views] payments read failed:", error.code, error.message);
    for (const p of (data ?? []) as {
      application_request_id: string;
      status: string;
      student_reported_paid_at: string | null;
      student_proof_file_id: string | null;
      student_payment_issue_at: string | null;
      student_payment_issue_reason: string | null;
      student_payment_issue_resolved_at: string | null;
      amount_reported_usd: number | string | null;
      amount_reported_ars: number | string | null;
      payment_concept: string | null;
      payment_method_to_residence: string | null;
      dispute_reason: string | null;
      reopen_count: number | null;
      chosen_method: string | null;
      expected_amount_usd: number | string | null;
      expected_amount_ars: number | string | null;
    }[]) {
      const report = buildPaymentReportView(p);
      if (report) reportsById.set(p.application_request_id, report);
      paymentsById.set(p.application_request_id, {
        chosenMethod: p.chosen_method,
        expectedUsd: p.expected_amount_usd === null ? null : Number(p.expected_amount_usd),
        expectedArs: p.expected_amount_ars === null ? null : Number(p.expected_amount_ars),
      });
    }
  }

  const openCases = pendingIds.length > 0 ? await loadOpenPaymentCaseIds(admin, pendingIds) : null;

  for (const app of relevant) {
    const cols = columnsById.get(app.id);
    const view = buildCollectionView({
      status: app.status,
      ctx: load.ctx,
      isMinor: app.contactTarget === "family_member",
      isOwner: params.isOwner,
      collectionMode: cols?.collection_mode ?? null,
      preferred: cols?.preferred_payment_method ?? null,
      snapshot: app.snapshotId ? (snapshotsById.get(app.snapshotId) ?? null) : null,
      payment: paymentsById.get(app.id) ?? null,
      report: reportsById.get(app.id) ?? null,
      paymentCaseOpen: openCases?.has(app.id) ?? false,
    });
    if (view) out.set(app.id, view);
  }
  return out;
}
