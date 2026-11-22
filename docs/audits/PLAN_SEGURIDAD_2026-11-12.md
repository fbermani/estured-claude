# Plan de acción — correcciones de seguridad (2026-11-12)

Basado en `docs/audits/SEGURIDAD_2026-11-11.md`. Alcance: **solo `estured-dev`** (ref `gyfbtsuibmecefwovdgh`, el único proyecto visible por el MCP de Supabase). Producción se arma después desde cero con el bootstrap, así que cada migración nueva queda en `db/migrations/` y entra sola en ese bootstrap.

Reglas: fases en orden; un agente por fase (o dos en paralelo si tocan archivos distintos); `typecheck` + `lint` + tests de lo tocado por fase; un `build` por fase con el dev server parado; suite completa solo al final. Sin commits ni push hasta que el dueño lo pida.

## Estado verificado en dev antes de empezar
- 69/69 tablas con RLS; 0 policies en `storage.objects`; buckets con `allowed_mime_types` y tope de tamaño (mitiga B3 del lado Storage).
- `pg_graphql` no instalado; `cron.job` vacío (0013 no aplicada en dev, como corresponde).
- 0079 aplicada en dev (columnas presentes).

## Fases

| Fase | Hallazgos | Agente / modelo | Toca | Necesita al dueño |
|---|---|---|---|---|
| 1 | C1, B15 | `constructor` · sonnet | `package.json`, lockfile | No |
| 2 | A1, A2, M7, B9, B10, B11, I2 | `constructor` · opus | migración `0081`, `setUserBlockedStatus`, lecturas con sesión | No (se aplica en dev vía MCP) |
| 3 | M1, M2, M3 | `constructor` · sonnet | `safeNext`, mail familiar, negociación, migración `0082` (CHECK) | No |
| 4 | M4, M5, B12 | `constructor` · sonnet | cookies Supabase, `layout.tsx`, `next.config.ts`, `middleware.ts` | No (se prueba login en el preview local) |
| 5 | M6 | `constructor` · opus | rate limit persistente en Postgres (`0083`), respuestas neutras | Sí, parcial: CAPTCHA (Turnstile) y verificación de email en preapertura |
| 6 | B1–B8, B14 | 2 × `constructor` · sonnet en paralelo | uploads/Storage vs. exchange/cron/URLs/.gitignore | Sí, parcial: qué carpetas sin trackear se commitean (B14) |
| 7 | Cierre | `seguridad` + `revisor` · opus | solo lectura | Commit |

## Decisiones tomadas sin consultar (reversibles)
- **M6 sin infraestructura nueva:** rate limit en una tabla de Postgres (solo service role) en vez de Upstash/KV, para no sumar cuentas ni claves. Se puede migrar a WAF de Vercel más adelante.
- **M7:** grant por columnas para la residencia (la UI ya lee con service role; no cambia nada visible).
- **B13:** se mantiene como está (coherente con DR11); queda documentado.
- **I2:** `blocked_reason` deja de ser legible por el propio usuario (grant por columnas).

## Pendiente de decisión del dueño (se pregunta de a una al llegar)
1. ~~CAPTCHA Turnstile~~ **Decidido 2026-11-12: opción A** — Turnstile verificado en nuestras server actions (`lib/security/turnstile.ts`, widget `components/ui/TurnstileWidget.tsx`) en login, registro estudiante/familiar, preregistro (+familiar), forgot-password (la waitlist pública se borró después); las altas con invitación válida no lo piden. Complemento: apagar "Allow new users to sign up" en Supabase Auth (todas las altas usan `auth.admin.createUser`). Dev usa las claves de prueba de Cloudflare.
2. ~~Preapertura con `email_confirm: true`~~ **Decidido 2026-11-12: opción C** — se acepta durante la preapertura; antes del lanzamiento público se exige email verificado (link por mail) para solicitudes, pagos y contacto con residencias. Queda como requisito de lanzamiento en `docs/PLAN_SALIDA_PRODUCCION.md` §6.
3. ~~B14~~ **Decidido 2026-11-12: opción A** — se versionan `marketing/`, `.codex/agents`, la config de agentes/skills y el fuente de `video/` y `video-hf/`; se ignoran `scripts/data/` (contactos y notas del CRM), `.hallmark/`, `design-proposals/` y lo generado de los videos (node_modules, build, out, captures, renders, cachés).
4. Verificaciones en Vercel cuando exista el proyecto de prod nuevo: `NEXT_PUBLIC_APP_URL`, `DEMO_*` ausentes en Production y Preview.

## Estado al 2026-11-12

| Hallazgo | Estado | Detalle |
|---|---|---|
| C1 | Corregido | next 15.5.29 + override de postcss ^8.5.32 dentro de next en `package.json`; `npm audit --omit=dev` = 0 |
| A1 | Corregido | `ban_duration` en `setUserBlockedStatus` + 46 policies RESTRICTIVE `is_active_user()` en 0081 |
| A2 / I2 / B11 | Corregido | grants por columna (0081) |
| M1 | Corregido | — |
| M2 | Corregido | + throttle 5/24 h |
| M3 | Corregido | validación server + CHECK en 0082 |
| M4 | Corregido | cookies HttpOnly + pista `er-has-session` |
| M7 | Corregido | policy de residencia en `support_cases` eliminada |
| B1–B3, B5–B10, B12 | Corregido | — |
| M5 | Parcial | CSP en Report-Only; falta pasar a enforce tras observar |
| M6 | Parcial | rate limit persistente en Postgres (0083/0086) en login/registro/preregistro/forgot y respuesta neutra en `/register/family`; Turnstile en server actions (opción A); verificación de email diferida al lanzamiento por decisión (opción C); preregistro sigue diciendo "Ya hay una cuenta" |
| B4 | Parcial | topes de texto (0084); sin throttle de uploads |
| B14 | Corregido | `.gitignore` según opción A (2026-11-12) |
| B13 | Sin cambio por decisión | — |
| I1, I3, I5 | Info sin acción | — |

- **Migraciones nuevas 0081–0086:** todas aplicadas en `estured-dev` (vía MCP), NINGUNA en producción; entran en el bootstrap de prod. El bootstrap de prod ahora crea el cron leyendo el secreto de Supabase Vault: hay que crear el secreto `cron_secret` antes.
- **Verificación:** typecheck/lint/build en verde; suite completa 1861/1874 + los 4 fallos corregidos (`auditActionLabels` preexistente; `stayChange` era dato de dev, test ajustado); login/logout/cookies/CSP verificados en el navegador local.
- **"Allow new users to sign up" apagado en dev (2026-11-12):** `/auth/v1/settings` devuelve `disable_signup: true` y un preregistro completo en el navegador sigue funcionando (alta vía `admin.createUser` + autologin; cuenta de prueba borrada).
- **Pendientes del dueño:** apagar "Allow new users to sign up" en Supabase Auth de prod; claves reales de Turnstile en Vercel prod (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`: sin el secret, prod rechaza todos los envíos); "Leaked password protection" en prod cuando esté en plan Pro (en dev, plan Free, no existe); JWT queda en 1 h (default); en Vercel prod: `NEXT_PUBLIC_APP_URL` obligatorio (`getAppUrl` lanza si falta), `DEMO_*` ausentes en Production y Preview, `CRON_SECRET`.

- **Auditoría final 2026-11-13:** sin críticos ni altos. S1 (medio) **corregido**: `requestResidenceSignup` ahora verifica Turnstile (widget en `RegisterResidenceForm`) y usa `consumeRateLimit` persistente (`residence_signup_ip` 5/h, `residence_signup_email` 3/h). S3 **corregido** (en producción `verifyTurnstile` rechaza un secret de prueba `1x/2x/3x`). S2 **corregido** (`report-uri /api/csp-report`: route handler que solo loguea, con tope y freno; falta observar un tiempo en prod y recién ahí pasar la CSP a enforce, sacando `unsafe-inline` si se puede). Pendiente bajo: S4 (login no atómico, aceptable).

- **Auditoría 2026-11-14:** SEG14-01/02/03 (medios) **corregidos** en dev; detalle y pendientes en `docs/audits/AUDITORIA_SEGURIDAD_2026-11-14.md`. B4 queda cubierto para documentos de estudiantes (cuota + freno).

- **Auditoría complementaria 2026-11-15:** SEG15-01 (medio: «pago recibido» duplica reservas y fees bajo concurrencia) **corregido en dev** (reclamo atómico + índice único 0089; regresión D1 verde; 0089 pendiente en prod) y SEG15-02 (medio: soporte sin cuota) **corregido en dev** (5 casos/hora, 10 abiertos, 100 MB de evidencia por día; sin migración); SEG15-03 (reemisión de comprobante) también corregido con compare-and-set; SEG15-04 (grants de escritura de anon/authenticated) corregido con la migración 0090 y sesiones de menor/familiar/admin/superadmin probadas; DR48 y aislamiento con sesiones reales comprobados. Detalle y evidencia en `docs/audits/AUDITORIA_SEGURIDAD_COMPLEMENTARIA_2026-11-15.md`.

- **Revisión de solicitudes/negociación y RLS 2026-11-16:** cuatro hallazgos **corregidos en dev**: (1) respuesta a la propuesta de la residencia y a la propuesta del familiar con reclamo atómico por estado (`recordNegotiationResponse`, `recordFamilyProposalResponse`; tests de concurrencia nuevos); (2) topes de texto en las acciones (`lib/applications/inputLimits.ts`) + CHECK de largo en la migración 0091 (esto corrige el estado «Corregido» de B4/M3 para estos campos: antes solo `move_context_note` tenía tope); (3) duración entera y fecha de ingreso validadas en la solicitud del estudiante y la propuesta del familiar; (4) migración 0092: `anon` solo conserva SELECT en las 10 tablas de catálogo público. 0091 y 0092 pendientes en prod (entran en el bootstrap).
- **Revisión del reel de seguridad y de `reopenApplication` 2026-11-19:** el checklist del reel (autenticación, secretos, HTTPS, validación, XSS, CSRF, CORS, cabeceras, cookies, rate limit, archivos, pagos, dependencias, Git) ya estaba cubierto; `npm audit --omit=dev` da 0 y no hay secretos en el historial (búsqueda por patrones). `fee/actions.ts` ya usaba compare-and-set. **Corregido en dev:** `reopenApplication` no verificaba filas afectadas (dos reaperturas simultáneas duplicaban evento, auditoría y notificación) y su motivo no tenía tope (el CHECK de 0091 lo habría rechazado sin aviso); ahora reclama por estado y limita a 500. Tests nuevos.
- **Kit «25 controles» (ND1) contra el proyecto, 2026-11-21 (lectura de código + SQL de solo lectura en dev):** P = probado, E = pendiente.
  - **P (21):** 01–03 (solo `NEXT_PUBLIC_*` públicas; sin `service_role` en componentes cliente; sin sourcemaps públicos), 06, 07 (todas las tablas de `public` con RLS; 29 sin policies a propósito = solo service role), 08 (0090/0092: anon sin escritura y solo 10 tablas legibles; authenticated sin escritura directa), 10–11 (ninguna policy de escritura sin `WITH CHECK`), 12 (todas las vistas `security_invoker`; toda función `SECURITY DEFINER` con `search_path` fijo y sin EXECUTE para anon), 13 (4 buckets privados + 1 público a propósito, con tope de tamaño; `storage.objects` sin policies: todo por service role), 14 (todas las server actions de `/admin` validan sesión admin), 15 (`user_metadata` solo se escribe al registrarse, nunca autoriza), 16 (`getSafeUser`; sin `userId` desde el formulario), 17, 20 (22 usos de `consumeRateLimit` + Turnstile), 21 (dos proyectos Supabase, `.env*` ignorados), 23 (`package-lock.json`, `npm audit` en 0).
  - **E:** 04–05 historial de Git: solo búsqueda por patrones, falta `gitleaks`; 09 prueba cruzada A/B/anónimo por HTTP real (hoy la cubren tests de integración, falta una pasada manual documentada con la ficha de evidencia del kit); 18–19 revisar a mano que ningún error de servidor quede en spinner y que los logs no lleven datos personales; 22 **cerrado 2026-11-22** con `.github/workflows/ci.yml` (typecheck, lint, audit, tests sin credenciales; al armarlo salieron y se corrigieron 3 tests rotos: `reportActions.ts` sin registrar en `permissionCoverage`, fake de `expireWaitlistByMonth` y un test de ficha que exigía base real); falta branch protection en `main`; 24 backups sin restauración ensayada (Supabase Free no trae); 25 revisión externa antes de cobrar (hay pagos y datos de identidad de menores).
  - Los E de 22, 24 y 25 son pre-lanzamiento y están en `docs/PLAN_SALIDA_PRODUCCION.md`.
  - **Pendiente post-producción:** (a) paso de escaneo de secretos en CI (gitleaks) sobre el historial completo, hoy no hay CI; (b) pasar la CSP de Report-Only a enforce tras observar `/api/csp-report`; (c) probar las server actions por HTTP real contra un preview sin SSO; (d) revisar `reopenRenewalOffer`, `reopenRenewalRequest` y `reopenEsturedFeeWindow` con el mismo criterio (reclamo por estado y filas afectadas).
