import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { computeProfileCompleteness } from "@/lib/students/profileCompleteness";
import { ProfileDetailsForm } from "@/app/students/profile/ProfileDetailsForm";
import { DocumentUpload } from "@/app/students/profile/DocumentUpload";

export const metadata: Metadata = { title: "Mi perfil" };
export const dynamic = "force-dynamic";

export default async function StudentProfilePage() {
  const sessionUser = await getSessionUser();
  const admin = getSupabaseAdmin();
  if (!sessionUser || !admin) notFound();

  const { data: profile } = await admin
    .from("student_profiles")
    .select("id, nationality, study_institution_private, origin_city")
    .eq("user_id", sessionUser.id)
    .maybeSingle();
  if (!profile) notFound();

  const { data: visibility } = await admin
    .from("student_visibility_settings")
    .select("is_individual_profile_visible")
    .eq("student_profile_id", profile.id)
    .maybeSingle();

  const { data: files } = await admin
    .from("files")
    .select("document_type")
    .eq("related_entity_type", "student_profiles")
    .eq("related_entity_id", profile.id)
    .in("document_type", ["student_identity", "student_academic_proof"]);
  const types = new Set((files ?? []).map((f) => f.document_type));

  const { data: familyLink } = await admin
    .from("family_links")
    .select("id")
    .eq("student_profile_id", profile.id)
    .eq("status", "active")
    .maybeSingle();

  const completeness = computeProfileCompleteness({
    nationality: profile.nationality,
    studyInstitutionPrivate: profile.study_institution_private,
    originCity: profile.origin_city,
    hasIdentityDocument: types.has("student_identity"),
    hasAcademicProofDocument: types.has("student_academic_proof"),
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold text-ink">Mi perfil</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Completá estos datos para aumentar tus probabilidades de ser aceptado — las residencias ven
        estudiantes con perfil completo como solicitudes más serias.
      </p>

      <Card className="mt-6 p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">Perfil completo</span>
          <span className="text-sm font-bold text-forest-700">{completeness.percent}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-sand-200">
          <div className="h-full rounded-full bg-forest transition-all" style={{ width: `${completeness.percent}%` }} />
        </div>
        {completeness.missing.length > 0 && (
          <p className="mt-2 text-xs text-ink-faint">
            Te falta: {completeness.missing.map((m) => m.label).join(", ")}.
          </p>
        )}
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="font-bold text-ink">Datos de tu perfil</h2>
        <p className="mt-1 text-xs text-ink-faint">Privados — nunca se muestran públicamente.</p>
        <ProfileDetailsForm
          nationality={profile.nationality ?? ""}
          studyInstitution={profile.study_institution_private ?? ""}
          originCity={profile.origin_city ?? ""}
          profileVisible={visibility?.is_individual_profile_visible ?? false}
        />
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="font-bold text-ink">Documentos</h2>
        <p className="mt-1 text-xs text-ink-faint">
          Privados — ayudan a las residencias a confiar en tu solicitud. El acceso queda auditado.
        </p>
        <div className="mt-3 space-y-3">
          <DocumentUpload
            documentType="student_identity"
            label="Documento de identidad (DNI, pasaporte)"
            done={types.has("student_identity")}
          />
          <DocumentUpload
            documentType="student_academic_proof"
            label="Comprobante de estudio (constancia de alumno regular, aceptación)"
            done={types.has("student_academic_proof")}
          />
        </div>
      </Card>

      {!familyLink && (
        <Card className="mt-4 p-5">
          <h2 className="font-bold text-ink">¿Un familiar te va a ayudar?</h2>
          <p className="mt-1 text-xs text-ink-faint">
            Puede acompañar tu búsqueda, sugerir residencias y ayudarte con pagos y documentación. Vos seguís
            decidiendo todo. Compartile la sección{" "}
            <span className="font-semibold text-ink">Crear cuenta → Familiar</span> para que se registre — después
            vas a tener que aprobar el vínculo vos, acá mismo.
          </p>
        </Card>
      )}
    </div>
  );
}
