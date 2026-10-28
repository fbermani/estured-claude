-- EstuRed — Migración 0062: mes vacío por tramo con parciales (unidades de 0,5) y FAQ-51 (DR18, fase 2, tanda 3 — segunda corrección)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado). NO está aplicada.
--    IDEMPOTENTE; necesita la 0061. Sin tablas, policies ni funciones nuevas: no cambia RLS ni grants.
--
-- QUÉ HACE
--   1. `application_snapshots.empty_months_count` pasa de smallint a numeric(3,1): el mes vacío se mide por tramo y admite medio mes
--      (más de 15 días = 1 mes; 15 días o menos = 0,5). El CHECK de coherencia pasa a: cargo > 0 y unidades entre 0,5 y 3.
--   2. Reescribe la respuesta sugerida de FAQ-51 con la regla nueva (disponibilidad publicada, tramo y parciales).
--
-- REVERTIR: redondear los valores fraccionarios y volver a smallint con el CHECK de la 0061.

begin;

do $$
begin
  -- Exige la 0061 completa: las dos columnas, el CHECK de coherencia y el CHECK de `deposit_only`.
  if (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'application_snapshots'
      and column_name in ('empty_months_count', 'empty_months_charge_usd')
  ) < 2
  or not exists (
    select 1 from pg_constraint where conname = 'application_snapshots_empty_months_coherent'
      and conrelid = 'public.application_snapshots'::regclass
  )
  or not exists (
    select 1 from pg_constraint where conname = 'residences_initial_payment_mode_check'
      and conrelid = 'public.residences'::regclass and pg_get_constraintdef(oid) like '%deposit_only%'
  ) then
    raise exception '0062: falta aplicar la 0061';
  end if;
  -- Cambiar el tipo de la columna falla si una vista la usa: se verifica antes, con un mensaje claro (hoy ninguna la usa).
  if exists (
    select 1 from pg_views where schemaname = 'public' and definition ilike '%empty_months_count%'
  ) then
    raise exception '0062: hay una vista que depende de empty_months_count; recrearla después del cambio de tipo';
  end if;
end
$$;

alter table public.application_snapshots drop constraint if exists application_snapshots_empty_months_coherent;
alter table public.application_snapshots alter column empty_months_count type numeric(3, 1);
alter table public.application_snapshots add constraint application_snapshots_empty_months_coherent check (
  (empty_months_charge_usd is null and empty_months_count is null)
  or (empty_months_charge_usd > 0 and empty_months_count >= 0.5 and empty_months_count <= 3)
);

do $$
begin
  if to_regclass('public.residence_faq_predefined_questions') is not null then
    update public.residence_faq_predefined_questions
    set suggested_answer = $a$Algunas residencias permiten reservar hoy para ingresar más adelante. Si la habitación está disponible desde hoy (o desde una fecha que publica la residencia) y tu ingreso es posterior, el tiempo en que la plaza queda vacía antes de tu ingreso es el «mes vacío», y la residencia cobra una parte de la mensualidad por él (el porcentaje lo define cada residencia). Se mide por tramo: cada mes completo cuenta como uno; si sobran días, más de 15 días cuentan como un mes y 15 días o menos como medio mes. Por ejemplo, con la plaza disponible desde hoy y un ingreso en 1 mes y 3 días, se cuenta 1 mes y medio. Si la plaza está ocupada durante parte de ese período, ese tramo no se cobra, y si ingresás el primer día en que está disponible no hay mes vacío. Hay un máximo de 3 meses. Cuando la residencia todavía no confirmó la disponibilidad, lo ves como «a confirmar por la residencia» antes de enviar la solicitud. Se paga a la residencia, no a EstuRed.$a$
    where id = 'FAQ-51';
  end if;
end
$$;

commit;
