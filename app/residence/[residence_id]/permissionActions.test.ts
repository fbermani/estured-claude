import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * DR10/DR11 — por POST directo (sin pasar por la interfaz) las acciones delegables rechazan al staff sin el permiso y las SOLO-DUEÑO
 * (equipo, permisos, enviar a verificación, PDF) rechazan a cualquier staff, siempre con el mensaje acordado y sin escribir nada.
 * Cliente Supabase en memoria: Sofía es staff de Norte (sin permisos guardados: valores iniciales) y dueña de Río; Ricardo es dueño de
 * Norte; Nadia es staff de Norte en "solo lectura"; Paula es staff de Norte con proponer ajustes y editar el perfil encendidos.
 */
const state = vi.hoisted(() => ({ userId: "sofia", roles: ["residence_staff"] as string[], db: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/auth/session", () => ({
  getSessionUser: async () => ({ id: state.userId, email: `${state.userId}@example.com`, primaryRole: "residence_staff", roles: state.roles }),
  hasAnyRole: (user: { roles: string[] }, roles: string[]) => roles.some((r) => user.roles.includes(r)),
}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => state.db }));
vi.mock("@/lib/audit", () => ({ createAuditLog: async () => true }));
vi.mock("@/lib/email/sendEmail", () => ({ sendEmail: async () => true }));
vi.mock("@/lib/exchange/rate", () => ({ getCurrentExchangeRate: async () => ({ arsPerUsd: 1500 }) }));
vi.mock("@react-pdf/renderer", () => ({ renderToBuffer: async () => Buffer.from("pdf") }));
vi.mock("@/lib/residences/PortfolioPdfDocument", () => ({ PortfolioPdfDocument: () => null }));

import { createInMemorySupabase } from "@/lib/testing/inMemorySupabase";
import { OWNER_ONLY_MESSAGE, PERMISSION_DENIED_MESSAGE, ownerPermissions, permissionsFromChecked, permissionsVersion } from "@/lib/residences/permissions";
import { saveResidenceProfile } from "@/app/residence/[residence_id]/profile/actions";
import { sendNegotiationProposal } from "@/app/residence/[residence_id]/applications/[id]/negotiation/actions";
import { enableResidencePayment, establishContact, markUnderReview, rejectApplication } from "@/app/residence/[residence_id]/applications/actions";
import {
  cancelTeamInvitationAction,
  inviteTeamMemberAction,
  removeTeamMemberAction,
  resendTeamInvitationAction,
  updateTeamMemberPermissionsAction,
} from "@/app/residence/[residence_id]/team/actions";
import { GET as portfolioPdf } from "@/app/residence/dashboard/pdf/route";

const NORTE = "res-norte";
const RIO = "res-rio";

function seed() {
  return createInMemorySupabase({
    users: [
      { id: "sofia", email: "sofia@example.com", is_active: true, is_blocked: false },
      { id: "ricardo", email: "ricardo@example.com", is_active: true, is_blocked: false },
      { id: "nadia", email: "nadia@example.com", is_active: true, is_blocked: false },
      { id: "paula", email: "paula@example.com", is_active: true, is_blocked: false },
    ],
    residences: [
      { id: NORTE, name: "Norte", status: "verified_active" },
      { id: RIO, name: "Río", status: "draft" },
    ],
    residence_users: [
      { residence_id: NORTE, user_id: "ricardo", role: "owner", is_active: true },
      { residence_id: NORTE, user_id: "sofia", role: "staff", is_active: true, permissions: {} },
      { residence_id: RIO, user_id: "sofia", role: "owner", is_active: true },
      { residence_id: NORTE, user_id: "nadia", role: "staff", is_active: true, permissions: permissionsFromChecked([]) },
      {
        residence_id: NORTE,
        user_id: "paula",
        role: "staff",
        is_active: true,
        permissions: permissionsFromChecked(["applications.send_adjustment", "profile.edit"]),
      },
    ],
    application_requests: [
      { id: "app-1", status: "contact_established", residence_id: NORTE, proposal_count: 0, snapshot_original_id: "snap-1" },
      { id: "app-2", status: "submitted", residence_id: NORTE, proposal_count: 0 },
    ],
    application_snapshots: [{ id: "snap-1", exchange_rate_ars_per_usd: 1500 }],
    application_status_events: [],
    residence_team_invitations: [],
  });
}

let fake: ReturnType<typeof seed>;

beforeEach(() => {
  fake = seed();
  state.db = fake.client;
  state.userId = "sofia";
  state.roles = ["residence_staff"];
});

const writes = () => fake.log.filter((l) => l.op !== "select");
const idle = { status: "idle" } as const;
const asUser = (id: string, roles = ["residence_staff"]) => {
  state.userId = id;
  state.roles = roles;
};

describe("acciones de solicitudes: cada una pide su permiso (DR11)", () => {
  it("sin permisos (Nadia, solo lectura) todas se rechazan y no escriben", async () => {
    asUser("nadia");
    expect(await markUnderReview("app-2")).toEqual({ status: "error", message: PERMISSION_DENIED_MESSAGE });
    expect(await establishContact("app-2")).toEqual({ status: "error", message: PERMISSION_DENIED_MESSAGE });
    expect(await enableResidencePayment("app-1")).toEqual({ status: "error", message: PERMISSION_DENIED_MESSAGE });
    const fd = new FormData();
    fd.set("reason_code", "other");
    fd.set("reason_text", "motivo de prueba");
    expect(await rejectApplication("app-2", idle, fd)).toEqual({ status: "error", message: PERMISSION_DENIED_MESSAGE });
    expect(writes()).toHaveLength(0);
  });

  it("con los valores iniciales (Sofía) revisa y deja el rol residence_staff en el historial", async () => {
    expect(await markUnderReview("app-2")).toEqual({ status: "saved" });
    expect(fake.tables.application_requests.find((a) => a.id === "app-2")?.status).toBe("under_review");
    expect(fake.tables.application_status_events).toEqual([
      expect.objectContaining({ application_request_id: "app-2", changed_by_user_id: "sofia", changed_by_role: "residence_staff" }),
    ]);
  });

  it("el dueño revisa y queda como residence_owner", async () => {
    asUser("ricardo", ["residence_owner"]);
    expect(await markUnderReview("app-2")).toEqual({ status: "saved" });
    expect(fake.tables.application_status_events[0]).toMatchObject({ changed_by_role: "residence_owner" });
  });

  it("el permiso se lee de la base en cada acción: si el dueño lo apaga, la siguiente se rechaza", async () => {
    const row = fake.tables.residence_users.find((r) => r.user_id === "sofia" && r.residence_id === NORTE)!;
    row.permissions = permissionsFromChecked(["applications.reject"]); // sin review_contact
    expect(await markUnderReview("app-2")).toEqual({ status: "error", message: PERMISSION_DENIED_MESSAGE });
  });

  it("los permisos de Norte no valen en Río: un staff con todo en Río no toca solicitudes de Norte", async () => {
    fake.tables.residence_users.push({ residence_id: RIO, user_id: "solo-rio", role: "staff", is_active: true, permissions: ownerPermissions() });
    asUser("solo-rio");
    expect(await markUnderReview("app-2")).toEqual({ status: "error", message: "No tenés acceso a esta residencia." });
    expect(writes()).toHaveLength(0);
  });
});

describe("propuesta de ajuste: `applications.send_adjustment` (apagado por defecto para el staff)", () => {
  const proposal = () => {
    const fd = new FormData();
    fd.set("warning_acknowledged", "on");
    fd.set("proposed_monthly_price_usd", "100");
    return fd;
  };

  it("el staff con los valores iniciales NO puede (nunca pudo), ni por POST directo", async () => {
    for (const user of ["sofia", "nadia"]) {
      asUser(user);
      expect(await sendNegotiationProposal("app-1", idle, proposal())).toEqual({ status: "error", message: PERMISSION_DENIED_MESSAGE });
    }
    expect(writes()).toHaveLength(0);
  });

  it("con el permiso encendido (Paula) se envía (la acción termina redirigiendo) y queda auditada como residence_staff", async () => {
    asUser("paula");
    await expect(sendNegotiationProposal("app-1", idle, proposal())).rejects.toThrow("REDIRECT:");
    expect(fake.tables.application_status_events).toEqual([
      expect.objectContaining({ application_request_id: "app-1", changed_by_user_id: "paula", changed_by_role: "residence_staff" }),
    ]);
  });

  it("el dueño siempre puede y queda como residence_owner", async () => {
    asUser("ricardo", ["residence_owner"]);
    await expect(sendNegotiationProposal("app-1", idle, proposal())).rejects.toThrow("REDIRECT:");
    expect(fake.tables.application_status_events[0]).toMatchObject({ changed_by_role: "residence_owner" });
  });
});

describe("perfil: guardar es `profile.edit`; enviar a verificación es solo del dueño (no delegable)", () => {
  it("el staff sin `profile.edit` no guarda ni envía", async () => {
    for (const user of ["sofia", "nadia"]) {
      asUser(user);
      const draft = new FormData();
      draft.set("intent", "draft");
      expect(await saveResidenceProfile(NORTE, idle, draft)).toEqual({ status: "error", message: PERMISSION_DENIED_MESSAGE });
      const submit = new FormData();
      submit.set("intent", "submit");
      expect(await saveResidenceProfile(NORTE, idle, submit)).toEqual({ status: "error", message: OWNER_ONLY_MESSAGE });
    }
    expect(writes()).toHaveLength(0);
  });

  it("con `profile.edit` (Paula) puede guardar, pero enviar/reenviar a verificación le sigue estando vedado", async () => {
    asUser("paula");
    const draft = new FormData();
    draft.set("intent", "draft");
    const saved = await saveResidenceProfile(NORTE, idle, draft);
    expect(saved.message).not.toBe(PERMISSION_DENIED_MESSAGE);
    expect(saved.message).not.toBe(OWNER_ONLY_MESSAGE);
    const submit = new FormData();
    submit.set("intent", "submit");
    expect(await saveResidenceProfile(NORTE, idle, submit)).toEqual({ status: "error", message: OWNER_ONLY_MESSAGE });
  });

  it("un `intent` raro se trata como guardar (no como enviar) y pide `profile.edit`", async () => {
    asUser("nadia");
    const fd = new FormData();
    fd.set("intent", "SUBMIT");
    expect(await saveResidenceProfile(NORTE, idle, fd)).toEqual({ status: "error", message: PERMISSION_DENIED_MESSAGE });
  });

  it("el dueño de ESA residencia sí pasa el control (el resto del guardado ya tiene sus propias validaciones)", async () => {
    // Sofía es dueña de Río: el control de rol pasa y recién después falla por los datos del formulario.
    const r = await saveResidenceProfile(RIO, idle, new FormData());
    expect(r.message).not.toBe(OWNER_ONLY_MESSAGE);
    expect(r.message).not.toBe(PERMISSION_DENIED_MESSAGE);
  });
});

describe("perfil: requisitos para enviar a revisión (DR59, recalculados en el servidor)", () => {
  /** Formulario válido pero incompleto: sin fotos, sin reglamento, sin universidades, sin preguntas esenciales. */
  const form = (intent: string) => {
    const fd = new FormData();
    fd.set("intent", intent);
    fd.set("tagline", "Casa de estudiantes");
    fd.set("description", "Una descripción de más de veinte caracteres.");
    fd.append("services", "Wifi");
    fd.set("room_types_json", JSON.stringify([{ name: "Individual", features: [], roomCount: 2, capacityPerRoom: 1, monthlyPriceUsd: 400 }]));
    fd.set(
      "conditions_json",
      JSON.stringify({ adjustmentPolicy: "quarterly", initialPaymentMode: "one_month", minResidentAge: 18, maxResidentAge: "", acceptsMinors: false }),
    );
    return fd;
  };

  it("el dueño no puede enviar una residencia en borrador incompleta: el mensaje lista lo que falta y no se escribe nada", async () => {
    const r = await saveResidenceProfile(RIO, idle, form("submit"));
    expect(r.status).toBe("error");
    expect(r.message).toContain("Todavía no podés enviar la residencia a revisión");
    expect(r.message).toContain("Al menos 3 fotos propias");
    expect(r.message).toContain("Al menos 2 universidades cercanas");
    expect(r.message).toContain("Datos básicos");
    expect(writes()).toHaveLength(0);
  });

  it("también se bloquea el reenvío tras «cambios pedidos» y tras vencimiento", async () => {
    for (const status of ["needs_changes", "verification_expired"]) {
      fake.tables.residences.find((x) => x.id === RIO)!.status = status;
      const r = await saveResidenceProfile(RIO, idle, form("submit"));
      expect(r.message, status).toContain("Todavía no podés enviar la residencia a revisión");
    }
    expect(writes()).toHaveLength(0);
  });

  it("«Guardar cambios» (borrador) no se bloquea por los requisitos", async () => {
    const r = await saveResidenceProfile(RIO, idle, form("draft"));
    expect(r.message ?? "").not.toContain("Todavía no podés enviar");
  });

  it("una residencia publicada no pasa por el gate (guardar y «enviar» no se bloquean por los requisitos)", async () => {
    fake.tables.residences.find((x) => x.id === RIO)!.status = "verified_active";
    const r = await saveResidenceProfile(RIO, idle, form("submit"));
    expect(r.message ?? "").not.toContain("Todavía no podés enviar");
  });
});

describe("equipo y permisos: solo del dueño, aunque el staff tenga todo lo delegable", () => {
  it("invitar, reenviar, cancelar, quitar acceso y cambiar permisos rechazan a cualquier staff", async () => {
    fake.tables.residence_users.push({ residence_id: NORTE, user_id: "supervisor", role: "staff", is_active: true, permissions: ownerPermissions() });
    for (const user of ["sofia", "nadia", "paula", "supervisor"]) {
      asUser(user);
      const fd = new FormData();
      fd.set("email", "nuevo@example.com");
      expect(await inviteTeamMemberAction(NORTE, idle, fd), user).toEqual({ status: "error", message: OWNER_ONLY_MESSAGE });
      expect(await resendTeamInvitationAction(NORTE, "inv-1", idle), user).toEqual({ status: "error", message: OWNER_ONLY_MESSAGE });
      expect(await cancelTeamInvitationAction(NORTE, "inv-1", idle), user).toEqual({ status: "error", message: OWNER_ONLY_MESSAGE });
      expect(await removeTeamMemberAction(NORTE, "ricardo", idle), user).toEqual({ status: "error", message: OWNER_ONLY_MESSAGE });
      const perms = new FormData();
      perms.append("permission", "profile.edit");
      expect(await updateTeamMemberPermissionsAction(NORTE, "nadia", idle, perms), user).toEqual({ status: "error", message: OWNER_ONLY_MESSAGE });
    }
    expect(writes()).toHaveLength(0);
  });

  it("el rol sale de la base: aunque el formulario diga otra cosa, el staff no invita", async () => {
    const fd = new FormData();
    fd.set("email", "nuevo@example.com");
    fd.set("role", "owner");
    fd.set("is_owner", "true");
    fd.append("permission", "profile.edit");
    expect(await inviteTeamMemberAction(NORTE, idle, fd)).toEqual({ status: "error", message: OWNER_ONLY_MESSAGE });
  });

  it("el dueño invita con los permisos que elige; el rol es staff aunque el formulario pida owner", async () => {
    asUser("ricardo", ["residence_owner"]);
    const fd = new FormData();
    fd.set("email", "nuevo@example.com");
    fd.set("role", "owner");
    fd.append("permission", "faq.manage");
    fd.append("permission", "waitlist.manage");
    fd.append("permission", "permiso.inventado");
    const r = await inviteTeamMemberAction(NORTE, idle, fd);
    expect(r.status).toBe("ok");
    const stored = fake.tables.residence_team_invitations[0];
    expect(stored).toMatchObject({ role: "staff", email: "nuevo@example.com" });
    expect(stored.permissions).toEqual(permissionsFromChecked(["faq.manage", "waitlist.manage"]));
  });

  it("un POST de invitación sin casilleros invita en solo lectura (nunca con más permisos de los que se tildaron)", async () => {
    asUser("ricardo", ["residence_owner"]);
    const fd = new FormData();
    fd.set("email", "sin-casilleros@example.com");
    await inviteTeamMemberAction(NORTE, idle, fd);
    expect(fake.tables.residence_team_invitations[0].permissions).toEqual(permissionsFromChecked([]));
  });

  it("el dueño cambia los permisos de un staff: se guardan completos, se audita y el staff queda con ellos", async () => {
    asUser("ricardo", ["residence_owner"]);
    const fd = new FormData();
    fd.append("permission", "faq.manage");
    fd.append("permission", "profile.edit");
    fd.set("permissions_version", permissionsVersion(permissionsFromChecked([]))); // lo que leyó el formulario (Nadia: todo apagado)
    const r = await updateTeamMemberPermissionsAction(NORTE, "nadia", idle, fd);
    expect(r.status).toBe("ok");
    const row = fake.tables.residence_users.find((x) => x.user_id === "nadia" && x.residence_id === NORTE)!;
    expect(row.permissions).toEqual(permissionsFromChecked(["faq.manage", "profile.edit"]));
  });
});

describe("reporte PDF del portfolio", () => {
  it("el staff sin residencias propias recibe 403", async () => {
    // Sofía es dueña de Río: para probar el 403 se la deja solo como staff de Norte.
    fake.tables.residence_users = fake.tables.residence_users.filter((r) => !(r.user_id === "sofia" && r.residence_id === RIO));
    const res = await portfolioPdf();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: OWNER_ONLY_MESSAGE });
  });

  it("404 solo si la cuenta no tiene ninguna residencia, sin importar su rol global", async () => {
    fake.tables.residence_users = [];
    for (const roles of [["residence_owner"], ["residence_staff"]]) {
      state.roles = roles;
      const res = await portfolioPdf();
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "No tenés residencias cargadas." });
    }
  });

  it("403 si tiene vínculos activos pero ninguno de dueño, aunque su rol global sea de dueño", async () => {
    fake.tables.residence_users = fake.tables.residence_users.filter((r) => !(r.user_id === "sofia" && r.residence_id === RIO));
    state.roles = ["residence_owner"];
    const res = await portfolioPdf();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: OWNER_ONLY_MESSAGE });
  });

  it("un vínculo inactivo no cuenta: sin vínculos activos es 404", async () => {
    fake.tables.residence_users = fake.tables.residence_users.map((r) => (r.user_id === "sofia" ? { ...r, is_active: false } : r));
    expect((await portfolioPdf()).status).toBe(404);
  });
});
