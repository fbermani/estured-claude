# EstuRed

Plataforma de confianza para residencias estudiantiles en CABA: buscar, comparar, solicitar y reservar con respaldo.

> La convivencia también se elige.

## Estado

**Ciclo Fundacional 0 completado** — landing pública, catálogo con datos mock y sistema de diseño. Sin base de datos ni autenticación todavía (próximo ciclo).

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run build      # build de producción
```

## Documentación

- **`/docs`** — los 23 documentos estratégicos (`00`–`22`) son la fuente de verdad de producto. Orden de lectura y jerarquía: `docs/13_CLAUDE_PROJECT_INSTRUCTIONS.md`.
- **`/MEMORY.md`** — bitácora ejecutiva del estado real del proyecto entre sesiones.
- **`docs/CLAUDE_CODE_AUDIT.md`** — auditoría inicial y decisiones del ciclo 0.
- **`docs/PRODUCT_IMPLEMENTATION_PLAN.md`** — plan por ciclos.
- **`docs/NEXT_STEPS.md`** — próximos pasos priorizados.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · React 19. Próximos ciclos: Supabase (PostgreSQL, Auth, Storage), Vercel.
