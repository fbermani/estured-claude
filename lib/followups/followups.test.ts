import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/email/sendEmail", () => ({ sendEmail: vi.fn(async () => true) }));

import { computeDueAt, isNoResponseDue, isStayLive, validateFollowupAnswers } from "@/lib/followups/common";
import { runStayFollowups } from "@/lib/jobs/runStayFollowups";
import { resolveFollowupRole } from "@/lib/followups/access";
import { submitFollowupResponse } from "@/lib/followups/respond";
import { communicateFollowupToResidence, markFollowupReviewed } from "@/lib/followups/adminActions";
import { permissionsFromChecked } from "@/lib/residences/permissions";
import { createInMemorySupabase } from "@/lib/testing/inMemorySupabase";

const NOW = new Date("2026-10-25T15:00:00.000Z");
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString().slice(0, 10);

function world(extra: Record<string, Record<string, unknown>[]> = {}) {
  return createInMemorySupabase({
    student_profiles: [
      { id: "sp-adulto", user_id: "u-adulto", first_name: "Lucía", last_initial: "F", is_minor: false },
      { id: "sp-menor", user_id: "u-menor", first_name: "Tomás", last_initial: "R", is_minor: true },
    ],
    users: [
      { id: "u-adulto", email: "a@example.com" },
      { id: "u-menor", email: "m@example.com" },
      { id: "u-guardian", email: "g@example.com" },
    ],
    residence_users: [
      { residence_id: "res-1", user_id: "dueno", role: "owner", is_active: true },
      { residence_id: "res-1", user_id: "con", role: "staff", is_active: true, permissions: permissionsFromChecked(["residents.manage"]) },
      { residence_id: "res-1", user_id: "sin", role: "staff", is_active: true, permissions: permissionsFromChecked(["faq.manage"]) },
    ],
    family_links: [],
    resident_stays: [
      { id: "stay-adulto", residence_id: "res-1", student_profile_id: "sp-adulto", status: "active", start_date: day(-5), end_date: null, is_current: true },
    ],
    stay_followups: [],
    stay_followup_responses: [],
    notifications: [],
    audit_logs: [],
    ...extra,
  });
}

describe("fechas y validación", () => {
  it("due_at = inicio + 5 días a medianoche de Buenos Aires", () => {
    expect(computeDueAt("2026-10-20")?.toISOString()).toBe("2026-10-25T03:00:00.000Z");
    expect(computeDueAt("basura")).toBeNull();
  });
  it("estadía vigente: estado vivo, is_current y sin end_date pasada", () => {
    expect(isStayLive({ status: "active", is_current: true, end_date: null }, NOW)).toBe(true);
    expect(isStayLive({ status: "inactive", is_current: true, end_date: null }, NOW)).toBe(false);
    expect(isStayLive({ status: "active", is_current: false, end_date: null }, NOW)).toBe(false);
    expect(isStayLive({ status: "active", is_current: true, end_date: day(-1) }, NOW)).toBe(false);
  });
  it("no_response a los 14 días desde sent", () => {
    expect(isNoResponseDue(new Date(NOW.getTime() - 13 * 86_400_000).toISOString(), NOW)).toBe(false);
    expect(isNoResponseDue(new Date(NOW.getTime() - 14 * 86_400_000).toISOString(), NOW)).toBe(true);
    expect(isNoResponseDue(null, NOW)).toBe(false);
  });
  it("valida opciones y largo del comentario", () => {
    expect(validateFollowupAnswers({ howIsItGoing: "x", wasAsExpected: "yes", comment: "" }).ok).toBe(false);
    expect(validateFollowupAnswers({ howIsItGoing: "well", wasAsExpected: "x", comment: "" }).ok).toBe(false);
    expect(validateFollowupAnswers({ howIsItGoing: "well", wasAsExpected: "yes", comment: "a".repeat(1001) }).ok).toBe(false);
    expect(validateFollowupAnswers({ howIsItGoing: "well", wasAsExpected: "yes", comment: "  " })).toEqual({ ok: true, comment: null });
  });
});

describe("job runStayFollowups", () => {
  it("programa, envía a los 5 días (residencia con residents.manage + estudiante) y es idempotente", async () => {
    const { client, tables } = world();
    const first = await runStayFollowups(client, NOW);
    expect(first).toMatchObject({ scheduled: 1, sent: 1 });
    expect(tables.stay_followups[0]).toMatchObject({ status: "sent", resident_stay_id: "stay-adulto" });

    const residenceNotifs = tables.notifications.filter((n) => n.related_entity_type === "resident_stays");
    expect(residenceNotifs.map((n) => n.user_id).sort()).toEqual(["con", "dueno"]);
    // La residencia NO recibe el id del seguimiento ni ninguna señal de respuesta.
    for (const n of residenceNotifs) {
      expect(n.related_entity_id).toBe("stay-adulto");
      expect(`${n.title} ${n.body}`).not.toMatch(/respuesta|respond|encuesta/i);
    }
    const survey = tables.notifications.filter((n) => n.related_entity_type === "stay_followups");
    expect(survey.map((n) => n.user_id)).toEqual(["u-adulto"]);

    const again = await runStayFollowups(client, NOW);
    expect(again).toEqual({ scheduled: 0, sent: 0, cancelled: 0, noResponse: 0 });
    expect(tables.notifications).toHaveLength(3);
  });

  it("no envía antes de due_at", async () => {
    const { client, tables } = world({
      resident_stays: [{ id: "s", residence_id: "res-1", student_profile_id: "sp-adulto", status: "active", start_date: day(-2), end_date: null, is_current: true }],
    });
    const result = await runStayFollowups(client, NOW);
    expect(result).toMatchObject({ scheduled: 1, sent: 0 });
    expect(tables.stay_followups[0].status).toBe("scheduled");
    expect(tables.notifications).toHaveLength(0);
  });

  it("estadía de hace meses no dispara avisos (ventana de descubrimiento)", async () => {
    const { client } = world({
      resident_stays: [{ id: "viejo", residence_id: "res-1", student_profile_id: "sp-adulto", status: "active", start_date: day(-90), end_date: null, is_current: true }],
    });
    expect(await runStayFollowups(client, NOW)).toMatchObject({ scheduled: 0, sent: 0 });
  });

  it("cancela si la estadía se cierra antes de due_at", async () => {
    const { client, tables } = world({
      resident_stays: [{ id: "s", residence_id: "res-1", student_profile_id: "sp-adulto", status: "active", start_date: day(-2), end_date: null, is_current: true }],
    });
    await runStayFollowups(client, NOW);
    tables.resident_stays[0].end_date = day(0);
    const result = await runStayFollowups(client, NOW);
    expect(result.cancelled).toBe(1);
    expect(tables.stay_followups[0].status).toBe("cancelled");
  });

  it("marca no_response a los 14 días de sent y no antes", async () => {
    const { client, tables } = world();
    await runStayFollowups(client, NOW);
    expect((await runStayFollowups(client, new Date(NOW.getTime() + 13 * 86_400_000))).noResponse).toBe(0);
    const later = await runStayFollowups(client, new Date(NOW.getTime() + 14 * 86_400_000));
    expect(later.noResponse).toBe(1);
    expect(tables.stay_followups[0].status).toBe("no_response");
  });

  it("estudiante menor: la encuesta le llega también al guardián vinculado", async () => {
    const { client, tables } = world({
      resident_stays: [{ id: "s-menor", residence_id: "res-1", student_profile_id: "sp-menor", status: "active", start_date: day(-5), end_date: null, is_current: true }],
      family_links: [{ student_profile_id: "sp-menor", status: "active", family_members: { user_id: "u-guardian" } }],
    });
    await runStayFollowups(client, NOW);
    const survey = tables.notifications.filter((n) => n.related_entity_type === "stay_followups").map((n) => n.user_id).sort();
    expect(survey).toEqual(["u-guardian", "u-menor"]);
  });

  it("estadía sin cuenta de estudiante: solo se avisa a la residencia, sin encuesta", async () => {
    const { client, tables } = world({
      resident_stays: [{ id: "s-ext", residence_id: "res-1", student_profile_id: null, status: "pending_activation", start_date: day(-5), end_date: null, is_current: true }],
    });
    await runStayFollowups(client, NOW);
    expect(tables.notifications.every((n) => n.related_entity_type === "resident_stays")).toBe(true);
    expect(tables.stay_followups[0].survey_sent_at ?? null).toBeNull();
  });

  it("sin la migración 0055 devuelve ceros y no lanza", async () => {
    const { client } = createInMemorySupabase({ resident_stays: [] }, { missingTables: ["stay_followups"] });
    expect(await runStayFollowups(client, NOW)).toEqual({ scheduled: 0, sent: 0, cancelled: 0, noResponse: 0 });
  });
});

describe("robustez del job", () => {
  it("un error de lectura de la estadía NO cancela el seguimiento", async () => {
    const w = world();
    await runStayFollowups(w.client, new Date(NOW.getTime() - 4 * 86_400_000)); // programa
    const broken = createInMemorySupabase(
      { ...w.tables, resident_stays: w.tables.resident_stays },
      { missingTables: ["resident_stays"] },
    );
    const result = await runStayFollowups(broken.client, NOW);
    expect(result.cancelled).toBe(0);
    expect(broken.tables.stay_followups[0].status).toBe("scheduled");
  });

  it("si la entrega falla vuelve a scheduled (reintenta) y audita; luego se entrega una sola vez", async () => {
    const w = world();
    const broken = createInMemorySupabase({ ...w.tables, student_profiles: [] }, { missingTables: ["student_profiles"] });
    const first = await runStayFollowups(broken.client, NOW);
    expect(first.sent).toBe(0);
    expect(broken.tables.stay_followups[0].status).toBe("scheduled");
    expect(broken.tables.audit_logs.some((a) => a.action === "stay_followup_delivery_failed")).toBe(true);
    expect(broken.tables.notifications).toHaveLength(0);
    const ok = createInMemorySupabase(w.tables);
    expect((await runStayFollowups(ok.client, NOW)).sent).toBe(1);
    expect((await runStayFollowups(ok.client, NOW)).sent).toBe(0);
  });

  it("estadía sin cuenta que se vincula: el seguimiento toma al estudiante y recibe la encuesta", async () => {
    const w = world({
      resident_stays: [{ id: "s-x", residence_id: "res-1", student_profile_id: null, status: "pending_activation", start_date: day(-5), end_date: null, is_current: true }],
    });
    await runStayFollowups(w.client, NOW);
    expect(w.tables.notifications.some((n) => n.related_entity_type === "stay_followups")).toBe(false);
    w.tables.resident_stays[0].student_profile_id = "sp-adulto";
    await runStayFollowups(w.client, NOW);
    expect(w.tables.stay_followups[0].student_profile_id).toBe("sp-adulto");
    expect(w.tables.notifications.filter((n) => n.related_entity_type === "stay_followups").map((n) => n.user_id)).toEqual(["u-adulto"]);
    await runStayFollowups(w.client, NOW);
    expect(w.tables.notifications.filter((n) => n.related_entity_type === "stay_followups")).toHaveLength(1);
  });

  it("vinculación antes de due_at: sincroniza el estudiante en el paso scheduled", async () => {
    const w = world({
      resident_stays: [{ id: "s-y", residence_id: "res-1", student_profile_id: null, status: "pending_activation", start_date: day(-2), end_date: null, is_current: true }],
    });
    await runStayFollowups(w.client, NOW);
    w.tables.resident_stays[0].student_profile_id = "sp-adulto";
    await runStayFollowups(w.client, NOW);
    expect(w.tables.stay_followups[0].student_profile_id).toBe("sp-adulto");
  });
});

describe("permisos y respuestas", () => {
  async function sentWorld() {
    const w = world({
      family_links: [{ student_profile_id: "sp-menor", status: "active", family_members: { user_id: "u-guardian" } }],
      resident_stays: [
        { id: "s-a", residence_id: "res-1", student_profile_id: "sp-adulto", status: "active", start_date: day(-5), end_date: null, is_current: true },
        { id: "s-m", residence_id: "res-1", student_profile_id: "sp-menor", status: "active", start_date: day(-5), end_date: null, is_current: true },
      ],
    });
    await runStayFollowups(w.client, NOW);
    const byStay = (id: string) => w.tables.stay_followups.find((f) => f.resident_stay_id === id)!;
    return { ...w, adulto: byStay("s-a"), menor: byStay("s-m") };
  }

  it("la residencia, otro estudiante y el familiar de un ADULTO no tienen acceso", async () => {
    const { client, adulto } = await sentWorld();
    const f = adulto as { student_profile_id: string };
    expect(await resolveFollowupRole(client, "dueno", f)).toBeNull();
    expect(await resolveFollowupRole(client, "con", f)).toBeNull();
    expect(await resolveFollowupRole(client, "u-menor", f)).toBeNull();
    expect(await resolveFollowupRole(client, "u-guardian", f)).toBeNull();
    expect(await resolveFollowupRole(client, "u-adulto", f)).toBe("student");
  });

  it("el guardián de un menor responde por separado y sin ver al estudiante", async () => {
    const { client, tables, menor } = await sentWorld();
    const base = { followupId: menor.id as string, howIsItGoing: "well", wasAsExpected: "yes", comment: "ok" };
    expect(await resolveFollowupRole(client, "u-guardian", menor as { student_profile_id: string })).toBe("guardian");
    expect((await submitFollowupResponse(client, { ...base, userId: "u-menor" })).ok).toBe(true);
    expect(tables.stay_followups.find((f) => f.id === menor.id)!.status).toBe("answered");
    expect((await submitFollowupResponse(client, { ...base, userId: "u-guardian" })).ok).toBe(true);
    expect(tables.stay_followup_responses.map((r) => r.respondent_role).sort()).toEqual(["guardian", "student"]);
    expect((await submitFollowupResponse(client, { ...base, userId: "u-menor" })).ok).toBe(false);
  });

  it("la residencia no puede responder y no se responde fuera de sent/answered", async () => {
    const { client, adulto } = await sentWorld();
    const base = { followupId: adulto.id as string, howIsItGoing: "well", wasAsExpected: "yes", comment: "" };
    expect((await submitFollowupResponse(client, { ...base, userId: "dueno" })).ok).toBe(false);
    await runStayFollowups(client, new Date(NOW.getTime() + 15 * 86_400_000));
    expect((await submitFollowupResponse(client, { ...base, userId: "u-adulto" })).ok).toBe(false);
  });

  it("la auditoría de la respuesta no incluye el contenido", async () => {
    const { client, tables, adulto } = await sentWorld();
    await submitFollowupResponse(client, { followupId: adulto.id as string, userId: "u-adulto", howIsItGoing: "not_well", wasAsExpected: "no", comment: "secreto" });
    expect(JSON.stringify(tables.audit_logs)).not.toContain("secreto");
  });
});

describe("acciones admin", () => {
  const actor = { actorUserId: "adm", actorRole: "admin" as const };

  it("revisar exige respuesta; guarda la nota; no es repetible", async () => {
    const { client, tables, adulto } = await (async () => {
      const w = world();
      await runStayFollowups(w.client, NOW);
      return { ...w, adulto: w.tables.stay_followups[0] };
    })();
    expect((await markFollowupReviewed(client, { ...actor, followupId: adulto.id as string, note: "x" })).ok).toBe(false);
    await submitFollowupResponse(client, { followupId: adulto.id as string, userId: "u-adulto", howIsItGoing: "well", wasAsExpected: "yes", comment: "" });
    expect((await markFollowupReviewed(client, { ...actor, followupId: adulto.id as string, note: "nota" })).ok).toBe(true);
    expect(tables.stay_followups[0]).toMatchObject({ status: "reviewed", admin_note: "nota", reviewed_by_user_id: "adm" });
    expect((await markFollowupReviewed(client, { ...actor, followupId: adulto.id as string, note: "" })).ok).toBe(false);
  });

  it("comunicar crea la notificación con el texto del admin (no la respuesta) para quien gestiona residentes, y audita", async () => {
    const w = world();
    await runStayFollowups(w.client, NOW);
    const f = w.tables.stay_followups[0];
    await submitFollowupResponse(w.client, { followupId: f.id as string, userId: "u-adulto", howIsItGoing: "not_well", wasAsExpected: "no", comment: "me trataron mal" });
    const before = w.tables.notifications.length;
    expect((await communicateFollowupToResidence(w.client, { ...actor, followupId: f.id as string, text: "corto" })).ok).toBe(false);
    const result = await communicateFollowupToResidence(w.client, { ...actor, followupId: f.id as string, text: "Soporte te pide que converses con el residente." });
    expect(result.ok).toBe(true);
    const added = w.tables.notifications.slice(before);
    expect(added.map((n) => n.user_id).sort()).toEqual(["con", "dueno"]);
    expect(JSON.stringify(added)).not.toContain("me trataron mal");
    expect(w.tables.stay_followups[0].communicated_to_residence).toBe(true);
    const log = w.tables.audit_logs.find((a) => a.action === "stay_followup_communicated_to_residence");
    expect(log).toBeTruthy();
    expect(JSON.stringify(log)).not.toContain("converses con el residente");
    expect((log!.new_value as { text_length: number }).text_length).toBe("Soporte te pide que converses con el residente.".length);
  });

  it("doble clic: no reenvía si ya se comunicó, salvo resend explícito", async () => {
    const w = world();
    await runStayFollowups(w.client, NOW);
    const f = w.tables.stay_followups[0];
    await submitFollowupResponse(w.client, { followupId: f.id as string, userId: "u-adulto", howIsItGoing: "well", wasAsExpected: "yes", comment: "" });
    const args = { ...actor, followupId: f.id as string, text: "Mensaje de Soporte para la residencia." };
    expect((await communicateFollowupToResidence(w.client, args)).ok).toBe(true);
    const n = w.tables.notifications.length;
    expect((await communicateFollowupToResidence(w.client, args)).ok).toBe(false);
    expect(w.tables.notifications).toHaveLength(n);
    expect((await communicateFollowupToResidence(w.client, { ...args, resend: true })).ok).toBe(true);
    expect(w.tables.notifications.length).toBeGreaterThan(n);
  });

  it("no se comunica nada si todavía no hay respuesta", async () => {
    const w = world();
    await runStayFollowups(w.client, NOW);
    const r = await communicateFollowupToResidence(w.client, { ...actor, followupId: w.tables.stay_followups[0].id as string, text: "Mensaje de prueba largo" });
    expect(r.ok).toBe(false);
  });
});

describe("migración 0055: la residencia y anon no tienen acceso", () => {
  const sql = readFileSync(join(process.cwd(), "db/migrations/0055_stay_followups.sql"), "utf8");
  it("ninguna policy habilita a la residencia ni a anon", () => {
    const policies = sql.match(/create policy[\s\S]*?;\n/g) ?? [];
    expect(policies.length).toBeGreaterThan(0);
    for (const p of policies) {
      expect(p).toMatch(/to authenticated/);
      expect(p).not.toMatch(/residence_users|anon/);
    }
    expect(sql).toMatch(/revoke all on public\.stay_followups from anon, authenticated/);
    expect(sql).toMatch(/revoke all on public\.stay_followup_responses from anon, authenticated/);
  });
  it("el estudiante no puede leer las columnas internas", () => {
    const grant = sql.match(/grant select \(([^)]*)\)\s+on public\.stay_followups to authenticated/);
    expect(grant).not.toBeNull();
    for (const col of ["admin_note", "reviewed_by_user_id", "reviewed_at", "communicated_to_residence", "residence_reminder_sent_at"]) {
      expect(grant![1]).not.toContain(col);
    }
  });
  it("sin UPDATE ni DELETE para authenticated sobre las respuestas", () => {
    expect(sql).not.toMatch(/grant (update|delete|all)[^;]*stay_followup_responses to authenticated/);
  });
});
