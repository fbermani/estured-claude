# GAPS.md — Auditoría técnica honesta de EstuRed

> Estado al 2026-07-06 (commit `cf89302`). Ordenado por severidad.
> Contexto de arquitectura en [PROJECT.md](PROJECT.md); guía operativa en [CLAUDE.md](CLAUDE.md).
> Nota de calibración: el proyecto tiene ~2 días de código y es pre-lanzamiento. Varios gaps son **etapa esperada**, no negligencia — se marcan igual, sin suavizar, porque el próximo agente necesita saber qué falta de verdad.

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

## [Severidad: Alta] Cero tests y cero framework de testing

**Dónde vive:**
- No existe `tests/`, ni `vitest.config.*`, ni `jest.config.*`; `package.json` no tiene script `test`.

**Qué ocurre:**
Ninguna línea del proyecto tiene validación automática. Hasta el Ciclo 2 era defendible (solo UI estática); desde `submitWaitlist` ya hay lógica de negocio server-side sin tests.

**Por qué importa:**
`docs/16_QA_AND_TESTING_PLAN.md` exige tests por módulo y `docs/13 §6` (Definition of Done) exige validación. La deuda crece con cada server action nueva; auth y pagos sin tests serían inaceptables.

**Fix sugerido (en orden):**
1. `npm i -D vitest @vitejs/plugin-react` + script `"test": "vitest"`.
2. Primer archivo: tests de `submitWaitlist` — rol inválido, email inválido, honeypot completo (debe devolver éxito falso), longitudes excedidas, env ausente, duplicado `23505` → éxito.
3. Segundo: test de mapeo de `availabilityCopy` en `components/ui/StatusTag.tsx` (los 4 estados oficiales tienen copy).
4. Tercero: `getPublishedResidences`/`getResidenceBySlug` filtran `published: false`.

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

## [Severidad: Media] El tipo de cambio hardcodeado alimenta todos los precios visibles

**Dónde vive:**
- `lib/mock/exchange.ts` (`MOCK_EXCHANGE_RATE_ARS_PER_USD = 1480`)
- Consumido por: `components/residences/ResidenceCard.tsx`, `app/(public)/r/[slug]/page.tsx`

**Qué ocurre:**
Todos los montos en ARS del sitio derivan de una constante inventada. El disclaimer "referencial" existe, pero el modal explicativo de tipo de cambio que `docs/08 §2.8` marca como **OBLIGATORIO** no está implementado.

**Por qué importa:**
Si el sitio se muestra a residencias o familias reales con un dólar desactualizado, daña exactamente la confianza que el producto vende. Y el requisito del modal es de cumplimiento obligatorio según los docs.

**Fix sugerido:**
En el ciclo de catálogo real: implementar `ExchangeRateProvider` (monedapi.ar, tabla diaria en DB, override admin — `docs/11 §14`) + el modal obligatorio. Mientras tanto, si se hace demo pública, actualizar la constante a mano el mismo día.

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
| Modal de tipo de cambio obligatorio | Con `ExchangeRateProvider` real | `docs/08 §2.8` |
| `@supabase/ssr` instalado sin uso | Anticipa auth; no es dead code permanente | Se usa al construir login |
| Rutas `/login` y `/register` como `ComingSoon` | Placeholder hasta auth | `docs/08 §5` |

No hay TODOs/FIXMEs en el código (verificado por grep) — la deuda está documentada aquí y en `MEMORY.md`, no dispersa en comentarios.
