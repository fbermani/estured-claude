import { Icon } from "@/components/ui/Icon";
import type { ApplicantNotShared, ApplicantProfileView } from "@/lib/applications/applicantProfile";

const NOT_SHARED_LABEL: Record<ApplicantNotShared, string> = {
  bio: "su presentación",
  habits: "sus hábitos",
  interests: "sus intereses",
};

/** "su presentación, sus hábitos y sus intereses" */
function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

export function ApplicantAvatar({ initial, className = "" }: { initial: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-forest-tint font-bold text-forest-700 ${className}`}
    >
      {initial}
    </span>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-field bg-cream-2 px-3 py-3">
      <dt className="text-xs font-bold uppercase tracking-widest text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function Chips({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-widest text-muted">{title}</h4>
      <ul className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item} className="rounded-full bg-forest-tint px-3 py-1 text-xs font-semibold text-forest-700">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * "Quién solicita" (D32, Ciclo 51): perfil académico + intereses de quien
 * pide el lugar, tal como lo armó `buildApplicantProfile` en el servidor.
 * Solo lectura: acá no se calcula ninguna regla de privacidad, solo se
 * muestra lo que ya llegó filtrado (menor / interruptores de visibilidad).
 */
export function ApplicantProfileBlock({
  applicant,
  beforeContact,
}: {
  applicant: ApplicantProfileView;
  /** `true` mientras la solicitud todavía no tiene contacto establecido. */
  beforeContact: boolean;
}) {
  const tiles: { label: string; value: string }[] = [];
  if (applicant.age !== null) tiles.push({ label: "Edad", value: `${applicant.age} años` });
  if (applicant.career) tiles.push({ label: "Carrera", value: applicant.career });
  if (applicant.university) tiles.push({ label: "Universidad", value: applicant.university });
  if (applicant.origin) tiles.push({ label: "Origen", value: applicant.origin });

  const hasPresentation = applicant.bio || applicant.habits.length > 0 || applicant.interests.length > 0;

  return (
    <section aria-labelledby="applicant-title" className="mt-6 rounded-card border-[1.5px] border-line p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <ApplicantAvatar initial={applicant.avatarInitial} className="h-11 w-11 text-base" />
        <div className="min-w-0">
          <h3 id="applicant-title" className="text-xs font-bold uppercase tracking-widest text-muted">
            Quién solicita
          </h3>
          <p className="truncate text-base font-bold text-ink">{applicant.displayName}</p>
        </div>
      </div>

      {tiles.length > 0 ? (
        <dl className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] gap-2.5">
          {tiles.map((t) => (
            <Tile key={t.label} label={t.label} value={t.value} />
          ))}
        </dl>
      ) : (
        <p className="mt-4 text-sm text-ink-soft">Este estudiante todavía no completó datos de su perfil.</p>
      )}

      {applicant.bio && (
        <div className="mt-5">
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted">Sobre mí</h4>
          <p className="mt-1.5 whitespace-pre-line break-words text-sm leading-relaxed text-ink-soft">{applicant.bio}</p>
        </div>
      )}

      {(applicant.habits.length > 0 || applicant.interests.length > 0) && (
        <div className="mt-5 space-y-4">
          {applicant.habits.length > 0 && <Chips title="Hábitos de convivencia" items={applicant.habits} />}
          {applicant.interests.length > 0 && <Chips title="Intereses" items={applicant.interests} />}
        </div>
      )}

      {applicant.birthDateMissing ? (
        <p className="mt-5 flex items-start gap-2 rounded-field bg-info-bg px-3.5 py-3 text-sm leading-relaxed text-info-fg">
          <Icon name="info" className="mt-0.5 text-base" />
          <span>Este estudiante todavía no completó su fecha de nacimiento: mostramos solo lo básico.</span>
        </p>
      ) : applicant.isMinor ? (
        <p className="mt-5 flex items-start gap-2 rounded-field bg-info-bg px-3.5 py-3 text-sm leading-relaxed text-info-fg">
          <Icon name="family_restroom" className="mt-0.5 text-base" />
          <span>
            Es menor de edad: la solicitud la gestiona su familiar vinculado y por eso solo mostramos nombre, edad y
            carrera.
          </span>
        </p>
      ) : (
        <>
          {applicant.managedByFamily && (
            <p className="mt-5 flex items-start gap-2 rounded-field bg-info-bg px-3.5 py-3 text-sm leading-relaxed text-info-fg">
              <Icon name="family_restroom" className="mt-0.5 text-base" />
              <span>La solicitud la gestiona su familiar vinculado.</span>
            </p>
          )}
          {applicant.notShared.length > 0 && (
            <p className={`${hasPresentation ? "mt-4" : "mt-5"} flex items-start gap-2 text-xs leading-relaxed text-ink-faint`}>
              <Icon name="visibility_off" className="mt-px text-sm" />
              <span>El estudiante eligió no compartir {joinList(applicant.notShared.map((k) => NOT_SHARED_LABEL[k]))}.</span>
            </p>
          )}
        </>
      )}

      {beforeContact && (
        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-ink-faint">
          <Icon name="lock" className="mt-px text-sm" />
          <span>Antes de establecer contacto no mostramos documentos ni datos de contacto.</span>
        </p>
      )}
    </section>
  );
}
