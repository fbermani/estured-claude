# PROJECT.md — EstuRed

> Transferencia de conocimiento para ingenieros y agentes de IA que no conocen este proyecto.
> Última actualización: 2026-07-06, tras el commit `cf89302` (Ciclo 3, paso 1).
> Complementos: [GAPS.md](GAPS.md) (auditoría honesta de problemas) y [CLAUDE.md](CLAUDE.md) (guía operativa de sesión).

---

## 1. Descripción general

**Qué es.** EstuRed es una webapp responsive para conectar estudiantes (y sus familias) con residencias estudiantiles **verificadas presencialmente**, con mercado inicial en CABA (Buenos Aires). Hoy el repo contiene la **fase pre-lanzamiento**: landing pública, catálogo con datos mock, y una lista de espera con persistencia en Supabase (pendiente de aprovisionar).

**Para quién.** Tres audiencias: estudiantes que se mudan a CABA (del interior argentino o del exterior), sus familiares (que participan del proceso y a veces lo inician), y dueños/staff de residencias estudiantiles.

**Qué problema resuelve.** Hoy se busca residencia por Instagram, WhatsApp y referidos: fotos sin verificar, precios que cambian por chat, señas sin comprobante. EstuRed reemplaza eso con verificación presencial, solicitudes registradas, negociación estructurada y un comprobante de reserva verificable públicamente. **La consigna interna: la tecnología es el medio, la confianza es el producto.**

**Propósito del MVP** (definido en `docs/`, aún no construido en código): validar el loop completo — solicitud → contacto → negociación opcional → pago a residencia → fee EstuRed → factura fiscal → reserva confirmada → comprobante. Regla dura: **no existe "reserva confirmada" sin fee pagado**.

**Partes más importantes del producto hoy:**
1. La landing (`app/(public)/page.tsx`) — comunica la propuesta de confianza.
2. El catálogo y la ficha (`/search`, `/r/[slug]`) — la experiencia de descubrimiento.
3. La lista de espera (`/waitlist`) — única feature con backend real; captura leads pre-lanzamiento.
4. **La carpeta `docs/`** — 23 documentos estratégicos que son la fuente de verdad de producto. En este proyecto la documentación manda sobre el código, no al revés.

## 2. Stack tecnológico

| Pieza | Versión | Rol / por qué |
|---|---|---|
| Next.js (App Router) | ^15.3 (resuelve 15.5) | Framework único frontend+backend. Elegido en `docs/11 §3.1`: SSR/SSG para SEO de catálogo, Server Actions para lógica server-side. |
| React | ^19.1 | Requerido por Next 15; se usa `useActionState` (API de React 19) en el form de waitlist. |
| TypeScript (strict) | ^5.8 | Todo el código es TS. `tsconfig.json` con `strict: true`, alias `@/*` → raíz. |
| Tailwind CSS | ^4.1 | Estilos. **v4**: no hay `tailwind.config.js`; los tokens viven en `app/globals.css` bajo `@theme`. |
| @supabase/supabase-js + @supabase/ssr | ^2.110 / ^0.12 | Cliente de base de datos. Solo se usa `supabase-js` con service role (server-side); `@supabase/ssr` está instalado anticipando auth, **aún sin uso**. |
| server-only | ^0.0.1 | Guard de import: `lib/supabase/admin.ts` explota en build si se importa desde un client component. |
| ESLint 9 (flat config) | ^9.29 | `eslint.config.mjs` extiende `next/core-web-vitals` + `next/typescript` vía FlatCompat. |
| next/font (Manrope + Inter) | — | Manrope para display/títulos, Inter para texto. Cargadas en `app/layout.tsx`, expuestas como CSS vars. |

**No hay:** framework de tests, CI, state manager (no hace falta: casi todo es Server Components), librería de componentes externa (todo es propio), ni ORM (SQL crudo en `db/migrations/`).

**Integraciones futuras ya decididas** (en docs, no en código): MercadoPago + PayU (pagos del fee), monedapi.ar (tipo de cambio dólar blue), TusFacturas.app (factura fiscal), Supabase Auth/Storage/pg_cron, Vercel (hosting).

## 3. Arquitectura

### Estado actual (fase pre-lanzamiento)

```text
Visitante
  → app/(public)/*  (Server Components + layout con Navbar/Footer)
  → components/{ui,layout,residences}/*  (presentacional, sin lógica de negocio)
  → lib/mock/residences.ts  (datos mock en memoria — fuente de datos actual)
  → lib/mock/exchange.ts    (tipo de cambio FIJO mock: 1480 ARS/USD)

Formulario /waitlist (única ruta con backend real)
  → WaitlistForm.tsx ("use client", useActionState)
  → app/(public)/waitlist/actions.ts ("use server": validación + honeypot)
  → lib/supabase/admin.ts (cliente service-role, null si faltan env vars)
  → tabla waitlist_signups (RLS activa SIN policies → solo service role accede)
```

### Capas y carpetas

- `app/` — rutas. Route group `(public)` comparte layout Navbar+Footer. `app/students/`, `app/residence/`, `app/admin/` son **placeholders** de las tres áreas autenticadas futuras (el routing completo oficial está en `docs/11 §7` y debe respetarse al construirlas).
- `components/ui/` — primitivas (Button, Card, Badge, Input/Textarea/Select, StatusTag, SectionHeader, EmptyState, ComingSoon).
- `components/layout/` — Navbar, Footer.
- `components/residences/` — ResidenceCard, TrustBadge (dominio residencias).
- `lib/mock/` — datos mock. **Temporal por diseño**: se reemplaza por repositorios Supabase en el ciclo de catálogo real.
- `lib/supabase/` — clientes de DB (hoy solo `admin.ts`).
- `types/domain.ts` — modelos conceptuales públicos. Usa los **nombres de estado oficiales** de `docs/04_STATE_MACHINES.md` (`verified_active`, `real_by_place`, etc.) para que la migración a Supabase no rompa componentes.
- `db/migrations/` — SQL numerado (`0001_...`), se aplica manualmente en el SQL Editor de Supabase (no hay CLI instalada).
- `docs/` — los 23 documentos estratégicos (`00`–`22`) + 4 documentos técnicos generados en los ciclos (`CLAUDE_CODE_AUDIT`, `PRODUCT_IMPLEMENTATION_PLAN`, `NEXT_STEPS`, `VISUAL_UX_AUDIT`).
- `MEMORY.md` (raíz) — bitácora ejecutiva viva entre sesiones de IA. Se actualiza al cierre de cada ciclo.
- `design-references/` — 10 pantallas Stitch (inspiración, no spec). ⚠️ 8 de los 10 `screen.png` están corruptos; los `code.html` son la referencia utilizable.

### Arquitectura objetivo (para no diseñarla dos veces)

`docs/11_TECH_ARCHITECTURE.md` define la estructura completa a la que converge el repo: `modules/` por dominio, `server/{actions,services,repositories,policies,integrations}`, abstracciones `PaymentProvider`/`ExchangeRateProvider`/`FiscalInvoiceProvider`/`NotificationProvider`, RLS por rol con aislamiento multi-residencia. Las carpetas se crean cuando llega su contenido — no hay carpetas vacías.

## 4. Decisiones de diseño inferidas y explícitas

Casi todas las decisiones están **documentadas, no inferidas** (rareza de este proyecto — hay registro en `MEMORY.md` y `docs/`):

1. **Docs mandan.** Jerarquía ante contradicción en `docs/13 §2`: `00_DECISION_LOG.md` > reglas de negocio > estados > permisos > legal > alcance MVP. El código nunca "corrige" una decisión de producto silenciosamente.
2. **Re-secuenciación deliberada.** Los docs ordenaban infra primero; el dueño pidió landing/visual primero. Documentado en `docs/CLAUDE_CODE_AUDIT.md §6.1`. Mitigación: el código respeta routing, estados y copy oficiales para que nada se tire.
3. **Estados oficiales como tipos.** `types/domain.ts` no inventa enums: replica `docs/04`. El copy de cara al usuario nunca muestra el estado técnico (traducción centralizada en `StatusTag.tsx`).
4. **Server-side siempre.** La única mutación existente (`submitWaitlist`) valida todo en el servidor y la tabla es inaccesible para el rol anónimo. Este patrón es obligatorio para todo lo que venga (`docs/11 §5.2`).
5. **Design tokens propios, sin librería UI.** Paleta de marca (petróleo `#0F5C7A`, salvia `#7CB89C`, arena `#F4F1EB`, ámbar `#F5B041`) definida en `@theme` de `globals.css`. Decisión del ciclo 2: rechazar el azul genérico de las referencias Stitch.
6. **Copy legalmente prudente.** Nunca prometer disponibilidad ni garantías ("solicitud sujeta a confirmación"); "Soporte", no "mediación"; EstuRed es intermediaria. Esto es regla de `docs/08` y `docs/10`, no estilo.
7. **Mock con contrato real.** Los mocks replican las 6 residencias seed obligatorias de `docs/17`, con la interfaz `Residence` que sobrevivirá a la migración a DB.

## 5. Rutas críticas del codebase

### Load-bearing — no tocar sin entender las consecuencias

| Ruta | Por qué es delicada |
|---|---|
| `docs/00`–`22` (los 23 estratégicos) | Fuente de verdad de producto. **Solo se modifican siguiendo el protocolo de `docs/13 §5`** (proponer → aprobar → actualizar doc → recién después código). |
| `types/domain.ts` | Contrato de datos de toda la UI pública. Los strings de estado deben coincidir con `docs/04`. Cambiarlos rompe `StatusTag`, mocks y filtros de búsqueda. |
| `components/ui/StatusTag.tsx` | Único lugar con el copy oficial de disponibilidad (`docs/08 §4.5`). Cambiar estos textos es una decisión de producto, no de estilo. |
| `app/(public)/waitlist/actions.ts` | Única lógica de negocio server-side. La validación server-side y el manejo del código de error `23505` (duplicado = éxito idempotente) son intencionales. |
| `lib/supabase/admin.ts` | Devuelve `null` sin env vars (degradación intencional, no bug). El `import "server-only"` es una barrera de seguridad: no quitarla. |
| `db/migrations/0001_waitlist_signups.sql` | RLS **sin policies es intencional**: nadie salvo service role accede. Agregar una policy "para que funcione" abriría la tabla de PII al público. |
| `app/globals.css` | Todos los tokens del design system. Renombrar una variable `--color-*` rompe clases en todos los componentes. |
| `MEMORY.md` | Memoria entre sesiones de IA. Actualizarla al cerrar ciclos; no borrarla. |

### Seguras de modificar superficialmente

- Copy y secciones de `app/(public)/page.tsx`, `for-students/`, `for-residences/` (respetando la regla de no prometer disponibilidad).
- Contenido editorial de `lib/mock/residences.ts` (descripciones, servicios, fotos) — mientras se respete la interfaz y las 6 seeds de `docs/17`.
- Estilos internos de componentes visuales (`Card`, `Badge`, `SectionHeader`, `EmptyState`, `ComingSoon`, `Footer`).
- `docs/NEXT_STEPS.md` y documentos técnicos generados (se actualizan cada ciclo).

## 6. Cosas no obvias (leer antes de la primera modificación)

1. **`/waitlist` no existe en el routing oficial.** Es una adición pre-lanzamiento; el routing canónico (`docs/11 §7`) no la incluye. Al operar, la lista de espera real es por residencia. No confundir `waitlist_signups` (leads pre-lanzamiento) con la futura tabla de lista de espera por residencia de `docs/06`.
2. **Los CTAs "Enviar solicitud de reserva" apuntan a `/waitlist`.** Placeholder deliberado hasta que exista auth. No es un bug de link.
3. **El tipo de cambio es FALSO.** `lib/mock/exchange.ts` hardcodea 1480 ARS/USD. Todos los precios en ARS del sitio derivan de ahí. En producción va `ExchangeRateProvider` + monedapi.ar + modal obligatorio (`docs/08 §2.8`).
4. **"Residencia Pendiente" no aparece en el catálogo a propósito** (`published: false`): existe para probar el filtrado de no-publicadas. Si "falta una residencia", es esto.
5. **`residencia-alertas` tiene slug distinto a su nombre** ("Residencia del Parque"): el slug viene del seed oficial de `docs/17`; el nombre se cambió por realismo editorial. No "corregir" la discrepancia.
6. **Marca: "EstuRed"**, nunca "EstuRED" (las referencias Stitch lo escriben mal; decisión confirmada por el dueño).
7. **No correr `npm run build` con el dev server levantado**: ambos escriben `.next/` y el dev server queda corrupto (`Cannot find module './697.js'`). Fix: parar el server, `rm -rf .next`, relanzar.
8. **`next-env.d.ts` es generado** por Next y está en `.gitignore` y en los ignores de ESLint. No editarlo ni "arreglar" su lint.
9. **Button `secondary` es ámbar, no salvia** (cambio del ciclo 2 para contraste sobre fondos petróleo). El nombre puede sugerir "color secundario de marca" (salvia); no lo es.
10. **`Input.tsx` exporta tres componentes** (`Input`, `Textarea`, `Select`) desde un solo archivo. Buscar `Select` en `Select.tsx` no encontrará nada.
11. **Prohibiciones duras de producto** (no negociables sin el dueño): no integrar la API de WhatsApp Business bajo ninguna circunstancia; no fusionar propuesta/solicitud/negociación/pago/fee/reserva/factura/comprobante; no confirmar reservas sin fee pagado.
12. **Pendientes del Ciclo 3 en manos del dueño:** crear repo GitHub remoto (no hay `git remote`) y aprovisionar Supabase + `.env.local` (no existe aún). Hasta entonces, el form de waitlist responde con un error amigable.
