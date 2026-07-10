# GAPS.md — Auditoría técnica honesta de EstuRed

> Estado al 2026-07-06 (commit `cf89302`). Ordenado por severidad.
> Contexto de arquitectura en [PROJECT.md](PROJECT.md); guía operativa en [CLAUDE.md](CLAUDE.md).
> Nota de calibración: el proyecto tiene ~2 días de código y es pre-lanzamiento. Varios gaps son **etapa esperada**, no negligencia — se marcan igual, sin suavizar, porque el próximo agente necesita saber qué falta de verdad.

---

## [Severidad: Media] `createAuditLog` nunca lanza, ni siquiera en flujos de pago

**Dónde vive:** `lib/audit.ts` — el propio comentario del archivo ya lo marca: *"Nunca lanza: una falla de auditoría se loggea pero no rompe la operación del usuario. (Trade-off aceptado para el MVP; revisar al llegar a pagos, donde auditar es condición de la transacción.)"*

**Qué ocurre:** llegamos a pagos (Ciclo 10-11: `markResidencePaymentReceived`, `markFeePaidManually`, `confirmReservationAfterFeePaid`) y no se revisó — sigue siendo "best effort". Si un insert en `audit_logs` falla silenciosamente en el momento de confirmar un pago o una reserva, la operación de negocio se completa igual sin dejar rastro auditable.

**Por qué importa:** para transacciones de dinero (aunque hoy sean manuales), la trazabilidad no debería ser opcional. Es una decisión de producto pendiente, no un bug — cambiar el comportamiento global de `createAuditLog` afecta ~20 call sites, así que no se tocó en este ciclo sin decisión explícita del dueño.

**Fix sugerido:** decidir con el dueño si en las acciones de pago/reserva/fee específicamente el fallo de auditoría debería revertir la transacción (o al menos alertar a un admin), sin cambiar el comportamiento default para el resto de las ~20 acciones que ya usan `createAuditLog`.

---

## [RESUELTO — 2026-07-09] Residencia de prueba del Ciclo 10 quedó visible en el catálogo real

**Qué era:** durante el e2e del Ciclo 10 (pago a residencia) quedaron 3 residencias de prueba en `verified_active` (1 usada para el test + 2 huérfanas de intentos fallidos del script de setup) — los scripts de limpieza automáticos fueron bloqueados por el clasificador de auto-mode del sandbox (interpretó los deletes acotados por ID exacto como "mass delete"/"bypass").

**Fix aplicado:** el dueño corrió el DELETE manualmente en el SQL Editor de Supabase (orden por FK documentado en `MEMORY.md` §13sexies). Catálogo real verificado en 0 residencias tras la limpieza.

**Pendiente relacionado (no bloqueante):** habilitar en `.claude/settings.json` un permiso de Bash acotado para scripts de limpieza de datos de prueba por ID, para no depender de intervención manual en cada ciclo que genere datos de e2e.

---

## [Severidad: Alta] El repositorio no tiene remoto — todo el trabajo vive en una sola máquina

**Dónde vive:**
- `.git/` (local, 2 commits, `git remote -v` vacío)

**Qué ocurre:**
El proyecto está versionado localmente pero sin remoto. Un fallo de disco o un borrado accidental de la carpeta pierde el 100% del trabajo (código + 23 documentos estratégicos irreproducibles).

**Por qué importa:**
Es el único punto de falla total del proyecto. Los documentos estratégicos son más valiosos que el código: representan meses de decisiones de producto.

**Fix sugerido:**
Crear repo privado en GitHub (`github.com/new`, sin README inicial) y ejecutar `git remote add origin <URL> && git push -u origin main`. Está instruido y pendiente del dueño desde el Ciclo 3. Es la tarea nº 1 del proyecto.

---

## [Severidad: Alta] La única feature con backend apunta a una base de datos que no existe

**Dónde vive:**
- `lib/supabase/admin.ts` (devuelve `null` sin env vars)
- `app/(public)/waitlist/actions.ts` (rama "Todavía estamos conectando la base de datos")
- `db/migrations/0001_waitlist_signups.sql` (sin aplicar en ningún Supabase)
- `.env.local` (no existe)

**Qué ocurre:**
El formulario de lista de espera valida y responde, pero todo envío termina en el error amigable de "base no conectada". La migración SQL nunca se aplicó porque el proyecto Supabase no fue creado.

**Por qué importa:**
Si se deploya así, la única conversión del sitio (captar leads) falla silenciosamente para el negocio: los usuarios ven un error y no queda registro de nadie. Además bloquea el resto del Ciclo 3 (auth, roles, RLS).

**Fix sugerido:**
(1) Dueño crea proyecto en supabase.com y completa `.env.local` según `.env.example`. (2) Aplicar `db/migrations/0001_waitlist_signups.sql` en el SQL Editor. (3) Probar el form end-to-end y verificar la fila en Table Editor. Instrucciones completas ya escritas en la conversación del Ciclo 3 y en `docs/NEXT_STEPS.md`.

---

## [Severidad: Media — parcialmente resuelto Ciclo 12, 2026-07-09] Cero tests de integración en los flujos de pago/reserva

**Qué era:** cero tests automatizados en todo el proyecto pese a que los Ciclos 10-11 ya shippearon lógica real de dinero (pago a residencia, fee EstuRed, confirmación de reserva) — señalado como severidad Alta porque `docs/16_QA_AND_TESTING_PLAN.md` exige tests por módulo y "auth y pagos sin tests serían inaceptables".

**Fix aplicado (Ciclo 12):** `npm i -D vitest` + script `"test": "vitest run"` + `vitest.config.ts` (resolución nativa de `@/*` vía `resolve.tsconfigPaths`, sin plugin extra). Cobertura inicial en las funciones puras de más riesgo real — donde un bug silencioso cobraría mal a alguien: `lib/mock/exchange.test.ts` (redondeo USD/ARS a múltiplos de 5/500) y `lib/applications/fee.test.ts` (cálculo del fee 5%), este último con 2 tests de regresión que reproducen exactamente las cifras verificadas a mano en los e2e de los Ciclos 8 y 10 (`MEMORY.md` §13cuater/§13sexies) — si alguien rompe el redondeo o la fórmula, el test falla con el mismo número que ya se confirmó correcto en producción simulada.

**Actualización (Ciclo 13, 2026-07-09) — candidato principal resuelto:** `lib/reservations/confirmAfterFeePaid.test.ts` cubre `confirmReservationAfterFeePaid` (la Internal Action de mayor impacto: confirma reserva, cierra solicitudes hermanas, descuenta disponibilidad, genera comprobante) con un test de integración real contra el Supabase provisionado del proyecto — no hay `supabase start`/CLI local instalada (confirmado, sigue sin estar disponible), así que se optó por reusar el Supabase real con fixtures propias creadas y borradas en `beforeAll`/`afterAll` en vez de mockear el cliente, priorizando fidelidad a los bugs reales que este proyecto ya tuvo (RLS recursion, FK bidireccional, embeds PostgREST ambiguos) sobre velocidad. `describe.skipIf` salta el test si no hay credenciales (CI sin secrets). Requirió un alias en `vitest.config.ts` para neutralizar `server-only` (el paquete solo tiene sentido bajo el resolver especial de Next; en Node plano tira una excepción) — ver `vitest.server-only-stub.ts`.

**Qué sigue sin cobertura (gap real, no cerrado)**: `lib/applications/residencePayment.ts` y los server actions de pago/negociación/propuesta del familiar siguen sin tests automatizados, solo verificación manual e2e en navegador+DB cada ciclo. Extender el mismo patrón de test de integración cuando se toquen de nuevo.

**Fix sugerido siguiente:**
1. Test de mapeo de `availabilityCopy` en `components/ui/StatusTag.tsx` (los 4 estados oficiales tienen copy) — bajo esfuerzo, sigue pendiente.
2. Extender el patrón de integración de `confirmAfterFeePaid.test.ts` a `markResidencePaymentReceived` y `markFeePaidManually` cuando se vuelva a tocar esa zona.

---

## [Severidad: Media] Sin rate limiting ni protección real anti-spam en la waitlist

**Dónde vive:**
- `app/(public)/waitlist/actions.ts`

**Qué ocurre:**
La única protección es un honeypot (campo oculto `website`). Un script trivial que omita el honeypot puede insertar filas ilimitadas con emails únicos falsos.

**Por qué importa:**
Es una tabla de PII expuesta a escritura pública indirecta. Spam masivo = base de leads inservible y costos de storage. `docs/11 §3.3` delega rate limiting a criterio técnico, pero "ninguno" no es un criterio.

**Fix sugerido:**
Al conectar Supabase: rate limit simple por IP en la server action (contador en tabla `waitlist_rate_limits` o Upstash si se prefiere no reinventar; para el tráfico pre-lanzamiento basta un check de "máx. N inserts por IP por hora" contra la propia tabla usando una columna `ip_hash`). Alternativa mínima inmediata: CAPTCHA invisible (Cloudflare Turnstile, gratuito).

---

## [Severidad: Media] PII sin política de retención ni consentimiento formal

**Dónde vive:**
- `db/migrations/0001_waitlist_signups.sql` (guarda nombre, email, ciudad, mensaje libre)
- `app/(public)/waitlist/WaitlistForm.tsx` (microcopy: "Usamos tus datos solo para avisarte…")

**Qué ocurre:**
Se captura PII con una promesa informal en el microcopy, sin checkbox de consentimiento, sin link a política de privacidad (no existe página), sin proceso de borrado.

**Por qué importa:**
`docs/10_PRIVACY_AND_LEGAL_RULES.md` es estricto en consentimiento y minimización; Argentina tiene ley de protección de datos personales (25.326). Para una plataforma cuyo producto es la confianza, incumplir en el primer formulario es incoherente.

**Fix sugerido:**
Antes del deploy público: página `/privacy` mínima (los textos base están en `docs/10` y `docs/21`), link desde el form y el footer, y documentar en `docs/` cómo borrar un registro a pedido (un DELETE manual documentado alcanza en esta etapa).

---

## [RESUELTO — Ciclo 9, 2026-07-08] El tipo de cambio hardcodeado alimenta todos los precios visibles

**Qué era:** todos los montos en ARS derivaban de `MOCK_EXCHANGE_RATE_ARS_PER_USD = 1480` (constante inventada), sin el modal obligatorio de `docs/08 §2.8`.

**Fix aplicado:** `ExchangeRateProvider` real (`lib/exchange/provider.ts`, monedapi.ar — dólar blue, valor venta), caché diaria en `exchange_rates` (migración 0009) con degradación en cascada (`lib/exchange/rate.ts`: override manual > fila del día > último valor conocido > mock como último recurso), y el modal/tooltip obligatorio (`components/ui/ExchangeRateNote.tsx`) en ficha de residencia, catálogo, negociación y perfil de residencia. Verificado e2e: tasa real (1520 ARS/USD el día de la verificación) cacheada sin duplicados y consistente en las 6+ pantallas que muestran USD→ARS.

**Pendiente menor no bloqueante:** la UI de admin `/admin/exchange-rate` (docs/09 §25: forzar actualización, override manual con motivo, quitar override, histórico) no se construyó — el override solo es posible hoy insertando una fila manualmente en Supabase. Ver `MEMORY.md` §14.

---

## [Severidad: Media] Mocks importados directamente por la UI en 4 archivos

**Dónde vive:**
- `app/(public)/page.tsx`, `app/(public)/r/[slug]/page.tsx`, `app/(public)/search/SearchCatalog.tsx` importan de `lib/mock/residences.ts`
- `components/residences/ResidenceCard.tsx` importa `lib/mock/exchange.ts`

**Qué ocurre:**
No hay capa de repositorio: las páginas llaman helpers del mock (`getPublishedResidences()`, etc.). Migrar a Supabase exigirá tocar los 4 call sites (y `SearchCatalog` es client component: no podrá llamar a la DB directamente — habrá que mover el fetch al server y pasar props, o crear una API).

**Por qué importa:**
Es el acoplamiento que hará más ruidoso el ciclo de catálogo real. La interfaz `Residence` amortigua el golpe (los componentes no cambian), pero el fetching sí cambia de forma.

**Fix sugerido:**
Al iniciar el ciclo de catálogo real: crear `server/repositories/residences.ts` con la misma firma que los helpers del mock, cambiar los imports (4 archivos), y convertir `SearchCatalog` para recibir `residences` por props desde el Server Component padre (el filtrado client-side puede quedarse).

---

## [Severidad: Media] `Residence.photos` sin garantía de elemento — acceso `photos[0]` sin guard

**Dónde vive:**
- `components/residences/ResidenceCard.tsx` (`residence.photos[0]`)
- `app/(public)/r/[slug]/page.tsx` (`photos[0]` con `priority`, y `photos.slice(1, 3)`)
- `types/domain.ts` (`photos: string[]` — permite `[]`)

**Qué ocurre:**
Con los mocks nunca pasa (todas tienen ≥1 foto), pero el tipo permite un array vacío. Con datos reales de residencias (carga manual por owners), `photos[0]` como `undefined` rompe `next/image` en runtime.

**Por qué importa:**
Es exactamente el tipo de bug que aparece el día que entra la primera residencia real con perfil incompleto — el peor momento.

**Fix sugerido:**
Pequeño y seguro: en `ResidenceCard` y la ficha, renderizar un placeholder de marca (bloque `bg-sand-200` con monograma) cuando `photos.length === 0`. Alternativa de tipo: `photos: [string, ...string[]]` y validar al ingestar. Hacerlo junto con el ciclo de catálogo real.

---

## [Severidad: Media] Dashboards placeholder duplican el layout a mano

**Dónde vive:**
- `app/students/dashboard/page.tsx` y `app/residence/dashboard/page.tsx` (ambos repiten `<Navbar/> + <main> + <Footer/>`)
- `app/admin/dashboard/page.tsx` (sin layout alguno)

**Qué ocurre:**
Las áreas `students/` y `residence/` no tienen `layout.tsx`; cada page arma la cáscara manualmente. Es la única duplicación estructural del repo.

**Por qué importa:**
Bajo impacto hoy (son placeholders), pero al construir las áreas reales, alguien puede copiar el patrón duplicado en vez de crear los layouts por área que `docs/12` Fase 0 ya pedía ("layout base público, autenticado y admin").

**Fix sugerido:**
Al iniciar el ciclo de auth: crear `app/students/layout.tsx`, `app/residence/layout.tsx` y `app/admin/layout.tsx` (con la protección de rutas ahí mismo) y limpiar las pages. No vale la pena hacerlo antes.

---

## [Severidad: Baja] Formulario "Sí" de accesibilidad a medias en Navbar mobile y FAQ

**Dónde vive:**
- `components/layout/Navbar.tsx` (menú mobile: sin `aria-controls`, sin cierre con Escape, sin focus trap)
- `app/(public)/page.tsx` (FAQ con `<details>`: correcto y nativo, pero el indicador «+» es solo visual)

**Qué ocurre:**
Interacciones funcionales pero con soporte de teclado/lectores incompleto en el menú mobile.

**Por qué importa:**
Público objetivo incluye familias; accesibilidad razonable es parte de "confianza". Bajo impacto actual por tráfico cero.

**Fix sugerido:**
Añadir `aria-controls`/`id` al panel mobile y cierre con `Escape` (un `onKeyDown` en el header). 15 minutos, sin riesgo.

---

## [Severidad: Baja] Imágenes placeholder incoherentes y dependencia externa en `next.config.ts`

**Dónde vive:**
- `lib/mock/residences.ts` (URLs `picsum.photos` aleatorias — una residencia de San Telmo muestra una playa)
- `next.config.ts` (`remotePatterns` permite `picsum.photos`)

**Qué ocurre:**
Las fotos aleatorias no representan residencias y a veces son absurdas para el contexto; además el build/preview depende de un servicio externo.

**Por qué importa:**
En demos con residencias o familias reales, la foto de playa socava la percepción de producto serio (señalado en `docs/VISUAL_UX_AUDIT.md §13`).

**Fix sugerido:**
Elegir 12–15 fotos libres coherentes (Unsplash: habitaciones/fachadas/espacios comunes), guardarlas en `public/mock/`, actualizar los mocks y **quitar** `picsum.photos` de `next.config.ts`.

---

## [Severidad: Baja] Referencias de diseño corruptas en el repo

**Dónde vive:**
- `design-references/stitch_estured_mvp_1ra parte/*/screen.png` — 8 de 10 son texto de error de 28 bytes (`<FIFE Image failed to fetch>`)

**Qué ocurre:**
Las descargas de Stitch fallaron; solo `bienvenida_y_onboarding` y `search_results_2` tienen PNG válido. Los `code.html` están completos y son la referencia usable.

**Por qué importa:**
Un futuro agente puede perder tiempo intentando "leer" esos PNG (ya pasó en el Ciclo 2). Además el repo versiona archivos basura.

**Fix sugerido:**
Re-exportar los PNG desde Stitch, o borrar los 8 corruptos y dejar nota en un `design-references/README.md` de una línea ("usar code.html; PNGs válidos solo en X e Y").

---

## [Severidad: Baja] `seed-demo-users.mjs` no crea vínculo familiar activo

**Dónde vive:** `scripts/seed-demo-users.mjs` (solo crea `student_profiles` para roles `student`) y `lib/dev/demo-users.ts` (descripción de Martín: "vinculación: próxima etapa").

**Qué ocurre:** el familiar demo (Martín, `padre.lucia@example.com`) no tiene fila en `family_members` ni `family_links` — la vinculación real con Lucía nunca se completó en el seed. La descripción del selector de sesión simulada quedó desactualizada desde antes del Ciclo 6 (cuando el vínculo familiar se terminó de construir).

**Por qué importa:** cualquier e2e futuro sobre flujos de familiar (propuestas, pagos, documentos) tiene que crear el vínculo a mano con un script ad hoc en vez de tener el demo listo para usar.

**Fix sugerido:** extender `seed-demo-users.mjs` para crear `family_members` + `family_links` (`status='active'`) entre Martín y Lucía, y actualizar la descripción en `lib/dev/demo-users.ts`.

---

## [Severidad: Baja] Inconsistencias menores de convención

**Dónde vive / qué ocurre:**
1. `components/ui/Input.tsx` exporta 3 componentes (`Input`, `Textarea`, `Select`) mientras el resto es un-componente-por-archivo.
2. `className` se concatena a mano en todos los componentes (`${className}`): dos clases Tailwind en conflicto (ej. `p-5` + `p-8`) quedan ambas y gana el orden del CSS, no el llamador. No hay `tailwind-merge`.
3. `docs/NEXT_STEPS.md` mezcla sección vigente (Ciclo 2/3) con histórico (Ciclo 0) en un solo archivo — funcional pero fácil de leer mal.
4. `Badge` (genérico) vs `StatusTag`/`TrustBadge` (semánticos): la frontera es intencional pero no está escrita en ningún lado salvo aquí y en CLAUDE.md.

**Por qué importa:**
Ninguna rompe nada hoy; todas son fuentes de fricción para quien entra nuevo.

**Fix sugerido:**
(1) y (4): documentado en CLAUDE.md — no refactorizar. (2): si los conflictos de clase empiezan a doler, `npm i tailwind-merge` y envolver la concatenación en `twMerge()` — cambio mecánico en ~8 componentes. (3): mover el histórico del Ciclo 0 al final del archivo o a `docs/archive/`.

---

## Trabajo incompleto conocido (intencional, no descuido)

| Qué | Estado | Dónde retomarlo |
|---|---|---|
| Push a GitHub | Esperando que el dueño cree el repo | Instrucciones en la conversación del Ciclo 3 |
| Supabase + `.env.local` | Esperando aprovisionamiento del dueño | `.env.example` + `db/migrations/0001` |
| Auth + roles + RLS + audit log | Siguiente paso del Ciclo 3 tras credenciales | `docs/12` Fase 1, `docs/PRODUCT_IMPLEMENTATION_PLAN.md` Ciclo 1 |
| Deploy a Vercel | Tras el push a GitHub | `docs/15` |
| UI de admin `/admin/exchange-rate` | No construida — ver ítem resuelto arriba | `docs/09 §25` |

Nota (2026-07-08): esta tabla y el resto de esta sección quedaron desactualizados como snapshot del Ciclo 0-1 — varios ítems (push a GitHub, Supabase, auth+RLS, deploy) ya están resueltos hace varios ciclos. `MEMORY.md` es la fuente de verdad viva; los ítems con encabezado `[RESUELTO — Ciclo N]` arriba en este archivo reflejan el estado real más reciente.

No hay TODOs/FIXMEs en el código (verificado por grep) — la deuda está documentada aquí y en `MEMORY.md`, no dispersa en comentarios.
