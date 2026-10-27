import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getResidenceMembership } from "@/lib/residences/access";
import { can } from "@/lib/residences/permissions";
import { PermissionGate } from "@/components/residences/PermissionGate";
import { formatDate } from "@/lib/dates/format";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FaqQuestionCard } from "@/app/residence/[residence_id]/faq/FaqQuestionCard";
import { FaqCatalogItem } from "@/app/residence/[residence_id]/faq/FaqCatalogItem";
import { loadCatalogForResidence } from "@/lib/faq/residenceCatalog";
import { FAQ_CATEGORIES, FICHA_FAQ_VISIBLE, effectiveAnswer } from "@/lib/faq/catalog";

export const metadata: Metadata = { title: "Preguntas frecuentes" };
export const dynamic = "force-dynamic";

type FaqRow = {
  id: string;
  question: string;
  answer: string | null;
  status: "pending" | "answered" | "hidden";
  created_at: string;
  answered_at: string | null;
};

const STATUS_BADGE: Record<FaqRow["status"], { label: string; tone: "amber" | "sage" | "neutral" }> = {
  pending: { label: "Sin responder", tone: "amber" },
  answered: { label: "Respondida · visible en tu ficha", tone: "sage" },
  hidden: { label: "Oculta", tone: "neutral" },
};

export default async function ResidenceFaqPage({ params }: { params: Promise<{ residence_id: string }> }) {
  const { residence_id: residenceId } = await params;
  const sessionUser = await getSessionUser();
  if (!sessionUser) notFound();
  const admin = getSupabaseAdmin();
  if (!admin) notFound();
  const membership = await getResidenceMembership(admin, sessionUser.id, residenceId);
  if (!membership) notFound();
  // DR11: sin `faq.manage` las acciones se ven deshabilitadas (solo presentación; el servidor valida cada acción).
  const canManage = can(membership, "faq.manage");

  const catalog = await loadCatalogForResidence(admin, residenceId);

  const { data, error } = await admin
    .from("residence_faq_questions")
    .select("id, question, answer, status, created_at, answered_at")
    .eq("residence_id", residenceId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) console.error("[residence/faq] query failed:", error);
  const rows = (data ?? []) as FaqRow[];

  const sections: { key: FaqRow["status"]; title: string; empty: string }[] = [
    { key: "pending", title: "Sin responder", empty: "No tenés preguntas pendientes." },
    { key: "answered", title: "Respondidas", empty: "Todavía no respondiste ninguna pregunta." },
    { key: "hidden", title: "Ocultas", empty: "" },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold text-ink">Preguntas frecuentes</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Elegí qué preguntas del catálogo de EstuRed mostrar en tu ficha y ajustá las respuestas con los datos de tu residencia. Abajo
        respondés las preguntas libres de quienes miran tu ficha.
      </p>

      <section className="mt-8" aria-labelledby="faq-catalog-title">
        <h2 id="faq-catalog-title" className="text-lg font-bold text-ink">
          Catálogo de preguntas
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Cada pregunta trae una respuesta sugerida. Las que dicen «Texto fijo de EstuRed» no se editan; en el resto, completá los datos
          entre llaves {"{…}"} antes de mostrarlas. Lo que escribas acá no confirma disponibilidad ni precios: eso se informa en la ficha y
          en la solicitud.
        </p>
        <p className="mt-3 rounded-field bg-amber-soft-100 px-4 py-3 text-sm text-ink">
          Te recomendamos elegir como máximo {FICHA_FAQ_VISIBLE} preguntas: son las que se ven de entrada en tu ficha. Las demás, y las que
          respondas de los visitantes, quedan detrás de «Ver todas las preguntas». Cuanto más respondas, más consultas vas a recibir por
          EstuRed.
          {catalog.ok && (
            <span className="mt-1 block font-semibold">
              Elegiste {catalog.entries.filter((e) => e.selection?.is_selected).length} de {FICHA_FAQ_VISIBLE} recomendadas.
            </span>
          )}
        </p>
        {!catalog.ok ? (
          <div className="mt-4">
            <EmptyState
              icon={catalog.reason === "schema_pending" ? "hourglass_top" : "error"}
              title={
                catalog.reason === "schema_pending"
                  ? "El catálogo todavía no está disponible"
                  : "No pudimos cargar el catálogo"
              }
              description={
                catalog.reason === "schema_pending"
                  ? "Lo estamos terminando de preparar en este entorno. Mientras tanto, tu ficha muestra solo tus preguntas fijas y las que respondés abajo."
                  : "Probá de nuevo en unos minutos. Si sigue pasando, avisale a Soporte."
              }
            />
          </div>
        ) : catalog.entries.length === 0 ? (
          <div className="mt-4">
            <EmptyState icon="quiz" title="El catálogo está vacío" description="Cuando EstuRed cargue preguntas, las vas a ver acá para elegir." />
          </div>
        ) : (
          <PermissionGate allowed={canManage} className="mt-4">
            <div className="space-y-3">
              {FAQ_CATEGORIES.map((category, index) => {
                const entries = catalog.entries.filter((e) => e.category === category.key);
                if (entries.length === 0) return null;
                const selectedCount = entries.filter((e) => e.selection?.is_selected).length;
                const anySelected = catalog.entries.some((e) => e.selection?.is_selected);
                return (
                  <details
                    key={category.key}
                    open={selectedCount > 0 || (!anySelected && index === 0)}
                    className="group rounded-card border-[1.5px] border-line bg-cream-2/40"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3">
                      <span className="text-sm font-extrabold uppercase tracking-widest text-muted">{category.label}</span>
                      <span className="rounded-full bg-cream-2 px-2 py-0.5 text-xs font-bold text-ink-soft">
                        {selectedCount} de {entries.length} en tu ficha
                      </span>
                    </summary>
                    <div className="space-y-3 px-3 pb-3">
                      {entries.map((entry) => (
                        <FaqCatalogItem
                          key={entry.id}
                          residenceId={residenceId}
                          questionId={entry.id}
                          question={entry.question_text}
                          owner={entry.owner}
                          suggestedAnswer={entry.suggested_answer}
                          initialSelected={entry.selection?.is_selected ?? false}
                          initialAnswer={effectiveAnswer(entry, entry.selection)}
                        />
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          </PermissionGate>
        )}
      </section>

      <h2 className="mt-12 text-lg font-bold text-ink">Preguntas de visitantes</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Quienes miran tu ficha pueden hacerte una pregunta libre. Respondé cuando puedas: las respuestas se publican
        debajo de tus preguntas frecuentes. No hay respuestas automáticas.
      </p>
      <p className="mt-2 rounded-field bg-amber-soft-100 px-3 py-2 text-xs font-semibold text-ink-soft">
        No publiques teléfonos ni enlaces para contactar por fuera de EstuRed. Las respuestas se ven en tu ficha pública.
      </p>
      <p className="mt-2 text-xs text-ink-faint">
        Las preguntas no muestran quién las hizo. No confirmes disponibilidad ni precios por acá: eso se informa en la
        ficha y en la solicitud. Para cambiar tus{" "}
        <Link
          href={`/residence/${residenceId}/profile`}
          className="font-semibold text-forest-700 underline underline-offset-2"
        >
          preguntas frecuentes fijas
        </Link>{" "}
        (hasta 5), editá tu perfil.
      </p>

      {error ? (
        <div className="mt-6">
          <EmptyState
            icon="error"
            title="No pudimos cargar las preguntas"
            description="Probá de nuevo en unos minutos. Si sigue pasando, avisale a Soporte."
          />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon="forum"
            title="Todavía no recibiste preguntas"
            description="Cuando alguien te escriba desde tu ficha, te avisamos y aparece acá."
          />
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {sections.map((section) => {
            const items = rows.filter((r) => r.status === section.key);
            if (section.key === "hidden" && items.length === 0) return null;
            return (
              <section key={section.key}>
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="text-sm font-extrabold uppercase tracking-widest text-muted">{section.title}</h2>
                  <span className="rounded-full bg-cream-2 px-2 py-0.5 text-xs font-bold text-ink-soft">
                    {items.length}
                  </span>
                </div>
                {items.length === 0 ? (
                  <p className="text-sm text-ink-faint">{section.empty}</p>
                ) : (
                  <div className="space-y-3">
                    {items.map((q) => (
                      <Card key={q.id} className="p-5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="min-w-0 whitespace-pre-line break-words font-semibold text-ink">{q.question}</p>
                          <Badge tone={STATUS_BADGE[q.status].tone}>{STATUS_BADGE[q.status].label}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-ink-faint">
                          Recibida el {formatDate(q.created_at)}
                          {q.answered_at && q.status !== "pending" ? ` · respondida el ${formatDate(q.answered_at)}` : ""}
                        </p>
                        <PermissionGate allowed={canManage}>
                          <FaqQuestionCard
                            residenceId={residenceId}
                            questionId={q.id}
                            status={q.status}
                            initialAnswer={q.answer ?? ""}
                          />
                        </PermissionGate>
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
