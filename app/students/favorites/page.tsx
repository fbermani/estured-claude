import { formatShortName } from "@/lib/format/shortName";
import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { getCatalogResidences } from "@/lib/residences/catalog";
import { getCurrentExchangeRate } from "@/lib/exchange/rate";
import { ResidenceCard } from "@/components/residences/ResidenceCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Favoritos" };
export const dynamic = "force-dynamic";

type FavoriteRow = {
  id: string;
  residence_id: string;
  student_profile_id: string;
  added_by_role: "student" | "family_member";
  added_by_user_id: string;
};

/**
 * Docs/08 §6.2 — favorito propio del estudiante vs sugerido por
 * familiar, distinguidos con badge. Área compartida (docs/08 §5.1: "el
 * familiar comparte área con el estudiante") — un familiar ve acá los
 * favoritos de sus estudiantes vinculados, un estudiante ve los suyos
 * (propios + sugeridos).
 */
export default async function StudentFavoritesPage() {
  const sessionUser = await getSessionUser();
  const admin = getSupabaseAdmin();
  if (!sessionUser || !admin) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <EmptyState title="Necesitás iniciar sesión" description="Iniciá sesión para ver tus favoritos." />
      </div>
    );
  }

  const isFamilyMember = sessionUser.roles.includes("family_member");

  const studentProfileIds: string[] = [];
  const studentNameById = new Map<string, string>();

  if (isFamilyMember) {
    const { data: familyMember } = await admin
      .from("family_members")
      .select("id")
      .eq("user_id", sessionUser.id)
      .maybeSingle();
    if (familyMember) {
      const { data: links } = await admin
        .from("family_links")
        .select("student_profiles(id, first_name, last_initial)")
        .eq("family_member_id", familyMember.id)
        .eq("status", "active");
      for (const l of (links ?? []) as unknown as { student_profiles: { id: string; first_name: string; last_initial: string } | null }[]) {
        if (l.student_profiles) {
          studentProfileIds.push(l.student_profiles.id);
          studentNameById.set(l.student_profiles.id, `${formatShortName(l.student_profiles.first_name, l.student_profiles.last_initial)}`);
        }
      }
    }
  } else {
    const { data: profile } = await admin
      .from("student_profiles")
      .select("id")
      .eq("user_id", sessionUser.id)
      .maybeSingle();
    if (profile) studentProfileIds.push(profile.id);
  }

  if (studentProfileIds.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-2xl font-bold text-ink">Favoritos</h1>
        <div className="mt-6">
          <EmptyState
            title={isFamilyMember ? "Sin estudiante vinculado" : "No encontramos tu perfil"}
            description={
              isFamilyMember
                ? "Necesitás un vínculo activo con un estudiante para ver o sugerir favoritos."
                : "Volvé a iniciar sesión."
            }
          />
        </div>
      </div>
    );
  }

  const { data: favorites } = await admin
    .from("student_favorites")
    .select("id, residence_id, student_profile_id, added_by_role, added_by_user_id")
    .in("student_profile_id", studentProfileIds)
    .order("created_at", { ascending: false });
  const rows = (favorites ?? []) as FavoriteRow[];

  const familyUserIds = [...new Set(rows.filter((r) => r.added_by_role === "family_member").map((r) => r.added_by_user_id))];
  let familyNameByUserId = new Map<string, string>();
  if (familyUserIds.length > 0) {
    const { data: familyMembers } = await admin
      .from("family_members")
      .select("user_id, first_name")
      .in("user_id", familyUserIds);
    familyNameByUserId = new Map((familyMembers ?? []).map((f) => [f.user_id, f.first_name]));
  }

  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-2xl font-bold text-ink">Favoritos</h1>
        <div className="mt-6">
          <EmptyState
            icon="favorite_border"
            title="Sin favoritos"
            description="Guardá residencias desde su ficha para compararlas después."
            action={
              <Button href="/search" variant="outline" size="sm">
                Buscar residencias
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  const [allResidences, rate, { data: residenceSlugs }] = await Promise.all([
    getCatalogResidences(),
    getCurrentExchangeRate(),
    admin
      .from("residences")
      .select("id, slug")
      .in("id", [...new Set(rows.map((r) => r.residence_id))]),
  ]);
  const slugByResidenceId = new Map((residenceSlugs ?? []).map((r) => [r.id, r.slug]));
  const residenceBySlug = new Map(allResidences.map((r) => [r.slug, r]));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Favoritos</h1>
          <p className="mt-1 text-sm text-ink-soft">Residencias guardadas para comparar antes de solicitar.</p>
        </div>
        <Button href="/search" variant="outline" size="sm">
          Explorar residencias
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => {
          const slug = slugByResidenceId.get(row.residence_id);
          const residence = slug ? residenceBySlug.get(slug) : undefined;
          if (!residence) return null;
          const badgeLabel =
            row.added_by_role === "family_member"
              ? `Sugerido por ${familyNameByUserId.get(row.added_by_user_id) ?? "tu familiar"}`
              : "Tu favorito";
          return (
            <div key={row.id} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={row.added_by_role === "family_member" ? "amber" : "sage"}>{badgeLabel}</Badge>
                {isFamilyMember && studentNameById.get(row.student_profile_id) && (
                  <Badge tone="neutral">Para {studentNameById.get(row.student_profile_id)}</Badge>
                )}
              </div>
              <ResidenceCard residence={residence} arsPerUsd={rate.arsPerUsd} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
