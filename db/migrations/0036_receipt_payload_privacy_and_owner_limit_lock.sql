-- EstuRed — Migración 0036: privacidad del payload de comprobantes + cierre de la carrera del tope de 10 residencias
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla en estured-dev Y en producción (Ciclo 47, revisión de seguridad).
--
-- (a) PRIVACIDAD. `receipt_payload` de booking_receipts y renewal_receipts guardaba
--     `estured_fee.payer_billing_cuit`, `estured_fee.payer_iva_condition` y `estured_fee.payer_email`.
--     La policy `booking_receipts_select_related` (migración 0011) le da SELECT de la fila completa a
--     cualquier `residence_users` activo (owner y staff) vía API, así que esos datos del pagador quedaban
--     legibles por la residencia. A partir del Ciclo 47 el código ya NO los escribe (los datos viven en
--     `estured_fee_payments`, con su propia policy) y ninguna pantalla ni el PDF los lee. Esta migración
--     los quita de las filas YA emitidas. Es idempotente (correrla dos veces no cambia nada más).
--     Se aplica también a renewal_receipts porque su payload tenía los mismos tres campos.
--
-- (b) CARRERA DEL TOPE DE 10. `enforce_owner_residence_limit` hace count(*) y después se inserta la fila:
--     dos altas simultáneas del mismo owner con 9 residencias podían pasar las dos. Se agrega un advisory lock
--     transaccional por usuario al inicio del trigger (misma función, resto igual) para serializarlas.
--
-- ROLLBACK:
--   (a) No hay rollback de datos: los campos se borran del jsonb (no se guardaron en otro lado; el CUIT/IVA
--       original sigue en `estured_fee_payments`, el email en `users`). Si hiciera falta recomponerlos, se
--       reconstruyen desde esas tablas.
--   (b) Para revertir el lock, volver a ejecutar `create or replace function` con el cuerpo de la migración
--       0003 (sin la línea `perform pg_advisory_xact_lock(...)`).

-- ==== (a) Scrub del payload de comprobantes ya emitidos ====
update public.booking_receipts
set receipt_payload = receipt_payload
  #- '{estured_fee,payer_billing_cuit}'
  #- '{estured_fee,payer_iva_condition}'
  #- '{estured_fee,payer_email}'
where jsonb_exists_any(receipt_payload -> 'estured_fee', array['payer_billing_cuit', 'payer_iva_condition', 'payer_email']);

update public.renewal_receipts
set receipt_payload = receipt_payload
  #- '{estured_fee,payer_billing_cuit}'
  #- '{estured_fee,payer_iva_condition}'
  #- '{estured_fee,payer_email}'
where jsonb_exists_any(receipt_payload -> 'estured_fee', array['payer_billing_cuit', 'payer_iva_condition', 'payer_email']);

-- ==== (b) Trigger del tope de 10 residencias con lock por usuario ====
create or replace function public.enforce_owner_residence_limit()
returns trigger language plpgsql as $$
begin
  if new.role = 'owner' and new.is_active then
    -- Serializa las altas concurrentes del mismo owner hasta el fin de la transacción.
    perform pg_advisory_xact_lock(hashtext(new.user_id::text));
    if (
      select count(*) from public.residence_users
      where user_id = new.user_id and role = 'owner' and is_active = true
    ) >= 10 then
      raise exception 'Un owner no puede tener más de 10 residencias activas';
    end if;
  end if;
  return new;
end $$;

-- ==== Verificación (descomentar y correr después de aplicar; ambas deben dar 0) ====
-- select count(*) as booking_con_datos_del_pagador from public.booking_receipts
--   where jsonb_exists_any(receipt_payload -> 'estured_fee', array['payer_billing_cuit', 'payer_iva_condition', 'payer_email']);
-- select count(*) as renewal_con_datos_del_pagador from public.renewal_receipts
--   where jsonb_exists_any(receipt_payload -> 'estured_fee', array['payer_billing_cuit', 'payer_iva_condition', 'payer_email']);
-- select pg_get_functiondef('public.enforce_owner_residence_limit'::regproc) like '%pg_advisory_xact_lock%' as lock_aplicado; -- true
