import type { Metadata } from "next";
import Link from "next/link";
import { cmd } from "@/components/admin/ui/tokens";
import { NegotiationsView } from "@/app/admin/activity/views/NegotiationsView";
import { ReservationsView } from "@/app/admin/activity/views/ReservationsView";
import { RenewalsView } from "@/app/admin/activity/views/RenewalsView";
import { RevocationsView } from "@/app/admin/activity/views/RevocationsView";
import { ReceiptsView } from "@/app/admin/activity/views/ReceiptsView";
import { WaitlistsView } from "@/app/admin/activity/views/WaitlistsView";
import { LogsView } from "@/app/admin/activity/views/LogsView";

export const metadata: Metadata = { title: "Actividad" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "negotiations", label: "Negociaciones" },
  { key: "reservations", label: "Reservas" },
  { key: "renewals", label: "Renovaciones" },
  { key: "revocations", label: "Revocaciones" },
  { key: "receipts", label: "Comprobantes" },
  { key: "waitlists", label: "Listas de espera" },
  { key: "logs", label: "Logs" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/**
 * Consolida 7 pantallas de solo lectura (trackers sin acción real del
 * admin más que ver/filtrar) que antes eran ítems separados del sidebar
 * — decisión del dueño (Ciclo 35, auditoría UX): nav de 21 a 15 ítems.
 * Cada pestaña reusa el componente original sin cambios de lógica
 * (`views/*View.tsx`, movidos desde `app/admin/<x>/page.tsx`, que
 * redirigen acá para no romper enlaces existentes).
 */
export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const tab = (TABS.some((t) => t.key === params.tab) ? params.tab : "negotiations") as TabKey;

  return (
    <div>
      <div className="border-b px-8 pt-8" style={{ borderColor: cmd.border }}>
        <h1 className="text-[28px] font-bold tracking-tight" style={{ color: cmd.onSurface }}>
          Actividad
        </h1>
        <p className="mt-1 text-sm" style={{ color: cmd.onSurfaceVariant }}>
          Negociaciones, reservas, renovaciones, revocaciones, comprobantes, listas de espera y logs — todo
          lo que es seguimiento, en un solo lugar.
        </p>
        <nav className="mt-5 flex flex-wrap gap-1.5 pb-0">
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <Link
                key={t.key}
                href={`/admin/activity?tab=${t.key}`}
                className="rounded-t-lg border-b-2 px-3.5 py-2 text-sm font-semibold transition-colors"
                style={{
                  borderColor: active ? cmd.primary : "transparent",
                  color: active ? cmd.primary : cmd.onSurfaceVariant,
                }}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {tab === "negotiations" && <NegotiationsView />}
      {tab === "reservations" && <ReservationsView />}
      {tab === "renewals" && <RenewalsView />}
      {tab === "revocations" && <RevocationsView />}
      {tab === "receipts" && <ReceiptsView />}
      {tab === "waitlists" && <WaitlistsView />}
      {tab === "logs" && <LogsView searchParams={searchParams} />}
    </div>
  );
}
