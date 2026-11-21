import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }), usePathname: () => "/" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mocks = vi.hoisted(() => ({
  session: null as null | { id: string },
  approve: vi.fn(async () => ({ ok: true as const, methodKey: "transfer_ars", method: "Transferencia en pesos" })),
  reject: vi.fn(async () => ({ ok: true as const, methodKey: "transfer_ars", method: "Transferencia en pesos" })),
}));
vi.mock("@/lib/auth/requireAdmin", () => ({ getAdminSession: async () => mocks.session }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("@/lib/residences/collectionApproval", () => ({ approveCollectionAccount: mocks.approve, rejectCollectionAccount: mocks.reject }));

import type { PendingCollectionMethod } from "@/lib/residences/collectionApprovalDb";
import { reviewCollectionAccount } from "@/app/admin/collection-approvals/actions";
import { CollectionApprovalDetail } from "@/app/admin/collection-approvals/CollectionApprovalDetail";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const base = { residence_id: "res-1", method_key: "transfer_ars", expected_submitted_at: "2026-11-21T10:00:00.123456+00:00" };

describe("acción reviewCollectionAccount (admin)", () => {
  beforeEach(() => {
    mocks.session = { id: "admin-1" };
    mocks.approve.mockClear();
    mocks.reject.mockClear();
  });

  it("sin sesión de admin (o con otro rol) no llama a nada", async () => {
    mocks.session = null;
    expect(await reviewCollectionAccount({ status: "idle" }, form({ ...base, intent: "approve" }))).toEqual({ status: "error", message: "No tenés permiso para esta acción." });
    expect(mocks.approve).not.toHaveBeenCalled();
    expect(mocks.reject).not.toHaveBeenCalled();
  });

  it("una acción inválida se rechaza", async () => {
    expect((await reviewCollectionAccount({ status: "idle" }, form({ ...base, intent: "borrar" }))).status).toBe("error");
    expect(mocks.approve).not.toHaveBeenCalled();
  });

  it("aprobar pasa el valor de pending_submitted_at tal cual lo vio el admin, y el actor sale de la sesión", async () => {
    const res = await reviewCollectionAccount({ status: "idle" }, form({ ...base, intent: "approve", actor_user_id: "otro" }));
    expect(res.status).toBe("saved");
    expect(mocks.approve).toHaveBeenCalledWith({}, { actorUserId: "admin-1", residenceId: "res-1", methodKey: "transfer_ars", expectedSubmittedAt: base.expected_submitted_at });
  });

  it("rechazar pasa el motivo; el error del servidor llega al admin", async () => {
    mocks.reject.mockResolvedValueOnce({ ok: false, error: "Escribí el motivo del rechazo." } as never);
    const res = await reviewCollectionAccount({ status: "idle" }, form({ ...base, intent: "reject", reason: "corto" }));
    expect(res).toEqual({ status: "error", message: "Escribí el motivo del rechazo." });
    expect(mocks.reject).toHaveBeenCalledWith({}, expect.objectContaining({ reason: "corto" }));
  });
});

describe("detalle de la cola de aprobación (render)", () => {
  const method: PendingCollectionMethod = {
    methodKey: "transfer_ars",
    name: "Transferencia en pesos",
    proposedDetails: "CBU 0140999999999999999999 alias casa.nueva",
    proposedLabel: null,
    currentDetails: "CBU 0170099220000067797370 alias casa.norte",
    currentLabel: null,
    submittedAt: "2026-11-21T10:00:00.123456+00:00",
    isFirstLoad: false,
  };
  const render = (methods = [method]) => renderToStaticMarkup(createElement(CollectionApprovalDetail, { residence: { id: "res-1", name: "Residencia Norte", publicArea: "Palermo" }, methods }));

  it("muestra lo vigente y lo propuesto lado a lado, con los datos completos para el admin", () => {
    const html = render();
    expect(html).toContain("Vigente (aprobado)");
    expect(html).toContain("Propuesto");
    expect(html).toContain("0170099220000067797370");
    expect(html).toContain("0140999999999999999999");
    expect(html).toContain("Cambio");
  });

  it("la primera carga lo dice y no inventa datos vigentes", () => {
    const html = render([{ ...method, currentDetails: null, isFirstLoad: true }]);
    expect(html).toContain("Primera carga");
    expect(html).toContain("Todavía no hay datos aprobados.");
  });

  it("los botones llevan name/value nativos y el formulario devuelve lo que el admin vio", () => {
    const html = render();
    expect(html).toContain('name="intent"');
    expect(html).toContain('value="approve"');
    expect(html).toContain('value="reject"');
    expect(html).toContain('name="expected_submitted_at"');
    expect(html).toContain('value="2026-11-21T10:00:00.123456+00:00"');
  });

  it("sin medios pendientes avisa que ya no hay nada por revisar", () => {
    expect(render([])).toContain("ya no tiene datos de cobro por revisar");
  });
});
