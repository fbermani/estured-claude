# NEXT_STEPS.md

# EstuRed — Próximos pasos

**Fecha:** 2026-07-06 (actualizado tras el Ciclo 2 — calidad visual y UX)

> **Nota (2026-07-08):** este archivo quedó desactualizado como bitácora operativa desde el Ciclo 3 en adelante — `MEMORY.md` es la fuente de verdad viva del estado del proyecto (leer siempre `MEMORY.md` §13/§13bis/§13ter/§13cuater para el historial de ciclos 3-8, y §14 para el plan de continuidad vigente). Este archivo se conserva por su valor histórico del arranque del proyecto (Ciclo 0-2).

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
