import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { StayChangeModal } from "@/components/students/StayChangeModal";
import { StayChangeEditModal } from "@/components/students/StayChangeEditModal";
import { StayChangeCancelModal } from "@/components/students/StayChangeCancelModal";
import { StayChangeSteps } from "@/components/students/StayChangeSteps";
import { StayChangeResponse } from "@/components/students/StayChangeResponse";
import { KeepSearchingButton, ResponseSeenMarker } from "@/components/students/StayChangeInlineActions";
import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import type { StudentStayChangeView } from "@/lib/stayChange/load";
import { arDateOf } from "@/lib/stayChange/ui";
import { advanceGateMessage } from "@/lib/stayChange/advanceGate";
import { EXIT_INITIATED_BY_RESIDENCE_NOTE } from "@/lib/stayChange/copy";

export type StayChangeCardProps = {
  view: StudentStayChangeView | null;
  residenceName: string;
  contractEndLabel: string;
  contractEndDate: string | null;
  familyName: string | null;
  isMinor: boolean;
  /** Renovación aceptada con pago/fee en curso: se resuelve primero (docs/04 §12bis.4). */
  renewalLock: boolean;
  /** Detalle de la reserva (comprobante) para "Ver condiciones de mi reserva". */
  conditionsHref: string | null;
  /** Cuándo vence el preaviso de 48 h (`payment_unlocked_at`), ISO. */
  advanceAtIso: string | null;
  advanceHours: number;
  now: Date;
};

/** Avisos de sistema que van ARRIBA de todo en Mi residencia: por vencer (warning) y resuelto (success). */
export function StayChangeTopNotices({ view, residenceName, contractEndLabel }: Pick<StayChangeCardProps, "view" | "residenceName" | "contractEndLabel">) {
  if (!view) return null;
  if (view.ui.key === "open_expiring") {
    const days = Math.max(view.ui.daysToExpiry ?? 0, 0);
    return (
      <div role="status" className="flex flex-col gap-3 rounded-card border-[1.5px] border-orange/40 bg-warning-bg p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <Icon name="schedule" className="mt-0.5 text-2xl text-orange-700" />
          <div>
            <p className="font-bold text-ink">
              Tu aviso de cambio vence {days <= 0 ? "hoy" : days === 1 ? "mañana" : `en ${days} días`}. ¿Seguís buscando?
            </p>
            <p className="text-sm text-ink-soft">Si seguís buscando, lo extendemos 90 días más. Si no, se cierra solo y vuelve el límite de fechas.</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <KeepSearchingButton intentId={view.id} />
          <StayChangeCancelModal
            intentId={view.id}
            residenceName={residenceName}
            contractEndLabel={contractEndLabel}
            closableApplications={Math.max(view.linked.applications - view.linked.blockingApplicationIds.length, 0)}
            closableWaitlist={view.linked.waitlist}
            blockingApplicationIds={view.linked.blockingApplicationIds}
          />
        </div>
      </div>
    );
  }
  if (view.ui.key === "resolved") {
    return (
      <div role="status" className="flex items-start gap-3 rounded-card border-[1.5px] border-forest/30 bg-forest-tint p-4 sm:p-5">
        <Icon name="check_circle" className="mt-0.5 text-2xl text-forest-700" />
        <div>
          <p className="font-bold text-forest-700">
            Confirmaste una reserva en otra residencia{view.resolvedNewStartDate ? ` desde el ${formatDateOnly(view.resolvedNewStartDate)}` : ""}.
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            {residenceName} ya sabe la fecha de tu ingreso, sin el nombre de la nueva residencia. Tus listas de espera se anularon. {EXIT_INITIATED_BY_RESIDENCE_NOTE}
            {view.estimatedExitDate ? ` Salida prevista: ${formatDateOnly(view.estimatedExitDate)}.` : ""}
          </p>
        </div>
      </div>
    );
  }
  return null;
}

function Shortcut({
  href,
  icon,
  title,
  children,
  highlight = false,
}: {
  href: string;
  icon: string;
  title: string;
  children: ReactNode;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex min-h-[44px] flex-col gap-1.5 rounded-field border-[1.5px] p-3.5 transition-colors duration-200 ease-fresh focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${
        highlight ? "border-orange/50 bg-orange-tint/60 hover:border-orange" : "border-line bg-paper hover:border-forest hover:bg-forest-tint/50"
      }`}
    >
      <span className={`flex size-8 items-center justify-center rounded-full ${highlight ? "bg-orange-tint text-orange-700" : "bg-forest-tint text-forest-700"}`}>
        <Icon name={icon} className="text-lg" />
      </span>
      <span className="text-sm font-bold leading-tight text-ink">{title}</span>
      <span className="text-xs leading-snug text-ink-soft">{children}</span>
    </Link>
  );
}

const WHAT_HAPPENS = [
  { icon: "event_upcoming", title: "Tu residencia se entera con tiempo", text: "Recibe tu fecha estimada de salida y tu mensaje, si querés dejarlo." },
  { icon: "travel_explore", title: "Buscás sin esperar al fin del contrato", text: "Solicitá y sumate a listas de espera aunque las fechas se superpongan con tu estadía." },
  { icon: "request_quote", title: "Conocés los costos de salida antes de decidir", text: "Tu residencia te informa por escrito depósito, preaviso y entrega." },
];

const QUESTIONS = [
  { q: "¿Se cancela mi reserva si aviso?", a: "No. Tu reserva, tu lugar y tus pagos siguen igual hasta que te mudes. Avisar no te asegura lugar en otra residencia." },
  {
    q: "¿Qué ve mi residencia y qué no?",
    a: "Ve que estás buscando un cambio, tu fecha estimada de salida y tu mensaje si escribís uno. No ve a qué residencias escribís ni cuáles son tus solicitudes o listas de espera.",
  },
  {
    q: "¿Cuánto me cuesta irme antes?",
    a: `Depende de las condiciones de tu reserva. Tu residencia te informa por escrito costos y condiciones de salida; EstuRed no los fija ni los cobra. ${EXIT_INITIATED_BY_RESIDENCE_NOTE}`,
  },
];

/** Bloque "Quiero cambiar" de Mi residencia (SPEC §3): explicativo sin aviso, tarjeta de estado con aviso abierto. */
export function StayChangeCard(props: StayChangeCardProps) {
  const { view, residenceName, contractEndLabel, contractEndDate, familyName, isMinor, renewalLock, conditionsHref, advanceAtIso, advanceHours, now } = props;
  const closed = view && (view.ui.key === "cancelled" || view.ui.key === "expired") ? view : null;
  const active = view && (view.ui.key === "open_no_response" || view.ui.key === "open_responded" || view.ui.key === "open_expiring") ? view : null;
  const pendingFamily = view?.ui.key === "pending_family" ? view : null;
  const resolved = view?.ui.key === "resolved" ? view : null;

  const closedLine = closed
    ? closed.ui.key === "cancelled"
      ? `Cancelaste tu aviso de cambio el ${formatDateOnly(arDateOf(closed.resolvedAt ?? closed.createdAt))}.`
      : `Tu aviso de cambio venció el ${formatDateOnly(arDateOf(closed.expiresAt ?? closed.createdAt))}.`
    : null;

  return (
    <div id="quiero-cambiar" className="scroll-mt-24 space-y-5">
      {/* Sin aviso (o histórico) */}
      {!view || closed ? (
        <section aria-labelledby="stay-change-title" className="overflow-hidden rounded-card border-[1.5px] border-line bg-paper shadow-card">
          <div className="p-5 sm:p-6">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-orange-tint px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-orange-700">
              <Icon name="swap_horiz" className="text-sm" /> ¿Pensás en cambiarte?
            </p>
            <h2 id="stay-change-title" className="mt-3 font-display text-xl font-extrabold text-ink sm:text-2xl">
              Si querés cambiar de residencia, avisá con tiempo
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
              Avisale a {residenceName} con un botón, conocé de antemano los costos y condiciones de salida y consultá otras residencias aunque tu contrato siga
              vigente. Sin esconderte y sin sorpresas.
            </p>
            {closedLine && <p className="mt-3 rounded-field bg-cream-2 px-3.5 py-2 text-sm font-semibold text-ink-soft">{closedLine}</p>}

            <ul className="mt-5 grid gap-3 sm:grid-cols-3">
              {WHAT_HAPPENS.map((item) => (
                <li key={item.title} className="rounded-field border border-line bg-cream-2/50 p-4">
                  <span className="flex size-9 items-center justify-center rounded-full bg-forest-tint text-forest-700">
                    <Icon name={item.icon} className="text-xl" />
                  </span>
                  <p className="mt-2.5 text-sm font-bold text-ink">{item.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-soft">{item.text}</p>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-md text-xs leading-relaxed text-ink-soft">
                Avisar no cancela tu reserva ni te asegura lugar en otra residencia: toda solicitud está sujeta a confirmación. Lo cancelás cuando quieras.
              </p>
              {renewalLock ? (
                <p className="flex shrink-0 flex-wrap items-center gap-2 text-sm font-semibold text-orange-700">
                  <Icon name="sync" className="text-lg" /> Primero resolvé tu renovación.
                  <Link href="/students/renewals" className="font-bold text-forest-700 underline underline-offset-2">
                    Ver renovación
                  </Link>
                </p>
              ) : (
                <div className="shrink-0">
                  <StayChangeModal
                    residenceName={residenceName}
                    contractEndLabel={contractEndLabel}
                    contractEndDate={contractEndDate}
                    familyName={familyName}
                    isMinor={isMinor}
                    advanceHours={advanceHours}
                    triggerLabel={closed ? "Volver a avisar" : "Quiero cambiar"}
                    blockedUntilIso={view?.canNoticeAgainAt ?? null}
                  />
                </div>
              )}
            </div>

            <div className="mt-5 divide-y divide-line rounded-field border border-line">
              {QUESTIONS.map((item) => (
                <details key={item.q} className="group px-4 py-3 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
                    {item.q}
                    <Icon name="expand_more" className="shrink-0 text-xl text-ink-faint transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                  </summary>
                  <p className="pb-2 text-sm leading-relaxed text-ink-soft">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Menor: pendiente de su familiar */}
      {pendingFamily && (
        <section aria-labelledby="stay-change-title" className="overflow-hidden rounded-card border-[1.5px] border-orange/30 bg-paper shadow-card">
          <div className="bg-gradient-to-br from-orange-tint to-paper p-5 sm:p-6">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-orange-700">
              <Icon name="how_to_reg" className="text-sm" /> Pendiente de tu familiar
            </p>
            <h2 id="stay-change-title" className="mt-3 font-display text-xl font-extrabold text-ink sm:text-2xl">
              Tu familiar tiene que confirmar el aviso
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Todavía no se lo enviamos a {residenceName}. Cuando {familyName ?? "tu familiar vinculado"} lo confirme, tu residencia lo recibe y vas a poder buscar
              con fechas que se superponen.
            </p>
            <div className="mt-4">
              <StayChangeCancelModal
                intentId={pendingFamily.id}
                residenceName={residenceName}
                contractEndLabel={contractEndLabel}
                closableApplications={0}
                closableWaitlist={0}
                blockingApplicationIds={[]}
                withdrawLabel
              />
            </div>
          </div>
        </section>
      )}

      {/* Aviso abierto: tarjeta de estado */}
      {active && (
        <section aria-labelledby="stay-change-title" className="overflow-hidden rounded-card border-[1.5px] border-orange/30 bg-paper shadow-card">
          <div className="bg-gradient-to-br from-orange-tint to-paper p-5 sm:p-6">
            <p className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-orange-700">
              <span aria-hidden className="size-2 rounded-full bg-orange" /> Aviso abierto
            </p>
            <h2 id="stay-change-title" className="mt-2 font-display text-xl font-extrabold text-ink sm:text-2xl">
              Estás buscando un cambio
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Le avisaste a {residenceName} el {formatDateOnly(arDateOf(active.createdAt))}. Salida estimada:{" "}
              <strong className="text-ink">{active.estimatedExitDate ? formatDateOnly(active.estimatedExitDate) : "sin definir"}</strong>. Ya podés solicitar y
              sumarte a listas de espera aunque las fechas se superpongan con tu estadía.
            </p>
            {now.getTime() - new Date(active.createdAt).getTime() < 120_000 && (
              <p role="status" className="mt-3 flex items-start gap-2 rounded-field bg-success-bg px-3.5 py-2.5 text-sm font-semibold text-success-fg">
                <Icon name="check_circle" className="mt-0.5 shrink-0 text-lg" />
                Le avisamos a {residenceName}. Ya podés buscar con fechas que se superponen.
              </p>
            )}
            {advanceAtIso && new Date(advanceAtIso).getTime() > now.getTime() && (
              <p className="mt-3 flex items-start gap-2 rounded-field bg-paper/80 px-3.5 py-2.5 text-xs leading-relaxed text-ink-soft">
                <Icon name="schedule" className="mt-0.5 shrink-0 text-base text-orange-700" />
                {advanceGateMessage(new Date(advanceAtIso), "student")}
              </p>
            )}
            {!active.response && <p className="mt-3 text-sm font-semibold text-ink-soft">Tu residencia todavía no respondió.</p>}
          </div>

          <div className="space-y-5 p-5 sm:p-6">
            <StayChangeSteps uiKey={active.ui.key} hasResponse={!!active.response} />

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Shortcut href="/search" icon="search" title="Buscar residencias">
                Solicitud sujeta a confirmación
              </Shortcut>
              <Shortcut href="/students/applications" icon="description" title="Mis solicitudes">
                {active.linked.applications} de 2 activas por tu cambio
              </Shortcut>
              <Shortcut href="/students/waitlist" icon="hourglass_top" title="Listas de espera">
                {active.linked.waitlist} por tu cambio · te avisamos si se libera lugar
              </Shortcut>
              <Shortcut
                href="#respuesta-residencia"
                icon="mail"
                title="Mensaje de tu residencia"
                highlight={!!active.response && !active.response.seenByStudentAt}
              >
                {active.response ? `Respondió el ${formatDateOnly(arDateOf(active.response.respondedAt)).slice(0, 5)} · costos y condiciones` : "Todavía no respondió"}
              </Shortcut>
            </div>

            <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
                <Icon name="visibility_off" className="mt-0.5 shrink-0 text-base" />
                Las residencias que consultás no ven dónde vivís; ven que estás en proceso de mudanza.
              </p>
              <div className="flex shrink-0 flex-wrap items-center gap-1">
                <StayChangeEditModal
                  intentId={active.id}
                  residenceName={residenceName}
                  initialExitDate={active.estimatedExitDate}
                  initialMessage={active.studentMessage}
                  editsLeft={Math.max(active.maxEdits - active.editCount, 0)}
                />
                {active.ui.key !== "open_expiring" && (
                <StayChangeCancelModal
                  intentId={active.id}
                  residenceName={residenceName}
                  contractEndLabel={contractEndLabel}
                  closableApplications={Math.max(active.linked.applications - active.linked.blockingApplicationIds.length, 0)}
                  closableWaitlist={active.linked.waitlist}
                  blockingApplicationIds={active.linked.blockingApplicationIds}
                />
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Respuesta de la residencia (abierto o resuelto) */}
      {(active ?? resolved)?.response && (
        <>
          <StayChangeResponse
            id="respuesta-residencia"
            response={(active ?? resolved)!.response!}
            residenceName={residenceName}
            variant="student"
            conditionsHref={conditionsHref}
          />
          <ResponseSeenMarker intentId={(active ?? resolved)!.id} alreadySeen={!!(active ?? resolved)!.response!.seenByStudentAt} />
        </>
      )}
    </div>
  );
}
