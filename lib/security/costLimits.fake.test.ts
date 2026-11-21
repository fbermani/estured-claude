import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => null }));

import { RESIDENT_INVITE_MAILS_PER_DAY, TEAM_EVENT_MAILS_PER_DAY, residentInviteMailAllowed, teamEventMailAllowed } from "@/lib/security/mailQuota";
import { MAX_PROOF_FILES_PER_APPLICATION, PROOF_UPLOADS_PER_HOUR, proofCountWithinCap, proofUploadAllowed } from "@/lib/security/uploadLimits";

/** Cliente falso: `rpc` devuelve lo que se pida y `from().select().eq()…` devuelve un conteo fijo. */
function fake(rpcAllowed: boolean, count: number | null, countError = false) {
  const rpcCalls: Array<Record<string, unknown>> = [];
  const chain: Record<string, unknown> = {};
  chain.eq = () => chain;
  chain.then = (resolve: (v: unknown) => void) => resolve({ count, error: countError ? { message: "boom" } : null });
  return {
    rpcCalls,
    client: {
      rpc: async (_fn: string, args: Record<string, unknown>) => {
        rpcCalls.push(args);
        return { data: rpcAllowed, error: null };
      },
      from: () => ({ select: () => chain }),
    } as never,
  };
}

describe("cuota diaria de mails por residencia (C5)", () => {
  it("usa un contador por residencia y por día", async () => {
    const { client, rpcCalls } = fake(true, 0);
    expect(await teamEventMailAllowed(client, "res-1")).toBe(true);
    expect(await residentInviteMailAllowed(client, "res-1")).toBe(true);
    expect(rpcCalls[0]).toMatchObject({ p_bucket: "mail_team_event_residence", p_window_seconds: 86_400, p_max: TEAM_EVENT_MAILS_PER_DAY });
    expect(rpcCalls[1]).toMatchObject({ p_bucket: "mail_resident_invite_residence", p_window_seconds: 86_400, p_max: RESIDENT_INVITE_MAILS_PER_DAY });
  });

  it("corta cuando el contador dice que no", async () => {
    const { client } = fake(false, 0);
    expect(await teamEventMailAllowed(client, "res-1")).toBe(false);
    expect(await residentInviteMailAllowed(client, "res-1")).toBe(false);
  });
});

describe("límites de subida de comprobantes (C4)", () => {
  it("limita las cargas por usuario y hora", async () => {
    const ok = fake(true, 0);
    expect(await proofUploadAllowed(ok.client, "user-1")).toBe(true);
    expect(ok.rpcCalls[0]).toMatchObject({ p_bucket: "proof_upload_user", p_window_seconds: 3_600, p_max: PROOF_UPLOADS_PER_HOUR });
    expect(await proofUploadAllowed(fake(false, 0).client, "user-1")).toBe(false);
  });

  it("permite hasta el máximo de comprobantes por solicitud y corta después", async () => {
    expect(await proofCountWithinCap(fake(true, MAX_PROOF_FILES_PER_APPLICATION - 1).client, "app-1")).toBe(true);
    expect(await proofCountWithinCap(fake(true, MAX_PROOF_FILES_PER_APPLICATION).client, "app-1")).toBe(false);
  });

  it("si no se puede contar, deja pasar (queda el tope por hora)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await proofCountWithinCap(fake(true, null, true).client, "app-1")).toBe(true);
  });
});
