import { formatShortName } from "@/lib/format/shortName";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ScrollTable } from "@/components/ui/ScrollTable";
import { cmd } from "@/components/admin/ui/tokens";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { ResidentModerationActions } from "@/app/admin/community/ResidentModerationActions";
import { AdminFilterLinks } from "@/components/admin/ui/AdminFilterLinks";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const metadata: Metadata = { title: "Administración de comunidad" };
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, { label: string; tone: "amber" | "emerald" | "rose" | "neutral" }> = {
  created_by_residence: { label: "Cargado, sin invitar", tone: "amber" },
  pending_activation: { label: "Pendiente de activación", tone: "amber" },
  active: { label: "Activo", tone: "emerald" },
  visibility_limited: { label: "Visibilidad limitada (admin)", tone: "rose" },
  hidden_by_user: { label: "Oculto por el usuario", tone: "neutral" },
  inactive: { label: "Inactivo", tone: "neutral" },
};

const PAGE_SIZE = 25;

/** Filtros de estado (valores de `resident_stays.status`, docs/04). */
const STATUS_FILTERS: { key: string; label: string; statuses: string[] | null }[] = [
  { key: "todos", label: "Todos", statuses: null },
  { key: "activos", label: "Activos", statuses: ["active"] },
  { key: "limitados", label: "Visibilidad limitada", statuses: ["visibility_limited"] },
  { key: "ocultos", label: "Ocultos", statuses: ["hidden_by_user"] },
  { key: "pendientes", label: "Sin activar", statuses: ["created_by_residence", "pending_activation"] },
];

/** Saca caracteres que rompen la sintaxis de filtros de PostgREST (`,` `(` `)`) y comodines. */
function cleanTerm(raw: string): string {
  return raw.replace(/[,()%*\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

type StayRow = {
  id: string;
  status: string;
  residences: { name: string; public_area: string | null } | null;
  rooms: { label: string } | null;
  room_types: { name: string } | null;
  student_profiles: { first_name: string; last_initial: string } | null;
};

type SearchParams = { q?: string; estado?: string; page?: string };

export default async function AdminCommunityPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const sp = await searchParams;
  const term = cleanTerm(sp.q ?? "");
  const filter = STATUS_FILTERS.find((f) => f.key === sp.estado) ?? STATUS_FILTERS[0];
  const requestedPage = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const admin = getSupabaseAdmin();

  const hrefFor = (over: Partial<SearchParams>) => {
    const params = new URLSearchParams();
    const next = { q: term, estado: filter.key, page: "1", ...over };
    if (next.q) params.set("q", next.q);
    if (next.estado && next.estado !== "todos") params.set("estado", next.estado);
    if (next.page && next.page !== "1") params.set("page", next.page);
    const qs = params.toString();
    return qs ? `/admin/community?${qs}` : "/admin/community";
  };

  let stays: StayRow[] = [];
  let total = 0;
  let failed = false;
  let limitedCount = 0;
  const page = requestedPage;
  if (admin) {
    // Búsqueda en servidor: primero se resuelven las residencias y personas que coinciden y
    // después se filtran las estadías por esos ids (la búsqueda no depende del orden de creación).
    let idFilter: string | null = null;
    if (term) {
      const like = `%${term}%`;
      const firstToken = term.split(" ")[0];
      const [res, people] = await Promise.all([
        admin.from("residences").select("id").or(`name.ilike.${like},public_area.ilike.${like}`).limit(500),
        admin.from("student_profiles").select("id").ilike("first_name", `%${firstToken}%`).limit(500),
      ]);
      if (res.error || people.error) failed = true;
      const resIds = (res.data ?? []).map((r) => r.id as string);
      const personIds = (people.data ?? []).map((r) => r.id as string);
      const parts = [
        resIds.length ? `residence_id.in.(${resIds.join(",")})` : "",
        personIds.length ? `student_profile_id.in.(${personIds.join(",")})` : "",
      ].filter(Boolean);
      idFilter = parts.join(",");
    }
    const noMatches = term !== "" && !failed && idFilter === "";
    if (!noMatches && !failed) {
      let q = admin
        .from("resident_stays")
        .select(
          "id, status, residences(name, public_area), rooms(label), room_types(name), student_profiles(first_name, last_initial)",
          { count: "exact" },
        )
        .eq("is_current", true);
      if (filter.statuses) q = q.in("status", filter.statuses);
      if (idFilter) q = q.or(idFilter);
      const from = (page - 1) * PAGE_SIZE;
      const { data, count, error } = await q
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      // Página fuera de rango (p. ej. URL vieja tras un filtro): volver a la primera.
      if (error && page > 1) redirect(hrefFor({ page: "1" }));
      if (error) {
        console.error("[admin/community] query failed:", error);
        failed = true;
      } else {
        stays = (data as unknown as StayRow[]) ?? [];
        total = count ?? 0;
      }
    }
    const { count: limited } = await admin
      .from("resident_stays")
      .select("id", { count: "exact", head: true })
      .eq("is_current", true)
      .eq("status", "visibility_limited");
    limitedCount = limited ?? 0;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeTo = Math.min(total, page * PAGE_SIZE);
  const renderActions = (s: StayRow) =>
    ["active", "visibility_limited", "hidden_by_user"].includes(s.status) ? (
      <ResidentModerationActions residentStayId={s.id} status={s.status} />
    ) : (
      <span className="text-xs" style={{ color: cmd.outline }}>
        —
      </span>
    );
  const personName = (s: StayRow) =>
    s.student_profiles ? formatShortName(s.student_profiles.first_name, s.student_profiles.last_initial) : "—";

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight" style={{ color: cmd.onSurface }}>
            Administración de Comunidad
          </h1>
          <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
            Visibilidad y estado de los residentes activos en la comunidad de cada residencia.
          </p>
        </div>
        {limitedCount > 0 && <AdminBadge tone="rose">{limitedCount} con visibilidad limitada</AdminBadge>}
      </div>

      <form method="get" action="/admin/community" role="search" className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 basis-64">
          <label htmlFor="community-q" className="mb-1 block text-xs font-bold" style={{ color: cmd.outline }}>
            Buscar por persona o residencia
          </label>
          <input
            id="community-q"
            name="q"
            type="search"
            defaultValue={term}
            placeholder="Ej.: Lucía, Norte, Río de la Plata…"
            autoComplete="off"
            className="min-h-11 w-full rounded-field border bg-paper px-3 text-sm"
            style={{ borderColor: cmd.border, color: cmd.onSurface }}
          />
        </div>
        {filter.key !== "todos" && <input type="hidden" name="estado" value={filter.key} />}
        <button type="submit" className="min-h-11 rounded-full px-5 text-sm font-bold text-paper" style={{ backgroundColor: cmd.primary }}>
          Buscar
        </button>
        {term && (
          <Link href={hrefFor({ q: "" })} className="inline-flex min-h-11 items-center px-2 text-sm font-bold hover:underline" style={{ color: cmd.primary }}>
            Limpiar
          </Link>
        )}
      </form>

      <AdminFilterLinks
        label="Filtrar por estado"
        className="mt-3"
        items={STATUS_FILTERS.map((f) => ({ key: f.key, label: f.label, href: hrefFor({ estado: f.key, page: "1" }), on: f.key === filter.key }))}
      />

      {failed ? (
        <p role="alert" className="mt-4 text-sm font-semibold" style={{ color: cmd.rose }}>
          No pudimos cargar la comunidad. Recargá la pantalla; si sigue pasando, avisá a Soporte.
        </p>
      ) : (
        <p className="mt-4 text-sm tabular-nums" style={{ color: cmd.onSurfaceVariant }} aria-live="polite">
          {total === 0 ? "0 residentes" : `Mostrando ${rangeFrom}–${rangeTo} de ${total} residentes`}
          {term && ` para «${term}»`}.
        </p>
      )}

      <AdminCard className="mt-3 overflow-hidden p-0">
        {stays.length === 0 ? (
          <p className="p-6 text-sm" style={{ color: cmd.outline }}>
            {failed
              ? "—"
              : term || filter.statuses
                ? "Ningún residente coincide con la búsqueda o el filtro. Probá con otro nombre o limpiá los filtros."
                : "No hay residentes cargados todavía."}
          </p>
        ) : (
          <>
            <ul className="divide-y md:hidden" style={{ borderColor: cmd.border }} aria-label="Residentes de la comunidad">
              {stays.map((s) => {
                const status = STATUS_LABELS[s.status] ?? STATUS_LABELS.pending_activation;
                return (
                  <li key={s.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 font-bold" style={{ color: cmd.onSurface }}>
                        {personName(s)}
                      </p>
                      <div className="shrink-0">
                        <AdminBadge tone={status.tone}>{status.label}</AdminBadge>
                      </div>
                    </div>
                    <p className="mt-1 text-sm" style={{ color: cmd.onSurfaceVariant }}>
                      {s.residences?.name ?? "—"}
                      <span className="block text-xs" style={{ color: cmd.outline }}>
                        {s.residences?.public_area ?? "—"} · {s.rooms?.label ?? s.room_types?.name ?? "—"}
                      </span>
                    </p>
                    <div className="mt-3">{renderActions(s)}</div>
                  </li>
                );
              })}
            </ul>
            <div className="hidden md:block">
              <ScrollTable label="Residentes de la comunidad">
                <table className="w-full text-left text-sm">
                  <thead style={{ backgroundColor: cmd.surfaceContainer }}>
                    <tr>
                      {["Residencia", "Habitación", "Residente", "Estado", ""].map((h) => (
                        <th key={h} className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: cmd.border }}>
                    {stays.map((s) => {
                      const status = STATUS_LABELS[s.status] ?? STATUS_LABELS.pending_activation;
                      return (
                        <tr key={s.id}>
                          <td className="whitespace-nowrap px-4 py-3 font-bold" style={{ color: cmd.onSurface }}>
                            {s.residences?.name ?? "—"}
                            <span className="ml-1 font-normal" style={{ color: cmd.outline }}>
                              · {s.residences?.public_area ?? "—"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3" style={{ color: cmd.onSurfaceVariant }}>
                            {s.rooms?.label ?? s.room_types?.name ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3" style={{ color: cmd.onSurfaceVariant }}>
                            {personName(s)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <AdminBadge tone={status.tone}>{status.label}</AdminBadge>
                          </td>
                          <td className="px-4 py-3">{renderActions(s)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollTable>
            </div>
          </>
        )}
      </AdminCard>

      {totalPages > 1 && (
        <nav aria-label="Paginación" className="mt-4 flex items-center justify-between gap-3">
          {page > 1 ? (
            <Link href={hrefFor({ page: String(page - 1) })} rel="prev" className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold" style={{ border: `1.5px solid ${cmd.border}`, color: cmd.onSurfaceVariant }}>
              ← Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm tabular-nums" style={{ color: cmd.outline }}>
            Página {page} de {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={hrefFor({ page: String(page + 1) })} rel="next" className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold" style={{ border: `1.5px solid ${cmd.border}`, color: cmd.onSurfaceVariant }}>
              Siguiente →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
