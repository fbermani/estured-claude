import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Ciclo 66 (DR5) — la migración 0048 oculta `notes_internal` y `changes_requested_*` a owner/staff vía API (grant por columnas).
 * Usa la anon key + el JWT de Ricardo (owner demo). Corre SOLO con la 0048 aplicada en estured-dev:
 *   MIGRATION_0048_APPLIED=1 npx vitest run lib/residences/verificationNotesRls
 */
const enabled = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.DEMO_USERS_PASSWORD &&
    process.env.MIGRATION_0048_APPLIED === "1",
);

describe.skipIf(!enabled)("RLS de residence_verifications (integración, requiere 0048)", () => {
  it("el owner lee columnas de estado pero no notes_internal ni el mensaje de cambios", async () => {
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { error: authError } = await client.auth.signInWithPassword({ email: "owner.residencia.norte@example.com", password: process.env.DEMO_USERS_PASSWORD! });
    if (authError) throw authError;
    const ok = await client.from("residence_verifications").select("id, status").limit(1);
    expect(ok.error).toBeNull();
    expect((await client.from("residence_verifications").select("notes_internal").limit(1)).error).not.toBeNull();
    expect((await client.from("residence_verifications").select("changes_requested_message").limit(1)).error).not.toBeNull();
    expect((await client.from("residence_verifications").select("*").limit(1)).error).not.toBeNull();
  });
});
