# EstuRed — Runbook de salida a producción

**Reescrito el 2026-11-13.** Ruta: **proyecto Supabase nuevo y limpio (B1)** + **dominio `estured.com` (comprado en Hostinger)** + Vercel. Lo que había de la ruta anterior (conservar `estured-prod` y aplicar 0036–0055 una por una) se borró de este archivo; queda en el historial de git.

Cómo se usa: cada paso dice **quién lo hace**: **[Vos]** (dashboards, cuentas, claves: yo no tengo ni debo tener acceso) o **[Yo]** (código y repo). Se avanza en orden y se tilda. Ningún paso se ejecuta solo, y **nada de esto se hizo todavía**. Regla: este runbook se actualiza cada vez que un cambio agrega un paso o una variable.

Estado del código (2026-11-13): rama `hardening/pre-produccion-2026-11`, migraciones **0001–0087 (+0043b)** (88 archivos; la 0087 es DR48, registro de aperturas de documentos por residencias), auditoría de seguridad final sin críticos ni altos (`docs/audits/PLAN_SEGURIDAD_2026-11-12.md`). `origin/main` (`fbermani/estured-claude`) está ~200 commits atrás y **deploya solo a Vercel al hacer push**.

---

## A. Decisiones previas (contestar antes de empezar)

- [x] **A1. Lanzamiento en modo preapertura — decidido 2026-11-13: `PREAPERTURA=on` en producción.** Con `PREAPERTURA=on` en producción el sitio abierto queda cerrado (`/` y `/for-students` muestran el popup de preapertura; `/search`, `/register`, `/waitlist` y `/students/*` redirigen). Login, `/admin`, `/for-residences`, `/guias`, `/fundadoras` y `/register/residence` siguen. **Recomendado: salir así** y abrir el sitio completo después (ver sección G). Si se quiere abrir todo ya, dejar la variable vacía, pero entonces hay que cerrar antes los requisitos de la sección G (verificación de email, etc.).
- [x] **A2. Planes — decidido 2026-11-14: empezar en Free (Supabase y Vercel Hobby).** Consecuencias aceptadas, a revisar **antes de abrir el sitio completo o cobrar fees** (pasar a Supabase Pro y Vercel Pro):
  - Supabase Free **no tiene backups propios**: hasta pasar a Pro, hacer un `pg_dump` manual periódico (Dashboard → Connect → connection string; guardar fuera del repo) y antes de cada migración grande.
  - Supabase Free **pausa el proyecto tras ~7 días sin actividad**: el cron horario de la 0013 genera tráfico a la base, pero hay que confirmar tras la primera semana que no se pausó (si pasa, *Restore* desde el dashboard y subir a Pro).
  - **"Leaked password protection" no existe en Free**: la única defensa es el mínimo de contraseña de la app (queda pendiente en la sección I).
  - Vercel Hobby es solo uso no comercial: válido para la preapertura (no se cobra nada); **hay que pasar a Pro antes de cobrar el primer fee**.
- [ ] **A3. Titularidad de las cuentas (organizaciones, no cuentas nuevas).** Mejor ahora, que prod no existe y mover es gratis: *Organization* de GitHub (transferir el repo conserva historial y la conexión con Vercel), *Organization* de Supabase (crear `estured-prod` directamente ahí) y *Team* de Vercel. Dominio: Hostinger con 2FA, auto-renovación y un segundo mail de recuperación (quien controla el dominio controla todos los resets de contraseña). Si el repo se transfiere, cambia el remoto `origin`.
- [ ] **A4. Casilla `hola@estured.com`.** El código la usa como contacto (`lib/constants/contact.ts`) y como `replyTo` de los mails. Tiene que existir y alguien tiene que leerla. En Hostinger: hPanel → Dominio → Correo electrónico (reenvío o buzón; revisar qué incluye tu plan). Si el buzón de Hostinger usa MX propios, **no** toques los MX al configurar Resend (Resend usa registros en un subdominio, ver C3).
- [ ] **A5. Fecha de cierre de fundadoras** (`FOUNDERS_CLOSE_AT`, ISO 8601). Opcional: sin la variable no hay cuenta regresiva.

---

## A0. Orden de trabajo (decidido 2026-11-13)

1. **Liberar el lugar en Supabase** dando de baja el `estured-prod` viejo (paso A0.1).
2. **Staging primero** (A0.2): ensayo general del deploy en Vercel contra `estured-dev`, con `staging.estured.com`. Local sigue igual (`npm run dev`, selector «Simular usuario», `.env.local` → `estured-dev`).
3. Recién después, producción (secciones B a G).

### A0.1 Baja del Supabase prod viejo [Vos]
Es **irreversible**: se pierde la base, Auth y Storage de ese proyecto. Estado conocido: sin usuarios reales, solo residuo demo/tests. Antes de borrar:
- [ ] Entrar a Supabase con la **cuenta de producción** (no la de `estured-dev`) y confirmar en la URL que el ref es `mrwooskdcnkbitkhcvbf`.
- [ ] Confirmar que no hay datos reales: SQL Editor → `select count(*) from auth.users;` y `select count(*) from residences;` (esperado: usuarios demo/test y residencias de prueba). Si hay algo que valga, `Database → Backups` o `pg_dump` antes.
- [ ] Anotar lo que se quiera conservar de Settings (nada que el repo no tenga: las migraciones y los scripts reconstruyen todo).
- [ ] Project Settings → General → *Delete project* (o *Pause* si querés conservar un rollback; ojo: confirmar si un proyecto pausado sigue ocupando el lugar del plan Free).
- [ ] Vercel: desde este momento `estured.vercel.app` (apuntando a esa base) deja de funcionar. Está bien: se reemplaza con el deploy nuevo. No hay usuarios reales.
- [ ] **[Yo]** una vez borrado, dejo el ref viejo en `scripts/production-refs.json` (no molesta: sigue bloqueando seeds/tests contra él) y agrego el ref nuevo en C2.

### A0.2 Staging en Vercel contra `estured-dev` (ensayo) — HECHO 2026-11-14
Deploy de la rama `staging` en *Ready* y login real verificado con Turnstile; la URL pide login de Vercel. Pendiente menor: Redirect URL de reset de contraseña en Supabase dev (no había acceso a esa cuenta).
Objetivo: probar el deploy real (build, variables, Turnstile, headers) sin tocar producción, y tener un lugar fuera de localhost para probar cada cambio. **No usa `estured.com` ni Hostinger**: el dominio propio es solo de producción.
- **Proyecto de Vercel: se reutiliza `estured-claude`** (cuenta personal `fbermani-gmailcoms-projects`, repo `fbermani/estured-claude`, dominio `estured.vercel.app`). Estaba limpio: 4 variables y 3 deploys viejos de `main`. Se transfiere a un Team más adelante si se decide (A3).
- **Variables separadas por entorno:** *Production* = Supabase nuevo (las 4 viejas quedaron solo en Production, pendientes de reemplazar); *Preview* = `estured-dev`. Ningún preview toca producción. Hecho el 2026-11-14.
- **Rama `staging`** (creada local; el push lo hace el dueño: `git push -u origin staging`). Su URL es `https://estured.vercel.app` (dominio reasignado de Production a la rama `staging` el 2026-11-14; producción irá en `estured.com`).
- **Protección:** el proyecto tiene *Vercel Authentication* con alcance `all_except_custom_domains`: las URLs `*.vercel.app` piden login de Vercel (por eso el staging usa `estured.vercel.app` y **no** un subdominio de `estured.com`, que quedaría público con la base de dev y sus usuarios demo). El selector «Simular usuario» **sí** va en el staging (decisión del dueño, 2026-11-14), pero solo como variables de *Preview* **acotadas a la rama `staging`** (`DEMO_LOGIN_ENABLED`, `DEMO_USERS_PASSWORD` sensitive, `NEXT_PUBLIC_STAGING=on`, `PREAPERTURA=on`) y detrás del login de Vercel; `isDemoLoginEnabled()` y `isDevUi()` (`lib/dev/devUi.ts`) las ignoran si `VERCEL_ENV=production`. **Nunca** en Production. Verificar en incógnito que la URL pide login.
- **Turnstile propio:** Vercel compila con `NODE_ENV=production`, así que la guarda S3 rechaza las claves de prueba (`1x…`). Widget `EstuRed staging` en Cloudflare con el hostname de la URL de la rama (sin `https://`); sus claves van solo a *Preview* (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`; la secret conviene crearla como *Sensitive*).
- **Variables de Preview cargadas:** claves de `estured-dev`, `NEXT_PUBLIC_APP_URL` y `NEXT_PUBLIC_SITE_URL` = URL de la rama, `NEXT_PUBLIC_APP_NAME`, Turnstile. Sin `PREAPERTURA` (se prueba el sitio completo), sin `RESEND_API_KEY` (mails solo si se quiere probar con el sandbox de Resend, que entrega solo al dueño de la cuenta), sin `CRON_SECRET` (el cron de dev no se aplica).
- **Supabase dev → Auth → URL Configuration → Redirect URLs:** agregar `https://estured.vercel.app/reset-password`.
- **Verificación:** deploy *Ready*; la URL pide login de Vercel y luego carga; el widget de Turnstile aparece y un login real funciona; `curl -sI` (con el bypass o ya logueado) muestra CSP Report-Only con `report-uri` y HSTS; sin widget de sesión simulada.
- Costo: ninguno (Hobby alcanza para ensayar; ver A2 para producción).

---

## B. Preparar el código [Yo]

- [x] Cron de la 0013: el placeholder de host ahora es completo (`REEMPLAZAR-CON-TU-DOMINIO`, sin sufijo `.vercel.app`) y `node scripts/build-bootstrap.mjs prod --host=estured.com` lo reemplaza (2026-11-13).
- [x] `NEXT_PUBLIC_SITE_URL` por defecto = `https://estured.com` (`lib/siteUrl.ts`, `lib/arrival/reminderCopy.ts`); antes caía a `estured.vercel.app` (sitemap, canonical, links de mails).
- [x] `scripts/create-admin.mjs` acepta `--superadmin` (antes solo creaba `admin` y `/admin/payment-settings` exige `superadmin`).
- [x] Remitente de mails: ya sale de `EMAIL_FROM` (el cambio de código que figuraba como pendiente no hace falta; solo la variable).
- [ ] Antes del push final: `npm run typecheck && npm run lint && npm run build` en verde, con el dev server parado (si hubo cambios de componentes, `rm -rf .next` antes).
- [ ] Merge de `hardening/pre-produccion-2026-11` a `main` **solo cuando la sección E (variables de Vercel) esté hecha**.

---

## C. Cuentas externas y dominio [Vos, yo te guío]

### C1. Cloudflare Turnstile (CAPTCHA)
- [ ] Cuenta gratuita de Cloudflare → Turnstile → *Add widget*: nombre `EstuRed prod`, dominios `estured.com` (y `www.estured.com`), modo *Managed*.
- [ ] Guardar **Site key** y **Secret key**. Son claves **reales**: las de prueba (`1x…`) rechazan todo en prod (guarda S3 del código).
- No hace falta mover el DNS del dominio a Cloudflare.

### C2. Supabase (proyecto nuevo)
- [ ] Dashboard → Organization (ver A3) → *New project*: nombre `estured-prod`, región cercana a Argentina (`South America (São Paulo)`), contraseña de base fuerte (guardarla en el gestor de contraseñas).
- [ ] Anotar el **ref** (el subdominio de la URL), la **URL**, la **anon key** y la **service role key** (Project Settings → API; la service role es secreta).
- [ ] Yo agrego el ref a `scripts/production-refs.json` (así tests y seeds se niegan a correr contra él).

### C3. Resend (mails) y DNS en Hostinger
- [ ] Cuenta de Resend → Domains → *Add domain* `estured.com` (región `sa-east-1` si está) → te muestra registros DNS (SPF/DKIM/MX de retorno bajo `send.`).
- [ ] En Hostinger: hPanel → Dominios → `estured.com` → DNS / Nameservers → *DNS zone* → agregar esos registros **tal cual los muestra Resend** (TXT/CNAME/MX). Esperar a que Resend marque *Verified* (minutos a horas).
- [ ] Crear una **API key** de Resend con permiso *Sending access* solo para ese dominio.
- Cuidado: si Hostinger tiene registros viejos de "parking" (A/AAAA o CNAME de `@` o `www`), se borran en el paso F1, no acá.

### C4. Vercel
- [ ] Team (ver A3) → proyecto de EstuRed conectado al repo de GitHub, *Production Branch* = `main`. Si ya existe el proyecto viejo `estured` apuntando a `estured-prod` viejo, usarlo pero **cambiar todas las variables** (sección E) antes del primer deploy.

---

## D. Base de datos y Storage (Supabase nuevo)

### D1. Bootstrap con las 87 migraciones [Vos con mi ayuda]
Genera el SQL completo (0001–0087 + 0043b; la 0087 crea `residence_document_access_log`, sin pasos extra), con el cron de la 0013 ya apuntando a `https://estured.com`. El secreto del cron se guarda en **Supabase Vault** (no queda en texto plano en `cron.job`).

- [ ] **Migraciones 0088, 0089 y 0090 entran en el bootstrap** (el script toma todos los `db/migrations/*.sql`; verificar que aparezcan al final). La **0089** (SEG15-01) crea el índice único `reservations_one_per_application_uidx`: en una base ya poblada correr antes `select application_request_id, count(*) from reservations where application_request_id is not null group by 1 having count(*) > 1;` (debe dar 0 filas). En un bootstrap desde cero no hay datos y no hace falta. La **0090** (SEG15-04) revoca los permisos de escritura de `anon` y `authenticated`: no toca datos; después correr `select grantee, privilege_type, count(distinct table_name) from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') group by 1,2;` (solo debe quedar SELECT).
- [ ] **Migraciones 0091 y 0092 entran en el bootstrap** (auditoría 2026-11-16, aplicadas en dev). La **0091** agrega CHECK de largo (≤2000/1000) a los textos libres de solicitudes, negociación y propuestas del familiar; en base poblada verificar antes que ningún texto lo supere. La **0092** quita SELECT a `anon` en todo lo que no sea catálogo público (10 tablas); después correr `select c.relname from pg_class c where c.relnamespace='public'::regnamespace and c.relkind in ('r','p') and has_any_column_privilege('anon', c.oid, 'SELECT') order by 1;` (deben salir solo: exchange_rates, profile_availability, profile_availability_genders, residence_custom_amenities, residence_faq_items, residence_faq_predefined_questions, residence_profile_sections, residence_regulation_versions, residences, room_types). Una tabla nueva que anon deba leer necesita `grant select` explícito.
- [ ] Generar el secreto y la copia lista para pegar, **fuera del repo** (un solo bloque; deja el secreto en el portapapeles para Vercel y no lo muestra):
  ```bash
  cd "/Users/fabriciobermani/Desktop/EstuRed Claude" && node scripts/build-bootstrap.mjs prod --host=estured.com && S=$(openssl rand -hex 32) && sed "s/REEMPLAZAR-CON-TU-CRON-SECRET/$S/g" db/_generated/prod_bootstrap.sql > ~/Desktop/prod_bootstrap_LISTO.sql && printf %s "$S" | pbcopy && echo "Listo: ~/Desktop/prod_bootstrap_LISTO.sql (secreto en el portapapeles)"
  ```
- [ ] **Guardar el secreto ya** (gestor de contraseñas): es el valor de `CRON_SECRET` de Vercel (sección E) y el portapapeles se pisa fácil.
- [ ] SQL Editor del proyecto **nuevo** (confirmar el ref en la URL) → pegar el contenido de `~/Desktop/prod_bootstrap_LISTO.sql` (`cat` + `pbcopy`) → Run. Si falla a mitad, **no** reintentar encima: avisarme el error.
- [ ] Verificación: `select to_regclass('public.residence_private_details'), to_regclass('public.rate_limit_hits'), to_regclass('public.preapertura_estudiantes');` (todas no nulas) y `select jobname, active from cron.job;` → `expire-stale-records-hourly | true`.
- [ ] **Borrar `~/Desktop/prod_bootstrap_LISTO.sql`** (tiene el secreto).

### D2. Buckets de Storage [Vos con mi ayuda]
- [ ] Con las credenciales del proyecto **nuevo** solo en esa invocación (sin tocar `.env.local`):
  ```bash
  NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service role> node scripts/setup-storage.mjs
  ```
- [ ] Éxito: 5 buckets (`public-residence-media`, `private-residence-documents`, `payment-proofs`, `support-evidence`, `student-documents`); solo el primero es *Public*. **No agregar policies de Storage** (el acceso privado es por service role).

### D3. Supabase Auth [Vos]
- [ ] Authentication → URL Configuration: **Site URL** `https://estured.com`; **Redirect URLs**: `https://estured.com/reset-password` y `https://www.estured.com/reset-password`.
- [ ] Authentication → Sign In / Providers → **"Allow new users to sign up": apagado** → *Save* (confirmar el ref). Todas las altas usan `auth.admin.createUser` desde el servidor. Verificación: `curl -s https://<ref>.supabase.co/auth/v1/settings -H "apikey: <anon key>"` → `"disable_signup": true`.
- [ ] Authentication → SMTP Settings: SMTP propio con Resend (`smtp.resend.com`, puerto `465`, usuario `resend`, contraseña = API key de C3, remitente `no-reply@estured.com`). El SMTP por defecto de Supabase tiene un límite muy bajo.
- [ ] Authentication → Email Templates: revisar que el de *Reset Password* esté en español.
- [ ] **"Leaked password protection"**: activar (solo plan Pro; ver A2).
- [ ] **CAPTCHA nativo de Supabase: apagado** (el CAPTCHA va en nuestras server actions; activarlo rompe los logins automáticos tras el registro).
- [ ] JWT: dejar el default (1 h).

---

## E. Variables de entorno de Vercel [Vos]

Vercel → Settings → Environment Variables, entorno **Production** (y Preview solo si se usa; Preview **no** debe apuntar a prod sin pensarlo). Las `NEXT_PUBLIC_*` se incrustan en el build: cambiarlas exige redeploy.

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto nuevo |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key del proyecto nuevo |
| `SUPABASE_SERVICE_ROLE_KEY` | service role del proyecto nuevo (marcar *Sensitive*) |
| `NEXT_PUBLIC_APP_URL` | `https://estured.com` (obligatoria: `getAppUrl` lanza en prod si falta) |
| `NEXT_PUBLIC_SITE_URL` | `https://estured.com` (sitemap, canonical, links de mails de avisos) |
| `CRON_SECRET` | el mismo valor guardado en D1 (*Sensitive*) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | site key real (C1) |
| `TURNSTILE_SECRET_KEY` | secret real (C1, *Sensitive*). Sin ella, prod rechaza todos los envíos con CAPTCHA |
| `RESEND_API_KEY` | API key de C3 (*Sensitive*) |
| `EMAIL_FROM` | `no-reply@estured.com` (solo la dirección; dominio verificado en Resend) |
| `EMAIL_DOMAIN_VERIFIED` | `true` **solo** cuando Resend marque el dominio *Verified* (habilita los avisos de llegada y el mail del familiar) |
| `PREAPERTURA` | `on` si se sale en preapertura (A1) |
| `FOUNDERS_CLOSE_AT` | opcional (A5) |

- [ ] **`DEMO_LOGIN_ENABLED`, `DEMO_USERS_PASSWORD` y `NEXT_PUBLIC_STAGING` NO existen en Production** (solo en Preview de la rama `staging`, ver A0.2). Verificar con el MCP/dashboard que ninguna tenga `production` entre sus entornos.
- [ ] Cargadas todas **antes** del primer deploy a prod.

---

## F. Deploy y dominio

### F1. Dominio `estured.com` en Vercel [Vos]
- [ ] Vercel → proyecto → Settings → Domains → agregar `estured.com` y `www.estured.com` (www redirige al apex). Vercel muestra los registros exactos.
- [ ] Hostinger → DNS zone: **borrar** los registros A/AAAA/CNAME de `@` y `www` que haya por defecto (parking) y crear los que indica Vercel (normalmente `A @ 76.76.21.21` y `CNAME www cname.vercel-dns.com`; **usar los valores que muestre Vercel**). No tocar los registros de Resend ni los MX del correo.
- [ ] Esperar a que Vercel ponga ambos dominios en verde (HTTPS automático; propagación de minutos a horas).

### F2. Push y deploy [Vos con mi ayuda]
- [ ] Sección B completa (typecheck/lint/build) y sección E completa.
- [ ] Yo hago el merge a `main` y te digo el comando; el push a `origin/main` lo hacés vos (dispara el deploy).
- [ ] Éxito: deploy *Ready*; `https://estured.com/` carga (popup de preapertura si A1 = on), `/login` carga, **sin** widget de "Simular usuario" en la esquina.

---

## G. Post-deploy

- [ ] **Crear el admin real y el superadmin** (contraseñas de 12+ caracteres; credenciales del proyecto nuevo solo en esa invocación):
  ```bash
  NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service role> node scripts/create-admin.mjs <tu-email> <contraseña> --superadmin
  ```
  Éxito: login en `/login` y acceso a `/admin/dashboard`. Un `--superadmin` también puede hacer todo lo del admin; crear un `admin` común aparte solo si lo necesitás.
- [ ] **Datos de cobro:** `/admin/payment-settings` (titular, CBU/alias, CUIT, banco).
- [ ] **Exposición con anon key** (solo lectura): crear un archivo fuera del repo con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` de prod y correr `node --env-file=<ese archivo> scripts/check-anon-exposure.mjs --allow-production` → exit 0. No usar `.env.local` (apunta a dev).
- [ ] **Advisors de Supabase** (Dashboard → Advisors → Security): solo los esperados (tablas con RLS y sin policies a propósito, helpers `SECURITY DEFINER` de RLS, `pg_net` en `public`; `auth_leaked_password_protection` hasta pasar a Pro).
- [ ] **Cron:** `GET https://estured.com/api/cron/expire-stale-records` sin header → 401/403; con `Authorization: Bearer <CRON_SECRET>` → 200. Pasada la primera hora: `select status, return_message from cron.job_run_details order by start_time desc limit 3;` y `select status_code from net._http_response order by created desc limit 3;` → 200.
- [ ] **Tipo de cambio:** `/admin/exchange-rate` muestra un valor del día (monedapi.ar); si falla, cargar override manual.
- [ ] **CAPTCHA y límites:** el widget aparece y funciona en `/login` y `/forgot-password`; con el widget sin resolver el envío se rechaza; una ráfaga de logins fallidos devuelve «Hiciste muchos intentos». El alta de residencias (`/register/residence`) también pide CAPTCHA.
- [ ] **Cookies y headers** (DevTools o `curl -sI https://estured.com`): cookies `sb-*` HttpOnly y Secure; `Content-Security-Policy-Report-Only` (con `report-uri /api/csp-report`), `Strict-Transport-Security`, `Permissions-Policy`; sin `X-Powered-By`.
- [ ] **Reset de contraseña de punta a punta** (llega el mail desde `no-reply@estured.com` y el link abre `/reset-password` en `estured.com`).
- [ ] **Mails:** una solicitud de fundadora de prueba (`/register/residence`) manda el mail de confirmación a una casilla externa (revisar spam; si cae en spam, revisar SPF/DKIM en Resend).
- [ ] **Smoke test por rol** con cuentas reales de prueba creadas por el flujo (no seeds): visitante (`/`, `/for-residences`, `/guias`, `/terms`, `/privacy`, `/verify/<inválido>` = 404 limpio); preregistro estudiante y familiar; residencia (solicitud de alta → cola de admin → invitación); admin (verificar una residencia, `/admin/support-cases`). Si se abrió el sitio completo (A1 = vacío): solicitud → aprobación → pago del fee → comprobante PDF → mail.
- [ ] **Residencias reales:** coordenadas exactas por residencia en `/admin/residences/[id]` (sin ellas la ficha cae al centro del barrio). El seed del CRM (`scripts/seed-crm-residencias.mjs`) necesita `scripts/data/crm-residencias/` en la máquina que lo corre (no viaja con el repo) y la guarda `_assert-dev-project.mjs`: no corre contra prod; la carga a prod es por el flujo normal o un script específico.
- [ ] **Cuentas de prueba:** borrarlas antes de abrir al público.
- [ ] **Monitoreo:** mirar los logs de Vercel por líneas `[csp-report]` (violaciones de CSP) y `[rate-limit]` / `[turnstile]` (errores de configuración).
- [ ] **Auditoría final de seguridad con la skill `security-audit` (modo auditoría completa, no guía):** antes de abrir al público, sobre el código desplegado y las policies de prod. Consume muchos tokens: correrla con aprobación explícita, en una sesión propia. Resultado en `docs/audits/` y hallazgos críticos o altos resueltos antes de cerrar. [Yo con vos].
- [ ] **Actualizar docs:** `MEMORY.md`, `docs/NEXT_STEPS.md`, `docs/audits/PLAN_SEGURIDAD_2026-11-12.md`, `CLAUDE.md` (migraciones y dominio) [Yo].

---

## H. Rollback por paso

| Paso | Rollback |
|---|---|
| Proyecto Supabase nuevo | borrarlo desde Dashboard (no tiene datos aún); el `estured-prod` viejo se da de baja en A0.1 (sin rollback a la base anterior: no había datos reales) |
| Bootstrap (D1) | no es re-ejecutable: vaciar el proyecto (borrar y recrearlo es lo más limpio) |
| Buckets | borrar los buckets vacíos desde Dashboard |
| Variables de Vercel | restaurar el valor anterior y redeploy (las `NEXT_PUBLIC_*` requieren rebuild) |
| Dominio | quitarlo de Vercel y volver los registros de Hostinger; el sitio sigue en `*.vercel.app` |
| Deploy | Vercel → Deployments → *Instant Rollback* al deploy anterior (la base nueva es compatible hacia adelante, no hacia atrás) |
| Cron | `select cron.unschedule('expire-stale-records-hourly');` |
| Admin / datos de cobro | borrar el usuario desde Authentication; el cobro se edita desde `/admin/payment-settings` |

---

## I. Pendientes para abrir el sitio completo (no bloquean la preapertura; sí el lanzamiento público)

- [ ] **Verificación de email (decidido 2026-11-12, opción C):** durante la preapertura las cuentas se crean con `email_confirm: true` (riesgo aceptado: mitigado por Turnstile + rate limit). **Requisito para abrir:** link de verificación a cuentas existentes y nuevas, y exigir email verificado antes de crear solicitudes, pagar o contactar residencias. Necesita el SMTP propio de D3.
- [ ] **Apagar `PREAPERTURA`** (y redeploy) para abrir `/search`, `/register`, etc.
- [ ] **Asesoría legal** de `/terms` y `/privacy` (borradores; Ley 25.326, registro de bases ante la AAIP si corresponde).
- [ ] **Razón social / CUIT** en términos, footer, comprobantes y datos de cobro.
- [ ] **Facturación fiscal real** (hoy el fee es por transferencia manual; `docs/00` §14.3).
- [ ] **Proveedor de teselas con clave** en vez de `tile.openstreetmap.org` (cambio de código + variable; la política de OSM no es apta para tráfico masivo).
- [ ] **CSP a enforce** tras unas semanas sin violaciones legítimas en los logs (`[csp-report]`): cambiar el header en `next.config.ts` y retirar `app/api/csp-report` (M5/S2).
- [ ] **S4** (login no atómico): aceptado; revisar si aparece abuso.
- [ ] **Aviso «Ya hay una cuenta con ese email»** en `/preregistro` (revela qué emails existen; aceptado por el alta con autologin).
- [ ] **Google SSO (DR26):** fuera del MVP; si se decide, el switch de altas de D3 tiene que volver a encenderse y cerrar el alta por email de otra forma.
- [ ] **Pasar a Supabase Pro y Vercel Pro (A2)** antes de abrir/cobrar. **Monitoreo y backups:** alertas de errores (Vercel logs/Sentry), revisión de `cron.job_run_details`, backups de Supabase (según plan).
- [ ] **WAF de Vercel** como segunda capa opcional sobre las rutas públicas.
