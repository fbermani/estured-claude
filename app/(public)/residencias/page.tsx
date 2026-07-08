import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatUsd } from "@/lib/mock/exchange";

export const metadata: Metadata = { title: "Residencias verificadas (reales)" };
export const dynamic = "force-dynamic";

/**
 * Catálogo REAL, alimentado por Supabase — distinto de `/search` (mock
 * editorial del ciclo 0, se mantiene intacto a propósito). Va a quedar
 * casi siempre vacío hasta que se aprueben residencias reales; cuando
 * el catálogo definitivo se decida, esta ruta es la candidata a
 * absorber `/search`.
 */
export default async function RealResidencesPage() {
  const admin = getSupabaseAdmin();
  const residences = admin
    ? (
        await admin
          .from("residences")
          .select("id, name, slug, tagline, public_area, room_types(monthly_price_usd)")
          .eq("status", "verified_active")
          .order("created_at", { ascending: false })
      ).data ?? []
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8 max-w-2xl">
        <Badge tone="sage">Catálogo real</Badge>
        <h1 className="mt-2 text-3xl font-bold text-petrol-800 sm:text-4xl">
          Residencias verificadas
        </h1>
        <p className="mt-2 text-ink-soft">
          Estas son las residencias reales, ya verificadas por el equipo de EstuRed. Podés
          enviarles una solicitud de reserva de verdad.
        </p>
      </div>

      {residences.length === 0 ? (
        <EmptyState
          title="Todavía no hay residencias verificadas"
          description="Estamos verificando las primeras residencias de la red. Volvé a pasar pronto."
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {residences.map((r) => {
            const prices = (r.room_types as unknown as { monthly_price_usd: number }[]) ?? [];
            const from = prices.length > 0 ? Math.min(...prices.map((p) => Number(p.monthly_price_usd))) : null;
            return (
              <Link key={r.id} href={`/residencias/${r.slug}`}>
                <Card interactive className="flex h-full flex-col p-6">
                  <h2 className="text-lg font-bold text-petrol-800">{r.name}</h2>
                  <p className="text-sm text-ink-soft">{r.public_area ?? "CABA"}</p>
                  {r.tagline && <p className="mt-2 text-sm italic text-ink-faint">&ldquo;{r.tagline}&rdquo;</p>}
                  <div className="mt-auto pt-4">
                    <p className="text-xs text-ink-faint">Desde</p>
                    <p className="font-bold text-petrol-700">{from !== null ? formatUsd(from) : "Consultar"}</p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
