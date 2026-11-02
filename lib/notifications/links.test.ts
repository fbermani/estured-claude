import { describe, expect, it } from "vitest";
import { notificationAreaForRoles, notificationHref } from "@/lib/notifications/links";

const ID = "3f2b8c1e-7a4d-4b6f-9c2a-1d5e8f0a3b7c";
const OTHER = "11111111-2222-4333-8444-555555555555";

describe("notificationHref", () => {
  it("estudiante: solicitud, estadía, lista de espera, soporte y renovaciones", () => {
    const h = (entityType: string) => notificationHref({ entityType, entityId: ID, area: "student" });
    expect(h("application_requests")).toBe(`/students/applications/${ID}`);
    expect(h("resident_stays")).toBe("/students/residency");
    expect(h("waitlist_entries")).toBe("/students/waitlist");
    expect(h("support_cases")).toBe("/students/support");
    expect(h("renewal_offers")).toBe(`/students/renewals/${ID}`);
    expect(h("renewal_requests")).toBe("/students/renewals");
  });

  it("revocación del fee (DR6): el estudiante va a su pantalla de revocación y el admin a la pestaña", () => {
    expect(notificationHref({ entityType: "fee_revocations", entityId: ID, area: "student" })).toBe("/students/revocation");
    expect(notificationHref({ entityType: "fee_revocations", entityId: ID, area: "admin" })).toBe("/admin/activity?tab=revocations");
  });

  it("propuestas del familiar (DR4): el estudiante va a sus propuestas y el familiar a su inicio", () => {
    expect(notificationHref({ entityType: "family_application_proposals", entityId: ID, area: "student" })).toBe("/students/family-proposals");
    expect(notificationHref({ entityType: "family_application_proposals", entityId: ID, area: "student", isFamily: true })).toBe("/students/dashboard");
  });

  it("estudiante: una reserva lleva al detalle de su solicitud (resuelta), o al listado si no se pudo resolver", () => {
    expect(
      notificationHref(
        { entityType: "reservations", entityId: ID, area: "student" },
        { applicationIdByReservationId: { [ID]: OTHER } },
      ),
    ).toBe(`/students/applications/${OTHER}`);
    expect(notificationHref({ entityType: "reservations", entityId: ID, area: "student" })).toBe("/students/applications");
  });

  it("residencia: panel de la residencia y pantallas que dependen de la residencia resuelta", () => {
    expect(notificationHref({ entityType: "residences", entityId: ID, area: "residence" })).toBe(`/residence/${ID}`);
    expect(notificationHref({ entityType: "residence_team", entityId: ID, area: "residence" })).toBe(`/residence/${ID}/team`);
    expect(notificationHref({ entityType: "residence_team", entityId: "x/y", area: "residence" })).toBe("/residence/dashboard");
    expect(
      notificationHref(
        { entityType: "support_cases", entityId: ID, area: "residence" },
        { residenceIdByEntity: { [`support_cases:${ID}`]: OTHER } },
      ),
    ).toBe(`/residence/${OTHER}/support`);
    expect(notificationHref({ entityType: "support_cases", entityId: ID, area: "residence" })).toBeNull();
  });

  it("FAQ (D9): la residencia va a su pantalla de preguntas y el visitante a la ficha donde le respondieron", () => {
    expect(
      notificationHref(
        { entityType: "residence_faq_questions", entityId: ID, area: "residence" },
        { residenceIdByEntity: { [`residence_faq_questions:${ID}`]: OTHER } },
      ),
    ).toBe(`/residence/${OTHER}/faq`);
    expect(notificationHref({ entityType: "residence_faq_questions", entityId: ID, area: "residence" })).toBeNull();
    expect(
      notificationHref(
        { entityType: "residence_faq_questions", entityId: ID, area: "student" },
        { residenceSlugByFaqQuestionId: { [ID]: "residencia-norte" } },
      ),
    ).toBe("/residencias/residencia-norte#preguntas");
    expect(notificationHref({ entityType: "residence_faq_questions", entityId: ID, area: "student" })).toBeNull();
  });

  it("admin: lista del módulo correspondiente", () => {
    expect(notificationHref({ entityType: "reservations", entityId: ID, area: "admin" })).toBe("/admin/reservations");
    expect(notificationHref({ entityType: "support_cases", entityId: ID, area: "admin" })).toBe("/admin/support-cases");
    expect(notificationHref({ entityType: "payment_settings", entityId: ID, area: "admin" })).toBe("/admin/payment-settings");
  });

  it("tipos desconocidos o sin tipo no generan enlaces", () => {
    expect(notificationHref({ entityType: null, entityId: null, area: "student" })).toBeNull();
    expect(notificationHref({ entityType: "algo_raro", entityId: ID, area: "student" })).toBeNull();
    expect(notificationHref({ entityType: "algo_raro", entityId: ID, area: "admin" })).toBeNull();
  });

  it("nunca arma una ruta con un id que no es UUID", () => {
    expect(notificationHref({ entityType: "application_requests", entityId: "../../admin", area: "student" })).toBe(
      "/students/applications",
    );
    expect(notificationHref({ entityType: "residences", entityId: "x/y", area: "residence" })).toBe("/residence/dashboard");
  });
});

describe("notificationAreaForRoles", () => {
  it("prioriza admin, después residencia, después estudiante/familiar", () => {
    expect(notificationAreaForRoles(["student", "admin"])).toBe("admin");
    expect(notificationAreaForRoles(["superadmin"])).toBe("admin");
    expect(notificationAreaForRoles(["residence_staff"])).toBe("residence");
    expect(notificationAreaForRoles(["residence_owner"])).toBe("residence");
    expect(notificationAreaForRoles(["family_member"])).toBe("student");
    expect(notificationAreaForRoles([])).toBe("student");
  });
});

describe("notificationHref · arrival_reminders (DR29 2B)", () => {
  it("lleva al inicio del estudiante y del familiar", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(notificationHref({ entityType: "arrival_reminders", entityId: id, area: "student" })).toBe("/students/dashboard");
    expect(notificationHref({ entityType: "arrival_reminders", entityId: id, area: "student", isFamily: true })).toBe("/students/dashboard");
  });
});
