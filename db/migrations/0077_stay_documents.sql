-- EstuRed — Migración 0077: documentación de la estadía configurable por residencia (DR38)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run (dev y producción, por separado).
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: NO está aplicada. Es ADITIVA e IDEMPOTENTE.
--    Ejecutala SOLA (sin otras sentencias en la misma consulta): Postgres no deja usar un valor nuevo de un enum en la misma transacción
--    que lo agrega. Esta migración no lo usa, pero conviene no mezclarla.
--    Hasta que se aplique, el código degrada con gracia: solo se piden identidad y certificado de estudios, no se ofrece «Antecedentes
--    penales» ni los documentos «Otro» (la lista que guarde el dueño queda lista para cuando se aplique).
--
-- QUÉ HACE
--   1. Agrega el valor `student_criminal_record` (antecedentes penales) al enum `document_type`.
--   2. Agrega `files.requirement_label` (text, null): nombre del documento «Otro» que pide una residencia al que responde un archivo
--      `other`. Null en el resto de los archivos.
--   La configuración de cada residencia vive en `residence_profile_sections` (`section_type = 'stay_documents'`): no requiere cambios de
--   esquema ni de RLS.

alter type public.document_type add value if not exists 'student_criminal_record';

alter table public.files add column if not exists requirement_label text;
