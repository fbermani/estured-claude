/**
 * Rótulo del estado de una solicitud/reserva para el FAMILIAR vinculado (DR4). `getVisibleStatus` redacta para el
 * estudiante en segunda persona ("Pagá…", "…por vos"); el familiar sigue el proceso de otra persona, así que esos pocos
 * rótulos se pasan a tercera persona sin tocar el helper oficial ni los estados (docs/04). Cualquier otro rótulo ya es neutro.
 */
const THIRD_PERSON: Record<string, string> = {
  "Pagá a la residencia": "Pago a la residencia pendiente",
  "Pagá el fee EstuRed": "Fee EstuRed por pagar",
  "Cancelada por vos": "Cancelada por el estudiante",
  "Reserva cancelada por vos": "Reserva cancelada por el estudiante",
  "Reserva revocada por vos": "Reserva revocada por el estudiante",
};

export function familyStatusLabel(label: string): string {
  return THIRD_PERSON[label] ?? label;
}
