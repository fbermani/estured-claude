import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const sent = vi.hoisted(() => [] as { to: string; subject: string; html: string }[]);
const audits = vi.hoisted(() => [] as { action: string; actorUserId: string | null; actorRole: string; entityType: string; newValue?: unknown }[]);
const notices = vi.hoisted(() => [] as { userId: string; title: string; body: string; relatedEntityType?: string }[]);
const teamNotifications = vi.hoisted(() => [] as { residenceId: string; event: string }[]);

const mailer = vi.hoisted(() => ({ works: true }));
const clock = vi.hoisted(() => ({ now: "2026-10-24T15:00:00.000Z" }));

vi.mock("@/lib/email/sendEmail", () => ({
  sendEmail: async (entry: { to: string; subject: string; html: string }) => {
    if (!mailer.works) return false;
    sent.push(entry);
    return true;
  },
}));
vi.mock("@/lib/audit", () => ({
  // Además de anotar, escribe en `audit_logs` del cliente en memoria: el límite por hora se cuenta desde ahí.
  createAuditLog: async (
    admin: { from: (t: string) => { insert: (row: unknown) => PromiseLike<unknown> } },
    entry: (typeof audits)[number] & { entityId?: string | null },
  ) => {
    audits.push(entry);
    await admin.from("audit_logs").insert({
      action: entry.action,
      actor_user_id: entry.actorUserId,
      entity_id: entry.entityId ?? null,
      new_value: entry.newValue ?? null,
      created_at: clock.now,
    });
    return true;
  },
}));
vi.mock("@/lib/notifications/createNotification", () => ({
  createNotification: async (_admin: unknown, entry: (typeof notices)[number]) => {
    notices.push(entry);
  },
}));
vi.mock("@/lib/residences/notifyResidenceTeam", () => ({
  notifyResidenceTeam: async (_admin: unknown, params: { residenceId: string; event: string }) => {
    teamNotifications.push(params);
  },
}));

import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";
import {
  acceptTeamInvitation,
  cancelTeamInvitation,
  inviteTeamMember,
  loadTeamSnapshot,
  peekTeamInvitation,
  removeTeamMember,
  resendTeamInvitation,
  updateTeamMemberPermissions,
} from "@/lib/team/teamInvitations";
import { hashInvitationToken } from "@/lib/team/invitationToken";
import {
  INVALID_INVITATION_MESSAGE,
  MAX_INVITATIONS_PER_HOUR,
  MAX_SENDS_PER_INVITATION,
  MAX_STAFF_PER_RESIDENCE,
  TEAM_UNAVAILABLE_MESSAGE,
} from "@/lib/team/teamRules";
import {
  defaultPermissions,
  OWNER_ONLY_MESSAGE,
  noPermissions,
  permissionsFromChecked,
  presetPermissions,
  resolveStaffPermissions,
} from "@/lib/residences/permissions";
import { PERMISSIONS_UNAVAILABLE_MESSAGE } from "@/lib/team/teamCopy";

const NORTE = "res-norte";
const RIO = "res-rio";
const NOW = new Date("2026-10-24T15:00:00.000Z");

/** Mundo base: Ricardo es dueño de Norte y de Río; Sofía es staff de Norte; Ana es dueña de otra residencia ajena. */
function world(extra: Record<string, Row[]> = {}) {
  return {
    users: [
      { id: "ricardo", email: "ricardo@example.com", is_active: true, is_blocked: false },
      { id: "sofia", email: "sofia@example.com", is_active: true, is_blocked: false },
      { id: "ana", email: "ana@example.com", is_active: true, is_blocked: false },
      { id: "lucia", email: "lucia@example.com", is_active: true, is_blocked: false },
      { id: "nuevo", email: "nuevo@example.com", is_active: true, is_blocked: false },
      { id: "bloqueado", email: "bloqueado@example.com", is_active: true, is_blocked: true },
    ],
    user_roles: [
      { user_id: "ricardo", role: "residence_owner", is_active: true },
      { user_id: "sofia", role: "residence_staff", is_active: true },
      { user_id: "ana", role: "residence_owner", is_active: true },
      { user_id: "lucia", role: "student", is_active: true },
      { user_id: "nuevo", role: "residence_staff", is_active: true },
      { user_id: "bloqueado", role: "residence_staff", is_active: true },
    ],
    residences: [
      { id: NORTE, name: "Residencia Norte", status: "verified_active" },
      { id: RIO, name: "Río de la Plata", status: "verified_active" },
      { id: "res-ana", name: "Casa de Ana", status: "verified_active" },
    ],
    residence_users: [
      { id: "ru1", residence_id: NORTE, user_id: "ricardo", role: "owner", is_active: true, created_at: "2026-01-01T00:00:00.000Z" },
      { id: "ru2", residence_id: RIO, user_id: "ricardo", role: "owner", is_active: true, created_at: "2026-01-02T00:00:00.000Z" },
      { id: "ru3", residence_id: NORTE, user_id: "sofia", role: "staff", is_active: true, permissions: {}, created_at: "2026-02-01T00:00:00.000Z" },
      { id: "ru4", residence_id: "res-ana", user_id: "ana", role: "owner", is_active: true, created_at: "2026-01-03T00:00:00.000Z" },
    ],
    residence_team_invitations: [],
    ...extra,
  } as Record<string, Row[]>;
}

/** Invitación pendiente con un token conocido (el hash es lo único que se guarda). */
function inviteRow(token: string, patch: Row = {}): Row {
  return {
    id: `inv-${token.slice(0, 4)}`,
    residence_id: NORTE,
    email: "nuevo@example.com",
    role: "staff",
    token_hash: hashInvitationToken(token),
    status: "pending",
    invited_by: "ricardo",
    expires_at: "2026-10-31T15:00:00.000Z",
    last_sent_at: "2026-10-24T14:00:00.000Z",
    send_count: 1,
    accepted_at: null,
    accepted_by_user_id: null,
    cancelled_at: null,
    created_at: "2026-10-24T14:00:00.000Z",
    ...patch,
  };
}

const TOKEN = "T".repeat(43);

/** Fila de `audit_logs` de un envío (nuevo o reenvío) de invitación, como la deja `createAuditLog`. */
function sendAudit(action: string, residenceId: string, entityId: string, createdAt: string): Row {
  return { action, entity_id: entityId, new_value: { residence_id: residenceId }, created_at: createdAt };
}

beforeEach(() => {
  sent.length = 0;
  audits.length = 0;
  notices.length = 0;
  teamNotifications.length = 0;
  mailer.works = true;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("inviteTeamMember", () => {
  it("el dueño invita: guarda solo el hash, rol staff, manda el email con el enlace y audita", async () => {
    const { client, tables } = createInMemorySupabase(world());
    const r = await inviteTeamMember(client, { actorUserId: "ricardo", residenceId: NORTE, email: " Nuevo@Example.com ", now: NOW });
    expect(r).toMatchObject({ ok: true, email: "nuevo@example.com", message: "Le enviamos la invitación a nuevo@example.com." });

    const row = tables.residence_team_invitations[0];
    expect(row).toMatchObject({ residence_id: NORTE, email: "nuevo@example.com", role: "staff", status: "pending", invited_by: "ricardo" });
    expect(row.expires_at).toBe("2026-10-31T15:00:00.000Z");

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("nuevo@example.com");
    const link = sent[0].html.match(/href="([^"]+)"/)?.[1] ?? "";
    expect(link).toContain("/register/staff/");
    const token = link.split("/register/staff/")[1];
    expect(row.token_hash).toBe(hashInvitationToken(token));
    expect(JSON.stringify(row)).not.toContain(token); // el token en claro nunca se guarda
    // Email genérico: no incluye el email del dueño ni de nadie más.
    expect(sent[0].html).not.toContain("ricardo@example.com");
    expect(audits.map((a) => a.action)).toEqual(["team_invitation_sent"]);
  });

  it("el staff NO puede invitar: se rechaza en el servidor y no se crea nada", async () => {
    const { client, tables } = createInMemorySupabase(world());
    const r = await inviteTeamMember(client, { actorUserId: "sofia", residenceId: NORTE, email: "x@example.com", now: NOW });
    expect(r).toEqual({ ok: false, error: OWNER_ONLY_MESSAGE });
    expect(tables.residence_team_invitations).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  it("quien no es de la residencia no puede ni enterarse: sin acceso", async () => {
    const { client, tables } = createInMemorySupabase(world());
    // Ana es dueña, pero de OTRA residencia: no puede invitar al equipo de Norte.
    const r = await inviteTeamMember(client, { actorUserId: "ana", residenceId: NORTE, email: "x@example.com", now: NOW });
    expect(r).toEqual({ ok: false, error: "No tenés acceso a esta residencia." });
    expect(tables.residence_team_invitations).toHaveLength(0);
  });

  it("un dueño de varias residencias invita en cada una por separado", async () => {
    const { client, tables } = createInMemorySupabase(world());
    expect((await inviteTeamMember(client, { actorUserId: "ricardo", residenceId: NORTE, email: "a@example.com", now: NOW })).ok).toBe(true);
    expect((await inviteTeamMember(client, { actorUserId: "ricardo", residenceId: RIO, email: "a@example.com", now: NOW })).ok).toBe(true);
    expect(tables.residence_team_invitations.map((i) => i.residence_id).sort()).toEqual([NORTE, RIO].sort());
  });

  it("valida el email", async () => {
    const { client } = createInMemorySupabase(world());
    const r = await inviteTeamMember(client, { actorUserId: "ricardo", residenceId: NORTE, email: "no-es-un-email", now: NOW });
    expect(r.ok).toBe(false);
  });

  it("no invita a quien ya es miembro (ni al dueño, ni al staff)", async () => {
    const { client, tables } = createInMemorySupabase(world());
    for (const email of ["sofia@example.com", "ricardo@example.com", "SOFIA@example.com"]) {
      const r = await inviteTeamMember(client, { actorUserId: "ricardo", residenceId: NORTE, email, now: NOW });
      expect(r).toEqual({ ok: false, error: "Esa persona ya forma parte del equipo de la residencia." });
    }
    expect(tables.residence_team_invitations).toHaveLength(0);
  });

  it("no revela si un email tiene cuenta: invitar a un email con cuenta y a uno sin cuenta responde igual", async () => {
    const { client } = createInMemorySupabase(world());
    const conCuenta = await inviteTeamMember(client, { actorUserId: "ricardo", residenceId: NORTE, email: "lucia@example.com", now: NOW });
    const sinCuenta = await inviteTeamMember(client, { actorUserId: "ricardo", residenceId: NORTE, email: "nadie@example.com", now: NOW });
    expect(conCuenta.ok).toBe(true);
    expect(sinCuenta.ok).toBe(true);
    expect(conCuenta.ok && conCuenta.message.replace("lucia@example.com", "X")).toBe(sinCuenta.ok && sinCuenta.message.replace("nadie@example.com", "X"));
  });

  it("no duplica una invitación pendiente (vigente o vencida)", async () => {
    const { client, tables } = createInMemorySupabase(world({ residence_team_invitations: [inviteRow(TOKEN)] }));
    const dup = await inviteTeamMember(client, { actorUserId: "ricardo", residenceId: NORTE, email: "nuevo@example.com", now: NOW });
    expect(dup.ok).toBe(false);
    expect(!dup.ok && dup.error).toMatch(/ya tiene una invitación pendiente/);

    const expired = createInMemorySupabase(world({ residence_team_invitations: [inviteRow(TOKEN, { expires_at: "2026-10-01T00:00:00.000Z" })] }));
    const again = await inviteTeamMember(expired.client, { actorUserId: "ricardo", residenceId: NORTE, email: "nuevo@example.com", now: NOW });
    expect(!again.ok && again.error).toMatch(/venció/);
    expect(tables.residence_team_invitations).toHaveLength(1);
  });

  it("respeta el tope de staff por residencia (activos + pendientes vigentes)", async () => {
    const extraStaff = Array.from({ length: MAX_STAFF_PER_RESIDENCE - 1 }, (_, i) => ({
      id: `rux${i}`,
      residence_id: NORTE,
      user_id: `staff${i}`,
      role: "staff",
      is_active: true,
      created_at: "2026-03-01T00:00:00.000Z",
    }));
    const w = world();
    w.residence_users.push(...extraStaff); // 9 + Sofía = 10 staff activos
    const { client } = createInMemorySupabase(w);
    const r = await inviteTeamMember(client, { actorUserId: "ricardo", residenceId: NORTE, email: "uno-mas@example.com", now: NOW });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/máximo de 10/);
  });

  it("limita los envíos por hora y por residencia (se cuentan desde la auditoría, no desde las filas)", async () => {
    const envios = Array.from({ length: MAX_INVITATIONS_PER_HOUR }, (_, i) => sendAudit("team_invitation_sent", NORTE, `inv${i}`, "2026-10-24T14:30:00.000Z"));
    const { client } = createInMemorySupabase(world({ audit_logs: envios }));
    const r = await inviteTeamMember(client, { actorUserId: "ricardo", residenceId: NORTE, email: "otro@example.com", now: NOW });
    expect(!r.ok && r.error).toMatch(/muchas invitaciones/);
    // En otra residencia del mismo dueño el contador es aparte.
    const other = await inviteTeamMember(client, { actorUserId: "ricardo", residenceId: RIO, email: "otro@example.com", now: NOW });
    expect(other.ok).toBe(true);
  });

  it("el límite por hora suma invitaciones nuevas Y reenvíos, y no cuenta lo viejo ni otras acciones", async () => {
    const audit_logs = [
      sendAudit("team_invitation_sent", NORTE, "a", "2026-10-24T14:10:00.000Z"),
      sendAudit("team_invitation_resent", NORTE, "a", "2026-10-24T14:20:00.000Z"),
      sendAudit("team_invitation_resent", NORTE, "a", "2026-10-24T14:30:00.000Z"),
      sendAudit("team_invitation_sent", NORTE, "b", "2026-10-24T13:59:59.000Z"), // fuera de la hora
      sendAudit("team_invitation_cancelled", NORTE, "b", "2026-10-24T14:40:00.000Z"), // no es un envío
      sendAudit("team_invitation_sent", RIO, "c", "2026-10-24T14:40:00.000Z"), // otra residencia
    ];
    const { client } = createInMemorySupabase(world({ audit_logs }));
    // Van 3 envíos en la hora: todavía se pueden hacer 2 más y el tercero ya no.
    expect((await inviteTeamMember(client, { actorUserId: "ricardo", residenceId: NORTE, email: "x1@example.com", now: NOW })).ok).toBe(true);
    expect((await inviteTeamMember(client, { actorUserId: "ricardo", residenceId: NORTE, email: "x2@example.com", now: NOW })).ok).toBe(true);
    const sexto = await inviteTeamMember(client, { actorUserId: "ricardo", residenceId: NORTE, email: "x3@example.com", now: NOW });
    expect(!sexto.ok && sexto.error).toMatch(/muchas invitaciones/);
  });

  it("POST simultáneos no pasan el tope por hora (se recuenta después de registrar el envío, antes del email)", async () => {
    const envios = Array.from({ length: MAX_INVITATIONS_PER_HOUR - 1 }, (_, i) => sendAudit("team_invitation_sent", NORTE, `inv${i}`, "2026-10-24T14:30:00.000Z"));
    const { client } = createInMemorySupabase(world({ audit_logs: envios }));
    const results = await Promise.all(
      ["p1", "p2", "p3"].map((n) => inviteTeamMember(client, { actorUserId: "ricardo", residenceId: NORTE, email: `${n}@example.com`, now: NOW })),
    );
    // Nunca más de los que faltaban para el tope (puede frenar a todos por seguridad, pero no dejar pasar de más).
    expect(results.filter((r) => r.ok).length).toBeLessThanOrEqual(1);
    expect(sent.length).toBeLessThanOrEqual(1);
  });

  it("si el email no sale, la invitación igual queda creada y se avisa que se puede reenviar", async () => {
    mailer.works = false;
    const { client, tables } = createInMemorySupabase(world());
    const r = await inviteTeamMember(client, { actorUserId: "ricardo", residenceId: NORTE, email: "nuevo@example.com", now: NOW });
    expect(r).toMatchObject({ ok: true, emailSent: false, message: "Creamos la invitación pero no pudimos enviar el email. Podés reenviarla." });
    expect(tables.residence_team_invitations).toHaveLength(1);
    expect(sent).toHaveLength(0);
  });

  it("el asunto del email es fijo y no nombra la residencia; el nombre va en el cuerpo, acotado", async () => {
    const w = world();
    w.residences[0].name = `Residencia ${"X".repeat(200)}`;
    const { client } = createInMemorySupabase(w);
    await inviteTeamMember(client, { actorUserId: "ricardo", residenceId: NORTE, email: "nuevo@example.com", now: NOW });
    expect(sent[0].subject).toBe("Te invitaron a sumarte a un equipo en EstuRed");
    expect(sent[0].subject).not.toContain("Residencia");
    expect(sent[0].html).not.toContain("X".repeat(80));
    expect(sent[0].html).toContain("Residencia XXXX");
  });

  it("no se invita si la residencia está en borrador, rechazada, suspendida o archivada (ni si no se puede leer)", async () => {
    for (const status of ["draft", "rejected", "suspended", "archived"]) {
      const w = world();
      w.residences[0].status = status;
      const { client, tables } = createInMemorySupabase(w);
      const r = await inviteTeamMember(client, { actorUserId: "ricardo", residenceId: NORTE, email: "nuevo@example.com", now: NOW });
      expect(r.ok, status).toBe(false);
      expect(tables.residence_team_invitations, status).toHaveLength(0);
    }
    const draft = world();
    draft.residences[0].status = "draft";
    const msg = await inviteTeamMember(createInMemorySupabase(draft).client, { actorUserId: "ricardo", residenceId: NORTE, email: "n@example.com", now: NOW });
    expect(!msg.ok && msg.error).toMatch(/enviala a verificación/);
    const sinFila = world();
    sinFila.residences = [];
    expect((await inviteTeamMember(createInMemorySupabase(sinFila).client, { actorUserId: "ricardo", residenceId: NORTE, email: "n@example.com", now: NOW })).ok).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it("en revisión, con cambios pedidos o pausada sí se puede invitar", async () => {
    for (const status of ["pending_verification", "needs_changes", "paused_by_residence", "verified_active"]) {
      const w = world();
      w.residences[0].status = status;
      const r = await inviteTeamMember(createInMemorySupabase(w).client, { actorUserId: "ricardo", residenceId: NORTE, email: "nuevo@example.com", now: NOW });
      expect(r.ok, status).toBe(true);
    }
  });

  it("recuenta DESPUÉS de insertar: dos invitaciones simultáneas con un solo lugar libre no pasan el tope", async () => {
    // 9 staff activos (8 + Sofía): queda un lugar. Las dos pasan el chequeo previo; al recontar, el tope se pasó y se cancelan.
    const w = world();
    for (let i = 0; i < MAX_STAFF_PER_RESIDENCE - 2; i++) {
      w.residence_users.push({ id: `rux${i}`, residence_id: NORTE, user_id: `staff${i}`, role: "staff", is_active: true, created_at: "2026-03-01T00:00:00.000Z" });
    }
    const { client, tables } = createInMemorySupabase(w);
    const results = await Promise.all([
      inviteTeamMember(client, { actorUserId: "ricardo", residenceId: NORTE, email: "uno@example.com", now: NOW }),
      inviteTeamMember(client, { actorUserId: "ricardo", residenceId: NORTE, email: "dos@example.com", now: NOW }),
    ]);
    const pendientes = tables.residence_team_invitations.filter((i) => i.status === "pending").length;
    const activos = tables.residence_users.filter((r) => r.residence_id === NORTE && r.role === "staff" && r.is_active).length;
    expect(activos + pendientes).toBeLessThanOrEqual(MAX_STAFF_PER_RESIDENCE);
    // Lo que se pasó del tope quedó cancelado y NO mandó email.
    const canceladas = tables.residence_team_invitations.filter((i) => i.status === "cancelled").length;
    expect(canceladas).toBeGreaterThanOrEqual(1);
    expect(sent).toHaveLength(results.filter((r) => r.ok).length);
    expect(results.filter((r) => !r.ok).every((r) => !r.ok && /máximo de 10/.test(r.error))).toBe(true);
  });

  it("sin la migración 0051 avisa con claridad y no crea nada", async () => {
    const { client } = createInMemorySupabase(world(), { missingTables: ["residence_team_invitations"] });
    const r = await inviteTeamMember(client, { actorUserId: "ricardo", residenceId: NORTE, email: "x@example.com", now: NOW });
    expect(r).toEqual({ ok: false, error: TEAM_UNAVAILABLE_MESSAGE });
    expect(sent).toHaveLength(0);
  });

  it("dos invitaciones simultáneas al mismo email: la segunda cae por la restricción única", async () => {
    const { client, tables } = createInMemorySupabase(world());
    const [a, b] = await Promise.all([
      inviteTeamMember(client, { actorUserId: "ricardo", residenceId: NORTE, email: "carrera@example.com", now: NOW }),
      inviteTeamMember(client, { actorUserId: "ricardo", residenceId: NORTE, email: "carrera@example.com", now: NOW }),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(tables.residence_team_invitations).toHaveLength(1);
  });
});

describe("resendTeamInvitation", () => {
  it("rota el token (el enlace viejo deja de funcionar), renueva el plazo y audita", async () => {
    const { client, tables } = createInMemorySupabase(world({ residence_team_invitations: [inviteRow(TOKEN, { id: "inv-1", expires_at: "2026-10-25T00:00:00.000Z" })] }));
    const r = await resendTeamInvitation(client, { actorUserId: "ricardo", residenceId: NORTE, invitationId: "inv-1", now: NOW });
    expect(r).toMatchObject({ ok: true, email: "nuevo@example.com" });
    const row = tables.residence_team_invitations[0];
    expect(row.token_hash).not.toBe(hashInvitationToken(TOKEN));
    expect(row.expires_at).toBe("2026-10-31T15:00:00.000Z");
    expect(row.send_count).toBe(2);
    expect(sent).toHaveLength(1);
    expect(audits.map((a) => a.action)).toEqual(["team_invitation_resent"]);

    // El enlace anterior ya no sirve; el nuevo sí.
    expect((await peekTeamInvitation(client, TOKEN, NOW)).state).toBe("invalid");
    const newToken = sent[0].html.match(/\/register\/staff\/([A-Za-z0-9_-]+)"/)?.[1];
    expect((await peekTeamInvitation(client, newToken, NOW)).state).toBe("valid");
  });

  it("reenvía una invitación vencida", async () => {
    const { client } = createInMemorySupabase(world({ residence_team_invitations: [inviteRow(TOKEN, { id: "inv-1", expires_at: "2026-10-01T00:00:00.000Z" })] }));
    expect((await resendTeamInvitation(client, { actorUserId: "ricardo", residenceId: NORTE, invitationId: "inv-1", now: NOW })).ok).toBe(true);
  });

  it("el staff no puede reenviar; una invitación de otra residencia no existe; una cancelada no se reenvía", async () => {
    const w = world({
      residence_team_invitations: [
        inviteRow(TOKEN, { id: "inv-1" }),
        inviteRow("R".repeat(43), { id: "inv-rio", residence_id: RIO, email: "rio@example.com" }),
        inviteRow("C".repeat(43), { id: "inv-c", email: "c@example.com", status: "cancelled", cancelled_at: "2026-10-23T00:00:00.000Z" }),
      ],
    });
    const { client } = createInMemorySupabase(w);
    expect(await resendTeamInvitation(client, { actorUserId: "sofia", residenceId: NORTE, invitationId: "inv-1", now: NOW })).toEqual({ ok: false, error: OWNER_ONLY_MESSAGE });
    const cross = await resendTeamInvitation(client, { actorUserId: "ricardo", residenceId: NORTE, invitationId: "inv-rio", now: NOW });
    expect(cross).toEqual({ ok: false, error: "No encontramos esa invitación." });
    const cancelled = await resendTeamInvitation(client, { actorUserId: "ricardo", residenceId: NORTE, invitationId: "inv-c", now: NOW });
    expect(cancelled).toEqual({ ok: false, error: "Esa invitación ya no está pendiente." });
    expect(sent).toHaveLength(0);
  });

  it("cuenta para el límite por hora", async () => {
    const envios = Array.from({ length: MAX_INVITATIONS_PER_HOUR }, (_, i) => sendAudit("team_invitation_resent", NORTE, `inv${i}`, "2026-10-24T14:45:00.000Z"));
    const { client } = createInMemorySupabase(world({ residence_team_invitations: [inviteRow(TOKEN, { id: "inv-1" })], audit_logs: envios }));
    const r = await resendTeamInvitation(client, { actorUserId: "ricardo", residenceId: NORTE, invitationId: "inv-1", now: NOW });
    expect(!r.ok && r.error).toMatch(/muchas invitaciones/);
  });

  it("espera 10 minutos entre dos envíos de la MISMA invitación", async () => {
    const reciente = inviteRow(TOKEN, { id: "inv-1", last_sent_at: "2026-10-24T14:55:00.000Z" });
    const { client, tables } = createInMemorySupabase(world({ residence_team_invitations: [reciente] }));
    const r = await resendTeamInvitation(client, { actorUserId: "ricardo", residenceId: NORTE, invitationId: "inv-1", now: NOW });
    expect(!r.ok && r.error).toMatch(/Esperá unos minutos/);
    expect(sent).toHaveLength(0);
    expect(tables.residence_team_invitations[0].token_hash).toBe(hashInvitationToken(TOKEN));
    // Pasados los 10 minutos sí.
    const later = new Date(NOW.getTime() + 6 * 60 * 1000);
    expect((await resendTeamInvitation(client, { actorUserId: "ricardo", residenceId: NORTE, invitationId: "inv-1", now: later })).ok).toBe(true);
  });

  it("tope de envíos por invitación: a los 5 hay que cancelarla y crear otra", async () => {
    const { client } = createInMemorySupabase(world({ residence_team_invitations: [inviteRow(TOKEN, { id: "inv-1", send_count: MAX_SENDS_PER_INVITATION })] }));
    const r = await resendTeamInvitation(client, { actorUserId: "ricardo", residenceId: NORTE, invitationId: "inv-1", now: NOW });
    expect(!r.ok && r.error).toMatch(/Cancelala y creá una nueva/);
    expect(sent).toHaveLength(0);
    const ok = createInMemorySupabase(world({ residence_team_invitations: [inviteRow(TOKEN, { id: "inv-1", send_count: MAX_SENDS_PER_INVITATION - 1 })] }));
    expect((await resendTeamInvitation(ok.client, { actorUserId: "ricardo", residenceId: NORTE, invitationId: "inv-1", now: NOW })).ok).toBe(true);
  });

  it("si el email no sale NO rota el token: el enlace anterior sigue funcionando y no cuenta como envío", async () => {
    mailer.works = false;
    const { client, tables } = createInMemorySupabase(world({ residence_team_invitations: [inviteRow(TOKEN, { id: "inv-1" })] }));
    const r = await resendTeamInvitation(client, { actorUserId: "ricardo", residenceId: NORTE, invitationId: "inv-1", now: NOW });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/No pudimos enviar el email/);
    expect(tables.residence_team_invitations[0]).toMatchObject({
      token_hash: hashInvitationToken(TOKEN),
      send_count: 1,
      last_sent_at: "2026-10-24T14:00:00.000Z",
      expires_at: "2026-10-31T15:00:00.000Z",
    });
    expect(audits).toHaveLength(0);
    expect((await peekTeamInvitation(client, TOKEN, NOW)).state).toBe("valid");
  });

  it("no reenvía si la residencia está en borrador, suspendida, rechazada o archivada", async () => {
    for (const status of ["draft", "rejected", "suspended", "archived"]) {
      const w = world({ residence_team_invitations: [inviteRow(TOKEN, { id: "inv-1" })] });
      w.residences[0].status = status;
      const r = await resendTeamInvitation(createInMemorySupabase(w).client, { actorUserId: "ricardo", residenceId: NORTE, invitationId: "inv-1", now: NOW });
      expect(r.ok, status).toBe(false);
    }
    expect(sent).toHaveLength(0);
  });
});

describe("cancelTeamInvitation", () => {
  it("cancela una pendiente: el enlace deja de funcionar y se audita", async () => {
    const { client, tables } = createInMemorySupabase(world({ residence_team_invitations: [inviteRow(TOKEN, { id: "inv-1" })] }));
    expect(await cancelTeamInvitation(client, { actorUserId: "ricardo", residenceId: NORTE, invitationId: "inv-1", now: NOW })).toEqual({ ok: true, email: "nuevo@example.com" });
    expect(tables.residence_team_invitations[0]).toMatchObject({ status: "cancelled", cancelled_at: NOW.toISOString() });
    expect((await peekTeamInvitation(client, TOKEN, NOW)).state).toBe("invalid");
    expect(audits.map((a) => a.action)).toEqual(["team_invitation_cancelled"]);
    // Segunda vez: ya no está pendiente.
    const again = await cancelTeamInvitation(client, { actorUserId: "ricardo", residenceId: NORTE, invitationId: "inv-1", now: NOW });
    expect(again).toEqual({ ok: false, error: "Esa invitación ya no está pendiente." });
  });

  it("el staff no cancela, y no se puede cancelar la invitación de otra residencia", async () => {
    const { client, tables } = createInMemorySupabase(
      world({ residence_team_invitations: [inviteRow(TOKEN, { id: "inv-1" }), inviteRow("R".repeat(43), { id: "inv-rio", residence_id: RIO, email: "rio@example.com" })] }),
    );
    expect(await cancelTeamInvitation(client, { actorUserId: "sofia", residenceId: NORTE, invitationId: "inv-1", now: NOW })).toEqual({ ok: false, error: OWNER_ONLY_MESSAGE });
    expect(await cancelTeamInvitation(client, { actorUserId: "ricardo", residenceId: NORTE, invitationId: "inv-rio", now: NOW })).toEqual({ ok: false, error: "No encontramos esa invitación." });
    expect(tables.residence_team_invitations.every((i) => i.status === "pending")).toBe(true);
  });
});

describe("removeTeamMember", () => {
  it("el dueño quita a un staff: queda inactivo y revocado (la fila no se borra), se audita y se avisa", async () => {
    const { client, tables } = createInMemorySupabase(world());
    expect(await removeTeamMember(client, { actorUserId: "ricardo", residenceId: NORTE, memberUserId: "sofia" })).toEqual({ ok: true });
    const row = tables.residence_users.find((r) => r.user_id === "sofia" && r.residence_id === NORTE);
    expect(row).toMatchObject({ is_active: false, invitation_status: "revoked", role: "staff" });
    expect(audits.map((a) => a.action)).toEqual(["team_member_removed"]);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ userId: "sofia" });
    expect(notices[0].relatedEntityType).toBeUndefined(); // sin enlace: ya no tiene acceso
    // Y ya no tiene acceso a la residencia (pero sí conserva el rol global).
    const { assertResidenceAccess } = await import("@/lib/residences/access");
    expect(await assertResidenceAccess(client, "sofia", NORTE)).toBe(false);
  });

  it("el staff no puede quitar a nadie", async () => {
    const { client, tables } = createInMemorySupabase(world());
    expect(await removeTeamMember(client, { actorUserId: "sofia", residenceId: NORTE, memberUserId: "ricardo" })).toEqual({ ok: false, error: OWNER_ONLY_MESSAGE });
    expect(tables.residence_users.every((r) => r.is_active === true)).toBe(true);
  });

  it("el dueño no puede quitarse a sí mismo ni dejar la residencia sin dueño", async () => {
    const { client, tables } = createInMemorySupabase(world());
    const self = await removeTeamMember(client, { actorUserId: "ricardo", residenceId: NORTE, memberUserId: "ricardo" });
    expect(self).toEqual({ ok: false, error: "No podés quitarte el acceso a vos mismo." });
    expect(tables.residence_users.find((r) => r.id === "ru1")?.is_active).toBe(true);

    // Otro dueño tampoco puede sacar al último dueño.
    const w = world();
    w.residence_users.push({ id: "ru5", residence_id: NORTE, user_id: "ana", role: "owner", is_active: true, created_at: "2026-04-01T00:00:00.000Z" });
    const second = createInMemorySupabase(w);
    const last = await removeTeamMember(second.client, { actorUserId: "ana", residenceId: NORTE, memberUserId: "ricardo" });
    expect(last.ok).toBe(false);
    expect(second.tables.residence_users.find((r) => r.id === "ru1")?.is_active).toBe(true);
  });

  it("no se puede quitar a alguien de OTRA residencia aunque se conozca su id", async () => {
    const { client, tables } = createInMemorySupabase(world());
    // Ana (dueña de su casa) intenta quitar a Sofía de Norte desde su propia residencia: Sofía no está ahí.
    const r = await removeTeamMember(client, { actorUserId: "ana", residenceId: "res-ana", memberUserId: "sofia" });
    expect(r).toEqual({ ok: false, error: "No encontramos a esa persona en el equipo." });
    // Y Ana no puede actuar sobre Norte.
    expect(await removeTeamMember(client, { actorUserId: "ana", residenceId: NORTE, memberUserId: "sofia" })).toEqual({ ok: false, error: "No tenés acceso a esta residencia." });
    expect(tables.residence_users.find((x) => x.id === "ru3")?.is_active).toBe(true);
  });

  it("quitar dos veces: la segunda avisa que ya no tiene acceso", async () => {
    const { client } = createInMemorySupabase(world());
    await removeTeamMember(client, { actorUserId: "ricardo", residenceId: NORTE, memberUserId: "sofia" });
    const again = await removeTeamMember(client, { actorUserId: "ricardo", residenceId: NORTE, memberUserId: "sofia" });
    expect(again).toEqual({ ok: false, error: "Esa persona ya no tiene acceso a la residencia." });
  });

  it("funciona sin la migración 0051 (solo usa residence_users)", async () => {
    const { client } = createInMemorySupabase(world(), { missingTables: ["residence_team_invitations"] });
    expect((await removeTeamMember(client, { actorUserId: "ricardo", residenceId: NORTE, memberUserId: "sofia" })).ok).toBe(true);
  });
});

describe("acceptTeamInvitation", () => {
  const base = { rawToken: TOKEN, userId: "nuevo", userEmail: "nuevo@example.com", now: NOW };

  it("acepta: crea el vínculo como staff (nunca owner), audita y avisa al dueño", async () => {
    const { client, tables } = createInMemorySupabase(world({ residence_team_invitations: [inviteRow(TOKEN)] }));
    expect(await acceptTeamInvitation(client, base)).toEqual({ ok: true, residenceId: NORTE, alreadyMember: false });
    const link = tables.residence_users.find((r) => r.user_id === "nuevo");
    expect(link).toMatchObject({ residence_id: NORTE, role: "staff", is_active: true, invitation_status: "accepted", invited_by: "ricardo" });
    expect(tables.residence_team_invitations[0]).toMatchObject({ status: "accepted", accepted_by_user_id: "nuevo" });
    expect(audits.map((a) => a.action)).toEqual(["team_invitation_accepted"]);
    expect(teamNotifications).toEqual([{ residenceId: NORTE, event: "team_member_joined", entityId: NORTE }]);
  });

  it("un solo uso: la segunda vez es un enlace inválido, y en paralelo solo uno gana", async () => {
    const { client, tables } = createInMemorySupabase(world({ residence_team_invitations: [inviteRow(TOKEN)] }));
    const [a, b] = await Promise.all([acceptTeamInvitation(client, base), acceptTeamInvitation(client, base)]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    const loser = a.ok ? b : a;
    expect(loser).toEqual({ ok: false, code: "invalid", error: INVALID_INVITATION_MESSAGE });
    expect(tables.residence_users.filter((r) => r.user_id === "nuevo")).toHaveLength(1);
    expect(teamNotifications).toHaveLength(1);
  });

  it("un enlace vencido, cancelado, inexistente o con basura da el MISMO mensaje", async () => {
    const w = world({
      residence_team_invitations: [
        inviteRow(TOKEN, { expires_at: "2026-10-01T00:00:00.000Z" }),
        inviteRow("C".repeat(43), { id: "inv-c", email: "nuevo@example.com", status: "cancelled", cancelled_at: "2026-10-23T00:00:00.000Z" }),
      ],
    });
    const { client } = createInMemorySupabase(w);
    const results = await Promise.all([
      acceptTeamInvitation(client, base), // vencido
      acceptTeamInvitation(client, { ...base, rawToken: "C".repeat(43) }), // cancelado
      acceptTeamInvitation(client, { ...base, rawToken: "Z".repeat(43) }), // inexistente
      acceptTeamInvitation(client, { ...base, rawToken: "basura" }), // forma inválida
      acceptTeamInvitation(client, { ...base, rawToken: undefined }),
    ]);
    for (const r of results) expect(r).toEqual({ ok: false, code: "invalid", error: INVALID_INVITATION_MESSAGE });
  });

  it("exige el email invitado: otra cuenta no puede usar el enlace y la invitación sigue pendiente", async () => {
    const { client, tables } = createInMemorySupabase(world({ residence_team_invitations: [inviteRow(TOKEN)] }));
    const r = await acceptTeamInvitation(client, { ...base, userId: "sofia", userEmail: "sofia@example.com" });
    expect(r).toMatchObject({ ok: false, code: "email_mismatch" });
    expect(tables.residence_team_invitations[0].status).toBe("pending");
    expect(tables.residence_users.some((x) => x.user_id === "sofia" && x.residence_id === NORTE && x.role === "staff" && x.id !== "ru3")).toBe(false);
  });

  it("el email se compara sin importar mayúsculas", async () => {
    const { client } = createInMemorySupabase(world({ residence_team_invitations: [inviteRow(TOKEN)] }));
    expect((await acceptTeamInvitation(client, { ...base, userEmail: "  NUEVO@Example.com " })).ok).toBe(true);
  });

  it("una cuenta de estudiante, bloqueada o inexistente no puede sumarse: no se consume la invitación", async () => {
    const w = world({ residence_team_invitations: [inviteRow(TOKEN, { email: "lucia@example.com" }), inviteRow("B".repeat(43), { id: "inv-b", email: "bloqueado@example.com" })] });
    const { client, tables } = createInMemorySupabase(w);
    const student = await acceptTeamInvitation(client, { rawToken: TOKEN, userId: "lucia", userEmail: "lucia@example.com", now: NOW });
    expect(student).toMatchObject({ ok: false, code: "not_eligible" });
    const blocked = await acceptTeamInvitation(client, { rawToken: "B".repeat(43), userId: "bloqueado", userEmail: "bloqueado@example.com", now: NOW });
    expect(blocked).toMatchObject({ ok: false, code: "not_eligible" });
    const ghost = await acceptTeamInvitation(client, { rawToken: TOKEN, userId: "fantasma", userEmail: "lucia@example.com", now: NOW });
    expect(ghost).toMatchObject({ ok: false, code: "not_eligible" });
    expect(tables.residence_team_invitations.every((i) => i.status === "pending")).toBe(true);
    expect(tables.residence_users.some((r) => r.user_id === "lucia")).toBe(false);
  });

  it("no puede elevar a dueño: un vínculo de dueño existente no se toca ni se consume la invitación", async () => {
    // Ricardo es dueño de Norte e invitan a su propio email como staff de Norte.
    const { client, tables } = createInMemorySupabase(world({ residence_team_invitations: [inviteRow(TOKEN, { email: "ricardo@example.com" })] }));
    const r = await acceptTeamInvitation(client, { rawToken: TOKEN, userId: "ricardo", userEmail: "ricardo@example.com", now: NOW });
    expect(r).toMatchObject({ ok: false, code: "not_eligible" });
    expect(tables.residence_users.find((x) => x.id === "ru1")).toMatchObject({ role: "owner", is_active: true });
    expect(tables.residence_team_invitations[0].status).toBe("pending");
  });

  it("un dueño de otra residencia puede sumarse como staff a esta (vínculo propio, rol staff)", async () => {
    const { client, tables } = createInMemorySupabase(world({ residence_team_invitations: [inviteRow(TOKEN, { email: "ana@example.com" })] }));
    expect((await acceptTeamInvitation(client, { rawToken: TOKEN, userId: "ana", userEmail: "ana@example.com", now: NOW })).ok).toBe(true);
    expect(tables.residence_users.find((r) => r.user_id === "ana" && r.residence_id === NORTE)).toMatchObject({ role: "staff" });
    // Y sigue siendo dueña de su propia residencia.
    expect(tables.residence_users.find((r) => r.user_id === "ana" && r.residence_id === "res-ana")).toMatchObject({ role: "owner" });
  });

  it("reactiva a un staff al que se le había quitado el acceso", async () => {
    const w = world({ residence_team_invitations: [inviteRow(TOKEN, { email: "sofia@example.com" })] });
    w.residence_users.find((r) => r.id === "ru3")!.is_active = false;
    w.residence_users.find((r) => r.id === "ru3")!.invitation_status = "revoked";
    const { client, tables } = createInMemorySupabase(w);
    const r = await acceptTeamInvitation(client, { rawToken: TOKEN, userId: "sofia", userEmail: "sofia@example.com", now: NOW });
    expect(r).toEqual({ ok: true, residenceId: NORTE, alreadyMember: false });
    expect(tables.residence_users.find((x) => x.id === "ru3")).toMatchObject({ is_active: true, invitation_status: "accepted", role: "staff" });
    expect(tables.residence_users.filter((x) => x.user_id === "sofia" && x.residence_id === NORTE)).toHaveLength(1);
  });

  it("si ya es staff activo, consume la invitación sin duplicar el vínculo", async () => {
    const { client, tables } = createInMemorySupabase(world({ residence_team_invitations: [inviteRow(TOKEN, { email: "sofia@example.com" })] }));
    const r = await acceptTeamInvitation(client, { rawToken: TOKEN, userId: "sofia", userEmail: "sofia@example.com", now: NOW });
    expect(r).toEqual({ ok: true, residenceId: NORTE, alreadyMember: true });
    expect(tables.residence_users.filter((x) => x.user_id === "sofia" && x.residence_id === NORTE)).toHaveLength(1);
  });

  it("si falla crear el vínculo devuelve la invitación a pendiente para reintentar", async () => {
    const { client, tables } = createInMemorySupabase(world({ residence_team_invitations: [inviteRow(TOKEN)] }), {
      failInsert: { residence_users: { code: "XX000", message: "boom" } },
    });
    const r = await acceptTeamInvitation(client, base);
    expect(r).toMatchObject({ ok: false, code: "failed" });
    expect(tables.residence_team_invitations[0]).toMatchObject({ status: "pending", accepted_at: null, accepted_by_user_id: null });
    // Reintento con el mismo enlace: ahora sí.
    expect((await acceptTeamInvitation(client, base)).ok).toBe(true);
  });

  it("revalida a quien invitó: si ya no es dueño activo de la residencia, el enlace queda inválido y no se consume", async () => {
    const casos: [string, (w: Record<string, Row[]>) => void][] = [
      ["se le quitó el acceso", (w) => void (w.residence_users.find((r) => r.id === "ru1")!.is_active = false)],
      ["pasó a ser staff", (w) => void (w.residence_users.find((r) => r.id === "ru1")!.role = "staff")],
      ["se borró su vínculo", (w) => void (w.residence_users = w.residence_users.filter((r) => r.id !== "ru1"))],
    ];
    for (const [nombre, mutar] of casos) {
      const w = world({ residence_team_invitations: [inviteRow(TOKEN)] });
      mutar(w);
      const { client, tables } = createInMemorySupabase(w);
      expect(await acceptTeamInvitation(client, base), nombre).toEqual({ ok: false, code: "invalid", error: INVALID_INVITATION_MESSAGE });
      expect((await peekTeamInvitation(client, TOKEN, NOW)).state, nombre).toBe("invalid");
      expect(tables.residence_team_invitations[0].status, nombre).toBe("pending");
      expect(tables.residence_users.some((r) => r.user_id === "nuevo"), nombre).toBe(false);
    }
  });

  it("si el usuario que invitó se borró (invited_by nulo) la invitación ya no se puede aceptar", async () => {
    const { client, tables } = createInMemorySupabase(world({ residence_team_invitations: [inviteRow(TOKEN, { invited_by: null })] }));
    expect(await acceptTeamInvitation(client, base)).toEqual({ ok: false, code: "invalid", error: INVALID_INVITATION_MESSAGE });
    expect(tables.residence_users.some((r) => r.user_id === "nuevo")).toBe(false);
  });

  it("si otro dueño sigue activo, la invitación del dueño que ya no está no sirve igual (vale quien invitó)", async () => {
    const w = world({ residence_team_invitations: [inviteRow(TOKEN)] });
    w.residence_users.find((r) => r.id === "ru1")!.is_active = false;
    w.residence_users.push({ id: "ru9", residence_id: NORTE, user_id: "ana", role: "owner", is_active: true, created_at: "2026-04-01T00:00:00.000Z" });
    const { client } = createInMemorySupabase(w);
    expect((await acceptTeamInvitation(client, base)).ok).toBe(false);
  });

  it("no se acepta si la residencia está rechazada, suspendida o archivada (mismo mensaje neutro)", async () => {
    for (const status of ["rejected", "suspended", "archived"]) {
      const w = world({ residence_team_invitations: [inviteRow(TOKEN)] });
      w.residences[0].status = status;
      const { client, tables } = createInMemorySupabase(w);
      expect(await acceptTeamInvitation(client, base), status).toEqual({ ok: false, code: "invalid", error: INVALID_INVITATION_MESSAGE });
      expect((await peekTeamInvitation(client, TOKEN, NOW)).state, status).toBe("invalid");
      expect(tables.residence_team_invitations[0].status, status).toBe("pending");
    }
    // Una residencia todavía en revisión sí deja aceptar.
    const w = world({ residence_team_invitations: [inviteRow(TOKEN)] });
    w.residences[0].status = "pending_verification";
    expect((await acceptTeamInvitation(createInMemorySupabase(w).client, base)).ok).toBe(true);
  });

  it("una cuenta con rol admin, superadmin o estudiante no puede aceptar aunque también tenga rol de residencia", async () => {
    for (const extra of ["admin", "superadmin", "student"]) {
      const w = world({ residence_team_invitations: [inviteRow(TOKEN)] });
      w.user_roles.push({ user_id: "nuevo", role: extra, is_active: true });
      const { client, tables } = createInMemorySupabase(w);
      expect(await acceptTeamInvitation(client, base), extra).toMatchObject({ ok: false, code: "not_eligible" });
      expect(tables.residence_team_invitations[0].status, extra).toBe("pending");
      expect(tables.residence_users.some((r) => r.user_id === "nuevo"), extra).toBe(false);
    }
  });

  it("un familiar que además tiene rol de residencia sí puede aceptar", async () => {
    const w = world({ residence_team_invitations: [inviteRow(TOKEN, { email: "ana@example.com" })] });
    w.user_roles.push({ user_id: "ana", role: "family_member", is_active: true });
    const { client } = createInMemorySupabase(w);
    expect((await acceptTeamInvitation(client, { rawToken: TOKEN, userId: "ana", userEmail: "ana@example.com", now: NOW })).ok).toBe(true);
  });

  it("sin la migración 0051 el enlace se ve como inválido", async () => {
    const { client } = createInMemorySupabase(world(), { missingTables: ["residence_team_invitations"] });
    expect(await acceptTeamInvitation(client, base)).toEqual({ ok: false, code: "invalid", error: INVALID_INVITATION_MESSAGE });
  });
});

describe("peekTeamInvitation y loadTeamSnapshot", () => {
  it("peek: válida muestra residencia y email; vencida, usada o inexistente son lo mismo", async () => {
    const { client } = createInMemorySupabase(
      world({
        residence_team_invitations: [
          inviteRow(TOKEN),
          inviteRow("E".repeat(43), { id: "inv-e", email: "e@example.com", expires_at: "2026-10-01T00:00:00.000Z" }),
          inviteRow("A".repeat(43), { id: "inv-a", email: "a@example.com", status: "accepted", accepted_at: "2026-10-23T00:00:00.000Z", accepted_by_user_id: "nuevo" }),
        ],
      }),
    );
    expect(await peekTeamInvitation(client, TOKEN, NOW)).toEqual({ state: "valid", email: "nuevo@example.com", residenceId: NORTE, residenceName: "Residencia Norte" });
    for (const t of ["E".repeat(43), "A".repeat(43), "Z".repeat(43), "x"]) expect(await peekTeamInvitation(client, t, NOW)).toEqual({ state: "invalid" });
  });

  it("snapshot: miembros activos con email, rol y orden; invitaciones con su estado", async () => {
    const w = world({ residence_team_invitations: [inviteRow(TOKEN), inviteRow("E".repeat(43), { id: "inv-e", email: "e@example.com", expires_at: "2026-10-01T00:00:00.000Z" })] });
    w.residence_users.push({ id: "ru6", residence_id: NORTE, user_id: "lucia", role: "staff", is_active: false, created_at: "2026-05-01T00:00:00.000Z" });
    const { client } = createInMemorySupabase(w);
    const s = await loadTeamSnapshot(client, NORTE, NOW);
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    expect(s.members.map((m) => [m.email, m.role])).toEqual([
      ["ricardo@example.com", "owner"],
      ["sofia@example.com", "staff"],
    ]);
    expect(s.invitations?.map((i) => i.view).sort()).toEqual(["expired", "pending"]);
  });

  it("snapshot sin la migración: hay miembros y las invitaciones quedan en null", async () => {
    const { client } = createInMemorySupabase(world(), { missingTables: ["residence_team_invitations"] });
    const s = await loadTeamSnapshot(client, NORTE, NOW);
    expect(s.ok && s.invitations).toBeNull();
    expect(s.ok && s.members).toHaveLength(2);
  });
});

describe("invitar con permisos iniciales (DR11)", () => {
  it("guarda en la invitación los permisos que eligió el dueño (mapa completo)", async () => {
    const { client, tables } = createInMemorySupabase(world());
    const permissions = presetPermissions("applications");
    const r = await inviteTeamMember(client, { actorUserId: "ricardo", residenceId: NORTE, email: "nuevo@example.com", permissions, now: NOW });
    expect(r.ok).toBe(true);
    expect(tables.residence_team_invitations[0].permissions).toEqual(permissions);
  });

  it("sin permisos explícitos usa los valores por defecto", async () => {
    const { client, tables } = createInMemorySupabase(world());
    await inviteTeamMember(client, { actorUserId: "ricardo", residenceId: NORTE, email: "nuevo@example.com", now: NOW });
    expect(tables.residence_team_invitations[0].permissions).toEqual(defaultPermissions());
  });

  it("ignora claves desconocidas y valores raros (nunca guarda de más)", async () => {
    const { client, tables } = createInMemorySupabase(world());
    await inviteTeamMember(client, {
      actorUserId: "ricardo",
      residenceId: NORTE,
      email: "nuevo@example.com",
      permissions: { "team.manage": true, "faq.manage": "si", "profile.edit": true },
      now: NOW,
    });
    const stored = tables.residence_team_invitations[0].permissions as Record<string, boolean>;
    expect(stored["team.manage"]).toBeUndefined();
    expect(stored["faq.manage"]).toBe(false);
    expect(stored["profile.edit"]).toBe(true);
  });

  it("el staff no puede invitar con permisos (ni elegir los suyos)", async () => {
    const { client, tables } = createInMemorySupabase(world());
    const r = await inviteTeamMember(client, { actorUserId: "sofia", residenceId: NORTE, email: "x@example.com", permissions: presetPermissions("full_operation"), now: NOW });
    expect(r).toEqual({ ok: false, error: OWNER_ONLY_MESSAGE });
    expect(tables.residence_team_invitations).toHaveLength(0);
  });

  it("sin la columna de permisos: con los valores por defecto igual invita; con permisos personalizados rechaza (no da de más)", async () => {
    const missing = { missingColumns: { residence_team_invitations: ["permissions"] } };
    const a = createInMemorySupabase(world(), missing);
    const ok = await inviteTeamMember(a.client, { actorUserId: "ricardo", residenceId: NORTE, email: "defecto@example.com", now: NOW });
    expect(ok.ok).toBe(true);
    expect(a.tables.residence_team_invitations).toHaveLength(1);
    expect(a.tables.residence_team_invitations[0].permissions).toBeUndefined();

    const b = createInMemorySupabase(world(), missing);
    const custom = await inviteTeamMember(b.client, { actorUserId: "ricardo", residenceId: NORTE, email: "custom@example.com", permissions: presetPermissions("read_only"), now: NOW });
    expect(custom).toEqual({ ok: false, error: PERMISSIONS_UNAVAILABLE_MESSAGE });
    expect(b.tables.residence_team_invitations).toHaveLength(0);
    expect(sent.filter((m) => m.to === "custom@example.com")).toHaveLength(0);
  });

  it("al aceptar, el vínculo nace con los permisos de la invitación", async () => {
    const permissions = presetPermissions("read_only");
    const { client, tables } = createInMemorySupabase(world({ residence_team_invitations: [inviteRow(TOKEN, { permissions })] }));
    expect((await acceptTeamInvitation(client, { rawToken: TOKEN, userId: "nuevo", userEmail: "nuevo@example.com", now: NOW })).ok).toBe(true);
    expect(tables.residence_users.find((r) => r.user_id === "nuevo")?.permissions).toEqual(permissions);
  });

  it("una invitación sin permisos guardados (anterior a DR11 o '{}') da los valores por defecto; un valor que no es objeto, nada", async () => {
    for (const patch of [{}, { permissions: {} }]) {
      const { client, tables } = createInMemorySupabase(world({ residence_team_invitations: [inviteRow(TOKEN, patch)] }));
      await acceptTeamInvitation(client, { rawToken: TOKEN, userId: "nuevo", userEmail: "nuevo@example.com", now: NOW });
      expect(tables.residence_users.find((r) => r.user_id === "nuevo")?.permissions).toEqual(defaultPermissions());
    }
    // `null` falla cerrado: todo apagado.
    const { client, tables } = createInMemorySupabase(world({ residence_team_invitations: [inviteRow(TOKEN, { permissions: null })] }));
    await acceptTeamInvitation(client, { rawToken: TOKEN, userId: "nuevo", userEmail: "nuevo@example.com", now: NOW });
    expect(tables.residence_users.find((r) => r.user_id === "nuevo")?.permissions).toEqual(noPermissions());
  });

  it("dos aceptaciones simultáneas con un solo lugar: solo una entra y la otra queda en pending sin vínculo activo", async () => {
    const w = world({
      residence_team_invitations: [
        inviteRow(TOKEN, { id: "inv-a", email: "nuevo@example.com" }),
        inviteRow("otro-token-0000", { id: "inv-b", email: "lucia@example.com" }),
      ],
    });
    w.residence_users.push(
      ...Array.from({ length: MAX_STAFF_PER_RESIDENCE - 2 }, (_, i) => ({ id: `rux${i}`, residence_id: NORTE, user_id: `staff${i}`, role: "staff", is_active: true, created_at: "2026-03-01T00:00:00.000Z" })),
    ); // 8 + Sofía = 9 staff activos: queda un solo lugar
    const { client, tables } = createInMemorySupabase(w);
    const results = await Promise.all([
      acceptTeamInvitation(client, { rawToken: TOKEN, userId: "nuevo", userEmail: "nuevo@example.com", now: NOW }),
      acceptTeamInvitation(client, { rawToken: "otro-token-0000", userId: "lucia", userEmail: "lucia@example.com", now: NOW }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const activeStaff = tables.residence_users.filter((r) => r.residence_id === NORTE && r.role === "staff" && r.is_active === true);
    expect(activeStaff.length).toBeLessThanOrEqual(MAX_STAFF_PER_RESIDENCE);
    const loser = results.findIndex((r) => !r.ok);
    expect(tables.residence_team_invitations.find((i) => i.id === (loser === 0 ? "inv-a" : "inv-b"))?.status).toBe("pending");
  });

  it("sin la columna se puede aceptar igual (valores por defecto)", async () => {
    const { client, tables } = createInMemorySupabase(world({ residence_team_invitations: [inviteRow(TOKEN)] }), {
      missingColumns: { residence_team_invitations: ["permissions"] },
    });
    expect((await acceptTeamInvitation(client, { rawToken: TOKEN, userId: "nuevo", userEmail: "nuevo@example.com", now: NOW })).ok).toBe(true);
    expect(tables.residence_users.find((r) => r.user_id === "nuevo")?.permissions).toEqual(defaultPermissions());
  });

  it("reactivar a un staff al que se le había quitado el acceso aplica los permisos NUEVOS de la invitación, no los viejos", async () => {
    const w = world({ residence_team_invitations: [inviteRow(TOKEN, { email: "sofia@example.com", permissions: presetPermissions("read_only") })] });
    const row = w.residence_users.find((r) => r.id === "ru3")!;
    row.is_active = false;
    row.invitation_status = "revoked";
    row.permissions = presetPermissions("full_operation");
    const { client, tables } = createInMemorySupabase(w);
    expect((await acceptTeamInvitation(client, { rawToken: TOKEN, userId: "sofia", userEmail: "sofia@example.com", now: NOW })).ok).toBe(true);
    expect(tables.residence_users.find((r) => r.id === "ru3")?.permissions).toEqual(presetPermissions("read_only"));
  });

  it("si ya era staff activo, aceptar NO pisa sus permisos actuales", async () => {
    const w = world({ residence_team_invitations: [inviteRow(TOKEN, { email: "sofia@example.com", permissions: presetPermissions("read_only") })] });
    w.residence_users.find((r) => r.id === "ru3")!.permissions = presetPermissions("full_operation");
    const { client, tables } = createInMemorySupabase(w);
    const r = await acceptTeamInvitation(client, { rawToken: TOKEN, userId: "sofia", userEmail: "sofia@example.com", now: NOW });
    expect(r).toMatchObject({ ok: true, alreadyMember: true });
    expect(tables.residence_users.find((x) => x.id === "ru3")?.permissions).toEqual(presetPermissions("full_operation"));
  });
});

describe("updateTeamMemberPermissions (DR11)", () => {
  const params = (over: Record<string, unknown> = {}) => ({
    actorUserId: "ricardo",
    residenceId: NORTE,
    memberUserId: "sofia",
    permissions: permissionsFromChecked(["faq.manage", "profile.edit"]),
    ...over,
  });

  it("el dueño guarda el mapa completo, audita las claves que cambiaron y avisa al staff", async () => {
    const { client, tables } = createInMemorySupabase(world());
    const r = await updateTeamMemberPermissions(client, params());
    expect(r).toMatchObject({ ok: true });
    expect(tables.residence_users.find((x) => x.id === "ru3")?.permissions).toEqual(permissionsFromChecked(["faq.manage", "profile.edit"]));

    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: "team_permissions_changed", actorUserId: "ricardo", actorRole: "residence_owner", entityType: "residence_users" });
    const newValue = audits[0].newValue as { residence_id: string; changed_keys: string[]; permissions: Record<string, boolean> };
    expect(newValue.residence_id).toBe(NORTE);
    // Desde los valores iniciales solo cambian estas: se apagan las que estaban encendidas y se enciende profile.edit.
    expect([...newValue.changed_keys].sort()).toEqual(
      [
        "applications.reject",
        "applications.review_contact",
        "operations.rooms_availability",
        "payments.residence",
        "profile.edit",
        "renewals.manage",
        "residents.manage",
        "waitlist.manage",
      ].sort(),
    );
    expect(newValue.permissions["profile.edit"]).toBe(true);
    expect(newValue.permissions["faq.manage"]).toBeUndefined(); // no cambió: no se lista

    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ userId: "sofia" });
    expect(notices[0].title).toBe("El dueño actualizó tus permisos en Residencia Norte");
    expect(notices[0].relatedEntityType).toBeUndefined();
    // El aviso es genérico: no detalla cuáles permisos ni nombra al dueño.
    expect(JSON.stringify(notices[0])).not.toMatch(/ricardo|faq|profile\.edit/i);
  });

  it("sin cambios no escribe, no audita ni avisa", async () => {
    const { client, tables, log } = createInMemorySupabase(world());
    const before = log.length;
    const r = await updateTeamMemberPermissions(client, params({ permissions: defaultPermissions() }));
    expect(r).toMatchObject({ ok: true, changed: 0 });
    expect(log.length).toBe(before);
    expect(audits).toHaveLength(0);
    expect(notices).toHaveLength(0);
    expect(tables.residence_users.find((x) => x.id === "ru3")?.permissions).toEqual({});
  });

  it("solo el dueño: el staff (aunque tenga todo lo delegable) no cambia permisos de nadie ni los suyos", async () => {
    const w = world();
    w.residence_users.find((r) => r.id === "ru3")!.permissions = presetPermissions("full_operation");
    const { client, tables } = createInMemorySupabase(w);
    for (const memberUserId of ["sofia", "ricardo"]) {
      const r = await updateTeamMemberPermissions(client, params({ actorUserId: "sofia", memberUserId, permissions: { ...presetPermissions("full_operation"), "profile.edit": true, "applications.send_adjustment": true } }));
      expect(r).toEqual({ ok: false, error: OWNER_ONLY_MESSAGE });
    }
    expect(tables.residence_users.find((x) => x.id === "ru3")?.permissions).toEqual(presetPermissions("full_operation"));
    expect(audits).toHaveLength(0);
  });

  it("el dueño no se edita a sí mismo ni a otro dueño", async () => {
    const w = world();
    w.residence_users.push({ id: "ru5", residence_id: NORTE, user_id: "ana", role: "owner", is_active: true, created_at: "2026-04-01T00:00:00.000Z" });
    const { client, tables } = createInMemorySupabase(w);
    for (const memberUserId of ["ricardo", "ana"]) {
      const r = await updateTeamMemberPermissions(client, params({ memberUserId }));
      expect(r.ok, memberUserId).toBe(false);
    }
    expect(tables.residence_users.find((x) => x.id === "ru1")?.permissions).toBeUndefined();
    expect(tables.residence_users.find((x) => x.id === "ru5")?.permissions).toBeUndefined();
  });

  it("aislamiento: no se editan permisos de alguien de OTRA residencia, ni se actúa sobre una ajena", async () => {
    const { client, tables } = createInMemorySupabase(world());
    // Ana (dueña de su casa) intenta tocar a Sofía (staff de Norte) desde su propia residencia: no está ahí.
    expect(await updateTeamMemberPermissions(client, params({ actorUserId: "ana", residenceId: "res-ana" }))).toEqual({ ok: false, error: "No encontramos a esa persona en el equipo." });
    // Y no puede actuar sobre Norte.
    expect(await updateTeamMemberPermissions(client, params({ actorUserId: "ana" }))).toEqual({ ok: false, error: "No tenés acceso a esta residencia." });
    expect(tables.residence_users.find((x) => x.id === "ru3")?.permissions).toEqual({});
  });

  it("los permisos son por residencia: cambiar los de Norte no toca los de la misma persona en Río", async () => {
    const w = world();
    w.residence_users.push({ id: "ru-sofia-rio", residence_id: RIO, user_id: "sofia", role: "staff", is_active: true, permissions: presetPermissions("read_only") });
    const { client, tables } = createInMemorySupabase(w);
    expect((await updateTeamMemberPermissions(client, params())).ok).toBe(true);
    expect(tables.residence_users.find((x) => x.id === "ru-sofia-rio")?.permissions).toEqual(presetPermissions("read_only"));
  });

  it("un staff al que ya se le quitó el acceso no se edita", async () => {
    const w = world();
    w.residence_users.find((r) => r.id === "ru3")!.is_active = false;
    const { client } = createInMemorySupabase(w);
    expect(await updateTeamMemberPermissions(client, params())).toEqual({ ok: false, error: "No encontramos a esa persona en el equipo." });
  });

  it("claves desconocidas o valores raros nunca se guardan; el resultado es siempre el mapa completo y conocido", async () => {
    const { client, tables } = createInMemorySupabase(world());
    await updateTeamMemberPermissions(client, params({ permissions: { "team.manage": true, "__proto__": { x: 1 }, "faq.manage": "true", "profile.edit": true } }));
    const stored = tables.residence_users.find((x) => x.id === "ru3")?.permissions as Record<string, boolean>;
    expect(Object.keys(stored).sort()).toEqual(Object.keys(defaultPermissions()).sort());
    expect(stored["faq.manage"]).toBe(false);
    expect(resolveStaffPermissions(stored)["profile.edit"]).toBe(true);
  });

  it("el cambio rige de inmediato: lo lee getResidenceMembership con los permisos nuevos", async () => {
    const { client } = createInMemorySupabase(world());
    await updateTeamMemberPermissions(client, params({ permissions: permissionsFromChecked(["profile.edit"]) }));
    const { getResidenceMembership } = await import("@/lib/residences/access");
    const membership = await getResidenceMembership(client, "sofia", NORTE);
    expect(membership?.role).toBe("staff");
    expect(membership?.permissions["profile.edit"]).toBe(true);
    expect(membership?.permissions["faq.manage"]).toBe(false);
  });

  it("falla cerrado ante un error de escritura", async () => {
    const { client, tables } = createInMemorySupabase(world(), { failUpdate: { residence_users: { code: "XX000", message: "boom" } } });
    const r = await updateTeamMemberPermissions(client, params());
    expect(r.ok).toBe(false);
    expect(tables.residence_users.find((x) => x.id === "ru3")?.permissions).toEqual({});
    expect(audits).toHaveLength(0);
  });
});
