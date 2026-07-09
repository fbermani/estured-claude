# CLAUDE.md — Guía operativa de EstuRed

Guía para sesiones de Claude Code (u otro agente) en este repo. Leer también:
- **`MEMORY.md`** — estado real del proyecto y última tarea recomendada. Leerlo SIEMPRE al iniciar.
- **`PROJECT.md`** — arquitectura, decisiones y rutas críticas.
- **`GAPS.md`** — deuda técnica conocida y fixes sugeridos.
- **`docs/13_CLAUDE_PROJECT_INSTRUCTIONS.md`** — protocolo de trabajo oficial (fases pequeñas, ambigüedades, Definition of Done).
- **`docs/14_PROJECT_INDEX.md`** — qué documento estratégico leer según la tarea.

## Modo de colaboración (decisión del dueño, 2026-07-08)

- **Los `docs/00`–`22` son una guía fuerte, no un dogma irrefutable.** Se espera análisis propio: si algo ahí parece mejorable, inconsistente o subóptimo, decirlo y proponer una alternativa concreta — no implementar en silencio algo que se considera un error solo porque "así dice el doc". Esto no reemplaza el protocolo de ambigüedades de `docs/13 §4` (seguir proponiendo supuestos reversibles documentados cuando falta información) ni la jerarquía de `docs/13 §2` para contradicciones *entre* docs — se suma a ambos como una tercera capa: además de resolver ambigüedades y contradicciones, cuestionar activamente si la regla documentada es la mejor decisión de producto.
- **Antes de emprender un bloque de trabajo nuevo, evaluar qué skills de Claude Code ayudarían** (diseño de UI, revisión de código, verificación e2e, etc.) y decirlo explícitamente. Si una skill relevante no está instalada, pedirla antes de avanzar en vez de seguir sin ella.

## Comandos

```bash
npm install        # dependencias
npm run dev        # dev server en http://localhost:3000 (launch config "estured-dev" en .claude/launch.json)
npm run build      # build de producción
npm run lint       # ESLint 9 (flat config)
npm run typecheck  # tsc --noEmit
```

- **No hay script `test`** — no existe framework de testing todavía (ver GAPS.md).
- **No hay deploy configurado** — Vercel está decidido pero no conectado.
- ⚠️ **No correr `npm run build` con el dev server levantado**: ambos escriben `.next/` y el dev server se corrompe (`Cannot find module './NNN.js'`). Fix: parar server → `rm -rf .next` → relanzar.
- Migraciones: SQL manual en `db/migrations/` (numeradas `0001_...`), se aplican pegándolas en el SQL Editor del dashboard de Supabase. No hay supabase CLI instalada.

## Convenciones reales

- **Idioma:** UI y copy en español rioplatense (voseo: "buscá", "sumate"). Docs y commits en español. Marca: **"EstuRed"** (nunca "EstuRED").
- **Componentes:** PascalCase en `components/{ui,layout,residences}/`. Server Components por defecto; `"use client"` solo con interacción real (hoy: `Navbar`, `SearchCatalog`, `WaitlistForm`). Excepción de naming: `components/ui/Input.tsx` exporta `Input`, `Textarea` y `Select` (tres en un archivo).
- **Estilos:** Tailwind v4 — los tokens viven en `app/globals.css` bajo `@theme` (NO existe `tailwind.config.js`). Paleta: `petrol-*` (primario), `sage-*` (comunidad), `sand-*` (fondos), `amber-soft-*` (acento). Semánticos: `ink*`, `success/warning/danger/info-*`. Radios `rounded-card`/`rounded-field`, sombras `shadow-card`/`shadow-card-hover`/`shadow-float`. `className` se concatena a mano (sin tailwind-merge): evitar pasar clases que colisionen con las del componente.
- **Tipos de dominio:** `types/domain.ts`. Los strings de estado son los oficiales de `docs/04_STATE_MACHINES.md` — no inventar estados ni renombrarlos.
- **Datos:** hoy mocks en `lib/mock/` (contrato `Residence` estable); Supabase vía `lib/supabase/admin.ts` (service role, solo server). Toda mutación va por server action con validación server-side — el cliente nunca escribe estados directamente (`docs/11 §5.2`).
- **Errores de usuario:** mensajes en español, accionables, sin jerga técnica (ver `submitWaitlist`). Estados de UI: contemplar loading/empty/error siempre (`EmptyState` para vacíos).
- **Commits:** mensaje en español con prefijo de ciclo ("Ciclo N: ..."), co-autoría de Claude al pie.
- **Cierre de ciclo:** validar (`typecheck` + `lint` + `build`), actualizar `MEMORY.md` y `docs/NEXT_STEPS.md`.

## Gotchas

- **`docs/00`–`22` son la fuente de verdad de producto, no el código.** Ante contradicción entre docs: jerarquía de `docs/13 §2` (`00_DECISION_LOG.md` manda). Cambios de reglas de negocio: protocolo de `docs/13 §5` (doc primero, código después).
- **`/waitlist` no está en el routing oficial** (`docs/11 §7`): es pre-lanzamiento. Los CTAs "Enviar solicitud de reserva" siguen apuntando ahí porque el flujo de solicitud de reserva (`application_requests`) todavía no existe — no por falta de auth (auth sí existe desde el Ciclo 3).
- **El tipo de cambio es un mock hardcodeado** (`lib/mock/exchange.ts`, 1480 ARS/USD). Todos los precios ARS del sitio salen de ahí. No es dato real.
- **`waitlist_signups` tiene RLS sin policies a propósito**: solo el service role accede. No agregar policies "para que funcione" — abriría PII al público. Duplicado de email (`23505`) se trata como éxito, también a propósito.
- **`getSupabaseAdmin()` devuelve `null` sin env vars** — degradación intencional mientras el dueño no aprovisione Supabase. No "arreglarlo" con throws.
- **`published: false` en "Residencia Pendiente"** es un caso de prueba intencional del filtrado; el slug `residencia-alertas` ≠ nombre "Residencia del Parque" también es intencional (slug del seed oficial `docs/17`).
- **El copy de disponibilidad vive SOLO en `components/ui/StatusTag.tsx`** y es copy oficial de `docs/08 §4.5` — cambiarlo es decisión de producto.
- **`Badge` vs `StatusTag`/`TrustBadge`:** `Badge` es genérico visual; los otros dos son semánticos y llevan reglas de producto. No reemplazar unos por otros.
- **`design-references/`:** 8 de 10 `screen.png` están corruptos (texto de error). Usar los `code.html`. Son inspiración, no spec — y contienen copy PROHIBIDO por los docs ("reserva garantizada", "mediación", validación WhatsApp).
- **`next-env.d.ts` es generado** (gitignored + eslint-ignored). No editarlo.
- **Nunca llamar `supabase.auth.getUser()` directo en server code.** Usar siempre `getSafeUser(supabase)` de `lib/supabase/safe-get-user.ts`. Una cookie con un refresh token que Supabase ya no reconoce (usuario borrado, sesión de otro entorno) hace que `getUser()` lance una excepción **no capturada** que tumba el árbol de render entero — no el `{ data, error }` esperado. Ocurrió en producción local el 2026-07-08 (ver MEMORY.md §13bis).

## Reglas del proyecto (no negociables sin el dueño)

1. **No inventar reglas de negocio, estados, permisos ni flujos.** Si no está en `docs/`, preguntar (ambigüedad bloqueante) o proponer supuesto reversible documentado (`docs/13 §4`).
2. **Nunca** integrar la API de WhatsApp Business (solo botón manual pre-formateado, futuro).
3. **Nunca** fusionar propuesta del familiar / solicitud / negociación / pago a residencia / fee / reserva / factura fiscal / comprobante — entidades separadas siempre.
4. **Nunca** prometer disponibilidad ni garantías en el copy ("solicitud sujeta a confirmación"); decir "Soporte", no "mediación". EstuRed es plataforma intermediaria.
5. **Validación server-side para toda mutación**; secretos solo en `.env.local` (gitignored); `SUPABASE_SERVICE_ROLE_KEY` jamás en cliente (el `import "server-only"` de `lib/supabase/admin.ts` lo garantiza — no quitarlo).
6. **Archivos sensibles** (ver PROJECT.md §5): `types/domain.ts`, `StatusTag.tsx`, `app/globals.css` (tokens), `db/migrations/*`, `docs/*`. Cambios visuales superficiales son seguros en: pages públicas (copy), mocks editoriales, `Card`/`Badge`/`SectionHeader`/`EmptyState`/`Footer`.
7. Trabajar en **fases pequeñas y verificables**; al cerrar un bloque: `typecheck` + `lint` + `build` en verde y `MEMORY.md` actualizado.

## Referencias

- `PROJECT.md` — arquitectura completa, decisiones de diseño y rutas críticas.
- `GAPS.md` — deuda técnica, riesgos y fixes priorizados.
- `MEMORY.md` — bitácora viva: estado actual y próxima tarea recomendada.
- `docs/PRODUCT_IMPLEMENTATION_PLAN.md` — plan por ciclos mapeado a `docs/12_BUILD_PLAN.md`.
