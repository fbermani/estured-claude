import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadActiveFamilyUserIds } from "@/lib/stayChange/recipients";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import {
  matchingRequestIds,
  type PlaceAlertSource,
  type PlaceAlertStatus,
  type RoomChangeOrigin,
  type RoomChangeStatus,
} from "@/lib/roomChange/rules";

/**
 * Lectores del cambio de habitación (DR34) para las pantallas. Service role con filtros explícitos; las pantallas validan antes la sesión y
 * el vínculo con la residencia / el estudiante. Si la migración 0076 no está aplicada devuelven vacío (la pantalla sigue como antes).
 */

const CLOSED_WINDOW_DAYS = 30;

export type ResidenceRoomChangeItem = {
  id: string;
  residentStayId: string;
  status: RoomChangeStatus;
  origin: RoomChangeOrigin;
  roomTypeId: string | null;
  roomTypeName: string | null;
  gender: string | null;
  note: string | null;
  reason: string | null;
  offeredLabel: string | null;
  createdAt: string;
};

export type PlaceAlertItem = {
  id: string;
  placeLabel: string;
  gender: string | null;
  source: PlaceAlertSource;
  status: Extract<PlaceAlertStatus, "pending" | "offered">;
  deferredIncrement: boolean;
  createdAt: string;
  offeredRequestId: string | null;
  /** Pedidos PENDIENTES que coinciden con la plaza (se calcula al leer, con los pedidos de hoy). */
  matchingRequestIds: string[];
};

export type ResidenceRoomChange = { requests: ResidenceRoomChangeItem[]; alerts: PlaceAlertItem[] };

type RequestDbRow = {
  id: string;
  resident_stay_id: string;
  status: RoomChangeStatus;
  origin: RoomChangeOrigin;
  preferred_room_type_id: string | null;
  preferred_gender: string | null;
  preference_note: string | null;
  reason: string | null;
  offered_label: string | null;
  created_at: string;
  room_types: { name: string } | null;
};

/** Pedidos de la residencia: los abiertos y los cerrados en los últimos 30 días; por estadía se queda con el abierto o, si no hay, el último. */
export async function loadResidenceRoomChange(admin: SupabaseClient, residenceId: string): Promise<ResidenceRoomChange> {
  const empty: ResidenceRoomChange = { requests: [], alerts: [] };
  try {
    const since = new Date(Date.now() - CLOSED_WINDOW_DAYS * 86_400_000).toISOString();
    const [requestsRes, alertsRes] = await Promise.all([
      admin
        .from("room_change_requests")
        .select("id, resident_stay_id, status, origin, preferred_room_type_id, preferred_gender, preference_note, reason, offered_label, created_at, room_types(name)")
        .eq("residence_id", residenceId)
        .or(`status.in.(pending,offered),updated_at.gte.${since}`)
        .order("created_at", { ascending: false }),
      admin
        .from("room_change_place_alerts")
        .select("id, bed_id, room_type_id, place_label, gender, source, status, deferred_increment, freed_by_stay_id, offered_request_id, created_at")
        .eq("residence_id", residenceId)
        .in("status", ["pending", "offered"])
        .order("created_at", { ascending: true }),
    ]);
    if (requestsRes.error || alertsRes.error) {
      const error = requestsRes.error ?? alertsRes.error;
      if (!isMissingSchemaError(error)) console.error("[roomChange] residence read failed:", error);
      return empty;
    }

    const rows = (requestsRes.data ?? []) as unknown as RequestDbRow[];
    const byStay = new Map<string, RequestDbRow>();
    for (const r of rows) {
      const current = byStay.get(r.resident_stay_id);
      const isOpen = r.status === "pending" || r.status === "offered";
      const currentOpen = current && (current.status === "pending" || current.status === "offered");
      // Orden descendente por alta: el primero de cada estadía es el más nuevo; un abierto siempre gana a uno cerrado.
      if (!current || (isOpen && !currentOpen)) byStay.set(r.resident_stay_id, r);
    }
    const requests: ResidenceRoomChangeItem[] = [...byStay.values()].map((r) => ({
      id: r.id,
      residentStayId: r.resident_stay_id,
      status: r.status,
      origin: r.origin,
      roomTypeId: r.preferred_room_type_id,
      roomTypeName: r.room_types?.name ?? null,
      gender: r.preferred_gender,
      note: r.preference_note,
      reason: r.reason,
      offeredLabel: r.offered_label,
      createdAt: r.created_at,
    }));

    type AlertDbRow = {
      id: string;
      bed_id: string | null;
      room_type_id: string | null;
      place_label: string;
      gender: string | null;
      source: PlaceAlertSource;
      status: "pending" | "offered";
      deferred_increment: boolean;
      freed_by_stay_id: string | null;
      offered_request_id: string | null;
      created_at: string;
    };
    const alertRows = (alertsRes.data ?? []) as unknown as AlertDbRow[];
    // Un aviso cuya cama ya fue ocupada por otro residente deja de ser una decisión pendiente.
    const bedIds = alertRows.map((a) => a.bed_id).filter((id): id is string => !!id);
    let occupied = new Set<string>();
    if (bedIds.length) {
      const { data: occupants } = await admin.from("resident_stays").select("bed_id").in("bed_id", bedIds).eq("is_current", true);
      occupied = new Set(((occupants ?? []) as { bed_id: string }[]).map((o) => o.bed_id));
    }
    const pending = rows
      .filter((r) => r.status === "pending")
      .map((r) => ({
        id: r.id,
        residentStayId: r.resident_stay_id,
        status: r.status as string,
        preferredRoomTypeId: r.preferred_room_type_id,
        preferredGender: r.preferred_gender,
      }));
    const alerts: PlaceAlertItem[] = alertRows
      .filter((a) => !a.bed_id || !occupied.has(a.bed_id))
      .map((a) => ({
        id: a.id,
        placeLabel: a.place_label,
        gender: a.gender,
        source: a.source,
        status: a.status,
        deferredIncrement: a.deferred_increment,
        createdAt: a.created_at,
        offeredRequestId: a.offered_request_id,
        matchingRequestIds: matchingRequestIds(pending, { roomTypeId: a.room_type_id, gender: a.gender }, a.freed_by_stay_id),
      }));
    return { requests, alerts };
  } catch (error) {
    console.error("[roomChange] loadResidenceRoomChange failed:", error);
    return empty;
  }
}

export type StudentRoomChangeView = {
  stayId: string;
  residenceName: string;
  currentTypeName: string | null;
  roomTypes: { id: string; name: string }[];
  isMinor: boolean;
  /** Un menor sin familiar vinculado activo no puede pedir. */
  hasFamily: boolean;
  /** El pedido más reciente (abierto, o el último cerrado). */
  request: {
    id: string;
    status: RoomChangeStatus;
    roomTypeName: string | null;
    gender: string | null;
    note: string | null;
    reason: string | null;
    offeredLabel: string | null;
    createdAt: string;
    closedReason: string | null;
  } | null;
};

/** Datos del bloque «Cambio de habitación» de Mi residencia. `null` = no corresponde mostrarlo (sin estadía activa, o la migración no está aplicada). */
export async function loadStudentRoomChange(admin: SupabaseClient, studentProfileId: string): Promise<StudentRoomChangeView | null> {
  try {
    const [{ data: stay }, { data: profile }] = await Promise.all([
      admin
        .from("resident_stays")
        .select("id, residence_id, residences(name), room_types(name)")
        .eq("student_profile_id", studentProfileId)
        .eq("is_current", true)
        .in("status", ["active", "visibility_limited", "hidden_by_user"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin.from("student_profiles").select("is_minor").eq("id", studentProfileId).maybeSingle(),
    ]);
    if (!stay) return null;
    const stayRow = stay as unknown as { id: string; residence_id: string; residences: { name: string } | null; room_types: { name: string } | null };

    const { data: requestRow, error } = await admin
      .from("room_change_requests")
      .select("id, status, preferred_gender, preference_note, reason, offered_label, created_at, closed_reason, room_types(name)")
      .eq("student_profile_id", studentProfileId)
      .eq("resident_stay_id", stayRow.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      if (!isMissingSchemaError(error)) console.error("[roomChange] student read failed:", error);
      return null;
    }
    const [{ data: types }, familyIds] = await Promise.all([
      admin.from("room_types").select("id, name").eq("residence_id", stayRow.residence_id).eq("is_active", true).order("name", { ascending: true }),
      loadActiveFamilyUserIds(admin, studentProfileId),
    ]);
    const request = requestRow as unknown as {
      id: string;
      status: RoomChangeStatus;
      preferred_gender: string | null;
      preference_note: string | null;
      reason: string | null;
      offered_label: string | null;
      created_at: string;
      closed_reason: string | null;
      room_types: { name: string } | null;
    } | null;
    return {
      stayId: stayRow.id,
      residenceName: stayRow.residences?.name ?? "tu residencia",
      currentTypeName: stayRow.room_types?.name ?? null,
      roomTypes: ((types ?? []) as { id: string; name: string }[]).map((t) => ({ id: t.id, name: t.name })),
      isMinor: !!(profile as { is_minor?: boolean } | null)?.is_minor,
      hasFamily: familyIds.length > 0,
      request: request
        ? {
            id: request.id,
            status: request.status,
            roomTypeName: request.room_types?.name ?? null,
            gender: request.preferred_gender,
            note: request.preference_note,
            reason: request.reason,
            offeredLabel: request.offered_label,
            createdAt: request.created_at,
            closedReason: request.closed_reason,
          }
        : null,
    };
  } catch (error) {
    console.error("[roomChange] loadStudentRoomChange failed:", error);
    return null;
  }
}
