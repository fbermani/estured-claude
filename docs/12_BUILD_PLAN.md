# 12_BUILD_PLAN.md

# EstuRed — Plan de Construcción del MVP

**Versión:** 0.2
**Estado:** Documento actualizado para construcción
**Última actualización:** 2026-06-27
**Depende de:** `00` a `11`

## 0. Propósito del documento

Este documento define el plan de construcción del MVP de EstuRed para que Claude Code, un equipo técnico o un desarrollador puedan implementar la aplicación con un orden lógico, controlado y alineado con las reglas de producto ya definidas.

El objetivo no es construir toda la visión futura de EstuRed en un único bloque. El objetivo es construir primero el loop crítico del negocio y luego sumar los módulos operativos ya definidos como parte del MVP.

El loop central definitivo del MVP es:

**Estudiante (o familiar con aprobación del estudiante) busca residencia → envía solicitud → residencia establece contacto → [negociación opcional: la residencia propone un ajuste de condiciones, una sola vez; el estudiante acepta o rechaza] → estudiante paga a la residencia → residencia marca Pago recibido → EstuRed cobra el fee (ARS o USD) → se emite la factura fiscal → reserva confirmada → comprobante emitido.**

Toda fase de construcción debe reforzar este loop o preparar una dependencia directa para que funcione correctamente.

---

## 1. Documentos base obligatorios

Antes de construir, Claude Code debe leer estos archivos en este orden:

1. `00_DECISION_LOG.md`
2. `01_PRODUCT_BRIEF.md`
3. `02_MVP_SCOPE.md`
4. `03_BUSINESS_RULES.md`
5. `04_STATE_MACHINES.md`
6. `05_ROLES_AND_PERMISSIONS.md`
7. `06_DATA_MODEL.md`
8. `07_API_SPEC.md`
9. `08_UI_SCREENS_AND_FLOWS.md`
10. `09_ADMIN_PANEL_SPEC.md`
11. `10_PRIVACY_AND_LEGAL_RULES.md`
12. `11_TECH_ARCHITECTURE.md`
13. `12_BUILD_PLAN.md` (este documento)

Regla estricta: Claude Code no debe inventar reglas de negocio, estados, permisos ni flujos si ya están definidos en los documentos anteriores. Si detecta contradicciones, debe detenerse y pedir definición.

---

## 2. Principios de construcción

### 2.1. Construir por dominio, no por pantalla aislada

No construir primero una landing visual desconectada del sistema. El producto requiere datos, estados, permisos, pagos, facturación y comprobantes desde el inicio de cada dominio.

### 2.2. Separar propuesta del familiar, solicitud, negociación, pago, fee, reserva, comprobante y factura

No fusionar estas entidades.

- Una propuesta del familiar no es una solicitud (requiere aprobación del estudiante).
- Una solicitud no es una reserva.
- Una propuesta de ajuste de condiciones no cambia nada hasta que el estudiante la acepta.
- Una reserva no está confirmada hasta que el fee EstuRed esté pagado.
- Un comprobante no existe hasta que la reserva esté confirmada.
- Una factura fiscal no se emite hasta que el fee esté pagado.
- El pago a residencia no es procesado por EstuRed, pero debe quedar registrado como evento trazable.

### 2.3. Auditar todo lo crítico

Toda acción crítica debe crear un evento en `audit_logs`: creación/aprobación/rechazo de propuesta del familiar; envío y respuesta de propuesta de ajuste; cambios de tarifa; cambios de disponibilidad; solicitudes enviadas; contacto establecido; pago recibido marcado por residencia; fee pagado; factura fiscal emitida; comprobante emitido; residencia verificada; usuario suspendido; residencia penalizada; admin override; reembolso; cambio de permisos; cambio de visibilidad de perfil; cambio de feature flag freemium.

### 2.4. Priorizar web responsive

Web responsive. No app nativa. No bloquear arquitectura para futura PWA, pero no incluir nativo en MVP.

### 2.5. Multi-tenant desde el inicio, con soporte multi-residencia por owner

Las residencias deben estar aisladas por `residence_id`. Un owner puede gestionar hasta 10 residencias desde el mismo login; un staff solo ve las residencias donde tiene acceso explícito, incluso si pertenecen al mismo owner que gestiona otras.

### 2.6. Seguridad por backend

El cliente nunca debe poder cambiar estados críticos directamente. Toda acción sensible pasa por server actions/route handlers con validación de permisos y de contexto de residencia activa.

### 2.7. No construir IA avanzada en MVP

El FAQ del MVP (Must Have, no Could Have) debe limitarse a información cargada por la residencia y campos estructurados. No debe inventar disponibilidad, precios, reglas ni condiciones.

---

## 3. Stack recomendado para construcción

### 3.1. Stack base

Next.js con App Router; TypeScript; Supabase/PostgreSQL; Supabase Auth; Supabase Storage; Vercel para hosting; `PaymentProvider` abstracto; `ExchangeRateProvider` abstracto; `FiscalInvoiceProvider` abstracto; `NotificationProvider` abstracto (email + in-app); PDF/QR server-side.

### 3.2. Proveedores confirmados — ya no son provisionales

- **Pago fee EstuRed:** MercadoPago (ARS) + PayU Argentina (USD), ambos disponibles simultáneamente, más flujo manual validado por admin.
- **Tipo de cambio:** monedapi.ar — dólar blue, valor de venta, con override admin.
- **Facturación fiscal:** TusFacturas.app — Factura C, EstuRed opera como monotributista.
- **Notificaciones:** email (obligatorio como respaldo) + in-app. **WhatsApp no es un canal de este proveedor** — es exclusivamente un botón manual pre-formateado que la residencia acciona para abrir una conversación fuera de la plataforma; no hay integración de API de WhatsApp Business en el MVP.
- **Storage:** Supabase Storage.
- **PDF/QR:** librería server-side, decisión delegada a Claude Code (priorizar gratuita/económica).

### 3.3. Reglas de abstracción

No hardcodear proveedor de pagos, tipo de cambio ni facturación fiscal en la lógica de negocio. No hardcodear proveedor de notificaciones. No hacer que un webhook confirme reservas sin pasar por la lógica interna de EstuRed. No permitir que el frontend escriba directamente estados críticos. No integrar la API de WhatsApp Business bajo ninguna circunstancia en el MVP.

---

## 4. Fase 0 — Preparación del proyecto

### Objetivo

Crear la base técnica limpia del proyecto.

### Entregables

Repositorio inicial; Next.js + TypeScript configurado; estructura base de carpetas (ver `11_TECH_ARCHITECTURE.md` §6); linting/formato; variables de entorno (incluyendo credenciales de MercadoPago, PayU, monedapi.ar y TusFacturas.app); cliente Supabase; helpers de auth; layout base público, autenticado (`/students`, `/residence` con soporte multi-residencia) y admin; sistema inicial de componentes UI; toasts, modals, confirm dialogs, loading states.

### Criterios de aceptación

- El proyecto corre localmente.
- Variables de entorno separadas por ambiente.
- Conexión funcional con Supabase.
- Routing base para público, `/students`, `/residence` y `/admin`.
- No hay lógica de negocio hardcodeada en componentes visuales.

---

## 5. Fase 1 — Base de datos, Auth, roles y auditoría

### Objetivo

Crear el núcleo de identidad, roles, permisos, auditoría y seguridad.

### Entregables

#### 5.1. Tablas base

`users`; `user_roles`; `student_profiles`; `family_links`; `family_application_proposals`; `residences`; `residence_users`; `audit_logs`; `files`/`documents`; `consents`. (Los roles admin viven en `user_roles`, no en una tabla `admin_users`; las preferencias de notificación viven en `users.preferred_notification_channel` — ver `06_DATA_MODEL.md` §5.)

#### 5.2. Roles iniciales

`guest`; `registered_user`; `student` (con atributo `is_minor` para menores — no es rol separado); `linked_family`; `residence_owner`; `residence_staff`; `admin`; `superadmin`; `system`.

#### 5.3. Auth

Registro estudiante; registro familiar; registro residencia; login; logout; recuperación de acceso; protección de rutas; redirect por rol.

#### 5.4. Auditoría

Helper obligatorio: `createAuditLog(actor, actorRole, action, entityType, entityId, before, after, reason, source)`. Debe ser usado por toda server action crítica desde esta fase en adelante.

### Criterios de aceptación

- Un usuario puede registrarse según rol.
- Un estudiante menor no puede finalizar registro sin familiar vinculado.
- Un familiar puede solicitar vinculación; un estudiante puede aprobar o rechazar.
- Un owner accede solo a las residencias donde tiene `residence_users` activo.
- Un admin puede acceder a `/admin`.
- Acciones críticas crean audit log.

### Riesgo principal

Intentar construir pantallas sin RLS ni permisos. No hacerlo.

---

## 6. Fase 2 — Residencias, verificación y perfil público

### Objetivo

Construir la base de oferta: residencias verificadas, perfil completo, publicación controlada, y soporte desde el modelo de datos para que un owner gestione hasta 10 residencias.

### Entregables

#### 6.1. Entidades

Campos extendidos de `residences` (incluyendo `has_operational_management_access` y `pioneer_free_access_until` para freemium, aunque la UI de Gestión Operativa se construya recién en Fase 7); `residence_verifications`; `residence_profile_edits`; `residence_faq_predefined_questions`; `residence_faq_items`; `tariff_change_logs`.

#### 6.2. Registro y onboarding residencia

Pantallas: `/register/residence`; `/residence/[residence_id]/profile`; `/residence/[residence_id]/verification`; `/residence/[residence_id]/profile/preview`; `/residence/settings` (gestión de residencias del owner); `/residence/settings/new` (alta de residencia adicional, hasta 10).

#### 6.3. Verificación

Estados: `draft`; `pending_verification`; `verification_scheduled`; `verified_active`; `needs_changes`; `paused_by_admin`; `suspended`; `verification_expired`.

Reglas: residencia no verificada no publica; visita presencial obligatoria; verificación anual; checklist firmado por ambas partes; admin puede aprobar, rechazar o pedir cambios.

#### 6.4. Tarifas

La residencia puede editar tarifa mensual, moneda, matrícula, depósito, política de ajustes, método de reserva. No requiere aprobación previa, pero: queda auditado; genera alerta admin si sube o baja más de 15% en una edición; guarda historial.

**Recomendación de UX (no bloqueante):** sugerir a la residencia configurar tarifas en USD, con aclaración de que el sistema las convierte a ARS al dólar blue del día.

#### 6.5. Redondeo

Tarifas USD terminan en 0 o 5; tarifas ARS terminan en 500 o 000; fee EstuRed se redondea a múltiplos de 500 ARS.

### Criterios de aceptación

- Una residencia puede cargar perfil completo.
- Admin puede verificar residencia.
- Solo residencias verificadas aparecen en búsqueda.
- Cambios críticos quedan auditados; cambios de tarifas mayores a ±15% generan alerta.
- La vista pública muestra USD y ARS con el modal de tipo de cambio referencial.
- Se muestra el alcance del sello "Residencia Verificada".
- Un owner puede tener más de una residencia asociada en el modelo de datos, aunque el dashboard multi-residencia se construya en Fase 9bis.

---

## 7. Fase 3 — Tipo de cambio, tarifas, búsqueda y detalle público

### Objetivo

Permitir que estudiantes encuentren residencias verificadas con tarifas en USD/ARS y datos confiables.

### Entregables

#### 7.1. Tipo de cambio

`exchange_rates`; job diario de actualización desde **monedapi.ar (dólar blue, valor venta)**; override admin con motivo obligatorio; snapshot por solicitud.

Campo interno: `official_exchange_rate_ars_per_usd`, `source_name = monedapi.ar`, `rate_type = blue_sell`.

#### 7.2. Búsqueda

Pantalla: `/search`. Funciones: listado de residencias verificadas; filtros básicos; precio USD/ARS; zona; tipo de habitación; disponibilidad; estado completa; CTA ver residencia.

#### 7.3. Detalle público

Pantalla: `/r/[slug]`. Debe mostrar: fotos; nombre; zona; sello verificada; tarifas USD/ARS con modal de tipo de cambio referencial obligatorio; matrícula; depósito; política de ajustes; condiciones de reserva; servicios; reglas; habitaciones/plazas; disponibilidad; comunidad visible según permisos; **FAQ de la residencia (preguntas predefinidas + respuestas + pregunta libre)**; CTA solicitud; CTA lista de espera si corresponde.

### Criterios de aceptación

- Invitados exploran con acceso limitado; registrados ven información ampliada según privacidad.
- Nunca se muestran apellido completo, mail, teléfono, fecha de nacimiento, universidad o documentos.
- Las tarifas muestran ambas monedas con el aviso referencial obligatorio.
- Disponibilidad usa el texto correcto: **"Disponibilidad informada por la residencia. Requiere confirmación al solicitar."** (Perfil Verificado) o **"Disponibilidad asegurada."** (Gestión Operativa).
- El FAQ responde solo con información cargada por la residencia.

---

## 8. Fase 4 — Estudiante, familiar, perfil, documentos y privacidad

### Objetivo

Permitir que el estudiante complete su perfil, configure visibilidad, vincule familiar y prepare solicitudes.

### Entregables

#### 8.1. Registro estudiante

Campos obligatorios: nombre; apellido; nacionalidad; fecha de nacimiento; dónde va a estudiar; email; teléfono; método de acceso.

Nunca públicos: apellido completo; mail; teléfono; fecha de nacimiento; universidad; documentos.

#### 8.2. Onboarding estudiante

Objetivo académico declarado (obligatorio para comprobante); carrera; ciudad de origen; hábitos; intereses; foto/avatar; configuración de visibilidad; documentos opcionales; preferencia de proveedor de pago (MercadoPago/PayU) para el fee.

#### 8.3. Familiar vinculado

Reglas: un estudiante puede tener un familiar vinculado activo; un familiar puede vincular varios estudiantes; menores requieren familiar vinculado; el familiar puede pagar fee, cargar documentos, subir comprobantes, sugerir favoritos, acceder al comprobante y **crear propuestas de solicitud** (ver Fase 5bis); el familiar no decide por el estudiante ni envía solicitudes directamente a la residencia.

#### 8.4. Documentos

La residencia solo accede a documentos autorizados dentro de un contexto: solicitud, reserva, residente o renovación. Admin accede con justificación registrada obligatoria.

### Criterios de aceptación

- Estudiante puede configurar privacidad sin fricción excesiva.
- Familiar puede vincularse y operar según permisos.
- Documentos sensibles no se exponen globalmente.

---

## 9. Fase 5 — Habitaciones, plazas, disponibilidad, lista de espera y comunidad visible

### Objetivo

Construir la capa operativa mínima de oferta y disponibilidad. **Esta fase construye el modelo de datos y la lógica; el acceso real a Gestión Operativa vía feature flag freemium se activa en Fase 9bis.**

### Entregables

#### 9.1. Habitaciones y plazas

Tablas: `room_types`; `rooms`; `places`; disponibilidad asociada.

Estados por plaza: `available`; `in_contact`; `temporarily_held`; `reserved`; `occupied`; `blocked`; `maintenance`; `unavailable`.

#### 9.2. Modo Perfil Verificado

Disponibilidad por tipo de habitación/plaza. Estados: `available_to_confirm`; `full`; `not_updated`; `paused_by_residence`; `paused_by_admin`.

Regla nueva: si `not_updated` persiste más de 15 días adicionales tras el aviso de 30 días sin actualizar, la residencia deja de aparecer en búsquedas activas.

#### 9.3. Modo Gestión Operativa

Funciones: habitaciones; plazas/camas; estado por plaza; residentes; disponibilidad real; solicitudes por plaza; reservas; renovaciones; comunidad visible. **Requiere `has_operational_management_access = true` — el bloqueo debe ser server-side, no solo de UI, aunque el flujo de activación admin se construya en Fase 9bis.**

#### 9.4. Lista de espera

No cuenta como solicitud activa; solo estudiantes no alojados en EstuRed permanecen en lista; si reserva en otra residencia, sale automáticamente de otras listas; a los 90 días recibe notificación; no vence automáticamente por tiempo; residencia puede eliminar estudiantes manualmente; cuando aparece disponibilidad, se notifica sin activar solicitud automáticamente.

#### 9.5. Comunidad visible

Perfiles individuales y agregados; usuarios registrados y compañeros ven lo mismo según permisos; invitados ven información limitada; residentes no activados aparecen como "Residente pendiente de activar cuenta" o "Plaza ocupada"; residencia puede invitar, no forzar visibilidad.

### Criterios de aceptación

- Residencia puede configurar disponibilidad por tipo.
- Gestión Operativa permite configurar plazas y residentes **solo si el feature flag está activo**.
- La búsqueda respeta estados de disponibilidad, incluyendo el ocultamiento a los 15 días de `not_updated`.
- Lista de espera funciona sin contaminar estadísticas de solicitudes.
- Comunidad visible respeta privacidad.

---

## 10. Fase 5bis — Propuestas de solicitud del familiar

### Objetivo

Construir el flujo por el cual un familiar vinculado puede sugerir una residencia al estudiante, sin poder enviar la solicitud directamente.

**Esta fase es nueva respecto a versiones anteriores del plan y no debe omitirse: es parte del loop central acordado.**

### Entregables

#### 10bis.1. Entidad

`family_application_proposals`, con campos `family_link_id`, `family_member_id`, `student_profile_id`, `residence_id`, `room_type_id`, `desired_start_date`, `initial_duration_months`, `status`, `expires_at` (48h) y `converted_to_application_id`. Los campos `initiated_by` y `contact_target` NO viven acá: se setean en la `application_request` generada al aprobar (ver `06 §11.1`).

#### 10bis.2. Estados

`draft`; `pending_student_approval`; `approved_by_student`; `rejected_by_student`; `expired`.

#### 10bis.3. Pantallas

`/students/family-proposals` (estudiante aprueba/rechaza); pantalla de creación desde el flujo de búsqueda del familiar (modal, ver `08_UI_SCREENS_AND_FLOWS.md` §9.2).

#### 10bis.4. Reglas

El familiar propone; el estudiante aprueba o rechaza (no puede modificar); al aprobar se crea una `application_request` con `initiated_by = family_member` y `contact_target = family_member`; las propuestas pendientes no cuentan en el límite de 2 solicitudes activas; job de expiración a las 48h.

### Criterios de aceptación

- Familiar crea propuesta → estudiante recibe notificación → aprueba o rechaza.
- Propuesta aprobada se convierte en solicitud real con el contacto dirigido correctamente.
- Propuesta rechazada o vencida no genera solicitud ni cuenta en el límite.

---

## 11. Fase 6 — Solicitudes de reserva

### Objetivo

Construir el núcleo transaccional del producto: la solicitud, incluyendo el flujo de negociación de condiciones.

### Entregables

#### 11.1. Solicitud

Tablas: `application_requests`; `application_snapshots` (con `snapshot_type`: `original`/`final`); `application_negotiation_proposals`; `application_status_events`.

Estados: `draft`; `submitted`; `queued_for_place`; `under_review`; `contact_established`; **`offer_pending_student_acceptance`**; **`conditions_accepted`**; `paused_due_to_other_active_request`; `residence_payment_pending`; `residence_payment_reported`; `converted_to_reservation`; `rejected`; `expired_no_residence_response`; `expired_no_student_payment`; **`expired_offer_no_response`**; `cancelled_by_student`; `cancelled_by_residence`; `closed_due_to_other_confirmed_reservation`; `disputed`.

#### 11.2. Reglas principales

- Máximo 2 solicitudes activas por estudiante (propuestas del familiar pendientes no cuentan).
- Si una avanza, la otra queda pausada, no anulada.
- Si una reserva se confirma, las demás se cierran.
- Una plaza puede tener 3 solicitudes visibles y 2 en cola.
- Residencia puede avanzar con una solicitud por plaza a la vez.
- **La solicitud vence a las 48 horas de enviada** (no 72h). Al vencer: mostrar detalle + botón "Actualizar con mismos parámetros".
- Después de `contact_established`, 48h para pago a residencia.
- Rechazo requiere motivo interno (enum predefinido).
- Rechazo constante por falta de disponibilidad penaliza visibilidad.

#### 11.3. Flujo de negociación de condiciones — nuevo

- Solo la residencia puede enviar una propuesta de ajuste, **máximo 1 por solicitud** (constraint `unique` en `application_negotiation_proposals.application_request_id`).
- Todo es modificable excepto los datos del estudiante.
- Al enviarla: `status = offer_pending_student_acceptance`; se reinicia el plazo de 48h.
- El estudiante ve comparación original vs. propuesta y responde: `accepted` (crea `snapshot_final`, recalcula fee), `rejected_chose_original` (`snapshot_final = snapshot_original`), o `rejected_closed` (cancela la solicitud).
- Al aceptarse la propuesta, el plazo de 48h para el pago a la residencia se reinicia nuevamente desde la aceptación.
- El `snapshot_final` hereda el tipo de cambio del snapshot original — la negociación nunca actualiza la cotización.
- Job de expiración a las 48h sin respuesta → `expired_offer_no_response`.

#### 11.4. Snapshot de solicitud

Guardar en `snapshot_original`: precio USD; precio ARS; tipo de cambio (monedapi.ar); tipo de habitación/plaza; fecha de ingreso; duración inicial; matrícula; depósito; monto de reserva requerido; política de ajustes; reglas principales; condiciones de cancelación; fee estimado.

Si hay negociación aceptada, generar `snapshot_final` con los valores acordados. **El fee siempre se calcula sobre `snapshot_final`.**

### Criterios de aceptación

- Estudiante no puede tener más de 2 solicitudes activas.
- Solicitud guarda snapshot inmutable; snapshot final solo existe si hubo negociación aceptada.
- Residencia puede establecer contacto y, opcionalmente, enviar una única propuesta de ajuste.
- Estudiante puede aceptar, rechazar-y-continuar o rechazar-y-cerrar una propuesta.
- Otra solicitud queda pausada, no anulada.
- Residencia puede rechazar con motivo.
- Vencimiento a 48h funciona con botón de actualización de parámetros.
- Notificaciones se disparan correctamente en cada transición.

---

## 12. Fase 7 — Pago a residencia, fee EstuRed, factura fiscal, reserva y comprobante

### Objetivo

Convertir una solicitud avanzada en reserva confirmada, con fee cobrado, factura emitida y comprobante generado.

### Entregables

#### 12.1. Pago a residencia

EstuRed no procesa este pago directamente. Estados: `not_required_yet`; `pending`; `student_reference_uploaded`; `reported_received_by_residence`; `expired`; `disputed`.

Regla: el comprobante cargado por estudiante no confirma la reserva. La residencia debe marcar "Pago recibido" con **confirmación explícita y aceptación de términos registrada en `consents`**.

#### 12.2. Fee EstuRed

Estados: `not_required_yet`; `pending_payment_method`; `pending_manual_payment`; `pending_auto_charge`; `processing`; `paid`; `failed`; `expired`; `refunded`; `chargeback`.

Reglas:

- fee = 5% del total de la estadía inicial reservada, calculado **sobre `snapshot_final`**;
- incluye matrícula/cargo obligatorio no reembolsable; excluye depósito reembolsable;
- no considera ajustes futuros;
- **puede cobrarse en ARS (MercadoPago) o USD (PayU Argentina)**, elección del pagador;
- se redondea a múltiplos de 500 ARS;
- si falla, hasta 3 intentos en 48h;
- `idempotency_key` obligatorio para evitar cobros duplicados;
- no hay reserva confirmada sin fee pagado.

#### 12.3. Factura fiscal — nuevo

Al confirmarse el pago del fee (automático o manual), se dispara automáticamente la emisión de **Factura C vía TusFacturas.app**, a nombre de quien paga. Si falla, queda en `issue_failed` y se reintenta por job — **no bloquea la confirmación de la reserva**, que ya ocurrió con el fee pagado.

#### 12.4. Reserva

Estados: `pending_estured_fee`; `estured_fee_processing`; `estured_fee_failed`; `expired_fee_unpaid`; `confirmed`; `receipt_pending`; `receipt_issued`; `cancelled_by_student`; `cancelled_by_residence`; `no_show`; `completed`; `disputed`.

#### 12.5. Comprobante

Nombre: **Comprobante de Reserva Confirmada**.

Estados: `not_available`; `pending_generation`; `issued`; `generation_failed`; `voided`; `reissued`.

Debe incluir: ID; `verification_code` y QR apuntando a `/verify/[verification_code]`; fecha de emisión; estudiante; familiar pagador si aplica; residencia; tipo de habitación/plaza; fecha de ingreso; duración inicial; objetivo académico declarado; **condiciones finales (`snapshot_final`)**; monto abonado a residencia informado por residencia; fee EstuRed y moneda; **referencia a la factura fiscal**; política de ajustes; disclaimer; soporte.

#### 12.6. Revocación del fee (botón de arrepentimiento) — nuevo

Entregables: enlace visible en el footer de toda la plataforma; pantalla `/students/revocation` (ver `08` §6.9bis); endpoint `POST /reservations/{id}/revoke-fee` (ver `07` §18.6); efectos (reserva `cancelled_by_student` con `student_revocation_right`, comprobante `voided`, fee permanece `paid`, `support_case` de revisión abierto); vista admin de revocaciones pendientes.

### Criterios de aceptación

- Pago a residencia registrado no confirma automáticamente.
- Residencia marca Pago recibido con aceptación explícita auditada.
- Fee se calcula sobre `snapshot_final`, correctamente en ARS o USD (el `snapshot_final` hereda la cotización del original).
- Reserva no se confirma sin fee `paid`.
- Fee vencido sin pago → reserva `expired_fee_unpaid` (nunca `cancelled_by_student`).
- Factura fiscal se emite automáticamente tras el pago, sin bloquear la reserva si falla.
- Comprobante no se emite sin reserva `confirmed`.
- `/verify/[verification_code]` funciona y no expone datos sensibles.
- `confirmed` y `receipt_issued` están separados; fallo de PDF/QR alerta admin.
- La revocación funciona de punta a punta dentro de los 10 días y se bloquea fuera de plazo.
- Chargeback genera alerta admin sin modificar reserva ni comprobante automáticamente.

---

## 13. Fase 8 — Renovaciones

### Objetivo

Construir renovaciones como módulo Must Have del MVP.

### Entregables

#### 13.1. Renovaciones — dos entidades separadas

`renewal_requests` (solicitud informal del estudiante, no vinculante): `created_by_student`; `notified_to_residence`; `offer_received`; `closed_no_offer`; `superseded_by_offer`.

`renewal_offers` (oferta formal de la residencia): `draft`; `sent`; `viewed`; `accepted_by_student`; `rejected_by_student`; `expired`; `residence_payment_pending`; `residence_payment_reported`; `estured_fee_pending`; `estured_fee_processing`; `confirmed`; `receipt_pending`; `receipt_issued`; `cancelled_by_residence`; `cancelled_by_student`; `disputed`.

**Nota:** versiones anteriores de este plan mezclaban ambos conceptos en una sola lista de estados. Se separan según `04_STATE_MACHINES.md` para evitar ambigüedad de implementación.

#### 13.2. Reglas

La residencia emite oferta formal; el estudiante puede solicitar renovación pero no crea oferta vinculante; la oferta incluye período, precio, moneda, política de ajustes, monto a pagar a residencia si aplica y fecha límite; **fee de renovación = idéntico al fee de reserva inicial, sin excepciones** (5% sobre tarifa actual × período renovado + cargo no reembolsable si aplica, excluyendo depósito); se emite Comprobante de Renovación Confirmada con su propio `verification_code`; factura fiscal se emite igual que en la reserva inicial.

### Criterios de aceptación

- Residencia puede crear oferta; estudiante puede solicitar renovación y aceptar/rechazar oferta.
- Residencia marca pago recibido; EstuRed cobra fee de renovación (misma lógica exacta que reserva inicial).
- Comprobante y factura se emiten solo si el fee está `paid`.

---

## 14. Fase 9 — Dashboard residencia (single-residence)

### Objetivo

Permitir que la residencia opere EstuRed desde un solo lugar sin convertirlo en PMS pesado. **Esta fase construye el dashboard de una residencia individual; el soporte multi-residencia (scroll vertical, filtro) se agrega en Fase 9bis.**

### Entregables

Rutas: `/residence/[residence_id]/profile`; `/profile/preview`; `/verification`; `/rooms`; `/availability`; `/applications`; `/applications/[id]`; `/applications/[id]/negotiation`; `/reservations`; `/waitlist`; `/residents`; `/renewals`; `/renewals/[id]`; `/receipts`; `/faq`; `/metrics`; `/plan`.

### Criterios de aceptación

- Owner puede gestionar una residencia completa; staff opera según permisos.
- Dashboard muestra solicitudes (incluyendo en negociación), pagos, reservas, lista de espera, renovaciones.
- Métricas básicas y alertas visibles.
- No se exponen documentos fuera de contexto.

---

## 15. Fase 9bis — Multi-residencia y freemium

### Objetivo

Habilitar que un owner gestione hasta 10 residencias desde un mismo login, y activar el mecanismo de acceso freemium a Gestión Operativa.

**Esta fase es nueva respecto a versiones anteriores del plan.**

### Entregables

#### 15.1. Dashboard multi-residencia

`/residence/dashboard` — bloques individuales de cada residencia en **scroll vertical**, con filtro/selector superior. **Nunca una vista agregada con métricas consolidadas.** Si el owner tiene una sola residencia, el filtro no se muestra.

#### 15.2. Alta y gestión de residencias

`/residence/settings` (listado de residencias del owner, hasta 10, gestión de staff con acceso a una o varias); `/residence/settings/new` (alta de residencia adicional).

#### 15.3. Freemium

`/residence/[residence_id]/plan` (vista de la residencia); `/admin/residences/[id]/plan` (gestión admin del feature flag `has_operational_management_access`, con motivo obligatorio y fecha límite opcional para pioneras).

**La asignación de acceso freemium es una decisión operativa del equipo de EstuRed, no una decisión técnica — Claude Code construye el mecanismo, no decide a quién otorgarlo.**

### Criterios de aceptación

- Owner con 2+ residencias ve todos los dashboards en scroll, sin datos cruzados entre ellas.
- Staff con acceso a una sola residencia no ve las demás del mismo owner.
- Admin puede otorgar/revocar acceso a Gestión Operativa, auditado.
- Intentar usar Gestión Operativa sin el flag activo falla server-side, no solo se oculta en UI.

---

## 16. Fase 10 — Dashboard estudiante/familiar completo

### Objetivo

Permitir que estudiante y familiar gestionen búsqueda, propuestas, solicitudes, negociación, pagos, comprobantes, documentos, lista de espera y renovaciones.

### Entregables

Rutas: `/students/dashboard`; `/students/favorites`; `/students/family-proposals`; `/students/applications`; `/students/applications/[id]`; `/students/applications/[id]/negotiation`; `/students/applications/[id]/fee`; `/students/receipts/[id]`; `/students/waitlist`; `/students/renewals`; `/students/renewals/[id]`; `/students/profile`; `/students/documents`; `/students/family-link`.

### Criterios de aceptación

- Estudiante ve próximos pasos claros, incluyendo propuestas del familiar y propuestas de ajuste pendientes.
- Familiar opera con permisos limitados, incluyendo creación de propuestas.
- No hay acciones críticas sin aceptación explícita.
- Pago de fee muestra base de cálculo (sobre `snapshot_final`), selector MercadoPago/PayU y disclaimers.
- Comprobante se puede descargar y compartir vía `/verify/[codigo]`.

---

## 17. Fase 11 — Admin Panel completo

### Objetivo

Dar al equipo EstuRed control operativo del sistema.

### Entregables

Rutas: `/admin/dashboard`; `/admin/residences`; `/admin/residences/[id]/plan`; `/admin/verifications`; `/admin/profile-edits`; `/admin/pricing`; `/admin/applications`; **`/admin/family-proposals`**; **`/admin/negotiations`**; `/admin/reservations`; `/admin/payments`; **`/admin/invoices`**; `/admin/receipts`; `/admin/users`; `/admin/documents`; `/admin/waitlists`; `/admin/renewals`; `/admin/community`; `/admin/support-cases`; `/admin/visibility`; `/admin/notifications`; `/admin/exchange-rate`; `/admin/audit-log`; `/admin/settings`.

### Criterios de aceptación

- Admin puede operar verificaciones; revisar tarifas y alertas ±15%.
- Admin puede intervenir solicitudes trabadas, **incluyendo negociaciones vencidas y propuestas del familiar en disputa**.
- Admin puede validar pagos manuales; **reintentar o reemitir facturas fiscales fallidas**.
- Admin puede emitir, reemitir o anular comprobantes.
- Admin puede gestionar casos de soporte; penalizar o suspender residencias.
- Admin puede **otorgar/revocar acceso freemium a Gestión Operativa**.
- Toda acción admin queda auditada con motivo.

---

## 18. Fase 12 — Notificaciones, jobs y automatizaciones

### Objetivo

Hacer que los plazos y recordatorios funcionen sin depender de operación manual constante.

### Jobs necesarios — actualizado

**Solución confirmada: Supabase pg_cron** (granularidad horaria aceptada para vencimientos de 48h).

Actualizar tipo de cambio diario (monedapi.ar); **vencer propuestas del familiar sin respuesta en 48h**; **vencer propuestas de ajuste sin respuesta en 48h**; detectar solicitudes sin respuesta; enviar recordatorios diarios a residencias; **vencer solicitudes a las 48h** (no 72h); reintentar cobro fee hasta 3 veces en 48h; **vencer fees impagos (fee → `expired`, reserva → `expired_fee_unpaid`)**; **reintentar emisión de facturas fiscales fallidas**; detectar disponibilidad no actualizada en 30 días y ocultar tras 15 días adicionales; enviar confirmación de lista de espera a los 90 días; sacar de listas de espera a estudiantes con reserva confirmada en otra residencia; detectar verificación anual vencida; generar alertas de tarifas ±15%; recalcular métricas internas de visibilidad; alertar comprobantes fallidos.

### Notificaciones MVP — actualizado

Propuesta del familiar creada/aprobada/rechazada/vencida; solicitud enviada/recibida; recordatorio de solicitud pendiente; contacto establecido; **propuesta de ajuste enviada/respondida/vencida**; pago a residencia pendiente; plazo por vencer; pago recibido informado; fee pendiente/fallido/pagado; **factura fiscal emitida/fallida**; reserva confirmada; comprobante emitido; lista de espera con disponibilidad; renovación enviada/aceptada; caso de soporte abierto; verificación pendiente; disponibilidad vencida.

### Criterios de aceptación

- Los plazos críticos se ejecutan automáticamente, incluyendo los nuevos de propuesta del familiar y negociación.
- Las notificaciones se registran en base de datos.
- El usuario tiene al menos un canal obligatorio (email como respaldo).
- **WhatsApp no es un canal automático — no debe implementarse como tal.**

---

## 19. Fase 13 — Métricas, penalizaciones y visibilidad interna

Sin cambios de fondo respecto a la versión anterior. Métricas aprobadas: respuesta y velocidad 25%; disponibilidad actualizada 20%; conversión a reserva 20%; perfil completo/verificado 15%; baja tasa de reclamos validados 10%; uso operativo 10%.

**Agregar como métrica adicional a vigilar (no pondera en el score, solo se observa):** tasa de propuestas de ajuste vencidas sin respuesta por residencia.

Estados de visibilidad: `normal_visibility`; `warning`; `reduced_visibility`; `temporarily_paused`; `suspended`; `removed_from_network`.

### Criterios de aceptación

Sin cambios: métricas internas, sin ranking público, admin puede ver detalle y aplicar penalizaciones manuales.

---

## 20. Fase 14 — Soporte y resolución de conflictos

*(Renombrado desde "Mediaciones, reclamos y soporte" para evitar el término "mediación" en comunicación pública, por sus implicancias legales bajo la Ley 26.589 argentina.)*

### Objetivo

Permitir registrar conflictos y casos operativos sin asumir garantía total por parte de EstuRed.

### Entregables

Formulario de contacto/reclamo por perfil; recordatorio de términos y alcance; subida de evidencia (fotos, videos, capturas, audios — incluyendo capturas de WhatsApp ya que EstuRed no tiene acceso a esa conversación); panel admin en `/admin/support-cases`; estados de caso; acciones admin.

### Estados

`opened`; `terms_reminder_shown`; `submitted`; `under_review`; `needs_more_info`; `waiting_other_party`; `in_progress`; `resolved_by_agreement`; `closed_no_action`; `closed_unresolved`; `admin_action_taken`.

### Criterios de aceptación

Abrir un caso no suspende automáticamente solicitud, reserva o renovación; admin puede suspender manualmente; todo queda auditado; el alcance de EstuRed queda claro antes de enviar el reclamo.

---

## 21. Fase 15 — QA funcional, legal-operativo y seguridad

### Objetivo

Validar que el MVP no rompa reglas críticas antes de beta.

### QA obligatorio — actualizado

#### 21.1. Propuestas del familiar y negociación (nuevo)

- familiar crea propuesta → estudiante aprueba → solicitud con `initiated_by`/`contact_target` correctos;
- familiar crea propuesta → estudiante rechaza → sin solicitud creada;
- propuesta del familiar vence a las 48h;
- residencia envía propuesta de ajuste → estudiante ve comparación;
- residencia intenta enviar segunda propuesta → bloqueado;
- estudiante acepta propuesta → fee recalculado sobre `snapshot_final`;
- estudiante rechaza y continúa con condiciones originales;
- propuesta de ajuste vence sin respuesta → estado correcto.

#### 21.2. Solicitudes

Estudiante no tiene más de 2 activas; segunda solicitud pausada, no anulada; solicitud guarda snapshot; **solicitud vence a las 48h** (no 72h); rechazo exige motivo; cola por plaza funciona.

#### 21.3. Pagos, fee y facturación

Residencia marca Pago recibido con consentimiento auditado; fee se calcula sobre `snapshot_final` (que hereda la cotización del snapshot original); matrícula entra en base; depósito reembolsable excluido; ajustes futuros no recalculan fee; fee fallido reintenta 3 veces; fee vencido sin pago → reserva `expired_fee_unpaid`; **fee puede pagarse en ARS (MercadoPago) o USD (PayU)**; cobro es idempotente; reserva no se confirma sin fee `paid`; **factura fiscal se emite automáticamente tras el pago y no bloquea la reserva si falla**; comprobante no se emite sin `confirmed`; **revocación dentro de los 10 días funciona (reserva cancelada, comprobante anulado, fee `paid` en revisión) y se bloquea fuera de plazo**; chargeback genera alerta admin sin cambios automáticos; estudiante menor → contacto dirigido al familiar vinculado.

#### 21.4. Renovaciones

Estudiante puede solicitar renovación; residencia puede crear oferta; fee de renovación idéntico al de reserva inicial; comprobante de renovación se emite correctamente.

#### 21.5. Multi-residencia y freemium (nuevo)

Owner con 2+ residencias no ve datos cruzados; staff limitado a residencias asignadas; Gestión Operativa bloqueada server-side sin feature flag; admin puede otorgar/revocar acceso con auditoría.

#### 21.6. Privacidad

Invitados no ven datos restringidos; registrados ven según permisos; documentos no se exponen fuera de contexto; menores requieren familiar; residencia no puede forzar visibilidad de residente; **contenido de propuesta del familiar no visible para la residencia antes de aprobación**.

#### 21.7. Admin

Todas las acciones críticas generan audit log; admin puede intervenir operaciones trabadas (incluyendo negociaciones y propuestas del familiar); alertas de tarifas funcionan; soporte funciona; penalizaciones funcionan; **gestión de facturas fiscales fallidas funciona**.

#### 21.8. Seguridad

RLS impide acceso cross-tenant (incluyendo entre residencias del mismo owner sin asignación explícita); staff no accede fuera de permisos; cliente no puede cambiar estados críticos; documentos privados requieren permisos; service role no se usa desde cliente.

### Criterios de aceptación

Todos los flujos críticos pasan QA; no hay pantallas blancas en rutas principales; errores muestran mensajes claros; acciones críticas tienen confirmación; auditoría registra antes/después.

---

## 22. Fase 16 — Beta controlada

### Objetivo

Lanzar con pocas residencias y operación cercana para validar negocio real.

### Alcance beta

5 a 10 residencias verificadas en CABA; estudiantes del interior y exterior; residencias pioneras con acceso gratuito a Gestión Operativa durante el primer año; operación acompañada por EstuRed; admin monitoreando cada solicitud y reserva.

### Métricas de beta — actualizado

Visitas a landing; búsquedas; fichas vistas; registros; **propuestas del familiar creadas/aprobadas/rechazadas**; solicitudes enviadas; **negociaciones iniciadas/aceptadas/rechazadas**; contactos establecidos; pagos a residencia informados; fees pagados (por proveedor y moneda); **facturas fiscales emitidas**; comprobantes emitidos; reservas confirmadas; solicitudes vencidas; rechazos por falta de disponibilidad; consultas repetidas evitadas (FAQ); reclamos; objeciones al fee; residencias que actualizan disponibilidad; residencias usando Gestión Operativa.

### Criterios de éxito beta

Al menos 5 residencias verificadas publicadas; estudiantes reales enviando solicitudes; residencias respondiendo desde dashboard; primeras reservas confirmadas; cobro de fee validado en ambos proveedores; facturas fiscales emitidas correctamente; comprobantes usados y entendidos; objeciones al fee medibles; panel admin suficiente para operar sin tocar base de datos.

---

## 23. Dependencias críticas

### No construir antes de tener

Roles y permisos antes de dashboards; estado de solicitudes antes de UI de solicitudes; fee rules antes de checkout; snapshot antes de solicitudes reales; **flujo de propuesta del familiar antes de exponer el botón "sugerir residencia" al familiar**; **flujo de negociación antes de exponer el botón "proponer ajuste" a la residencia**; admin panel antes de beta real; auditoría antes de acciones críticas; storage permissions antes de documentos; verificación antes de publicación de residencias; **feature flag freemium antes de exponer rutas de Gestión Operativa**.

### Dependencias por módulo — actualizado

| Módulo | Depende de |
|---|---|
| Búsqueda | Residencias verificadas, tarifas, disponibilidad |
| Propuesta del familiar | Familiar vinculado activo, estudiante con perfil mínimo |
| Solicitudes | Usuario estudiante, residencia publicada, snapshot |
| Negociación de condiciones | Solicitud en `contact_established` |
| Pago a residencia | Solicitud en contacto o condiciones aceptadas |
| Fee EstuRed | Pago recibido informado por residencia |
| Factura fiscal | Fee EstuRed pagado |
| Reserva | Fee EstuRed pagado |
| Comprobante | Reserva confirmada |
| Renovación | Reserva/residente activo |
| Lista de espera | Residencia publicada, tipo de habitación/plaza |
| Comunidad visible | Habitaciones, residentes, consentimientos |
| Gestión Operativa | Feature flag freemium activo |
| Multi-residencia | `residence_users` con múltiples asociaciones |
| Penalizaciones | Métricas, solicitudes, reservas, reclamos |
| Admin | Todas las entidades críticas |

---

## 24. Priorización práctica por sprints sugeridos

### Sprint 0 — Setup técnico

Repo; Next.js; Supabase; auth base; layouts; componentes base.

### Sprint 1 — Roles, usuarios, estudiantes y familiares

Registro/login; perfil estudiante; familiar vinculado; documentos base; privacidad.

### Sprint 2 — Residencias y verificación

Registro residencia; perfil; verificación admin; publicación; tarifas; tipo de cambio (monedapi.ar).

### Sprint 3 — Búsqueda y detalle público

Landing; búsqueda; detalle residencia; FAQ; comunidad básica; lista de espera base.

### Sprint 4 — Propuestas del familiar y solicitudes

Propuesta de solicitud del familiar; aprobación/rechazo del estudiante; crear solicitud; snapshot; dashboard residencia solicitudes; pausa de segunda solicitud; cola por plaza; rechazos.

### Sprint 5 — Negociación de condiciones

Propuesta de ajuste de la residencia (máx. 1); vista comparativa; aceptación/rechazo del estudiante; recalculo de fee sobre `snapshot_final`.

### Sprint 6 — Pago, fee, facturación y reserva

Pago a residencia registrado; fee EstuRed (MercadoPago + PayU); pago manual; facturación fiscal (TusFacturas.app); reserva confirmada; comprobante PDF/QR con `verification_code`.

### Sprint 7 — Gestión Operativa y freemium

Habitaciones; plazas; disponibilidad real; residentes; comunidad visible; feature flag freemium y su gestión admin.

### Sprint 8 — Multi-residencia

Dashboard `/residence/dashboard` en scroll vertical; alta de residencia adicional; asignación de staff a múltiples residencias.

### Sprint 9 — Renovaciones

Solicitar renovación; oferta de renovación; pago a residencia; fee renovación; comprobante renovación.

### Sprint 10 — Admin completo

Solicitudes; propuestas del familiar; negociaciones; reservas; pagos; facturas; comprobantes; tarifas; verificaciones; usuarios; soporte; penalizaciones; auditoría.

### Sprint 11 — Notificaciones, jobs y métricas

Jobs de vencimiento (incluyendo propuestas del familiar y negociación); recordatorios; tipo de cambio; lista de espera 90 días; métricas internas; penalizaciones.

### Sprint 12 — QA, hardening y beta

QA funcional; QA permisos; QA pagos y facturación; QA admin; QA responsive; preparación beta.

---

## 25. Lo que Claude Code no debe construir todavía

Señales de Convivencia; reviews funcionales; evaluaciones estudiante-residencia; evaluaciones residencia-estudiante; evaluaciones entre estudiantes; ranking público; badges públicos complejos; IA avanzada; bot libre no controlado; tickets de mantenimiento; inventario; check-in/check-out avanzado; firma digital; escrow; app móvil nativa; marketplace de servicios; analítica avanzada pública; dashboard agregado multi-residencia con métricas consolidadas.

---

## 26. Riesgos de construcción

### Riesgo 1 — Scope creep

Renovaciones, Gestión Operativa, multi-residencia, freemium, negociación de condiciones y Admin ya hacen que el MVP sea grande. Evitar sumar IA, señales, tickets o app nativa.

### Riesgo 2 — Estados mal modelados

Si propuesta del familiar, solicitud, negociación, reserva, pago y comprobante se mezclan, el sistema será difícil de mantener.

### Riesgo 3 — Falta de admin

Sin admin, cada caso borde exigirá intervención en base de datos.

### Riesgo 4 — Privacidad débil

Comunidad visible, documentos y propuestas del familiar antes de aprobación requieren permisos estrictos.

### Riesgo 5 — Dos proveedores de pago simultáneos

MercadoPago y PayU deben abstraerse correctamente; probar ambos flujos de webhook e idempotencia por separado.

### Riesgo 6 — Tipo de cambio

monedapi.ar puede fallar. Guardar snapshot y permitir override admin.

### Riesgo 7 — Fee alto

5% sobre estadía inicial puede generar objeciones. Medir durante beta antes de cambiar.

### Riesgo 8 — Facturación fiscal (nuevo)

TusFacturas.app puede fallar o el monotributo puede acercarse a su límite de facturación anual con volumen. No bloqueante para el MVP, pero monitorear desde el primer mes de beta.

### Riesgo 9 — Complejidad del flujo de negociación (nuevo)

Es un mecanismo nuevo sin datos de uso real. Vigilar en beta si el límite de 1 propuesta y el plazo de 48h son suficientes o generan fricción.

---

## 27. Criterio de MVP terminado

El MVP puede considerarse terminado cuando permita:

1. Publicar residencias verificadas en CABA.
2. Mostrar búsqueda y detalle público con tarifas USD/ARS y FAQ.
3. Registrar estudiantes y familiares vinculados.
4. Configurar privacidad y documentos.
5. **Crear y aprobar/rechazar propuestas de solicitud del familiar.**
6. Enviar solicitudes con snapshot.
7. Gestionar solicitudes desde residencia.
8. **Enviar y responder una propuesta de ajuste de condiciones por solicitud.**
9. Manejar máximo 2 solicitudes activas por estudiante.
10. Manejar cola por plaza y lista de espera.
11. Registrar pago a residencia informado por residencia.
12. Cobrar fee EstuRed en ARS (MercadoPago) o USD (PayU).
13. **Emitir factura fiscal automáticamente vía TusFacturas.app.**
14. Confirmar reserva.
15. Emitir Comprobante de Reserva Confirmada verificable en `/verify/[codigo]`.
16. Gestionar renovaciones con fee idéntico a la reserva inicial.
17. Emitir Comprobante de Renovación Confirmada.
18. **Gestionar acceso freemium a Gestión Operativa por residencia.**
19. **Operar hasta 10 residencias por owner desde un dashboard multi-residencia.**
20. Operar admin panel completo.
21. Auditar acciones críticas.
22. Manejar notificaciones y vencimientos (incluyendo los de propuestas del familiar y negociación).
23. Pasar QA de permisos, pagos, facturación, estados y privacidad.

---

## 28. Regla final para Claude Code

Claude Code debe construir EstuRed como un sistema de operaciones confiables, no como una colección de pantallas lindas.

La UI importa, pero el valor del producto depende de: estados correctos; permisos correctos; trazabilidad; comprobantes; pagos en dos proveedores y monedas; facturación fiscal automática; verificación; privacidad; administración interna; disponibilidad confiable; negociación de condiciones acotada; multi-residencia aislada; freemium controlado server-side; renovaciones; soporte operacional.

Si una tarea visual contradice reglas de negocio, prevalecen las reglas de negocio.
