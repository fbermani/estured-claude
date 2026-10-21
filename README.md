# EstuRed

Plataforma de confianza para residencias estudiantiles en CABA: buscar, comparar, solicitar y reservar con respaldo.

> La convivencia también se elige.

## Estado

**Pre-lanzamiento, desplegado en Vercel (https://estured.vercel.app).** El loop central funciona de punta a punta con datos reales en Supabase: catálogo y ficha de residencias verificadas, registro/login por rol (estudiante, familiar, residencia, admin), solicitud con snapshot, negociación, pago a la residencia, fee EstuRed (modo manual), reserva, comprobante PDF con QR verificable en `/verify`, renovaciones, lista de espera, residentes y panel admin. Pendiente: cobro automático (MercadoPago/PayU), Factura C real (TusFacturas.app) y lo marcado en `GAPS.md`. Estado vivo y última tarea: `MEMORY.md`.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run build      # build de producción
npm test           # Vitest (unitarios + integración; los de integración corren contra el proyecto Supabase de desarrollo)
```

Variables de entorno: copiar `.env.example` a `.env.local` y apuntarlo siempre al proyecto Supabase de **desarrollo** (`estured-dev`); producción vive solo en Vercel. Detalle y salvaguardas en `CLAUDE.md`.

## Documentación

- **`/docs`** — los 23 documentos estratégicos (`00`–`22`) son la fuente de verdad de producto. Orden de lectura y jerarquía: `docs/13_CLAUDE_PROJECT_INSTRUCTIONS.md`.
- **`/MEMORY.md`** — bitácora ejecutiva del estado real del proyecto entre sesiones.
- **`/GAPS.md`** — deuda técnica conocida; **`/PROJECT.md`** — arquitectura (parte desactualizada, ver su cabecera).
- **`docs/audits/`** — auditoría de producto 2026-10-20 y plan de acción (las decisiones D1–D11 quedaron en `docs/00` §31).
- **`docs/CLAUDE_CODE_AUDIT.md`** — auditoría inicial y decisiones del ciclo 0.
- **`docs/PRODUCT_IMPLEMENTATION_PLAN.md`** — plan por ciclos.
- **`docs/NEXT_STEPS.md`** — próximos pasos priorizados.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · React 19 · Supabase (PostgreSQL, Auth, Storage, pg_cron) · Vercel · Vitest · Resend (email) · `@react-pdf/renderer` (comprobantes).
