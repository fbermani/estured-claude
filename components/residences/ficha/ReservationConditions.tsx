import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { ConditionCard } from "@/components/residences/ficha/ConditionCard";
import { formatArs, usdToArsRounded } from "@/lib/mock/exchange";
import { buildConditionItems, type ConditionItem, type FichaConditionsInput } from "@/lib/residences/fichaConditions";

const MES_VACIO_BACK =
  "Si reservás con ingreso a futuro y la plaza queda realmente vacía antes de que entres, la residencia puede cobrarte esos meses al porcentaje que fijó. Solo aplica si la residencia lo cobra y lo confirma. Para más detalle, mirá la ";

const COORDINAR = "A coordinar con la residencia";

/**
 * Condiciones de admisión (DR30 §4): SEIS tarjetas fijas, mismas en todas las residencias y en este orden:
 * Para reservar, Matrícula, Depósito, Ajuste de tarifa, Mes vacío, Documentos para admisión. Si un dato no
 * está cargado se dice («No aplica», «No cobra», «A coordinar»), nunca se inventa ni se oculta la tarjeta.
 */
export function ReservationConditions({
  conditions,
  arsPerUsd,
}: {
  conditions: FichaConditionsInput;
  arsPerUsd: number;
}) {
  const items = buildConditionItems(conditions);
  const by = (key: ConditionItem["key"]) => items.find((i) => i.key === key);
  const ars = (item: ConditionItem | undefined) =>
    item?.arsFromUsd != null ? (
      <>
        ≈ {formatArs(usdToArsRounded(item.arsFromUsd, arsPerUsd))}
        <ExchangeRateNote />
      </>
    ) : undefined;

  const initial = by("initial_payment");
  const enrollment = by("enrollment");
  const deposit = by("deposit");
  const adjustment = by("adjustment");
  const percent = conditions.emptyMonthChargePercent;
  const chargesEmpty = percent != null && percent > 0;

  return (
    <ul className="grid grid-cols-2 sm:auto-rows-fr gap-2.5 sm:gap-3 lg:grid-cols-3">
      <ConditionCard
        icon="payments"
        title="Para reservar"
        value={initial?.value ?? COORDINAR}
        note={ars(initial)}
        detail={initial?.help ?? "El pago inicial lo define la residencia."}
      />
      <ConditionCard
        icon="badge"
        title="Matrícula"
        value={enrollment?.value ?? "No cobra"}
        note={enrollment?.valueNote ?? ars(enrollment)}
        detail={
          <>
            {enrollment?.help ?? "Esta residencia no cobra cargo de ingreso."}
            {enrollment?.arsFromUsd != null && <span className="mt-1 block text-ink-faint">{ars(enrollment)}</span>}
          </>
        }
      />
      <ConditionCard
        icon="savings"
        title="Depósito"
        value={deposit?.value ?? "No cobra"}
        note={ars(deposit)}
        detail={deposit?.help ?? "Esta residencia no pide depósito."}
      />
      <ConditionCard
        icon="trending_up"
        title="Ajuste de tarifa"
        value={adjustment?.value ?? COORDINAR}
        detail={adjustment?.help ?? "La residencia te indica cada cuánto puede actualizar la tarifa."}
      />
      <ConditionCard
        icon="hourglass_top"
        title="Mes vacío"
        value={chargesEmpty ? `Esta residencia cobra mes vacío (${percent} %)` : "No cobra mes vacío"}
        detail={
          <>
            {MES_VACIO_BACK}
            <a href="#preguntas" className="font-bold text-forest-700 underline underline-offset-2">
              pregunta frecuente sobre mes vacío
            </a>
            .
          </>
        }
      />
      <ConditionCard
        icon="description"
        title="Documentos para admisión"
        value={COORDINAR}
        detail="Los documentos que necesita la residencia para admitirte los define ella y te los pide una vez que tu solicitud avanza."
      />
    </ul>
  );
}
