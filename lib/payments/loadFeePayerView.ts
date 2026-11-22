import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveFeePayer } from "@/lib/payments/feePayerAccess";
import { loadOfferedFeeMethods, toFeeMethodChoice } from "@/lib/payments/feeCollectionMethods";
import { feeAmountInCurrency, isFeeCurrency, isFeeIssueOpen, splitFeeSnapshot, type FeeCurrency, type FeeMethodChoice } from "@/lib/payments/feeCollection";
import { paymentMethodLabel } from "@/lib/payments/paymentMethods";

/**
 * Lo que ve el PAGADOR del fee de EstuRed en `/students/applications/[id]/fee` (DR64 (b); `docs/08` §6.8). Serializable al cliente.
 *
 * `chosen.details` (los datos de cobro congelados, `instructions_snapshot`) se lee SOLO acá, con service role, DESPUÉS de comprobar en la
 * base que `userId` es el pagador designado (estudiante, o familiar vinculado con `can_pay_estured_fee`: `resolveFeePayer`). Nunca el
 * staff de la residencia ni el beneficiario cuyo fee paga otra persona. Los datos solo se entregan mientras hay que pagar.
 * Sin acceso devuelve `null`.
 */

export type FeePayerStage = "choose" | "to_pay" | "issue_open" | "reported" | "disputed";

export type FeePayerView = {
  role: "student" | "family_member";
  stage: FeePayerStage;
  /** Medios habilitados hoy (sin datos de cobro). Vacío si el admin no cargó ninguno ni hay cuenta de respaldo. */
  methods: FeeMethodChoice[];
  chosen: { key: string; label: string; currency: FeeCurrency; details: string; amount: number | null } | null;
  amountArs: number;
  /** Fee en USD con la cotización del snapshot; `null` si no se puede derivar. */
  amountUsd: number | null;
  /** El plazo corre solo mientras el pagador no informó el pago ni avisó un problema (DR64 (d) y (e)). */
  expiresAt: string | null;
  issueAt: string | null;
};

export async function loadFeePayerView(admin: SupabaseClient, params: { userId: string; applicationId: string }): Promise<FeePayerView | null> {
  const ctx = await resolveFeePayer(admin, params.userId, params.applicationId);
  if (!ctx.ok) return null;
  const { fee } = ctx;
  if (fee.status !== "pending_payment_method" && fee.status !== "pending_manual_payment") return null;

  const amountArs = Number(fee.fee_amount_ars);
  const amountUsd = feeAmountInCurrency(fee, "USD");
  const base = { role: ctx.role, amountArs, amountUsd, expiresAt: fee.expires_at, issueAt: null as string | null };

  if (fee.status === "pending_manual_payment") {
    const { data } = await admin.from("estured_fee_payments").select("admin_disputed_at").eq("id", fee.id).maybeSingle();
    return { ...base, stage: data?.admin_disputed_at ? "disputed" : "reported", methods: [], chosen: null };
  }

  if (isFeeIssueOpen(fee)) {
    return { ...base, stage: "issue_open", methods: [], chosen: null, issueAt: fee.student_payment_issue_at };
  }

  const offered = await loadOfferedFeeMethods(admin);
  const methods = offered.ok ? offered.methods.map(toFeeMethodChoice) : [];

  // Un medio elegido que el superadmin deshabilitó después no se muestra como «para pagar»: el pagador vuelve a elegir.
  if (!fee.chosen_method || (offered.ok && !methods.some((m) => m.key === fee.chosen_method))) return { ...base, stage: "choose", methods, chosen: null };

  const { data: snap } = await admin.from("estured_fee_payments").select("instructions_snapshot").eq("id", fee.id).maybeSingle();
  const { label, details } = splitFeeSnapshot((snap?.instructions_snapshot as string | null) ?? null);
  if (!details) return { ...base, stage: "choose", methods, chosen: null };
  const currency: FeeCurrency = isFeeCurrency(fee.payment_currency) ? fee.payment_currency : "ARS";
  return {
    ...base,
    stage: "to_pay",
    methods,
    chosen: {
      key: fee.chosen_method,
      label: label ?? paymentMethodLabel(fee.chosen_method),
      currency,
      details,
      amount: feeAmountInCurrency(fee, currency),
    },
  };
}
