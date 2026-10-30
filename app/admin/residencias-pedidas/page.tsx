import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { cmd } from "@/components/admin/ui/tokens";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { formatDate } from "@/lib/dates/format";
import { listMissingResidences } from "@/lib/residents/missingResidencesAdmin";
import { manualContactLink, suggestedContactText } from "@/lib/residents/linkRequestRules";
import { markContactedAction } from "@/app/admin/residencias-pedidas/actions";

export const metadata: Metadata = { title: "Residencias pedidas" };
export const dynamic = "force-dynamic";

/** Residencias que estudiantes nombraron y todavía no están en EstuRed (DR21). Solo admin; el contacto es manual (mail o wa.me desde tu celular). */
export default async function AdminMissingResidencesPage() {
  await requireAdmin();
  const admin = getSupabaseAdmin();
  if (!admin) return <p className="p-6 text-sm">No disponible en este momento.</p>;
  const result = await listMissingResidences(admin);

  const header = (
    <div>
      <h1 className="text-lg font-bold" style={{ color: cmd.onSurface }}>Residencias pedidas</h1>
      <p className="text-xs" style={{ color: cmd.outline }}>
        Estudiantes alojados que no encontraron su residencia. Escribiles vos, a mano, y marcala como contactada.
      </p>
    </div>
  );

  if (!result.ok) {
    return (
      <div className="space-y-3 p-6">
        {header}
        <p className="text-sm" style={{ color: cmd.outline }}>
          {result.missingSchema ? "Todavía no está disponible: falta aplicar las migraciones 0064 y 0065." : "No pudimos cargar los pedidos. Probá de nuevo."}
        </p>
      </div>
    );
  }

  const { groups } = result;
  const pending = groups.filter((g) => !g.contacted).length;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      {header}
      <p className="text-sm" style={{ color: cmd.onSurface }}>
        {groups.length === 0 ? "Todavía no hay pedidos." : `${pending} por contactar · ${groups.length - pending} contactadas`}
      </p>
      <ul className="space-y-3">
        {groups.map((g) => {
          const links = g.contacts.map((c) => ({ c, link: manualContactLink(c, suggestedContactText(g.name)) }));
          return (
            <li key={g.key}>
              <AdminCard className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: cmd.onSurface }}>{g.name}</span>
                    <AdminBadge tone={g.contacted ? "emerald" : "amber"}>{g.contacted ? "Contactada" : "Por contactar"}</AdminBadge>
                  </div>
                  <p className="text-xs" style={{ color: cmd.outline }}>
                    {g.count === 1 ? "1 estudiante la pidió" : `${g.count} estudiantes la pidieron`} · desde {formatDate(g.firstAt)}
                  </p>
                  <p className="text-xs" style={{ color: cmd.outline }}>
                    {g.contacts.length === 0 ? "Sin contacto indicado." : `Contacto indicado por estudiantes (dato no verificado): ${g.contacts.join(" · ")}`}
                  </p>
                </div>
                {!g.contacted &&
                  links.map(({ c, link }) =>
                    link ? (
                      <a key={c} href={link.href} target="_blank" rel="noopener noreferrer" className="rounded-full px-3 py-1.5 text-xs font-bold" style={{ border: `1.5px solid ${cmd.border}`, color: cmd.onSurface }}>
                        {link.kind === "whatsapp" ? "WhatsApp" : "Mail"} · {c}
                      </a>
                    ) : null,
                  )}
                {!g.contacted && (
                  <form action={markContactedAction}>
                    <input type="hidden" name="ids" value={g.ids.join(",")} />
                    <button type="submit" className="cursor-pointer rounded-full px-3 py-1.5 text-xs font-bold" style={{ backgroundColor: cmd.onSurface, color: "#fff" }}>
                      Marcar contactada
                    </button>
                  </form>
                )}
              </AdminCard>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
