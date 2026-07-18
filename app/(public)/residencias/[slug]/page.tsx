import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TrustBadge } from "@/components/residences/TrustBadge";
import { formatArs, formatUsd, usdToArs } from "@/lib/mock/exchange";
import { getCurrentExchangeRate } from "@/lib/exchange/rate";
import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { Icon } from "@/components/ui/Icon";
import { getCommunityVisibility } from "@/lib/residents/communityVisibility";
import { CommunityBrowser } from "@/components/residences/CommunityBrowser";
import { ApplyForm } from "@/app/(public)/residencias/[slug]/ApplyForm";
import { ProposeForm } from "@/app/(public)/residencias/[slug]/ProposeForm";

export const dynamic = "force-dynamic";

async function loadResidence(slug: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const { data: residence } = await admin
    .from("residences")
    .select("*")
    .eq("slug", slug)
    .eq("status", "verified_active")
    .maybeSingle();
  if (!residence) return null;

  const [{ data: roomTypes }, { data: sections }, { data: photos }] = await Promise.all([
    admin
      .from("room_types")
      .select(
        "id, name, monthly_price_usd, capacity_per_room, gender_policy, bathroom_type, profile_availability(status, available_count)",
      )
      .eq("residence_id", residence.id)
      .eq("is_active", true),
    admin.from("residence_profile_sections").select("section_type, content").eq("residence_id", residence.id),
    admin
      .from("files")
      .select("storage_path")
      .eq("related_entity_type", "residences")
      .eq("related_entity_id", residence.id)
      .eq("document_type", "residence_photo")
      .eq("status", "approved")
      .order("created_at", { ascending: true }),
  ]);

  const sectionMap = Object.fromEntries((sections ?? []).map((s) => [s.section_type, s.content]));
  const photoUrls = (photos ?? []).map(
    (p) => admin.storage.from("public-residence-media").getPublicUrl(p.storage_path).data.publicUrl,
  );

  // profile_availability tiene unique(room_type_id) — PostgREST devuelve
  // un objeto singular en el embed, no un array (a diferencia de lo que
  // el tipo inferido por supabase-js sugiere sin un schema generado).
  const normalizedRoomTypes = (roomTypes ?? []).map((rt) => ({
    ...rt,
    profile_availability: rt.profile_availability as unknown as { status: string; available_count: number | null } | null,
  }));

  return { residence, roomTypes: normalizedRoomTypes, sectionMap, photoUrls };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadResidence(slug);
  if (!data) return { title: "Residencia no encontrada" };
  return { title: data.residence.name };
}

export default async function RealResidenceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ room?: string }>;
}) {
  const { slug } = await params;
  const { room: preselectedRoomTypeId } = await searchParams;
  const data = await loadResidence(slug);
  if (!data) notFound();
  const { residence, roomTypes, sectionMap, photoUrls } = data;
  const rate = await getCurrentExchangeRate();

  const sessionUser = await getSessionUser();
  const services = (sectionMap.services?.items as string[]) ?? [];
  const commonAreas = (sectionMap.common_areas?.items as string[]) ?? [];
  const nearUniversities = (sectionMap.near_universities?.items as string[]) ?? [];
  const rulesSummary = (sectionMap.rules?.summary as string) ?? "";
  const communityStatement = (sectionMap.community_statement?.quote as string) ?? "";

  const adminClient = getSupabaseAdmin();
  const community = adminClient
    ? await getCommunityVisibility(adminClient, residence.id, sessionUser ? "registered" : "guest")
    : null;
  const communityProfiles = (community?.cards ?? []).filter((c) => c.kind === "profile");

  // Condiciones de reserva a nivel residencia (migración 0025).
  const conditions = {
    minimumStayMonths: residence.minimum_stay_months != null ? Number(residence.minimum_stay_months) : null,
    enrollmentFeeMode: (residence.enrollment_fee_mode as "one_month" | "manual" | null) ?? null,
    enrollmentFeeUsd: residence.enrollment_fee_usd != null ? Number(residence.enrollment_fee_usd) : null,
    enrollmentFeeFrequency: (residence.enrollment_fee_frequency as "once" | "annual") ?? "once",
    depositUsd: residence.deposit_usd != null ? Number(residence.deposit_usd) : null,
    emptyMonthChargePercent:
      residence.empty_month_charge_percent != null ? Number(residence.empty_month_charge_percent) : null,
  };

  let linkedStudents: { id: string; first_name: string; last_initial: string }[] = [];
  if (sessionUser?.roles.includes("family_member")) {
    const admin = getSupabaseAdmin();
    if (admin) {
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
        linkedStudents = ((links ?? []) as unknown as { student_profiles: { id: string; first_name: string; last_initial: string } | null }[])
          .map((l) => l.student_profiles)
          .filter((s): s is { id: string; first_name: string; last_initial: string } => s !== null);
      }
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Badge tone="sage">Catálogo real</Badge>

      {/* Galería — ref search_3: 1 foto grande + grilla de 4 con "+N" */}
      {photoUrls.length === 1 && (
        <div className="relative mt-4 h-72 overflow-hidden rounded-card bg-sand-200 sm:h-96">
          <Image src={photoUrls[0]} alt={residence.name} fill className="object-cover" priority />
        </div>
      )}
      {photoUrls.length > 1 && (
        <div className="mt-4 grid h-72 grid-cols-2 grid-rows-2 gap-2 overflow-hidden rounded-card sm:h-[420px] sm:grid-cols-4">
          <div className="relative col-span-2 row-span-2 bg-sand-200">
            <Image
              src={photoUrls[0]}
              alt={residence.name}
              fill
              sizes="(max-width: 640px) 100vw, 50vw"
              className="object-cover"
              priority
            />
          </div>
          {photoUrls.slice(1, 5).map((url, i) => {
            const isLastTile = i === 3 && photoUrls.length > 5;
            return (
              <div key={url} className="relative hidden bg-sand-200 sm:block">
                <Image
                  src={url}
                  alt={`Foto ${i + 2} de ${residence.name}`}
                  fill
                  sizes="25vw"
                  className="object-cover"
                />
                {isLastTile && (
                  <span className="absolute inset-0 flex items-center justify-center bg-forest-ink/50 text-xl font-bold text-white">
                    +{photoUrls.length - 5}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-ink sm:text-4xl">{residence.name}</h1>
              <TrustBadge status="verified_active" size="md" />
            </div>
            <p className="mt-1 text-ink-soft">{residence.public_area}, CABA</p>
            {nearUniversities.length > 0 && (
              <p className="mt-3 text-sm font-medium text-forest-700">
                Cerca de {nearUniversities.join(" y ")}
              </p>
            )}
          </div>

          {/* Comunidad y Convivencia — ref search_3: quote de la residencia
              + avatares + contador + "Ver todos los perfiles →" */}
          {(communityStatement || (community && community.totalResidents > 0)) && (
            <Card className="p-5">
              <p className="flex items-center gap-2 text-sm font-bold text-ink">
                <Icon name="diversity_3" className="text-xl text-forest-700" /> Comunidad y Convivencia
              </p>
              {communityStatement && (
                <p className="mt-3 rounded-field border-l-[3px] border-forest bg-forest-tint/40 px-4 py-3 text-sm italic leading-relaxed text-ink-soft">
                  &ldquo;{communityStatement}&rdquo;
                </p>
              )}
              {community && community.totalResidents > 0 && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {communityProfiles.slice(0, 4).map((c, i) => (
                        <span
                          key={c.residentStayId}
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ring-2 ring-paper ${
                            ["bg-forest-tint text-forest-700", "bg-orange-tint text-orange-700", "bg-mint text-forest-700", "bg-sand-100 text-ink-soft"][i % 4]
                          }`}
                        >
                          {c.firstName?.[0]?.toUpperCase() ?? "?"}
                        </span>
                      ))}
                      {community.totalResidents > 4 && (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-[11px] font-bold text-white ring-2 ring-paper">
                          +{community.totalResidents - 4}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-ink">{community.totalResidents} residentes actuales</p>
                  </div>
                  <Link
                    href={`/residencias/${slug}/comunidad`}
                    className="text-sm font-bold text-forest-700 hover:underline"
                  >
                    Ver todos los perfiles →
                  </Link>
                </div>
              )}
            </Card>
          )}

          {residence.description && (
            <section>
              <h2 className="text-xl font-bold text-ink">Sobre la residencia</h2>
              <p className="mt-3 leading-relaxed text-ink-soft">{residence.description}</p>
            </section>
          )}

          {/* Disponibilidad de Habitaciones — ref search_3: cards por tipo
              con compañeros de cuarto y CTA "Seleccionar este lugar" */}
          <section id="disponibilidad" className="scroll-mt-24">
            <h2 className="text-xl font-bold text-ink">Disponibilidad de habitaciones</h2>
            <div className="mt-4 space-y-4">
              {roomTypes.map((rt) => {
                const isFull = rt.profile_availability?.status === "full";
                const genderLabel =
                  rt.gender_policy === "solo_mujeres"
                    ? "Solo chicas"
                    : rt.gender_policy === "solo_hombres"
                      ? "Solo chicos"
                      : null;
                const roommates = communityProfiles.filter((c) => c.roomTypeId === rt.id && c.firstName);
                const capacity = Math.max(1, rt.capacity_per_room ?? 1);
                return (
                  <div
                    key={rt.id}
                    className={`rounded-card border-[1.5px] p-5 ${isFull ? "border-line bg-cream-2/50" : "border-line bg-paper shadow-card"}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="flex items-center gap-2 font-bold text-ink">
                          {rt.name}
                          {genderLabel && (
                            <span className="rounded-full bg-orange-tint px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-700">
                              {genderLabel}
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-faint">
                          <Icon name="bed" className="text-sm" />
                          {capacity} {capacity === 1 ? "cama" : "camas"} por habitación
                          {rt.bathroom_type && ` · Baño ${rt.bathroom_type}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-forest-700">
                          {formatUsd(Number(rt.monthly_price_usd))}
                          <span className="ml-1 text-xs font-normal text-ink-faint">/mes</span>
                        </p>
                        <p className="text-xs text-ink-faint">
                          ≈ {formatArs(usdToArs(Number(rt.monthly_price_usd), rate.arsPerUsd))}
                          <ExchangeRateNote />
                        </p>
                        {isFull ? (
                          <Badge tone="neutral">Sin lugar</Badge>
                        ) : (
                          <Badge tone="sage">Con lugar informado</Badge>
                        )}
                      </div>
                    </div>

                    {roommates.length > 0 && (
                      <div className="mt-4 rounded-field bg-cream-2 p-3">
                        <p className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-muted">
                          Tus futuros compañeros de cuarto
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {roommates.slice(0, 4).map((c, i) => (
                            <span
                              key={c.residentStayId}
                              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 text-xs font-medium text-ink"
                            >
                              <span
                                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                                  ["bg-forest-tint text-forest-700", "bg-orange-tint text-orange-700", "bg-mint text-forest-700", "bg-sand-100 text-ink-soft"][i % 4]
                                }`}
                              >
                                {c.firstName?.[0]?.toUpperCase()}
                              </span>
                              {c.firstName}
                              {c.age != null && `, ${c.age}`}
                            </span>
                          ))}
                          {roommates.length > 4 && (
                            <Link
                              href={`/residencias/${slug}/comunidad`}
                              className="inline-flex items-center rounded-full border border-line bg-paper px-2.5 py-1 text-xs font-semibold text-forest-700 hover:underline"
                            >
                              +{roommates.length - 4} más
                            </Link>
                          )}
                        </div>
                      </div>
                    )}

                    {!isFull && (
                      <Link
                        href={`/residencias/${slug}?room=${rt.id}#solicitud`}
                        className="mt-4 block w-full rounded-full bg-forest px-4 py-2.5 text-center text-sm font-bold text-white shadow-card transition-colors hover:bg-forest-600"
                      >
                        Seleccionar este lugar
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {services.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-ink">Servicios incluidos</h2>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {services.map((s) => (
                  <li key={s} className="flex items-center gap-2 text-sm text-ink-soft">
                    <span className="text-forest-700">✓</span> {s}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {commonAreas.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-ink">Áreas comunes</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {commonAreas.map((area) => (
                  <span
                    key={area}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-ink-soft"
                  >
                    <Icon name="chair" className="text-base text-forest-700" />
                    {area}
                  </span>
                ))}
              </div>
            </section>
          )}

          {rulesSummary && (
            <section>
              <h2 className="text-xl font-bold text-ink">Reglas de convivencia</h2>
              <p className="mt-3 rounded-card bg-sand-100 px-4 py-3 text-sm text-ink-soft">{rulesSummary}</p>
            </section>
          )}

          {/* Comunidad actual — ref search_3 embebe el módulo completo de
              comunidad (ocupación + habitaciones) en la ficha */}
          <section>
            <h2 className="text-xl font-bold text-ink">Comunidad actual de la residencia</h2>
            <p className="mt-3 flex items-start gap-2 rounded-field bg-info-bg px-3.5 py-2.5 text-xs leading-relaxed text-info-fg">
              <Icon name="info" className="mt-0.5 shrink-0 text-sm" />
              La convivencia es dinámica: los perfiles mostrados son los actuales, pero pueden cambiar antes de tu
              ingreso. Cada estudiante decide qué mostrar.
            </p>
            {community && community.totalResidents > 0 ? (
              <div className="mt-4">
                <CommunityBrowser summary={community} slug={slug} isGuest={!sessionUser} />
              </div>
            ) : (
              <p className="mt-3 text-sm text-ink-soft">
                La residencia todavía no cargó su comunidad visible.
              </p>
            )}
          </section>

          {/* Ubicación — ref search_3 (sin mapa: no hay datos geo reales;
              la dirección exacta es privada hasta confirmar la reserva) */}
          <section>
            <h2 className="text-xl font-bold text-ink">Ubicación</h2>
            <Card className="mt-4 flex items-start gap-3 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest-tint text-forest-700">
                <Icon name="location_on" className="text-xl" />
              </span>
              <div>
                <p className="font-bold text-ink">{residence.public_area}, Buenos Aires</p>
                {nearUniversities.length > 0 && (
                  <p className="mt-0.5 text-sm text-ink-soft">
                    A minutos de {nearUniversities.join(" y ")}, con transporte directo.
                  </p>
                )}
                <p className="mt-2 text-xs text-ink-faint">
                  La dirección exacta se comparte una vez confirmada la reserva.
                </p>
              </div>
            </Card>
          </section>
        </div>

        <aside id="solicitud" className="scroll-mt-24">
          <Card className="sticky top-24 p-6">
            {!sessionUser ? (
              <>
                <p className="text-sm text-ink-soft">
                  Necesitás una cuenta de estudiante para enviar una solicitud de reserva.
                </p>
                <Button href={`/login?next=/residencias/${slug}`} size="lg" className="mt-4 w-full">
                  Iniciar sesión
                </Button>
                <Button href="/register/student" variant="outline" size="lg" className="mt-2 w-full">
                  Crear cuenta de estudiante
                </Button>
              </>
            ) : sessionUser.roles.includes("family_member") ? (
              <ProposeForm residenceId={residence.id} roomTypes={roomTypes} students={linkedStudents} />
            ) : !sessionUser.roles.includes("student") ? (
              <p className="text-sm text-ink-soft">
                Solo cuentas de estudiante o familiares vinculados pueden actuar acá.
              </p>
            ) : (
              <ApplyForm
                residenceId={residence.id}
                roomTypes={roomTypes}
                conditions={conditions}
                arsPerUsd={rate.arsPerUsd}
                preselectedRoomTypeId={preselectedRoomTypeId}
              />
            )}
            <p className="mt-4 text-xs text-ink-faint">
              Enviar una solicitud no garantiza tu lugar: la residencia la revisa y responde. Toda
              reserva está sujeta a confirmación.
            </p>
          </Card>
        </aside>
      </div>

      <p className="mt-10 text-center text-xs text-ink-faint">
        ¿Buscás más opciones?{" "}
        <Link href="/search" className="text-forest-700 hover:underline">
          Mirá el catálogo completo
        </Link>
        .
      </p>
    </div>
  );
}
