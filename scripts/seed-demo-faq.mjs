/**
 * Seed aditivo de preguntas libres de la FAQ (D9) para la Residencia Norte demo:
 * una respondida y una pendiente. Idempotente (no duplica por texto de pregunta).
 *
 * Uso: node --env-file=.env.local scripts/seed-demo-faq.mjs
 */
import "./_assert-dev-project.mjs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan env vars. Correr con --env-file=.env.local");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });

const { data: residence } = await admin.from("residences").select("id").eq("slug", "residencia-norte-demo").maybeSingle();
if (!residence) {
  console.error("No existe residencia-norte-demo. Correr antes scripts/seed-demo-data.mjs");
  process.exit(1);
}
const { data: owner } = await admin.from("users").select("id").eq("email", "owner.residencia.norte@example.com").maybeSingle();

const QUESTIONS = [
  {
    question: "¿Se puede cocinar en la habitación o solo en la cocina común?",
    status: "answered",
    answer: "Solo en la cocina común, que está abierta de 7 a 23 hs. Cada habitación tiene un frigobar chico.",
  },
  {
    question: "¿Aceptan estudiantes que lleguen en la segunda semana del mes?",
    status: "pending",
    answer: null,
  },
];

for (const q of QUESTIONS) {
  const { data: existing } = await admin
    .from("residence_faq_questions")
    .select("id")
    .eq("residence_id", residence.id)
    .eq("question", q.question)
    .maybeSingle();
  if (existing) {
    console.log("· ya existe:", q.question.slice(0, 40));
    continue;
  }
  const row = {
    residence_id: residence.id,
    question: q.question,
    status: q.status,
    answer: q.answer,
    ...(q.status === "answered" ? { answered_by_user_id: owner?.id ?? null, answered_at: new Date().toISOString() } : {}),
  };
  const { error } = await admin.from("residence_faq_questions").insert(row);
  if (error) {
    console.error("✗", error.message);
    process.exit(1);
  }
  console.log("✓", q.status, "-", q.question.slice(0, 40));
}
