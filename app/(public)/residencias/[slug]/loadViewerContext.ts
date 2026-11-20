import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getStudentProfileCompleteness } from "@/lib/students/profileCompleteness";
import { LIVE_RESERVATION_STATUSES } from "@/lib/reservations/reservationStatus";
import { exceptionAppliesToResidence, findStayChangeException } from "@/lib/stayChange/exception";
import {
  describeReservationWindow,
  loadReservationWindowForUser,
  type ReservationWindowNotice,
} from "@/lib/students/reservationWindow";

/**
 * Datos de quien mira la ficha, cargados EN PARALELO (Ciclo 57). Cada lectura registra su error y degrada:
 * una consulta caída nunca tumba la ficha (el servidor igual valida al enviar).
 */

export type StudentViewer = {
  profileCompletenessPercent: number | null;
  studentFavorited: boolean;
  /** Menor sin familiar vinculado con teléfono (docs/10 §9.1 y §9.5): el servidor lo rechaza al enviar; acá se avisa antes. */
  minorBlock: "no_family" | "no_phone" | null;
  /** Reserva vigente: solo puede pedir fechas posteriores (Ciclo 58, `reservationWindow.ts`). */
  windowNotice: ReservationWindowNotice | null;
  /** Tipos de ESTA residencia en los que ya tiene una reserva vigente (no se le ofrece lista de espera ahí). */
  ownReservationTypeIds: string[];
  /** Fecha de nacimiento del PROPIO estudiante (solo viaja a su navegador, para el aviso de edad del formulario). */
  birthDate: string | null;
};

export async function loadStudentViewer(
  admin: SupabaseClient,
  userId: string,
  residenceId: string,
): Promise<StudentViewer> {
  const sessionClient = await getSupabaseServer();
  const [completeness, profileRes, windowRes, ownRes] = await Promise.all([
    getStudentProfileCompleteness(admin, userId),
    admin.from("student_profiles").select("id, is_minor, birth_date").eq("user_id", userId).maybeSingle(),
    sessionClient ? loadReservationWindowForUser(sessionClient, userId) : Promise.resolve({ window: null, failed: true }),
    sessionClient
      ? sessionClient
          .from("reservations")
          .select("room_type_id")
          .eq("residence_id", residenceId)
          .in("status", [...LIVE_RESERVATION_STATUSES])
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (profileRes.error) console.error("[ficha] no se pudo leer el perfil del estudiante:", profileRes.error);
  if (ownRes.error) console.error("[ficha] no se pudieron leer las reservas en esta residencia:", ownRes.error);

  const profile = profileRes.data;
  let minorBlock: StudentViewer["minorBlock"] = null;
  let studentFavorited = false;
  if (profile) {
    const [linkRes, favRes] = await Promise.all([
      profile.is_minor
        ? admin
            .from("family_links")
            .select("family_members(phone)")
            .eq("student_profile_id", profile.id)
            .eq("status", "active")
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      admin
        .from("student_favorites")
        .select("id")
        .eq("student_profile_id", profile.id)
        .eq("residence_id", residenceId)
        .maybeSingle(),
    ]);
    if (profile.is_minor) {
      if (linkRes.error) {
        // Ante un error de lectura no se bloquea: decide `submitApplication` al enviar.
        console.error("[ficha] no se pudo leer el familiar vinculado del menor:", linkRes.error);
      } else if (!linkRes.data) {
        minorBlock = "no_family";
      } else {
        const familyMember = linkRes.data.family_members as unknown as { phone: string | null } | null;
        if (!familyMember?.phone) minorBlock = "no_phone";
      }
    }
    if (favRes.error) console.error("[ficha] no se pudo leer el favorito:", favRes.error);
    studentFavorited = !!favRes.data;
  }

  // DR3 "Quiero cambiar": con el aviso abierto (y esta no es la residencia actual) puede pedir fechas superpuestas.
  let stayChangeOpen = false;
  if (profile && windowRes.window && sessionClient) {
    const { exception } = await findStayChangeException(sessionClient, profile.id as string);
    stayChangeOpen = exceptionAppliesToResidence(exception, residenceId);
  }
  const windowNotice = describeReservationWindow(windowRes.window, { stayChangeOpen });
  return {
    profileCompletenessPercent: completeness?.percent ?? null,
    birthDate: (profile?.birth_date as string | null | undefined) ?? null,
    studentFavorited,
    minorBlock,
    windowNotice,
    ownReservationTypeIds: windowNotice
      ? ((ownRes.data ?? []) as { room_type_id: string | null }[])
          .map((r) => r.room_type_id)
          .filter((id): id is string => !!id)
      : [],
  };
}

export type LinkedStudent = { id: string; first_name: string; last_initial: string };

export async function loadFamilyViewer(
  admin: SupabaseClient,
  userId: string,
  residenceId: string,
): Promise<{ linkedStudents: LinkedStudent[]; favorited: Set<string> }> {
  const { data: familyMember, error: fmError } = await admin
    .from("family_members")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (fmError) console.error("[ficha] no se pudo leer el familiar:", fmError);
  if (!familyMember) return { linkedStudents: [], favorited: new Set() };

  const { data: links, error: linksError } = await admin
    .from("family_links")
    .select("student_profiles(id, first_name, last_initial)")
    .eq("family_member_id", familyMember.id)
    .eq("status", "active");
  if (linksError) console.error("[ficha] no se pudieron leer los vínculos del familiar:", linksError);
  const linkedStudents = ((links ?? []) as unknown as { student_profiles: LinkedStudent | null }[])
    .map((l) => l.student_profiles)
    .filter((s): s is LinkedStudent => s !== null);
  if (linkedStudents.length === 0) return { linkedStudents, favorited: new Set() };

  const { data: favs, error: favsError } = await admin
    .from("student_favorites")
    .select("student_profile_id")
    .eq("residence_id", residenceId)
    .in("student_profile_id", linkedStudents.map((s) => s.id));
  if (favsError) console.error("[ficha] no se pudieron leer los favoritos del familiar:", favsError);
  return { linkedStudents, favorited: new Set((favs ?? []).map((f) => f.student_profile_id as string)) };
}
