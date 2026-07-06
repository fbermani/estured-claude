# 11_TECH_ARCHITECTURE.md

# EstuRed — Arquitectura Técnica Recomendada

**Versión:** 0.2
**Estado:** Documento actualizado para construcción
**Última actualización:** 2026-06-27
**Depende de:** `00_DECISION_LOG.md`, `01_PRODUCT_BRIEF.md`, `02_MVP_SCOPE.md`, `03_BUSINESS_RULES.md`, `04_STATE_MACHINES.md`, `05_ROLES_AND_PERMISSIONS.md`, `06_DATA_MODEL.md`, `07_API_SPEC.md`, `08_UI_SCREENS_AND_FLOWS.md`, `09_ADMIN_PANEL_SPEC.md`, `10_PRIVACY_AND_LEGAL_RULES.md`

---

## 1. Propósito del documento

Este documento define la arquitectura técnica recomendada para construir el MVP de EstuRed como una webapp responsive escalable.

Debe servir como guía para Claude Code, desarrolladores o arquitectos de software al momento de implementar:

- estructura del proyecto;
- frontend;
- backend;
- base de datos;
- autenticación;
- permisos;
- storage;
- pagos;
- facturación fiscal;
- comprobantes;
- tipo de cambio;
- notificaciones;
- auditoría;
- admin panel;
- jobs automáticos;
- QA;
- despliegue;
- seguridad.

Este documento no reemplaza una revisión técnica final. Su función es evitar improvisación y fijar una dirección coherente con las reglas de producto ya definidas en `00` a `10`.

---

## 2. Principio técnico rector

EstuRed no debe construirse como una landing con formularios sueltos.

Debe construirse como un sistema transaccional con:

- estados claros;
- permisos estrictos;
- separación entre propuesta del familiar, solicitud, negociación de condiciones, pago a residencia, fee EstuRed, reserva, comprobante y factura fiscal;
- auditoría obligatoria;
- panel admin desde el MVP;
- arquitectura modular;
- capacidad de escalar hacia Gestión Operativa (freemium), renovaciones, comunidad visible, multi-residencia y señales de convivencia futuras.

Principio obligatorio:

> La UI puede ser simple, pero la arquitectura no debe ser frágil.

---

## 3. Stack recomendado para MVP

### 3.1. Stack base confirmado

- **Frontend:** Next.js con App Router.
- **Lenguaje:** TypeScript.
- **UI:** Tailwind CSS + componentes reutilizables propios o librería compatible.
- **Backend:** Next.js Server Actions y Route Handlers.
- **Base de datos:** Supabase/PostgreSQL.
- **Auth:** Supabase Auth.
- **Storage:** Supabase Storage.
- **Hosting frontend/backend:** Vercel.
- **Pagos:** capa interna `PaymentProvider`, con **MercadoPago (ARS)** y **PayU Argentina (USD)** disponibles simultáneamente, más modo manual soportado.
- **Tipo de cambio:** capa interna `ExchangeRateProvider`, con **monedapi.ar (dólar blue, valor venta)** como fuente confirmada.
- **Facturación fiscal:** capa interna `FiscalInvoiceProvider`, con **TusFacturas.app** como integración confirmada (Factura C, EstuRed opera como monotributista).
- **Notificaciones:** capa interna `NotificationProvider`, con **email** e **in-app** como canales soportados. WhatsApp **no** es un canal de esta abstracción — ver sección 16bis.
- **Comprobantes:** generación server-side de PDF + QR/código verificable.
- **Auditoría:** tabla propia `audit_logs`.
- **Jobs:** **Supabase pg_cron** (decisión confirmada) para vencimientos (solicitudes, propuestas del familiar, propuestas de ajuste, fee), recordatorios, tipo de cambio, métricas, reintentos de pago, reintentos de facturación y alertas.

### 3.2. Por qué este stack

EstuRed necesita una base relacional porque el dominio tiene entidades fuertemente conectadas entre sí:

- usuarios; estudiantes; familiares;
- residencias (hasta 10 por owner); habitaciones; plazas;
- disponibilidad;
- **propuestas de solicitud del familiar**;
- solicitudes; **propuestas de ajuste de condiciones (negociación)**;
- reservas;
- pagos a residencia; pagos del fee EstuRed; **facturas fiscales**;
- comprobantes;
- renovaciones;
- documentos;
- auditoría;
- permisos;
- casos de soporte;
- **feature flags de plan freemium**.

PostgreSQL es más adecuado que una base puramente documental para este tipo de reglas, relaciones, estados, reportes y auditoría.

### 3.3. Decisiones técnicas delegadas a Claude Code

Estas decisiones NO son de producto y quedan a criterio de Claude Code al momento de implementar, priorizando siempre opciones gratuitas o de bajo costo cuando exista alternativa técnica válida:

- librería o servicio de generación de PDF;
- librería de generación de QR;
- proveedor de email transaccional;
- sistema de analytics/product events;
- proveedor de monitoreo/errores;
- estrategia de cacheo;
- testing framework;
- estrategia de migraciones;
- rate limiting.

La arquitectura debe abstraer estos proveedores para poder cambiarlos sin reescribir la lógica central. **A diferencia de la versión anterior de este documento, el proveedor de pagos, la fuente de tipo de cambio y el proveedor de facturación fiscal ya NO son decisiones abiertas — están confirmados en la sección 3.1 y no deben tratarse como pendientes.**

---

## 4. Aplicación web responsive, no app nativa

El MVP debe ser una **webapp responsive**.

No se debe construir app móvil nativa en esta etapa.

Motivo:

- el uso inicial es búsqueda, comparación, solicitud, negociación, pago y comprobante;
- la web responsive cubre bien ese flujo;
- reduce complejidad y costo;
- permite iterar rápido;
- facilita SEO y adquisición;
- mantiene una sola base de código.

La arquitectura debe ser PWA-ready, pero no es obligatorio lanzar como PWA en el MVP.

---

## 5. Arquitectura de alto nivel

### 5.1. Capas principales

1. **Presentation layer** — pantallas, layouts, componentes visuales, formularios, estados de UI.
2. **Application layer** — server actions, route handlers, validaciones de entrada, orquestación de casos de uso.
3. **Domain layer** — reglas de negocio, máquinas de estado, cálculo de fee (sobre `snapshot_final`), validación de transiciones, permisos de alto nivel.
4. **Data access layer** — consultas a Supabase/PostgreSQL, DTOs, repositorios, queries, mutations.
5. **Infrastructure layer** — integraciones con pagos (MercadoPago/PayU), storage, notificaciones, tipo de cambio (monedapi.ar), facturación fiscal (TusFacturas.app), generación de PDFs y logs.
6. **Admin/operations layer** — funciones internas, overrides, auditoría, verificaciones, soporte y resolución de conflictos, penalizaciones, gestión de feature flags freemium.

### 5.2. Regla obligatoria

Los componentes de UI no deben modificar estados críticos directamente.

Toda transición crítica debe pasar por funciones server-side que:

- validen permisos (incluyendo contexto de residencia activa si el usuario gestiona múltiples);
- validen estado actual;
- ejecuten transición permitida;
- creen audit log;
- disparen notificaciones;
- actualicen métricas o jobs si corresponde.

---

## 6. Estructura recomendada del repositorio

```txt
estured/
  app/
    (public)/
      page.tsx
      for-students/
      for-residences/
      search/
      r/[slug]/
      verify/[verification_code]/
    students/
      layout.tsx
      dashboard/
      favorites/
      family-proposals/
      applications/
        [id]/
          negotiation/
          fee/
      receipts/[id]/
      waitlist/
      renewals/
        [id]/
      profile/
      documents/
      family-link/
      settings/
      support/
    residence/
      layout.tsx
      dashboard/
      settings/
        new/
      [residence_id]/
        profile/
          preview/
        verification/
        rooms/
        availability/
        applications/
          [id]/
            negotiation/
        reservations/
        waitlist/
        residents/
        renewals/
          [id]/
        receipts/
        faq/
        metrics/
        plan/
    admin/
      layout.tsx
      dashboard/
      residences/
        [id]/
          plan/
      verifications/
      profile-edits/
      pricing/
      applications/
      family-proposals/
      negotiations/
      reservations/
      payments/
      invoices/
      receipts/
      users/
      documents/
      waitlists/
      renewals/
      community/
      support-cases/
      visibility/
      notifications/
      exchange-rate/
      audit-log/
      settings/
    api/
      webhooks/
        mercado-pago/
        payu/
        tusfacturas/
      verify/
        [verification_code]/
  components/
    ui/
    forms/
    cards/
    modals/
    tables/
    dashboards/
    status/
  modules/
    auth/
    users/
    students/
    families/
    family-proposals/
    residences/
    rooms/
    availability/
    applications/
    negotiations/
    payments/
    fiscal-invoicing/
    receipts/
    renewals/
    waitlist/
    community/
    documents/
    notifications/
    support-cases/
    metrics/
    admin/
    audit/
    exchange-rate/
    freemium/
  server/
    actions/
    services/
    repositories/
    validators/
    policies/
    jobs/
    integrations/
      payments/
        mercado-pago/
        payu/
      exchange-rate/
        moneda-api/
      fiscal-invoicing/
        tusfacturas/
      whatsapp/
  lib/
    supabase/
    payments/
    notifications/
    pdf/
    qr/
    currency/
    dates/
    errors/
    logger/
  db/
    migrations/
    seed/
    policies/
    functions/
  types/
    domain.ts
    dto.ts
    enums.ts
    permissions.ts
  tests/
    unit/
    integration/
    e2e/
    rls/
  docs/
```

Claude Code puede proponer ajustes menores, pero no debe mezclar módulos críticos ni eliminar la separación entre dominio, datos e infraestructura. **Los módulos `family-proposals`, `negotiations`, `fiscal-invoicing` y `freemium` son nuevos respecto a versiones anteriores del proyecto y no deben omitirse.**

---

## 7. Routing oficial

Las rutas deben coincidir exactamente con las definidas en `08_UI_SCREENS_AND_FLOWS.md`. Esta sección es un resumen; `08` es la fuente de verdad si hay discrepancia.

### 7.1. Rutas públicas

- `/`
- `/for-students`
- `/for-residences`
- `/search`
- `/r/[slug]`
- `/verify/[verification_code]`
- `/login`
- `/register`
- `/register/student`
- `/register/family`
- `/register/residence`

### 7.2. Área estudiante/familiar

Base: `/students`

- `/students/dashboard`
- `/students/favorites`
- `/students/family-proposals`
- `/students/applications`
- `/students/applications/[id]`
- `/students/applications/[id]/negotiation`
- `/students/applications/[id]/fee`
- `/students/receipts/[id]`
- `/students/waitlist`
- `/students/renewals`
- `/students/renewals/[id]`
- `/students/profile`
- `/students/documents`
- `/students/family-link`
- `/students/settings`
- `/students/support`

### 7.3. Área residencia (multi-residencia)

Base: `/residence`

- `/residence/dashboard` — vista multi-residencia en scroll vertical, sin agregado.
- `/residence/settings` — gestión de residencias del owner y staff.
- `/residence/settings/new` — alta de nueva residencia (hasta 10).
- `/residence/[residence_id]/profile`
- `/residence/[residence_id]/profile/preview`
- `/residence/[residence_id]/verification`
- `/residence/[residence_id]/rooms`
- `/residence/[residence_id]/availability`
- `/residence/[residence_id]/applications`
- `/residence/[residence_id]/applications/[id]`
- `/residence/[residence_id]/applications/[id]/negotiation`
- `/residence/[residence_id]/reservations`
- `/residence/[residence_id]/waitlist`
- `/residence/[residence_id]/residents`
- `/residence/[residence_id]/renewals`
- `/residence/[residence_id]/renewals/[id]`
- `/residence/[residence_id]/receipts`
- `/residence/[residence_id]/faq`
- `/residence/[residence_id]/metrics`
- `/residence/[residence_id]/plan`

**Nota de arquitectura:** todo endpoint bajo `/residence/[residence_id]/...` debe validar server-side que el usuario autenticado tiene `residence_users` activo para ese `residence_id` específico. No alcanza con validar que el usuario es `residence_owner` o `residence_staff` en general.

### 7.4. Área admin

Base: `/admin`

- `/admin/dashboard`
- `/admin/residences`
- `/admin/residences/[id]`
- `/admin/residences/[id]/plan`
- `/admin/verifications`
- `/admin/profile-edits`
- `/admin/pricing`
- `/admin/applications`
- `/admin/family-proposals`
- `/admin/negotiations`
- `/admin/reservations`
- `/admin/payments`
- `/admin/invoices`
- `/admin/receipts`
- `/admin/users`
- `/admin/documents`
- `/admin/waitlists`
- `/admin/renewals`
- `/admin/community`
- `/admin/support-cases`
- `/admin/visibility`
- `/admin/notifications`
- `/admin/exchange-rate`
- `/admin/audit-log`
- `/admin/settings`

---

## 8. Next.js y backend

### 8.1. Uso recomendado de Next.js

La app debe usar Next.js App Router.

- Server Components para pantallas que cargan datos sensibles o iniciales.
- Client Components solo cuando haya interacción real.
- Server Actions para mutaciones internas de la app.
- Route Handlers para webhooks, integraciones externas, generación de archivos o endpoints que requieran una URL HTTP estable.

### 8.2. Route Handlers

Deben usarse para:

- webhooks de pagos (**MercadoPago y PayU, en handlers separados**);
- webhook de facturación fiscal (**TusFacturas.app**, si el proveedor lo requiere para confirmaciones asíncronas);
- generación o descarga segura de comprobantes;
- actualización programada del tipo de cambio si se expone como endpoint interno;
- endpoint público de verificación de comprobante (`/api/verify/[verification_code]` o resuelto directamente en la ruta pública, según decida Claude Code);
- integraciones con servicios externos;
- endpoints que no sean directamente acciones de UI.

### 8.3. Server Actions

Deben usarse para:

- crear propuesta de solicitud (familiar);
- aprobar/rechazar propuesta de solicitud (estudiante);
- crear solicitud;
- establecer contacto (genera el botón de WhatsApp con el número correcto según `contact_target`);
- enviar propuesta de ajuste de condiciones (residencia, máximo 1 vez);
- responder a propuesta de ajuste (estudiante);
- marcar pago recibido;
- pagar fee (seleccionando MercadoPago o PayU);
- crear renovación;
- aceptar/rechazar renovación;
- **ejercer revocación del fee (estudiante/familiar pagador, dentro de los 10 días corridos)**;
- actualizar perfil;
- actualizar disponibilidad;
- subir documentos;
- gestionar lista de espera;
- abrir caso de soporte;
- ejecutar acciones admin, incluyendo gestión de feature flags freemium.

### 8.4. Regla obligatoria

Ninguna Server Action debe confiar en datos enviados desde el cliente sin volver a validar:

- usuario autenticado;
- rol;
- permisos;
- **contexto de residencia activa (`residence_id`) si aplica**;
- estado actual de la entidad;
- transición permitida;
- propiedad o relación con la entidad;
- consistencia del snapshot (`snapshot_original` vs. `snapshot_final`);
- límites de solicitudes (máximo 2 activas);
- **límite de propuestas de ajuste (máximo 1 por solicitud)**;
- plazos (48 horas, con reinicio según corresponda).

---

## 9. Supabase/PostgreSQL

### 9.1. Base de datos

PostgreSQL debe ser la fuente de verdad para todas las entidades listadas en `06_DATA_MODEL.md`, incluyendo las nuevas: `family_application_proposals`, `application_negotiation_proposals`, `residence_faq_predefined_questions`, y los campos de feature flag freemium en `residences`.

### 9.2. Row Level Security

Debe habilitarse RLS en todas las tablas expuestas.

Regla obligatoria:

> Ninguna tabla sensible debe quedar accesible desde cliente sin políticas RLS explícitas.

Las políticas deben cubrir:

- estudiante accede a sus datos;
- familiar accede solo al estudiante vinculado activo y según permisos habilitados (incluyendo si puede crear propuestas);
- **el contenido de una propuesta de solicitud del familiar solo es visible para el familiar creador y el estudiante destinatario, nunca para la residencia hasta la aprobación**;
- residence owner accede solo a las residencias donde tiene `residence_users` activo (hasta 10);
- residence staff accede solo a las residencias específicas asignadas, **incluso si el owner gestiona varias**;
- admin accede desde backend/admin, no desde cliente común;
- documentos se acceden solo por contexto autorizado;
- comunidad visible respeta configuración del usuario.

### 9.3. Service role key

No debe:

- enviarse al cliente;
- exponerse en logs;
- hardcodearse;
- usarse desde componentes de UI;
- usarse en acciones no auditadas.

### 9.4. Funciones de base de datos

Se pueden usar funciones SQL para: cálculos de métricas; validación de límites (2 solicitudes activas, 1 propuesta de ajuste); agregados de disponibilidad; mantenimiento de snapshots; reportes admin; jobs programados.

Las reglas de negocio críticas deben ser legibles también en la capa de dominio TypeScript, no solo en SQL.

---

## 10. Modelo de seguridad

### 10.1. Seguridad por capas

1. **UI:** ocultar acciones no permitidas.
2. **Server:** validar permisos antes de ejecutar.
3. **Database:** RLS y constraints para impedir acceso indebido.

No alcanza con ocultar botones.

### 10.2. Acciones críticas

Siempre requieren validación server-side y audit log:

- crear propuesta de solicitud (familiar);
- aprobar/rechazar propuesta de solicitud (estudiante);
- crear solicitud;
- establecer contacto;
- enviar propuesta de ajuste de condiciones;
- responder a propuesta de ajuste;
- marcar pago recibido;
- confirmar fee;
- emitir comprobante;
- emitir factura fiscal;
- cancelar solicitud;
- cancelar reserva;
- crear renovación;
- aceptar renovación;
- modificar tarifas;
- modificar disponibilidad;
- editar perfil de residencia;
- aprobar verificación;
- pausar residencia;
- suspender residencia;
- abrir caso de soporte;
- procesar reembolso;
- reemitir comprobante;
- reemitir o anular factura fiscal;
- cambiar permisos de staff;
- vincular o desvincular familiar;
- **otorgar o revocar acceso freemium a Gestión Operativa**.

---

## 11. Autenticación y usuarios

### 11.1. Supabase Auth

Métodos iniciales recomendados: email/password; magic link opcional; OAuth opcional más adelante. Teléfono/WhatsApp no es necesario para auth (recordar: WhatsApp no tiene integración de API en este producto).

### 11.2. Roles de dominio

Deben existir tablas de dominio: `users`; `user_roles`; `student_profiles`; `family_links`; `family_application_proposals`; `residence_users`. (No existe una tabla `admin_users` separada: los roles `admin`/`superadmin` se asignan vía `user_roles` — ver `06_DATA_MODEL.md` §5.)

**2FA:** TOTP vía Supabase Auth MFA, obligatorio para admin y superadmin desde la beta privada (decisión confirmada).

### 11.3. Menores de edad

Si el estudiante es menor: no puede finalizar registro sin familiar vinculado; el flujo debe bloquear acciones críticas hasta completar vinculación; toda acción sensible debe respetar reglas de privacidad y permisos definidas en `10_PRIVACY_AND_LEGAL_RULES.md`.

---

## 12. Storage y archivos

### 12.1. Supabase Storage

Se recomienda para: fotos de residencias; fotos/avatares de estudiantes; documentos de estudiantes; documentos de residencias; checklists de verificación; comprobantes de pago a residencia; comprobantes PDF emitidos por EstuRed; **facturas fiscales (Factura C) generadas por TusFacturas.app**; evidencias de casos de soporte.

### 12.2. Buckets — alineados con `06_DATA_MODEL.md`

```txt
public-residence-media
private-user-documents
private-residence-documents
payment-proofs
generated-receipts
fiscal-documents
support-evidence
```

### 12.3. Reglas de storage

- Las imágenes públicas deben pasar por moderación o revisión según corresponda.
- Documentos privados nunca deben ser públicos.
- Los comprobantes y facturas fiscales deben descargarse mediante URL firmada o endpoint seguro.
- Evidencias de soporte deben ser privadas.
- Los archivos deben tener owner/contexto asociado en base de datos.
- Todo acceso a documento sensible por parte de admin debe requerir justificación registrada previa y quedar auditado.

### 12.4. Validaciones de archivos

Cada upload debe validar: tipo MIME; extensión; tamaño máximo; usuario autorizado; contexto de uso; nombre sanitizado; bucket correcto.

---

## 13. Pagos

### 13.1. Principio de pagos

La arquitectura de pagos debe ser intercambiable. No hardcodear MercadoPago, PayU u otro proveedor dentro de la lógica de negocio.

```ts
interface PaymentProvider {
  createPaymentIntent(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  getPaymentStatus(providerPaymentId: string): Promise<PaymentStatusResult>;
  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult>;
  parseWebhook(request: Request): Promise<ProviderWebhookEvent>;
}
```

### 13.2. Proveedores confirmados

- **MercadoPago** — cobro en ARS, orientado a pagadores en Argentina.
- **PayU Argentina** — cobro en USD, orientado a pagadores fuera de Argentina, aunque disponible para cualquier usuario que prefiera pagar en dólares.

Ambos deben implementar la misma interfaz `PaymentProvider` y estar disponibles simultáneamente para que el pagador elija.

El sistema también debe soportar: pago manual (transferencia, billetera virtual, validación admin); comprobante subido por usuario.

### 13.3. Estados internos

El estado interno de EstuRed gobierna la reserva. El proveedor de pagos solo informa eventos.

Estados: `not_required_yet`; `pending_payment_method`; `pending_manual_payment`; `pending_auto_charge`; `processing`; `paid`; `failed`; `expired`; `refunded`; `chargeback`.

### 13.4. Reglas críticas

- La reserva no se confirma si el fee EstuRed no está pagado.
- No se emite comprobante sin reserva confirmada.
- **No se emite factura fiscal antes de que el fee esté pagado.**
- Si falla el cobro, se permiten hasta 3 intentos dentro de 48 horas.
- Si vence el fee, no hay reserva confirmada en EstuRed.
- El fee se calcula siempre sobre `snapshot_final` (condiciones originales si no hubo negociación, o condiciones ajustadas si la residencia propuso un cambio y el estudiante lo aceptó).
- El reembolso de lo abonado a la residencia depende de la residencia.
- El reembolso del fee EstuRed solo aplica según política aprobada: incumplimiento atribuible a residencia, revisión de EstuRed y normativa aplicable.

### 13.5. Webhooks

Deben: validar firma o autenticidad; ser idempotentes; guardar evento crudo; actualizar estado de pago interno; disparar transición de reserva solo si las reglas de negocio lo permiten; **disparar emisión de factura fiscal cuando el fee pasa a `paid`**; registrar audit log; no confiar en datos sin verificar contra provider/backend.

### 13.6. Idempotencia

Toda operación de pago debe tener `idempotency_key`.

Debe impedir: cobro duplicado; emisión duplicada de comprobante; emisión duplicada de factura fiscal; doble confirmación de reserva; doble reembolso.

---

## 14. Tipo de cambio y moneda

### 14.1. Regla de producto

Las tarifas deben mostrarse en USD y ARS. **El fee EstuRed puede cobrarse en ARS (MercadoPago) o en USD (PayU Argentina), según elija el pagador** — no está limitado a ARS.

### 14.2. ExchangeRateProvider — fuente confirmada

```ts
interface ExchangeRateProvider {
  getReferenceUsdArsRate(date: Date): Promise<ExchangeRateResult>;
}
```

**Fuente confirmada: monedapi.ar, dólar blue, valor de venta.** Actualización diaria automática. Admin puede hacer override manual con motivo obligatorio si la fuente falla.

### 14.3. Tabla diaria

`exchange_rates` con campos: `id`; `rate_date`; `base_currency`; `quote_currency`; `official_exchange_rate_ars_per_usd`; `source_name` (`monedapi.ar`); `source_url`; `rate_type` (`blue_sell`); `manually_overridden`; `overridden_by_user_id`; `override_reason`; `fetched_at`; `created_at`.

### 14.4. Snapshot obligatorio

Cada solicitud debe guardar `snapshot_original` al enviarse, y opcionalmente `snapshot_final` si hubo una propuesta de ajuste aceptada. Ambos incluyen: precio USD; precio ARS; tipo de cambio usado; fuente; fecha/hora del cálculo; duración; matrícula; depósito; política de ajustes; base del fee; fee calculado.

Después de generado, ningún snapshot cambia retroactivamente.

### 14.5. Redondeo

- Tarifas USD terminan en 0 o 5.
- Tarifas ARS terminan en 500 o 000.
- Fee EstuRed se redondea a múltiplos de 500 ARS.
- Cálculos internos pueden conservar mayor precisión, pero el usuario ve montos redondeados.

---

## 15. Comprobantes y PDFs

### 15.1. Comprobantes requeridos

- **Comprobante de Reserva Confirmada.**
- **Comprobante de Renovación Confirmada.**

### 15.2. Generación server-side

No generar comprobantes oficiales solo en cliente.

### 15.3. Contenido mínimo

ID interno; código de verificación (`verification_code`) y QR; fecha de emisión; estudiante; familiar pagador si aplica; residencia; responsable de residencia si aplica; tipo de habitación/plaza; fecha estimada de ingreso; duración inicial o período renovado; objetivo académico declarado; **condiciones finales aceptadas (`snapshot_final`)**; monto abonado a residencia informado por residencia; fee EstuRed y moneda; estado del fee; **referencia a la factura fiscal asociada**; política de ajustes futuros; disclaimers; contacto de soporte.

### 15.4. QR/código verificable

El QR debe apuntar a:

`/verify/[verification_code]`

**(No `/verify/receipt/[public_code]` como en versiones anteriores — la ruta pública confirmada es la de `08_UI_SCREENS_AND_FLOWS.md`.)**

La vista pública de verificación no debe mostrar datos sensibles completos. Debe mostrar: comprobante válido/inválido; residencia; nombre + inicial del estudiante; fecha de emisión; tipo de habitación/plaza; fecha de ingreso; duración.

### 15.5. Estados

`not_available`; `pending_generation`; `issued`; `generation_failed`; `voided`; `reissued`.

Si falla la generación, crear alerta admin. La reserva permanece `confirmed` aunque el comprobante falle — se reintenta de forma independiente.

---

## 16. Facturación fiscal — sección nueva

### 16.1. Principio

EstuRed opera como **monotributista** y emite **Factura C** por el fee de servicio cobrado, mediante integración con **TusFacturas.app**.

La arquitectura debe abstraer este proveedor igual que pagos y tipo de cambio:

```ts
interface FiscalInvoiceProvider {
  emitInvoice(input: EmitInvoiceInput): Promise<EmitInvoiceResult>;
  voidInvoice(invoiceId: string, reason: string): Promise<VoidInvoiceResult>;
  getInvoiceStatus(invoiceId: string): Promise<InvoiceStatusResult>;
}
```

### 16.2. Cuándo se emite

Automáticamente cuando `estured_fee_payments.status` pasa a `paid` (por webhook de MercadoPago/PayU o por confirmación manual de admin). Nunca antes.

### 16.3. Datos requeridos

Del pagador: nombre completo o razón social; CUIT/CUIL (opcional para consumidor final); condición frente al IVA (default: consumidor final). De la operación: monto; moneda; descripción con el beneficiario del servicio (nombre del estudiante si el pagador es el familiar).

### 16.4. Regla de no bloqueo

Si la emisión de la factura falla, **la reserva no queda bloqueada** — ya se confirmó con el fee pagado. La factura queda en estado `issue_failed` y se reintenta de forma independiente vía job. Esta es una decisión de producto ya asumida (ver `09_ADMIN_PANEL_SPEC.md` §15.4); si en el futuro se decide lo contrario, requiere actualizar esta sección.

### 16.5. Riesgo a monitorear

El monotributo tiene límites de facturación anual. No es bloqueante para el MVP, pero el admin panel debe eventualmente exponer el acumulado facturado en el período fiscal vigente.

### 16.6. Tabla

`estured_fee_payments` incluye `fiscal_invoice_status`, `fiscal_invoice_id`, `fiscal_invoice_number`, `fiscal_invoice_issued_at`, `fiscal_invoice_file_id`, `fiscal_invoice_retry_count` y `fiscal_invoice_last_error` (ver `06_DATA_MODEL.md §13.2`). La factura NO es una tabla separada.

---

## 16bis. WhatsApp — no es un proveedor de notificaciones

A diferencia de versiones anteriores de este documento, **WhatsApp no debe implementarse como parte de `NotificationProvider`** ni tener integración de API (Business API, Twilio, 360dialog, etc.) en el MVP.

El único uso de WhatsApp es:

- Cuando la residencia establece contacto con una solicitud, el sistema genera un enlace `wa.me/[numero]?text=[mensaje_codificado]` con un mensaje pre-formateado (nombre del estudiante o familiar según `contact_target`, residencia, condiciones, monto requerido).
- La residencia hace clic, WhatsApp se abre en su dispositivo, y copia/envía el mensaje manualmente.
- El sistema registra el timestamp de cuando se presionó el botón (`contact_established_at`), no el contenido de la conversación.

No implementar: envío automático de mensajes; webhooks de WhatsApp; almacenamiento de conversaciones; integración con Meta Business API.

---

## 17. Notificaciones

### 17.1. Principio

Toda notificación crítica debe pasar por una tabla `notification_outbox` o equivalente. No enviar notificaciones directamente desde cualquier función sin registro.

### 17.2. Canales — actualizado

Canales soportados por `NotificationProvider`: **email** (obligatorio como respaldo); **in-app**.

**WhatsApp queda fuera de esta abstracción** (ver sección 16bis).

```ts
interface NotificationProvider {
  send(input: SendNotificationInput): Promise<SendNotificationResult>;
}
```

Implementaciones: `EmailProvider`; `InAppProvider`.

### 17.3. Eventos obligatorios — actualizado

- propuesta de solicitud del familiar creada / aprobada / rechazada / vencida;
- solicitud enviada;
- solicitud recibida por residencia;
- solicitud en revisión;
- contacto establecido;
- propuesta de ajuste de condiciones enviada / aceptada / rechazada / vencida;
- plazo de 48h iniciado (y reiniciado por negociación);
- recordatorio de pago a residencia;
- pago recibido por residencia;
- fee EstuRed pendiente / fallido / pagado;
- **factura fiscal emitida / fallida**;
- reserva confirmada;
- comprobante emitido;
- solicitud vencida (con opción de actualizar parámetros);
- plaza tomada;
- lista de espera con disponibilidad;
- recordatorio de lista de espera a los 90 días;
- oferta de renovación;
- renovación aceptada / confirmada;
- caso de soporte abierto / actualizado;
- residencia con disponibilidad vencida;
- verificación por vencer;
- tarifa con variación mayor a 15%.

---

## 18. Jobs automáticos

### 18.1. Jobs requeridos en MVP — actualizado

1. `sync_daily_exchange_rate` — actualiza tipo de cambio desde monedapi.ar una vez por día.
2. `expire_family_proposals` — vence propuestas del familiar sin respuesta en 48h.
3. `expire_negotiation_proposals` — vence propuestas de ajuste sin respuesta en 48h.
4. `expire_application_requests` — vence solicitudes por falta de respuesta de residencia o de pago del estudiante.
5. `retry_estured_fee_payments` — hasta 3 intentos dentro de 48h.
6. `expire_estured_fee_windows` — marca fee vencido si no se paga.
7. `emit_pending_fiscal_invoices` — reintenta emisión de facturas fiscales fallidas.
8. `send_residence_pending_application_reminders` — recordatorios diarios a residencias.
9. `check_availability_staleness` — detecta disponibilidad no actualizada en 30 días; oculta de búsqueda tras 15 días adicionales en `not_updated`.
10. `send_waitlist_90_day_confirmation`.
11. `remove_waitlist_after_confirmed_reservation`.
12. `recalculate_residence_visibility_metrics`.
13. `check_verification_expiration`.
14. `retry_receipt_generation`.
15. `dispatch_notification_outbox`.

### 18.2. Reglas de jobs

**Solución confirmada: Supabase pg_cron** (los jobs horarios de vencimiento no funcionan en el plan gratuito de Vercel Cron; la decisión ya no está delegada).

Deben ser idempotentes; deben registrar logs; deben evitar doble procesamiento; deben usar locks o marcas de procesamiento cuando aplique; deben reportar fallos al admin.

**Granularidad horaria:** los jobs de vencimiento corren cada hora, por lo que un plazo de 48h puede ejecutarse hasta 59 minutos después del instante exacto. Es un comportamiento aceptado — no debe "corregirse" con lógica adicional de precisión.

---

## 19. Auditoría

### 19.1. Tabla audit_logs

Campos: `id`; `actor_user_id`; `actor_role`; `action`; `entity_type`; `entity_id`; `before_data`; `after_data`; `reason`; `ip_address`; `user_agent`; `source` (`user`/`admin`/`system`/`payment_provider`); `created_at`.

### 19.2. Acciones auditables obligatorias — actualizado

Cambios de tarifas; cambios de disponibilidad; cambios de perfil de residencia; verificación de residencia; **creación, aprobación y rechazo de propuestas del familiar**; solicitud enviada; contacto establecido; **envío y respuesta de propuestas de ajuste**; rechazo de solicitud; pago recibido marcado por residencia; fee pagado/fallido; reembolso; **emisión, anulación o reintento de factura fiscal**; reserva confirmada; comprobante emitido/anulado; renovación creada/confirmada; documento visto o descargado (con justificación); cambio de visibilidad de perfil; vinculación familiar; cambios de permisos staff; caso de soporte abierto; penalización de residencia; suspensión de usuario; **cambio de feature flag freemium por residencia**; override de tipo de cambio.

### 19.3. Regla admin

Toda acción admin crítica debe exigir motivo. No permitir overrides silenciosos.

---

## 20. Métricas y visibilidad

### 20.1. Métricas internas

Ponderación aprobada: respuesta y velocidad 25%; disponibilidad actualizada 20%; conversión a reserva 20%; perfil completo/verificado 15%; baja tasa de reclamos validados 10%; uso operativo de plataforma 10%.

### 20.2. Uso de métricas

Internas en MVP. No crear ranking público. Se usan para visibilidad interna, alertas, advertencias, penalizaciones, priorización de residencias, diagnóstico admin.

### 20.3. Alertas tarifarias

Si una residencia cambia una tarifa, matrícula o depósito más de ±15% en una edición: se permite el cambio; se audita; se genera alerta en `/admin/pricing`; admin puede revisar y tomar acción.

---

## 21. Admin panel técnico

### 21.1. Prioridad

Must Have. No se puede lanzar MVP operativo sin admin.

### 21.2. Implementación

Rutas protegidas; validación de rol admin/superadmin server-side; no depender solo de ocultar UI; service role solo en backend; auditar acciones críticas; mostrar información suficiente para operar sin tocar base de datos manualmente.

### 21.3. Operaciones críticas admin — actualizado

Aprobar residencia; pausar/suspender residencia; revisar tarifas; revisar solicitudes; **revisar propuestas del familiar y negociaciones activas**; reiniciar/anular/pausar solicitudes; validar pagos manuales; procesar reembolsos; emitir/reemitir/anular comprobantes; **reintentar o reemitir facturas fiscales**; gestionar casos de soporte; revisar documentos (con justificación); revisar audit logs; editar tipo de cambio manualmente; **gestionar feature flags de plan freemium por residencia**.

---

## 22. Búsqueda y SEO

### 22.1. Búsqueda

Debe soportar: zona; tipo de habitación; rango de precio; disponibilidad; residencia verificada; modo operativo; completa/lista de espera; orden por visibilidad interna.

### 22.2. SEO

Indexables: landing; landing estudiantes; landing residencias; búsqueda; fichas públicas de residencias verificadas.

No indexar: dashboards; documentos; comprobantes privados; perfiles completos de estudiantes; admin; datos sensibles; **`/verify/[verification_code]` no debería indexarse individualmente para evitar exposición masiva de códigos, aunque el contenido mostrado sea limitado**.

### 22.3. Datos limitados para invitados

No exponer comunidad completa ni datos sensibles en HTML público.

---

## 23. Comunidad visible

### 23.1. Implementación técnica

Basada en: habitaciones; plazas; residentes; visibilidad configurada por usuario; permisos por rol; consentimiento.

### 23.2. Regla obligatoria

La residencia no puede forzar visibilidad completa del residente. Si no activa cuenta o no habilita visibilidad: `Plaza ocupada` o `Residente pendiente de activar cuenta`.

### 23.3. Datos nunca visibles

Apellido completo; email; teléfono; fecha de nacimiento; universidad; documentos; datos de pago.

---

## 24. FAQ / bot limitado

### 24.1. MVP — actualizado a Must Have

El FAQ ya no es Could Have — es **Must Have**. Debe responder solo con información cargada por la residencia (preguntas elegidas de un listado predefinido por EstuRed + respuestas propias + archivos) o campos estructurados del perfil.

No debe inventar: disponibilidad; precios; reglas; condiciones; descuentos; políticas de devolución.

### 24.2. Arquitectura

Tablas: `residence_faq_predefined_questions` (listado global); `residence_faq_items` (configuración por residencia); `bot_interactions` (log de preguntas y respuestas, incluyendo no respondidas).

### 24.3. IA futura

IA avanzada queda para fase posterior. Debe agregarse solo si hay controles de fuente, revisión y responsabilidad.

---

## 25. Renovaciones

### 25.1. Must Have

Deben integrarse al mismo patrón del loop central: residencia emite oferta → estudiante acepta → estudiante paga a residencia → residencia marca pago recibido → EstuRed cobra fee → renovación confirmada → comprobante emitido.

Se modelan con dos entidades separadas: `renewal_requests` (solicitud informal del estudiante, no vinculante) y `renewal_offers` (oferta formal de la residencia), según `04_STATE_MACHINES.md`.

### 25.2. Fee de renovación

**Idéntico al fee de la reserva inicial, sin excepciones:** 5% del período renovado; tarifa actual; sin estimar ajustes futuros; incluye cargos obligatorios no reembolsables si aplican; excluye depósito reembolsable. Esta decisión es explícita para reducir complejidad de código — no crear una fórmula alternativa.

### 25.3. Comprobante

**Comprobante de Renovación Confirmada**, con `verification_code` propio.

---

## 26. Freemium y Gestión Operativa — sección nueva

### 26.1. Principio

El acceso a Gestión Operativa (habitaciones, plazas, residentes, disponibilidad real, comunidad visible avanzada) se controla mediante un **feature flag por residencia**: `residences.has_operational_management_access`.

### 26.2. Reglas

- Las residencias pioneras de beta tienen acceso gratuito por 1 año (`pioneer_free_access_until`).
- El admin puede otorgar, revocar o extender el acceso, siempre con motivo auditado.
- El sistema debe bloquear server-side cualquier intento de crear habitaciones, plazas o residentes si la residencia no tiene el flag activo — no debe ser solo una restricción de UI.
- Esta decisión de negocio (a quién se le otorga y cuándo) **no debe delegarse a Claude Code**; Claude Code implementa el mecanismo técnico del flag, pero la asignación es responsabilidad del equipo de producto/admin.

### 26.3. Precio del plan pago

No definido aún. El flujo de `/residence/[residence_id]/plan` puede mostrar "Contactanos para más información" en vez de un checkout de suscripción hasta que se defina.

---

## 27. Ambientes

### 27.1. Ambientes mínimos

`local`; `staging`; `production`.

### 27.2. Reglas

No usar datos reales en local; no probar pagos reales en staging sin bandera explícita; no usar service keys de producción fuera de producción; separar buckets por ambiente; los webhooks de staging y producción deben ser distintos.

### 27.3. Variables de entorno

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=

MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=

PAYU_API_KEY=
PAYU_API_LOGIN=
PAYU_MERCHANT_ID=
PAYU_ACCOUNT_ID=
PAYU_WEBHOOK_SECRET=

EXCHANGE_RATE_SOURCE=monedapi.ar
EXCHANGE_RATE_API_URL=

TUSFACTURAS_API_KEY=
TUSFACTURAS_API_TOKEN=
TUSFACTURAS_PUNTO_VENTA=

NOTIFICATION_EMAIL_PROVIDER=
PDF_SIGNING_SECRET=
RECEIPT_PUBLIC_BASE_URL=
APP_BASE_URL=
ADMIN_BASE_URL=
CRON_SECRET=
SENTRY_DSN=
```

No hardcodear secretos. **No incluir variables de WhatsApp Business API — no aplica a este producto.**

---

## 28. Logging y monitoreo

### 28.1. Logs

Registrar logs estructurados para: errores server; fallos de pago; fallos de facturación fiscal; webhooks; generación de comprobantes; jobs; notificaciones; acciones admin; cambios de estado inesperados.

### 28.2. Error tracking

Se recomienda integrar un proveedor de monitoreo de errores (decisión delegada a Claude Code, priorizando opciones gratuitas). No obligatorio para prototipo, recomendable antes de beta pública.

### 28.3. Alertas críticas

Falla generación de comprobante; **falla emisión de factura fiscal**; falla webhook de pago (MercadoPago o PayU); falla tipo de cambio diario; muchas solicitudes vencidas; residencia con muchos rechazos por disponibilidad; pago manual pendiente demasiado tiempo; verificación vence; cambios de tarifa superan ±15%; reclamo crítico; **negociación vencida sin respuesta**; **propuesta del familiar vencida repetidamente para el mismo familiar** (señal pasiva, no automatizada — ver `09_ADMIN_PANEL_SPEC.md` §11.4).

---

## 29. Testing y QA

### 29.1. Tipos de test

Unit tests para cálculos de fee (sobre `snapshot_final`); unit tests para redondeo; unit tests para máquinas de estado (incluyendo propuesta del familiar y negociación); integration tests para server actions críticas; RLS tests para permisos (incluyendo aislamiento multi-residencia); webhook tests para pagos (MercadoPago y PayU) y facturación (TusFacturas); e2e tests para flujos principales; QA manual de admin panel; QA de documentos y privacidad; QA responsive.

### 29.2. Flujos E2E obligatorios — actualizado

1. Familiar crea propuesta → estudiante aprueba → se convierte en solicitud con `initiated_by`/`contact_target` correctos.
2. Familiar crea propuesta → estudiante rechaza → no se crea solicitud.
3. Estudiante envía solicitud directamente.
4. Residencia establece contacto → botón WhatsApp con número correcto.
5. Residencia envía propuesta de ajuste → estudiante ve comparación → acepta → fee se recalcula sobre `snapshot_final`.
6. Residencia intenta enviar segunda propuesta de ajuste → bloqueado.
7. Residencia marca pago recibido.
8. Fee EstuRed se cobra vía MercadoPago (ARS).
9. Fee EstuRed se cobra vía PayU (USD).
10. Factura fiscal se emite automáticamente tras el pago del fee.
11. Reserva se confirma; comprobante se emite con `verification_code` válido en `/verify/[codigo]`.
12. Segunda solicitud del estudiante se pausa y luego se cierra al confirmarse la primera.
13. Lista de espera no cuenta como solicitud activa.
14. Renovación se confirma con fee idéntico a la reserva inicial.
15. Familiar paga fee.
16. Menor requiere familiar vinculado.
17. Admin reemite comprobante.
18. Admin reintenta factura fiscal fallida.
19. Residencia cambia tarifa ±15% y genera alerta.
20. Disponibilidad vencida genera alerta y oculta la residencia tras 15 días adicionales.
21. Owner con 2 residencias ve ambos dashboards en `/residence/dashboard` sin datos cruzados.
22. Admin otorga acceso freemium a residencia pionera con fecha límite.

### 29.3. Tests de seguridad

Estudiante no accede a documentos de otro estudiante; familiar no accede sin vínculo activo; **familiar no ve el contenido de una propuesta de otro estudiante**; staff no accede a residencia ajena aunque pertenezca al mismo owner sin asignación explícita; residencia no accede a documentos no autorizados ni a propuestas del familiar antes de aprobación; usuario no admin no accede `/admin`; invitado no ve comunidad completa; comprobantes y facturas privados no son públicos; service role no se expone.

---

## 30. Performance

### 30.1. Public pages

Optimizar para velocidad y SEO: imágenes optimizadas; lazy loading; caching controlado; filtros eficientes; paginación; índices de búsqueda.

### 30.2. Dashboards

No sobrecargar consultas. Usar queries específicas; DTOs resumidos; paginación; filtros; agregados precomputados cuando convenga; invalidación selectiva. **El dashboard multi-residencia debe cargar cada bloque de residencia de forma independiente (idealmente con streaming/suspense), no bloquear el render esperando las 10 residencias a la vez.**

### 30.3. Admin

Consultas pesadas permitidas, pero deben paginar, filtrar, no cargar archivos completos, no exponer datos sensibles innecesarios, registrar accesos a documentos.

---

## 31. Accesibilidad y responsive

Funcionar correctamente en mobile; formularios claros; errores accionables; navegable con teclado en flujos importantes; contraste suficiente; evitar modales críticos sin alternativa; mostrar estados de carga; no depender solo de color para estados. **La vista comparativa de negociación (condiciones originales vs. propuestas) debe ser legible en mobile, apilada verticalmente si es necesario.**

---

## 32. Internacionalización

MVP en español. Arquitectura preparada para futuro: inglés, portugués, mensajes por país, monedas múltiples, usuarios internacionales.

No construir i18n completo si retrasa el MVP. Pero no hardcodear textos críticos dentro de lógica de negocio.

---

## 33. Migraciones y seeds

### 33.1. Migraciones

Usar migraciones versionadas para: tablas; enums; índices; constraints; RLS; funciones SQL; triggers.

### 33.2. Seed data

Crear seeds para: admin inicial; residencias demo (incluyendo al menos una con Gestión Operativa habilitada); estudiantes demo; familiar demo con propuesta de ejemplo; habitaciones/plazas; tarifas; solicitudes en distintos estados (incluyendo una con negociación); reservas; FAQ predefinidas; tipo de cambio inicial.

No mezclar datos demo con producción.

---

## 34. Backups y recuperación

Antes de beta pública: activar backups de base de datos; definir política de retención; exportar storage crítico si aplica; documentar restauración; probar recuperación al menos una vez.

Tablas críticas: solicitudes; propuestas del familiar; negociaciones; reservas; pagos; facturas fiscales; comprobantes; documentos; audit logs; usuarios; residencias; verificación.

---

## 35. Índices recomendados

Los índices oficiales viven en `06_DATA_MODEL.md §24`. No se repiten acá para evitar divergencia de nombres (`applications` vs `application_requests`, `student_id` vs `student_profile_id`). Ver `06 §24`.

Para búsqueda avanzada futura, evaluar full-text search o servicio externo.

---

## 36. Constraints y consistencia

La base de datos debe impedir errores básicos:

- máximo un familiar activo por estudiante;
- estudiante menor no completa registro sin familiar;
- no publicar residencia sin verificación activa;
- no emitir comprobante sin reserva confirmada;
- no emitir factura fiscal sin fee pagado;
- no confirmar reserva sin fee pagado;
- no crear más de 2 solicitudes activas por estudiante (las propuestas del familiar en `pending_student_approval` no cuentan);
- **no permitir más de 1 propuesta de ajuste de condiciones por solicitud**;
- no activar lista de espera como solicitud automáticamente;
- no crear dos reservas confirmadas para la misma plaza y período;
- **no permitir que una residencia use módulos de Gestión Operativa sin el feature flag activo**;
- no borrar audit logs;
- no eliminar documentos críticos sin registro.

Algunas reglas pueden implementarse en server layer si son complejas, pero deben quedar cubiertas por tests.

---

## 37. Estrategia de construcción por fases técnicas

### Fase 0 — Setup
Repo; Next.js; TypeScript; Tailwind; Supabase; Auth; migraciones base; layouts; rutas protegidas.

### Fase 1 — Usuarios y permisos
Registro; roles; estudiante; familiar; residencia owner/staff (con soporte multi-residencia desde el modelo de datos); admin; RLS base.

### Fase 2 — Residencias públicas
Alta de residencia; perfil; verificación; fotos; tarifas; búsqueda; detalle público; FAQ (predefinidas + respuestas).

### Fase 3 — Solicitudes, propuestas y negociación
Perfil estudiante; snapshot; **propuesta de solicitud del familiar**; crear solicitud; dashboard estudiante; dashboard residencia; **flujo de negociación (propuesta de ajuste, comparación, aceptación)**; estados; límite de 2 solicitudes; botón "Actualizar con mismos parámetros".

### Fase 4 — Pago a residencia, fee y facturación
Contacto establecido (botón WhatsApp); pago a residencia registrado; fee EstuRed; `PaymentProvider` (MercadoPago + PayU); pago manual; reintentos; **`FiscalInvoiceProvider` (TusFacturas.app)**.

### Fase 5 — Reserva y comprobantes
Reserva confirmada; PDF; QR; comprobante con `verification_code`; verificación pública `/verify/[codigo]`; reemisión admin.

### Fase 6 — Admin MVP
Residencias; verificaciones; solicitudes; **propuestas del familiar; negociaciones**; reservas; pagos; **facturas fiscales**; comprobantes; pricing alerts; audit log.

### Fase 7 — Disponibilidad, habitaciones y Gestión Operativa (freemium)
Tipos de habitación; habitaciones; plazas; disponibilidad semi-real; disponibilidad asegurada; residentes; comunidad visible; **feature flag freemium y su gestión admin**.

### Fase 8 — Multi-residencia
Dashboard `/residence/dashboard` en scroll vertical con filtro; alta de residencia adicional (hasta 10); asignación de staff a múltiples residencias; aislamiento de datos por residencia.

### Fase 9 — Lista de espera y renovaciones
Lista de espera; notificaciones; ofertas de renovación; fee de renovación (idéntico al inicial); comprobante de renovación.

### Fase 10 — Métricas, soporte y pulido
Métricas de visibilidad; penalizaciones; soporte y resolución de conflictos; QA completo; beta cerrada con residencias pioneras.

---

## 38. Reglas estrictas para Claude Code

1. Leer primero los documentos `00` a `11` completos.
2. No inventar reglas de negocio.
3. No fusionar propuesta del familiar, solicitud, negociación, reserva, pago, comprobante y factura fiscal.
4. No confirmar reserva sin fee pagado.
5. No emitir comprobante sin reserva confirmada.
6. No emitir factura fiscal antes de que el fee esté pagado.
7. No exponer documentos sensibles en cliente.
8. No exponer service role key.
9. No crear endpoints sin validación server-side.
10. No crear acciones críticas sin audit log.
11. No saltar RLS en tablas sensibles.
12. No hardcodear proveedor de pagos: usar `PaymentProvider` con MercadoPago y PayU.
13. No hardcodear fuente de tipo de cambio: usar `ExchangeRateProvider` con monedapi.ar.
14. No hardcodear proveedor de facturación: usar `FiscalInvoiceProvider` con TusFacturas.app.
15. No integrar la API de WhatsApp Business bajo ninguna circunstancia en el MVP.
16. No construir app nativa.
17. No construir Señales de Convivencia en MVP.
18. No crear ranking público.
19. No crear bot IA que invente condiciones, precios o disponibilidad.
20. No permitir que residencia publique sin verificación.
21. No permitir que familiar actúe sin vínculo activo, ni que envíe solicitudes directamente a la residencia sin aprobación del estudiante.
22. No permitir más de 2 solicitudes activas por estudiante.
23. No permitir más de 1 propuesta de ajuste de condiciones por solicitud.
24. No calcular el fee sobre `snapshot_original` si existe un `snapshot_final` aceptado.
25. No permitir uso de módulos de Gestión Operativa sin el feature flag habilitado para esa residencia.
26. Priorizar opciones técnicas gratuitas o económicas en las decisiones delegadas (sección 3.3).
27. Si encuentra ambigüedad, debe crear TODO documentado y pedir decisión — no asumir.

---

## 39. Antipatrones a evitar

Construir primero solo UI sin estados reales; usar formularios desconectados de reglas de negocio; guardar pagos como strings sueltos; manejar estados con texto libre; confiar en permisos solo del frontend; exponer buckets privados; generar comprobantes sin snapshot; permitir cambios de precio sin auditoría; dejar admin para después; depender de WhatsApp sin registrar el evento de contacto; construir PMS avanzado antes del loop principal; implementar IA antes de tener datos confiables; usar una sola tabla gigante para todo; **calcular el fee antes de saber si hubo negociación aceptada; tratar el freemium como una simple bandera de UI sin validación server-side; mezclar la lógica de múltiples residencias de un mismo owner sin aislamiento explícito por `residence_id`**.

---

## 40. Pendientes técnicos no bloqueantes

Ya **no** incluye proveedor de pagos, fuente de tipo de cambio ni facturación — están confirmados. Lo que resta:

1. Librería final de generación de PDF (validar en Fase 0 con un spike que funcione en el runtime serverless de Vercel — tamaño/cold start).
2. Proveedor de email transaccional.
3. Herramienta de monitoreo de errores.
4. Backups y recuperación — plan detallado.
5. Testing E2E automatizado — framework concreto.
6. Revisión legal final (ver `10_PRIVACY_AND_LEGAL_RULES.md` §31).
7. Precio del plan pago de Gestión Operativa.
8. ~~Solución de cron jobs~~ → Resuelto: Supabase pg_cron (ver §18.2).
9. Validación comercial/regulatoria del cobro en USD vía PayU Argentina (antes de activar PayU en producción; MercadoPago + modo manual cubren el flujo mientras tanto).

---

## 41. Fuentes técnicas oficiales consultadas

- Next.js — Route Handlers: https://nextjs.org/docs/app/getting-started/route-handlers
- Supabase — Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase — Storage: https://supabase.com/docs/guides/storage
- MercadoPago Argentina — Checkout API / Orders: https://www.mercadopago.com.ar/developers/es/docs/checkout-api-orders/overview
- PayU Argentina — documentación corporativa: https://corporate.payu.com/argentina/es/
- TusFacturas.app — guía de integración: https://developers.tusfacturas.app/como-empiezo
- monedapi.ar — fuente de tipo de cambio: https://monedapi.ar/

---

## 42. Resumen ejecutivo técnico

La arquitectura recomendada para EstuRed es una webapp responsive construida con Next.js, TypeScript, Supabase/PostgreSQL, Supabase Auth, Supabase Storage, Vercel, y tres proveedores externos confirmados y abstraídos: **MercadoPago + PayU Argentina** (pagos), **monedapi.ar** (tipo de cambio) y **TusFacturas.app** (facturación fiscal). WhatsApp se usa exclusivamente como botón manual, sin integración de API.

La prioridad técnica no es construir muchas pantallas rápido. La prioridad es proteger el loop central, ahora con su instancia opcional de negociación:

**propuesta del familiar (opcional) → solicitud → contacto → [negociación opcional, máx. 1 propuesta] → pago a residencia → fee EstuRed → factura fiscal → reserva confirmada → comprobante emitido.**

Todo el sistema debe estar diseñado para que ese loop sea seguro, auditable, escalable, operable desde admin, y replicable de forma aislada para hasta 10 residencias por owner.
