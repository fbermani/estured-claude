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
- **Pendientes del dueño:** apagar "Allow new users to sign up" en Supabase Auth de prod; claves reales de Turnstile en Vercel prod (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`: sin el secret, prod rechaza todos los envíos); "Leaked password protection" en Supabase Auth (dev y prod); revisar duración del JWT; en Vercel prod: `NEXT_PUBLIC_APP_URL` obligatorio (`getAppUrl` lanza si falta), `DEMO_*` ausentes en Production y Preview, `CRON_SECRET`.
