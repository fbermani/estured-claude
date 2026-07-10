import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { runExpirationJobs } from "@/lib/jobs/runExpirationJobs";

export const runtime = "nodejs";

/**
 * Endpoint interno invocado por `pg_cron` cada hora (docs/07 §31,
 * migración 0013) vía `pg_net`. Protegido por `CRON_SECRET` — sin este
 * header, cualquiera podría forzar vencimientos masivos de solicitudes
 * y fees ajenos, así que no es un endpoint público como el resto del
 * catálogo.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET no configurado." }, { status: 503 });

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "No disponible en este momento." }, { status: 503 });

  const result = await runExpirationJobs(admin);
  return NextResponse.json({ ok: true, ...result });
}
