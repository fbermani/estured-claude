# MEMORY.md — Memoria persistente de EstuRed

**Última actualización:** 2026-07-07 (Ciclo 5 — panel admin de verificación, loop de publicación cerrado e2e)

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

## 14. Próxima tarea recomendada

**Ciclo 6 — catálogo real + registro de familiar** (docs/12 Fase 2 restante + Fase 3 + §5.5): ya existe el camino completo para que una residencia llegue a `verified_active` (registro → perfil → admin aprueba), así que ahora sí tiene sentido reemplazar `lib/mock/residences.ts` por repositorios Supabase en `/search` y `/r/[slug]` (leer `residences` con status=verified_active + room_types + profile_availability + profile_sections) + `ExchangeRateProvider` (monedapi.ar) con modal obligatorio (docs/08 §2.8) + registro de familiar con vinculación aprobada por estudiante (docs/08 §5.5, `family_members`/`family_links`). Leer antes: docs/03, docs/12 §6.3 y §7.

Pendientes menores (no bloquean): crear el admin real del dueño (`scripts/create-admin.mjs`), recuperación de contraseña (necesita proveedor de email, docs/00 §29), fotos curadas para mocks, logo real, rate limiting del waitlist (GAPS.md), página /privacy antes de difusión masiva, `/admin/users` y `/admin/applications` son placeholders (gestión global de usuarios y solicitudes — esta última espera a que exista `application_requests`).

## 15. Instrucciones para futuras sesiones

1. Leer este archivo + `docs/13_CLAUDE_PROJECT_INSTRUCTIONS.md` (cómo trabajar) + `docs/14_PROJECT_INDEX.md` (qué doc leer por tarea).
2. Jerarquía ante contradicción: docs/13 §2 (el 00 manda).
3. Nunca: fusionar entidades del loop, inventar estados/reglas, API de WhatsApp, mutar estados críticos desde el cliente, comprobante sin fee pagado.
4. **Comandos de validación:** `npm run typecheck` · `npm run lint` · `npm run build` · dev: `npm run dev` (launch config `estured-dev` en `.claude/launch.json`).
5. **Resultado última validación (2026-07-07, Ciclo 5):** typecheck ✅ · lint ✅ · build ✅ (21 rutas) · e2e completo: registro de residencia → perfil → enviar para revisión → login como admin demo → `/admin/verifications` → checklist → "Aprobar y publicar" → `residences.status='verified_active'` confirmado → **RLS anónimo verificado: la residencia recién aprobada ya es visible para el rol `anon`** → auditoría completa en `/admin/logs` · sin tests automatizados aún (ver GAPS.md).
6. Al cerrar cada ciclo: validar, actualizar `MEMORY.md` + `docs/NEXT_STEPS.md`.
