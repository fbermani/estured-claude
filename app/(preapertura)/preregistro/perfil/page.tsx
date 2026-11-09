import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PreaperturaStage } from "@/components/preapertura/PreaperturaStage";
import { LandingPreview } from "@/components/preapertura/LandingPreview";
import { ProfileForm, type ProfileInitial } from "@/components/preapertura/ProfileForm";
import { CAREER_OPTIONS, OTHER_CAREER } from "@/lib/preapertura/options";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSafeUser } from "@/lib/supabase/safe-get-user";
import { ageByBirthDate, isMinorByBirthDate } from "@/lib/students/isMinorByBirthDate";

export const metadata: Metadata = { title: "Armá tu perfil", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Row = {
  role: string;
  birth_date: string | null;
  consent_comunidad: boolean;
  first_name: string | null;
  country: string | null;
  province: string | null;
  university: string | null;
  career: string | null;
  entry_month: number | null;
  entry_unsure: boolean;
  room_type: string | null;
  habits: string[] | null;
  interests: string[] | null;
  current_residence: string | null;
};

/** Paso 2 (opcional). Requiere sesión de estudiante de la preapertura; también sirve para «Editar mi perfil» (parte de lo guardado). */
export default async function PerfilPage() {
  const supabase = await getSupabaseServer();
  const user = supabase ? await getSafeUser(supabase) : null;
  if (!user) redirect("/preregistro");

  const admin = getSupabaseAdmin();
  if (!admin) redirect("/mi-lugar");
  const { data } = await admin.from("preapertura_estudiantes").select("*").eq("user_id", user.id).maybeSingle();
  const row = data as Row | null;
  // Familiares y cuentas que no son de la preapertura no tienen perfil de búsqueda.
  if (!row || row.role !== "student") redirect("/mi-lugar");

  const careerKnown = row.career != null && (CAREER_OPTIONS as readonly string[]).includes(row.career);
  const initial: ProfileInitial = {
    firstName: row.first_name ?? "",
    country: row.country ?? "",
    province: row.province ?? "",
    university: row.university ?? "",
    career: row.career == null ? "" : careerKnown ? row.career : OTHER_CAREER,
    careerOther: row.career != null && !careerKnown ? row.career : "",
    entry: row.entry_unsure ? "unsure" : row.entry_month ? String(row.entry_month) : "",
    roomType: row.room_type ?? "",
    habits: row.habits ?? [],
    interests: row.interests ?? [],
    inResidence: Boolean(row.current_residence),
    currentResidence: row.current_residence ?? "",
    community: row.consent_comunidad,
  };

  return (
    <PreaperturaStage preview={<LandingPreview />} labelledBy="pre-profile-title" size="form" initialFocus="#pre-first_name">
      <ProfileForm initial={initial} age={ageByBirthDate(row.birth_date)} isMinor={isMinorByBirthDate(row.birth_date)} />
    </PreaperturaStage>
  );
}
