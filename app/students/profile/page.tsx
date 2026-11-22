import { IdentityDocumentForm } from "@/app/students/profile/IdentityDocumentForm";
import { maskIdentityDocumentNumber } from "@/lib/students/identityDocument";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { PushSettings } from "@/components/push/PushSettings";
import { ProfileDetailsForm } from "@/app/students/profile/ProfileDetailsForm";
import { DocumentUpload } from "@/app/students/profile/DocumentUpload";
import { OtherDocumentsUpload } from "@/app/students/profile/OtherDocumentsUpload";
import { CommunityVisibilityCard } from "@/app/students/profile/CommunityVisibilityCard";
import { isMinorByBirthDate } from "@/lib/students/isMinorByBirthDate";
import { allHidden, VISIBILITY_FLAG_COLUMNS, type VisibilityValues } from "@/lib/students/communityVisibilitySettings";
import { LiveProfileProvider } from "@/app/students/profile/LiveProfile";
import { FamilyLinkCard } from "@/app/students/profile/FamilyLinkCard";
import { FamilyProfileForm } from "@/app/students/profile/FamilyProfileForm";
import { loadStudentDocumentFiles } from "@/lib/residences/stayDocumentsDb";
import { formatBillingTaxId, normalizeRelationship } from "@/lib/family/familyProfile";

export const metadata: Metadata = { title: "Mi perfil" };
export const dynamic = "force-dynamic";

export default async function StudentProfilePage() {
  const sessionUser = await getSessionUser();
  const admin = getSupabaseAdmin();
  if (!sessionUser || !admin) notFound();

  // DR4: el familiar ve SU propio perfil en esta misma ruta (nunca el del estudiante). Un usuario con ambos roles
  // conserva la vista de estudiante.
  if (sessionUser.roles.includes("family_member") && !sessionUser.roles.includes("student")) {
    return <FamilyProfileView userId={sessionUser.id} email={sessionUser.email} />;
  }

  const { data: profile } = await admin
    .from("student_profiles")
    .select("id, is_minor, birth_date, first_name, display_age, country_flag, nationality, study_institution_private, career, origin_city, bio, interests, habits")
    .eq("user_id", sessionUser.id)
    .maybeSingle();
  if (!profile) notFound();

  // DR38: identidad, estudios y «otros» (LEG-003: sin antecedentes penales); sin la migración devuelve solo lo de siempre.
  const { files: docFiles } = await loadStudentDocumentFiles(admin, [profile.id]);
  const types = new Set(docFiles.map((f) => f.document_type));
  const otherFiles = docFiles
    .filter((f) => f.document_type === "other")
    .map((f) => ({ id: f.id, filename: f.filename, createdAt: f.created_at, label: f.requirement_label ?? null }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  // DR58: el número se lee solo con service role; a la pantalla va enmascarado. Sin la migración 0100 queda vacío.
  const { data: identityRow } = await admin
    .from("student_identity_documents")
    .select("document_type, document_number")
    .eq("student_profile_id", profile.id)
    .maybeSingle();

  const { data: activeLinkRow } = await admin
    .from("family_links")
    .select("id, family_members(first_name, last_name, users(email))")
    .eq("student_profile_id", profile.id)
    .eq("status", "active")
    .maybeSingle();
  const activeLinkFamily = (
    activeLinkRow as unknown as {
      id: string;
      family_members: { first_name: string; last_name: string; users: { email: string } | null } | null;
    } | null
  )?.family_members;
  const activeLink =
    activeLinkRow && activeLinkFamily
      ? {
          id: activeLinkRow.id,
          name: `${activeLinkFamily.first_name} ${activeLinkFamily.last_name}`,
          email: activeLinkFamily.users?.email ?? null,
        }
      : null;

  const { count: pendingApprovalCount } = await admin
    .from("family_links")
    .select("id", { count: "exact", head: true })
    .eq("student_profile_id", profile.id)
    .eq("status", "pending_student_approval");

  const { data: pendingInvitation } = await admin
    .from("family_invitations")
    .select("id, email")
    .eq("student_profile_id", profile.id)
    .eq("status", "pending")
    .maybeSingle();

  // H21: a quien ya tiene una reserva confirmada no se le habla de "aumentar tus probabilidades de ser aceptado".
  const { count: confirmedReservations } = await admin
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("student_profile_id", profile.id)
    .eq("status", "confirmed");
  const hasConfirmedReservation = (confirmedReservations ?? 0) > 0;

  const { data: visibilityRow } = await admin
    .from("student_visibility_settings")
    .select(`is_individual_profile_visible, ${VISIBILITY_FLAG_COLUMNS.join(", ")}`)
    .eq("student_profile_id", profile.id)
    .maybeSingle();
  const visibility = (visibilityRow as unknown as VisibilityValues | null) ?? allHidden();

  const interestsItems = (profile.interests as { items?: unknown } | null)?.items;
  const habitsItems = (profile.habits as { items?: unknown } | null)?.items;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold text-ink">Mi perfil</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {hasConfirmedReservation
          ? "Ya tenés una reserva confirmada. Mantené tus datos y documentos al día para tu estadía y futuras renovaciones."
          : "Completá estos datos para que las residencias conozcan mejor tu solicitud. Los perfiles más completos tienen mejores chances de ser aceptados."}
      </p>

      <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-ink-faint">
        <Icon name="lock" className="mt-px shrink-0 text-sm text-forest-700" />
        <span>Tus documentos y tus datos personales están protegidos: son privados, solo acceden quienes corresponde y cada acceso queda registrado.</span>
      </p>

      <LiveProfileProvider>
      <div className="mt-6 grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="min-w-0 lg:col-span-2">
          <ProfileDetailsForm
            nationality={profile.nationality ?? ""}
            studyInstitution={profile.study_institution_private ?? ""}
            career={profile.career ?? ""}
            originCity={profile.origin_city ?? ""}
            bio={profile.bio ?? ""}
            interests={Array.isArray(interestsItems) ? (interestsItems as string[]) : []}
            habits={Array.isArray(habitsItems) ? (habitsItems as string[]) : []}
            hasIdentityDocument={types.has("student_identity")}
            hasAcademicProofDocument={types.has("student_academic_proof")}
          />
          <CommunityVisibilityCard
            isMinor={isMinorByBirthDate(profile.birth_date)}
            initial={visibility}
            data={{
              firstName: profile.first_name,
              age: profile.display_age,
              nationality: profile.nationality,
              countryFlag: profile.country_flag,
              career: profile.career,
              originCity: profile.origin_city,
              bio: profile.bio,
              habits: Array.isArray(habitsItems) ? (habitsItems as string[]) : [],
              interests: Array.isArray(interestsItems) ? (interestsItems as string[]) : [],
            }}
          />
        </div>

        <div className="space-y-4 lg:sticky lg:top-24">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Icon name="folder_shared" className="text-xl text-forest-700" />
              <h2 className="font-bold text-ink">Documentos</h2>
            </div>
            <p className="mt-1 text-xs text-ink-faint">
              Protegidos y privados: no se muestran a otros usuarios y cada acceso queda registrado. Ayudan a que confíen en tu solicitud.
            </p>
            <div className="mt-3 space-y-3">
              <DocumentUpload
                documentType="student_identity"
                label="Documento de identidad (DNI, pasaporte)"
                done={types.has("student_identity")}
              />
              <IdentityDocumentForm
                savedType={identityRow?.document_type ?? ""}
                savedMasked={identityRow?.document_number ? maskIdentityDocumentNumber(identityRow.document_number) : ""}
              />
              <DocumentUpload
                documentType="student_academic_proof"
                label="Comprobante de estudio (constancia de alumno regular, aceptación)"
                done={types.has("student_academic_proof")}
              />
              <OtherDocumentsUpload files={otherFiles} />
            </div>
          </Card>

          <PushSettings />

          <FamilyLinkCard
            activeLink={activeLink}
            pendingApprovalCount={pendingApprovalCount ?? 0}
            pendingInvitation={pendingInvitation}
            isMinor={profile.is_minor ?? false}
          />
        </div>
      </div>
      </LiveProfileProvider>
    </div>
  );
}

/** Vista del familiar (DR4): su propio perfil + a quién acompaña. */
async function FamilyProfileView({ userId, email }: { userId: string; email: string }) {
  const admin = getSupabaseAdmin();
  if (!admin) notFound();
  // `billing_*` pertenecen a la migración 0045: si todavía no está aplicada, se lee sin ellas (la pantalla no se cae).
  let row: Record<string, string | null> | null = null;
  const full = await admin
    .from("family_members")
    .select("first_name, last_name, phone, relationship_type, billing_tax_id, billing_vat_condition")
    .eq("user_id", userId)
    .maybeSingle();
  if (!full.error) {
    row = full.data as Record<string, string | null> | null;
  } else {
    const basic = await admin
      .from("family_members")
      .select("first_name, last_name, phone, relationship_type")
      .eq("user_id", userId)
      .maybeSingle();
    row = basic.data as Record<string, string | null> | null;
  }
  if (!row) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold text-ink">Mi perfil</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Tus datos como familiar. Los datos del estudiante que acompañás los edita solamente él o ella.
      </p>
      <div className="mt-6">
        <FamilyProfileForm
          firstName={row.first_name ?? ""}
          lastName={row.last_name ?? ""}
          phone={row.phone ?? ""}
          email={email}
          relationshipType={normalizeRelationship(row.relationship_type)}
          billingTaxId={formatBillingTaxId(row.billing_tax_id)}
          billingVatCondition={row.billing_vat_condition ?? ""}
        />
      </div>
      <div className="mt-6">
        <PushSettings />
      </div>
    </div>
  );
}
