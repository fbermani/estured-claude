import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { cmd } from "@/components/admin/ui/tokens";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { ExchangeRateActions } from "@/app/admin/exchange-rate/ExchangeRateActions";

export const metadata: Metadata = { title: "Tipo de cambio" };
export const dynamic = "force-dynamic";

interface RateRow {
  id: string;
  rate_date: string;
  official_exchange_rate_ars_per_usd: number;
  source_name: string;
  manually_overridden: boolean;
  override_reason: string | null;
  notes: string | null;
  fetched_at: string | null;
  created_at: string;
}

function todayArDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

export default async function ExchangeRatePage() {
  const admin = getSupabaseAdmin();
  const today = todayArDate();

  const history: RateRow[] = admin
    ? (
        await admin
          .from("exchange_rates")
          .select("*")
          .order("rate_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(15)
      ).data ?? []
    : [];

  // Docs/06 §20.1: entre las filas de hoy, el override manual manda.
  const todayRows = history.filter((r) => r.rate_date === today);
  const current = todayRows.find((r) => r.manually_overridden) ?? todayRows[0] ?? null;
  const isFallback = !current || current.source_name.startsWith("mock");

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="text-lg font-bold" style={{ color: cmd.onSurface }}>
        Tipo de cambio
      </h1>
      <p className="mt-1 text-sm" style={{ color: cmd.outline }}>
        Fuente confirmada: monedapi.ar (dólar blue, valor de venta). Usado para toda conversión USD→ARS y el
        cálculo del fee.
      </p>

      <AdminCard className="mt-6 p-6">
        {current ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold" style={{ color: cmd.onSurface }}>
                  ARS {Number(current.official_exchange_rate_ars_per_usd).toLocaleString("es-AR")}
                </p>
                <p className="text-sm" style={{ color: cmd.outline }}>
                  por USD 1 — {current.source_name}
                  {current.manually_overridden && " (override manual)"}
                </p>
              </div>
              {current.manually_overridden ? (
                <AdminBadge tone="violet">Override activo</AdminBadge>
              ) : isFallback ? (
                <AdminBadge tone="rose">Sin datos — usando mock</AdminBadge>
              ) : (
                <AdminBadge tone="amber">Automático</AdminBadge>
              )}
            </div>
            {current.manually_overridden && current.override_reason && (
              <p className="mt-3 rounded border p-3 text-sm" style={{ borderColor: cmd.border, color: cmd.onSurfaceVariant }}>
                <span className="font-semibold">Motivo del override:</span> {current.override_reason}
              </p>
            )}
            {current.fetched_at && (
              <p className="mt-2 text-xs" style={{ color: cmd.outline }}>
                Última actualización automática: {new Date(current.fetched_at).toLocaleString("es-AR")}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm" style={{ color: cmd.outline }}>
            Todavía no hay ningún valor cacheado hoy — se va a consultar monedapi.ar la próxima vez que alguien
            vea un precio en ARS.
          </p>
        )}
      </AdminCard>

      <ExchangeRateActions hasOverrideToday={Boolean(todayRows.find((r) => r.manually_overridden))} />

      <h2 className="mt-8 text-sm font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
        Histórico
      </h2>
      <AdminCard className="mt-3 overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: cmd.surfaceContainerLow }}>
            <tr>
              <th className="px-4 py-2 text-left font-medium" style={{ color: cmd.outline }}>Fecha</th>
              <th className="px-4 py-2 text-left font-medium" style={{ color: cmd.outline }}>ARS/USD</th>
              <th className="px-4 py-2 text-left font-medium" style={{ color: cmd.outline }}>Fuente</th>
              <th className="px-4 py-2 text-left font-medium" style={{ color: cmd.outline }}>Tipo</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-center" style={{ color: cmd.outline }}>
                  Sin histórico todavía.
                </td>
              </tr>
            ) : (
              history.map((r) => (
                <tr key={r.id} className="border-t" style={{ borderColor: cmd.border }}>
                  <td className="px-4 py-2" style={{ color: cmd.onSurface }}>{r.rate_date}</td>
                  <td className="px-4 py-2 font-semibold" style={{ color: cmd.onSurface }}>
                    {Number(r.official_exchange_rate_ars_per_usd).toLocaleString("es-AR")}
                  </td>
                  <td className="px-4 py-2" style={{ color: cmd.onSurfaceVariant }}>{r.source_name}</td>
                  <td className="px-4 py-2">
                    {r.manually_overridden ? (
                      <AdminBadge tone="violet">Override</AdminBadge>
                    ) : (
                      <AdminBadge tone="amber">Automático</AdminBadge>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </AdminCard>
    </div>
  );
}
