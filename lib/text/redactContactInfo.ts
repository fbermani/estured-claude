/**
 * Oculta datos de contacto en texto libre que escribe un estudiante (presentación,
 * hábitos, intereses) antes de mostrárselo a una residencia ANTES de establecer
 * contacto: si no, alguien puede dejar su teléfono/email/Instagram en la bio y
 * evadir la plataforma (y el fee). Función PURA, sin dependencias.
 *
 * Cubre: emails, URLs y dominios, @usuarios, teléfonos (con o sin +54 9,
 * espacios, guiones, puntos y paréntesis; fijos con (011)) y menciones de
 * whatsapp/wsp/insta/telegram seguidas de un dato. NO cubre números escritos
 * en letras ("once cuatro…") ni ofuscaciones creativas: es una barrera
 * razonable, no una garantía.
 */
export const CONTACT_REDACTION = "[dato de contacto oculto]";

const KEYWORD_RE =
  /\b(?:whats\s?app|whatsap|wsp|wpp|wasap|insta(?:gram)?|telegram|tele|facebook|face|tiktok|snap(?:chat)?)\b(?:\s*[:=\-–—]\s*|\s+(?:(?:es|al|son)\s+)?)@?[\w.-]*[\d_.@][\w.@-]*/gi;
const EMAIL_RE = /[\w.+-]+(?:@|\s?\(at\)\s?|\s?\[at\]\s?)[\w-]+(?:\.[\w-]+)+/gi;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+/gi;
const DOMAIN_RE = /\b[\w-]+(?:\.[\w-]+)*\.(?:com|net|org|me|io|ly|app|co|ar)(?:\.ar)?\b(?:\/\S*)?/gi;
const HANDLE_RE = /(^|[^\w@])@[\w.]{2,}/g;
// Candidato a teléfono: arranca con + o dígito (o "(") y sigue con dígitos y separadores comunes.
const PHONE_CANDIDATE_RE = /\+?\(?\d[\d\s().-]{5,}\d/g;
const YEAR_RANGE_RE = /^(?:19|20)\d{2}\s*[-–/]\s*(?:19|20)\d{2}$/;

function countDigits(s: string): number {
  return (s.match(/\d/g) ?? []).length;
}

export function redactContactInfo(text: string): string {
  if (!text) return text;
  let out = text.replace(EMAIL_RE, CONTACT_REDACTION);
  out = out.replace(URL_RE, CONTACT_REDACTION);
  out = out.replace(DOMAIN_RE, CONTACT_REDACTION);
  out = out.replace(KEYWORD_RE, CONTACT_REDACTION);
  out = out.replace(HANDLE_RE, (_m, pre: string) => `${pre}${CONTACT_REDACTION}`);
  out = out.replace(PHONE_CANDIDATE_RE, (match) => {
    const digits = countDigits(match);
    if (digits < 8 || digits > 15) return match;
    if (YEAR_RANGE_RE.test(match.trim())) return match;
    return CONTACT_REDACTION;
  });
  // Varios reemplazos pegados quedan como uno solo.
  const escaped = CONTACT_REDACTION.replace(/[[\]]/g, "\\$&");
  return out.replace(new RegExp(`(?:${escaped}[\\s,;/-]*){2,}`, "g"), `${CONTACT_REDACTION} `).replace(/ +$/g, "").replace(/[ ]{2,}/g, " ");
}
