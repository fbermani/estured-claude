# EstuRed — Runbook de salida a producción

Estado de partida (verificado en el repo el 2026-10-23): producción = Supabase `estured-prod` (ref `mrwooskdcnkbitkhcvbf`, listado en `scripts/production-refs.json`) + Vercel (https://estured.vercel.app, deploya con push a `main`). Migraciones aplicadas en prod hasta la **0035**; faltan **0036–0055** (el repo tiene 56 archivos: 0001–0055 más 0043b; la 0043b va aparte en la Ruta A) y la **0013** (cron) con placeholders. No hay usuarios reales en prod. Este documento es un checklist: ningún paso se ejecuta solo.

Convenciones: todos los SQL se pegan en Supabase Dashboard → SQL Editor del proyecto **estured-prod** (no hay supabase CLI). Antes de cada paso en prod, confirmá el ref en la URL del dashboard.

---

## 1. Decisiones previas del dueño

- [ ] **D-A. ¿Partir de cero o conservar la base de prod?** (elegir una ruta)
- [ ] **D-B. Dominio:** ¿se lanza en `estured.vercel.app` o con dominio propio (`estured.com`)? Condiciona SMTP, Redirect URLs, `NEXT_PUBLIC_APP_URL` y la 0013.
- [ ] **D-C. Email de contacto real** (hoy `hola@estured.com` en `lib/constants/contact.ts`): ¿existe y alguien lo lee?
- [ ] **D-D. ¿Se abre al público ya o es beta cerrada?** Define si hace falta cerrar antes los pendientes de la sección 6.

### Ruta A — Conservar la base y migrar (menor trabajo)

- Pros: sin pérdida de configuración (Auth, buckets, cron si estaba).
- Contras: queda el residuo demo y de tests (residencias `residencia-test-*`, usuarios demo con la contraseña de seed). Con `DEMO_USERS_PASSWORD` conocida esos usuarios son cuentas válidas: hay que borrarlas igual.
- Procedimiento:
  - [ ] Backup (sección 2).
  - [ ] Borrar usuarios demo en Dashboard → Authentication → Users (el `on delete` de `users` limpia lo que cuelga; si falla una FK, usar el orden de borrado de `lib/testing/deleteResidenceCascade.ts`). `scripts/cleanup-test-residences.mjs` **no sirve en prod**: se niega por guard (`_assert-dev-project.mjs`).
  - [ ] Seguir con las secciones 2 a 5 normales.
  - Criterio de éxito: `select count(*) from auth.users;` = 0 antes de crear el admin real, y `select count(*) from residences;` = 0 (o solo las reales).

### Ruta B — Partir de cero (recomendada si no hay nada que rescatar)

- Pros: base limpia y reproducible, sin residuo ni usuarios demo, schema exactamente igual a dev.
- Contras: más pasos manuales (Auth, buckets, cron, env vars); si se crea un proyecto nuevo cambia el ref.
- Dos variantes:
  - **B1 (preferida): proyecto Supabase nuevo.** Más limpio y con rollback trivial (el viejo queda intacto). Costo: cambia URL, anon key y service role; hay que actualizar Vercel, agregar el ref nuevo a `scripts/production-refs.json` (conservando el viejo) y rehacer SMTP/Redirect URLs.
  - **B2: vaciar `estured-prod`.** Dashboard → Authentication → Users: borrar todos; Storage: vaciar y borrar los buckets; SQL Editor: `select cron.unschedule('expire-stale-records-hourly');` (si existe) y recrear el schema `public` (drop + create) **restituyendo los grants por defecto de Supabase** (`anon`, `authenticated`, `service_role` sobre el schema y default privileges). Riesgo: si los grants quedan mal, la API devuelve 42501 en todo. No verifiqué el SQL exacto de grants; si dudás, usá B1.
- **Decisión del usuario: "Proyecto nuevo y limpio" (B1) para prod.** La ruta recomendada es el bootstrap: `node scripts/build-bootstrap.mjs prod` genera `db/_generated/prod_bootstrap.sql` (gitignored) con las 56 migraciones (0001–0055 más 0043b, en orden; el lexicográfico `0043_` → `0043b_` ya es el correcto) y la 0013 (cron) con los placeholders `REEMPLAZAR-CON-TU-DOMINIO` y `REEMPLAZAR-CON-TU-CRON-SECRET`. Como el proyecto nuevo no tiene código viejo desplegado, **la 0043b puede ir dentro del bootstrap** (no hace falta aplicarla después del deploy).
- Armado del bootstrap completo de prod (`db/_generated/` está gitignored; el bootstrap de **dev** es otro archivo, con cron comentado):
  - [ ] Correr `node scripts/build-bootstrap.mjs prod` (equivale a concatenar en orden `db/migrations/0001…0055` **incluyendo** `0043b`). Copiar el resultado a un archivo **fuera del repo** antes de editar los placeholders.
  - [ ] En el tramo de la 0013, reemplazar `REEMPLAZAR-CON-TU-DOMINIO.vercel.app` (o el placeholder `REEMPLAZAR-CON-TU-DOMINIO` tal como lo deje el script) por el dominio real **sin** `https://` ni barra final (la URL ya lo lleva en la plantilla) y `REEMPLAZAR-CON-TU-CRON-SECRET` por el valor de `CRON_SECRET` (`openssl rand -hex 32`, el mismo que va en Vercel).
  - [ ] Pegar el archivo entero en el SQL Editor de prod y Run. La extensión `pg_cron`/`pg_net` debe poder habilitarse en el plan de Supabase de prod.
  - [ ] **Borrar el archivo con el secreto** al terminar; no commitearlo.
  - [ ] Con proyecto nuevo, la `0043b` ya está dentro del bootstrap: no hay paso posterior al deploy. (Solo si se eligiera conservar una base con código viejo desplegado, aplicarla por separado después del deploy.)
  - Criterio de éxito: `select max(version)`-equivalente no existe (no hay tabla de migraciones); verificar con `select to_regclass('public.residence_private_details'), to_regclass('public.stay_change_intents');` (ambas no nulas; además `select to_regclass('public.residence_team_invitations');` no nula, 0051) y `select jobname, active from cron.job;` (1 fila activa).
- Luego: sección 2 (buckets, env vars, Auth) y seguir.

---

## 2. Preparativos (antes de tocar migraciones o código)

### 2.1 Backup / export
- [ ] Dashboard prod → Database → Backups (descarga) o `pg_dump` con la connection string; guardar fuera del repo. Aunque sea solo demo, queda como rollback.
- [ ] Anotar el estado del cron: `select jobid, jobname, schedule, active from cron.job;`.
- [ ] Anotar qué migraciones están aplicadas realmente (no hay tabla de control): `select to_regclass('public.student_favorites'), to_regclass('public.family_invitations');` (0033/0034) y confirmar que **no** existen `payment_settings`, `residence_private_details` (si existieran, prod está más adelantado que lo que dice `MEMORY.md`).
- Éxito: archivo de backup descargado y abierto.

### 2.2 Variables de entorno de Vercel
Lista completa de las que lee el código (grep de `process.env`):

| Variable | Uso | Valor en prod |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | cliente y server | URL de `estured-prod` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente y middleware | anon key de prod |
| `SUPABASE_SERVICE_ROLE_KEY` | solo server (`lib/supabase/admin.ts`) | service role de prod (marcar como Sensitive) |
| `NEXT_PUBLIC_APP_URL` | links en emails, `redirectTo` de reset de contraseña, cron | dominio real con `https://` y sin barra final (si falta, cae a `http://localhost:3000`: los mails salen con links rotos) |
| `CRON_SECRET` | `app/api/cron/expire-stale-records/route.ts` (503 si falta) | mismo valor que en la 0013 |
| `RESEND_API_KEY` | `lib/email/sendEmail.ts` (si falta, no envía y solo loguea) | clave de Resend |

- [ ] Todas cargadas en Vercel → Settings → Environment Variables, entorno **Production** (y Preview si se usa; el Preview no debe apuntar a prod sin pensarlo).
- [ ] **`DEMO_LOGIN_ENABLED` y `DEMO_USERS_PASSWORD` NO existen en Vercel** (app/layout.tsx muestra el selector de sesión si `DEMO_LOGIN_ENABLED === "true"`). Revisar Production, Preview y Development.
- [ ] `NEXT_PUBLIC_APP_NAME` figura en `.env.example` pero el código no lo lee: opcional.
- Éxito: tras el deploy, el widget "Simular sesión" no aparece en la esquina inferior izquierda.
- Cuidado: las `NEXT_PUBLIC_*` se incrustan en el build; cambiarlas exige redeploy.

### 2.3 Buckets de Storage
`scripts/setup-storage.mjs` es idempotente y crea 5 buckets:
- `public-residence-media` (público, 5 MB, jpeg/png/webp)
- `private-residence-documents` (privado, 10 MB, pdf)
- `payment-proofs` (privado, 10 MB, pdf/jpeg/png/webp)
- `support-evidence` (privado, 25 MB)
- `student-documents` (privado)

- [ ] Correr con las credenciales de prod **solo en esa invocación** (sin tocar `.env.local`):
  `NEXT_PUBLIC_SUPABASE_URL=<prod> SUPABASE_SERVICE_ROLE_KEY=<prod> node scripts/setup-storage.mjs`
  (alternativa sin terminal: crearlos a mano en Dashboard → Storage con los mismos nombres, visibilidad y límites).
- Éxito: los 5 buckets aparecen; solo `public-residence-media` es Public. No agregar policies de Storage (el acceso privado es por service role).
- Nota: el script no lista un bucket para facturas fiscales ni comprobantes de reserva (se crean "cuando exista el módulo"). No verifiqué si el código sube a otros buckets; revisar con `grep -rn "storage.from(" app lib` antes de lanzar.

### 2.4 Supabase Auth, SMTP y Redirect URLs
- [ ] Dashboard → Authentication → URL Configuration: **Site URL** = dominio de prod; **Redirect URLs** incluye `https://<dominio>/reset-password` (`forgot-password/actions.ts` usa `${NEXT_PUBLIC_APP_URL}/reset-password`). Si falta, el link de recuperación redirige mal.
- [ ] Authentication → Settings: confirmación de email según lo decidido; el SMTP integrado de Supabase tiene límite muy bajo de envíos por hora: configurar **SMTP propio** (Resend u otro) en Authentication → SMTP Settings.
- [ ] Revisar plantillas de mail de Auth (reset de contraseña) en español.
- Éxito: "Olvidé mi contraseña" con un usuario de prueba entrega el mail y el link abre `/reset-password` en prod.

### 2.5 Email transaccional (Resend)
- [ ] Verificar el dominio de envío en Resend (DNS SPF/DKIM).
- [ ] **Cambio de código pendiente:** `lib/email/sendEmail.ts` tiene `FROM_ADDRESS = "EstuRed <onboarding@resend.dev>"` (sandbox: solo entrega al email dueño de la cuenta de Resend). Hay que cambiarlo a un remitente del dominio propio antes de que existan usuarios reales. Es un commit previo al push final.
- Éxito: un mail de notificación llega a una casilla externa.

### 2.6 Mapa, contacto, WAF y dominio
- [ ] **Proveedor de mapa:** `lib/maps/osmTiles.ts` usa `https://tile.openstreetmap.org/...` y `components/residences/CompactMap.tsx` advierte que no es apto para tráfico masivo (política de uso de OSM). Para beta cerrada alcanza; para lanzamiento: proveedor de teselas con clave (`docs/15` §23) — cambio de código + env var nueva. Anotar en sección 6.
- [ ] **Email de contacto:** confirmar que `hola@estured.com` existe (buzón o alias) o cambiar `lib/constants/contact.ts`.
- [ ] **Rate limit / WAF:** el repo solo tiene rate limit propio para la waitlist (0014) y el hash de IP de la FAQ (0039). No encontré límites en `/verify/[verification_code]` ni en `/forgot-password` (el segundo depende del rate limit de Supabase Auth). Configurar en Vercel (Firewall → Rate limiting) reglas para `/verify/*`, `/forgot-password`, `/login`, `/register/*`. Éxito: ráfaga de pruebas devuelve 429.
- [ ] **Dominio:** agregarlo en Vercel → Domains, DNS según indique Vercel, HTTPS activo; actualizar `NEXT_PUBLIC_APP_URL`, Site URL de Supabase y la URL de la 0013.

---

## 3. Migraciones y orden de despliegue

Análisis de dependencias (leído de los encabezados de cada archivo):
- `0036`–`0042`: independientes entre sí y aditivas/idempotentes (0037 oculta perfiles de menores y deja audit; 0038/0039/0043 tablas con RLS sin policies).
- `0043` (fase A) debe ir **antes** del deploy: el código nuevo lee/escribe `residence_private_details`.
- `0044`, `0045`: aditivas; el código nuevo usa sus columnas/tablas, así que van **antes** del deploy.
- `0046`: **cierra una fuga crítica** (un familiar con vínculo pendiente/rechazado/revocado podía leer por la API datos del estudiante, incluso menores: perfiles, solicitudes, reservas, pagos, comprobantes). Es independiente de la 0045; aplicarla **primero entre las tres** y no postergarla. Idempotente (`create or replace`), mismas firmas.
- `0043b` va **después** del deploy y nunca antes: quita columnas de `residences` que el código viejo todavía lee. Aplicarla inmediatamente después del deploy (entre 0043 y 0043b esas columnas siguen legibles con la anon key). También revoca `select(*)` a anon/authenticated sobre `profile_availability` (`select=*` pasa a dar error).
- Esto difiere del esquema "0036–0043 → deploy → 0043b → 0044–0046" propuesto en el pedido: los archivos 0044/0045 declaran columnas que el código ya desplegado en `main` usa, por lo que aplicarlas después del deploy dejaría el sitio con errores en esos flujos. Con prod sin usuarios el riesgo es bajo en cualquier orden, pero este es el orden seguro.

- `0047`: **antes** del deploy. Revoca el SELECT de tabla sobre `estured_fee_payments` y lo concede por columnas (sin los datos de facturación del pagador); el código solo lee esas columnas con service role. Idempotente. Las 0050 la exigen (aborta si falta).
- `0048`: **antes** del deploy. Agrega `changes_requested_message`/`changes_requested_at` a `residence_verifications` y oculta `notes_internal` por API (mensaje de "pedir cambios", DR5); el código nuevo usa esas columnas.
- `0049`: **antes** del deploy (recomendado). Resolución de revocación del fee + caso de Soporte `fee_revocation` (DR6). El código degrada con gracia sin ella (Revocaciones en solo lectura), pero conviene tenerla desde el día uno.
- `0050`: **antes** del deploy (recomendado; requiere 0047). Monto recibido, "confirmado sin comprobante" y admin que validó el pago (DR8). Sin ella "Marcar pagado" funciona y esos datos quedan solo en el audit log.
- `0051`: **antes** del deploy (recomendado). Tabla `residence_team_invitations` y CHECK de `residence_users.permissions` (DR10/DR11). Independiente de 0045–0050; sin ella no se puede invitar/reenviar/cancelar staff.
- `0052`–`0055` (DR14): **antes** del deploy; el código nuevo las usa y degrada con gracia sin ellas. `0052` edad mín./máx. y menores; `0053` reglamento con aceptación por solicitud (flag `regulation_acceptance_pending`); `0054` catálogo de FAQ (49 preguntas); `0055` seguimiento a los 5 días (requiere `resident_stays`). Aditivas e idempotentes; con la 0053/0054 sin aplicar se pierde guardar la aceptación y el bloque de FAQ.
- Orden de aplicación manual (Ruta A): 0046, 0045, 0047, 0048, 0049, 0050, 0051, 0052, 0053, 0054, 0055 (lo que piden los encabezados), todas antes del deploy; 0043b después.

Ruta B (proyecto nuevo, elegida): la sección 3.1 se reemplaza por el bootstrap (que ya incluye 0001–0055 **y** 0043b); seguir en 3.2 y omitir el paso de 0043b de 3.3.

### 3.1 Migraciones previas al deploy (Ruta A) — una por vez, en este orden
- [ ] `0046_family_link_active_only.sql` (seguridad crítica; primero)
- [ ] `0036_receipt_payload_privacy_and_owner_limit_lock.sql`
- [ ] `0037_lock_student_profile_updates.sql`
- [ ] `0038_payment_settings.sql`
- [ ] `0039_residence_faq_questions.sql`
- [ ] `0040_support_cases_fee_payment.sql`
- [ ] `0041_initial_payment.sql`
- [ ] `0042_residence_coordinates.sql`
- [ ] `0043_residence_private_details.sql`
- [ ] `0044_stay_change_intents.sql`
- [ ] `0045_family_billing_profile.sql`
- [ ] `0047_fee_payments_hide_billing_columns.sql`
- [ ] `0048_verification_changes_message.sql`
- [ ] `0049_revocation_resolution.sql`
- [ ] `0050_fee_payment_received_amount.sql` (requiere 0047)
- [ ] `0051_residence_team_invitations.sql`
- [ ] `0052_residence_age_range.sql`
- [ ] `0053_residence_regulations.sql`
- [ ] `0054_faq_catalog.sql`
- [ ] `0055_stay_followups.sql`
- [ ] **`0013_expiration_cron.sql`** (si prod no tiene el job, ver `cron.job`): editar los dos placeholders (dominio sin `https://`, secreto = `CRON_SECRET`) en una **copia fuera del repo**; nunca pegar la migración con placeholders. Si ya existía con valores malos: `select cron.unschedule('expire-stale-records-hourly');` y volver a correr el bloque.
- Éxito de cada una: Run sin error en el SQL Editor. Cada archivo trae su sección ROLLBACK en el encabezado.
- Confirmar al terminar: `select to_regclass('public.payment_settings'), to_regclass('public.residence_faq_questions'), to_regclass('public.residence_private_details'), to_regclass('public.stay_change_intents');` todas no nulas.

### 3.2 Deploy del código
- [ ] Antes del push: en local, `npm run typecheck && npm run lint && npm run build` en verde (no con el dev server levantado: corrompe `.next/`).
- [ ] Cambio de `FROM_ADDRESS` hecho (2.5) y, si corresponde, de contacto.
- [ ] `git status` limpio de secretos; `.env.local` no está trackeado. Los archivos sin trackear hoy (`.claude/agents/`, `.codex/`, `AGENTS.md`) decidir si van o no al repo.
- [ ] Push de `main` (~120 commits) a `fbermani/estured-claude`. **Lo hace el dueño**, con las env vars ya cargadas (2.2).
- Éxito: deploy "Ready" en Vercel; `/`, `/search` y `/login` cargan; sin widget de sesión simulada.

### 3.3 Después del deploy
- [ ] `0043b_drop_residence_sensitive_columns.sql` **inmediatamente** (Ruta A y B).
- [ ] Revisar de nuevo `/search` y una ficha `/residencias/[slug]` (si hay residencias) para confirmar que cargan tras el drop. Éxito: sin errores 500, logs de Vercel limpios.

---

## 4. Post-deploy

- [ ] **Crear el admin real** con credenciales de prod solo en esa invocación (contraseña de 12+ caracteres):
  `NEXT_PUBLIC_SUPABASE_URL=<prod> SUPABASE_SERVICE_ROLE_KEY=<prod> node scripts/create-admin.mjs <email> <password>`
  Éxito: login en `/login` y acceso a `/admin/dashboard`.
- [ ] **Superadmin:** `/admin/payment-settings` solo es editable con rol `superadmin`. `create-admin.mjs` asigna `admin`; verificar en `user_roles` si el rol `superadmin` se otorga aparte (no lo confirmé) y, si no, agregarlo por SQL para ese usuario.
- [ ] **Datos de cobro:** cargar en `/admin/payment-settings` (titular, CBU/alias, CUIT, banco). Éxito: un estudiante en el paso del fee ve los datos (el CBU queda enmascarado en el resumen para no superadmin).
- [ ] **Coordenadas:** por cada residencia, `/admin/residences/[id]` → ubicación (lat/lng exactas). Sin coordenada la ficha cae al centro del barrio.
- [ ] **Exposición con anon key:** `node --env-file=<archivo con URL y anon key de prod> scripts/check-anon-exposure.mjs --allow-production`. Es de solo lectura. Éxito: exit 0 (columnas sensibles no legibles, tablas privadas sin filas, catálogo público sí legible). No usar `.env.local` (apunta a dev).
- [ ] **Cron:** `select jobid, jobname, schedule, active from cron.job where jobname = 'expire-stale-records-hourly';` → 1 fila `active = true`. Prueba manual del endpoint (desde afuera, no es un comando contra la base): `GET https://<dominio>/api/cron/expire-stale-records` sin header → 401/403; con `Authorization: Bearer <CRON_SECRET>` → 200. Después de la primera hora: `select status, return_message from cron.job_run_details order by start_time desc limit 3;` y `select status_code from net._http_response order by created desc limit 3;` → 200.
- [ ] **Tipo de cambio:** `/admin/exchange-rate` muestra un valor del día (monedapi.ar, dólar blue venta) y no el último de respaldo; si falla, cargar un override manual.
- [ ] **Smoke tests manuales por rol** (con cuentas reales de prueba creadas por el flujo de registro, no seeds):
  - Visitante: home, `/search`, ficha de residencia, `/for-students`, `/for-residences`, `/terms`, `/privacy`, `/verify/<código inválido>` (404 limpio).
  - Estudiante: registro en dos pasos, login, completar perfil, solicitar en una residencia, lista de espera, "Quiero cambiar".
  - Familiar: invitar/vincular, aprobar el vínculo desde el estudiante, ver solicitudes **solo** con vínculo activo (verifica 0046); con vínculo pendiente no ve datos del estudiante.
  - Residencia: registro/onboarding, panel, responder solicitud, responder FAQ.
  - Admin: verificar una residencia, `/admin/support-cases`, `/admin/exchange-rate`, `/admin/payment-settings`.
  - Flujo completo mínimo: solicitud → aprobación → pago del fee con datos de cobro → comprobante PDF → mail recibido.
  - Reset de contraseña de punta a punta.
- [ ] **Cuentas de prueba:** borrarlas o marcarlas antes de abrir al público.

---

## 5. Rollback por paso

| Paso | Rollback |
|---|---|
| Backup | n/a |
| Env vars de Vercel | restaurar el valor anterior y redeploy (las `NEXT_PUBLIC_*` requieren rebuild) |
| Buckets (`setup-storage`) | borrar los buckets vacíos desde Dashboard |
| 0036 | (a) sin rollback de datos (CUIT/IVA/email siguen en `estured_fee_payments`/`users`); (b) recrear la función con el cuerpo de la 0003 |
| 0037 | recrear las policies de la 0002 (no recomendado: reabre el hallazgo); los datos de visibilidad quedan en `audit_logs.old_value` |
| 0038, 0039 | `drop table` (0039 además `drop type public.residence_faq_question_status`); 0038 pierde la config de cobro cargada |
| 0040 | volver `residence_id`/`terms_reminder_accepted_at` a NOT NULL solo si no hay casos `estured_fee_payment`; ver encabezado |
| 0041 | `alter table residences drop column reservation_initial_payment_usd, drop column reservation_initial_payment_mode;` y volver el CHECK de 0028 |
| 0042 | `alter table residences drop column latitude, drop column longitude;` |
| 0043 | borrar `residence_private_details` solo si 0043b **no** se aplicó; si ya se aplicó, restaurar desde backup |
| 0043b | recrear columnas (tipos en 0003/0030/0031), copiar desde `residence_private_details`, `grant select on public.profile_availability to anon, authenticated;` |
| 0044, 0045 | ver el REVERTIR de cada encabezado (0045: `grant select on public.family_members to authenticated;` + drop columnas) |
| 0046 | volver a las definiciones de la 0006 (reabre la fuga: no recomendado) |
| 0013 | `select cron.unschedule('expire-stale-records-hourly');` |
| Deploy | Vercel → Deployments → Promote/Instant Rollback al deploy anterior. Ojo: el código viejo **no** funciona con 0043b aplicada; si hay que volver atrás después de la 0043b, hay que revertir esa migración también |
| Admin / datos de cobro | borrar el usuario desde Dashboard → Authentication; el cobro se edita desde `/admin/payment-settings` |
| Ruta B | B1: apuntar Vercel de vuelta al proyecto anterior (intacto). B2: restaurar desde el backup de 2.1 |

---

## 6. Pendientes de lanzamiento (no bloquean la beta técnica; sí el lanzamiento público)

- [ ] **Asesoría legal** de `/terms` y `/privacy` (hoy son borradores; ver `docs/10`, `docs/20`, `docs/21`). Ley 25.326 de datos personales: registro de bases de datos ante la AAIP si corresponde (a confirmar con el asesor).
- [ ] **Razón social / CUIT de EstuRed** en términos, footer, comprobantes y datos de cobro.
- [ ] **Facturación fiscal real** (hoy el fee se cobra por transferencia manual y la factura fiscal es una entidad aparte, sin integración): definir quién factura y cómo (`docs/00` §14.3).
- [ ] **Proveedor de teselas con clave** en lugar de `tile.openstreetmap.org` (2.6).
- [ ] **Remitente de email** con dominio propio (2.5) y SMTP de Auth.
- [ ] **Reglamento modelo y FAQ sugeridas** (`docs/IDEAS_DEL_DUENO_2026-10-23.md` §3 en adelante): son ideas pendientes de diseño, no reglas vigentes.
- [ ] **`/waitlist`**: decidir si sigue publicada tras el lanzamiento (H30).
- [ ] **Monitoreo:** alertas de errores (Vercel logs/Sentry), revisión periódica de `cron.job_run_details`, backups programados de Supabase (según plan).
- [ ] **Actualizar docs tras el lanzamiento:** `MEMORY.md`, `docs/NEXT_STEPS.md`, y el conteo de migraciones de `CLAUDE.md` ("Hoy: 0001–0036" ya está desactualizado: el repo llega a 0055).
