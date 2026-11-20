/**
 * Seed aditivo (propuesta A de la ficha, fase 5): deja datos demo para «Compartir tu ficha», las FAQ destacadas y la foto principal.
 * Requiere las migraciones 0095 (mensajes de WhatsApp), 0096 (FAQ destacadas) y 0097 (foto principal) aplicadas en estured-dev; cada
 * parte se salta con un aviso si su migración falta. NO borra ni recrea filas (solo actualiza o inserta): no afecta a otros scripts ni a
 * los UUID de nada. Idempotente.
 *
 *   - Residencias publicadas con FAQ visibles: destaca hasta 6 (primero las del catálogo mostradas, después las libres respondidas)
 *     solo si todavía no tienen destacadas.
 *   - Residencias publicadas con fotos aprobadas: elige como principal la segunda foto (para que se note que es una elección) solo si
 *     todavía no tienen una principal.
 *   - Residencia Norte: guarda un mensaje de WhatsApp propio (para ver «Usando tu mensaje guardado»); el resto usa el original.
 *
 * Uso: node --env-file=.env.local scripts/seed-demo-share-featured.mjs
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
const MAX_FEATURED = 6;

const { data: residences, error } = await admin.from("residences").select("id, slug").eq("status", "verified_active");
if (error) {
  console.error("✗ no se pudieron leer las residencias:", error.message);
  process.exit(1);
}

// ---- FAQ destacadas (0096) ----
const { error: probeFaq } = await admin.from("residence_faq_items").select("is_featured, featured_order").limit(1);
const { error: probeFree } = await admin.from("residence_faq_questions").select("is_featured, featured_order").limit(1);
if (probeFaq || probeFree) {
  console.log("• migración 0096 no aplicada: se omiten las FAQ destacadas");
} else {
  for (const r of residences ?? []) {
    const { data: current } = await admin.from("residence_faq_items").select("id").eq("residence_id", r.id).eq("is_featured", true).limit(1);
    const { data: currentFree } = await admin.from("residence_faq_questions").select("id").eq("residence_id", r.id).eq("is_featured", true).limit(1);
    if ((current?.length ?? 0) > 0 || (currentFree?.length ?? 0) > 0) {
      console.log("• ya tiene destacadas:", r.slug);
      continue;
    }
    // Catálogo mostrado y completo (sin campos {…} pendientes: se compara con la respuesta efectiva, igual que la ficha).
    const { data: items } = await admin
      .from("residence_faq_items")
      .select("id, predefined_question_id, answer_override")
      .eq("residence_id", r.id)
      .eq("is_selected", true);
    const ids = (items ?? []).map((i) => i.predefined_question_id);
    const { data: catalog } = ids.length
      ? await admin.from("residence_faq_predefined_questions").select("id, owner, suggested_answer, display_order").eq("is_active", true).in("id", ids).order("display_order", { ascending: true })
      : { data: [] };
    const byQuestion = new Map((items ?? []).map((i) => [i.predefined_question_id, i]));
    const shown = (catalog ?? []).filter((q) => {
      const override = q.owner === "residence" ? byQuestion.get(q.id)?.answer_override : null;
      return !/[{}]/.test(override?.trim() ? override : q.suggested_answer);
    });
    const { data: free } = await admin
      .from("residence_faq_questions")
      .select("id")
      .eq("residence_id", r.id)
      .eq("status", "answered")
      .order("answered_at", { ascending: false })
      .limit(2);
    const picks = [
      ...shown.slice(0, MAX_FEATURED - Math.min(free?.length ?? 0, 2)).map((q) => ({ table: "residence_faq_items", match: { residence_id: r.id, predefined_question_id: q.id } })),
      ...(free ?? []).map((q) => ({ table: "residence_faq_questions", match: { residence_id: r.id, id: q.id } })),
    ].slice(0, MAX_FEATURED);
    if (picks.length === 0) {
      console.log("• sin FAQ visibles para destacar:", r.slug);
      continue;
    }
    for (const [index, p] of picks.entries()) {
      const { error: upErr } = await admin.from(p.table).update({ is_featured: true, featured_order: index + 1 }).match(p.match);
      if (upErr) {
        console.error("✗ destacar", r.slug, upErr.message);
        process.exit(1);
      }
    }
    console.log("✓ FAQ destacadas:", r.slug, `${picks.length}`);
  }
}

// ---- Foto principal (0097) ----
const { error: probeCover } = await admin.from("residence_photo_meta").select("is_cover").limit(1);
if (probeCover) {
  console.log("• migración 0097 no aplicada: se omite la foto principal");
} else {
  for (const r of residences ?? []) {
    const { data: existing } = await admin.from("residence_photo_meta").select("file_id").eq("residence_id", r.id).eq("is_cover", true).limit(1);
    if ((existing?.length ?? 0) > 0) {
      console.log("• ya tiene foto principal:", r.slug);
      continue;
    }
    const { data: files } = await admin
      .from("files")
      .select("id")
      .eq("related_entity_type", "residences")
      .eq("related_entity_id", r.id)
      .eq("document_type", "residence_photo")
      .eq("status", "approved")
      .order("created_at", { ascending: true });
    if (!files || files.length < 2) {
      console.log("• menos de 2 fotos aprobadas, sin foto principal:", r.slug);
      continue;
    }
    const { error: upErr } = await admin
      .from("residence_photo_meta")
      .upsert({ file_id: files[1].id, residence_id: r.id, is_cover: true }, { onConflict: "file_id" });
    if (upErr) {
      console.error("✗ foto principal", r.slug, upErr.message);
      process.exit(1);
    }
    console.log("✓ foto principal:", r.slug);
  }
}

// ---- Mensaje de WhatsApp guardado (0095) ----
const { error: probeShare } = await admin.from("residence_share_messages").select("residence_id").limit(1);
if (probeShare) {
  console.log("• migración 0095 no aplicada: se omite el mensaje de WhatsApp guardado");
} else {
  const norte = (residences ?? []).find((r) => r.slug === "residencia-norte-demo");
  if (!norte) {
    console.log("• no existe residencia-norte-demo: sin mensaje guardado");
  } else {
    const template = [
      "¡Hola! Gracias por escribirnos a Residencia Norte.",
      "Esta es nuestra ficha en EstuRed, con fotos, precios y las respuestas a lo que más nos preguntan: {LINK}",
      "- Habitaciones desde USD {PRICE_FROM} por mes (referencia ≈ ARS {PRICE_FROM_ARS}, valor referencial)",
      "- {ZONE}, cerca de {UNIVERSITY}",
      "- {STAY_CONDITIONS}",
      "Mirala tranquila y, si te gusta, pedí tu lugar desde ahí: la solicitud queda sujeta a confirmación de la residencia.",
    ].join("\n");
    const { error: upErr } = await admin.from("residence_share_messages").upsert({ residence_id: norte.id, template }, { onConflict: "residence_id" });
    if (upErr) {
      console.error("✗ mensaje de WhatsApp", upErr.message);
      process.exit(1);
    }
    console.log("✓ mensaje de WhatsApp guardado: residencia-norte-demo");
  }
}
console.log("Listo. Mirá /residence/<id>/share, /residence/<id>/faq, el perfil (fotos) y /residencias/residencia-norte-demo.");
