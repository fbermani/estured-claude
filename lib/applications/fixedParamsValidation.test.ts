import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordNegotiationResponse } from "@/lib/applications/recordNegotiationResponse";
import { setBedStatus, setRoomOutOfService } from "@/lib/residences/roomManagement";

/**
 * Los parámetros de valor fijo de las server actions llegan del cliente: el tipo de TypeScript no existe en runtime.
 * Estos tests verifican que un valor inesperado se rechaza ANTES de tocar la base (el cliente falso falla si se usa).
 */
const untouchable = new Proxy({}, {
  get() {
    throw new Error("No debería tocar la base con un parámetro inválido");
  },
}) as unknown as SupabaseClient;

describe("validación runtime de parámetros fijos", () => {
  it("recordNegotiationResponse rechaza una respuesta desconocida (no cae en el else que cancela)", async () => {
    const result = await recordNegotiationResponse(untouchable, {
      applicationId: "a",
      actorUserId: "u",
      response: "cualquier-cosa" as never,
    });
    expect(result.ok).toBe(false);
  });

  it("setBedStatus rechaza un estado desconocido", async () => {
    const result = await setBedStatus(untouchable, {
      actorUserId: "u",
      residenceId: "r",
      bedId: "b",
      status: "roto" as never,
      reason: null,
    });
    expect(result.ok).toBe(false);
  });

  it("setRoomOutOfService rechaza un valor que no es booleano", async () => {
    const result = await setRoomOutOfService(untouchable, {
      actorUserId: "u",
      residenceId: "r",
      roomId: "x",
      outOfService: "true" as never,
      reason: null,
    });
    expect(result.ok).toBe(false);
  });
});
