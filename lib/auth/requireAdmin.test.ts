import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionUser = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

const mfaOk = vi.fn(async () => true);
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));
vi.mock("@/lib/auth/adminMfa", () => ({ ADMIN_MFA_PATH: "/admin-mfa", isAdminMfaSatisfied: () => mfaOk() }));
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  getSessionUser: () => getSessionUser(),
}));

import {
  adminActorRole,
  getAdminSession,
  getSuperadminSession,
  requireAdmin,
  requireSuperadmin,
} from "@/lib/auth/requireAdmin";

const user = (roles: string[]) => ({ id: "u1", email: "u@example.com", primaryRole: roles[0], roles });

beforeEach(() => {
  vi.clearAllMocks();
  mfaOk.mockResolvedValue(true);
});

describe("getAdminSession / getSuperadminSession (server actions)", () => {
  it("devuelven null sin sesión o con un rol que no alcanza", async () => {
    getSessionUser.mockResolvedValue(null);
    expect(await getAdminSession()).toBeNull();
    expect(await getSuperadminSession()).toBeNull();
    getSessionUser.mockResolvedValue(user(["student"]));
    expect(await getAdminSession()).toBeNull();
    expect(await getSuperadminSession()).toBeNull();
    getSessionUser.mockResolvedValue(user(["residence_owner"]));
    expect(await getAdminSession()).toBeNull();
  });

  it("admin pasa el guard de admin pero no el de superadmin", async () => {
    getSessionUser.mockResolvedValue(user(["admin"]));
    expect(await getAdminSession()).not.toBeNull();
    expect(await getSuperadminSession()).toBeNull();
  });

  it("superadmin pasa ambos", async () => {
    getSessionUser.mockResolvedValue(user(["superadmin"]));
    expect(await getAdminSession()).not.toBeNull();
    expect(await getSuperadminSession()).not.toBeNull();
    expect(adminActorRole(user(["admin", "superadmin"]) as never)).toBe("superadmin");
    expect(adminActorRole(user(["admin"]) as never)).toBe("admin");
  });
});

describe("requireAdmin / requireSuperadmin (páginas)", () => {
  it("sin sesión redirige al login", async () => {
    getSessionUser.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/login?next=/admin/dashboard");
  });

  it("un estudiante rebota a su home y un admin común no entra a lo de superadmin", async () => {
    getSessionUser.mockResolvedValue(user(["student"]));
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/students/dashboard");
    getSessionUser.mockResolvedValue(user(["admin"]));
    await expect(requireAdmin()).resolves.toBeDefined();
    await expect(requireSuperadmin()).rejects.toThrow("REDIRECT:/admin/dashboard");
  });

  it("superadmin entra a ambos", async () => {
    getSessionUser.mockResolvedValue(user(["superadmin"]));
    await expect(requireSuperadmin()).resolves.toMatchObject({ id: "u1" });
  });
});

describe("DR65 (d): MFA obligatorio para el panel admin", () => {
  it("sin aal2 las acciones no tienen sesión admin y las páginas mandan a /admin-mfa", async () => {
    mfaOk.mockResolvedValue(false);
    getSessionUser.mockResolvedValue(user(["superadmin"]));
    expect(await getAdminSession()).toBeNull();
    expect(await getSuperadminSession()).toBeNull();
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/admin-mfa");
  });

  it("un estudiante sin MFA sigue rebotando a su home (no a /admin-mfa)", async () => {
    mfaOk.mockResolvedValue(false);
    getSessionUser.mockResolvedValue(user(["student"]));
    await expect(requireAdmin()).rejects.toThrow(/REDIRECT:\/students/);
  });
});
