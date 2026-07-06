# PRODUCT_IMPLEMENTATION_PLAN.md

# EstuRed — Plan de implementación accionable

**Fecha:** 2026-07-05
**Relación con `12_BUILD_PLAN.md`:** el build plan documental sigue siendo la referencia canónica del MVP completo (fases 0–13, con 5bis y 9bis). Este documento lo traduce a ciclos accionables de Claude Code, partiendo del estado real post-ciclo 0. Ante discrepancia de contenido de producto, prevalece `12_BUILD_PLAN.md`.

---

## Estado: ✅ CICLO 0 COMPLETADO — Fundaciones técnicas y visuales

Entregado en este ciclo (detalle en `CLAUDE_CODE_AUDIT.md` §11):

- Proyecto Next.js 15 + TS + Tailwind 4 corriendo, lint/typecheck/build en verde.
- Design tokens y sistema visual EstuRed (paleta petróleo/salvia/arena/ámbar, Manrope + Inter).
- 13 componentes base reutilizables.
- Landing pública (`/`), landings segmentadas (`/for-students`, `/for-residences`).
- Catálogo con filtros (`/search`) y ficha de residencia (`/r/[slug]`) sobre 6 residencias mock del seed oficial.
- Página de lista de espera pre-lanzamiento (`/waitlist`, sin persistencia aún).
- Placeholders de `/students`, `/residence`, `/admin` respetando el routing oficial.

---

## CICLO 1 — Infraestructura de datos, auth y auditoría

*Equivale a `12_BUILD_PLAN.md` Fases 0 (restante) + 1.*

1. `git init`, repo remoto, deploy preview en Vercel.
2. Proyecto Supabase (dev) + variables de entorno por ambiente (`docs/15`).
3. Migraciones de tablas base: `users`, `user_roles`, `student_profiles`, `family_links`, `residences`, `residence_users`, `audit_logs`, `consents`, `files` (`docs/12` §5.1, `docs/06`).
4. Enums de estados oficiales (`docs/04`) como tipos de PostgreSQL.
5. Supabase Auth: registro por rol, login, logout, recuperación; protección de rutas y redirect por rol.
6. RLS + policies por rol, incluyendo aislamiento multi-residencia.
7. Helper `createAuditLog(...)` obligatorio para acciones críticas.
8. **Primer caso de uso real:** persistir el formulario de `/waitlist` (tabla + server action con validación server-side) — convierte la landing en herramienta de adquisición inmediata.
9. Seed inicial desde `docs/17`.

**Criterio de aceptación:** los de `12_BUILD_PLAN.md` Fases 0 y 1.

## CICLO 2 — Residencias reales: onboarding, verificación y perfil público

*Equivale a Fase 2 + parte de Fase 3.*

- Entidades residencia/habitaciones/plazas reales; onboarding de residencia; flujo de verificación admin; tarifas con política de ajuste; reemplazo de `lib/mock/residences.ts` por repositorios Supabase (los componentes de UI no cambian).
- `ExchangeRateProvider` con monedapi.ar + tabla diaria + modal de tipo de cambio obligatorio (`docs/08` §2.8).
- Búsqueda y ficha pública servidas desde DB.

## CICLO 3 — Estudiante, familiar y privacidad

*Equivale a Fase 4.*

- Registro/onboarding estudiante (incluye menores con familiar obligatorio), perfil, documentos, familiar vinculado, consentimientos y configuración de visibilidad/comunidad visible.

## CICLO 4 — Solicitudes y propuestas del familiar

*Equivale a Fases 5 y 5bis.*

- Solicitud de reserva con `snapshot_original`, estados oficiales, pausa de otras solicitudes, botón WhatsApp pre-formateado (sin API), propuestas del familiar con aprobación del estudiante, vencimientos a 48 h vía pg_cron.

## CICLO 5 — Negociación, pago a residencia y reserva

*Equivale a Fase 6.*

- Propuesta de ajuste única por solicitud, comparación lado a lado, `snapshot_final` (hereda tipo de cambio del original), registro del pago a residencia, reserva pendiente de fee.

## CICLO 6 — Fee, facturación fiscal y comprobantes

*Equivale a Fase 7.*

- `PaymentProvider` (MercadoPago + PayU + manual), idempotencia, webhooks, fee sobre `snapshot_final`, revocación del fee, `FiscalInvoiceProvider` (TusFacturas.app, no bloqueante), comprobante PDF + QR + `/verify/[code]` real.

## CICLOS 7+ — Dashboards, operación y beta

*Equivalen a Fases 8–13: dashboards estudiante y residencia (con multi-residencia y freemium 9bis), lista de espera real, renovaciones, comunidad visible, FAQ asistida, admin panel completo, QA (`docs/16`), checklist de beta (`docs/18`).*

---

## Reglas transversales para todos los ciclos

- Fases pequeñas y verificables (`docs/13` §3); Definition of Done de `docs/13` §6.
- Estados oficiales de `docs/04`, permisos de `docs/05`, nunca strings libres.
- Validación server-side siempre; el cliente no muta estados críticos.
- Auditar toda acción crítica desde el Ciclo 1.
- No fusionar propuesta/solicitud/negociación/pago/fee/reserva/factura/comprobante.
- No integrar API de WhatsApp Business bajo ninguna circunstancia.
- Lint + typecheck + build en verde antes de cerrar cada ciclo; actualizar `/MEMORY.md` y `docs/NEXT_STEPS.md` al cierre.
