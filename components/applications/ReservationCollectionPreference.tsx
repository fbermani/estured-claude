import { Icon } from "@/components/ui/Icon";
import {
  COLLECTION_COORDINATE_LABEL,
  COLLECTION_LIABILITY_NOTICE,
  COLLECTION_PREFERENCE_NOTICE,
  COLLECTION_SECTION_TITLE,
  contactCollectionNotice,
  methodsPreferenceNotice,
  type ReservationCollectionOffer,
} from "@/lib/residences/offeredPaymentMethods";

/**
 * Sección «Cómo te van a cobrar la reserva» del formulario de solicitud (DR63 (c), `docs/00`). Va DENTRO del `<form>` de `ApplyForm`:
 * la preferencia viaja en el campo `preferred_payment_method` (vacío = «Lo coordino con la residencia»).
 *
 * Solo muestra el NOMBRE de los medios aceptados con datos aprobados. Nunca datos de cobro ni datos de contacto de la residencia: el
 * estudiante no contacta a la residencia (DR63 (j) 2); los datos de pago le llegan por su solicitud, si la residencia la acepta.
 * Sin estado ni JS: son radios nativos (teclado, foco y envío del navegador), por eso sirve igual con el paso oculto.
 */
export function ReservationCollectionPreference({
  offer,
  isMinor,
  headingNumber,
}: {
  offer: ReservationCollectionOffer;
  /** Con un menor, el contacto de la residencia es siempre con el familiar vinculado (DR63 (m)). */
  isMinor: boolean;
  /** Número de la sección dentro del formulario («3», «4»…), para seguir la numeración de los otros bloques. */
  headingNumber: string;
}) {
  return (
    <section aria-labelledby="apply-collection-title" className="rounded-field border border-line-2 bg-cream-2/50 p-4">
      <h3 id="apply-collection-title" className="text-xs font-bold text-muted">
        {headingNumber}. {COLLECTION_SECTION_TITLE}
      </h3>

      {offer.kind === "methods" ? (
        <fieldset className="mt-2 min-w-0">
          <legend className="text-sm font-semibold text-ink">Esta residencia cobra la reserva con estos medios. ¿Cuál preferís?</legend>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {offer.methods.map((method) => (
              <ChipRadio key={method.key} value={method.key} label={method.label} />
            ))}
            <ChipRadio value="" label={COLLECTION_COORDINATE_LABEL} defaultChecked />
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-ink-soft">
            {COLLECTION_PREFERENCE_NOTICE} {methodsPreferenceNotice(isMinor)}
          </p>
        </fieldset>
      ) : (
        <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-ink-soft">
          <Icon name="chat" className="mt-0.5 shrink-0 text-base text-forest-700" />
          <span>{contactCollectionNotice(isMinor)}</span>
        </p>
      )}

      <p className="mt-3 flex items-start gap-2 border-t border-line-2 pt-3 text-xs leading-relaxed text-ink-soft">
        <Icon name="shield" className="mt-0.5 shrink-0 text-base text-forest-700" />
        <span>{COLLECTION_LIABILITY_NOTICE}</span>
      </p>
    </section>
  );
}

function ChipRadio({ value, label, defaultChecked }: { value: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="relative cursor-pointer">
      <input type="radio" name="preferred_payment_method" value={value} defaultChecked={defaultChecked} className="peer sr-only focus-visible:outline-none" />
      <span className="block rounded-full border border-line-2 bg-paper px-3.5 py-1.5 text-sm font-semibold text-ink-soft transition-colors hover:border-forest peer-checked:border-forest peer-checked:bg-forest-tint peer-checked:text-forest-700 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-forest">
        {label}
      </span>
    </label>
  );
}
