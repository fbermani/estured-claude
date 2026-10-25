import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { assertResidenceAccess, assertResidenceOwner, assertResidencePermission, getResidenceMembership, ACCESS_CHECK_FAILED_MESSAGE } from "@/lib/residences/access";
import {
  defaultPermissions,
  ownerPermissions,
  OWNER_ONLY_MESSAGE,
  PERMISSION_DENIED_MESSAGE,
  RESIDENCE_PERMISSION_KEYS,
  type ResidencePermission,
} from "@/lib/residences/permissions";
import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";

const A = "res-a";
const B = "res-b";

function db(rows: Row[], options = {}) {
  return createInMemorySupabase({ residence_users: rows }, options).client;
}

const rows: Row[] = [
  { residence_id: A, user_id: "owner-a", role: "owner", is_active: true },
  { residence_id: A, user_id: "staff-a", role: "staff", is_active: true, permissions: {} },
  { residence_id: A, user_id: "ex-staff", role: "staff", is_active: false },
  // Dueño de B y staff de A al mismo tiempo: el rol es POR residencia.
  { residence_id: B, user_id: "staff-a", role: "owner", is_active: true },
  { residence_id: A, user_id: "raro", role: "superuser", is_active: true, permissions: {} },
];

describe("getResidenceMembership / assertResidenceOwner (DR10)", () => {
  it("devuelve el rol del vínculo de ESA residencia, no un rol global", async () => {
    const client = db(rows);
    expect(await getResidenceMembership(client, "owner-a", A)).toEqual({ role: "owner", permissions: ownerPermissions() });
    expect(await getResidenceMembership(client, "staff-a", A)).toEqual({ role: "staff", permissions: defaultPermissions() });
    expect(await getResidenceMembership(client, "staff-a", B)).toEqual({ role: "owner", permissions: ownerPermissions() });
  });

  it("sin vínculo activo no hay acceso (otra residencia, inactivo, inexistente)", async () => {
    const client = db(rows);
    expect(await getResidenceMembership(client, "owner-a", B)).toBeNull();
    expect(await getResidenceMembership(client, "ex-staff", A)).toBeNull();
    expect(await getResidenceMembership(client, "nadie", A)).toBeNull();
    expect(await assertResidenceAccess(client, "ex-staff", A)).toBe(false);
    expect(await assertResidenceAccess(client, "staff-a", A)).toBe(true);
  });

  it("un rol desconocido se trata como staff (mínimo privilegio)", async () => {
    expect(await getResidenceMembership(db(rows), "raro", A)).toEqual({ role: "staff", permissions: defaultPermissions() });
    expect(await assertResidenceOwner(db(rows), "raro", A)).toMatchObject({ ok: false, reason: "owner_only" });
  });

  it("assertResidenceOwner: el dueño pasa, el staff recibe el mensaje acordado, el ajeno 'no tenés acceso'", async () => {
    const client = db(rows);
    expect(await assertResidenceOwner(client, "owner-a", A)).toEqual({ ok: true, actorRole: "residence_owner" });
    expect(await assertResidenceOwner(client, "staff-a", A)).toEqual({ ok: false, reason: "owner_only", error: OWNER_ONLY_MESSAGE });
    expect(await assertResidenceOwner(client, "owner-a", B)).toEqual({ ok: false, reason: "no_access", error: "No tenés acceso a esta residencia." });
    // Aislamiento: ser dueño de B no habilita nada en A.
    expect(await assertResidenceOwner(client, "staff-a", B)).toEqual({ ok: true, actorRole: "residence_owner" });
    expect(await assertResidenceOwner(client, "staff-a", A)).toMatchObject({ ok: false, reason: "owner_only" });
  });

  it("falla cerrado ante un error de lectura", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const client = db(rows, { missingTables: ["residence_users"] });
    expect(await getResidenceMembership(client, "owner-a", A)).toBeNull();
    expect(await assertResidenceOwner(client, "owner-a", A)).toMatchObject({ ok: false, reason: "check_failed" });
  });
});

describe("assertResidencePermission (DR11)", () => {
  const withPerms: Row[] = [
    { residence_id: A, user_id: "owner-a", role: "owner", is_active: true, permissions: {} },
    // Staff con permisos elegidos por el dueño: solo preguntas y perfil.
    { residence_id: A, user_id: "staff-a", role: "staff", is_active: true, permissions: { "faq.manage": true, "profile.edit": true, "applications.reject": false } },
    // Staff anterior a DR11, sin permisos guardados: valores iniciales.
    { residence_id: A, user_id: "legacy", role: "staff", is_active: true, permissions: {} },
    { residence_id: A, user_id: "legacy2", role: "staff", is_active: true, permissions: {} },
    // La misma persona con permisos DISTINTOS en otra residencia.
    { residence_id: B, user_id: "staff-a", role: "staff", is_active: true, permissions: { "faq.manage": false, "waitlist.manage": true } },
    { residence_id: A, user_id: "ex-staff", role: "staff", is_active: false, permissions: { "faq.manage": true } },
    { residence_id: A, user_id: "basura", role: "staff", is_active: true, permissions: { "faq.manage": "true", "residents.manage": 1 } },
  ];

  it("el dueño pasa cualquier permiso y recibe actorRole residence_owner", async () => {
    const client = db(withPerms);
    for (const key of RESIDENCE_PERMISSION_KEYS) {
      expect(await assertResidencePermission(client, "owner-a", A, key), key).toMatchObject({ ok: true, actorRole: "residence_owner", permission: key });
    }
  });

  it("el staff pasa solo lo que tiene encendido, con actorRole residence_staff; el resto recibe el mensaje acordado", async () => {
    const client = db(withPerms);
    expect(await assertResidencePermission(client, "staff-a", A, "faq.manage")).toMatchObject({ ok: true, actorRole: "residence_staff" });
    expect(await assertResidencePermission(client, "staff-a", A, "profile.edit")).toMatchObject({ ok: true });
    // Una clave ausente toma el valor inicial (encendido): el staff conserva lo que ya hacía.
    expect(await assertResidencePermission(client, "staff-a", A, "waitlist.manage")).toMatchObject({ ok: true });
    // `applications.reject` está apagado a propósito; `send_adjustment` nunca estuvo guardado y vale el inicial (apagado).
    for (const key of ["applications.reject", "applications.send_adjustment"] as ResidencePermission[]) {
      expect(await assertResidencePermission(client, "staff-a", A, key), key).toEqual({ ok: false, reason: "no_permission", error: PERMISSION_DENIED_MESSAGE });
    }
  });

  it("staff anterior a DR11 (sin permisos guardados): valores iniciales; proponer ajustes y editar el perfil siguen apagados", async () => {
    const client = db(withPerms);
    for (const user of ["legacy", "legacy2"]) {
      for (const key of RESIDENCE_PERMISSION_KEYS) {
        const result = await assertResidencePermission(client, user, A, key);
        expect(result.ok, `${user} ${key}`).toBe(defaultPermissions()[key]);
      }
    }
  });

  it("aislamiento entre residencias: los permisos de A no valen en B, y viceversa", async () => {
    const client = db(withPerms);
    expect((await assertResidencePermission(client, "staff-a", A, "faq.manage")).ok).toBe(true);
    expect((await assertResidencePermission(client, "staff-a", B, "faq.manage")).ok).toBe(false);
    // `profile.edit`: encendido en A, y en B (sin ese permiso guardado) vale el valor inicial: apagado.
    expect((await assertResidencePermission(client, "staff-a", A, "profile.edit")).ok).toBe(true);
    expect((await assertResidencePermission(client, "staff-a", B, "profile.edit")).ok).toBe(false);
    // Sin vínculo en esa residencia: "no tenés acceso", no "no tenés permiso".
    expect(await assertResidencePermission(client, "owner-a", B, "faq.manage")).toEqual({ ok: false, reason: "no_access", error: "No tenés acceso a esta residencia." });
  });

  it("un vínculo inactivo no tiene ningún permiso", async () => {
    expect(await assertResidencePermission(db(withPerms), "ex-staff", A, "faq.manage")).toMatchObject({ ok: false, reason: "no_access" });
  });

  it("valores que no son booleanos quedan apagados (falla cerrado)", async () => {
    const client = db(withPerms);
    expect((await assertResidencePermission(client, "basura", A, "faq.manage")).ok).toBe(false);
    expect((await assertResidencePermission(client, "basura", A, "residents.manage")).ok).toBe(false);
  });

  it("falla cerrado ante un error de lectura", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const client = db(withPerms, { missingTables: ["residence_users"] });
    expect(await assertResidencePermission(client, "owner-a", A, "faq.manage")).toMatchObject({ ok: false, reason: "check_failed" });
  });

  it("assertResidenceOwner sigue siendo solo del dueño aunque el staff tenga todos los permisos delegables", async () => {
    const todos = { ...ownerPermissions() };
    const client = db([{ residence_id: A, user_id: "staff-todo", role: "staff", is_active: true, permissions: todos }]);
    expect(await assertResidenceOwner(client, "staff-todo", A)).toEqual({ ok: false, reason: "owner_only", error: OWNER_ONLY_MESSAGE });
  });
});

describe("error de lectura del vínculo (falla cerrado con un mensaje distinto)", () => {
  it("los guards avisan que no se pudo verificar el acceso, no que no tenés acceso", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = db(rows, { missingTables: ["residence_users"] });
    expect(await getResidenceMembership(client, "owner-a", A)).toBeNull();
    expect(await assertResidencePermission(client, "owner-a", A, "faq.manage")).toEqual({ ok: false, reason: "check_failed", error: ACCESS_CHECK_FAILED_MESSAGE });
    expect(await assertResidenceOwner(client, "owner-a", A)).toEqual({ ok: false, reason: "check_failed", error: ACCESS_CHECK_FAILED_MESSAGE });
    expect(ACCESS_CHECK_FAILED_MESSAGE).toMatch(/No pudimos verificar tu acceso/);
    spy.mockRestore();
  });
});
