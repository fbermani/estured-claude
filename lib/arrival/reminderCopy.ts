import type { ReminderKey, ReminderRecipientKind } from "@/lib/arrival/reminderPlan";

/**
 * Copy de los avisos de llegada (DR29, lote 2B). Puro. Voseo rioplatense, cálido, sin promesas ni garantías de
 * disponibilidad. El familiar recibe una versión de SOLO LECTURA (no se le pide tildar nada).
 */

export type ReminderCopyInput = {
  kind: ReminderRecipientKind;
  key: ReminderKey;
  residenceName: string;
  /** Nombre corto del estudiante (solo se usa en la versión familiar). */
  studentFirstName?: string | null;
  /** Slug de la guía 02 (llegada); si no existe, el mail va sin ese enlace. */
  guideSlug?: string | null;
  /** Origen absoluto para los enlaces del mail (sin barra final). */
  baseUrl?: string;
};

export type ReminderCopy = { title: string; body: string; emailSubject: string; emailHtml: string };

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function studentBody(key: ReminderKey, residence: string): { title: string; body: string } {
  switch (key) {
    case "t14":
      return { title: "Faltan 14 días para tu llegada", body: `En dos semanas llegás a ${residence}. Es buen momento para repasar el checklist de llegada y ordenar lo que te falte.` };
    case "t7":
      return { title: "Falta una semana para tu llegada", body: `En 7 días llegás a ${residence}. Revisá tu checklist de llegada y la guía de primeros días.` };
    case "t2":
      return { title: "Faltan 2 días para tu llegada", body: `Pasado mañana llegás a ${residence}. Dale una última mirada al checklist y a lo que tenés que llevar.` };
    case "t0":
      return { title: "Hoy es tu llegada", body: `Hoy llegás a ${residence}. ¡Que sea un gran comienzo! Si algo no sale como esperabas, escribile a Soporte desde EstuRed.` };
  }
}

function familyBody(key: Extract<ReminderKey, "t7" | "t2">, residence: string, name: string): { title: string; body: string } {
  const who = name || "Tu familiar";
  const days = key === "t7" ? 7 : 2;
  return {
    title: `${who} llega en ${days} días`,
    body: `${who} llega a ${residence} en ${days} días. Podés seguir el avance de su checklist de llegada en EstuRed (solo lectura).`,
  };
}

export function buildReminderCopy(input: ReminderCopyInput): ReminderCopy {
  const residence = input.residenceName.trim() || "tu residencia";
  const name = (input.studentFirstName ?? "").trim();
  // Familiar: solo t7/t2 (cadencia cerrada); cualquier otro aviso cae a la versión t2 en vez de inventar texto.
  const famKey = input.key === "t7" ? "t7" : "t2";
  const base = input.kind === "family" ? familyBody(famKey, residence, name) : studentBody(input.key, residence);
  const baseUrl = (input.baseUrl ?? "https://estured.vercel.app").replace(/\/+$/, "");
  const guide = input.guideSlug ? `${baseUrl}/guias/${encodeURIComponent(input.guideSlug)}` : null;
  const html =
    `<p>${escapeHtml(base.body)}</p>` +
    (guide ? `<p><a href="${escapeHtml(guide)}">Leer la guía de llegada</a></p>` : "") +
    `<p><a href="${escapeHtml(baseUrl)}/students/dashboard">Ver la tarjeta «Tu llegada» en EstuRed</a></p>`;
  // Asunto sin nombre del estudiante (privacidad en bandejas compartidas) y sin saltos de línea.
  const subject = (input.kind === "family" ? `Tu familiar llega en ${famKey === "t7" ? 7 : 2} días` : base.title).replace(/[\r\n]/g, " ");
  return { title: base.title, body: base.body, emailSubject: subject, emailHtml: html };
}
