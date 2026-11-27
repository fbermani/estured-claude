import Link from "next/link";
import { signOut } from "@/app/(public)/login/actions";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { InstagramIcon } from "@/components/ui/InstagramIcon";
import { DevAccountNotice } from "@/components/preapertura/DevAccountNotice";
import { LiveBand } from "@/components/preapertura/LiveBand";
import { INSTAGRAM_URL } from "@/lib/constants/contact";
import type { MiLugarData } from "@/lib/preapertura/miLugar";

const STEPS = [
  { icon: "instagram", title: "Seguinos en Instagram.", text: "Mostramos las visitas." },
  { icon: "notifications", title: "Esperá el aviso.", text: "Te escribimos apenas abramos." },
] as const;

const FOOTER_LINK =
  "inline-flex min-h-11 items-center rounded-field px-2 font-bold underline-offset-4 hover:text-ink hover:underline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest-ink";

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
 * «Registro listo» (DR67 d, g): número fijo de registro, qué hacer ahora y una sola acción principal. Estudiante con el perfil
 * incompleto: «Completar mi perfil». Con el perfil completo, familiar o cuenta sin fila de preapertura: Instagram. El número solo
 * aparece si está guardado (estudiantes, con la migración 0111). No dice que se mandó un mensaje: eso llega con el bloque B.
 */
export function MiLugarContent({ data, devAccount = false }: { data: MiLugarData; devAccount?: boolean }) {
  const isStudent = data.role === "student";
  const needsProfile = isStudent && !data.profileComplete;
  // Sin fila de preapertura = la cuenta ya existía (no nació acá).
  const hasAccount = data.role === null;
  return (
    <div>
      <LiveBand>
        <span id="pre-lugar-title">{hasAccount ? "Tu cuenta ya está lista" : "¡Listo! Ya estás adentro"}</span>
      </LiveBand>

      {data.registrationNumber != null && (
        <div className="grid justify-items-center gap-1.5 surface-forest bg-forest-ink px-5 py-6 text-paper">
          <p>Tu número de registro</p>
          <p className="pre-number font-display font-bold text-gold tabular-nums">{data.registrationNumber}</p>
        </div>
      )}

      <div className="grid gap-3.5 px-4 pb-6 pt-5 text-center sm:px-8">
        {devAccount && <DevAccountNotice />}
        <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-ink">¿Y ahora?</h1>

        {data.role === "family" && data.invitation && (
          <div className="text-left">
            <InvitationBox invitation={data.invitation} />
          </div>
        )}

        {needsProfile && (
          <Button href="/preregistro/perfil" variant="secondary" size="lg" className="w-full shadow-orange">
            Completar mi perfil
            <Icon name="arrow_forward" className="text-xl" />
          </Button>
        )}

        <ol className="grid gap-2 text-left">
          {STEPS.map((step) => (
            <li key={step.title} className="flex items-center gap-3 rounded-field border-[1.5px] border-line px-3 py-2.5 text-[15px] text-ink">
              {step.icon === "instagram" ? <InstagramIcon size={24} className="text-forest-700" /> : <Icon name={step.icon} className="shrink-0 text-forest-700" />}
              <span>
                <b>{step.title}</b> {step.text}
              </span>
            </li>
          ))}
        </ol>

        {/* Una sola acción naranja por pantalla: Instagram pasa a serlo cuando no queda perfil por completar. */}
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener"
          className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full px-5 font-bold transition duration-200 ease-out-fresh focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest-ink motion-safe:hover:-translate-y-0.5 ${
            needsProfile
              ? "border-[1.5px] border-forest bg-paper text-forest-700 hover:bg-forest-tint"
              : "bg-orange text-paper shadow-orange hover:bg-orange-600"
          }`}
        >
          <InstagramIcon />
          Seguir @estured.residencias
        </a>

        <div className="flex flex-wrap items-center justify-center gap-x-2 text-sm text-ink-soft">
          {isStudent && data.profileComplete && (
            <Link href="/preregistro/perfil" className={FOOTER_LINK}>
              Editar mi perfil
            </Link>
          )}
          <form action={signOut}>
            <button type="submit" className={FOOTER_LINK}>
              Salir
            </button>
          </form>
          <a href="/consentimientos#terminos" target="_blank" rel="noopener" className={FOOTER_LINK}>
            Términos
          </a>
          <a href="/consentimientos#privacidad" target="_blank" rel="noopener" className={FOOTER_LINK}>
            Privacidad
          </a>
        </div>
      </div>
    </div>
  );
}
