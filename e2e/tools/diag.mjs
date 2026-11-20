import "../../scripts/_assert-dev-project.mjs";
import { createClient } from "@supabase/supabase-js";
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: r } = await a.from("reservations").select("id,status,created_at,residence_id,application_request_id").gte("created_at", "2026-11-19T00:00:00Z");
console.log("reservas hoy", r?.length, r?.map(x => [x.status, x.created_at]));
const { data: res } = await a.from("residences").select("id,slug,created_at").like("slug", "residencia-test-%");
console.log("residencias test", res?.length, res?.map(x=>x.slug));
const { data: u } = await a.from("users").select("id,email,created_at").gte("created_at","2026-11-19T00:00:00Z");
console.log("usuarios hoy", u?.length, u?.map(x=>x.email));
