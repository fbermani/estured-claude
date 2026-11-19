# Pruebas pre-producción — 2026-11-19

**Resultado general: LISTO CON PENDIENTES.** Sin críticos ni altos. Todo se probó contra staging (`estured.vercel.app`, que usa `estured-dev`); producción no se tocó. Código probado: commit `3c4cd2f` (el desplegado; el HEAD local solo suma docs).

## Flujos (ok / falla)
- Visitante: 10 páginas públicas, 404, robots/sitemap/llms, cabeceras, redirect a login en las 3 áreas, buscador → ficha — **ok** (26/26).
- Camila, Lucía, Valentina (menor), Martín (familiar), Ricardo (dueño), Staff sin permisos, Admin, SuperAdmin: entran a su home y abren todas sus pantallas; las pantallas ajenas (`/admin`, `/residence`) quedan cerradas — **ok** (112/112).
- Camila pide un lugar desde la ficha → aparece en «Mis solicitudes» — **ok** (solicitud borrada después).
- Casos límite (cookie rota, sesión vencida, residencia/solicitud ajena, ids inválidos, filtros con basura, campos vacíos, abuso de APIs) — **ok** (10/10).
- Tests de integración: 2266 ok, 1 falla (test viejo, arreglado). typecheck y lint del código de la app: 0 errores. Build: ok.

## Carga (solo lectura; páginas públicas, fichas y paneles de estudiante/residencia/admin)
- 25 usuarios simultáneos: ok (p95 1,5 s, 0 % de errores).
- 50 usuarios: empieza a degradarse (p95 4,1 s; 0 errores) y la prueba se corta sola por el umbral de 3 s.
- Son números de staging (Vercel + Supabase de desarrollo), no la capacidad de producción.

## Seguridad de base (estured-dev)
- Bien: RLS en las 72 tablas; cero escrituras directas de anon/authenticated; anon solo lee el catálogo verificado; grants por columna de 0081 completos; policy de usuario activo en las 47 tablas que la necesitan; ninguna función SECURITY DEFINER ejecutable por anon; storage sin acceso directo; los 3 medios de 2026-11-14 cerrados; 0093–0097 aplicadas en dev.
- A arreglar (bajo): 2 helpers sin uso ejecutables por usuarios logueados; `enforce_application_active_cap` sin `search_path`; privilegios por defecto de funciones/tablas nuevas demasiado abiertos; `residences.created_by` legible con la clave pública; protección de contraseñas filtradas apagada en Auth; staff sin permiso puntual lee por API solicitudes/pagos de su residencia (docs/05 se contradice entre §14bis y DR11). Detalle: `scratchpad/pre/rls-audit.md` de la sesión.
- Staging es público: `*.vercel.app` no pide login de Vercel (el runbook dice que sí) y el selector demo deja entrar como admin de dev. No afecta producción, pero conviene cerrarlo o apagar `DEMO_LOGIN_ENABLED` cuando no se use.

## Arreglos hechos (solo pruebas)
- `lib/faq/faq.test.ts`: el test esperaba el formato anterior a 0096 (ahora hay `isFeatured`).
- Nuevo (sin commitear): `playwright.config.ts`, `e2e/` (specs, k6, scripts de limpieza con guard de dev).
- Limpieza de residuo: 7 residencias y reservas de test de corridas cortadas, 11 usuarios de test. Quedan 5 usuarios `audit-ses-…@estured.test` que no se dejan borrar (tienen filas ligadas).

## PENDIENTE DE APROBACIÓN (no aplicado)
1. Migración nueva: revocar `execute` a `is_reservation_student` y `can_answer_stay_followup`, fijar `search_path` de la 0093 y revocar privilegios por defecto sobre funciones nuevas.
2. Activar «Leaked password protection» en Supabase (dev y prod) y anotarlo en el runbook.
3. Decidir en docs/05: ¿el staff sin permiso puede leer solicitudes/pagos (DR11) o no (§14bis)? Hoy manda DR11.
4. Docs: `CLAUDE.md` dice «0093 a 0097 pendientes en dev»; están aplicadas. Texto propuesto: «dev aplicadas hasta 0097».
5. `npm run typecheck`, `lint` y `test` globales fallan por la carpeta sin versionar `scratchpad/` (351 errores de TS; vitest la recoge). Propuesta: excluirla en `tsconfig.json`, `eslint.config.mjs` y `vitest.config.ts`.
6. Ficha inexistente responde 200 (con «No encontramos» y `noindex`) y la pantalla trae 3 metas `robots`: es el efecto de la carga progresiva; solo SEO, bajo.

## No se pudo probar
- Login, registro, preregistro y recuperar contraseña reales: Turnstile (no se esquiva).
- Pago a la residencia, fee, reserva, comprobantes y renovaciones en el navegador: cubiertos solo por los tests de integración. Tampoco la vista del dueño de Wanna Tango (el demo es dueño de Norte y Río de la Plata).
- Mails (staging sin `RESEND_API_KEY`) y carga de escritura (las acciones del servidor no se llaman sin navegador).
- Producción: fuera de alcance a propósito. La suite de integración tardó 24 min por la lentitud de la base de dev (la primera corrida se colgó por una caída de red).
