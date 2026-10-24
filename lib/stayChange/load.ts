import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { INTENT_COLUMNS, type StayChangeIntentRow } from "@/lib/stayChange/common";
import { loadIntentItems } from "@/lib/stayChange/closeItemsUnderIntent";
import { loadActiveFamilyUserIds } from "@/lib/stayChange/recipients";
import { ACTIVE_STAY_CHANGE_STATUSES, STAY_CHANGE_CREATE_COOLDOWN_HOURS, STAY_CHANGE_MAX_EDITS, describeStayChangeState, type StayChangeUiState } from "@/lib/stayChange/status";
import type { StayChangeTemplateContext } from "@/lib/stayChange/templates";

/**
 * Lectores del aviso "Quiero cambiar" (DR3, Ciclo 59) para las pantallas. Todos corren con service role y aplican la
 * proyección de privacidad que RLS no puede expresar (RLS filtra por fila, no por columna):
 *  - ESTUDIANTE: ve todo su aviso.
 *  - FAMILIAR vinculado ACTIVO: solo lectura y SIN `studentMessage` (mensaje privado del estudiante).
 *  - RESIDENCIA ACTUAL: ve el aviso (nunca los pendientes de familiar) y, al resolverse, solo la fecha de ingreso a la nueva.
 *  - RESIDENCIA NUEVA: ve la señal "en proceso de mudanza" desde SU solicitud/lista (`stay_change_intent_id`, ver `copy.ts`),
 *    nunca el aviso ni de qué residencia viene; solo la nota voluntaria `move_context_note` si el estudiante la escribió.
 * Los llamadores deben verificar ANTES quién es el usuario (sesión) y su relación con el estudiante/residencia.
 */

export type ResidenceResponseView = {
  message: string | null;
  exitCostsText: string | null;
  exitCostsUsd: number | null;
  exitConditionsText: string | null;
  exitDetailsText: string | null;
  respondedAt: string;
  /** `true` si la residencia editó su respuesta después de enviarla ("Actualizada el…"). */
  edited: boolean;
  seenByStudentAt: string | null;
};

export type StudentStayChangeView = {
  id: string;
  ui: StayChangeUiState;
  status: StayChangeIntentRow["status"];
  currentResidenceId: string;
  estimatedExitDate: string | null;
  /** `null` en la proyección para el familiar. */
  studentMessage: string | null;
  createdAt: string;
  expiresAt: string | null;
  studentEditedAt: string | null;
  resolvedNewStartDate: string | null;
  resolvedAt: string | null;
  response: ResidenceResponseView | null;
  /** Solicitudes / listas de espera creadas bajo el aviso (vivas), para los atajos y el modal de cancelar. */
  linked: { applications: number; waitlist: number; blockingApplicationIds: string[] };
  /** Ediciones ya hechas por el estudiante (auditoría) y tope, para deshabilitar "Editar aviso" con explicación. */
  editCount: number;
  maxEdits: number;
  /** Desde cuándo puede volver a avisar (24 h desde el último aviso), si todavía rige el cooldown. */
  canNoticeAgainAt: string | null;
};

function project(
  row: StayChangeIntentRow,
  linked: StudentStayChangeView["linked"],
  audience: "student" | "family",
  now: Date,
  extras: { editCount: number; canNoticeAgainAt: string | null } = { editCount: 0, canNoticeAgainAt: null },
): StudentStayChangeView {
  return {
    id: row.id,
    ui: describeStayChangeState({ status: row.status, residenceRespondedAt: row.residence_responded_at, expiresAt: row.expires_at }, now),
    status: row.status,
    currentResidenceId: row.current_residence_id,
    estimatedExitDate: row.estimated_exit_date,
    studentMessage: audience === "student" ? row.student_message : null,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    studentEditedAt: row.student_edited_at,
    resolvedNewStartDate: row.resolved_new_start_date,
    resolvedAt: row.resolved_at,
    response: row.residence_responded_at
      ? {
          message: row.residence_response_message,
          exitCostsText: row.residence_exit_costs_text,
          exitCostsUsd: row.residence_exit_costs_usd != null ? Number(row.residence_exit_costs_usd) : null,
          exitConditionsText: row.residence_exit_conditions_text,
          exitDetailsText: row.residence_exit_details_text,
          respondedAt: row.residence_responded_at,
          edited: row.residence_response_edit_count > 0,
          seenByStudentAt: row.response_seen_by_student_at,
        }
      : null,
    linked,
    editCount: extras.editCount,
    maxEdits: STAY_CHANGE_MAX_EDITS,
    canNoticeAgainAt: extras.canNoticeAgainAt,
  };
}

/** Aviso vivo más reciente del estudiante, o el último cerrado si no hay vivo. `null` si nunca avisó (o falló la lectura). */
async function loadLatestIntent(admin: SupabaseClient, studentProfileId: string): Promise<StayChangeIntentRow | null> {
  const { data, error } = await admin
    .from("stay_change_intents")
    .select(INTENT_COLUMNS)
    .eq("student_profile_id", studentProfileId)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) {
    console.error("[stayChange] no se pudo leer el aviso del estudiante:", error);
    return null;
  }
  const rows = (data ?? []) as unknown as StayChangeIntentRow[];
  return rows.find((r) => ACTIVE_STAY_CHANGE_STATUSES.includes(r.status)) ?? rows[0] ?? null;
}

async function loadLinked(admin: SupabaseClient, intent: StayChangeIntentRow): Promise<StudentStayChangeView["linked"]> {
  if (!ACTIVE_STAY_CHANGE_STATUSES.includes(intent.status)) return { applications: 0, waitlist: 0, blockingApplicationIds: [] };
  const items = await loadIntentItems(admin, intent.id);
  if (!items) return { applications: 0, waitlist: 0, blockingApplicationIds: [] };
  return {
    applications: items.closableApplications.length + items.blockingApplications.length,
    waitlist: items.closableWaitlist.length,
    blockingApplicationIds: items.blockingApplications.map((a) => a.id),
  };
}

export async function loadStudentStayChange(admin: SupabaseClient, studentProfileId: string, now: Date = new Date()): Promise<StudentStayChangeView | null> {
  const intent = await loadLatestIntent(admin, studentProfileId);
  if (!intent) return null;
  // Solo lectura: ediciones hechas (auditoría) y cooldown de 24 h desde el último aviso. La validación real sigue en el servidor.
  const { count: edits } = await admin
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("entity_type", "stay_change_intents")
    .eq("entity_id", intent.id)
    .eq("action", "stay_change_intent_updated");
  const until = new Date(new Date(intent.created_at).getTime() + STAY_CHANGE_CREATE_COOLDOWN_HOURS * 3_600_000);
  return project(intent, await loadLinked(admin, intent), "student", now, {
    editCount: edits ?? 0,
    canNoticeAgainAt: until.getTime() > now.getTime() ? until.toISOString() : null,
  });
}

/** Para el familiar: el LLAMADOR ya verificó que es el familiar activo de `studentProfileId`; igual se re-verifica acá. */
export async function loadFamilyStayChange(
  admin: SupabaseClient,
  params: { familyUserId: string; studentProfileId: string },
  now: Date = new Date(),
): Promise<StudentStayChangeView | null> {
  const familyUserIds = await loadActiveFamilyUserIds(admin, params.studentProfileId);
  if (!familyUserIds.includes(params.familyUserId)) return null;
  const intent = await loadLatestIntent(admin, params.studentProfileId);
  if (!intent) return null;
  return project(intent, await loadLinked(admin, intent), "family", now);
}

export type ResidenceStayChangeItem = {
  id: string;
  status: "open" | "resolved_new_reservation";
  studentProfileId: string;
  studentName: string;
  roomTypeName: string | null;
  createdAt: string;
  estimatedExitDate: string | null;
  contractEndDate: string | null;
  studentMessage: string | null;
  studentEditedAt: string | null;
  /** Solo en `resolved_new_reservation`: ingreso a la nueva residencia (sin nombrarla). */
  resolvedNewStartDate: string | null;
  response: ResidenceResponseView | null;
  /** Contexto para armar plantillas / precargar la hoja "Responder". */
  templateContext: StayChangeTemplateContext;
};

/**
 * Avisos que ve la residencia ACTUAL en Residentes: `open` y los resueltos en los últimos 30 días ("Registrar
 * salida"). Cancelados, vencidos y pendientes de familiar no se listan. El llamador debe haber verificado
 * `assertResidenceAccess`.
 */
export async function loadResidenceStayChanges(admin: SupabaseClient, residenceId: string, now: Date = new Date()): Promise<ResidenceStayChangeItem[]> {
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const [{ data, error }, { data: residence }] = await Promise.all([
    admin
      .from("stay_change_intents")
      .select(INTENT_COLUMNS)
      .eq("current_residence_id", residenceId)
      .or(`status.eq.open,and(status.eq.resolved_new_reservation,resolved_at.gte.${since})`)
      .order("created_at", { ascending: false }),
    admin.from("residences").select("minimum_stay_months, early_exit_deposit_clauses_text, early_exit_costs_text, early_exit_conditions_text").eq("id", residenceId).maybeSingle(),
  ]);
  if (error) {
    console.error("[stayChange] no se pudieron leer los avisos de la residencia:", error);
    return [];
  }
  const rows = (data ?? []) as unknown as StayChangeIntentRow[];
  if (rows.length === 0) return [];

  const studentIds = [...new Set(rows.map((r) => r.student_profile_id))];
  const reservationIds = rows.map((r) => r.reservation_id).filter((id): id is string => !!id);
  const [{ data: students }, { data: stays }, { data: reservations }] = await Promise.all([
    admin.from("student_profiles").select("id, first_name, last_initial").in("id", studentIds),
    admin
      .from("resident_stays")
      .select("id, student_profile_id, start_date, expected_end_date, room_types(name)")
      .eq("residence_id", residenceId)
      .in("student_profile_id", studentIds)
      .eq("is_current", true),
    reservationIds.length
      ? admin.from("reservations").select("id, start_date, room_types(name), application_snapshots(deposit_usd)").in("id", reservationIds)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);
  const nameOf = new Map((students ?? []).map((s) => [s.id as string, s as { first_name: string | null; last_initial: string | null }]));
  type StayRow = { id: string; student_profile_id: string; start_date: string | null; expected_end_date: string | null; room_types: { name: string } | null };
  const stayOf = new Map(((stays ?? []) as unknown as StayRow[]).map((s) => [s.student_profile_id, s]));
  type ResRow = { id: string; start_date: string; room_types: { name: string } | null; application_snapshots: { deposit_usd: number | null } | null };
  const reservationOf = new Map(((reservations ?? []) as unknown as ResRow[]).map((r) => [r.id, r]));

  return rows
    .filter((r): r is StayChangeIntentRow & { status: "open" | "resolved_new_reservation" } => r.status === "open" || r.status === "resolved_new_reservation")
    .map((r) => {
      const student = nameOf.get(r.student_profile_id);
      const stay = stayOf.get(r.student_profile_id);
      const reservation = r.reservation_id ? reservationOf.get(r.reservation_id) : undefined;
      const firstName = student?.first_name ?? "";
      const deposit = reservation?.application_snapshots?.deposit_usd;
      return {
        id: r.id,
        status: r.status,
        studentProfileId: r.student_profile_id,
        studentName: student?.first_name ? `${student.first_name}${student.last_initial ? ` ${student.last_initial.replace(/\.+$/, "")}.` : ""}` : "Residente",
        roomTypeName: stay?.room_types?.name ?? reservation?.room_types?.name ?? null,
        createdAt: r.created_at,
        estimatedExitDate: r.estimated_exit_date,
        contractEndDate: stay?.expected_end_date ?? null,
        studentMessage: r.student_message,
        studentEditedAt: r.student_edited_at,
        resolvedNewStartDate: r.resolved_new_start_date,
        response: r.residence_responded_at
          ? {
              message: r.residence_response_message,
              exitCostsText: r.residence_exit_costs_text,
              exitCostsUsd: r.residence_exit_costs_usd != null ? Number(r.residence_exit_costs_usd) : null,
              exitConditionsText: r.residence_exit_conditions_text,
              exitDetailsText: r.residence_exit_details_text,
              respondedAt: r.residence_responded_at,
              edited: r.residence_response_edit_count > 0,
              seenByStudentAt: r.response_seen_by_student_at,
            }
          : null,
        templateContext: {
          studentFirstName: firstName,
          estimatedExitDate: r.estimated_exit_date,
          stayStartDate: stay?.start_date ?? reservation?.start_date ?? null,
          minimumStayMonths: residence?.minimum_stay_months != null ? Number(residence.minimum_stay_months) : null,
          depositUsd: deposit != null ? Number(deposit) : null,
          policy:
            residence?.early_exit_deposit_clauses_text || residence?.early_exit_costs_text || residence?.early_exit_conditions_text
              ? {
                  depositClausesText: (residence.early_exit_deposit_clauses_text as string | null) ?? null,
                  costsText: (residence.early_exit_costs_text as string | null) ?? null,
                  conditionsText: (residence.early_exit_conditions_text as string | null) ?? null,
                }
              : null,
        },
      };
    });
}

/** Cuenta para el contador del menú / KPI: avisos `open` sin responder de la residencia. */
export async function countUnansweredStayChanges(admin: SupabaseClient, residenceId: string): Promise<number> {
  const { count, error } = await admin
    .from("stay_change_intents")
    .select("id", { count: "exact", head: true })
    .eq("current_residence_id", residenceId)
    .eq("status", "open")
    .is("residence_responded_at", null);
  if (error) console.error("[stayChange] no se pudo contar los avisos sin responder:", error);
  return count ?? 0;
}
