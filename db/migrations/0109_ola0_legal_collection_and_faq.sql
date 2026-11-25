-- 0109 — Ola 0 de la auditoría legal (2026-11-22). Idempotente. Sin cambios de esquema.
--
-- 1. DR65 (c) (LEG-014): EstuRed ya no aprueba los datos de cobro de la reserva. `approved_at` y `approved_by_user_id` se reusan como
--    «vigente desde» y «guardado por». Lo que el dueño había dejado en `pending_*`
--    pasa a vigente (`details` / `method_label`) y las columnas `pending_*` quedan en null. Las columnas se conservan sin uso
--    (borrarlas exigiría tocar constraints de 0102; no aporta). El código ya escribe directo en `details`.
-- 2. DR65 (a) (LEG-003): la sugerencia de FAQ-11 ya no menciona «certificado de antecedentes» como requisito de ejemplo.

-- ==== 1. Promover datos de cobro pendientes ====
update public.residence_collection_accounts
set
  details = coalesce(nullif(btrim(pending_details), ''), details),
  method_label = case
    when method_key = 'other' then coalesce(nullif(btrim(pending_method_label), ''), method_label)
    else null
  end,
  -- `approved_at` / `approved_by_user_id` ahora significan «vigente desde / guardado por» (la constraint de 0102 exige approved_at
  -- cuando hay datos vigentes). Para lo promovido: quien lo cargó y cuándo.
  approved_at = case when nullif(btrim(pending_details), '') is not null or nullif(btrim(pending_method_label), '') is not null
                     then coalesce(pending_submitted_at, now()) else approved_at end,
  approved_by_user_id = case when nullif(btrim(pending_details), '') is not null or nullif(btrim(pending_method_label), '') is not null
                     then updated_by_user_id else approved_by_user_id end,
  pending_details = null,
  pending_method_label = null,
  pending_submitted_at = null
where pending_details is not null or pending_method_label is not null or pending_submitted_at is not null;

-- Una fila sin datos vigentes después de promover (nunca tuvo nada cargado) no sirve: se borra.
delete from public.residence_collection_accounts
where coalesce(btrim(details), '') = '';

comment on table public.residence_collection_accounts is
  'DR63 + DR65 (c): datos de cobro de la reserva, una fila por medio y residencia. SENSIBLE. Acceso solo via service role (RLS sin policies a propósito). Escribe solo el dueño y rigen al guardar; EstuRed no los aprueba. Las columnas pending_* quedan sin uso.';

-- ==== 2. FAQ-11 sin antecedentes ====
update public.residence_faq_predefined_questions
set suggested_answer = $a$Se pide {documentos_requeridos}. Además: {requisitos_adicionales} (por ejemplo, constancia de alumno regular o datos de contacto de un familiar). Se completan en tu perfil de EstuRed y al ingresar a la residencia.$a$
where id = 'FAQ-11' and suggested_answer like '%certificado de antecedentes%';
