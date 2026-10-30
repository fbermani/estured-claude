/** Reglas puras de la solicitud de vínculo y del código de casa (DR19). Sin Node: las usan también componentes de cliente. */

export const MAX_PENDING_LINK_REQUESTS = 3;
export const MAX_MISSING_RESIDENCE_REQUESTS = 3;
/** Sin 0/O/1/I/L para que se pueda dictar por teléfono o leer de un cartel. */
export const HOUSE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const HOUSE_CODE_LENGTH = 6;
export const LINK_REQUEST_MESSAGE_MAX = 280;

export type LinkRequestStatus = "pending" | "approved" | "rejected";
export const LINK_REQUEST_STATUS_LABELS: Record<LinkRequestStatus, string> = {
  pending: "Esperando a la residencia",
  approved: "Aprobada",
  rejected: "No aprobada",
};

/** Mayúsculas y sin espacios ni guiones; `null` si no tiene la forma de un código (no dice nada de si existe). */
export function normalizeHouseCode(raw: unknown): string | null {
  const code = String(raw ?? "").toUpperCase().replace(/[\s-]/g, "");
  return new RegExp(`^[${HOUSE_CODE_ALPHABET}]{${HOUSE_CODE_LENGTH}}$`).test(code) ? code : null;
}

export type LinkRequestCheck = { ok: true } | { ok: false; error: string };

/** Frenos anti-spam: se evalúan con los datos que lee el servidor. */
export function checkCanRequestLink(params: { hasCurrentStay: boolean; pendingTotal: number; pendingInSameResidence: boolean }): LinkRequestCheck {
  if (params.hasCurrentStay) return { ok: false, error: "Ya tenés una estadía vinculada. Si cambiaste de residencia, avisá a Soporte." };
  if (params.pendingInSameResidence) return { ok: false, error: "Ya le mandaste una solicitud a esa residencia. Esperá su respuesta." };
  if (params.pendingTotal >= MAX_PENDING_LINK_REQUESTS) {
    return { ok: false, error: `Tenés ${MAX_PENDING_LINK_REQUESTS} solicitudes esperando respuesta. Esperá a que te respondan antes de mandar otra.` };
  }
  return { ok: true };
}

export function cleanShortText(raw: unknown, max: number): string | null {
  const text = String(raw ?? "").replace(/\s+/g, " ").trim();
  const cut = text.slice(0, max).trim();
  return cut ? cut : null;
}

/** Nombre de residencia escrito a mano (DR21): sin caracteres de control ni `<>`, espacios colapsados, 2–120 caracteres. `null` si no sirve. */
export function sanitizeResidenceName(raw: unknown): string | null {
  const stripped = String(raw ?? "").replace(/[\u0000-\u001f\u007f<>]/g, " ");
  const name = cleanShortText(stripped, 120);
  return name && name.length >= 2 ? name : null;
}

/** Clave para agrupar el mismo nombre escrito distinto («Casa  Sur», «casa sur», «Casa Súr»). */
export function residenceNameKey(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export type MissingResidenceRow = { id: string; residence_name: string; contact: string | null; created_at: string; contacted_at: string | null };
export type MissingResidenceGroup = {
  /** Contactos distintos cargados por los estudiantes (dato no verificado). */
  contacts: string[];
  key: string;
  name: string;
  count: number;
  firstAt: string;
  contacted: boolean;
  ids: string[];
};

/** Agrupa pedidos por nombre. Un grupo cuenta como «contactado» solo si todos sus pedidos lo están (uno nuevo lo reabre). Pendientes primero. */
export function groupMissingResidences(rows: MissingResidenceRow[]): MissingResidenceGroup[] {
  const map = new Map<string, MissingResidenceGroup>();
  for (const r of rows) {
    const key = residenceNameKey(r.residence_name) || r.id;
    const g = map.get(key);
    if (!g) {
      map.set(key, { key, name: r.residence_name, count: 1, firstAt: r.created_at, contacts: r.contact ? [r.contact] : [], contacted: !!r.contacted_at, ids: [r.id] });
      continue;
    }
    g.count += 1;
    g.ids.push(r.id);
    if (r.created_at < g.firstAt) g.firstAt = r.created_at;
    if (r.contact && !g.contacts.includes(r.contact)) g.contacts.push(r.contact);
    if (!r.contacted_at) g.contacted = false;
  }
  return [...map.values()].sort((a, b) => Number(a.contacted) - Number(b.contacted) || b.count - a.count || a.firstAt.localeCompare(b.firstAt));
}

const EMAIL_STRICT = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/** Enlace manual para que el admin escriba desde su propio celular/mail (nunca API ni envío automático). `null` si el contacto no sirve. */
export function manualContactLink(contact: string | null, text: string): { kind: "whatsapp" | "email"; href: string } | null {
  const c = (contact ?? "").trim();
  if (!c) return null;
  if (EMAIL_STRICT.test(c)) {
    return { kind: "email", href: `mailto:${encodeURIComponent(c).replace(/%40/g, "@")}?subject=${encodeURIComponent("EstuRed: tus residentes ya tienen comunidad")}&body=${encodeURIComponent(text)}` };
  }
  const digits = c.replace(/\D/g, "");
  if (digits.length >= 8 && digits.length <= 15 && /^[+0-9()\-\s]+$/.test(c)) return { kind: "whatsapp", href: `https://wa.me/${digits}?text=${encodeURIComponent(text)}` };
  return null;
}

export function suggestedContactText(residenceName: string): string {
  return `Hola, te escribo del equipo de EstuRed. Algunos de tus residentes ya crearon su cuenta y nos contaron que viven en ${residenceName}. Si querés, te mostramos cómo sumar tu residencia: hoy no tiene costo y la comunidad solo se activa con tu aprobación.`;
}
