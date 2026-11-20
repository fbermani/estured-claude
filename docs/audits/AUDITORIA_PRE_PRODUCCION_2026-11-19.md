# Auditoría pre-producción 2026-11-19

Rama `staging`. Cuatro fases: seguridad, preparación para producción, rendimiento y prueba de carga.
Solo informes: no se cambió código ni migraciones.

## Resumen por severidad

| Severidad | Qué | Dónde |
|---|---|---|
| Bloqueante | Pasos del runbook sin hacer: Supabase prod, variables de Vercel, dominio, deploy | P19-01 a P19-04 |
| Bloqueante | Sin `error.tsx` ni `global-error.tsx` en español; sin monitoreo ni CI | P19-05, P19-06 |
| Bloqueante | Contradicción del runbook sobre protección de contraseñas filtradas (no existe en Free) | P19-07 |
| Alta (rendimiento) | Catálogo sin caché en cada request de `/`, `/search` y el fondo de preapertura | R19-03, R19-04, R19-01, R19-02 |
| Alta (rendimiento) | `animate.css` y Material Symbols en el camino crítico; Tailwind escanea carpetas pesadas | R19-05, R19-06, R19-07 |
| Alta (capacidad) | p95 de 3,1 s con 25 usuarios y 5,7 s con 50 en staging | Fase 4 |
| Media (seguridad) | Staging público con selector demo y acceso de superadmin de dev | S19-01 |
| Baja | Seis hallazgos de seguridad, ver Fase 1 | S19-02 a S19-07 |

Orden sugerido de arreglos antes del lanzamiento:
1. Cachear el catálogo y quitar `force-dynamic` de `/` (R19-03, R19-04). Es la causa principal de la degradación.
2. Quitar `animate.css`, agregar `@source not` y `scratchpad/` a `.gitignore` (R19-05, R19-07, S19-06).
3. Cerrar el staging (Vercel Authentication en Preview o apagar `DEMO_LOGIN_ENABLED`): S19-01.
4. Crear `error.tsx` y `global-error.tsx` en español (P19-05).
5. Ejecutar fases C a F del runbook.
6. Repetir la prueba de carga después del paso 1.

## Fase 1: seguridad (rama staging, 2026-11-19)

Resultado: sin hallazgos críticos ni altos. El más grave es de severidad media y es operativo (staging), no del código de producción.

### Media
- **S19-01** | `lib/demoLogin.ts:7`, `lib/dev/devUi.ts:9` | El Preview de staging responde 200 sin login de Vercel. `/login` muestra «Simular usuario» e incluye superadmin (`lib/dev/demo-users.ts:53`). El runbook dice lo contrario (`docs/PLAN_SALIDA_PRODUCCION.md:46`). `scripts/seed-crm-residencias.mjs:62` publica 35 negocios reales como `verified_active` con precios inventados. Confirmado con curl y lectura de código. Datos personales reales en estured-dev: no verificado. Ya figuraba en PRUEBAS_PRE_PRODUCCION línea 20. Explotación: cualquiera entra como superadmin de dev y edita fichas visibles. Fix: activar Vercel Authentication en Preview o apagar `DEMO_LOGIN_ENABLED` en Preview.

### Baja
- **S19-02** | `db/migrations/0098_security_hardening_functions.sql:13` | Un revoke de privilegios por defecto acotado a un esquema no anula el EXECUTE global de PUBLIC. No verificado en runtime. Fix: `alter default privileges for role postgres revoke execute on functions from public;` sin `in schema`; confirmar con `select * from pg_default_acl;`.
- **S19-03** | `app/(preapertura)/dev-preapertura/preparar/route.ts:16`, `scripts/seed-preapertura-dev.mjs:24` | Contraseña de cuentas de prueba fija en el repo, mails deterministas. GET sin sesión, activo en staging (307 con `estado=anon`). Hace signOut, crea cuentas con service role e inicia sesión. Fix: contraseña desde env var de Preview y pasar la ruta a POST.
- **S19-04** | `app/(public)/residencias/[slug]/reglamento/route.ts:55` | GET público genera un PDF por request con `no-store`, sin caché ni límite. Impacto en cupo de Vercel Hobby: no verificado. Fix: cachear por versión con `s-maxage` o regla WAF.
- **S19-05** | `app/(public)/register/student/actions.ts:238`, `app/(public)/register/family/actions.ts:190` | Se loguea el objeto de error completo de PostgREST. Ante un CHECK, `details` puede traer la fila con datos personales (también de menores). No verificado en runtime. Fix: loguear solo `code` y `message`.
- **S19-06** | `scratchpad/` (no está en `.gitignore`) | 324 MB, no trackeada ni ignorada, con repos de terceros y claves de ejemplo. Un `git add -A` la sube a GitHub. Fix: agregar `scratchpad/` a `.gitignore`.

### Informativa
- **S19-07** | `db/migrations/0093_atomic_availability_and_active_requests_cap.sql:18` | `decrement_profile_availability` es SECURITY DEFINER con `search_path = public`. Solo la ejecuta service_role. No explotable hoy. Fix: `search_path = ''`.

### Revisado y sin hallazgos
- Código posterior al 14/11 (compartir ficha, FAQ destacadas, foto principal, reglas, negociación, solicitudes): valida permiso, pertenencia y topes.
- 80 archivos `"use server"`: cada acción valida sesión o rol, o es pública con Turnstile y límite persistente.
- Cero `getUser()` directo. Service role con `server-only` y ausente del cliente. Sin claves en el historial de git.
- Migraciones 0089–0099: RLS en tablas nuevas, grants por columna, revoke en funciones SECURITY DEFINER, escrituras y lecturas de anon revocadas.
- Route handlers: cron con `timingSafeEqual`, PDFs protegidos por RLS o rol, `csp-report` acotado.
- Límites persistentes y fail-closed en producción para login, registro, preregistro, forgot y FAQ. OTP con contador en base. `/verify` por número: unos 50 bits.
- 9 JSON-LD escapan `<`. `safeInternalPath` valida el resultado. Uploads con magic bytes. Signed URLs de 60 a 600 s.
- `npm audit --omit=dev`: 0 vulnerabilidades (next 15.5.29). La comunidad pública oculta menores y campos sin consentimiento.

## Fase 2: preparación para producción (rama staging, HEAD 7a1d9c7)

Veredicto: el código está listo. La salida depende de los pasos manuales abiertos del runbook. Solo evidencia local; ningún valor de entorno impreso.

### Bloqueantes
- **P19-01** | `docs/PLAN_SALIDA_PRODUCCION.md` §C2, §D, §E, §F, §G sin tildar | Supabase prod nuevo, bootstrap, buckets, Auth, variables de Vercel, dominio y deploy sin hacer. | Ejecutar C a F en orden. No pushear a main antes de completar E.
- **P19-02** | Relevamiento DNS del runbook F1 (2026-11-19, no re-verificado) | `estured.com` apunta al parking de Hostinger. Vercel no tiene dominio Production ni deploys de main. | Agregar el dominio en Vercel y reemplazar A/CNAME. El cron del bootstrap ya apunta a `https://estured.com`.
- **P19-03** | `git rev-list --count origin/main..staging` = 356; el runbook B nombra `hardening/pre-produccion` | `origin/main` está 356 commits atrás. El merge sale de `staging`. | Corregir el runbook. El push a main deploya solo.
- **P19-04** | `.env.local`, `.env.example` sin `NEXT_PUBLIC_SITE_URL`, `EMAIL_FROM`, `EMAIL_DOMAIN_VERIFIED`; `lib/appUrl.ts:9` | Sin `NEXT_PUBLIC_APP_URL` en Production, `getAppUrl` lanza (mails, QR de comprobantes). Sin `TURNSTILE_SECRET_KEY` real, `lib/security/turnstile.ts` rechaza todos los envíos. Sin `CRON_SECRET`, `NEXT_PUBLIC_SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_ANON_KEY`, el middleware responde 503 (`middleware.ts:19-21`). | Cargar las 13 variables de la tabla E antes del primer deploy.
- **P19-05** | Sin `app/global-error.tsx` ni `app/error.tsx`; `app/(preapertura)/` sin `error.tsx` | `/` se reescribe a preapertura en el lanzamiento. Un fallo muestra el error por defecto de Next, en inglés. | Crear `error.tsx` en `(preapertura)` y `app/global-error.tsx` en español.
- **P19-06** | `package.json` sin Sentry ni similar; sin `instrumentation.ts`; sin `.github/` | Sin monitoreo de errores ni CI. La preapertura captura datos personales. | Mínimo: alertas de Vercel y runbook de guardia. Sentry opcional. Anotar la decisión.
- **P19-07** | Runbook D3 líneas 114-118 y 263 | La línea 263 manda activar "Leaked password protection" en prod. A2 dice que no existe en Free. Con altas por `email_confirm:true`, la contraseña mínima de la app es la única defensa. | Decidir: pasar a Pro antes de abrir o aceptar el riesgo por escrito. Corregir la contradicción.

### No bloqueantes
- **P19-08** | `db/_generated/prod_bootstrap.sql` (regenerado con `--host=estured.com`) | 100 archivos, 0001–0099 + 0043b, sin huecos. Quedan 3 `REEMPLAZAR-CON-TU-CRON-SECRET` (uno en vault, dos en comentarios) y 1 `REEMPLAZAR-CON-TU-DOMINIO` en un comentario. | Generar el secreto con el comando del runbook D1.
- **P19-09** | Runbook líneas 3, 91-95 y 219 | Dice "0001–0087", "87 migraciones" y "0001–0094/0097". El bootstrap llega a 0099. | Actualizar D1 a 0001–0099.
- **P19-10** | `CLAUDE.md:45` | Dice "0001–0098". 0099 ya está aplicada en dev. | Actualizar CLAUDE.md y MEMORY.md §3.
- **P19-11** | Runbook línea 264 contra A0.2 línea 46 | `estured.vercel.app` no pide login de Vercel y tiene el selector demo con admin de `estured-dev`. No afecta Production (`lib/demoLogin.ts:8` exige `VERCEL_ENV!=production`). | Activar Vercel Authentication en Preview o apagar `DEMO_LOGIN_ENABLED`. Corregir A0.2.
- **P19-12** | `DEMO_LOGIN_ENABLED`, `DEMO_USERS_PASSWORD`, `NEXT_PUBLIC_STAGING` | Prohibidas en Production. No verificado en Vercel. | Verificar en el dashboard que ninguna incluya `production` (runbook E, línea 143).
- **P19-13** | Sin `vercel.json` ni región | Región por defecto (iad1) contra Supabase en São Paulo: latencia extra. No verificado. | Fijar gru1 si el plan lo permite y anotarlo.
- **P19-14** | PDF routes `app/students/receipts/[id]/pdf/route.ts`, `app/residence/dashboard/pdf/route.ts`, `reglamento/route.ts` | `runtime="nodejs"`, sin `maxDuration`. Límites de Hobby no verificados. | Probar un PDF en el deploy real. Pasar a Pro antes de cobrar el primer fee.
- **P19-15** | Informe de pruebas 2026-11-19 | Staging: 25 usuarios OK, 50 usuarios p95 4,1 s. Capacidad de producción no medida. | Medir tras el deploy. Esperar degradación con Free y Hobby.
- **P19-16** | `next.config.ts` | CSP en Report-Only. HSTS solo con `NODE_ENV=production`. Reportes a `/api/csp-report` (solo logs, tope 8 KB, 30/min). | Aceptado en runbook I.
- **P19-17** | 599 `console.*` en app y lib; ej. `lib/residents/setResidentEmail.ts`, `app/(public)/forgot-password/actions.ts:88` | Se loguean objetos de error de Supabase completos; pueden incluir email o teléfono. Revisión parcial. | Redactar con un helper en logs de auth y residentes.
- **P19-18** | `.github/` ausente | Sin CI ni gate de typecheck/lint/test antes del push que deploya. | Workflow mínimo o aceptar el riesgo.
- **P19-19** | `MEMORY.md:3`, runbook línea 262 | 0098 figura "aplicada solo en dev". En prod entra por bootstrap. | Verificar con la consulta `has_function_privilege` tras el bootstrap.
- **P19-20** | `app/api/cron/expire-stale-records/route.ts`, `middleware.ts:60` | Tiempo constante, 503 sin secreto, 401 con secreto incorrecto. pg_cron `0 * * * *` con secreto en Vault. OK. | Probar según runbook G tras el deploy.
- **P19-21** | `app/robots.ts`, `lib/siteUrl.ts` | Con `NEXT_PUBLIC_SITE_URL` distinto de estured.com emite `Disallow: /`. Variable vacía: default estured.com. OK. | Verificar `/robots.txt` y `/sitemap.xml` tras el deploy.
- **P19-22** | Runbook A4, A5, C1, C3, G | Pendientes del dueño: casilla `hola@estured.com`, Turnstile real, Resend + DNS, WAF, Search Console/Bing, cuentas de prueba, admin real, auditoría final. Fase I bloquea abrir el sitio completo, no la preapertura. | Seguir el runbook.
- **P19-23** | `npm audit` | next 15.5.29 y react 19.2.7 resuelven los 14 advisories. La fase 1 corrió `npm audit --omit=dev` con 0 vulnerabilidades. | Repetir antes del push final.

No verificado: estado real de variables y dominios en Vercel, config de región y runtime, existencia del prod nuevo, logs de producción, límites del plan Hobby, typecheck/lint/build en esta sesión.

## Fase 3: rendimiento de la app (rama staging)

Medido: animate.css, CSS global, JS por ruta (build local `.next` de hoy 10:50, commit no verificado), consultas por página (conteo). No medido: LCP/TTFB reales (sin Lighthouse), tamaño de la fuente Material Symbols, efecto de `scratchpad/` en el CSS, `/search` con muchas residencias. Línea base en PRUEBAS_PRE_PRODUCCION_2026-11-19: 25 usuarios p95 1,5 s; 50 usuarios p95 4,1 s. El cuello son las consultas por request.

Peso medido: JS compartido 347 KB raw / 102 KB gz. JS propio por ruta: `/` 13 KB gz, `/preapertura` 23, `/preregistro` 28, `/search` 31, ficha 52. Total gz: `/` 113, `/preapertura` 123, `/preregistro` 128, `/search` 131, ficha 152 KB. CSS global 305 KB raw / 46,8 KB gz.

### Alta
- **R19-01** | /preregistro y pantallas preapertura | `app/(preapertura)/preregistro/page.tsx:22,49`, `components/preapertura/HomeBackdrop.tsx` | `force-dynamic` renderiza el fondo (home completa: ~9 consultas + tipo de cambio + Navbar + Footer) en cada request. TTFB +300–900 ms (estimado). | Cachear el catálogo (`unstable_cache` 60 s) y envolver el fondo en Suspense.
- **R19-02** | / (preapertura) y /preregistro | `components/preapertura/BlurredPreview.tsx:20` | El fondo blureado e inert descarga imágenes, CSS y JS de la home entera. 50–150 KB de imágenes + 23–28 KB gz de JS (no medido). | Fondo estático liviano (WebP o hero sin marquee).
- **R19-03** | / y /search | `lib/residences/catalog.ts:61-135`, `app/(public)/page.tsx:5` | Catálogo completo sin caché en cada request: 3 rondas a la base (`loadGenderAvailability` en serie, línea 128). Explica la caída a 50 usuarios. 200–600 ms de TTFB (estimado). | `unstable_cache` con revalidate 60–300 s y tag; incluir `loadGenderAvailability`.
- **R19-04** | / | `app/(public)/page.tsx:5` | `force-dynamic` sin motivo: la home no lee sesión (la Navbar la resuelve en cliente). TTFB ~400 ms → ~50 ms desde el borde (estimado). | `revalidate = 60`.
- **R19-05** | todas | `app/layout.tsx:8`, `node_modules/animate.css` | `animate.css` completo (97 keyframes) global; usado solo en `StaggerIn` (fadeInLeft). 72 KB raw / 5,3 KB gz medidos; bloquea el render en todas las rutas. | Borrar el import; `@keyframes fadeInLeft` propio en `globals.css` (transform/opacity, ~0,3 KB).
- **R19-06** | todas | `app/layout.tsx:60-67` | Hoja externa de Material Symbols con los 4 ejes en el camino crítico; render-blocking + 2 RTT a Google. Fuente completa 200–400 KB (estimado, no medido). | Self-host con `next/font/local` y subset, o ejes fijos.
- **R19-07** | todas | `app/globals.css:1`, `.next/static/css/dda810124dbd33e7.css` | Tailwind v4 escanea `scratchpad/` (324 MB), `design-references/` (28 MB) y `docs/` por no estar en `.gitignore`. Exceso estimado 10–30 % del CSS (no medido); ralentiza el build. | `@source not` para esas carpetas o gitignorearlas; remedir.
- **R19-08** | /residencias/[slug] | `page.tsx:236,272,278,302` | Cascada de ~7 rondas; `getApprovedCustomAmenities` (302) serial e independiente. 150–400 ms TTFB (estimado). | Lanzar tipo de cambio y sesión junto con `loadResidence`; mover amenities al `Promise.all` de 281.
- **R19-09** | /residencias/[slug] | `page.tsx:195,204` | `createSignedUrl` del reglamento y `loadGenderAvailability` en serie tras el `Promise.all`. 100–250 ms (estimado). | Meterlos en el `Promise.all` o firmar fuera del camino crítico.
- **R19-10** | /residencias/[slug] | `page.tsx:88,120,136` | `force-dynamic` con `select("*")` en `residences` y `rooms`: columnas internas hacia el servidor. 5–20 KB por consulta (estimado). | Listar columnas; separar parte pública cacheable (ISR por slug) de la parte por usuario en Suspense.

### Media
- **R19-11** | ficha | `components/residences/ficha/*` | 162 KB raw / 52 KB gz de JS propio, el mayor del sitio. -20 a -30 KB gz (estimado). | `next/dynamic` para modales y formularios bajo el pliegue.
- **R19-12** | /search | `search/page.tsx:58-63` | `getSessionUser` y `getStudentAgeAt` en serie antes del catálogo. +150–300 ms a estudiantes logueados. | Pedir el catálogo completo y filtrar por edad en memoria, en paralelo con la sesión.
- **R19-13** | /search | `search/page.tsx:218-225` | Renderiza todas las residencias sin paginar ni `content-visibility`. Crece lineal (no medido). | `content-visibility:auto` o «ver más».
- **R19-14** | /search | `components/residences/SearchMap.tsx`, `search/SearchShell.tsx` | `SearchMap` se importa estático aunque solo se ve con `view=mapa`. 31 KB gz de JS de ruta; -10 a -15 KB gz (estimado). | `dynamic()` condicionado a `view === "mapa"`.
- **R19-15** | /preregistro | `page.tsx:27,49` | `getSafeUser` y `getStudentCount` en serie. +80–200 ms (estimado). | `Promise.all`.
- **R19-16** | / y preapertura | `components/marketing/HomeHero.tsx:45,155-160` | El marquee duplica las tarjetas (≥16 imágenes) sin `priority`. 8+ imágenes extra (estimado). | Limitar el clon a 4–6 y `priority` a las 2 primeras.
- **R19-17** | / | `HomeHero.tsx:12` (`INTRO_S=1.7`), `hero-motion.css` | Intro con sello tapa el hero 1,7 s en cada visita. LCP técnico no afectado. | Mostrarlo solo en la primera visita o acortar a ≤0,8 s.
- **R19-18** | públicas | `components/layout/Navbar.tsx:46` | `fetch /api/session` (no-store) en cada cambio de pathname con cookie hint: 1 función + 2 consultas por navegación. | Cachear en estado por sesión; refetch solo en login/logout.
- **R19-19** | /preregistro, /login, /register/* | `components/ui/TurnstileWidget.tsx:24` | Script de Cloudflare compite con la hidratación. 30–60 KB (estimado). | Cargar en el primer foco del formulario.

### Baja
- **R19-20** | / | `components/ui/Reveal.tsx`, `StaggerIn.tsx` | Un `IntersectionObserver` por instancia. Despreciable con <10. | Observer compartido si crecen.
- **R19-21** | preapertura | `components/preapertura/Countdown.tsx:20` | Timer de 60 s con cleanup. Sin impacto. | Ninguno.
- **R19-22** | /residencias/[slug] | `page.tsx:278`, `lib/exchange/rate.ts:60-75` | `getCurrentExchangeRate` consulta `exchange_rates` en cada request. +1 consulta. | `unstable_cache` de 1 h, invalidado al cambiar el override.
- **R19-24** | índices | `db/migrations/0003, 0019, 0080` | Catálogo, ficha y contadores tienen índices. Falta índice parcial `files(document_type,status)`. | Revisar al crecer `files`.

Sin hallazgos: imágenes (`next/image` con `sizes`), fuentes Hanken/Bricolage (`next/font`), `cache()` entre `generateMetadata` y page en la ficha, N+1 en `getFeaturedGuides`.

Prioridad de ataque: R19-03 y R19-04, R19-05, R19-01 y R19-02, R19-07, R19-08 y R19-09.

## Fase 4: prueba de carga (ejecutada 2026-11-19, 15:45 a 15:54, hora de Argentina)

**Contra qué:** `https://estured.vercel.app` (Preview de `staging`, base `estured-dev`). Solo lectura y anónimo. Herramienta: k6 v2.4.0. Aprobado por el dueño: URL, rampa y máximo de 100 usuarios virtuales.

**Escenarios:** home 35 %, `/search` 25 %, ficha 25 %, `/preregistro` (GET) 15 %. Pausa de 1 a 3 s por usuario.

**Supuesto, no dato:** pico de 50 usuarios simultáneos. Los docs no traen estimación de tráfico.

### Resultados

| Etapa | Pedidos | Req/s | Mediana | p90 | p95 | p99 | Máximo | Errores |
|---|---|---|---|---|---|---|---|---|
| 10 usuarios, 2 min | 445 | 2,9 | 1069 ms | 1468 ms | 1582 ms | 2049 ms | 2486 ms | 0 % |
| 25 usuarios, 2 min | 908 | 5,9 | 1769 ms | 2733 ms | 3094 ms | 3747 ms | 4369 ms | 0 % |
| 50 usuarios, 3 min | 119 | 5,0 | 1744 ms | 3966 ms | 5704 ms | 6326 ms | 6893 ms | 0 % |

- La etapa de 50 se cortó sola por el umbral (p95 mayor a 5 s). Solo cubre 119 pedidos, durante la subida de la rampa.
- **La etapa de 100 no se ejecutó**: la de 50 no cumplió los criterios.
- Contra los criterios: 10 usuarios cumple (p95 menor a 2 s). 25 usuarios no cumple (p95 3,1 s; el criterio era menor a 2 s). 50 usuarios no cumple (p95 menor a 3 s).
- Errores: 0 % en las tres etapas. El sitio se vuelve lento pero no cae.
- Comparación con la línea base del 2026-11-19 (25 usuarios p95 1,5 s; 50 usuarios p95 4,1 s): esta prueba es más pesada porque incluye `/preregistro` y el fondo de preapertura, y no usa sesiones. No es una regresión demostrada.
- No medí la latencia por escenario: el export de k6 no la separa. Queda como mejora de la próxima corrida.

### Supabase (`estured-dev`) durante la carga

- Estadísticas reiniciadas antes de la prueba (`pg_stat_statements_reset`, solo contadores).
- Total de consultas: 51 450, con 1122 cargas completas del catálogo.
- La base no es el cuello: media de 0,7 a 4,5 ms por consulta; máximo 33 ms.
- Consultas más costosas, todas con 1122 llamadas: `room_types` 5,1 s en total (4,52 ms de media), `residence_profile_sections` 3,1 s, `rooms` 1,9 s, `files` 1,6 s, `resident_stays` 1,5 s, `residences` 0,8 s.
- Conexiones al terminar: 23 de 60 (1 activa). Locks sin otorgar: 0.
- Conclusión: el tiempo se va en el servidor de Vercel. Cada carga del catálogo hace unas 9 consultas por HTTP, en 3 rondas, y se repite en cada request sin caché. Es coherente con R19-03 y R19-04.

### Cuellos de botella, por orden
1. Catálogo sin caché: 9 consultas y 3 rondas por visita a `/`, `/search` y `/preregistro` (R19-01, R19-03, R19-04).
2. Latencia base alta con poca carga: mediana de 1,07 s con 10 usuarios. Sube con la concurrencia, así que el cómputo de cada render domina.
3. Región de funciones por defecto (EE. UU.) contra Supabase en São Paulo: no verificado (P19-13).
4. Límites del plan Hobby de Vercel: no verificados.

### Limpieza
La prueba no escribió datos. Se corrió la simulación de `scripts/cleanup-test-residences.mjs`: detecta 2 residencias de test de corridas anteriores de integración, no de esta carga:
- `residencia-test-reopen-1795114441250` (6eb2297d-9d74-4f08-b0b2-399cbfb8befd)
- `residencia-test-audit-ses-1795099304571` (5afe981b-ba6b-4f10-aebb-8a1db9490bb7)

No se borró nada. Falta la aprobación del dueño para correr `--apply`.

### Cómo repetir
Script usado: `e2e/load/k6-publica.js` (`k6 run -e VUS=25 -e DUR=2m e2e/load/k6-publica.js`; el host está fijo en `estured.vercel.app`). El script `e2e/load/k6-lectura.js` ya existente mide las rutas autenticadas.
