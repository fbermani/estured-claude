# NEXT_STEPS.md

# EstuRed — Próximos pasos

**Fecha:** 2026-07-06 (actualizado tras el Ciclo 2 — calidad visual y UX)

> **Nota (2026-07-08):** este archivo quedó desactualizado como bitácora operativa desde el Ciclo 3 en adelante — `MEMORY.md` es la fuente de verdad viva del estado del proyecto (leer siempre `MEMORY.md` §13/§13bis/§13ter/§13cuater para el historial de ciclos 3-8, y §14 para el plan de continuidad vigente). Este archivo se conserva por su valor histórico del arranque del proyecto (Ciclo 0-2).

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
