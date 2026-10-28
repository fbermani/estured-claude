/**
 * Género por habitación (DR18 fase 2, punto 15). Lógica pura, sin I/O.
 *
 * `rooms.gender` (migración 0057) manda; si la columna aún no existe o viene
 * vacía se degrada al `room_types.gender_policy` del tipo (comportamiento previo).
 */

export const ROOM_GENDERS = ["masculino", "femenino", "mixto", "sin_especificar"] as const;
export type RoomGender = (typeof ROOM_GENDERS)[number];

export const ROOM_GENDER_LABEL: Record<RoomGender, string> = {
  masculino: "Masculina",
  femenino: "Femenina",
  mixto: "Mixta",
  sin_especificar: "Sin especificar",
};

export function isRoomGender(value: unknown): value is RoomGender {
  return typeof value === "string" && (ROOM_GENDERS as readonly string[]).includes(value);
}

/** gender_policy del tipo → género de habitación. */
export function genderFromPolicy(policy: string | null | undefined): RoomGender | null {
  if (policy === "solo_hombres") return "masculino";
  if (policy === "solo_mujeres") return "femenino";
  if (policy === "mixto") return "mixto";
  return null;
}

/** Género → vocabulario de gender_policy (para chips y textos que ya lo consumen). */
export function policyFromGender(gender: RoomGender | null): string | null {
  if (gender === "masculino") return "solo_hombres";
  if (gender === "femenino") return "solo_mujeres";
  if (gender === "mixto") return "mixto";
  return null;
}

export function isSharedCapacity(capacityPerRoom: number | null | undefined): boolean {
  return Number(capacityPerRoom ?? 1) > 1;
}

/**
 * Género efectivo de una habitación. Una compartida nunca queda «sin especificar»:
 * cae al género del tipo y, en última instancia, a «mixto».
 */
export function effectiveRoomGender(input: {
  roomGender: string | null | undefined;
  typePolicy: string | null | undefined;
  capacityPerRoom: number | null | undefined;
}): RoomGender {
  const shared = isSharedCapacity(input.capacityPerRoom);
  const own = isRoomGender(input.roomGender) ? input.roomGender : null;
  if (own && !(shared && own === "sin_especificar")) return own;
  const fromType = genderFromPolicy(input.typePolicy);
  if (fromType) return fromType;
  return shared ? "mixto" : "sin_especificar";
}

/** Validación server-side del género elegido para una habitación. */
export function validateRoomGender(
  value: unknown,
  capacityPerRoom: number | null | undefined,
): { ok: true; gender: RoomGender } | { ok: false; error: string } {
  if (!isRoomGender(value)) return { ok: false, error: "Elegí un género válido para la habitación." };
  if (value === "sin_especificar" && isSharedCapacity(capacityPerRoom)) {
    return { ok: false, error: "Una habitación compartida tiene que ser masculina, femenina o mixta." };
  }
  return { ok: true, gender: value };
}

const PLURAL: Record<RoomGender, [string, string]> = {
  masculino: ["masculina", "masculinas"],
  femenino: ["femenina", "femeninas"],
  mixto: ["mixta", "mixtas"],
  sin_especificar: ["sin especificar", "sin especificar"],
};

/**
 * Resumen por tipo para la ficha pública: «1 masculina, 1 femenina».
 * Si todas coinciden devuelve el género único («mixta»). Sin habitaciones: null.
 */
export function summarizeTypeGenders(genders: RoomGender[]): string | null {
  if (genders.length === 0) return null;
  const counts = new Map<RoomGender, number>();
  for (const g of genders) counts.set(g, (counts.get(g) ?? 0) + 1);
  const specified = ROOM_GENDERS.filter((g) => counts.has(g) && g !== "sin_especificar");
  if (counts.size === 1) {
    const only = [...counts.keys()][0];
    return only === "sin_especificar" ? null : PLURAL[only][0];
  }
  return ROOM_GENDERS.filter((g) => counts.has(g))
    .filter((g) => g !== "sin_especificar" || specified.length === 0)
    .map((g) => {
      const n = counts.get(g)!;
      return `${n} ${PLURAL[g][n === 1 ? 0 : 1]}`;
    })
    .join(", ");
}

/**
 * Si cambia el género/capacidad de un tipo, el valor heredado pasa de `from` a `to`.
 * Devuelve null si no cambia nada (las habitaciones editadas a mano no coinciden con `from` y se respetan).
 */
export function inheritedGenderChange(
  before: { policy: string | null | undefined; capacity: number | null | undefined },
  after: { policy: string | null | undefined; capacity: number | null | undefined },
): { from: RoomGender; to: RoomGender } | null {
  const from = effectiveRoomGender({ roomGender: null, typePolicy: before.policy, capacityPerRoom: before.capacity });
  const to = effectiveRoomGender({ roomGender: null, typePolicy: after.policy, capacityPerRoom: after.capacity });
  return from === to ? null : { from, to };
}
