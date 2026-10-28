import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { RESIDENCE_PERMISSION_KEYS } from "@/lib/residences/permissions";

/**
 * Test de cobertura de permisos (Ciclo 74, DR11): toda acción de ESCRITURA del área de residencias tiene su control en el servidor
 * documentado, o está en una lista blanca explícita con el motivo. Si alguien agrega una acción nueva bajo `app/residence/**`,
 * `lib/residences/**`, `lib/residents/**`, `lib/renewals/**`, `lib/waitlist-entries/**` o `lib/availability/**` y no le pone
 * `assertResidencePermission` / `assertResidenceOwner` / `assertResidenceAccess`, este test falla y obliga a decidir qué permiso lleva.
 */
const ROOT = process.cwd();
const SCAN_DIRS = ["app/residence", "lib/residences", "lib/residents", "lib/renewals", "lib/waitlist-entries", "lib/availability"].map((d) => join(...d.split("/")));

/** Archivo → controles que tiene que contener. `perm:` = `assertResidencePermission` con esa clave; el resto, el identificador literal. */
const GUARDED: Record<string, string[]> = {
  // Solicitudes y pagos
  "app/residence/[residence_id]/applications/actions.ts": ["assertResidencePermission(", "applications.review_contact", "applications.reject", "payments.residence"],
  "app/residence/[residence_id]/applications/[id]/negotiation/actions.ts": ["assertResidencePermission(", "applications.send_adjustment"],
  "lib/reservations/recordResidencePaymentReceived.ts": ["assertResidencePermission(", "payments.residence"],
  // Perfil: guardar es delegable; enviar a verificación, no
  "app/residence/[residence_id]/profile/actions.ts": ["assertResidencePermission(", "profile.edit", "assertResidenceOwner("],
  // Galería de fotos (DR18 t2) y promociones de tarifa (DR18 t3): ambas requieren `profile.edit`
  "app/residence/[residence_id]/profile/photoMetaActions.ts": ["assertResidencePermission(", "profile.edit"],
  "app/residence/[residence_id]/profile/promotionActions.ts": ["assertResidencePermission(", "profile.edit"],
  // Reglamento (DR14): publicar versiones requiere `profile.edit`
  "lib/regulations/publish.ts": ["assertResidencePermission(", "profile.edit"],
  // Operación
  "lib/residences/roomManagement.ts": ["assertResidencePermission(", "operations.rooms_availability"],
  "lib/availability/updateAvailability.ts": ["assertResidencePermission(", "operations.rooms_availability"],
  "lib/residents/createResidentStay.ts": ["assertResidencePermission(", "residents.manage"],
  "lib/residents/setResidentEmail.ts": ["assertResidencePermission(", "residents.manage"],
  "lib/residents/endResidentStay.ts": ["assertResidencePermission(", "residents.manage"],
  "lib/residents/updateStayDetails.ts": ["assertResidencePermission(", "residents.manage"],
  "lib/residents/addResidentNote.ts": ["assertResidencePermission(", "residents.manage"],
  "lib/stayChange/respondStayChangeIntent.ts": ["assertResidencePermission(", "residents.manage"],
  "lib/renewals/createRenewalOffer.ts": ["assertResidencePermission(", "renewals.manage"],
  "lib/renewals/sendRenewalOffer.ts": ["assertResidencePermission(", "renewals.manage"],
  "lib/renewals/recordRenewalResidencePaymentReceived.ts": ["assertResidencePermission(", "renewals.manage"],
  "lib/waitlist-entries/notifyWaitlistAvailability.ts": ["assertResidencePermission(", "waitlist.manage"],
  "lib/waitlist-entries/removeFromWaitlistByResidence.ts": ["assertResidencePermission(", "waitlist.manage"],
  "lib/faq/moderateResidenceQuestion.ts": ["assertResidencePermission(", "faq.manage"],
  // Solo dueño (no delegable)
  "lib/team/teamInvitations.ts": ["assertResidenceOwner("],
  "app/residence/dashboard/pdf/route.ts": ["ownerOnly: true"],
  // Siempre disponible para todo staff activo: solo exige el vínculo con la residencia
  "app/residence/[residence_id]/support/actions.ts": ["getResidenceMembership("],
};

/** Acciones de servidor "finas": no controlan nada ellas mismas, delegan en una función de lib que ya está en GUARDED. */
const DELEGATING: Record<string, string[]> = {
  "app/residence/[residence_id]/waitlist/actions.ts": ["@/lib/waitlist-entries/notifyWaitlistAvailability", "@/lib/waitlist-entries/removeFromWaitlistByResidence"],
  "app/residence/[residence_id]/residents/actions.ts": [
    "@/lib/residents/createResidentStay",
    "@/lib/residents/endResidentStay",
    "@/lib/residents/updateStayDetails",
    "@/lib/residents/addResidentNote",
    "@/lib/residences/roomManagement",
  ],
  "app/residence/[residence_id]/residents/stayChangeActions.ts": ["@/lib/stayChange/respondStayChangeIntent"],
  "app/residence/[residence_id]/faq/actions.ts": ["@/lib/faq/moderateResidenceQuestion"],
  "app/residence/[residence_id]/regulation/actions.ts": ["@/lib/regulations/publish"],
  "app/residence/[residence_id]/team/actions.ts": ["@/lib/team/teamInvitations"],
  "app/residence/[residence_id]/applications/[id]/payment/actions.ts": ["@/lib/reservations/recordResidencePaymentReceived"],
  "app/residence/[residence_id]/renewals/actions.ts": ["@/lib/renewals/createRenewalOffer", "@/lib/renewals/sendRenewalOffer", "@/lib/renewals/recordRenewalResidencePaymentReceived"],
  "app/residence/[residence_id]/availability/actions.ts": ["@/lib/availability/updateAvailability"],
  "app/residence/[residence_id]/rooms/actions.ts": ["@/lib/residences/roomManagement"],
};

/**
 * Lista blanca: archivos que escriben (o son acciones de servidor) y NO son una acción de equipo de residencia, con el motivo.
 * Agregar acá es una decisión consciente: ¿esta escritura la puede disparar un staff de residencia? Si sí, va en GUARDED.
 */
const ALLOWLIST: Record<string, string> = {
  "app/residence/settings/new/actions.ts": "sumar otra residencia: solo dueño por rol global (sin residence_id) y tope de 10; el staff no tiene el rol residence_owner",
  "app/residence/[residence_id]/regulation/RegulationEditor.tsx": "formulario cliente; publica solo vía publishRegulationAction (DELEGATING → publish, GUARDED)",
  "app/residence/[residence_id]/profile/ResidenceProfileForm.tsx": "formulario cliente; escribe solo vía saveResidenceProfile (GUARDED)",
  // Helpers que solo llaman acciones ya controladas
  "lib/residences/tariffLog.ts": "helper de saveResidenceProfile (GUARDED)",
  "lib/residences/customAmenitiesDb.ts": "helper de saveResidenceProfile (GUARDED) y del panel admin (reviewCustomAmenity)",
  "lib/residences/syncRoomsAndBeds.ts": "helper de saveResidenceProfile (GUARDED)",
  "lib/residences/privateDetails.ts": "helper del perfil y del alta; no lo llama ninguna acción de equipo",
  "lib/residences/profileEdits.ts": "helper de saveResidenceProfile y del panel admin",
  "lib/residents/linkReservation.ts": "helper de createResidentStay (GUARDED)",
  "lib/renewals/createPendingRenewalResidencePayment.ts": "helper de respondRenewalOffer (acción del estudiante)",
  "lib/availability/incrementAvailabilityOnRelease.ts": "helper de endResidentStay (GUARDED) y de cancelaciones",
  // Alta de residencia: la hace el dueño al registrarse / sumar otra
  "lib/residences/addResidenceForOwner.ts": "solo dueño por rol global; lo llama settings/new (ALLOWLIST)",
  // Admin
  "lib/residences/setResidencePausedByAdmin.ts": "solo admin (requireAdmin en la acción)",
  "lib/residences/setResidenceLocationByAdmin.ts": "solo admin",
  "lib/residences/setOperationalAccessByAdmin.ts": "solo admin",
  "lib/residents/setResidentVisibilityByAdmin.ts": "solo admin",
  "lib/residents/markResidentInactiveByAdmin.ts": "solo admin",
  "lib/renewals/reopenRenewalOffer.ts": "solo admin",
  "lib/renewals/reopenRenewalRequest.ts": "solo admin",
  "lib/renewals/confirmRenewalAfterFeePaid.ts": "solo admin / pago confirmado",
  "lib/renewals/recordRenewalManualFeePayment.ts": "solo admin",
  "lib/waitlist-entries/removeFromWaitlistByAdmin.ts": "solo admin",
  // Estudiante / familiar
  "lib/residents/setResidentVisibility.ts": "acción del estudiante sobre su propia estadía",
  "lib/residents/activateResidentStay.ts": "acción del estudiante / sistema al activar su cuenta",
  "lib/renewals/createRenewalRequest.ts": "acción del estudiante",
  "lib/renewals/respondRenewalOffer.ts": "acción del estudiante",
  "lib/renewals/registerRenewalManualFeePayment.ts": "acción del estudiante / familiar",
  "lib/waitlist-entries/joinWaitlist.ts": "acción del estudiante",
  "lib/waitlist-entries/leaveWaitlist.ts": "acción del estudiante",
  "lib/waitlist-entries/stayInWaitlist.ts": "acción del estudiante",
  "lib/waitlist-entries/activateFromWaitlist.ts": "acción del estudiante / sistema",
  // Sistema
  "lib/residents/extendResidentStayOnRenewal.ts": "sistema, al confirmarse una renovación",
  "lib/waitlist-entries/removeWaitlistEntriesOnConfirmedReservation.ts": "sistema, al confirmarse una reserva",
};

const norm = (p: string) => p.split(sep).join("/");

function walk(dir: string, out: string[] = []): string[] {
  let names: string[] = [];
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const read = (rel: string) => readFileSync(join(ROOT, ...rel.split("/")), "utf8");
const writes = (src: string) => /\.(insert|update|delete|upsert)\(/.test(src);
const isServerActionFile = (src: string) => src.slice(0, 200).includes('"use server"');

describe("cobertura de permisos en acciones de escritura (DR11)", () => {
  it("toda acción de escritura del área de residencias está controlada (GUARDED), delega en una controlada (DELEGATING) o está en la lista blanca", () => {
    const missing: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of walk(join(ROOT, dir))) {
        const rel = norm(relative(ROOT, file));
        const src = readFileSync(file, "utf8");
        if (!writes(src) && !isServerActionFile(src)) continue;
        if (rel in GUARDED || rel in DELEGATING || rel in ALLOWLIST) continue;
        missing.push(rel);
      }
    }
    expect(
      missing,
      `Estas acciones escriben y no tienen control de permiso documentado. Poné assertResidencePermission(...) con el permiso que corresponda, ` +
        `o agregalas a GUARDED / DELEGATING / ALLOWLIST (con el motivo) en este test:\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it("cada archivo GUARDED existe y contiene sus controles y las claves de permiso que corresponden", () => {
    for (const [rel, needles] of Object.entries(GUARDED)) {
      const src = read(rel);
      for (const needle of needles) expect(src, `${rel} debería contener «${needle}»`).toContain(needle);
    }
  });

  it("las acciones finas (DELEGATING) delegan en funciones que están controladas", () => {
    for (const [rel, libs] of Object.entries(DELEGATING)) {
      const src = read(rel);
      for (const lib of libs) {
        expect(src, `${rel} debería importar ${lib}`).toContain(lib);
        const libFile = `${lib.replace("@/", "")}.ts`;
        expect(libFile in GUARDED, `${lib} (usada por ${rel}) tiene que estar en GUARDED`).toBe(true);
      }
      // Una acción fina no escribe por su cuenta en tablas del negocio.
      expect(/\.(insert|update|delete|upsert)\(/.test(src), `${rel} delega: no debería escribir directo`).toBe(false);
    }
  });

  it("las claves de la lista blanca y de los controles existen (sin entradas viejas)", () => {
    for (const rel of [...Object.keys(ALLOWLIST), ...Object.keys(GUARDED), ...Object.keys(DELEGATING)]) {
      expect(() => statSync(join(ROOT, ...rel.split("/"))), `${rel} ya no existe: sacalo de la lista`).not.toThrow();
    }
  });

  it("cada una de las 10 claves de permiso está usada por al menos una acción controlada, y no se usan claves inventadas", () => {
    const used = new Set<string>();
    for (const rel of Object.keys(GUARDED)) {
      const src = read(rel);
      for (const match of src.matchAll(/["']((?:applications|payments|operations|residents|renewals|waitlist|faq|profile)\.[a-z_]+)["']/g)) used.add(match[1]);
    }
    for (const key of RESIDENCE_PERMISSION_KEYS) expect(used.has(key), `ninguna acción exige «${key}»`).toBe(true);
    for (const key of used) expect((RESIDENCE_PERMISSION_KEYS as readonly string[]).includes(key), `«${key}» no es una clave de permiso`).toBe(true);
  });

  it("las acciones de equipo y de permisos son solo del dueño: ninguna usa assertResidencePermission", () => {
    expect(read("lib/team/teamInvitations.ts")).not.toContain("assertResidencePermission(");
    expect(read("app/residence/[residence_id]/team/actions.ts")).not.toContain("assertResidencePermission(");
  });
});
