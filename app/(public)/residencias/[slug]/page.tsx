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
import { formatArs, formatUsd, usdToArsReferencial } from "@/lib/mock/exchange";
import { ApplyForm } from "@/app/(public)/residencias/[slug]/ApplyForm";

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
      .select("id, name, monthly_price_usd, enrollment_fee_usd, deposit_usd, profile_availability(status, available_count)")
      .eq("residence_id", residence.id)
      .eq("is_active", true),
    admin.from("residence_profile_sections").select("section_type, content").eq("residence_id", residence.id),
    admin
      .from("files")
      .select("storage_path")
      .eq("related_entity_type", "residences")
      .eq("related_entity_id", residence.id)
      .eq("document_type", "residence_photo")
      .order("created_at", { ascending: true }),
  ]);

  const sectionMap = Object.fromEntries((sections ?? []).map((s) => [s.section_type, s.content]));
  const photoUrls = (photos ?? []).map(
    (p) => admin.storage.from("public-residence-media").getPublicUrl(p.storage_path).data.publicUrl,
  );

  return { residence, roomTypes: roomTypes ?? [], sectionMap, photoUrls };
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
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadResidence(slug);
  if (!data) notFound();
  const { residence, roomTypes, sectionMap, photoUrls } = data;

  const sessionUser = await getSessionUser();
  const services = (sectionMap.services?.items as string[]) ?? [];
  const nearUniversities = (sectionMap.near_universities?.items as string[]) ?? [];
  const rulesSummary = (sectionMap.rules?.summary as string) ?? "";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Badge tone="sage">Catálogo real</Badge>

      {photoUrls.length > 0 && (
        <div className="relative mt-4 h-72 overflow-hidden rounded-card bg-sand-200 sm:h-96">
          <Image src={photoUrls[0]} alt={residence.name} fill className="object-cover" priority />
        </div>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-petrol-800 sm:text-4xl">{residence.name}</h1>
              <TrustBadge status="verified_active" size="md" />
            </div>
            <p className="mt-1 text-ink-soft">{residence.public_area}, CABA</p>
            {residence.description && <p className="mt-4 text-ink-soft">{residence.description}</p>}
            {nearUniversities.length > 0 && (
              <p className="mt-3 text-sm font-medium text-petrol-600">
                Cerca de {nearUniversities.join(" y ")}
              </p>
            )}
          </div>

          <section>
            <h2 className="text-xl font-bold text-petrol-800">Habitaciones y tarifas</h2>
            <div className="mt-4 overflow-hidden rounded-card border border-sand-200">
              <table className="w-full text-sm">
                <thead className="bg-sand-100 text-left text-ink-soft">
                  <tr>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium">Precio por mes</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-200 bg-surface">
                  {roomTypes.map((rt) => {
                    const availability = (rt.profile_availability as unknown as { status: string }[])?.[0];
                    const isFull = availability?.status === "full";
                    return (
                      <tr key={rt.id}>
                        <td className="px-4 py-3 font-medium text-ink">{rt.name}</td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-petrol-700">
                            {formatUsd(Number(rt.monthly_price_usd))}
                          </span>
                          <span className="ml-2 text-xs text-ink-faint">
                            ≈ {formatArs(usdToArsReferencial(Number(rt.monthly_price_usd)))}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isFull ? (
                            <Badge tone="neutral">Sin lugar</Badge>
                          ) : (
                            <Badge tone="sage">Con lugar informado</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {services.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-petrol-800">Servicios incluidos</h2>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {services.map((s) => (
                  <li key={s} className="flex items-center gap-2 text-sm text-ink-soft">
                    <span className="text-sage-600">✓</span> {s}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {rulesSummary && (
            <section>
              <h2 className="text-xl font-bold text-petrol-800">Reglas de convivencia</h2>
              <p className="mt-3 rounded-card bg-sand-100 px-4 py-3 text-sm text-ink-soft">{rulesSummary}</p>
            </section>
          )}
        </div>

        <aside>
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
            ) : !sessionUser.roles.includes("student") ? (
              <p className="text-sm text-ink-soft">
                Solo cuentas de estudiante pueden enviar solicitudes de reserva.
              </p>
            ) : (
              <ApplyForm residenceId={residence.id} roomTypes={roomTypes} />
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
        <Link href="/search" className="text-petrol-600 hover:underline">
          Mirá el catálogo completo
        </Link>
        .
      </p>
    </div>
  );
}
