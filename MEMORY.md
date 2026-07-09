# MEMORY.md — Memoria persistente de EstuRed

**Última actualización:** 2026-07-09 (Ciclo 10 — pago a residencia, creación de reserva y fee EstuRed)

> Bitácora ejecutiva viva. NO reemplaza la documentación estratégica de `/docs`
> (los 23 archivos `00`–`22` son la fuente de verdad de producto). Leer este
> archivo al inicio de cada sesión, junto con los docs que apliquen a la tarea.

---

## 1. Resumen actual del proyecto

EstuRed es una webapp responsive para conectar estudiantes y familias con residencias estudiantiles **verificadas presencialmente** en CABA. Plataforma híbrida de confianza: descubrimiento + solicitud + negociación estructurada + reserva con fee + comprobante verificable + gestión para residencias (freemium). Frase de marca: *"La convivencia también se elige."* La confianza es el producto.

**Estado:** Ciclos 0, 2 y base del 3 completados. **Git con remoto en GitHub (`github.com/fbermani/estured-claude`, SSH configurada). Supabase aprovisionado y operativo** (proyecto `mrwooskdcnkbitkhcvbf`, región São Paulo): migración 0001 aplicada, formulario de waitlist verificado end-to-end (envío real → fila en DB → RLS bloquea lectura y escritura anónimas). **Deploy en producción: https://estured.vercel.app** (Vercel conectado al repo de GitHub — cada push a `main` deploya solo; env vars cargadas en el dashboard de Vercel salvo `NEXT_PUBLIC_APP_URL`, que hay que agregar como `https://estured.vercel.app` cuando auth la necesite). Waitlist verificada e2e también en producción (2026-07-07).

**Auth operativo (migración 0002 aplicada, verificado e2e 2026-07-07):**
- Tablas: `users`, `user_roles`, `consents`, `student_profiles`, `student_visibility_settings`, `audit_logs` — con RLS "solo lo propio" y auditoría append-only solo service role.
- Login real (`/login`) con redirect por rol; registro de estudiante completo (`/register/student`) con validación server-side, detección de menores, consentimientos versionados (`v0.1-borrador`), auditoría y rollback si falla a mitad; selector de rol en `/register` (familiar y residencia = "Muy pronto", siguiente slice).
- Protección en dos capas: `middleware.ts` (sesión) + layouts por área (rol). Verificado: estudiante que intenta `/admin` rebota a su home.
- **Decisión documentada:** usuarios pre-confirmados vía admin API (sin verificación de email) mientras el proveedor de email sea pendiente de docs/00 §29.
- **Gotcha PostgREST:** en inserts múltiples, las filas sin una columna la mandan como `null` (ignora el default de la tabla) → declarar `metadata: {}` explícito (bug real corregido en `registerStudent`).
- Admin: `node --env-file=.env.local scripts/create-admin.mjs <email> <password>` (aún no se creó el admin real del dueño).

**Selector de sesión simulada (pedido del dueño, 2026-07-07):** widget flotante "Simular usuario" con los 8 usuarios demo de docs/17 (Lucía/Camila/Valentina estudiantes, Martín familiar, Ricardo owner, Sofía staff, admin, superadmin — seed: `scripts/seed-demo-users.mjs`). Usa auth real (signInWithPassword) así ejercita RLS/roles/redirects de verdad. Doble bloqueo: solo se monta y solo funciona con `DEMO_LOGIN_ENABLED=true` (en `.env.local`; **jamás configurarlo en Vercel**). Contraseña común en `DEMO_USERS_PASSWORD`. El gate en `app/layout.tsx` está envuelto en `<Suspense>` para no forzar rendering dinámico en toda página pública — verificado: sin la flag (como en Vercel), `/`, `/search`, `/for-students`, `/for-residences` vuelven a ser estáticas.

**Onboarding de residencias (Ciclo 4, verificado e2e 2026-07-07):**
- Migración 0003: `residences`, `residence_users` (con trigger de límite de 10 por owner — docs/06 §8.2), `residence_verifications`, `residence_profile_sections` (jsonb por sección: services/common_areas/rules/near_universities), `room_types`, `profile_availability`, `files` — RLS: público solo ve `status='verified_active'`; owner/staff ven la propia vía `residence_users`.
- Storage: buckets `public-residence-media` (fotos, público) y `private-residence-documents` (reglamento PDF, privado) creados vía `scripts/setup-storage.mjs`. Todo upload pasa por server action con service role — no hay policies de Storage, mismo patrón que `files`.
- `/register/residence`: alta de cuenta + residencia en `draft`. **Gestión Operativa nunca autoseleccionable** — el alta siempre crea `operating_mode='verified_profile'` (docs/00 §6.2: es plan pago otorgado por admin).
- `/residence/[residence_id]/profile`: formulario completo (referencia Stitch "2da parte" — ver `docs/VISUAL_UX_AUDIT.md` si se actualiza) con guardar borrador / enviar para revisión (→ `pending_verification` + `documents_pending`). Aislamiento verificado: un usuario sin `residence_users` activo para ese ID recibe 404 (`assertResidenceAccess` en el server action, además del guard de rol en el layout).
- `/residence/dashboard`: lista real de residencias del owner (ya soporta N, aunque hoy solo se prueba con 1).
- **Bug real encontrado y corregido durante el e2e**: los dos botones submit (Guardar/Enviar) usaban `onClick` + `setState` de React para decidir el `intent`, lo cual es una condición de carrera — el botón "Enviar para revisión" guardaba como borrador. Fix: `name="intent" value="draft|submit"` nativo en cada `<button>` + `useFormStatus()` en un subcomponente para el label de pending (patrón HTML correcto, no React state).
- Decisiones de extensión no bloqueantes documentadas en la cabecera de la migración 0003 (tagline, property_type, gender_policy, bathroom_type, features, minimum_stay_months, document_type +residence_photo/+residence_rules_document).
- **Simplificación deliberada**: precios se cargan solo en USD (recomendación docs/12 §6.4) y el ARS se calcula con el mock de tipo de cambio — reemplazar cuando exista `ExchangeRateProvider` real. "Meses Vacíos (Gap Filling)" de la referencia se omitió (no está en ningún doc de negocio).

**Panel admin — validación de residencias (Ciclo 5, verificado e2e 2026-07-07):**
- **Sistema visual "Operational Command"** deliberadamente distinto del sitio público (azul comando #003d9b, Plus Jakarta Sans conceptual con Inter real, radios 4-8px vs 1rem) — fuente: `design-references/stitch_estured_mvp_3ra parte/operational_command/DESIGN.md`. Tokens en `components/admin/ui/tokens.ts`, componentes en `components/admin/ui/` (AdminCard/AdminBadge/AdminButton). No mezclar con `app/globals.css` (marca pública).
- `/admin/verifications`: cola de residencias pendientes (patrón inbox de 2 columnas, seleccionable por `?id=`) + panel de detalle con galería, documentación (reglamento PDF vía signed URL de Storage privado), universidades, tipos de habitación, y el **checklist real de `residence_verifications`** (identidad responsable/coordinador, dirección, fotos) — no el "Trust Score" inventado de la referencia (se omitió a propósito: mostrarle a un admin un score sin metodología real socava la confianza que el checklist sí tiene).
- 3 acciones con validación server-side: **Aprobar y publicar** (exige mínimo identidad+dirección+fotos marcadas; `residences.status→verified_active`, `expires_at`=+1 año), **Pedir cambios** y **Rechazar** (ambas exigen motivo de ≥5 caracteres) — todas auditadas.
- `/admin/dashboard`: métricas reales (residencias activas, validaciones pendientes, usuarios, leads) + actividad reciente desde `audit_logs`. Se omitieron deliberadamente el mapa de densidad y el "Operational Health" (uptime/API response/DB load) de la referencia — son datos de infraestructura falsos, no hay monitoreo real detrás.
- `/admin/logs`: tabla de `audit_logs` (últimos 50 eventos), sin las categorías "Security & Rates"/"System Core" de la referencia (no existen esas categorías en el modelo).
- `/admin/users` y `/admin/applications`: placeholders "Próximamente" — gestión de usuarios y de solicitudes quedan para ciclos posteriores.
- **Bug real corregido durante el e2e** (mismo patrón que en el onboarding de residencias): los 3 botones de acción usaban el patrón correcto desde el inicio esta vez (`name="action" value="approve|needs_changes|reject"` + `useFormStatus`) — aplicué la lección del bug anterior preventivamente.

**Familiar vinculado (Ciclo 6, verificado e2e 2026-07-08):**
- Migración 0004: `family_members`, `family_links` (enum `family_link_status`, unique partial index "solo 1 activo por estudiante" — docs/00 §17). `/register/family` combina en un solo submit lo que los docs describen como 3 pasos (crear cuenta → buscar estudiante → solicitar vínculo): busca al estudiante **por email exacto** (debe tener cuenta ya creada; invitar a alguien sin cuenta requeriría email transaccional, pendiente docs/00 §29).
- `/students/dashboard` ahora bifurca por rol: si `family_member`, muestra sus estudiantes vinculados y su estado; si `student`, muestra notificación de vinculación pendiente con Aprobar/Rechazar (`app/students/family-link-actions.ts` + `FamilyLinkActions.tsx`) y el familiar activo si existe. **No existe dashboard familiar separado** — comparte ruta y layout con el estudiante, como ya estaba documentado.
- **Bug de infraestructura real, no de UI, encontrado en el e2e — dejar como referencia para el futuro**: agregar policies RLS "inversas" para que dos tablas se puedan leer mutuamente a través de una tabla puente (acá: `student_profiles` ↔ `family_links` ↔ `family_members`) causa **recursión infinita de RLS** si cada policy consulta a la otra tabla directamente (Postgres tira `infinite recursion detected in policy for relation ...`, y Supabase-js lo devuelve como error silencioso que un `.maybeSingle()` sin chequear `error` puede esconder como `null`). Fix aplicado en migración 0006: funciones `SECURITY DEFINER` (`is_family_member_of_student`, `is_student_linked_to_family_member`) que resuelven el lookup bypasseando RLS puertas adentro, rompiendo el ciclo. **Regla para el futuro**: cualquier policy nueva que haga un subquery a una tabla que a su vez tenga una policy que consulte de vuelta a la tabla original debe usar una función `SECURITY DEFINER`, no un subquery directo.

⚠️ Gotcha aprendido: al pegar la URL de Supabase en `.env.local` el dueño copió el endpoint REST (`.../rest/v1/`) y produjo `PGRST125`; la URL correcta es la base del proyecto sin path. El proyecto Supabase original (`agvcuqgakvsxedpoyefw`) quedó atascado en aprovisionamiento y fue recreado.

## 2. Visión del producto

Referente en Latinoamérica para elegir dónde vivir al estudiar. MVP = validar el loop central en CABA con 5–10 residencias pioneras. Loop central (docs/00 §4): solicitud → contacto → [negociación opcional, 1 ajuste máx.] → pago a residencia externo → residencia confirma pago → fee EstuRed (MercadoPago ARS / PayU USD / manual) → factura fiscal (TusFacturas.app) → reserva confirmada → comprobante PDF+QR verificable en `/verify/[code]`. **Sin fee pagado no hay reserva confirmada.**

## 3. Principios de diseño y producto

Confianza, claridad, transparencia, comunidad, profesionalización, calidez, simplicidad. UI: moderna, humana; ni inmobiliaria tradicional ni SaaS frío. Lenguaje de "solicitud sujeta a confirmación", nunca prometer disponibilidad. Nunca mostrar estados técnicos crudos al usuario.

## 4. Stack técnico

- **Implementado:** Next.js 15.5 (App Router) + TypeScript strict + Tailwind CSS 4 (`@theme` en `app/globals.css`) + ESLint 9 flat config. React 19. Fuentes: Manrope (display) + Inter (texto) vía `next/font`.
- **Confirmado para próximos ciclos (docs/11 §3.1):** Supabase (PostgreSQL + Auth + Storage + pg_cron), Vercel, abstracciones `PaymentProvider` / `ExchangeRateProvider` (monedapi.ar blue venta) / `FiscalInvoiceProvider` / `NotificationProvider` (email + in-app; **WhatsApp jamás por API**).

## 5. Estructura actual

`docs/` (23 docs estratégicos + 3 técnicos nuevos) · `app/(public)/` (landing, for-students, for-residences, search, r/[slug], waitlist, login, register) · `app/{students,residence,admin}/dashboard/` (placeholders) · `components/{ui,layout,residences}/` (13 componentes) · `lib/mock/` (residences + exchange) · `types/domain.ts`. Estructura completa objetivo: docs/11 §6.

## 6. Decisiones técnicas tomadas

1. Scaffolding manual (no create-next-app) para controlar versiones y convivir con `/docs`.
2. Design tokens como CSS variables en Tailwind v4 `@theme`; escalas petrol/sage/sand/amber-soft + semánticos (ink, success/warning/danger/info).
3. `types/domain.ts` usa los nombres de estados oficiales de docs/04 (`verified_active`, `real_by_place`, etc.) para que el paso a Supabase no rompa componentes.
4. Copy de disponibilidad centralizado en `components/ui/StatusTag.tsx` (etiquetas oficiales de docs/08 §4.5).
5. Imágenes placeholder de picsum.photos (permitido en `next.config.ts`); reemplazar por Supabase Storage.
6. Tipo de cambio mock fijo 1480 ARS/USD en `lib/mock/exchange.ts`, siempre etiquetado "referencial".

## 7. Decisiones de producto tomadas

**Ciclo 0:**
1. **Identidad visual fundacional** (los docs no la definían): petróleo #0F5C7A, salvia #7CB89C, arena #F4F1EB, ámbar #F5B041; Manrope + Inter.
2. Una sola landing para estudiantes y familias (`/for-students`), según routing oficial — no rutas separadas.
3. `/waitlist` agregada como página pre-lanzamiento (no está en el routing oficial; retirar/redirigir al operar).
4. CTAs de solicitud en la ficha apuntan a `/waitlist` hasta que exista auth.

**Ciclo 2 (confirmadas por el dueño vía preguntas, 2026-07-06):**
5. **H1 híbrido:** "No solo elijas dónde vivir, sino cómo." como titular; "La convivencia también se elige." queda como frase de marca en cierre y footer.
6. **Marca oficial: "EstuRed"** (no "EstuRED" como escriben las referencias Stitch).
7. **Eje universidad en la comunicación:** campo `nearUniversities` en mocks y cards ("Cerca de UBA Derecho…"). Solo copy — el filtro por universidad NO es MVP.
8. **Sección "Lo que se viene"** en la landing, con etiqueta PRÓXIMAMENTE (señales de convivencia, reseñas verificadas, comunidad) — comunica visión sin prometer features del MVP.

## 7bis. Referencias visuales y decisiones de diseño (Ciclo 2)

- **Referencias usadas:** `/design-references/stitch_estured_mvp_1ra parte/` — 10 pantallas Stitch (⚠️ 8 de los 10 `screen.png` están corruptos, "FIFE Image failed to fetch"; el análisis usó los `code.html` + 2 PNG válidos).
- **Se adoptó:** copy con gancho, badge de etapa en hero, comparación "con EstuRed vs. por fuera", sección de roadmap futuro, hero con composición de producto, firma "Hecho con ♥ en Buenos Aires".
- **Se rechazó (documentado en `docs/VISUAL_UX_AUDIT.md` §11):** paleta azul genérica, promesas de garantía ("reserva garantizada"), "mediación", validación de WhatsApp, señales de convivencia como feature actual.
- **Cambios de sistema:** Button secondary ahora ámbar (contraste sobre fondos petróleo), TrustBadge fondo blanco sólido, StatusTag con modo `elevated` para superponerse a fotos, `--shadow-float`, tracking display -0.02em, `text-wrap: balance/pretty`.
- **Componentes tocados:** Navbar (labels nuevos + Ingresar), Button, Card (sin cambios), ResidenceCard (rediseñada), TrustBadge, StatusTag, Footer. Páginas: `/` (rediseño completo), `/for-residences` (nuevo H1), `/r/[slug]` (línea de universidades).

## 8. Supuestos activos

- El prompt operativo del dueño prevalece sobre la secuencia de docs/12 cuando re-secuencia trabajo sin tocar decisiones de producto.
- El formulario de waitlist declarará "datos no persistidos" hasta el Ciclo 1.
- El dueño decidirá hosting del repo y proveerá credenciales de Supabase.

## 9. Riesgos conocidos

Código sin versionar (¡git init urgente!) · pendientes legales de docs/00 §29 bloquean operar, no desarrollar · precio de Gestión Operativa sin definir · PayU en USD sin validar · mocks deben salir antes de demos con residencias reales.

## 10. Contradicciones resueltas

- **Secuencia de build** (docs/12+22 vs. prompt fundacional): prevaleció el prompt; mitigado respetando routing/estructura/estados oficiales. Detalle: `docs/CLAUDE_CODE_AUDIT.md` §6.1.
- Divergencias menores prompt vs. docs (rutas de familias, dashboard familiar, nombre de ruta del catálogo): prevalecieron los docs (§6.2 del audit).

## 11. Contradicciones pendientes

Ninguna conocida entre documentos activos (paquete auditado 2026-07-05, docs/14 §8).

## 12. Features implementadas

Landing pública completa (hero, cómo funciona, destacadas, audiencias, diferenciación vs. informalidad, FAQ, CTA) · landings segmentadas · catálogo `/search` con filtros client-side (barrio, tipo, disponibilidad, precio) y empty state · ficha `/r/[slug]` (galería, tarifas USD+ARS ref., servicios, reglas, sidebar de acción por estado de disponibilidad) · `/waitlist` con formulario (sin persistencia) · placeholders de dashboards · 404.

## 13. Features pendientes

Todo el resto del MVP: ver `docs/PRODUCT_IMPLEMENTATION_PLAN.md` (Ciclos 1–7+) y `docs/12_BUILD_PLAN.md`.

## 13bis. Fix crítico de infraestructura — crash de auth por refresh token inválido (2026-07-08)

**Síntoma:** el dueño vio en su navegador local un error fatal de Next.js: `AuthApiError: Invalid Refresh Token: Refresh Token Not Found`, con stack trace apuntando a `app/layout.tsx` → `<DemoSwitcherGate />` — tumbaba el árbol de render completo (no un error acotado a un componente).

**Causa raíz:** cualquier cookie de sesión cuyo refresh token Supabase ya no reconoce (usuario borrado por un script, sesión de un proyecto/entorno anterior, token expirado en un caso límite) hace que `supabase.auth.getUser()` lance una excepción **no capturada** durante el intento interno de auto-refresh del SDK — no el `{ data, error }` esperado. Esto ya era un riesgo latente desde el Ciclo 3 (auth), agravado en el Ciclo 6 porque las pruebas e2e crean y borran usuarios de prueba constantemente, cualquiera de los cuales puede dejar una cookie corrupta en el navegador que la probó.

**Por qué importa para producción, no solo dev:** el mismo crash ocurriría en `estured.vercel.app` para cualquier usuario real cuya cuenta se borre/bloquee mientras tiene una sesión activa en su navegador — no es un problema exclusivo del entorno de pruebas.

**Fix:** `lib/supabase/safe-get-user.ts` — helper `getSafeUser(supabase)` que envuelve `auth.getUser()` en try/catch, trata cualquier fallo como "sin sesión", y limpia la cookie corrupta con `signOut({ scope: "local" })` (sin pegarle al servidor, que ya considera el token inválido). Aplicado en los 4 call sites que llamaban `auth.getUser()` directo: `middleware.ts`, `lib/auth/session.ts` (`getSessionUser`), `components/dev/DemoSwitcherGate.tsx`, `app/(public)/login/actions.ts` (`signOut`).

**Verificado reproduciendo el escenario exacto**: usuario de prueba logueado → borrado desde el backend mientras el navegador conservaba la cookie → navegación a `/` (antes explotaba, ahora carga normal mostrando "Ingresar") y a `/students/dashboard` (redirige a `/login` en vez de explotar). Los logs del servidor muestran el warning capturado (`[auth] getUser failed, treating as signed out`) con tres variantes reales del error (`AuthApiError: Invalid Refresh Token`, `AuthSessionMissingError`, `User from sub claim in JWT does not exist`) — las tres ahora degradan con gracia.

**Regla para el futuro**: nunca llamar `supabase.auth.getUser()` directo en código server-side nuevo — siempre pasar por `getSafeUser()`.

## 13ter. Solicitud de reserva — fase 1 (Ciclo 7, verificado e2e 2026-07-08)

**Alcance decidido con el dueño**: solo solicitud → revisión → contacto establecido / rechazo. Sin negociación de condiciones, sin pago a residencia, sin fee, sin comprobante — son fases separadas siguientes. El loop completo tiene ~6 etapas; construirlo todo junto está explícitamente prohibido por `docs/13 §3`.

- Migración 0007: `application_requests`, `application_snapshots` (congela precio/tarifas/tipo de cambio al momento de solicitar — el ARS sigue viniendo del mock de tipo de cambio, no de un provider real), `application_status_events` (historial append-only). Enum `application_status` completo (18 valores, docs/06 §4.5) aunque esta fase solo use un subconjunto — más simple crearlo entero ahora que extenderlo después.
- **Punto de entrada real decidido con el dueño**: en vez de tocar los mocks de `/search`/`/r/[slug]` (que siguen intactos a propósito), se creó un catálogo REAL paralelo en `/residencias` (listado) y `/residencias/[slug]` (ficha, con el botón real de "Enviar solicitud de reserva" — ya no apunta a `/waitlist`). Va a estar casi siempre vacío hasta que se aprueben residencias reales; es la ruta candidata a absorber `/search` cuando se decida el reemplazo definitivo del catálogo.
- `/students/applications` (+`/[id]`) y `/residence/[residence_id]/applications` (+`/[id]`) — rutas ya definidas en el routing oficial (docs/11 §7.2-7.3), usadas tal cual.
- Botón de WhatsApp (`lib/applications/whatsapp.ts`): únicamente un link `wa.me` con mensaje pre-formateado (estudiante, residencia, tipo de habitación, fecha, duración, monto) — **cero integración de API**, coherente con la prohibición dura del proyecto. Lo acciona la residencia al establecer contacto, no el estudiante.
- Reglas de negocio reales aplicadas: máximo 2 solicitudes activas por estudiante (docs/00 §9), teléfono del `contact_target` obligatorio (menor de edad → siempre el familiar vinculado activo, `docs/00 §17.3`), al establecer contacto se pausan automáticamente las otras solicitudes activas del mismo estudiante, motivos de rechazo con el enum exacto de `docs/07 §15.7`.
- **E2E verificado de punta a punta**: residencia de prueba verified_active → estudiante ve la ficha real → envía solicitud (snapshot creado con precio/USD/ARS correctos) → dashboard de residencia muestra "1 nueva" → marcar en revisión → establecer contacto → botón de WhatsApp con el mensaje exacto esperado → "Mis solicitudes" del estudiante refleja "Contacto establecido" → auditoría completa en ambos lados.
- **Aprendizaje operativo, no de producto**: al limpiar datos de prueba, un `.delete()` de Supabase-js que viola una FK constraint **no lanza excepción** — solo devuelve `{ error }`, que si no se chequea explícitamente, el script sigue como si hubiera funcionado. Dejó una residencia de prueba colgada en `verified_active` (visible en el catálogo real) hasta que se detectó y corrigió. **Regla para el futuro**: en scripts de limpieza, siempre loguear/chequear el `error` de cada `.delete()`, nunca asumir éxito por ausencia de excepción.

## 13cuater. Negociación de condiciones (Ciclo 8, verificado e2e 2026-07-08)

**Modo de trabajo desde este ciclo**: el dueño pidió explícitamente dejar de preguntar "con qué seguimos" — planificar y ejecutar la continuidad del loop con criterio propio, y solo consultar ante dudas críticas o de flujo/pantalla genuinamente ambiguas. Este ciclo se decidió y ejecutó sin pedir aprobación de alcance.

- Migración 0008: `application_negotiation_proposals` (docs/06 §11.3, docs/03 §10ter) — máximo 1 por solicitud (unique constraint). **Nombre de estado**: docs/03 §10ter.7 usa `accepted_conditions_pending_payment` en su texto narrativo, pero el enum técnico ya creado (docs/06 §4.5, migración 0007) es `conditions_accepted` — se usó el del enum (fuente técnica canónica), documentado como inconsistencia menor resuelta, no bloqueante.
- `lib/applications/fee.ts`: cálculo del fee estimado (5% de meses×tarifa + matrícula, excluye depósito — docs/00 §12), usado tanto en el snapshot original (ahora completo, antes tenía esos campos en null) como en la comparación de negociación y el snapshot final.
- Refactor DRY: `roundUsd`/`roundArs` (antes duplicadas en el server action de perfil de residencia) ahora viven en `lib/mock/exchange.ts`, importadas donde hacen falta.
- `/residence/[residence_id]/applications/[id]/negotiation` (residencia envía, con advertencia bloqueante + comparación en vivo) y `/students/applications/[id]/negotiation` (estudiante ve comparación lado a lado y responde: aceptar / rechazar y continuar con originales / rechazar y cerrar) — rutas ya definidas en docs/11 §7.2-7.3.
- **Snapshot final combina campo por campo**: lo propuesto por la residencia donde no sea null, lo original donde no se tocó — incluyendo heredar el tipo de cambio del original sin actualizarlo (docs/06 §11.2: "la negociación nunca actualiza la cotización").
- **E2E verificado con precisión numérica exacta**: propuesta de descuento (300→270 USD) → comparación lado a lado con fee recalculado (≈127.500 ARS, verificado a mano: 270×6+100=1720 USD × 1480 = 2.545.600 ARS × 5% = 127.280 → redondeado a 127.500) → aceptación → `snapshot_final` con los valores combinados correctos → estado `conditions_accepted` en ambos lados → auditoría completa (`negotiation_proposal_sent`, `negotiation_accepted`).
- **Gotcha de entorno reencontrado durante el e2e**: `.next/` se corrompió de nuevo (`Cannot find module './106.js'`) tras varios cambios de archivo seguidos con el dev server corriendo — mismo fix de siempre (parar servidor, `rm -rf .next`, relanzar), ya documentado en CLAUDE.md.

## 13quinquies. Tipo de cambio real — ExchangeRateProvider + modal obligatorio (Ciclo 9, 2026-07-08)

- `lib/exchange/provider.ts`: `MonedApiProvider`, fuente confirmada `https://monedapi.ar/api/v2/usd/blue` (campo `sell`, dólar blue valor venta). Endpoint verificado en vivo (no requiere API key para este endpoint).
- `lib/exchange/rate.ts`: `getCurrentExchangeRate()` — caché diaria en `exchange_rates` (migración 0009), cadena de degradación: override manual del día > fila automática del día > último valor conocido en DB (cualquier fecha) > `MOCK_EXCHANGE_RATE_ARS_PER_USD` (1480) como último recurso si Supabase o monedapi.ar no responden y no hay histórico. Nunca lanza — mismo patrón de degradación que `getSupabaseAdmin()` devolviendo `null`.
- `usdToArsReferencial()` (con tasa hardcodeada) **eliminada**; reemplazada por `usdToArs(usd, arsPerUsd)` pura en `lib/mock/exchange.ts`. Tocó ~14 call sites en 9 archivos (páginas públicas, perfil de residencia, creación de solicitud, negociación).
- **Regla crítica preservada de docs/06 §11.2**: la negociación nunca recalcula el tipo de cambio. `sendNegotiationProposal` ahora busca explícitamente el `exchange_rate_ars_per_usd` del snapshot original (no la tasa "de hoy") para computar los `proposed_*_ars` de la propuesta — antes esto "funcionaba por casualidad" porque la tasa era una constante global única; con tasa real y variable por día, este fix era necesario para que `respondNegotiationProposal` (que usa `proposal.proposed_*_ars` tal cual, sin recalcular) no quedara inconsistente con el `exchange_rate_ars_per_usd` heredado del original.
- `components/ui/ExchangeRateNote.tsx`: tooltip reutilizable con el texto exacto de docs/08 §2.8/§9.9, click-to-toggle (no hover-only, más robusto en mobile), cierre por click afuera. Insertado en ficha de residencia (`/r/[slug]`, `/residencias/[slug]`), perfil de residencia (edición de tarifas) y pantalla de negociación del estudiante. **Deliberadamente omitido en `ResidenceCard`** (grid de catálogo): insertar un `<button>` dentro del `<Link>` que envuelve toda la card genera HTML inválido (botón anidado en anchor) — docs/08 §2.8 no exige el modal en tarjetas de listado, solo en ficha/negociación/fee, así que ahí se dejó el texto "referencial" sin el ícono interactivo.
- Cambio de plataforma menor: `hint` de `components/ui/Input.tsx` pasó de `string` a `React.ReactNode` (compatible hacia atrás) para poder insertar el tooltip dentro del hint de un campo de formulario.
- **E2E verificado**: tasa real cacheada sin duplicados (1520 ARS/USD el día de la verificación) en `exchange_rates`; valores ARS consistentes (mismo cálculo `USD × 1520`) en landing, `/search`, `/r/[slug]` y `/residencias/[slug]`; tooltip abre con el texto exacto y cierra al clickear afuera.
- **Pendiente menor no bloqueante**: la UI de admin `/admin/exchange-rate` (docs/09 §25: forzar actualización, override manual con motivo obligatorio, quitar override, histórico) no se construyó — hoy sería necesario insertar una fila manualmente en Supabase para un override. No bloquea el loop central.

## 13sexies. Pago a residencia + creación de reserva y fee EstuRed (Ciclo 10, 2026-07-09)

- **Dos gaps reales encontrados y corregidos en el loop ya shippeado (Ciclos 7-8)**, leyendo docs/04 §5.4 con más cuidado — no invención de reglas, transiciones que ya estaban documentadas pero nunca cableadas:
  1. `contact_established` sin propuesta de ajuste quedaba trabado para siempre (no había forma de avanzar sin negociar). Fix: nuevo botón "Continuar sin cambios (habilitar pago)" → `enableResidencePayment()`, transición directa a `residence_payment_pending` con `snapshot_final = snapshot_original`.
  2. `respondNegotiationProposal` dejaba la solicitud parada en `conditions_accepted` para siempre (docs dice que es un estado de tránsito, "solo existe en el flujo con negociación"). Fix: encadena en la misma operación a `residence_payment_pending` (se registran igual los dos eventos en el historial de auditoría).
- Migración 0010: `external_residence_payments`, `reservations`, `estured_fee_payments` (schema completo de las 3, docs/06 §12-13, mismo criterio que Ciclo 7/8: más simple crear el esquema entero ahora que extenderlo después — pero el CÓDIGO de esta fase solo llega hasta crear la fila de `estured_fee_payments` en `pending_payment_method`, sin cobro real). FK circular entre `reservations` y `external_residence_payments`/`estured_fee_payments` resuelta con el mismo patrón de la 0007 (constraint agregada al final).
- Bucket de Storage `payment-proofs` (ya estaba en docs/06 §26 como "sugerido", faltaba crearlo) — agregado a `scripts/setup-storage.mjs`, **hay que correrlo manualmente** (`node --env-file=.env.local scripts/setup-storage.mjs`) además de aplicar la migración SQL — se pisó una vez en el e2e de esta sesión (bucket 404) hasta correrlo.
- `external_residence_payments` se crea en estado `pending` automáticamente en el momento en que la solicitud entra a `residence_payment_pending` (helper compartido `lib/applications/residencePayment.ts`, llamado desde los dos caminos del punto anterior) — no se espera a que el estudiante suba nada, fiel al enum documentado (`pending` es el primer estado real, no una ausencia implícita de fila).
- `markResidencePaymentReceived` (única acción que confirma la reserva, docs/03 §12.5): en una transacción de app crea consent → cierra `external_residence_payments` → crea `reservations` (`pending_estured_fee`) → crea `estured_fee_payments` (`pending_payment_method`, fee calculado sobre `snapshot_final`) → enlaza ambos FKs en las dos direcciones → mueve `application_requests.status` a `converted_to_reservation` directo (mismo patrón de encadenado que los gaps de arriba — `residence_payment_reported` es tránsito, no reposo).
- **Simplificaciones documentadas (análisis crítico, no del doc al pie de la letra)**: sin tabla de idempotency-key para `mark-received` (es una acción manual de baja frecuencia, el `unique(application_request_id)` de `external_residence_payments` ya previene duplicados — el `idempotency_key` de `estured_fee_payments` sí se mantiene porque ese es para webhooks reales de la fase siguiente); sin permisos granulares por `residence_staff` (`payments.residence.mark_received` etc., docs/05) porque no existe todavía invitación de staff — cualquier `residence_users` activo autoriza, igual que en todos los ciclos anteriores; comprobante propio de la residencia plegado en el campo opcional `receipt_file` de `mark-received` en vez de una pantalla de carga separada (docs/03 §12.4 no tiene endpoint propio documentado para eso).
- **E2E verificado con 2 solicitudes de prueba** (residencia creada por script, limpiada solo parcialmente — ver nota abajo): camino A (sin negociación) con matrícula+depósito, camino B (con negociación, descuento 300→270 USD) — fee calculado correctamente en ambos (1180 USD base × 1520 ARS/USD × 5% = 89.500 ARS redondeado), `reservations.snapshot_id` usa correctamente el `snapshot_final` cuando hubo negociación, FKs bidireccionales entre las 3 tablas verificadas en DB.
- **Bug encontrado y corregido durante el propio e2e**: `markResidencePaymentReceived` llenaba `reservations.external_residence_payment_id` pero nunca el lado inverso `external_residence_payments.reservation_id` — se detectó al inspeccionar la DB después del primer test y se agregó el `update` faltante antes del segundo test (que sí lo confirmó enlazado).
- **Dato de prueba — limpiado (2026-07-09)**: el sandbox bloqueó los scripts de limpieza automáticos (el clasificador de auto-mode interpretó los deletes acotados por ID como "mass delete"/"bypass" incluso con IDs exactos hardcodeados) — el dueño corrió el DELETE manualmente en el SQL Editor de Supabase, incluyendo 2 residencias huérfanas extra que habían quedado de intentos fallidos del script de setup (fallaron por constraints antes de llegar a crear `room_types`, pero la fila de `residences` sí había quedado insertada). Catálogo real confirmado en 0 residencias tras la limpieza. **Lección para el futuro**: los scripts de setup/limpieza de e2e deberían envolver la creación completa en una transacción o limpiar inmediatamente los intentos fallidos, para no dejar filas huérfanas de residencias en `verified_active`.
- **Pendiente de la fase siguiente (fee EstuRed real)**: cobro vía MercadoPago (ARS) / PayU Argentina (USD), reintentos (hasta 3 en 48h), factura fiscal vía TusFacturas.app, comprobante de reserva confirmada con QR verificable, UI de reserva/fee para ambos lados (hoy el mensaje post-pago es solo un texto informativo, no hay pantalla de reserva propia).

## 14. Próxima tarea recomendada

**Explícitamente decidido por el dueño (2026-07-08): NO reemplazar `lib/mock/residences.ts` todavía** — no tiene sentido armar el catálogo mock-a-real hasta que existan residencias reales cargadas de verdad (hoy: 0 en `verified_active`, confirmado tras limpiar los datos de prueba del Ciclo 10).

**Plan de continuidad del loop central (a ejecutar en orden, sin volver a preguntar salvo duda crítica)**: (1) ~~negociación de condiciones~~ ✅ Ciclo 8; (2) ~~`ExchangeRateProvider` real + modal obligatorio~~ ✅ Ciclo 9; (3) ~~pago a residencia + creación de reserva~~ ✅ Ciclo 10; (4) fee EstuRed real (MercadoPago/PayU, reintentos) + factura fiscal (TusFacturas.app) + comprobante de reserva confirmada con QR — cierra el loop central completo. `family_application_proposals` (docs/06 §7) y la UI de admin `/admin/exchange-rate` quedan como ramas laterales, no bloqueantes. Leer antes: docs/00 §12 y §14bis (comprobante), docs/07 §17-18, docs/11 §13-15.

Pendientes menores (no bloquean): permiso de Bash para scripts de limpieza de datos de prueba acotados por ID (ver §13sexies — el sandbox los bloquea hoy, requiere limpieza manual del dueño vía SQL Editor), UI de admin `/admin/exchange-rate`, crear el admin real del dueño (`scripts/create-admin.mjs`), recuperación de contraseña (necesita proveedor de email, docs/00 §29), fotos curadas para mocks, logo real, rate limiting del waitlist (GAPS.md), página /privacy antes de difusión masiva, `/admin/users` y `/admin/applications` son placeholders, job de expiración automática de solicitudes/propuestas a 48h (docs/00 §9.1 — hoy `expires_at` se guarda pero nada lo procesa todavía).

## 15. Instrucciones para futuras sesiones

1. Leer este archivo + `docs/13_CLAUDE_PROJECT_INSTRUCTIONS.md` (cómo trabajar) + `docs/14_PROJECT_INDEX.md` (qué doc leer por tarea).
2. Jerarquía ante contradicción: docs/13 §2 (el 00 manda).
3. Nunca: fusionar entidades del loop, inventar estados/reglas, API de WhatsApp, mutar estados críticos desde el cliente, comprobante sin fee pagado.
4. **Comandos de validación:** `npm run typecheck` · `npm run lint` · `npm run build` · dev: `npm run dev` (launch config `estured-dev` en `.claude/launch.json`).
5. **Resultado última validación (2026-07-09, Ciclo 10):** typecheck ✅ · lint ✅ · build ✅ (28 rutas, sin cambios de routing) · e2e de pago a residencia + creación de reserva/fee verificado en navegador + DB, dos caminos (con y sin negociación) — ver §13sexies · sin tests automatizados aún (ver GAPS.md).
6. Al cerrar cada ciclo: validar, actualizar `MEMORY.md` + `docs/NEXT_STEPS.md`.
7. **Modo de trabajo (desde 2026-07-08):** no preguntar "con qué seguimos" — planificar y ejecutar la continuidad del loop central con criterio propio (ver plan en §14), consultando `docs/` y `design-references/` como corresponde. Solo consultar al dueño ante dudas realmente bloqueantes (regla de negocio ambigua no cubierta en docs, o pantalla/flujo de referencia que no se entiende). El dueño planea una pasada de estética aparte más adelante — señalar dudas estéticas sin detenerse a resolverlas ahora.
8. **Modo de colaboración (desde 2026-07-09, ver CLAUDE.md):** los docs son guía fuerte, no dogma — traer análisis propio y recomendar mejoras activamente, no solo implementar literal (ver §13sexies para un ejemplo real: los dos gaps de transición encontrados). Evaluar qué skills de Claude Code ayudarían antes de cada bloque de trabajo nuevo y pedirlas si no están instaladas.
9. **Migraciones SQL + scripts de setup no son lo mismo**: aplicar la migración en SQL Editor NO alcanza si el ciclo también agrega un bucket de Storage nuevo (`scripts/setup-storage.mjs`) — correr ambos. Pasó en el Ciclo 10 (bucket `payment-proofs` faltante hasta correr el script).
