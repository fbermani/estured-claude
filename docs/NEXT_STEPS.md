# NEXT_STEPS.md

# EstuRed — Próximos pasos

**Fecha:** 2026-07-06 (actualizado tras el Ciclo 2 — calidad visual y UX)

> **Nota (2026-07-08):** este archivo quedó desactualizado como bitácora operativa desde el Ciclo 3 en adelante — `MEMORY.md` es la fuente de verdad viva del estado del proyecto (leer siempre `MEMORY.md` §13/§13bis/§13ter/§13cuater para el historial de ciclos 3-8, y §14 para el plan de continuidad vigente). Este archivo se conserva por su valor histórico del arranque del proyecto (Ciclo 0-2).

---

## DR18 fase 2, tanda 3: correcciones del dueño (2026-10-28)

- Hecho en código (sin commit, sin build): migración `0061_initial_payment_deposit_only_faq_mes_vacio.sql` (**pendiente de aplicar en dev y prod**: CHECK de `deposit_only`, columnas `empty_months_charge_usd/count` en snapshots, texto de FAQ-51). Pago inicial a elección (primer mes / matrícula / depósito / monto fijo). Mes vacío vuelve al desglose, snapshot y base del fee solo como cargo confirmado (`lib/applications/emptyMonths.ts` + `lib/residences/vacancy.ts`: estadías y reservas reales vs capacidad, solo Premium; sin dato confiable no se cobra y queda «a confirmar por la residencia»).
- Pendiente: aplicar 0061; verificar con screenshots el formulario (copy del mes vacío, radios de pago inicial) y el desglose en sus tres estados (cobrado / a confirmar / no aplica); `agreedConditions` y el comprobante todavía no muestran el mes vacío; build y suite completa sin correr. Decisiones: `docs/00`, «DR18 fase 2, tanda 3: correcciones del dueño».

## DR18 fase 2, tanda 3 (2026-10-28): dinero

- Hecho en código (sin commit, sin build): migración `0060_money_conditions_promotions.sql` (**pendiente de aplicar en dev y prod**), módulo puro `lib/applications/reservationMoney.ts` (descuento de matrícula, depósito en meses, promociones, pago inicial «solo matrícula»; lo usan el snapshot y la previa `CostBreakdown`), tabla `residence_promotions` + `PromotionsManager`/`promotionActions.ts` en el perfil, «antes/ahora» en tarifas de la ficha, mes vacío contingente fuera de la base del fee. Seed: `scripts/seed-demo-money.mjs` (correr tras aplicar la 0060 en dev).
- Pendiente: aplicar 0060; verificar con screenshots el formulario de condiciones, las promociones y el desglose de la solicitud; la tarjeta de `/search` aún muestra la tarifa de lista (sin promoción); renovaciones no aplican promoción; `build` y suite completa sin correr. Decisiones y supuestos: `docs/00`, «DR18 fase 2, tanda 3».

## DR18 fase 2, tanda 2 (2026-10-28): galería y ocupación/capacidad

- Hecho en código (sin commit, sin build): migración `0059_residence_photo_meta.sql` (**pendiente de aplicar en dev y prod**), editor de clasificación de fotos en el perfil (`PhotoMetaManager`, action `photoMetaActions.ts`), tarjeta de `/search` con carrusel (`CardPhotoCarousel`, `useRotation`), hero de la ficha que rota las destacadas y visor agrupado, «N plazas · M residentes» en ficha y tarjeta (`lib/residences/occupancy.ts`). Seed: `scripts/seed-demo-photo-meta.mjs` (correr tras aplicar la 0059 en dev).
- Pendiente: aplicar 0059; verificar a mano carrusel de la tarjeta y hero (hover/foco/reduced-motion) y el editor con screenshots; `typecheck`/`lint` ya en verde, falta `build` y la suite completa. Decisiones y supuestos: `docs/00` §31, «DR18 fase 2, tanda 2».

## Traspaso (2026-10-25)

Sesión cortada por límite de uso; sigue otra sesión/perfil. Estado detallado en `MEMORY.md` («Cierre de sesión 2026-10-25»). Los bloques DR14 de abajo están parcialmente superados: fases 1–3 ya implementadas.

### (a) Hecho y commiteado (sin push)
- `main` está **133 commits adelante de `origin/main`** (verificado con `git rev-list --count origin/main..main`; recontar). Sin push.
- Ciclos 73–74 `f372550`; plan de producción `eb8c551`; copy `ebc579a`, `84a4547` (DR12), `3e4eaf8` (DR13), `b357dd9` (DR15), `2a78e61` (DR16); DR14 docs `163d028`, fase 1 `9adb9c8` (0052), 2a `88d1471` (0053), 2b `60a7333` (0054), 3 `d9d1d91` (0055).
- **Untracked a propósito, NO commitear:** `.claude/agents/`, `.codex/`, `AGENTS.md`, `design-proposals/`.

### (b) Pendiente inmediato (en orden)
1. Auditoría final con los agentes `auditor` y `seguridad` sobre DR14 (0052–0055) y DR15.
2. Suite completa de integración: `npm test` (~5–7 min; el dev server vivo no molesta a vitest, pero **NO correr `npm run build` con el server vivo**) y `node --env-file=.env.local scripts/check-anon-exposure.mjs`.
3. Limpiar residuo: `node --env-file=.env.local scripts/cleanup-test-residences.mjs` (simula) y luego con `--apply`.
4. Probar a mano las pantallas nuevas: reglamento y aceptación, FAQ elegibles, edad mín./máx., seguimiento en `/admin/followups`; y captura de «Por qué EstuRed» en desktop y mobile.
5. Actualizar `docs/PLAN_SALIDA_PRODUCCION.md` si cambia algo y **regenerar el bootstrap prod** (`node scripts/build-bootstrap.mjs prod`) con 0052–0055.

### (c) Pendientes de producto
- Entradas D (14, resueltas en DR12) y L (19, resueltas en DR13) del inventario: **falta la revisión del asesor legal** (textos de arrepentimiento, Soporte, devolución) y la de DR16 «sin garantía propietaria» (cómo se comunica y verifica a las residencias).
- Mes vacío y sin prorrateo (`docs/IDEAS_DEL_DUENO_2026-10-23.md` §1–2).
- Multiple choice del reglamento y archivo PDF; aceptación del guardián en menores (y en propuesta del familiar / lista de espera: hoy quedan con `regulation_acceptance_pending`); vista de la aceptación guardada.
- Botón «Actualizar con mismos parámetros» (docs/06 §27.3); link de la encuesta en «Mi residencia»; pantalla admin del catálogo FAQ (hoy se edita por SQL).

### (d) Producción
- Proyecto Supabase nuevo (necesita cupo disponible); dominio real + `CRON_SECRET` para el bloque cron 0013; Resend/SMTP; redirect URLs de Auth; proveedor de tiles; WAF/rate limits; email de contacto real.
- Crear admin/superadmin con `scripts/create-admin.mjs` (credenciales de prod solo en esa invocación); cargar payment settings en `/admin/payment-settings`; revisión legal de `/terms` y `/privacy`.

### (e) Cómo trabaja el dueño
- Decisiones **de a una**: pregunta + recomendación + botones. Respuestas breves.
- Por cada migración: links al SQL Editor dev (https://supabase.com/dashboard/project/gyfbtsuibmecefwovdgh/sql/new) y prod, más el archivo a pegar. Dev ya tiene hasta 0055; prod se arma con el bootstrap.
- Flujo: docs → agente → revisor/seguridad → fixes → `typecheck` + `lint` + `build` (server parado, `rm -rf .next`) → commit sin push.
- Elegir modelo/esfuerzo por tarea (sonnet medium/low por defecto).
- Co-autoría: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Agentes en `.claude/agents`: constructor, revisor, seguridad, depurador, tester, interfaz, base-datos, documentador, auditor, disenador.

---

## DR14 (2026-10-25) — decidida por el dueño y reflejada en docs; pendiente de implementar

Detalle en `docs/IDEAS_DEL_DUENO_2026-10-23.md` §5–§7. Protocolo `docs/13` §5 (doc primero): DR14 **ya registrada en `docs/00` §31 y reflejada en `docs/04` §12ter, `05` §16bis, `06` (§4.23–4.24, §8.1, §8.7, §11.5, §15.3, §17, §27.12) y `08` (§4.4, §4.5, §6.17, §7.16, §8.18)**. Fase 1 (edad) hecha (0052). **Fase 2a (reglamento + aceptación) implementada, migración 0053 sin aplicar** (ver `MEMORY.md` «DR14 fase 2a»; acción del dueño: aplicarla en dev y prod y correr `scripts/seed-demo-regulation.mjs`). Falta: FAQ de catálogo, apartado de menores, seguimiento a los 5 días, multiple choice y aceptación en propuestas del familiar / lista de espera.

- **Reglamento:** aceptación obligatoria al enviar la solicitud, con versión/hash y fecha; reglamento propio o modelo (`docs/propuestas/REGLAMENTO_MODELO_Y_FAQ.md`).
- **FAQ:** lista única; cada residencia elige cuáles mostrar y edita la respuesta.
- **Edad mínima/máxima** de la residencia como filtro de búsqueda (mínima 18; menores solo si se habilita; edad a la fecha de ingreso).
- **Seguimiento a los 5 días del ingreso:** recordatorio a la residencia + encuesta al estudiante que la residencia no ve; el admin decide qué comunicar.

---

## CICLO 74 (2026-10-24) — Permisos del staff elegidos por el dueño (DR11)

Ver `MEMORY.md` Ciclo 74 y `docs/00` §31 (DR11, con la tabla acción → permiso). Reemplaza el "un solo nivel de staff" de DR10: el dueño elige, staff por staff, 10 permisos (`residence_users.permissions`, sin migración), con atajos, desde `/residence/[id]/team`; al invitar elige los permisos iniciales. El servidor valida cada acción con `assertResidencePermission`; el staff ve deshabilitado (con nota) lo que no puede y un resumen «Tus permisos» en el Panel. ⚠ **Migración 0051 (sin aplicar, editada):** ahora agrega la columna `permissions` a `residence_team_invitations` (más lo del Ciclo 73: `invited_by` nullable). **Acción manual del dueño:** aplicarla en dev y en producción (SQL Editor → pegar y Run), orden 0046, 0045, 0047, 0048, 0049, 0050, 0051; si una versión vieja de la 0051 ya estaba aplicada, volver a correr esta (es idempotente). Después en dev: `node --env-file=.env.local scripts/seed-demo-team.mjs [--staff-permissions]` y probar guardar permisos con Ricardo y ver a Sofía con permisos apagados. Pendiente: verificar guardar/invitar/aceptar con la 0051 aplicada y los estados deshabilitados de Habitaciones, Residentes, Renovaciones, Lista de espera y Preguntas en pantalla.

**Revisión/seguridad del Ciclo 73 aplicada (ver `MEMORY.md` "Ciclo 73 — revisión y seguridad"):** auditoría con el rol real, IDOR de renovaciones, límites de invitación, revalidación al aceptar, email que informa si falló, PDF 403/404. **Decisiones pendientes del dueño:** ofertas de renovación del staff, mayoría de edad de la cuenta de staff, WAF/limitador de `/register/staff/*` y `/login`, remitente de email.

---

## CICLO 73 (2026-10-24) — Equipo de la residencia: dueño y staff (DR10)

Ver `MEMORY.md` Ciclo 73 y `docs/00` §31 (DR10, con la tabla de acciones dueño/staff). Dos niveles por residencia (`residence_users.role`), autorización central (`lib/residences/access.ts` + `permissions.ts`), perfil en solo lectura para el staff, propuesta de ajuste y PDF solo del dueño, pantalla `/residence/[id]/team` (invitar por email con token hasheado de 7 días, reenviar, cancelar, quitar acceso) y aceptación en `/register/staff/[token]`. ⚠ **Acción manual del dueño:** aplicar `db/migrations/0051_residence_team_invitations.sql` en dev y en producción (SQL Editor → pegar y Run), en orden **0046, 0045, 0047, 0048, 0049, 0050, 0051** (la 0051 no depende de las otras). Hasta entonces Equipo muestra miembros y permite quitar acceso, pero no invitar (se avisa). Luego en dev: `node --env-file=.env.local scripts/seed-demo-team.mjs` y probar con Ricardo (invitar/reenviar/cancelar) y la aceptación con el enlace que imprime el seed. Pendiente: verificar de punta a punta con la 0051 aplicada, unificar `actor_role` en la auditoría del día a día (hoy dice `residence_owner` aunque actúe un staff), presets finos (evolución futura), dominio propio de email.

---

## CICLO 72 (2026-10-24) — Trazabilidad y permisos del admin (DR9)

Ver `MEMORY.md` Ciclo 72 y `docs/00` §31 (DR9). Log legible (actor, entidad, frases, filtros), permisos de bloqueo (solo `superadmin` bloquea admins), lista de usuarios con filtros y paginación, jerga fuera del menú. Sin migraciones. Pendiente: verificar como Superadmin, contador de Revocaciones en el sidebar (no hay patrón de contadores), gestión de roles de admins, reorganizar el menú (decisión de producto).

---

## CICLO 71 (2026-10-24) — "Marcar pagado y confirmar reserva" endurecido (DR8)

Ver `MEMORY.md` Ciclo 71 y `docs/00` §31 (DR8). El admin solo marca pagado con comprobante cargado o con el override "Confirmar sin comprobante" (motivo ≥ 10 + segunda confirmación), carga el monto realmente recibido (tolerancia 1 %), confirma con "Verifiqué el pago" y no puede hacerlo con el plazo vencido; update condicional contra la doble confirmación. ⚠ **Acción manual del dueño:** aplicar `db/migrations/0050_fee_payment_received_amount.sql` en dev y en producción (SQL Editor), en orden **0046, 0045, 0047, 0048, 0049, 0050** (aborta si falta la 0047). Hasta entonces todo funciona y el monto recibido/override quedan solo en el audit log. Luego en dev: sembrar un fee `pending_manual_payment` con comprobante cargado y probar el éxito de punta a punta (reserva confirmada, comprobante, factura) y el estado vencido + reapertura desde Actividad → Reservas.

**Revisión/seguridad aplicada (ver `MEMORY.md` Ciclo 71 cont.):** checkbox "Acepto la diferencia" + piso 90 % (solo `superadmin`), fee `paid` con reserva sin confirmar → aviso + "Reintentar confirmación" en Cobrados (confirmación idempotente), UPDATE atado al estado y comprobante leídos, montos ambiguos rechazados, la 0050 ahora también revoca la lectura de `provider_payment_id`. **Falta verlo en navegador** (checkbox/piso, aviso y botón de reintento). **Decisión pendiente del dueño:** comprobante y Factura C salen por el fee esperado completo, no por el monto recibido.

Pendiente: mismas reglas para la validación manual del fee de **renovaciones**; "Rechazar pago manual"; mostrar el monto recibido y el override en "Cobrados"; aviso al pagador al validar.

---

## CICLO 70 (2026-10-24) — Ciclo de vida de la verificación (DR7)

Ver `MEMORY.md` Ciclo 70 y `docs/00` §31 (DR7). Sin migraciones. Pendiente: avisos de 60/7 días y del día del vencimiento (`docs/09` §7.5), aviso al programar visita, alinear el copy del job `expireResidenceVerifications` con el reenvío del dueño, y probar aprobar/rechazar de punta a punta con una residencia descartable.

---

## CICLO 68 (2026-10-24) — "Resolver revocación" (DR6)

Ver `MEMORY.md` Ciclo 68 y `docs/00` §31 (DR6). El admin reintegra el fee completo o deniega la revocación, siempre con motivo; el reintegro real es manual, por fuera de la plataforma. ⚠ **Acción manual del dueño:** aplicar `db/migrations/0049_revocation_resolution.sql` en dev y en producción (SQL Editor), en orden **0046, 0045, 0047, 0048, 0049** (la 0047 antes que la 0049). Luego en dev: `node --env-file=.env.local scripts/seed-revocation-states.mjs` y `MIGRATION_0049_APPLIED=1 npx vitest run lib/revocations/resolveFeeRevocationIntegration`, y probar en `/admin/activity?tab=revocations` (Admin operativo) la resolución de la revocación de Camila (restaurar o resembrar después).

**Ciclo 69:** el familiar pagador solo revoca si la estudiante es menor (DR6 (i), `MEMORY.md` Ciclo 69); falta verlo en navegador. Ronda de revisión/seguridad aplicada (ver `MEMORY.md` Ciclo 68): la 0049 ahora aborta si la 0047 no está aplicada (aplicar siempre en orden), Soporte no permite cerrar a mano casos `fee_revocation`, revocar como familiar exige vínculo activo y avisa al estudiante, y fees en USD exigen reconocimiento. **Decisiones pendientes:** plazo 240 h vs. día calendario, denegar con causa justificada, visibilidad del fee para la residencia, `refund_currency`.

**Textos legales para el asesor** (borrador, en `lib/revocations/copy.ts` bajo `LEGAL_REVIEW_PENDING`): `/terms` §17; pantalla `/students/revocation`; nota y checkbox de la pantalla del fee y de renovaciones; avisos de resolución; helper "Reserva revocada por vos"; `docs/10` §15.1/§15.4; condiciones para denegar y plazo de resolución.

Pendiente: decisión del dueño sobre el familiar pagador que puede revocar la reserva de una estudiante mayor (`GAPS.md`, para `seguridad`); aviso in-app a admins y a la residencia al revocar (no hay notificador genérico a admins); nota de crédito de la Factura C.

---

## CICLO 67 (2026-10-24) — Estudiante y familiar: plata y plazo

Ver `MEMORY.md` Ciclo 67. Sin migraciones. Pendiente: verificar en navegador el CTA del familiar pagador; decisión legal/de producto sobre reintegros (hoy el copy es neutro: "escribinos a Soporte"); aviso in-app al estudiante en hitos del fee.

---

## CICLO 66 (2026-10-24) — Reenvío a revisión tras "pedir cambios" (DR5)

Ver `MEMORY.md` Ciclo 66. ⚠ **Acción manual:** aplicar `db/migrations/0048_verification_changes_message.sql` en dev y producción (SQL Editor), en orden 0046, 0045, 0047, 0048. Luego `node --env-file=.env.local scripts/seed-needs-changes-demo.mjs` en dev para verificar el flujo completo y correr `MIGRATION_0048_APPLIED=1 npx vitest run lib/residences/verificationNotesRls`.

---

## CICLO 65 (2026-10-24) — Residencias, Bloque 3 (onboarding de residencias nuevas)

Ver `MEMORY.md` Ciclo 65. Sin migraciones. Lo pendiente sobre pedir cambios se resolvió en el Ciclo 66 (rechazo sigue por Soporte).

---

## CICLO 64 (2026-10-24) — Residencias, Bloque 2 (consistencia y copy)

Ver `MEMORY.md` Ciclo 64. Sin migraciones. Pendiente: verificación visual en navegador y revisar copy de plan/Gestión Operativa en `for-residences` y en el aviso de `setOperationalAccessByAdmin` (D8).

---

## CICLO 63 (2026-10-24) — Residencias, Bloque 1

Ver `MEMORY.md` Ciclo 63. Sin migraciones ni acciones manuales. Pendiente: aviso "por vencer 24 h" a la residencia (toca el cron), aviso al promover solicitudes de la cola, y verificación visual (Ricardo, owner de Residencia Norte).

---

## CICLO 62 (2026-10-24) — DR4: desglose de costos y "Proponer a [nombre]" en la ficha

Ver `MEMORY.md` Ciclo 62. Sin migraciones nuevas ni acciones manuales; siguen pendientes de aplicar la **0046 (urgente) y la 0045** del Ciclo 61. Siguiente: consentimiento `family_contact_disclosure` en las propuestas, decidir "subir comprobantes a la residencia" por el familiar y avisos in-app al estudiante.

---

## CICLO 61 (2026-10-23) — Experiencia del familiar vinculado (DR4)

Ver `MEMORY.md` Ciclo 61. ⚠ **Acción manual del dueño: aplicar PRIMERO `db/migrations/0046_family_link_active_only.sql` (urgente: cierra una fuga de datos) y después `db/migrations/0045_family_billing_profile.sql`, cada una en estured-dev y en producción (SQL Editor → pegar y Run; no hay supabase CLI).** Es aditiva e idempotente. Después, en dev: `npx vitest run lib/family` y, opcional, `node --env-file=.env.local scripts/seed-demo-family-payer.mjs` (ya corrido). Siguiente: desglose de costos y CTA "Proponer a [nombre]" en la ficha; decidir si el estudiante también recibe avisos in-app en los hitos; decidir "subir comprobantes a la residencia" por el familiar.

---

## CICLO 59 (2026-10-23) — "Quiero cambiar": datos y servidor (DR3/DR3b)

Ver `MEMORY.md` Ciclo 59. ⚠ **Acción manual del dueño: aplicar `db/migrations/0044_stay_change_intents.sql` en estured-dev y después en producción (SQL Editor → pegar y Run; trae queries de verificación al final; opción Terminal: no hay supabase CLI, usar el SQL Editor).** Después, en dev: `npx vitest run lib/stayChange` y `node --env-file=.env.local scripts/seed-demo-stay-change.mjs`. Siguiente: `interfaz` construye Mi residencia, la hoja "Responder", Residentes, la ficha y las landings sobre `lib/stayChange/*`; `seguridad` revisa RLS y acciones.

---

## CICLO 48bis (2026-10-21) — Documentación: decisiones D1–D11 (docs primero)

Ver `MEMORY.md` Ciclo 48bis. Sin acciones manuales sobre la base. Los docs de producto (`docs/00` §31, `02`, `04`, `06`, `08`, `10`) ya reflejan las decisiones del dueño; sigue la Fase 2 de `docs/audits/PLAN_ACCION_2026-10-20.md`. Pregunta abierta para el dueño: ¿la habilitación del pago a la residencia es automática al establecer contacto (como dice la fila de `docs/04` §5.4) o sigue siendo un botón de la residencia (como hace el código)?

---

## CICLO 47 (2026-10-21) — Auditoría Fase 1, ronda 2: H07 + H14 + H20 + H22

Ver `MEMORY.md` Ciclo 47. ⚠ **Acción manual del dueño: aplicar `db/migrations/0036_receipt_payload_privacy_and_owner_limit_lock.sql` en estured-dev y en producción (SQL Editor → pegar y Run; trae queries de verificación comentadas).** Para ver las notificaciones demo en dev: `node --env-file=.env.local scripts/seed-demo-notifications.mjs` (idempotente).

---

## CICLO 45 (2026-10-21) — Auditoría Fase 1: H01 + H05

Ver `MEMORY.md` Ciclo 45. Sin acciones manuales sobre producción (no hay migraciones). En la base **dev**: correr `node --env-file=.env.local scripts/seed-expired-fee-reservation.mjs` después de `seed-demo-data.mjs` (aditivo, idempotente). Pendiente: limpiar el residuo de tests en dev que deja a Lucía con 2 reservas confirmadas (hallazgo lateral 1 de MEMORY.md).

---

## CICLO 43 (2026-10-20) — Renovación extiende "Contrato hasta"

Ver `MEMORY.md` Ciclo 43. La migración 0035 ahora tiene 2 pasos (vínculo + extensión del contrato por renovaciones ya confirmadas): sigue siendo **una sola** acción manual, pegarla entera en el SQL Editor y correr las dos queries de verificación comentadas al final. Pendiente del dueño: actualizar docs/06 §14.2/§15.1 (`end_date` → `expected_end_date`).

---

## CICLO 42 (2026-07-24) — Vínculo estadía ↔ reserva

Ver `MEMORY.md` Ciclo 42. **Acción manual pendiente del dueño**: pegar `db/migrations/0035_backfill_resident_stays_reservation.sql` en el SQL Editor de Supabase (solo datos, idempotente) y correr el `select` de verificación comentado al final. Sin esa migración, las estadías ya existentes quedan sin vincular (el código nuevo solo cubre altas/activaciones nuevas) y en el panel de Residentes verán el aviso "sin reserva vinculada".

---

## CICLO 2 (2026-07-06) — Qué se hizo

Pase de calidad visual/UX guiado por las referencias Stitch de `/design-references` (detalle completo en `VISUAL_UX_AUDIT.md`):

- **Landing rediseñada:** H1 híbrido en dos tonos ("No solo elijas dónde vivir, sino cómo."), hero con composición de producto (card real + chips flotantes), badge de etapa, sección comparativa "Con EstuRed vs. por fuera", 4 pasos del proceso, sección "Lo que se viene" (futuro etiquetado), frase de marca como cierre.
- **ResidenceCard enriquecida:** universidades cercanas, resumen de servicios, StatusTag sobre imagen, precio con jerarquía clara, hover sutil.
- **Componentes:** Navbar con labels claros + Ingresar, Button con estados pressed/sombras y secondary ámbar, TrustBadge legible sobre fotos, StatusTag `elevated`, Footer con firma humana.
- **Decisiones de comunicación confirmadas por el dueño:** H1 híbrido; marca "EstuRed"; eje universidad en copy/cards; sección de visión futura incluida.
- **Verificado en 1280px y 375px.** Validación: typecheck ✅ lint ✅ build ✅.

**Pendientes visuales:** fotos curadas, logo real, modal de tipo de cambio (con provider real). Los 10 próximos pasos de infraestructura del Ciclo 1 siguen vigentes abajo.

---

# Histórico — Ciclo Fundacional 0 (2026-07-05)

## 1. Qué se implementó

Base técnica completa y navegable (detalle en `CLAUDE_CODE_AUDIT.md` §11): Next.js 15 + TS + Tailwind 4; design tokens de marca; 13 componentes reutilizables; landing + landings segmentadas + catálogo con filtros + ficha de residencia + lista de espera; placeholders de dashboards; 6 residencias mock del seed oficial; validación en verde (typecheck, lint, build de 18 páginas, verificación visual en navegador).

## 2. Decisiones tomadas en este ciclo

1. **Re-secuenciación aprobada por prompt:** fundaciones visuales antes que Supabase/auth (contradice el orden de `12`/`22`; documentado y mitigado — ver `CLAUDE_CODE_AUDIT.md` §6.1).
2. **Identidad visual fundacional:** paleta petróleo `#0F5C7A` / salvia `#7CB89C` / arena `#F4F1EB` / ámbar `#F5B041`, Manrope (display) + Inter (texto). Los docs no definían identidad; esta es la primera definición.
3. **Routing según docs, no según prompt:** una sola landing `/for-students` para estudiantes y familias; catálogo en `/search`; sin dashboard familiar separado.
4. **`/waitlist` agregada** como ruta pre-lanzamiento fuera del routing oficial (retirar o redirigir cuando el producto opere).
5. **Docs estratégicos movidos a `/docs`** (recomendación de `22` §6).
6. **Mocks tipados** (`types/domain.ts`) con estados oficiales de `docs/04` para que el reemplazo por Supabase no toque componentes.

## 3. Qué quedó pendiente

- Repo git y remoto (no inicializado — decisión del dueño sobre hosting).
- Supabase completo: DB, auth, RLS, auditoría (Ciclo 1).
- Persistencia del formulario de lista de espera (hoy es UI sin backend, declarado en la propia UI).
- Deploy a Vercel.
- Modal de tipo de cambio obligatorio (requiere `ExchangeRateProvider` real).
- Fotos reales (hoy picsum.photos).
- Testing framework (definir al aparecer la primera lógica server-side).

## 4. Riesgos detectados

Ver `CLAUDE_CODE_AUDIT.md` §6. Los principales: código sin versionar; pendientes legales (`00` §29) bloqueantes para operar (no para desarrollar); tipo de cambio mock debe reemplazarse antes de cualquier demo con residencias reales.

## 5. Próximos 10 pasos recomendados (en orden)

1. `git init` + commit fundacional + repo remoto privado.
2. Deploy preview en Vercel con los mocks (validar mensaje con gente real).
3. Crear proyecto Supabase (dev) + variables de entorno según `docs/15`.
4. Persistir el formulario de `/waitlist` (primera server action + primera tabla + validación server-side). Empezar a captar interesados reales.
5. Migraciones de tablas base de `docs/12` Fase 1 + enums de estados de `docs/04`.
6. Supabase Auth: registro por rol, login, protección de rutas, redirect por rol.
7. RLS + policies por rol (incluyendo aislamiento multi-residencia).
8. Helper `createAuditLog` + auditoría de las primeras acciones críticas.
9. Seed real desde `docs/17` reemplazando `lib/mock/residences.ts` por repositorios.
10. QA de Fase 1 según `docs/16` + actualizar `MEMORY.md` y este archivo.

## 6. Qué pedir en el próximo prompt

> Ejecutá el Ciclo 1 del plan de `docs/PRODUCT_IMPLEMENTATION_PLAN.md`: git + Supabase + migraciones base + auth + RLS + audit log + persistencia del formulario de lista de espera. Leé antes `/MEMORY.md`, `docs/12_BUILD_PLAN.md` (Fases 0-1), `docs/06_DATA_MODEL.md`, `docs/05_ROLES_AND_PERMISSIONS.md` y `docs/15_ENVIRONMENT_AND_SETUP.md`.

(Requiere que el usuario tenga o cree una cuenta de Supabase y provea las credenciales del proyecto.)

## 7. Preguntas críticas abiertas

Ninguna bloqueante para el Ciclo 1. Decisión logística necesaria: **dónde hostear el repo** y **credenciales de Supabase** para el próximo ciclo. Las decisiones de negocio abiertas viven en `docs/00` §29.
