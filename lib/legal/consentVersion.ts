import "server-only";
import { createHash } from "node:crypto";
import { LEGAL_DOCUMENTS, DATED_CONSENT_VERSION, type LegalDocumentKey } from "@/lib/legal/versions";
import { TERMS_SECTIONS } from "@/lib/legal/termsText";
import { PRIVACY_SECTIONS } from "@/lib/legal/privacyText";
import { RESIDENCE_TERMS_SECTIONS } from "@/lib/legal/residenceTermsText";
import { FEE_ACKNOWLEDGEMENT_LABEL, RESIDENCE_RESPONSIBILITY_LABEL } from "@/lib/legal/clauses";
import { LEGAL_OPERATOR } from "@/lib/legal/operator";

/**
 * Versión de cada consentimiento (LEG-012): `AAAA-MM-DD+sha256:<16 hex>`. La fecha sale de `versions.ts`; el hash, del texto exacto
 * que se muestra (mismo módulo de datos que usa la página). Así, ante un reclamo, la fila de `consents` prueba qué texto se aceptó.
 * Un consentimiento sin texto registrado acá usa `DATED_CONSENT_VERSION` (sin hash).
 */
const SOURCES: Record<LegalDocumentKey, () => unknown> = {
  terms: () => ({ operator: LEGAL_OPERATOR, sections: TERMS_SECTIONS }),
  privacy: () => ({ operator: LEGAL_OPERATOR, sections: PRIVACY_SECTIONS }),
  residence_terms: () => RESIDENCE_TERMS_SECTIONS,
  estured_fee_terms: () => FEE_ACKNOWLEDGEMENT_LABEL,
  residence_responsibility: () => RESIDENCE_RESPONSIBILITY_LABEL,
};

const cache = new Map<LegalDocumentKey, string>();

export function legalTextHash(key: LegalDocumentKey): string {
  const hit = cache.get(key);
  if (hit) return hit;
  const hash = createHash("sha256").update(JSON.stringify(SOURCES[key]())).digest("hex").slice(0, 16);
  cache.set(key, hash);
  return hash;
}

function isLegalDocumentKey(value: string): value is LegalDocumentKey {
  return Object.prototype.hasOwnProperty.call(LEGAL_DOCUMENTS, value);
}

/** Versión a guardar en `consents.version` para un `consent_type`. */
export function consentVersion(consentType: string): string {
  if (!isLegalDocumentKey(consentType)) return DATED_CONSENT_VERSION;
  return `${LEGAL_DOCUMENTS[consentType].version}+sha256:${legalTextHash(consentType)}`;
}
