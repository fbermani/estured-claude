import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFakeAdmin, type Call } from "@/lib/push/fakeAdmin";

const dispatch = vi.fn(async () => {});
vi.mock("@/lib/push/dispatch", () => ({ dispatchNotificationPush: (...a: unknown[]) => dispatch(...(a as [])) }));
vi.mock("next/server", () => ({
  after: () => {
    throw new Error("fuera de un request");
  },
}));

import { createNotification } from "@/lib/notifications/createNotification";

const entry = { userId: "u1", title: "t", body: "b" };

beforeEach(() => {
  dispatch.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("createNotification (DR61)", () => {
  it("sin categoría inserta solo in-app y no dispara push", async () => {
    const { admin, calls } = makeFakeAdmin(() => ({}));
    await createNotification(admin, entry);
    expect(calls).toHaveLength(1);
    expect(calls[0].payload).not.toHaveProperty("category");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("con categoría guarda category, espera el envío fuera de un request y pasa el id", async () => {
    const { admin, calls } = makeFakeAdmin(() => ({ data: { id: "n9" } }));
    await createNotification(admin, { ...entry, category: "deadlines" });
    expect(calls[0].payload).toMatchObject({ category: "deadlines" });
    expect(dispatch).toHaveBeenCalledWith(admin, { id: "n9", user_id: "u1", category: "deadlines" });
  });

  it("con la migración 0101 sin aplicar el aviso in-app sale igual, sin push", async () => {
    const { admin, calls } = makeFakeAdmin((c: Call) =>
      c.returning ? { error: { code: "42703", message: "column category does not exist" } } : {},
    );
    await createNotification(admin, { ...entry, category: "deadlines" });
    expect(calls).toHaveLength(2);
    expect(calls[1].payload).not.toHaveProperty("category");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("si el insert falla no lanza ni envía push", async () => {
    const { admin } = makeFakeAdmin(() => ({ error: { code: "23503", message: "fk" } }));
    await expect(createNotification(admin, { ...entry, category: "deadlines" })).resolves.toBeUndefined();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
