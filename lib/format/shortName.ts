/**
 * Nombre corto de una persona: "Camila R." (auditoría 2026-10-20, H29).
 *
 * `student_profiles.last_initial` se guarda a veces con el punto ("R.") y a
 * veces sin él ("R"), así que concatenar `${last_initial}.` producía
 * "Camila R..". Este helper normaliza: deja una sola inicial en mayúscula y
 * exactamente un punto. Acepta valores nulos para usarlo directo con
 * relaciones opcionales de Supabase.
 */
export function formatInitial(lastInitial: string | null | undefined): string {
  const initial = (lastInitial ?? "").replace(/[.\s]+/g, "").charAt(0).toUpperCase();
  return initial ? `${initial}.` : "";
}

export function formatShortName(firstName: string | null | undefined, lastInitial: string | null | undefined): string {
  return [(firstName ?? "").trim(), formatInitial(lastInitial)].filter(Boolean).join(" ");
}
