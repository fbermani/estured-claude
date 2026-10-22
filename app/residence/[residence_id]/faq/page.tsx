import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertResidenceAccess } from "@/lib/residences/access";
import { formatDate } from "@/lib/dates/format";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FaqQuestionCard } from "@/app/residence/[residence_id]/faq/FaqQuestionCard";

export const metadata: Metadata = { title: "Preguntas de visitantes" };
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
  if (!(await assertResidenceAccess(admin, sessionUser.id, residenceId))) notFound();

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
      <h1 className="text-2xl font-bold text-ink">Preguntas de visitantes</h1>
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
                        <FaqQuestionCard
                          residenceId={residenceId}
                          questionId={q.id}
                          status={q.status}
                          initialAnswer={q.answer ?? ""}
                        />
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
