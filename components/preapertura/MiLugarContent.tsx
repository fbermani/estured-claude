import Link from "next/link";
import { signOut } from "@/app/(public)/login/actions";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { MiniCommunityRail } from "@/components/preapertura/MiniCommunityRail";
import type { RailCard } from "@/lib/preapertura/communityRail";
import type { MiLugarData } from "@/lib/preapertura/miLugar";

/** Los 5 pasos de `/for-students`, resumidos (SPEC pantalla 5). Es cómo va a funcionar al abrir, no una promesa de disponibilidad. */
const STEPS = [
  { icon: "search", title: "Creá tu cuenta y buscá", text: "Compará reglas y comunidad." },
  { icon: "edit_note", title: "Enviá tu solicitud", text: "Gratis y registrada." },
  { icon: "mark_email_read", title: "La residencia te responde", text: "Valores finales, sin costos ocultos." },
  { icon: "apartment", title: "Le pagás a la residencia", text: "Ella confirma que lo recibió." },
  { icon: "verified", title: "Recibís tu comprobante", text: "Fee de EstuRed aparte, a la vista." },
] as const;

function InvitationBox({ invitation }: { invitation: NonNullable<MiLugarData["invitation"]> }) {
  const who = invitation.studentFirstName;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card bg-cream p-4">
      <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-forest-tint font-display text-lg font-bold text-forest-700">
        {who ? who[0].toUpperCase() : <Icon name="person" className="text-2xl" />}
      </span>
      <p className="min-w-[180px] flex-1 text-sm text-ink-soft">
        {invitation.status === "linked" ? (
          <>
            <b className="block text-ink">{who ? `${who} aceptó tu invitación` : "Tu hijo/a aceptó tu invitación"}</b>
            Sus cuentas ya están vinculadas.
          </>
        ) : invitation.status === "expired" ? (
          <>
            <b className="block text-ink">La invitación a {invitation.maskedEmail} venció</b>
            Escribinos si necesitás ayuda.
          </>
        ) : (
          <>
            <b className="block text-ink">Invitamos a {invitation.maskedEmail}</b>
            Cuando acepte, sus cuentas quedan vinculadas. Avisale que revise su mail.
          </>
        )}
      </p>
      {invitation.status === "linked" ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-tint px-3 py-1.5 text-sm font-bold text-forest-700">
          <Icon name="link" className="text-lg" />
          Vinculados
        </span>
      ) : invitation.status === "expired" ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-2 px-3 py-1.5 text-sm font-bold text-ink-soft">
          <Icon name="event_busy" className="text-lg" />
          Venció
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-butter px-3 py-1.5 text-sm font-bold text-butter-fg">
          <Icon name="schedule" className="text-lg" />
          Esperando
        </span>
      )}
    </div>
  );
}

/**
 * «Mi lugar» final (SPEC pantalla 5): celebración con el #N real, panel que se activa al abrir, 5 pasos y carrusel. Variantes: perfil
 * incompleto (invita a completar), familiar (invitación esperando, vencida o vinculados) y cuenta sin fila de preapertura (básica).
 */
export function MiLugarContent({
  data,
  position,
  rail,
}: {
  data: MiLugarData;
  position: number | null;
  rail: { cards: RailCard[]; hasExamples: boolean };
}) {
  const isStudent = data.role === "student";
  const showBoost = isStudent && data.profilePercent != null && data.profilePercent < 100;
  return (
    <div>
      <div className="grid justify-items-center gap-2.5 bg-forest-ink px-5 pb-6 pt-8 text-center text-white sm:px-10 sm:pb-7 sm:pt-9">
        <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-gold text-forest-ink">
          <Icon name="check" className="text-4xl" />
        </span>
        <h1 id="pre-lugar-title" className="font-display text-[clamp(28px,7vw,40px)] leading-[1.05] tracking-[-0.03em]">
          {data.firstName ? `¡Listo, ${data.firstName}! Ya estás adentro.` : "¡Listo! Ya estás adentro."}
        </h1>
        <p id="pre-lugar-text" className="max-w-[44ch] text-base text-white/90">
          Te vas a enterar primero de las residencias verificadas y de todas las novedades.
        </p>
        {isStudent && position != null && (
          <div className="grid justify-items-center gap-1">
            <p className="inline-flex items-baseline gap-2 rounded-card border border-white/20 bg-white/10 px-4 py-2">
              <b className="font-display text-[34px] leading-none tabular-nums">
                <small aria-hidden="true" className="text-xl text-orange-light">
                  #
                </small>
                <span className="sr-only">Número </span>
                {position.toLocaleString("es-AR")}
              </b>
              <span className="text-sm text-white/90">tu lugar en el acceso anticipado</span>
            </p>
            <p className="text-sm text-white/85">Es el orden en que te sumaste: no da prioridad ni reserva nada.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 px-5 pb-6 pt-6 sm:px-10 sm:pb-8">
        {data.role === "family" && data.invitation && <InvitationBox invitation={data.invitation} />}

        {showBoost && (
          <div className="flex flex-wrap items-center gap-3 rounded-card border-l-4 border-orange bg-orange-tint p-4">
            <p className="min-w-[200px] flex-1 text-sm text-orange-700">
              <b className="block text-ink">Tu perfil está al {data.profilePercent}%.</b>
              Un perfil completo ayuda a que te conozcan mejor cuando abramos.
            </p>
            <Button href="/preregistro/perfil" variant="secondary" size="sm" className="shadow-orange">
              Completar perfil
            </Button>
          </div>
        )}

        <p className="flex items-center gap-3 rounded-card border-[1.5px] border-dashed border-line-2 bg-cream p-4 text-sm text-ink-soft">
          <Icon name="dashboard" className="shrink-0 rounded-field bg-butter p-1.5 text-2xl text-butter-fg" />
          <span>
            <b className="block text-ink">Cuando se active tu cuenta, acá vas a ver tu panel.</b>
            Y vas a poder buscar entre las residencias verificadas.
          </span>
        </p>

        <section aria-labelledby="pre-lugar-steps">
          <h2 id="pre-lugar-steps" className="mb-3 font-display text-xl font-bold text-ink">
            Así va a funcionar
          </h2>
          <ol className="grid gap-2.5 @min-[700px]:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex items-center gap-3 rounded-field border-[1.5px] border-line bg-paper p-3 @min-[700px]:flex-col @min-[700px]:items-start @min-[700px]:p-3.5">
                <span aria-hidden="true" className="relative grid size-10 shrink-0 place-items-center rounded-field bg-forest-tint text-forest-700">
                  <Icon name={s.icon} className="text-2xl" />
                  <i className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-orange text-xs font-bold not-italic text-white">{i + 1}</i>
                </span>
                <span>
                  <b className="block text-[15px] leading-tight text-ink">{s.title}</b>
                  <small className="mt-0.5 block text-sm leading-snug text-ink-soft">{s.text}</small>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="pre-lugar-rail" className="-mx-5 sm:-mx-10">
          <div className="flex flex-wrap items-center gap-2 px-5 sm:px-10">
            <h2 id="pre-lugar-rail" className="font-display text-xl font-bold text-ink">
              Se siguen sumando
            </h2>
            {rail.hasExamples && (
              <span className="inline-flex items-center gap-1 rounded-field bg-butter px-2 py-1 text-xs font-bold text-butter-fg">
                <Icon name="info" className="text-base" />
                Las marcadas «Ejemplo» son ilustrativas
              </span>
            )}
          </div>
          <MiniCommunityRail cards={rail.cards} hasExamples={rail.hasExamples} />
        </section>

        <div className="flex flex-wrap items-center justify-between gap-x-4 text-sm text-ink-soft">
          <div className="flex flex-wrap items-center gap-x-1">
            {isStudent && (
              <Link href="/preregistro/perfil" className="inline-flex min-h-11 items-center rounded-field px-2 font-bold text-ink-soft hover:text-ink hover:underline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest-ink">
                Editar mi perfil
              </Link>
            )}
            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-field px-2 font-bold text-ink-soft hover:text-ink hover:underline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest-ink"
              >
                Salir
              </button>
            </form>
          </div>
          <div className="flex flex-wrap items-center gap-x-1">
            <a href="/consentimientos#terminos" target="_blank" rel="noopener" className="inline-flex min-h-11 items-center rounded-field px-2 font-semibold hover:underline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest-ink">
              Términos
            </a>
            <a href="/consentimientos#privacidad" target="_blank" rel="noopener" className="inline-flex min-h-11 items-center rounded-field px-2 font-semibold hover:underline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest-ink">
              Privacidad
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
