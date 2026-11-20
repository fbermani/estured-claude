# CLAUDE_CODE_AUDIT.md

# EstuRed — Auditoría inicial del proyecto (Ciclo Fundacional 0)

**Fecha:** 2026-07-05
**Autor:** Claude Code (ciclo fundacional)
**Estado:** Ciclo 0 ejecutado — ver sección 11 para lo implementado

---

## 1. Resumen general del estado del proyecto

Al iniciar este ciclo, el proyecto era **100% documentación estratégica**: 23 documentos (`00` a `22`, ~900 KB) auditados internamente y marcados como listos para handoff, **sin una línea de código, sin repositorio git, sin dependencias**.

La documentación es excepcionalmente madura para un proyecto pre-código: decisiones de producto consolidadas con jerarquía documental explícita, modelo de datos completo, máquinas de estado, matriz de permisos, spec de API, spec de pantallas, plan de fases, seed data y plantillas legales.

Al cerrar este ciclo, el proyecto tiene una base técnica funcional (Next.js 15 + TypeScript + Tailwind 4), identidad visual aplicada, landing pública, catálogo con mocks, componentes reutilizables y validación completa (typecheck/lint/build en verde).

## 2. Stack detectado / confirmado

No había código, por lo que el stack se toma del confirmado en `docs/11_TECH_ARCHITECTURE.md` §3.1 y `docs/12_BUILD_PLAN.md` §3:

| Capa | Tecnología | Estado en ciclo 0 |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript | ✅ Implementado (Next 15.5, React 19) |
| UI | Tailwind CSS (v4) + componentes propios | ✅ Implementado |
| Backend | Next.js Server Actions / Route Handlers | ⏳ Próximos ciclos |
| Base de datos | Supabase / PostgreSQL + RLS | ⏳ Próximos ciclos |
| Auth | Supabase Auth | ⏳ Próximos ciclos |
| Hosting | Vercel | ⏳ Pendiente deploy |
| Pagos | `PaymentProvider` (MercadoPago ARS + PayU USD) | ⏳ Fases 6-7 |
| Tipo de cambio | `ExchangeRateProvider` (monedapi.ar, blue venta) | Mock fijo en ciclo 0 |
| Facturación | `FiscalInvoiceProvider` (TusFacturas.app) | ⏳ Fase 7 |
| Jobs | Supabase pg_cron | ⏳ Próximos ciclos |

## 3. Estructura actual (post-ciclo 0)

```
EstuRed Claude/
  docs/                  # 23 documentos estratégicos + docs técnicos nuevos
  app/
    (public)/            # Landing, /for-students, /for-residences, /search,
                         # /r/[slug], /waitlist, /login, /register, not-found
    students/dashboard/  # Placeholder área estudiante
    residence/dashboard/ # Placeholder área residencia
    admin/dashboard/     # Placeholder admin
    layout.tsx           # Fuentes Manrope + Inter, metadata
    globals.css          # Design tokens (Tailwind v4 @theme)
  components/
    ui/                  # Button, Card, Badge, Input/Textarea/Select,
                         # StatusTag, SectionHeader, EmptyState, ComingSoon
    layout/              # Navbar, Footer
    residences/          # ResidenceCard, TrustBadge
  lib/mock/              # residences.ts (6 seed), exchange.ts (mock TC)
  types/domain.ts        # Modelos conceptuales públicos (subset de docs/06)
  MEMORY.md              # Memoria persistente entre sesiones
```

La estructura sigue el esqueleto oficial de `docs/11` §6; las carpetas `modules/`, `server/`, `db/`, `tests/` se crean cuando llegue su contenido (no se crean carpetas vacías).

## 4. Archivos estratégicos y su rol

Ver el mapa completo en `docs/14_PROJECT_INDEX.md` §6 (no se duplica aquí — regla anti-duplicación del propio paquete). En síntesis: `00` decisiones (fuente de verdad ante contradicción), `01` brief, `02` alcance MVP, `03` reglas de negocio, `04` estados, `05` permisos, `06` datos, `07` API, `08` UI, `09` admin, `10` legal/privacidad, `11` arquitectura, `12` plan de fases, `13` metainstrucciones de trabajo, `14` índice, `15`–`19` operación, `20`–`21` plantillas legales, `22` guía de handoff.

## 5. Decisiones clave extraídas de los documentos

- **Loop central:** solicitud → contacto → [negociación opcional, máx. 1 propuesta de ajuste] → pago a residencia (externo) → fee EstuRed (MercadoPago/PayU) → factura fiscal → reserva confirmada → comprobante verificable. No hay reserva confirmada sin fee pagado.
- **Separación de entidades inviolable:** propuesta del familiar ≠ solicitud ≠ negociación ≠ pago a residencia ≠ fee ≠ reserva ≠ factura ≠ comprobante.
- **Mercado inicial:** CABA, 5–10 residencias pioneras verificadas presencialmente.
- **Freemium:** Perfil Verificado (gratis) vs. Gestión Operativa (pago; gratis 1 año para pioneras). Por residencia, no por owner.
- **Moneda:** tarifas en USD + ARS referencial al dólar blue (monedapi.ar, venta), con modal explicativo obligatorio.
- **Disponibilidad:** 4 estados de comunicación pública con copy oficial (asegurada / informada / completa / sin actualizar).
- **WhatsApp:** solo botón manual pre-formateado. **Prohibida** la API de WhatsApp Business.
- **Multi-residencia:** hasta 10 por owner, con aislamiento de staff por residencia.
- **Vencimientos:** unificados a 48 h (tabla canónica en `00` §9.1).

## 6. Riesgos e inconsistencias detectadas

### 6.1. Contradicción resuelta en este ciclo (documentada)

**Secuencia de construcción.** `docs/12` (Fase 0/1) y `docs/22` §6 ordenan empezar por Supabase, auth, roles, RLS y audit log — "no por pantallas visuales". El prompt operativo de este ciclo ordena lo contrario: fundaciones visuales + landing + catálogo con mocks, sin DB ni auth.

**Resolución:** prevalece el prompt operativo (instrucción vigente del dueño del proyecto). No contradice ninguna decisión de producto — solo re-secuencia el trabajo. Mitigación para que nada se descarte: se respetó el routing oficial (`docs/11` §7), la estructura de carpetas oficial (`docs/11` §6), los estados oficiales (`docs/04`) y el copy oficial (`docs/08`). El siguiente ciclo retoma la Fase 0/1 documental (Supabase + auth + RLS + auditoría).

### 6.2. Divergencias menores del prompt respecto a los docs (resueltas a favor de los docs)

- El prompt pedía rutas "Para Estudiantes" y "Para Familias" separadas; los docs definen una sola landing `/for-students` para ambos → se implementó según docs, con contenido que habla a ambos.
- El prompt pedía "Dashboard Familia"; en los docs el familiar vinculado comparte el área `/students` → placeholder único.
- El prompt pedía ruta "Residencias" → es `/search` según routing oficial.
- La ruta `/waitlist` **no existe** en el routing oficial: se agregó como página pre-lanzamiento (captura de interés). Cuando el producto opere, la lista de espera real es por residencia (`docs/00` §9 y flujos de `08`); `/waitlist` podrá redirigirse o retirarse.

### 6.3. Riesgos técnicos

- **Sin repo git**: el proyecto no está versionado (el usuario debe decidir dónde hostearlo; se dejó `.gitignore` listo). *Recomendación: `git init` + primer commit inmediato.*
- **Mocks acoplados a UI pública:** aceptable en ciclo 0; al integrar Supabase deben reemplazarse los helpers de `lib/mock/` por repositorios de datos sin cambiar componentes (la interfaz `Residence` ya lo facilita).
- **Tipo de cambio fijo (1480):** solo visual; riesgo de que se perciba como dato real → todas las vistas dicen "referencial / al dólar blue de hoy".
- **Fotos:** picsum.photos (placeholder externo). Reemplazar por Supabase Storage.

### 6.4. Riesgos de producto/UX

- La promesa de confianza depende de que el catálogo real tenga residencias verificadas de verdad; el copy actual ya usa lenguaje de "solicitud sujeta a confirmación" (regla de `08` §4.1) para no sobre-prometer.
- El formulario de lista de espera no persiste datos aún — la UI lo declara explícitamente para no engañar a nadie.
- Pendientes legales reales (docs `10`/`20`/`21` — revisión profesional) siguen abiertos y son bloqueantes para operar, no para desarrollar.

## 7. Recomendaciones técnicas

1. `git init` + commit fundacional + repo remoto privado.
2. Próximo ciclo: Supabase (proyecto + migraciones de tablas base de `docs/12` Fase 1) + Supabase Auth + RLS + `createAuditLog`.
3. Mantener los tipos de `types/domain.ts` como capa pública y derivar de los tipos generados de Supabase cuando existan.
4. Añadir testing framework (Vitest + Playwright recomendado, decisión delegada en `docs/11` §3.3) cuando aparezca la primera lógica de negocio server-side.
5. Deploy temprano a Vercel (preview) para feedback con datos mock.

## 8. Recomendaciones de producto

1. Usar la landing actual para validar mensaje y captar lista de espera real cuanto antes (requiere persistencia mínima — puede ser el primer caso de uso de Supabase).
2. No construir dashboards antes de tener las primeras residencias pioneras comprometidas (el playbook `docs/19` ya lo prevé).
3. Definir el precio de Gestión Operativa (pendiente en `00` §29) antes de la Fase 9bis.

## 9. Recomendaciones de UX

1. Mantener el copy oficial de disponibilidad y la separación solicitud/reserva en todas las pantallas futuras (ya centralizado en `StatusTag`).
2. Implementar el modal de tipo de cambio obligatorio (`docs/08` §2.8) cuando exista el `ExchangeRateProvider` real.
3. Estados loading/empty/error ya modelados en catálogo; replicar el patrón (`EmptyState`) en cada módulo nuevo.

## 10. Plan de implementación por fases

Ver `docs/PRODUCT_IMPLEMENTATION_PLAN.md` (creado en este ciclo). Alineado con `docs/12_BUILD_PLAN.md`, que sigue siendo la referencia canónica de fases del MVP completo.

## 11. Qué se hizo en este primer ciclo

1. Reorganización: 23 docs estratégicos movidos a `/docs` (recomendación de `docs/22` §6).
2. Scaffolding Next.js 15 + TypeScript + Tailwind 4 + ESLint 9 (flat config).
3. Design tokens (paleta EstuRed, Manrope/Inter, radios, sombras) en `app/globals.css`.
4. 13 componentes base reutilizables.
5. Rutas públicas: `/`, `/for-students`, `/for-residences`, `/search` (con filtros), `/r/[slug]` (ficha completa), `/waitlist`, `/login`, `/register`, 404.
6. Placeholders de rutas protegidas: `/students/dashboard`, `/residence/dashboard`, `/admin/dashboard`.
7. Datos mock: 6 residencias basadas en el seed oficial (`docs/17`), tipo de cambio mock.
8. Validación: `tsc --noEmit` ✅, `eslint` ✅, `next build` ✅ (18 páginas estáticas), verificación visual en navegador ✅.
9. Documentación: este archivo, `PRODUCT_IMPLEMENTATION_PLAN.md`, `NEXT_STEPS.md`, `/MEMORY.md`.

## 12. Preguntas críticas

Ninguna bloqueante para el próximo ciclo técnico. Las decisiones abiertas conocidas ya están registradas como pendientes **de producto/negocio** en `docs/00` §29 (revisión legal, precio de Gestión Operativa, PayU en USD, dominio, proveedor de email) y no bloquean la Fase 1 técnica.

Única decisión que el dueño debería tomar pronto: **dónde versionar el repo** (GitHub privado recomendado) para habilitar CI y deploy a Vercel.
