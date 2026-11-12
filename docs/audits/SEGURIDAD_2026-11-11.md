# Auditoría de seguridad pre-producción — 2026-11-11

Rama: `hardening/pre-produccion-2026-11`. Alcance: código del repo, 81 migraciones (`0001`–`0080` + `0043b`), dependencias npm y configuración de Next/Vercel. **Solo lectura**: no se corrigió código, no se aplicaron migraciones y no se tocó `estured-prod`. Ningún valor de `.env` se imprimió.

Método: 6 etapas (inventario → secretos/config → autenticación/autorización → base de datos/RLS → dependencias → entrada no confiable), con el agente `seguridad` y las skills `owasp-security` y `next.js-security-scan` (`secret-scanner.py`, `dependency-audit.sh`; `pattern-scanner.py` en etapa 2).

Convención: **confirmado** = verificado en código/SQL o ejecutando la función; **posible** = falta verificar en runtime, en el dashboard de Supabase o en Vercel.

---

## Resumen

| Severidad | Cantidad | Bloquea salida a producción |
|---|---|---|
| Crítico | 1 | Sí |
| Alto | 2 | Sí |
| Medio | 7 | Recomendado antes de abrir registros |
| Bajo | 15 | No; backlog de hardening |
| Info | 6 | No |

Estado general: la base es sólida. Las 80 server actions validan sesión y rol por sí mismas (las únicas sin sesión son públicas a propósito), no se encontró IDOR, el aislamiento entre residencias toma el `residence_id` de la fila y no del cliente, las 69 tablas tienen RLS, no hay vistas que salteen RLS, las funciones `SECURITY DEFINER` fijan `search_path`, no hay secretos en el repo ni en su historial, el service role no llega al cliente, todos los uploads (salvo uno) validan el contenido real, y no hay SSRF ni XSS explotables. Los problemas están en: una dependencia vulnerable, el acceso directo a la API de Supabase (usuarios bloqueados y columnas internas) y validaciones de borde.

---

## Crítico

### C1. Next.js 15.5.20 afectado por 14 advisories (RCE, DoS, SSRF) — confirmado
- **Dónde:** `package.json` (`next ^15.3.4`, instalado 15.5.20 en `package-lock.json`).
- **Evidencia:** `npm audit --omit=dev` marca `next` como crítico. Los rangos de los 14 GHSA llegan hasta `<15.5.21`, `<15.5.24`, `<15.5.27` y `<=15.5.27`, así que 15.5.20 está dentro de todos. No es un falso positivo por rango global. Críticos: RCE en Image Optimization con AVIF (GHSA-2xp9-vwfh-vxw4) y con SVG (GHSA-2464-fhr4-w9xw); RCE solo en Windows (GHSA-p293-qw3h-jr36, no aplica en Vercel). Altos: DoS en Server Actions (GHSA-m99w-x7hq-7vfj, GHSA-p3m5-59mp-jv5r), SSRF en rewrites (GHSA-p9j2-gv94-2wf4) y en Server Actions con custom server (GHSA-89xv-2m56-2m9x).
- **Alcanzabilidad:** `next/image` se usa en 14 archivos y el optimizador procesa imágenes del bucket público (`next.config.ts:67-73`). La app ya rechaza AVIF/SVG en las fotos (`lib/residences/imageSniff.ts:15-22`), lo que reduce la vía, pero no la elimina (archivos subidos por seeds o por fuera de la app, variantes no cubiertas). Los DoS de Server Actions son alcanzables sin sesión (hay acciones públicas). Hay `rewrites` en `next.config.ts:34`.
- **Explotación:** request anónimo a `/_next/image?url=…` con una imagen maliciosa alojada en el bucket público, o requests a server actions públicas para tumbar instancias.
- **Corrección:** `npm install next@^15.5.29 eslint-config-next@^15.5.29` (no rompe semver), luego `npm audit --omit=dev` debe dar 0 en `next`. Confirmar en el advisory que 15.5.28+ cierra los 14. Correr `typecheck` + `lint` + `build` y tests de lo tocado.
- **No aplica:** CVE-2025-29927 (bypass de middleware) está parchado (fix 15.2.3 < 15.5.20). CVE-2025-55182 (React2Shell) parchado según versiones (React 19.2.7, Next 15.5.20), a contrastar con el aviso oficial (ver Info).

---

## Alto

### A1. Un usuario bloqueado sigue leyendo (y en dos tablas escribiendo) por la API directa de Supabase — confirmado en código y SQL
- **Dónde:** `lib/users/setUserBlockedStatus.ts:60-64` solo hace `users.update({ is_blocked })`. No hay `ban_duration` ni cierre de sesiones (grep vacío de `auth.admin.signOut`/`updateUserById`). El bloqueo solo lo mira la app en `lib/auth/session.ts:49`. Ninguna de las 112 sentencias de policy consulta `users.is_blocked` ni `users.is_active`; las de residencia exigen `residence_users.is_active` (membresía, no estado de la persona). Ej.: `application_requests_select_residence` (`db/migrations/0007:126-132`).
- **Explotación:** el usuario bloqueado inicia sesión directo contra Supabase Auth con la anon key pública (o sigue usando su refresh token) y consulta PostgREST:
  ```
  curl "$SUPABASE_URL/rest/v1/application_requests?select=*,application_snapshots(*)" \
    -H "apikey: $ANON" -H "Authorization: Bearer $JWT"
  ```
  - Staff/owner bloqueado: lee solicitudes, reservas, `booking_receipts` (incluye `payer_billing_name`), `resident_stays` (`invite_email`, `invite_phone`), waitlist, soporte e intenciones de cambio de su residencia.
  - Familiar bloqueado: lee `birth_date`, `last_name`, `study_institution_private`, `is_minor` del menor vinculado (`0046:31-46`).
  - Estudiante bloqueado: sigue insertando en `stay_followup_responses` y `arrival_checklist_items`.
  - Storage no es alcanzable (sin policies en `storage.objects`).
- **Corrección propuesta:**
  1. En `setUserBlockedStatus`: `admin.auth.admin.updateUserById(id, { ban_duration: '876000h' })` al bloquear y `'none'` al desbloquear. Corta el refresh; el access token vigente dura hasta vencer (1 h por defecto: revisar en Auth).
  2. Defensa en profundidad con policies `RESTRICTIVE` (se combinan con AND, no reescriben las existentes):
  ```sql
  create or replace function public.is_active_user() returns boolean
    language sql stable security definer set search_path = ''
  as $$ select exists (select 1 from public.users u
                       where u.id = auth.uid() and u.is_active and not u.is_blocked) $$;
  revoke all on function public.is_active_user() from public, anon;
  grant execute on function public.is_active_user() to authenticated;
  -- por cada tabla con policy "to authenticated" (~45, incluida users):
  create policy <t>_only_active_users on public.<t> as restrictive for all to authenticated
    using ((select public.is_active_user())) with check ((select public.is_active_user()));
  ```

### A2. Notas internas de la residencia legibles por el estudiante y su familiar — confirmado en SQL
- **Dónde:**
  - `application_negotiation_proposals.internal_notes` (`0008:30`). La policy `0008:46-57` incluye a estudiante y familiar, sin restricción por columna. La UI lo rotula "Notas internas (privadas)" (`components/.../NegotiationForm.tsx:208`) y se guarda en `negotiation/actions.ts:111`.
  - `application_requests.rejection_reason_internal` (`0007:81`), escrito en `app/residence/[residence_id]/applications/actions.ts:311`; `docs/05:772` lo define como interno.
- **Explotación:** con el JWT del estudiante: `GET /rest/v1/application_negotiation_proposals?select=internal_notes` o `GET /rest/v1/application_requests?select=rejection_reason_internal`.
- **Corrección:**
  ```sql
  revoke select on public.application_negotiation_proposals from anon, authenticated;
  grant select (<todas las columnas menos internal_notes>) on public.application_negotiation_proposals to authenticated;
  -- ídem application_requests sin rejection_reason_internal
  ```
  Antes, confirmar que ninguna lectura con el cliente de sesión haga `select("*")` sobre estas tablas (hoy leen `application_requests` con sesión: `app/students/applications/[id]/page.tsx:59,125`, `app/students/applications/page.tsx:81`, `app/students/dashboard/page.tsx:528`). Alternativa: mover la nota a una tabla solo service role.

---

## Medio

### M1. Open redirect después del login: `safeInternalPath` se evade con `/.//evil.com` — confirmado ejecutando la función
- **Dónde:** `lib/auth/safeNext.ts:6-12`. Rechaza `//` y `\` en el string crudo, pero devuelve `url.pathname + search + hash` ya normalizado. `/.//evil.com`, `/a/..//evil.com`, `/%2e//evil.com` → `//evil.com`.
- **Consumidores:** `app/(public)/login/actions.ts:66-67`, `app/(public)/register/student/actions.ts:52,256,258`, `register/student/page.tsx:35`, `register/page.tsx`.
- **Explotación:** `https://estured.vercel.app/login?next=/.//evil.com` → la víctima inicia sesión de verdad y termina en un sitio externo (phishing con la marca real).
- **Corrección:** validar también la salida (rechazar si empieza con `//` o `/\`, o exigir `/^\/(?!\/)[^\\]*$/` sobre el resultado). Agregar a `safeNext.test.ts` los casos `/.//x`, `/a/..//x`, `/%2e//x`.
- **Pendiente:** confirmar en runtime el destino real de `redirect("//evil.com")` en server action.

### M2. Inyección de HTML en el mail de invitación a familiar — confirmado
- **Dónde:** `app/students/family-link-actions.ts:206-211`. `profile.first_name` va sin escapar en el `subject` y dos veces en el `html`. El destinatario lo elige el estudiante (`:157-160`, solo regex). `first_name` solo se valida por longitud ≤80 (`app/(public)/register/student/actions.ts:92`). Sin throttle en `inviteFamilyMember`.
- **Explotación:** registrarse con nombre `<a href=//evil.tk>Entrá acá</a>`, invitar a cualquier email, cancelar y repetir: relay de phishing desde el remitente de EstuRed vía Resend (reputación del dominio).
- **Corrección:** `escapeHtml(profile.first_name)` en el HTML, quitar `\r\n` del subject, throttle por usuario/día. Opcional: restringir el charset del nombre en el registro. Los demás templates ya escapan (`confirmationEmail.ts`, `teamCopy.ts`, `inviteMessage.ts`, `guardianConfirmation.ts:72`, `reminderCopy.ts:55-57`, `notifyResidenceTeam.ts:273`).

### M3. La base y la negociación aceptan montos ≤ 0 (fee 0 o negativo) — confirmado
- **Dónde:** `app/residence/[residence_id]/applications/[id]/negotiation/actions.ts:14-17` (`numOrNull = Number(raw)`) y `:69-77`. Sin CHECK en: `estured_fee_payments.fee_amount_ars`, `fee_base_*`, `fee_rate_percent` (`0010:115-119`); `application_snapshots` (`0007:36-52`); `application_negotiation_proposals.proposed_*` (`0008:17-28`); `external_residence_payments.amount_reported_*` (`0010:50-51`); `renewal_offers.fee_base_*`, `estimated_estured_fee_ars` (`0016:83-85`). `lib/applications/fee.ts:29-34` calcula el 5 % sin piso.
- **Explotación:** staff con `applications.send_adjustment` propone precio `-100`/`0.01` o duración negativa; si el estudiante acepta (`recordNegotiationResponse.ts:136-141`) el snapshot final y el fee quedan ≤ 0 y se insertan (`recordResidencePaymentReceived.ts:213`). Evasión del fee por colusión o error de carga.
- **Corrección:** en el server action, montos finitos > 0, meses enteros 1–24, topes y fecha ISO. En la base:
  ```sql
  alter table public.estured_fee_payments add constraint fee_amounts_positive
    check (fee_amount_ars > 0 and fee_base_ars > 0 and fee_base_usd > 0
           and fee_rate_percent > 0 and fee_rate_percent <= 100) not valid;
  -- ídem > 0 en application_snapshots.monthly_price_*, initial_duration_months;
  -- >= 0 o null en proposed_*, enrollment, deposit, amount_reported_*;
  -- luego: alter table ... validate constraint ...;
  ```

### M4. Cookies de sesión sin HttpOnly — confirmado en código; flags reales en runtime pendientes
- **Dónde:** `lib/supabase/server.ts:31` y `middleware.ts:32` pasan las `options` de `@supabase/ssr` sin flags propios (defaults: `httpOnly=false`, `sameSite=lax`). `app/layout.tsx:48` lee `document.cookie` buscando `sb-*auth-token`, así que hoy depende de que la cookie sea legible por JS. No hay `createBrowserClient` en el repo: todo el auth es server-side.
- **Explotación:** cualquier XSS futuro permite robar el token de sesión (y con A1, usarlo contra PostgREST).
- **Corrección:** `{ ...options, httpOnly: true, secure: process.env.NODE_ENV === "production" }` y reemplazar el hint de `layout.tsx:48` por una cookie propia no sensible (p. ej. `has-session=1`). Requiere probar login, logout, refresh y reset.

### M5. Sin Content-Security-Policy ni Permissions-Policy — confirmado
- **Dónde:** `next.config.ts:76-87`: solo `X-Frame-Options`, `nosniff`, `Referrer-Policy`. HSTS depende de Vercel.
- **Riesgo:** sin red de contención ante un XSS (hay 6 `dangerouslySetInnerHTML`, hoy todos con `<` escapado).
- **Corrección:** CSP en modo `Report-Only` primero, luego enforce; `Permissions-Policy: camera=(), microphone=(), geolocation=()`; HSTS explícito si hay dominio propio; `poweredByHeader: false`.

### M6. Abuso de registro y login: sin verificación de email, throttles en memoria, enumeración — confirmado (login: posible)
- **Dónde:**
  - `lib/preapertura/accounts.ts:32` crea cuentas con `email_confirm: true`.
  - Throttle en memoria por instancia (`lib/preapertura/throttle.ts:10-12`, `preregistro/actions.ts:79`, reset de contraseña): inefectivo en serverless.
  - `preregistro/familiar/actions.ts:64,88-92` manda un mail a un `student_email` arbitrario.
  - `register/student/actions.ts:120` y `register/family/actions.ts:97` sin throttle (hoy los corta `PREAPERTURA=on`; quedan abiertos al apagarla).
  - `app/(public)/login/actions.ts:37`: `signInWithPassword` corre en Vercel, así que el rate limit por IP de Supabase ve la IP del servidor.
  - Enumeración: `register/family/actions.ts:76-95` revela si un email es de estudiante (incluidos menores), de otra cuenta (p. ej. admin) o ya tiene familiar; `preregistro/actions.ts:93` y `familiar/actions.ts:81` responden "Ya hay una cuenta con ese email".
- **Explotación:** script con rotación de IP que crea cuentas en masa y dispara mails "Te invitaron a sumarte a EstuRed" a terceros; credential stuffing sin límite efectivo; mapeo de qué emails tienen cuenta.
- **Corrección:** rate limit persistente (Vercel KV/Upstash o reglas WAF de Vercel) en `/login`, `/register/*`, `/preregistro`; CAPTCHA (Turnstile) en Supabase Auth y formularios públicos; verificar email con OTP antes de mandar invitaciones a terceros; respuesta neutra en `registerFamily`.

### M7. La residencia ve por la API quién abrió un caso de Soporte — confirmado; decisión de producto
- **Dónde:** policy `0023:60-66` da la fila completa (`opened_by_user_id`, `opened_by_role`, `related_entity_*`, `assigned_admin_user_id`). La UI solo muestra descripción y notas (`app/residence/[residence_id]/support/page.tsx:52`).
- **Explotación:** la residencia cruza `opened_by_user_id` con `application_requests.created_by_user_id` e identifica al estudiante que se quejó.
- **Corrección:** grant por columnas (`id, status, description, resolution_notes, created_at, topic`) o quitar la policy y leer solo con service role (lo que ya hace la app).

---

## Bajo

| # | Hallazgo | Dónde | Corrección propuesta |
|---|---|---|---|
| B1 | PDF del reglamento sin sniffing (solo `file.type` declarado); se sirve público con signed URL de 3600 s. Permite hospedar archivos arbitrarios como `application/pdf` (sin XSS). | `app/residence/[residence_id]/profile/actions.ts:698-727`; `app/(public)/residencias/[slug]/page.tsx:168-171` | `resolveDocumentType(file) === "application/pdf"`, extensión derivada, TTL más corto. |
| B2 | El estudiante puede reescribir su comprobante de pago a la residencia después de confirmado; montos sin rango y textos sin tope, sin `old_value` en auditoría. Lado residencia también sin rango. | `app/students/applications/[id]/payment/actions.ts:29-39,102-112`; `app/residence/.../payment/actions.ts:31-33` | Permitir solo en `residence_payment_pending`, validar rangos/longitudes, guardar valor anterior. |
| B3 | `contentType` de `upload()` ignorado cuando el body es `File`: se guarda el tipo declarado por el cliente (los tipos permitidos son inertes). | `@supabase/storage-js` `index.cjs:610-622`; 8 flujos (`openSupportCase.ts:40`, `fee/actions.ts:124`, `students/profile/actions.ts:300`, `payment/actions.ts:71`, `recordResidencePaymentReceived.ts:96`, `recordRenewalResidencePaymentReceived.ts:88`, `registerRenewalManualFeePayment.ts:70`, reglamento) | Subir `new Blob([buf], { type: realType })`. |
| B4 | Textos libres y uploads sin tope: descripción pública de residencia, descripción de soporte (sin máximo en DB), precio sin techo, uploads repetidos sin límite ni throttle; `files.filename` sin acotar. | `profile/actions.ts:121-125,221`; `lib/support/openSupportCase.ts:88-90`; `0023:37` | Topes (p. ej. ≤5000 caracteres) y throttle de uploads. |
| B5 | Archivos huérfanos en Storage si falla el insert en `files`; `openSupportCase` ni chequea el error. | `profile/actions.ts:704-733`; `students/.../payment/actions.ts:90-94`; `recordResidencePaymentReceived`; `lib/renewals/*`; `openSupportCase.ts:42-56` | Limpieza como en `fee/actions.ts:175`. |
| B6 | Tipo de cambio: proveedor sin timeout ni rango de plausibilidad; override admin acepta `Infinity`/`1e12`. | `lib/exchange/provider.ts:23-33`; `app/admin/exchange-rate/actions.ts:91-93` | `AbortSignal.timeout`, rango ±X % del último valor, `isFinite` + tope. |
| B7 | `NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"` en 11 lugares; si falta en Vercel, QR de comprobantes (persistidos) y links de mail quedan en localhost. **Posible.** | `forgot-password/actions.ts:78`, `confirmAfterFeePaid.ts:176,227`, `reissueBookingReceipt.ts:41`, `confirmRenewalAfterFeePaid.ts:87`, `residentInvitations.ts:29`, `teamInvitations.ts:99`, `notifyResidenceTeam.ts:265`, `runStayFollowups.ts:257`, `notifyPaymentSettingsChange.ts:53`, `family-link-actions.ts:203` | Fallar en producción si falta la variable; verificar el valor en Vercel. |
| B8 | Cron: secreto comparado con `!==` (no constante en tiempo) y guardado en texto plano en `cron.job.command`. | `app/api/cron/expire-stale-records/route.ts:19`; `db/migrations/0013:39-48` | `crypto.timingSafeEqual`; secreto en Supabase Vault. |
| B9 | Superficie de escritura no usada por la app: INSERT directo en `stay_followup_responses` saltea `sent → answered` y deja el seguimiento trabado; INSERT/DELETE en `arrival_checklist_items`. | `0055:158`; `0068:93-98` | Drop de esas policies + `revoke insert/delete … from authenticated`. |
| B10 | Funciones `SECURITY DEFINER` ejecutables por anon (no filtran: booleano atado a `auth.uid()`). | `is_family_member_of_student`, `is_student_linked_to_family_member` (`0006:17-47`, `0046:31-63`) | `revoke all … from public, anon; grant execute … to authenticated`. |
| B11 | Metadatos expuestos a anon: `exchange_rates` (`overridden_by_user_id`, `override_reason`, `notes`) con `USING (true)`; `profile_availability.last_confirmed_by`; `residences.created_by` (riesgo aceptado en `0043:38-39`). | `0009:21-27,41`; `0043b:55` | Grant por columnas en `exchange_rates`. |
| B12 | Middleware fail-open sin env vars de Supabase (los layouts igual protegen); IP de auditoría tomada del primer `x-forwarded-for` (falsificable); `poweredByHeader` activo. | `middleware.ts:16`; `team/actions.ts:33`, `register/*` | 503 en producción si faltan variables; usar `clientKeyFromHeaders`; `poweredByHeader: false`. |
| B13 | Staff sin permiso de pagos puede bajar el PDF del comprobante (coherente con DR11: staff ve en solo lectura). `receipt_payload` sin DNI/CUIT/email/teléfono, pero con `payer_billing_name`. | `app/students/receipts/[id]/pdf/route.ts:16-21`; policy `0011:63-73` | Exigir rol student/family o permiso `payments` en el handler, si producto lo decide. |
| B14 | `.gitignore` solo cubre `.env*.local` (no `.env.production`, `*.key`, `service-account*`); carpetas sin trackear ni ignorar: `.codex/`, `.hallmark/`, `video-hf/`, `video/`, `marketing/`, `skills-lock.json` y parte de `scripts/data/` (fichas CRM con contactos que pueden ser personales). Sin secretos según el scanner. | `.gitignore:22` | `.env*` + `!.env.example`, `*.key`, `*.pem`, `service-account*`; decidir qué carpetas se commitean. |
| B15 | Otras vulnerabilidades npm: prod transitivas `postcss` (vía next, 8.4.31 anidado), `sharp` 0.34.5, `nanoid` 3.3.15, `source-map-js` 1.2.1; 11 solo de dev (vitest/vite, @vitest/mocker, eslint: brace-expansion, js-yaml, minimatch, @typescript-eslint). Ninguna la trae animate.css. | `package-lock.json` | Se cierran mayormente con C1 + `npm audit fix` sin `--force`; revisar diff del lockfile. |

---

## Info

- **I1.** CVE-2025-55182 (React2Shell): React 19.2.7 y Next 15.5.20 son posteriores a los parches recordados (React 19.0.1/19.1.2/19.2.1, Next 15.5.7); ningún advisory del audit lo lista. Contrastar con el aviso oficial; la versión de `react-server-dom-webpack` vendorizada en `next/dist/compiled` no se pudo leer.
- **I2.** `users.blocked_reason` ("motivo interno", `docs/06:303`) lo puede leer el propio usuario bloqueado (`0002:144`).
- **I3.** FKs de historial sin `ON DELETE` (`0007:63`, `0010:63/71/112`, `0011:35`, `0023:32`, `0003:225`): borrar un `auth.users` con historial falla. El derecho de supresión necesitará un procedimiento de anonimización.
- **I4.** Login demo: doble candado (`DEMO_LOGIN_ENABLED` + `VERCEL_ENV !== "production"`, `lib/demoLogin.ts:8`). Riesgo residual solo si esas variables se cargan en Preview de Vercel. `docs/PLAN_SALIDA_PRODUCCION.md:19,66`: decisión B1 (proyecto Supabase nuevo) mitiga que las cuentas demo existan en prod.
- **I5.** `bodySizeLimit 6mb` (`next.config.ts:64`) hace inalcanzables los límites de 10/25 MB de los buckets desde la app (UX, no seguridad).
- **I6.** `CLAUDE.md` dice migraciones `0001`–`0077`; hay 81 archivos (`0001`–`0080` + `0043b`), sin números duplicados. Las cabeceras de `0078`–`0080` dicen "NO está aplicada"; `MEMORY.md` indica `0080` aplicada en dev.

---

## Verificado OK (resumen con evidencia)

- **Secretos:** `secret-scanner.py` sobre 1127 archivos (incluidas carpetas sin trackear): 0 secretos reales. `git log --all -G` con patrones de claves: 0 commits. `.env.local` y `.env.sinfronteras.local` nunca trackeados; solo `.env.example` (vacío).
- **Service role fuera del cliente:** `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `DEMO_*` solo en código de servidor; `import "server-only"` en `lib/supabase/admin.ts:1`; ningún `NEXT_PUBLIC_` sensible; `next.config.ts` sin `env:` ni sourcemaps de producción.
- **Autorización:** 80 archivos `"use server"` revisados por script; admin (24) con `getAdminSession`/`getSuperadminSession`; residence (18) con `assertResidence*` y `residence_id` tomado de la fila; students (21) con ownership por `student_profiles.user_id` o vínculo familiar activo. Transiciones con lista blanca + update condicional por estado.
- **Roles e invitaciones:** rol fijo en código, ningún camino crea admin; invitaciones con hash, vencimiento, un solo uso y email atado; sin mass assignment desde `formData`; policies de UPDATE propias eliminadas en `0037:38-47`.
- **Auth:** `getUser()` solo dentro de `safe-get-user.ts`; reset con PKCE, chequeo de bloqueo y `signOut` global; forgot-password neutro con relleno de tiempo.
- **RLS:** 69/69 tablas con RLS; sin vistas; 13 funciones `SECURITY DEFINER` con `search_path` fijo, las de escritura solo para `service_role`; sin UPDATE sin `WITH CHECK`; INSERT atados a `auth.uid()`; columnas sensibles ocultas por grant en `estured_fee_payments`, `family_members`, `residence_verifications`, `stay_followups`.
- **Storage:** sin policies en `storage.objects` (todo por service role); rutas con UUID y extensión derivada del tipo real; documentos sensibles con signed URL de 300 s y registro de acceso.
- **Uploads:** sniffing por magic bytes en todos los flujos salvo el reglamento (B1); fotos solo JPEG/PNG/WebP (SVG/AVIF/HEIC rechazados).
- **SSRF / XSS / inyección:** único `fetch` de servidor con URL fija; PDFs con `@react-pdf/renderer` sin URLs de usuario; `remotePatterns` con host exacto; 6 `dangerouslySetInnerHTML` con `<` escapado; sin markdown de usuario ni `href` con `javascript:`; búsqueda pública en memoria; `ilike` de admin escapados; sin SQL dinámico; sin CORS propio.
- **Supply chain:** lockfile trackeado, sin `overrides`, scripts de instalación esperados (`sharp`, `fsevents`, `unrs-resolver`), sin typosquatting; animate.css legítimo y en uso.

---

## Verificaciones manuales pendientes (no hechas: requieren dashboard o runtime)

Supabase `estured-dev` → SQL Editor (solo lectura):
```sql
select schemaname, tablename, policyname, cmd, roles from pg_policies where schemaname in ('public','storage') order by 1,2;
select id, public, file_size_limit, allowed_mime_types from storage.buckets;
select grantee, table_name, privilege_type from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon','authenticated') order by 1,2;
select extname from pg_extension where extname = 'pg_graphql';
```
- Supabase Auth: duración del JWT, rate limits y CAPTCHA.
- Si `0078`–`0080` están aplicadas en dev.
- En prod (cuando exista): que el job de cron no tenga los placeholders `REEMPLAZAR-…`.
- Vercel: `NEXT_PUBLIC_APP_URL`/`NEXT_PUBLIC_SITE_URL` en Production; `DEMO_*` ausentes en Production **y** Preview; `RESEND_API_KEY` y `CRON_SECRET` solo como variables de servidor; reglas WAF.
- Runtime/staging: flags reales de las cookies de sesión; destino de `redirect("//evil.com")` (M1); que Supabase Storage mande `nosniff` en `/storage/v1/object/sign/*`.
- Cobertura parcial (solo grep/muestreo): `residence/[residence_id]/profile/actions.ts` completo, cuerpo de libs de admin (verifications, payments, profile-edits, solicitudes), `lib/preapertura/*`, textos libres de admin y negociación, código cliente.

---

## Orden de corrección propuesto

| Fase | Contenido | Tipo |
|---|---|---|
| 1 | C1 (upgrade de Next) + `npm audit fix` (B15) | Dependencias; build + tests |
| 2 | A1 (ban en Auth + policies restrictivas) y A2 (grants por columna) | Código + migración nueva (dev primero; prod solo propuesta) |
| 3 | M1 (safeNext + tests), M2 (escape del mail), M3 (validación server + CHECK) | Código + migración |
| 4 | M4 (cookies HttpOnly), M5 (CSP report-only + headers) | Requiere probar login/refresh en staging |
| 5 | M6 (rate limit persistente + CAPTCHA), M7 (decisión de producto) | Infra (KV/WAF) + decisión |
| 6 | Bajos B1–B14 | Backlog de hardening |

Ninguna migración se aplica en producción desde este trabajo: se proponen y el dueño las aplica.
