import type { Metadata } from "next";
import { ResidenceHero } from "@/components/residences/ResidenceHero";
import { BackToProfileLink } from "@/components/residences/BackToProfileLink";
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
import { loadFeaturedCandidates } from "@/lib/faq/featured";
import { FeaturedFaqManager } from "@/app/residence/[residence_id]/faq/FeaturedFaqManager";
import { ESSENTIAL_FAQ_IDS, FAQ_CATEGORIES, FICHA_FAQ_VISIBLE, countEssentialFaqsReady, effectiveAnswer, isEssentialFaq } from "@/lib/faq/catalog";
import { FEATURED_FAQ_MAX } from "@/lib/residences/featuredFaq";
import { normalizeOwnFaqItems } from "@/lib/residences/ownFaq";

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

  const [catalog, featured, ownFaqSection] = await Promise.all([
    loadCatalogForResidence(admin, residenceId),
    loadFeaturedCandidates(admin, residenceId),
    admin.from("residence_profile_sections").select("content").eq("residence_id", residenceId).eq("section_type", "faq").maybeSingle(),
  ]);
  // Preguntas propias del sistema anterior (texto libre, se editan en la configuración): solo se las nombra si existen.
  const ownFaqCount = normalizeOwnFaqItems((ownFaqSection.data?.content as { items?: unknown } | null)?.items).length;

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

  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <BackToProfileLink residenceId={residenceId} className="mb-2" />
      <ResidenceHero icon="forum" title="Preguntas frecuentes" subtitle="Lo que mostrás en tu ficha y lo que te preguntan." />
      <p className="text-sm text-ink-soft">
        Elegí qué preguntas del catálogo de EstuRed mostrar en tu ficha y ajustá las respuestas con los datos de tu residencia. Abajo
        respondés las preguntas libres de quienes miran tu ficha.
      </p>

      {pendingCount > 0 && (
        <div role="status" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-card border-[1.5px] border-amber-soft-300 bg-amber-soft-100 px-4 py-3">
          <p className="text-sm font-bold text-ink">
            Sin responder · {pendingCount} {pendingCount === 1 ? "pregunta de un visitante" : "preguntas de visitantes"}
          </p>
          <Link
            href="#preguntas-visitantes"
            className="rounded-field text-sm font-semibold text-forest-700 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Ir a responder
          </Link>
        </div>
      )}

      <section className="mt-8" aria-labelledby="faq-catalog-title">
        <h2 id="faq-catalog-title" className="text-lg font-bold text-ink">
          Catálogo de preguntas
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Cada pregunta trae una respuesta sugerida. Las que dicen «Texto fijo de EstuRed» no se editan; en el resto, completá los datos
          entre llaves {"{…}"} antes de mostrarlas. Lo que escribas acá no confirma disponibilidad ni precios: eso se informa en la ficha y
          en la solicitud.
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3" aria-label="Cómo se ordenan tus preguntas en la ficha">
          <div className="rounded-field border-[1.5px] border-line bg-cream px-4 py-3">
            <dt className="font-bold text-ink">Esenciales</dt>
            <dd className="mt-1 text-ink-soft">
              Cubren lo imprescindible: las que más se repiten antes de reservar. Hay {ESSENTIAL_FAQ_IDS.length} y están marcadas «Esencial».
            </dd>
          </div>
          <div className="rounded-field border-[1.5px] border-line bg-cream px-4 py-3">
            <dt className="font-bold text-ink">Destacadas</dt>
            <dd className="mt-1 text-ink-soft">
              Hasta {FEATURED_FAQ_MAX} que se ven primero en tu ficha. Las elegís más abajo, entre las que ya mostrás.
            </dd>
          </div>
          <div className="rounded-field border-[1.5px] border-line bg-cream px-4 py-3">
            <dt className="font-bold text-ink">El resto</dt>
            <dd className="mt-1 text-ink-soft">Las demás que elijas quedan detrás de «Ver todas las preguntas», ordenadas por tema.</dd>
          </div>
        </dl>
        <p className="mt-3 rounded-field bg-amber-soft-100 px-4 py-3 text-sm text-ink">
          Te recomendamos elegir hasta {FICHA_FAQ_VISIBLE} preguntas, para que se vean de entrada en tu ficha. Podés elegir más: las demás
          quedan detrás de «Ver todas las preguntas». Cuanto más completa esté tu ficha, menos consultas repetidas recibís y más solicitudes
          llegan con la decisión avanzada.
          {catalog.ok && (
            <span className="mt-1 block font-semibold">
              Elegiste {catalog.entries.filter((e) => e.selection?.is_selected).length} de {FICHA_FAQ_VISIBLE} recomendadas.
            </span>
          )}
        </p>
        {catalog.ok && (
          <p className="mt-3 rounded-field bg-forest-tint px-4 py-3 text-sm text-ink">
            Si respondés las esenciales en tu ficha, quien te escribe ya tiene la respuesta y llega con la decisión más avanzada. Te las
            recomendamos, pero no son obligatorias.
            <span className="mt-1 block font-semibold">
              Esenciales listas: {countEssentialFaqsReady(catalog.entries)} de {ESSENTIAL_FAQ_IDS.length}.
            </span>
          </p>
        )}
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
                return (
                  <details
                    key={category.key}
                    // El primer tema siempre abierto (para ver una pregunta a primera vista) y los que ya tienen elegidas.
                    open={selectedCount > 0 || index === 0}
                    className="group rounded-card border-[1.5px] border-line bg-cream-2/40"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3">
                      <span className="text-sm font-bold uppercase tracking-widest text-muted">{category.label}</span>
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
                          essential={isEssentialFaq(entry.id)}
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

      {featured.ok ? (
        <PermissionGate allowed={canManage} className="mt-8">
          <FeaturedFaqManager
            residenceId={residenceId}
            candidates={featured.candidates.map((c) => ({ ref: c.ref, question: c.question, order: c.order }))}
          />
        </PermissionGate>
      ) : (
        <section className="mt-8" aria-labelledby="faq-featured-title">
          <h2 id="faq-featured-title" className="text-lg font-bold text-ink">
            Preguntas destacadas
          </h2>
          <div className="mt-3">
            <EmptyState
              icon={featured.reason === "schema_pending" ? "hourglass_top" : "error"}
              title={featured.reason === "schema_pending" ? "Elegir destacadas todavía no está disponible" : "No pudimos cargar las destacadas"}
              description={
                featured.reason === "schema_pending"
                  ? "Lo estamos terminando de preparar en este entorno. Mientras tanto, tu ficha destaca las primeras 6 preguntas."
                  : "Probá de nuevo en unos minutos. Si sigue pasando, avisale a Soporte."
              }
            />
          </div>
        </section>
      )}

      <h2 id="preguntas-visitantes" className="mt-12 scroll-mt-20 text-lg font-bold text-ink">Preguntas de visitantes</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Quienes miran tu ficha pueden hacerte una pregunta libre. Respondé cuando puedas: las respuestas se publican
        debajo de tus preguntas frecuentes. No hay respuestas automáticas.
      </p>
      <p className="mt-2 rounded-field bg-amber-soft-100 px-3 py-2 text-xs font-semibold text-ink-soft">
        No publiques teléfonos ni enlaces para contactar por fuera de EstuRed. Las respuestas se ven en tu ficha pública.
      </p>
      <p className="mt-2 text-xs text-ink-faint">
        Las preguntas no muestran quién las hizo. No confirmes disponibilidad ni precios por acá: eso se informa en la
        ficha y en la solicitud.
        {ownFaqCount > 0 && (
          <>
            {" "}
            Las preguntas propias que escribiste antes del catálogo se editan en tu{" "}
            <Link href={`/residence/${residenceId}/profile#perfil-faq`} className="font-semibold text-forest-700 underline underline-offset-2">
              configuración
            </Link>
            .
          </>
        )}
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
                  <h2 className="text-sm font-bold uppercase tracking-widest text-muted">{section.title}</h2>
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
