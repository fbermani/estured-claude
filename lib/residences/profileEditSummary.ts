/**
 * Resumen en texto de una edición de perfil pendiente (publicado → enviado),
 * para que la residencia la vea en lectura. Misma forma de datos que usa la
 * comparación del admin (`app/admin/profile-edits/ProfileEditDetail.tsx`).
 */

export const PROFILE_EDIT_FIELD_LABELS: Record<string, string> = {
  photos: "Fotos",
  services: "Servicios",
  rules: "Reglas y reglamento",
  minimum_stay_months: "Mínimo de estadía",
  room_types: "Tipos de habitación",
};

interface RoomTypeSnap {
  id?: string;
  name?: string;
  roomCount?: number;
  monthlyPriceUsd?: number;
}

export interface ProfileEditSummary {
  before: string;
  after: string;
}

function roomTypesText(types: RoomTypeSnap[]): string {
  if (types.length === 0) return "Sin tipos";
  return types
    .map((t) => {
      const rooms = t.roomCount != null ? ` (${t.roomCount} hab.)` : "";
      const price = t.monthlyPriceUsd != null ? ` · USD ${t.monthlyPriceUsd}` : "";
      return `${t.name ?? "—"}${rooms}${price}`;
    })
    .join("; ");
}

export function summarizeProfileEdit(fieldGroup: string, oldValue: unknown, newValue: unknown): ProfileEditSummary | null {
  const o = (oldValue ?? {}) as Record<string, unknown>;
  const n = (newValue ?? {}) as Record<string, unknown>;
  switch (fieldGroup) {
    case "minimum_stay_months": {
      const fmt = (v: unknown) => (typeof v === "number" && v > 0 ? `${v} meses` : "Sin mínimo");
      return { before: fmt(o.months), after: fmt(n.months) };
    }
    case "services": {
      const fmt = (v: unknown) => (Array.isArray(v) && v.length > 0 ? v.join(", ") : "—");
      return { before: fmt(o.items), after: fmt(n.items) };
    }
    case "rules": {
      const file = (n.rulesFile as { filename?: string } | null | undefined)?.filename;
      const summary = typeof n.summary === "string" && n.summary ? n.summary : "—";
      return {
        before: typeof o.summary === "string" && o.summary ? o.summary : "—",
        after: file ? `${summary} · Reglamento PDF: ${file}` : summary,
      };
    }
    case "room_types":
      return {
        before: roomTypesText((o.roomTypes as RoomTypeSnap[] | undefined) ?? []),
        after: roomTypesText((n.roomTypes as RoomTypeSnap[] | undefined) ?? []),
      };
    case "photos": {
      const count = Array.isArray(n.fileIds) ? n.fileIds.length : 0;
      return { before: "Fotos publicadas actuales", after: `${count} ${count === 1 ? "foto nueva" : "fotos nuevas"} en revisión` };
    }
    default:
      return null;
  }
}
