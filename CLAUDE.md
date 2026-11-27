# CLAUDE.md — Guía operativa de EstuRed

Guía para sesiones de Claude Code (u otro agente) en este repo. Leer también:
- **`MEMORY.md`** — estado real del proyecto y última tarea recomendada. Leerlo SIEMPRE al iniciar.
- **`PROJECT.md`** — arquitectura, decisiones y rutas críticas.
- **`GAPS.md`** — deuda técnica conocida y fixes sugeridos.
- **`docs/13_CLAUDE_PROJECT_INSTRUCTIONS.md`** — protocolo de trabajo oficial (fases pequeñas, ambigüedades, Definition of Done).
- **`docs/14_PROJECT_INDEX.md`** — qué documento estratégico leer según la tarea.
- **`.claude/estilo-respuestas.md`** — estilo obligatorio de todas las respuestas (frases de máximo 15 palabras, una idea por oración, sin relleno).

## Estilo de respuesta (obligatorio, todas las sesiones)

Aplicar `.claude/estilo-respuestas.md` a cada respuesta y documento nuevo: frases de máximo 15 palabras, una idea por oración, imperativo voseante para órdenes, un término por concepto, sin adjetivos, adverbios ni conectores de relleno, conclusión primero. No aplica a código, comandos, tablas ni al copy de la app.

## Modo de colaboración (decisión del dueño, 2026-07-08)

- **Los `docs/00`–`22` son una guía fuerte, no un dogma irrefutable.** Se espera análisis propio: si algo ahí parece mejorable, inconsistente o subóptimo, decirlo y proponer una alternativa concreta — no implementar en silencio algo que se considera un error solo porque "así dice el doc". Esto no reemplaza el protocolo de ambigüedades de `docs/13 §4` (seguir proponiendo supuestos reversibles documentados cuando falta información) ni la jerarquía de `docs/13 §2` para contradicciones *entre* docs — se suma a ambos como una tercera capa: además de resolver ambigüedades y contradicciones, cuestionar activamente si la regla documentada es la mejor decisión de producto.
- **Antes de emprender un bloque de trabajo nuevo, evaluar qué skills de Claude Code ayudarían** (diseño de UI, revisión de código, verificación e2e, etc.) y decirlo explícitamente. Si una skill relevante no está instalada, pedirla antes de avanzar en vez de seguir sin ella.

## Eficiencia de tokens (decisión del dueño, 2026-10-25)

- **Modelo/esfuerzo por tarea:** sonnet con esfuerzo low/medium por defecto; subir (opus/high) solo para diseño de arquitectura, seguridad o bugs difíciles. Recomendarlo antes de cada tarea nueva.
- **Delegar lecturas grandes** (auditorías, barridos de carpetas, docs largos) a agentes que devuelvan reportes de ≤10 líneas; no volcar archivos enteros al contexto principal.
- **Tests acotados:** correr solo los tests de lo tocado; la suite completa (`npm test`, ~5–7 min) solo antes de commits grandes o cambios transversales.
- **Un `npm run build` por commit**, con el dev server parado (y `rm -rf .next` si hubo cambios de componentes).
- **No reabrir decisiones ya tomadas** en `docs/00` §31 (D1–D11, DR1–DR16): se implementan; si se cree que una es un error, proponer la alternativa una vez, sin releer todo el debate.
- **Usar `codebase-memory` (search_graph, get_code_snippet, trace_path) antes de leer carpetas** o archivos enteros; `Read` con `offset`/`limit` para lo grande.
- **`MEMORY.md` se mantiene corto** (≤250 líneas): por ciclo, 2–4 líneas; el histórico íntegro vive en `docs/archive/MEMORY_HISTORICO_2026-10-25.md` y se consulta a demanda con el índice de `MEMORY.md` §7.
- **Avisar al dueño cuándo conviene `/compact` o una sesión nueva** (al cerrar un bloque, o cuando el contexto se llena de lecturas ya resueltas).

## Comandos

```bash
npm install        # dependencias
npm run dev        # dev server en http://localhost:3000 (launch config "estured-dev" en .claude/launch.json)
npm run build      # build de producción
npm run lint       # ESLint 9 (flat config)
npm run typecheck  # tsc --noEmit
npm test           # vitest run (unitarios + integración contra estured-dev)
```

- **`npm test` existe (Vitest, desde el Ciclo 12):** los `.test.ts` conviven junto al código. Los unitarios puros no necesitan Supabase; los de integración crean/borran filas reales y corren contra `estured-dev` (suite completa ~5–7 min, `fileParallelism: false`). `vitest.setup.ts` se niega a correr si `.env.local` apunta a producción. Si un test deja residuo: `node --env-file=.env.local scripts/cleanup-test-residences.mjs` (simula; `--apply` para borrar).
- **Deploy:** Vercel conectado al repo — cada push a `main` deploya a https://estured.com (usa `estured-prod`; la rama `staging` deploya a https://estured.vercel.app con `estured-dev`; el selector de sesión demo, `DEMO_LOGIN_ENABLED`, jamás va a Production; sí al Preview de la rama `staging`, ver `lib/dev/devUi.ts` y `docs/PLAN_SALIDA_PRODUCCION.md` A0.2).
- ⚠️ **No correr `npm run build` con el dev server levantado**: ambos escriben `.next/` y el dev server se corrompe (`Cannot find module './NNN.js'`). Fix: parar server → `rm -rf .next` → relanzar.
- Migraciones: SQL manual en `db/migrations/` (numeradas `0001_...`), se aplican pegándolas en el SQL Editor del dashboard de Supabase (en dev y en producción, por separado: aplicar una en un proyecto no la aplica en el otro). No hay supabase CLI instalada. Hoy: 0001–0110 (+0043b), aplicadas en dev y en prod (bootstrap del 2026-11-25); estado real en `MEMORY.md` §3.

## Convenciones reales

- **Reglas de diseño permanentes (2026-11-08):** tokens sin literales, `paper` en vez de blanco puro, contraste ≥ 4,5:1, foco visible, movimiento solo `transform`/`opacity`, tipografía mínima y tres pesos, etiquetas públicas sin mayúsculas, sin scroll horizontal a 320 px; además (Vercel + anti-slop): skip link y `h1` único, `ConfirmDialog` en vez de `confirm()`, `…`, `tabular-nums`, `aria-current`, dos radios (`card`/`field`), sin gradientes de lavado (excepción DR75: los fondos oscuros llevan textura, `surface-forest`), `rounded-full` solo en CTA/chips/avatares, una acción primaria por pantalla. Detalle y comandos de validación (sloplint) en la sección «Reglas de diseño permanentes» de `.claude/agents/disenador.md`; las aplican `disenador` e `interfaz`.

- **Idioma:** UI y copy en español rioplatense (voseo: "buscá", "sumate"). Docs y commits en español. Marca: **"EstuRed"** (nunca "EstuRED").
- **Componentes:** PascalCase en `components/{ui,layout,residences,applications,students,admin}/`. Server Components por defecto; `"use client"` solo con interacción real (hoy son unos 80 archivos: navegación, formularios, inbox/dashboards interactivos — no sumar uno por costumbre). Excepción de naming: `components/ui/Input.tsx` exporta `Input`, `Textarea` y `Select` (tres en un archivo).
- **Estilos:** Tailwind v4 — los tokens viven en `app/globals.css` bajo `@theme` (NO existe `tailwind.config.js`). Paleta: `petrol-*` (primario), `sage-*` (comunidad), `sand-*` (fondos), `amber-soft-*` (acento). Semánticos: `ink*`, `success/warning/danger/info-*`. Radios `rounded-card`/`rounded-field`, sombras `shadow-card`/`shadow-card-hover`/`shadow-float`. `className` se concatena a mano (sin tailwind-merge): evitar pasar clases que colisionen con las del componente.
- **Tipos de dominio:** `types/domain.ts`. Los strings de estado son los oficiales de `docs/04_STATE_MACHINES.md` — no inventar estados ni renombrarlos.
- **Datos:** reales, en Supabase (catálogo, solicitudes, reservas, comprobantes, residentes…) vía `lib/supabase/admin.ts` (service role, solo server) o el cliente del usuario (RLS). El mock de residencias ya no existe; en `lib/mock/` solo queda `exchange.ts` (constante de último recurso + helpers de formato/conversión USD↔ARS). Toda mutación va por server action con validación server-side — el cliente nunca escribe estados directamente (`docs/11 §5.2`).
- **Errores de usuario:** mensajes en español, accionables, sin jerga técnica (ver `app/(public)/login/actions.ts`). Estados de UI: contemplar loading/empty/error siempre (`EmptyState` para vacíos).
- **Commits:** mensaje en español con prefijo de ciclo ("Ciclo N: ..."), co-autoría de Claude al pie.
- **Cierre de ciclo:** validar (`typecheck` + `lint` + `build`), actualizar `MEMORY.md` y `docs/NEXT_STEPS.md`.

## Gotchas

- **`docs/00`–`22` son la fuente de verdad de producto, no el código.** Ante contradicción entre docs: jerarquía de `docs/13 §2` (`00_DECISION_LOG.md` manda). Cambios de reglas de negocio: protocolo de `docs/13 §5` (doc primero, código después).
- **`/waitlist` no está en el routing oficial** (`docs/11 §7`): era la lista de espera pre-lanzamiento; se borró el 2026-11-12 (DR31) y hoy solo queda el redirect a `/preregistro` (`next.config.ts`). El flujo real de solicitud vive en `/residencias/[slug]` (`application_requests`); `/r/[slug]` redirige ahí y `/residencias` redirige a `/search`. Routing real vs. `docs/08 §3`: ver nota de `docs/08 §3` (D9).
- **El tipo de cambio sale de `lib/exchange/rate.ts`** (monedapi.ar, dólar blue venta, caché diaria en `exchange_rates`; cascada: override manual del admin > fila del día > último valor conocido > constante de `lib/mock/exchange.ts` como último recurso). Los montos ARS **guardados** (fee, matrícula) usan `usdToArs`; el pago de la reserva se guarda redondeado a 500 (`usdToArsRounded`, DR72 (e)); la UI usa `usdToArsRounded` + `ExchangeRateNote`. La constante de 1480 ya no es la fuente de verdad.
- **`waitlist_signups` tiene RLS sin policies a propósito**: solo el service role accede. No agregar policies "para que funcione" — abriría PII al público. Duplicado de email (`23505`) se trata como éxito, también a propósito.
- **`getSupabaseAdmin()` devuelve `null` sin env vars** — degradación intencional mientras el dueño no aprovisione Supabase. No "arreglarlo" con throws.
- ~~`published: false` en "Residencia Pendiente" / slug `residencia-alertas`~~ — **superado:** eran del mock de residencias, que se retiró en el Ciclo 34undevicies; el filtrado de publicación hoy es `residences.status = 'verified_active'` (RLS pública).
- **El copy de disponibilidad vive SOLO en `components/ui/StatusTag.tsx`** y es copy oficial de `docs/08 §4.5` — cambiarlo es decisión de producto.
- **`Badge` vs `StatusTag`/`TrustBadge`:** `Badge` es genérico visual; los otros dos son semánticos y llevan reglas de producto. No reemplazar unos por otros.
- **`design-references/`:** decisión del dueño (2026-11-03): las referencias Stitch **ya cumplieron su rol** y no hay que imitarlas; el diseño actual de la app es la base y se puede mejorar libremente. Son solo material histórico. Si se reutiliza algo de ellas, el filtro de reglas de negocio sigue vigente: NO copy prohibido ("reserva garantizada", "mediación", validación WhatsApp), features inexistentes (chat, favoritos) ni datos falsos.
- **Columnas y tablas nuevas vs. RLS (0081):** columnas nuevas en `application_requests`, `application_negotiation_proposals`, `users` o `exchange_rates` necesitan `grant select (col)` a `authenticated` (0081 usa grants por columna); tablas nuevas con policies para `authenticated` necesitan su policy RESTRICTIVE `<tabla>_only_active_users`.
- **`next-env.d.ts` es generado** (gitignored + eslint-ignored). No editarlo.
- **Nunca llamar `supabase.auth.getUser()` directo en server code.** Usar siempre `getSafeUser(supabase)` de `lib/supabase/safe-get-user.ts`. Una cookie con un refresh token que Supabase ya no reconoce (usuario borrado, sesión de otro entorno) hace que `getUser()` lance una excepción **no capturada** que tumba el árbol de render entero — no el `{ data, error }` esperado. Ocurrió en producción local el 2026-07-08 (ver MEMORY.md §13bis).
- **Dos proyectos de Supabase, nunca mezclarlos (desde 2026-10-20).** `.env.local` apunta SIEMPRE al proyecto de desarrollo `estured-dev` (cuenta de Supabase distinta a la de producción); producción (`estured-prod`, ref `hioscbefryufsbypsmtx`) vive solo en las env vars de Vercel. Los tests de integración (`vitest.setup.ts`) y los seeds destructivos (`scripts/_assert-dev-project.mjs`) se niegan a correr contra los refs listados en `scripts/production-refs.json`. Para crear un admin real en producción usar `scripts/create-admin.mjs` con las credenciales de producción puestas solo en esa invocación. La migración 0013 (cron) NO se aplica en dev: el bootstrap de dev (`db/_generated/`, gitignored) la deja comentada.

## Reglas del proyecto (no negociables sin el dueño)

1. **No inventar reglas de negocio, estados, permisos ni flujos.** Si no está en `docs/`, preguntar (ambigüedad bloqueante) o proponer supuesto reversible documentado (`docs/13 §4`).
2. **Nunca** fusionar propuesta del familiar / solicitud / negociación / pago a residencia / fee / reserva / factura fiscal / comprobante — entidades separadas siempre.
3. **Nunca** prometer disponibilidad ni garantías en el copy ("solicitud sujeta a confirmación"); decir "Soporte", no "mediación". EstuRed es plataforma intermediaria.
4. **Validación server-side para toda mutación**; secretos solo en `.env.local` (gitignored); `SUPABASE_SERVICE_ROLE_KEY` jamás en cliente (el `import "server-only"` de `lib/supabase/admin.ts` lo garantiza — no quitarlo).
5. **Archivos sensibles** (ver PROJECT.md §5): `types/domain.ts`, `StatusTag.tsx`, `app/globals.css` (tokens), `db/migrations/*`, `docs/*`. Cambios visuales superficiales son seguros en: pages públicas (copy), mocks editoriales, `Card`/`Badge`/`SectionHeader`/`EmptyState`/`Footer`.
6. Trabajar en **fases pequeñas y verificables**; al cerrar un bloque: `typecheck` + `lint` + `build` en verde y `MEMORY.md` actualizado.

## Referencias

- `PROJECT.md` — arquitectura completa, decisiones de diseño y rutas críticas.
- `GAPS.md` — deuda técnica, riesgos y fixes priorizados.
- `MEMORY.md` — bitácora viva: estado actual y próxima tarea recomendada.
- `docs/PRODUCT_IMPLEMENTATION_PLAN.md` — plan por ciclos mapeado a `docs/12_BUILD_PLAN.md`.
- `docs/audits/AUDITORIA_2026-10-20.md` y `docs/audits/PLAN_ACCION_2026-10-20.md` — auditoría de producto (H01–H32), decisiones del dueño D1–D11 (registradas en `docs/00` §31) y plan por fases/agentes.
