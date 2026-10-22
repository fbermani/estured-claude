import { formatDate } from "@/lib/dates/format";
import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { cmd } from "@/components/admin/ui/tokens";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { HideFaqButton } from "@/app/admin/faq/HideFaqButton";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const metadata: Metadata = { title: "Preguntas de fichas" };
export const dynamic = "force-dynamic";

interface Row {
  id: string;
  question: string;
  answer: string | null;
  status: "pending" | "answered";
  created_at: string;
  residences: { name: string } | null;
}

/** Moderación mínima de la FAQ simple (D9): lista las preguntas visibles/pendientes y permite ocultarlas. */
export default async function AdminFaqPage() {
  await requireAdmin();
  const admin = getSupabaseAdmin();
  let rows: Row[] = [];
  let failed = false;
  if (admin) {
    const { data, error } = await admin
      .from("residence_faq_questions")
      .select("id, question, answer, status, created_at, residences(name)")
      .in("status", ["pending", "answered"])
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      console.error("[admin/faq] query failed:", error);
      failed = true;
    }
    rows = (data as unknown as Row[]) ?? [];
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="text-lg font-bold" style={{ color: cmd.onSurface }}>
        Preguntas de fichas
      </h1>
      <p className="text-xs" style={{ color: cmd.outline }}>
        Preguntas libres de visitantes y respuestas de las residencias (últimas 100). Ocultá lo que incluya datos de
        contacto, enlaces para contactar por fuera de EstuRed o contenido inapropiado.
      </p>
      {failed ? (
        <p className="mt-6 text-sm" style={{ color: cmd.rose }}>
          No pudimos cargar las preguntas. Probá de nuevo en unos minutos.
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm" style={{ color: cmd.outline }}>
          Todavía no hay preguntas para moderar.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <AdminCard className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <AdminBadge tone={r.status === "pending" ? "amber" : "emerald"}>
                        {r.status === "pending" ? "Sin responder" : "Respondida"}
                      </AdminBadge>
                      <span className="text-xs" style={{ color: cmd.outline }}>
                        {r.residences?.name} · {formatDate(r.created_at)}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-line break-words text-sm font-bold" style={{ color: cmd.onSurface }}>
                      {r.question}
                    </p>
                    {r.answer && (
                      <p
                        className="mt-1 whitespace-pre-line break-words text-sm"
                        style={{ color: cmd.onSurfaceVariant }}
                      >
                        {r.answer}
                      </p>
                    )}
                  </div>
                  <HideFaqButton questionId={r.id} />
                </div>
              </AdminCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
