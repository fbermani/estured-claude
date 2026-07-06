# 15_ENVIRONMENT_AND_SETUP.md

## Propósito del documento

Este documento define cómo preparar el entorno técnico inicial para construir EstuRed desde cero con una base robusta, escalable y consistente con las decisiones de producto ya documentadas.

**Versión:** 0.2
**Estado:** Documento actualizado para construcción
**Última actualización:** 2026-06-27

Debe usarse después de leer `00` a `14` (ver orden completo en `14_PROJECT_INDEX.md` sección 4).

Este archivo no reemplaza la arquitectura técnica (`11_TECH_ARCHITECTURE.md`). Su función es convertirla en un plan práctico de configuración: repositorio, variables de entorno, servicios externos, ambientes y comandos base.

---

# 1. Principio rector del setup

El entorno de EstuRed debe permitir construir una webapp responsive con tres áreas principales: `/students` (estudiante y familiar vinculado), `/residence` (residencias, owners y staff, con soporte multi-residencia desde el modelo de datos), `/admin` (administración interna).

El setup debe soportar desde el inicio: autenticación; roles; multi-tenant por residencia (incluyendo un owner con hasta 10 residencias); RLS; storage de fotos y documentos; auditoría; propuestas de solicitud del familiar; solicitudes; negociación de condiciones; reservas; pagos del fee EstuRed (dos proveedores, dos monedas); facturación fiscal automática; comprobantes PDF con QR verificable; tipo de cambio diario; notificaciones; feature flags freemium; admin panel; jobs automáticos.

No se debe crear un prototipo desordenado que luego sea difícil de escalar.

---

# 2. Stack recomendado

## 2.1. Frontend y backend de aplicación

Next.js (App Router); TypeScript; Server Actions y/o Route Handlers para operaciones sensibles; React; Tailwind CSS; component library interna.

## 2.2. Base de datos, auth y storage

Supabase; PostgreSQL; Supabase Auth; Supabase Storage; Row Level Security; Edge Functions si aplica.

## 2.3. Hosting

Vercel (aplicación); Supabase Cloud (base de datos, auth, storage).

## 2.4. Pagos — proveedores confirmados

Capa interna `PaymentProvider`, con **dos implementaciones simultáneas confirmadas**:

- **MercadoPago** — cobro en ARS.
- **PayU Argentina** — cobro en USD.

El sistema también soporta pago manual (transferencia o billetera, validación admin). No hay proveedor "por definir" en esta sección — ambos ya están confirmados a nivel producto (`00_DECISION_LOG.md`).

El sistema debe soportar: pago automático vía ambos proveedores; pago manual con validación admin; webhooks idempotentes; reintentos (hasta 3 en 48h); reembolsos manuales; estados internos propios de EstuRed independientes del estado textual del proveedor.

## 2.5. Tipo de cambio — fuente confirmada

Capa `ExchangeRateProvider`. **Fuente confirmada: monedapi.ar — dólar blue, valor de venta.** Actualización automática diaria; override manual desde admin con motivo obligatorio; snapshot guardado en cada solicitud.

Regla crítica: una solicitud ya enviada nunca recalcula su tipo de cambio automáticamente — usa el snapshot guardado (`snapshot_original` o `snapshot_final` si hubo negociación).

## 2.6. Facturación fiscal — nueva, confirmada

Capa `FiscalInvoiceProvider`. **Integración confirmada: TusFacturas.app.** EstuRed opera como monotributista y emite **Factura C** por el fee cobrado. Se emite automáticamente al confirmarse el pago del fee (no antes). Si falla, no bloquea la reserva — se reintenta por job independiente.

## 2.7. Notificaciones — corregido

Capa `NotificationProvider`, con **email** (respaldo obligatorio) e **in-app** únicamente.

**WhatsApp NO es parte de esta capa.** No hay integración de API de WhatsApp Business en el MVP. El único uso de WhatsApp es un botón manual pre-formateado que la residencia acciona para abrir una conversación fuera de la plataforma — ver `11_TECH_ARCHITECTURE.md` sección 16bis. No crear variables de entorno ni proveedor de WhatsApp para notificaciones.

## 2.8. PDF y QR

Generación server-side de PDF; QR/código verificable (`verification_code`) apuntando a `/verify/[verification_code]`; comprobante almacenado en bucket privado; acceso controlado por permisos; reemisión y anulación auditadas.

---

# 3. Estructura inicial del repositorio

Ver estructura completa y actualizada en `11_TECH_ARCHITECTURE.md` sección 6 — no se repite acá para evitar una segunda copia que se desactualice (la anterior versión de este archivo tenía rutas en español ya obsoletas: `/buscar`, `/registro`, `/residence/dashboard` sin `[residence_id]`, `/admin/mediations`).

Regla: Claude Code puede ajustar nombres técnicos internos si hay razón clara, pero no debe cambiar las rutas funcionales base `/students`, `/residence`, `/admin`, ni la nomenclatura `/residence/[residence_id]/...` sin aprobación explícita.

---

# 4. Prerrequisitos locales

Node.js LTS; package manager (`pnpm` recomendado si no hay preferencia previa); Git; cuenta Supabase; cuenta Vercel; cuenta MercadoPago (developer/sandbox); cuenta PayU Argentina (developer/sandbox); cuenta TusFacturas.app (sandbox si está disponible); proveedor de email transaccional (decisión delegada a Claude Code, priorizar gratuito).

**Ya no es necesaria** una cuenta o decisión de proveedor de WhatsApp — no aplica a este producto.

---

# 5. Comandos base sugeridos

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm db:migrate
pnpm db:seed
pnpm db:reset
pnpm sync:exchange-rate
```

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:e2e": "playwright test",
    "db:migrate": "supabase db push",
    "db:reset": "supabase db reset",
    "db:seed": "tsx scripts/seed-demo.ts",
    "sync:exchange-rate": "tsx scripts/sync-exchange-rate.ts"
  }
}
```

Sugeridos; Claude Code debe ajustarlos a la configuración real, conservando equivalentes funcionales.

---

# 6. Variables de entorno

Crear `.env.example` desde el inicio.

## 6.1. App

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=EstuRed
NODE_ENV=development
```

## 6.2. Supabase

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
```

`SUPABASE_SERVICE_ROLE_KEY` nunca en cliente. Operaciones admin sensibles server-side. RLS protege acceso incluso si una ruta falla.

## 6.3. Pagos — actualizado

```env
# MercadoPago
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_PUBLIC_KEY=
MERCADOPAGO_WEBHOOK_SECRET=

# PayU Argentina
PAYU_API_KEY=
PAYU_API_LOGIN=
PAYU_MERCHANT_ID=
PAYU_ACCOUNT_ID=
PAYU_PUBLIC_KEY=
PAYU_WEBHOOK_SECRET=

# Modo de operación
PAYMENT_MODE=sandbox
ENABLE_MANUAL_PAYMENT_FALLBACK=true
```

Notas: ambos proveedores conviven, no es "uno u otro"; `ENABLE_MANUAL_PAYMENT_FALLBACK` permite operar sin integración completa desde el día uno; los webhooks deben ser idempotentes (`idempotency_key`).

## 6.4. Tipo de cambio — actualizado

```env
EXCHANGE_RATE_SOURCE=monedapi.ar
EXCHANGE_RATE_API_URL=https://monedapi.ar/
EXCHANGE_RATE_TYPE=blue_sell
```

El sistema debe poder funcionar con override manual si la API falla. Admin revisa última actualización. Cada solicitud guarda snapshot.

## 6.5. Facturación fiscal — nuevo

```env
TUSFACTURAS_API_KEY=
TUSFACTURAS_API_TOKEN=
TUSFACTURAS_PUNTO_VENTA=
TUSFACTURAS_CUIT_EMISOR=
FISCAL_INVOICE_MODE=sandbox
```

Regla: la factura se emite automáticamente al confirmarse el fee, nunca antes. Si falla, no bloquea la reserva — queda en `issue_failed` para reintento.

## 6.6. Notificaciones — corregido

```env
EMAIL_PROVIDER=manual
EMAIL_FROM=
EMAIL_API_KEY=
```

**Eliminadas las variables de WhatsApp** (`WHATSAPP_PROVIDER`, `WHATSAPP_API_TOKEN`) — no aplican a este producto. El único artefacto relacionado con WhatsApp es la construcción del link `wa.me/...`, que no requiere credenciales:

```env
WHATSAPP_DEFAULT_COUNTRY_CODE=54
```

(Se mantiene solo esta variable, para construir el número completo del link `wa.me`, no para autenticarse contra ninguna API.)

## 6.7. PDF y QR

```env
PDF_STORAGE_BUCKET=generated-receipts
QR_SECRET=
RECEIPT_VERIFICATION_BASE_URL=http://localhost:3000/verify
```

`QR_SECRET` para firmar/validar `verification_code` si se decide agregar una capa extra de integridad. La URL de verificación pública muestra solo información segura.

## 6.8. Admin inicial

```env
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=
SEED_ADMIN_NAME=
```

No guardar credenciales reales en el repositorio. Crear admin inicial por script seguro. Rotar credenciales luego del setup.

---

# 7. Configuración de Supabase

## 7.1. Crear proyecto

Un proyecto Supabase por ambiente: `local`/development, `staging`, `production`. No usar la misma base para desarrollo y producción.

## 7.2. Extensiones recomendadas

`uuid-ossp` o generación nativa de UUID; `pgcrypto`; extensiones de búsqueda si se necesitan más adelante. Claude Code confirma cuáles son necesarias antes de agregarlas.

## 7.3. Migraciones — orden actualizado

Debe seguir el modelo de `06_DATA_MODEL.md`. Orden sugerido:

1. Enums y tipos base.
2. Usuarios y perfiles.
3. Familiares vinculados.
4. **Propuestas de solicitud del familiar.**
5. Residencias (incluyendo campos de feature flag freemium).
6. Usuarios de residencia (`residence_users`, soporte multi-residencia).
7. Habitaciones y plazas.
8. Disponibilidad.
9. Solicitudes.
10. **Snapshots de solicitud (original/final).**
11. **Propuestas de ajuste de condiciones (negociación).**
12. Pago a residencia.
13. Reservas.
14. Fee EstuRed.
15. **Facturas fiscales** — no es tabla separada: son campos fiscales dentro de `estured_fee_payments`, creados en la misma migración del Fee EstuRed (ítem 14). Se mantiene el ítem solo como recordatorio del bloque fiscal.
16. Comprobantes.
17. Renovaciones (`renewal_requests` y `renewal_offers` por separado).
18. Lista de espera.
19. Documentos.
20. Comunidad visible.
21. FAQ (predefinidas + configuradas por residencia).
22. Soporte y resolución de conflictos.
23. Métricas.
24. Penalizaciones.
25. Notificaciones.
26. Tipo de cambio.
27. Audit log.

No crear tablas sin `created_at`, `updated_at` y campos de auditoría cuando corresponda.

## 7.4. Row Level Security

Todas las tablas con datos de usuario, residencia, documento, pago, solicitud o reserva deben tener RLS activado.

Principios: estudiante ve su información y entidades vinculadas; familiar ve solo el estudiante vinculado activo y según permisos (incluyendo si puede crear propuestas); **el contenido de una propuesta del familiar no es visible para la residencia hasta la aprobación del estudiante**; residence owner ve solo las residencias donde tiene `residence_users` activo; residence staff ve solo las residencias específicas asignadas, **incluso si el owner gestiona otras**; admin vía server-side/service role, no exposición directa al cliente; documentos solo por contexto autorizado; invitados sin acceso a datos privados.

Regla crítica: la UI no es seguridad. Las restricciones están en servidor y base de datos.

---

# 8. Storage

## 8.1. Buckets — alineados con `06_DATA_MODEL.md` y `10_PRIVACY_AND_LEGAL_RULES.md`

```txt
public-residence-media
private-user-documents
private-residence-documents
payment-proofs
generated-receipts
fiscal-documents
support-evidence
```

**(Corregido respecto a la versión anterior, que usaba nombres distintos — `residence-photos`, `student-documents`, `mediation-evidence`, etc. — y no incluía `fiscal-documents`.)**

## 8.2. Visibilidad

Público: `public-residence-media` (fotos aprobadas). Privados: todos los demás.

Reglas: signed URLs para documentos privados; no exponer rutas directas de documentos sensibles; una residencia no ve documentos globales de un estudiante fuera de contexto; todo acceso admin a documento sensible requiere justificación registrada previa (ver `10_PRIVACY_AND_LEGAL_RULES.md` §6.6).

---

# 9. Autenticación

## 9.1. Métodos iniciales

Email/password; magic link opcional; Google opcional (no obligatorio para MVP).

## 9.2. Registro por rol — rutas corregidas

`/register/student`; `/register/family`; `/register/residence` (ver `08_UI_SCREENS_AND_FLOWS.md` — reemplaza las rutas en español de la versión anterior: `/registro/estudiante`, etc.).

## 9.3. Menores

Si el estudiante es menor de edad, no puede finalizar su registro operativo sin familiar vinculado activo.

## 9.4. Residencias

El primer usuario de una residencia es `residence_owner`. El owner puede invitar staff y asignarlo a una o varias de sus residencias (hasta 10). Staff no excede los permisos otorgados ni ve residencias fuera de su asignación.

## 9.5. Admin

Admin inicial creado por script. No debe existir registro público de admin.

---

# 10. Setup de pagos

## 10.1. Modos soportados

`sandbox` (ambos proveedores en modo prueba); `manual` (fallback siempre disponible vía `ENABLE_MANUAL_PAYMENT_FALLBACK`); `production`.

## 10.2. Flujo del fee — actualizado

La reserva no queda confirmada y no se emite comprobante ni factura hasta que el fee EstuRed esté pagado.

1. Residencia marca `Pago recibido` (con confirmación explícita auditada).
2. Sistema crea `estured_fee_payment` con base de cálculo sobre `snapshot_final`.
3. Estudiante/familiar elige proveedor (MercadoPago/ARS o PayU/USD) y paga.
4. Si falla el automático: hasta 3 intentos en 48h.
5. Si es manual: admin valida comprobante.
6. Fee pasa a `paid`.
7. **Se dispara automáticamente la emisión de Factura C vía TusFacturas.app.**
8. Reserva pasa a `confirmed`.
9. Comprobante pasa a `pending_generation` y luego `issued`.

## 10.3. Idempotencia

Toda integración de pago usa `idempotency_key` (ej. combinación de `reservation_id` + `fee_payment_id` + intento). Un webhook repetido no debe duplicar pagos, reservas, comprobantes ni facturas.

## 10.4. Reembolsos

Reembolso manual auditado. Política: el fee no es reembolsable salvo incumplimiento atribuible a la residencia, revisión de EstuRed y normativa aplicable.

---

# 11. Setup de tipo de cambio

## 11.1. Tabla requerida

`exchange_rates`: fecha; moneda base/destino; valor; `source_name` (`monedapi.ar`); `rate_type` (`blue_sell`); estado; actualización automática/manual; admin que modificó si aplica; motivo de override.

## 11.2. Job diario

Actualizar desde monedapi.ar. Si falla: registrar error; mantener último valor válido; alertar admin; permitir override manual.

## 11.3. Snapshot

Cada solicitud guarda: precio USD; precio ARS; tipo de cambio usado; fuente; fecha/hora; duración; base del fee; fee calculado. Si hay negociación aceptada, se genera un segundo snapshot (`snapshot_final`) con los valores acordados.

---

# 12. Notificaciones

## 12.1. Eventos mínimos — actualizado

Propuesta del familiar creada/aprobada/rechazada/vencida; solicitud enviada/recibida; recordatorio diario a residencia; contacto establecido; **propuesta de ajuste enviada/respondida/vencida**; plazo de 48h iniciado/24h restantes; solicitud vencida; pago a residencia informado; fee pendiente/fallido/pagado; **factura fiscal emitida/fallida**; reserva confirmada; comprobante emitido; disponibilidad nueva para lista de espera; recordatorio de lista de espera a 90 días; renovación enviada/aceptada/vencida; caso de soporte abierto; acción admin.

## 12.2. Registro interno

Aunque falle el envío externo, la notificación debe registrarse: usuario destino; canal; template; estado; payload; error si falla; fecha de envío.

---

# 13. Generación de comprobantes

## 13.1. Comprobante de Reserva Confirmada

Se genera cuando: residencia marcó pago recibido; fee EstuRed está pagado; reserva está confirmada.

Incluye: ID; `verification_code` y QR; datos de estudiante; familiar pagador si aplica; residencia; tipo de habitación/plaza; fecha estimada de ingreso; duración inicial; objetivo académico declarado; **condiciones finales (`snapshot_final`)**; monto abonado a residencia informado por residencia; fee EstuRed y moneda; **referencia a factura fiscal**; política de ajustes futuros; disclaimer.

## 13.2. Comprobante de Renovación Confirmada

Misma lógica, aplicada a renovación, con `verification_code` propio.

## 13.3. Verificación pública

`/verify/[verification_code]` muestra solo: estado válido/anulado; ID; residencia; estudiante con datos limitados (nombre + inicial); fecha de emisión; tipo de comprobante; tipo de habitación/plaza; fecha de ingreso; duración. No muestra documentos, pagos ni datos privados.

---

# 14. Jobs automáticos — actualizado

**Solución confirmada: Supabase pg_cron** (los jobs horarios de vencimiento no funcionan en el plan gratuito de Vercel Cron). Granularidad horaria aceptada: un vencimiento de 48h puede ejecutarse hasta 59 minutos tarde.

## 14.1. Expiración de propuestas del familiar (nuevo)

48h sin respuesta del estudiante → `expired`, notificar al familiar.

## 14.2. Expiración de propuestas de ajuste (nuevo)

48h sin respuesta del estudiante → `expired_offer_no_response`, notificar a ambas partes.

## 14.3. Vencimiento de solicitudes

**48h** (no 72h) desde el envío. Marcar `expired_no_residence_response` o `expired_no_student_payment` según corresponda; notificar; auditar.

## 14.4. Reintentos y vencimiento de fee

Hasta 3 intentos dentro de 48h si falla el cobro automático; notificar después de cada fallo; si se agota el plazo: fee → `expired` y reserva → `expired_fee_unpaid`.

## 14.5. Reintentos de facturación fiscal (nuevo)

Si `FiscalInvoiceProvider` falla, reintentar por job independiente sin bloquear la reserva.

## 14.6. Disponibilidad no actualizada

Cada residencia actualiza cada 30 días o marca `full`. Si no: recordatorio; cambio de estado; **si persiste 15 días adicionales, ocultar de búsquedas activas**; alertar admin.

## 14.7. Lista de espera 90 días

Notificación para confirmar continuidad; no elimina automáticamente por tiempo.

## 14.8. Tipo de cambio diario

Actualizar desde monedapi.ar.

## 14.9. Verificación anual

Detectar residencias con verificación próxima a vencer.

---

# 15. Seeds iniciales — actualizado

## 15.1. Admin inicial

Script para generar el primer superadmin.

## 15.2. Datos demo (desarrollo)

5 residencias en CABA con distintos estados de disponibilidad; **al menos una con Gestión Operativa habilitada vía feature flag** (pionera de beta); habitaciones y plazas; usuarios estudiantes; familiar vinculado **con al menos una propuesta de solicitud de ejemplo**; solicitudes en distintos estados **incluyendo una con negociación de condiciones activa**; reservas; renovaciones; comprobantes ficticios con `verification_code` válido; **facturas fiscales ficticias**; alertas admin.

Regla: los datos demo nunca deben mezclarse con producción.

---

# 16. Ambientes

## 16.1. Local

Auth local; pagos sandbox (ambos proveedores); storage local o cloud dev; seed demo.

## 16.2. Staging

Base separada; storage separado; pagos sandbox; emails de prueba; datos ficticios o beta controlada.

## 16.3. Production

Variables seguras; backups; RLS activado; pagos reales (MercadoPago + PayU); facturación fiscal real (TusFacturas.app); storage privado; monitoreo; admin auditado.

---

# 17. Deployment

## 17.1. Vercel

Proyecto; variables de entorno; dominio; preview deployments; producción.

## 17.2. Supabase

Proyecto por ambiente; migrations; RLS; storage; auth redirects; edge functions si aplica.

## 17.3. Dominios

Pendiente de decisión (no bloqueante): dominio público principal; subdominio app si aplica; URL de verificación de comprobantes (ej. `estured.com/verify/[verification_code]`). No hardcodear dominio en lógica.

---

# 18. Seguridad mínima

## 18.1. Reglas generales

No exponer service role al cliente; no confiar en rol enviado desde frontend; validar permisos server-side; activar RLS; usar DTOs seguros; no devolver filas completas con datos sensibles; no exponer documentos sin signed URL; auditar acciones críticas; confirmaciones explícitas para acciones irreversibles.

## 18.2. Datos sensibles

Nunca mostrar públicamente: apellido completo; email; teléfono; fecha de nacimiento; universidad; documentos; comprobantes de pago; datos de tarjeta; **contenido de una propuesta del familiar antes de aprobación**.

## 18.3. Admin

Acciones críticas requieren motivo, confirmación y audit log: suspender residencia; reembolsar fee; confirmar reserva manualmente; anular comprobante; **anular/reemitir factura fiscal**; ocultar perfil; acceder a documentos sensibles; **otorgar/revocar acceso freemium**.

---

# 19. Testing mínimo

## 19.1. Unit tests

Cálculo de fee (sobre `snapshot_final`); redondeo; tipo de cambio; estados de solicitud (incluyendo negociación); estados de propuesta del familiar; estados de reserva; permisos; visibilidad; vencimientos (48h).

## 19.2. Integration tests

Crear propuesta del familiar; aprobar/rechazar propuesta; crear solicitud; establecer contacto; enviar/responder propuesta de ajuste; marcar pago recibido; cobrar fee (ambos proveedores); emitir factura fiscal; emitir comprobante; crear renovación; lista de espera; admin override.

## 19.3. E2E tests — actualizado

1. Familiar crea propuesta → estudiante aprueba → se convierte en solicitud.
2. Estudiante busca, solicita y reserva directamente.
3. Residencia recibe solicitud, envía propuesta de ajuste, estudiante acepta.
4. Residencia marca pago recibido.
5. EstuRed cobra fee vía MercadoPago (ARS) y emite comprobante + factura.
6. EstuRed cobra fee vía PayU (USD) y emite comprobante + factura.
7. Familiar paga fee.
8. Solicitud pausada por otra activa.
9. Lista de espera se activa cuando hay disponibilidad.
10. Renovación confirmada con fee idéntico al de reserva inicial.
11. Admin verifica residencia.
12. Admin otorga acceso freemium a residencia pionera.
13. Admin reembolsa fee con auditoría.
14. Usuario sin permiso intenta ver documento y falla.
15. Owner con 2 residencias no ve datos cruzados entre ellas.

---

# 20. Primer checklist de setup — actualizado

- [ ] Repo creado.
- [ ] Next.js configurado.
- [ ] TypeScript estricto.
- [ ] Supabase conectado.
- [ ] `.env.example` creado (incluyendo MercadoPago, PayU, monedapi.ar, TusFacturas.app).
- [ ] Migración inicial creada (ver orden en sección 7.3).
- [ ] RLS activado en tablas críticas, incluyendo aislamiento multi-residencia.
- [ ] Storage buckets creados con nombres de sección 8.1.
- [ ] Admin inicial creado.
- [ ] Layouts `/students`, `/residence` (multi-residencia), `/admin` creados.
- [ ] Sistema de roles base implementado.
- [ ] Audit log implementado.
- [ ] `PaymentProvider` stub implementado (MercadoPago + PayU).
- [ ] `ExchangeRateProvider` stub implementado (monedapi.ar).
- [ ] `FiscalInvoiceProvider` stub implementado (TusFacturas.app).
- [ ] `NotificationProvider` stub implementado (email + in-app, sin WhatsApp).
- [ ] PDF/QR service stub implementado.
- [ ] Seeds de desarrollo creados (incluyendo propuesta del familiar y negociación de ejemplo).
- [ ] Build local funcionando.
- [ ] Lint y typecheck funcionando.

---

# 21. Primera secuencia recomendada para Claude Code

Ver `12_BUILD_PLAN.md` secciones 4-21 (Fases 0 a 16) — es la fuente de verdad actualizada del orden de construcción, incluyendo las fases nuevas 5bis (propuestas del familiar) y 9bis (multi-residencia + freemium) que no existían en la versión anterior de este documento. No se repite acá para evitar una tercera copia del plan de fases.

---

# 22. Antipatrones prohibidos

Ver `11_TECH_ARCHITECTURE.md` sección 39 y `12_BUILD_PLAN.md` secciones 25-26. No se repite acá.

---

# 23. Pendientes técnicos — actualizado

**Ya no son pendientes** (estaban mal listados en la versión anterior): proveedor de pagos, proveedor de WhatsApp (no aplica), fuente de tipo de cambio, política de facturación. Todos están confirmados en `00_DECISION_LOG.md`.

**Pendientes reales, no bloqueantes:**

- Proveedor final de email transaccional (decisión delegada a Claude Code).
- Herramienta final de generación PDF (decisión delegada a Claude Code; validar en Fase 0 que funcione en el runtime serverless de Vercel).
- Validación comercial/regulatoria del cobro en USD vía PayU (antes de activarlo en producción).
- Dominio final.
- Revisión legal de T&C, privacidad y menores (`10_PRIVACY_AND_LEGAL_RULES.md` §31).
- Revisión legal del botón de arrepentimiento (`10` §15.4).
- Política exacta de backup.
- Monitoreo y alertas (proveedor delegado a Claude Code).
- Precio del plan pago de Gestión Operativa.

---

# 24. Definition of Done del setup

- El proyecto corre localmente.
- Conexión real a Supabase dev.
- Auth funciona.
- Roles base existen.
- Rutas `/students`, `/residence` (multi-residencia), `/admin` existen.
- Migraciones iniciales completas (incluyendo propuestas del familiar y negociación).
- RLS básico activo, incluyendo aislamiento multi-residencia.
- Buckets definidos con nombres correctos (incluyendo `fiscal-documents`).
- Audit log funcional.
- Admin inicial existe.
- Stubs de `PaymentProvider` (MercadoPago + PayU), `ExchangeRateProvider` (monedapi.ar), `FiscalInvoiceProvider` (TusFacturas.app) y `NotificationProvider` (email + in-app) implementados.
- Scripts de seed funcionando.
- `.env.example` completo.
- Documentación de comandos.
- `pnpm build`, `pnpm lint`, `pnpm typecheck` pasan.

---

# 25. Nota final para Claude Code

Este archivo no autoriza a cambiar reglas de negocio. Si durante la configuración aparece una contradicción entre setup técnico y reglas de producto, detenerse y pedir aclaración.

Jerarquía documental: ver `13_CLAUDE_PROJECT_INSTRUCTIONS.md` sección 2. No se repite acá.

El setup debe servir al producto, no redefinirlo.
