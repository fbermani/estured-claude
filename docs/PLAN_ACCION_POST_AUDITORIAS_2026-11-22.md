# Plan de acción tras las auditorías — 2026-11-22

Reúne lo que quedó pendiente de: pruebas pre-producción (11-19), Capa Cero (11-20) y costos y abuso (11-21).
Orden: primero lo que bloquea la apertura, después seguridad y performance, al final lo posterior al lanzamiento.
Estado de cada ítem: `[ ]` pendiente, `[x]` hecho. Quién: **[Vos]** panel o cuenta, **[Yo]** código y migraciones.

## A. Antes de abrir al público — bloqueantes
- [ ] **[Vos] Tope de gasto, firewall y alertas.** Pasos en `docs/PLAN_SALIDA_PRODUCCION.md`, «Costos y abuso», ítem C2. Evita facturas por abuso.
- [ ] **[Vos] Migraciones en producción.** Entran solas con `node scripts/build-bootstrap.mjs prod`. Si prod ya existe, pegá cada archivo en su SQL Editor. Incluye 0098 (funciones) y la 0107 de la sección B.
- [ ] **[Vos] «Leaked password protection»** en Supabase Auth, en prod y en dev. Solo en plan Pro. Rechaza contraseñas filtradas en internet.
- [ ] **[Vos] Versión de Next.js.** Mirar `package-lock.json` y el log del build de Vercel que se promueva a producción. Fijar una versión exacta: hoy `package.json` pide `^15.5.29`.
- [ ] **[Vos] Alertas de errores.** Elegir Sentry o las alertas de Vercel (P19-06). Sin esto un problema se nota tarde.
- [x] **[Yo] Páginas de error en español** (2026-11-25): `app/global-error.tsx` creado; `app/error.tsx` ya cubre la preapertura (P19-05).

## B. Seguridad — migración 0107 (aplicada en dev 2026-11-25; falta prod)
- [x] **`profile_availability.last_confirmed_by`:** ya no se lee con la clave pública ni con sesión.
- [x] **14 tablas sin policies:** `authenticated` ya no tiene `select`. Ninguna policy ni vista las referencia.
- [x] **Guard:** columna agregada a `scripts/sensitive-columns.json`; test de exposición 51/51.
- [x] **`residences.created_by`:** descartado. Obliga a regrantar 43 columnas; es un uuid sin PII.
- [x] **`pg_net`:** no se toca. Rompería el cron de vencimientos (0013).
- [ ] **Aplicar 0107 en prod** (entra con el bootstrap; si prod ya existe, pegarla en su SQL Editor).
- [x] **Playwright contra staging (2026-11-25):** 133 pasan. Los 7 de roles estudiante pasan al repetir. Falla el envío de Camila: ya tiene 2 solicitudes activas.
- [x] **Suite completa (2026-11-25):** 3000 pasan, 4 fallan. Los 3 de `renewals` pasan al repetir.
- [ ] **[Yo] Arreglar `lib/support/support.test.ts`** («abre un caso…»). Solo usa service role; causa sin diagnosticar.
- [ ] **[Yo] Liberar una solicitud de Camila en dev** y repetir `e2e/flujo-solicitud.spec.ts`.
- [x] **Privilegios por defecto:** tablas nuevas sin `select` para `anon`; `authenticated` sí lo recibe. Sin cambios.

## C. Performance
- [ ] **[Yo] R19-04: páginas públicas estáticas.** Hoy `/search`, `/for-students` y la ficha se calculan en cada visita porque leen la sesión. Beneficio: respuesta mucho más rápida y menos costo de servidor. Cómo: mover lo personal (filtro por edad, botones, vista del estudiante o familiar) a componentes cliente o en streaming. **Riesgo:** un error puede mostrar datos de un usuario a otro. Hacerlo con tests de «dos usuarios distintos» y probarlo en staging antes de producción.
- [ ] **[Yo] R19-05:** quitar `animate.css` si no se usa. Menos peso en cada página.
- [ ] **[Yo] P19-13:** fijar la región de las funciones en São Paulo (gru1) si el plan lo permite. Menos latencia desde Argentina.
- [ ] **[Yo] Repetir la prueba de carga** con `e2e/load/k6-publica.js` tras R19-04. Meta: 25 usuarios simultáneos con p95 menor a 2 s. Línea base actual en staging: 25 usuarios p95 1,5 s; 50 usuarios degradan a 4 s.
- [x] Caché del catálogo (120 s), de la ficha pública (60 s) y de la imagen de vista previa (300 s). Un cambio tarda hasta ese tiempo en verse.

## D. Después de abrir
- [ ] **CSP en enforce (E-01 de Capa Cero).** Hoy está en `Report-Only` a propósito. Pasarla tras revisar los `[csp-report]` de `estured.com` sin violaciones legítimas. Quitar `unsafe-inline` con nonces o hashes. Probar Turnstile, mapas y la caché de rutas públicas.
- [ ] **Pentest focalizado de Capa Cero (USD 250).** Solo contra staging, con usuarios demo, sin claves de producción. Firmar antes el NDA y la orden de trabajo. Alcance: solicitudes, pagos, comprobantes y Storage con rol estudiante y rol residencia. Detalle en `docs/audits/CAPA_CERO_DIAGNOSTICO_2026-11-20.md`.
- [ ] **Auditoría de código externa (USD 550)** cuando haya usuarios reales. Descartada por ahora: se pisa con la interna.
- [ ] **`gitleaks`** sobre el historial completo de git antes de abrir el repo a más gente.
- [ ] **Repetir pruebas:** `npx playwright test`, k6 y la auditoría de costos, tras cada cambio grande y antes de la campaña.
- [ ] **Limpieza en dev:** aprobar o rechazar el borrado de 2 residencias de test (`node --env-file=.env.local scripts/cleanup-test-residences.mjs --apply`) y de los 5 usuarios `audit-ses-…@estured.test`.

## E. Ya cerrado
Pruebas E2E y de carga, auditoría de RLS, migración 0098, caché de ficha y vista previa, límites persistentes de invitaciones (C3), límite de cargas de comprobantes (C4), cuota diaria de mails por residencia (C5), guía de tope de gasto (C2).
Informes: `docs/audits/PRUEBAS_PRE_PRODUCCION_2026-11-19.md`, `docs/audits/CAPA_CERO_DIAGNOSTICO_2026-11-20.md`, `docs/audits/COSTOS_ABUSO_2026-11-21.md`.
