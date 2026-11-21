# 07_API_SPEC.md
# EstuRed — Especificación de API / Server Actions del MVP

**Versión:** 0.2
**Estado:** Documento actualizado para construcción
**Última actualización:** 2026-06-27
**Depende de:** `00_DECISION_LOG.md`, `03_BUSINESS_RULES.md`, `04_STATE_MACHINES.md`, `05_ROLES_AND_PERMISSIONS.md`, `06_DATA_MODEL.md`

---

## 1. Propósito del documento

Este documento define las operaciones funcionales que debe exponer el backend de EstuRed para construir el MVP.

Debe usarse como referencia para implementar:

- server actions;
- route handlers;
- endpoints HTTP;
- validaciones de permisos;
- transiciones de estado;
- integración con base de datos;
- integración con proveedores de pago;
- facturación fiscal;
- generación de comprobantes;
- notificaciones;
- jobs automáticos;
- auditoría;
- QA funcional.

Este documento no es un contrato OpenAPI final. Es una especificación funcional para que Claude Code pueda construir el backend sin inventar reglas de negocio.

La implementación recomendada para el MVP es:

**Next.js + TypeScript + Supabase/PostgreSQL + Supabase Storage + MercadoPago + PayU Argentina + TusFacturas.app + Vercel.**

---

## 2. Principios obligatorios de API

### 2.1. El cliente no cambia estados críticos directamente

Ningún cliente debe actualizar directamente campos como:

- `application_requests.status`;
- `family_application_proposals.status`;
- `application_negotiation_proposals.student_response`;
- `reservations.status`;
- `estured_fee_payments.status`;
- `booking_receipts.status`;
- `renewal_offers.status`;
- `residences.status`;
- `residence_visibility_scores.visibility_status`.

Toda transición crítica debe pasar por una función controlada que valide: usuario autenticado, rol, permisos, estado actual, transición permitida, reglas de negocio, efectos secundarios, auditoría y notificaciones.

---

### 2.2. Separar operaciones de lectura y escritura

Las operaciones de lectura exponen DTOs simplificados.

Las operaciones de escritura son server-side y no confían en datos calculados por el cliente.

Ejemplo: el cliente envía duración inicial, residencia y tipo de plaza. El backend recalcula snapshot, fee estimado, tipo de cambio y reglas de disponibilidad.

---

### 2.3. Todo evento crítico debe auditarse

Cada operación crítica escribe en `audit_logs`. Eventos críticos incluyen todos los listados en `06_DATA_MODEL.md` sección 22, más los nuevos flujos de propuesta del familiar y negociación.

---

### 2.4. Todo dato sensible debe salir por DTO controlado

Nunca devolver directamente filas completas de tablas sensibles.

Tablas sensibles:
- `users`, `student_profiles`, `family_links`, `family_members`;
- `family_application_proposals`;
- `application_negotiation_proposals`;
- `files`, `external_residence_payments`;
- `estured_fee_payments`, `booking_receipts`;
- `support_cases`, `audit_logs`.

Los endpoints deben devolver campos filtrados según rol, contexto y visibilidad configurada.

---

### 2.5. La lógica de pago debe ser idempotente

Todas las operaciones relacionadas con cobros, webhooks y generación de comprobantes deben ser idempotentes.

- Si el proveedor envía dos veces el webhook `paid`, no debe duplicarse el comprobante.
- Si un admin reintenta generación de comprobante, no debe crear dos reservas.
- Si falla el PDF pero la reserva ya está confirmada, solo debe reintentarse la generación.
- El campo `idempotency_key` en `estured_fee_payments` es la protección principal.

---

### 2.6. Proveedores de pago abstractos — DECISIÓN CONFIRMADA

El sistema usa la abstracción `PaymentProvider`.

**Proveedores confirmados:**
- **MercadoPago** — pagadores en Argentina (ARS);
- **PayU Argentina** — pagadores fuera de Argentina o que prefieran USD.

Ambos están disponibles simultáneamente. La lógica de negocio de EstuRed no depende del estado textual del proveedor externo. Los webhooks se traducen a estados internos.

---

### 2.7. Fuente de tipo de cambio — DECISIÓN CONFIRMADA

El sistema usa la abstracción `ExchangeRateProvider`.

**Fuente confirmada: monedapi.ar — dólar blue, valor venta.**

- Actualización diaria automática.
- Admin puede hacer override manual con motivo (queda auditado).
- Snapshot guardado al enviar/aprobar solicitud o renovación.
- Snapshots existentes nunca se recalculan.

---

### 2.8. Facturación fiscal — DECISIÓN CONFIRMADA

**Integración con TusFacturas.app para emisión automática de Factura C (monotributista).**

- La factura se emite automáticamente cuando el fee es cobrado correctamente.
- Si el pago es manual, la factura se emite cuando el admin confirma.
- La factura se emite a nombre de quien paga (estudiante o familiar).
- La descripción incluye el beneficiario del servicio reservado.

---

## 3. Convenciones generales

### 3.1. Formato de rutas

Si se implementa con Route Handlers HTTP:

`/api/v1/<resource>`

Ejemplos:
- `/api/v1/residences`
- `/api/v1/application-requests`
- `/api/v1/family-proposals`
- `/api/v1/reservations`
- `/api/v1/renewals`

Si se implementa con Server Actions, los nombres deben seguir la misma semántica:
- `createFamilyApplicationProposal`
- `approveOrRejectFamilyProposal`
- `createApplicationRequest`
- `sendNegotiationProposal`
- `respondToNegotiationProposal`
- `establishApplicationContact`
- `reportResidencePaymentReceived`
- `createRenewalOffer`

---

### 3.2. Formato estándar de respuesta

Respuesta exitosa:

```json
{
  "ok": true,
  "data": {},
  "meta": {}
}
```

Respuesta con error:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Mensaje seguro para mostrar al usuario.",
    "details": {}
  }
}
```

Reglas: no devolver stack traces, no exponer detalles internos de seguridad. Los errores de negocio deben ser legibles.

---

### 3.3. Paginación

Lecturas de listas soportan: `limit`, `cursor` o `page`, `sort`, `filters`.

Default: `limit = 20`. Máximo: `limit = 100`.

---

### 3.4. Dinero

No usar floats.

```json
{
  "amount_ars": "95000.00",
  "amount_usd": "100.00",
  "currency_code": "ARS",
  "exchange_rate_ars_per_usd": "950.000000"
}
```

Reglas: tarifas USD terminan en 0 o 5; tarifas ARS terminan en 500 o 000; fee EstuRed en ARS se redondea a múltiplos de 500; fee puede cobrarse en ARS o USD.

---

### 3.5. Fechas

Usar ISO 8601 en API. Guardar como `timestamptz` para eventos y `date` para fechas de ingreso/salida.

---

### 3.6. Idempotency keys

Obligatorio para: crear solicitud, propuesta de familiar, reportar pago recibido, iniciar cobro de fee, procesar webhook de pago, generar comprobante, crear renovación, confirmar renovación.

---

## 4. Códigos de error de negocio

Errores generales: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`.

Errores de dominio:

- `RESIDENCE_NOT_VERIFIED`
- `RESIDENCE_PAUSED`
- `RESIDENCE_SUSPENDED`
- `AVAILABILITY_NOT_UPDATED`
- `NO_AVAILABILITY`
- `APPLICATION_LIMIT_REACHED`
- `APPLICATION_NOT_ACTIVE`
- `INVALID_APPLICATION_TRANSITION`
- `PROPOSAL_ALREADY_EXISTS` *(nuevo — máx. 1 propuesta de ajuste por solicitud)*
- `FAMILY_PROPOSAL_EXPIRED`
- `NEGOTIATION_PROPOSAL_EXPIRED`
- `PAYMENT_TO_RESIDENCE_NOT_REPORTED`
- `ESTURED_FEE_NOT_PAID`
- `ESTURED_FEE_EXPIRED`
- `RECEIPT_NOT_AVAILABLE`
- `RENEWAL_NOT_AVAILABLE`
- `WAITLIST_ALREADY_ACTIVE`
- `STUDENT_ALREADY_RESERVED_ELSEWHERE`
- `FAMILY_LINK_REQUIRED_FOR_MINOR`
- `DOCUMENT_NOT_AUTHORIZED`
- `VISIBILITY_NOT_ALLOWED`
- `ADMIN_REASON_REQUIRED`
- `OPERATIONAL_MANAGEMENT_NOT_ENABLED` *(nuevo — residencia sin acceso a GO)*
- `REVOCATION_WINDOW_EXPIRED` *(nuevo — revocación fuera de los 10 días corridos)*
- `CONTACT_PHONE_MISSING` *(nuevo — falta teléfono del destinatario del contacto)*

---

## 5. Autenticación y autorización

### 5.1. Roles funcionales

`guest`, `registered_user`, `student`, `family_member`, `residence_owner`, `residence_staff`, `admin`, `superadmin`, `system`.

### 5.2. Verificación de contexto

No basta con saber el rol global. El backend valida contexto:

- un `residence_staff` solo puede ver solicitudes de sus residencias asignadas;
- un familiar solo puede ver datos del estudiante vinculado activo;
- una residencia solo ve documentos autorizados dentro de una solicitud/reserva/renovación;
- un estudiante solo edita su propio perfil;
- un admin interviene pero debe dejar motivo y auditoría.

### 5.3. Permisos de staff

El owner puede crear staff y asignar permisos:

`view_applications`, `manage_applications`, `send_negotiation_proposal`, `view_documents`, `manage_availability`, `manage_rooms`, `manage_residents`, `manage_renewals`, `manage_faq`, `view_metrics`, `manage_profile`, `manage_staff`.

---

## 6. DTOs principales

### 6.1. ResidencePublicCardDTO

```ts
type ResidencePublicCardDTO = {
  id: string;
  name: string;
  neighborhood: string;
  city: "CABA";
  cover_image_url: string | null;
  verification_badge: "Residencia Verificada" | null;
  availability_label: string;
  availability_warning: string | null; // "Sin disponibilidad actualizada" si not_updated
  min_price_usd: string | null;
  min_price_ars_reference: string | null; // referencial
  exchange_rate_label: string; // "al dólar blue de hoy"
  room_types: string[];
  adjustment_policy_summary: string | null;
};
```

---

### 6.2. ResidenceDetailDTO

```ts
type ResidenceDetailDTO = {
  id: string;
  name: string;
  description: string;
  neighborhood: string;
  city: "CABA";
  address_display: string | null;
  photos: string[];
  verification: {
    label: "Residencia Verificada";
    scope: string;
    last_verified_at: string;
  } | null;
  services: string[];
  common_areas: string[];
  house_rules: string[];
  reservation_conditions: string;
  room_types: RoomTypeDTO[];
  availability_status: string;
  availability_label: string;
  availability_warning: string | null;
  pricing_summary: PricingSummaryDTO;
  exchange_rate_modal_text: string; // texto del modal referencial OBLIGATORIO
  adjustment_policy: AdjustmentPolicyDTO;
  community_summary: CommunitySummaryDTO | null;
  faq_items: FaqItemDTO[];
  can_apply: boolean;
  can_join_waitlist: boolean;
  operating_mode: "verified_profile" | "operational_management";
};
```

---

### 6.3. ApplicationRequestDTO

```ts
type ApplicationRequestDTO = {
  id: string;
  student_id: string;
  family_link_id: string | null;
  initiated_by: "student" | "family_member"; // nuevo
  contact_target: "student" | "family_member"; // nuevo
  residence_id: string;
  room_type_id: string | null;
  place_id: string | null;
  status: string;
  visible_status_label: string;
  desired_entry_date: string;
  initial_duration_months: number;
  snapshot_original: ApplicationSnapshotDTO; // nuevo
  snapshot_final: ApplicationSnapshotDTO | null; // nuevo — null si no hubo negociación
  negotiation_proposal: NegotiationProposalDTO | null; // nuevo
  created_at: string;
  expires_at: string | null;
  contact_established_at: string | null;
  whatsapp_button_url: string | null; // generado server-side cuando corresponde
  proposal_count: number; // nuevo — para bloquear segunda propuesta
  next_action: string | null;
};
```

---

### 6.4. NegotiationProposalDTO *(nuevo)*

```ts
type NegotiationProposalDTO = {
  id: string;
  application_request_id: string;
  // Condiciones originales para comparación
  original_monthly_price_usd: string;
  original_monthly_price_ars: string;
  original_enrollment_fee_usd: string;
  original_duration_months: number;
  original_start_date: string;
  // Condiciones propuestas
  proposed_monthly_price_usd: string | null;
  proposed_monthly_price_ars: string | null;
  proposed_enrollment_fee_usd: string | null;
  proposed_room_type_id: string | null;
  proposed_start_date: string | null;
  proposed_duration_months: number | null;
  proposed_reservation_payment_amount_usd: string | null;
  special_conditions: string | null;
  // Estimaciones
  estimated_fee_on_original_ars: string;
  estimated_fee_on_proposed_ars: string;
  // Estado
  student_response: "accepted" | "rejected" | "chose_original" | null;
  expires_at: string;
};
```

---

### 6.5. FamilyApplicationProposalDTO *(nuevo)*

```ts
type FamilyApplicationProposalDTO = {
  id: string;
  family_member_id: string;
  student_profile_id: string;
  residence_id: string;
  residence_name: string;
  room_type_id: string;
  desired_start_date: string;
  initial_duration_months: number;
  status: "draft" | "pending_student_approval" | "approved_by_student" | "rejected_by_student" | "expired";
  message_to_student: string | null;
  expires_at: string;
  created_at: string;
};
```

---

### 6.6. BookingReceiptDTO

```ts
type BookingReceiptDTO = {
  id: string;
  receipt_number: string;
  verification_code: string; // nuevo — para URL /verify/[codigo]
  reservation_id: string;
  status: "not_available" | "pending_generation" | "issued" | "generation_failed" | "voided" | "reissued";
  pdf_url: string | null;
  qr_code_url: string | null; // apunta a /verify/[verification_code]
  issued_at: string | null;
  student_name: string; // nombre + inicial apellido
  residence_name: string;
  room_type: string;
  initial_duration_months: number;
  start_date: string;
  academic_objective: string;
  conditions_snapshot: ApplicationSnapshotDTO; // snapshot_final
  residence_payment_amount_ars: string | null;
  residence_payment_source_label: "Informado por la residencia como recibido";
  estured_fee_amount_ars: string;
  estured_fee_currency: "ARS" | "USD";
  adjustment_policy_summary: string;
  fiscal_invoice_id: string | null; // nuevo — ID en TusFacturas
};
```

---

## 7. Public / Discovery API

### 7.1. Listar residencias publicadas

**GET** `/api/v1/residences`

Roles: invitado, usuario registrado, estudiante, familiar vinculado.

Query params: `city`, `neighborhood`, `room_type`, `min_price_usd`, `max_price_usd`, `availability`, `entry_date`, `duration_months`, `verified_only`, `sort`, `limit`, `cursor`.

Reglas:
- solo mostrar residencias `verified_active`;
- no mostrar residencias `suspended`, `archived` o `paused_by_admin`;
- residencias con `not_updated` por más de 15 días: no aparecen en búsquedas activas;
- residencias `full` pueden aparecer si tienen lista de espera habilitada;
- aplicar penalización de visibilidad internamente, sin mostrar ranking público.

---

### 7.2. Ver detalle de residencia

**GET** `/api/v1/residences/{residence_id}`

Reglas:
- invitados ven vista limitada;
- registrados ven vista ampliada;
- la respuesta siempre incluye `exchange_rate_modal_text` cuando hay precios en ARS;
- nunca exponer datos sensibles prohibidos.

---

### 7.3. Obtener disponibilidad pública

**GET** `/api/v1/residences/{residence_id}/availability`

Modo Perfil Verificado: disponibilidad por tipo configurado.
Modo Gestión Operativa: disponibilidad por plaza/cama si corresponde.

No exponer datos personales de residentes sin permisos.

---

### 7.4. Obtener comunidad visible

**GET** `/api/v1/residences/{residence_id}/community`

Reglas:
- residentes no activados aparecen como `Residente pendiente de activar cuenta` o `Plaza ocupada`;
- nunca devolver apellido completo, email, teléfono, fecha de nacimiento, universidad ni documentos;
- respetar configuración de visibilidad del estudiante.

---

### 7.5. Obtener FAQ de residencia

**GET** `/api/v1/residences/{residence_id}/faq`

Roles: público para preguntas activas. Residencia/admin para gestión.

---

### 7.6. Verificar comprobante por código público *(actualizado)*

**GET** `/api/v1/verify/{verification_code}`

Roles: público (sin autenticación requerida).

Response limitada:
```json
{
  "ok": true,
  "data": {
    "is_valid": true,
    "status": "issued|voided",
    "receipt_type": "reservation|renewal",
    "residence_name": "string",
    "student_display_name": "Nombre A.", // nombre + inicial
    "room_type": "string",
    "start_date": "YYYY-MM-DD",
    "duration_months": 6,
    "issued_at": "ISO_DATE"
  }
}
```

No exponer: documentos, pagos, email, teléfono, apellido completo, datos sensibles.

---

## 8. Auth, perfiles y onboarding

### 8.1. Crear o completar perfil de estudiante

**POST** `/api/v1/student-profile`

Body mínimo:

```json
{
  "first_name": "string",
  "last_name": "string",
  "nationality": "string",
  "birth_date": "YYYY-MM-DD",
  "academic_destination": "string",
  "career": "string",
  "city_of_origin": "string",
  "academic_objective": "string",
  "visibility_settings": {}
}
```

Reglas: apellido completo nunca público; menores deben vincular familiar; `academic_objective` obligatorio para comprobante. Auditar.

---

### 8.2. Actualizar visibilidad del perfil

**PATCH** `/api/v1/student-profile/visibility`

Roles: estudiante dueño del perfil; admin en casos excepcionales con motivo.

Auditar cambios.

---

### 8.3. Solicitar vínculo familiar

**POST** `/api/v1/family-links/request`

Body:

```json
{
  "student_email": "string",
  "relationship": "mother|father|guardian|other"
}
```

Reglas: estudiante debe aprobar; un estudiante solo puede tener un familiar vinculado activo; menores requieren vínculo.

---

### 8.4. Aprobar vínculo familiar

**POST** `/api/v1/family-links/{family_link_id}/approve`

Roles: estudiante dueño.

Reglas: si ya hay familiar activo, rechazar o pedir reemplazo explícito; auditar; notificar al familiar.

---

### 8.5. Revocar vínculo familiar

**POST** `/api/v1/family-links/{family_link_id}/revoke`

Roles: estudiante mayor de edad; familiar vinculado; admin con motivo.

Reglas: si estudiante es menor, no puede quedar sin familiar activo → estado `suspended_minor_no_family`; auditar; notificar.

---

## 9. Propuesta de solicitud del familiar *(sección nueva)*

### 9.1. Crear propuesta de solicitud

**POST** `/api/v1/family-proposals`

Roles: familiar vinculado con `can_create_proposals`.

Body:

```json
{
  "student_profile_id": "uuid",
  "residence_id": "uuid",
  "room_type_id": "uuid",
  "desired_start_date": "YYYY-MM-DD",
  "initial_duration_months": 6,
  "message_to_student": "string|null",
  "idempotency_key": "string"
}
```

Validaciones:
- familiar debe tener `family_links.status = active` con el estudiante;
- residencia debe estar `verified_active`;
- la propuesta queda en `pending_student_approval`, no va a la residencia;
- las propuestas en este estado no cuentan en el límite de 2 solicitudes activas del estudiante.

Transición:
- `family_application_proposals.status = pending_student_approval`;
- `expires_at = now() + 48h`.

Efectos secundarios:
- notificar al estudiante: "Tu familiar sugirió una residencia para vos";
- auditar.

---

### 9.2. Aprobar propuesta de solicitud del familiar

**POST** `/api/v1/family-proposals/{proposal_id}/approve`

Roles: estudiante dueño (el `student_profile_id` de la propuesta).

Body:

```json
{
  "idempotency_key": "string"
}
```

Validaciones:
- propuesta debe estar `pending_student_approval`;
- propuesta no debe estar vencida (`expires_at > now()`);
- el estudiante no debe superar el límite de 2 solicitudes activas.

Transición:
- `family_application_proposals.status = approved_by_student`;
- crear `application_requests` con:
  - `initiated_by = family_member`;
  - `contact_target = family_member`;
  - `family_proposal_id = proposal.id`;
  - `snapshot_original_id` = snapshot generado en este momento;
  - `status = submitted`;
  - `expires_at = now() + 48h`.

Efectos secundarios:
- notificar al familiar: "El estudiante aprobó tu propuesta";
- notificar a la residencia: "Nueva solicitud recibida";
- auditar.

---

### 9.3. Rechazar propuesta de solicitud del familiar

**POST** `/api/v1/family-proposals/{proposal_id}/reject`

Roles: estudiante dueño.

Body:

```json
{
  "reason": "string|null"
}
```

Transición: `family_application_proposals.status = rejected_by_student`.

Efectos: notificar al familiar; auditar.

---

### 9.4. Job de expiración de propuestas del familiar *(nuevo)*

**JOB** `expire_family_proposals`

Frecuencia: cada hora.

Reglas:
- detectar propuestas con `status = pending_student_approval` y `expires_at < now()`;
- pasar a `expired`;
- notificar al familiar;
- auditar como acción system.

---

## 10. Documentos

### 10.1. Subir documento

**POST** `/api/v1/documents`

Roles: estudiante; familiar vinculado; residencia owner/staff para documentos propios; admin.

Body multipart/form-data: `file`, `document_type`, `owner_type`, `owner_id`, `visibility_context`.

Reglas: guardar en storage privado; validar tipo y tamaño; auditar.

---

### 10.2. Autorizar documento para solicitud

**POST** `/api/v1/application-requests/{application_id}/documents/authorize`

Roles: estudiante; familiar vinculado con permiso.

Body:

```json
{
  "document_ids": ["uuid"]
}
```

Reglas: residencia solo ve documentos autorizados para esa solicitud; auditar.

---

### 10.3. Ver documento autorizado

**GET** `/api/v1/documents/{document_id}`

Roles: dueño; familiar vinculado autorizado; residencia en contexto autorizado; admin.

Reglas: generar signed URL temporal; registrar acceso en auditoría para documentos sensibles (admin debe ingresar justificación).

---

## 11. Residencias

### 11.1. Crear residencia en borrador

**POST** `/api/v1/residences`

Roles: usuario autenticado; admin.

Body:

```json
{
  "name": "string",
  "city": "CABA",
  "neighborhood": "string",
  "owner_user_id": "uuid"
}
```

Reglas: se crea en `draft`; usuario creador queda como `residence_owner`; no se publica hasta verificación; auditar.

---

### 11.2. Completar perfil de residencia

**PATCH** `/api/v1/residences/{residence_id}/profile`

Roles: residence owner; staff con `manage_profile`; admin.

Reglas:
- campos críticos requieren revisión admin antes de publicarse;
- tarifas no requieren aprobación previa, pero se auditan;
- cambios tarifarios > 15% generan alerta admin;
- tarifas USD deben terminar en 0 o 5; tarifas ARS en 500 o 000;
- se recomienda configurar tarifas en USD (ver `03_BUSINESS_RULES.md` sección 8.1).

---

### 11.3. Enviar a verificación

**POST** `/api/v1/residences/{residence_id}/submit-verification`

Roles: residence owner; admin.

Reglas: validar perfil mínimo, documentos del responsable, aceptación de términos y deslinde; pasar a `pending_verification`; notificar admin.

---

### 11.4. Programar visita de verificación

**POST** `/api/v1/admin/residences/{residence_id}/schedule-verification-visit`

Roles: admin; superadmin.

Body:

```json
{
  "scheduled_at": "ISO_DATE",
  "assigned_admin_id": "uuid",
  "notes": "string"
}
```

---

### 11.5. Registrar checklist de visita

**POST** `/api/v1/admin/residences/{residence_id}/verification-checklist`

Roles: admin; superadmin.

Body:

```json
{
  "identity_checked": true,
  "address_checked": true,
  "photos_match_reality": true,
  "responsible_person_present": true,
  "checklist_signed_by_both_parties": true,
  "notes": "string",
  "attachments": ["document_id"]
}
```

---

### 11.6. Aprobar residencia verificada

**POST** `/api/v1/admin/residences/{residence_id}/approve-verification`

Roles: admin; superadmin.

Reglas: requiere checklist completo; pasar a `verified_active`; asignar sello; `verification_expires_at = now + 1 year`; publicar; notificar owner.

---

### 11.7. Pausar residencia

**POST** `/api/v1/residences/{residence_id}/pause`

Roles: residence owner; admin.

Body: `{ "reason": "string" }`

---

### 11.8. Gestionar acceso a Gestión Operativa (freemium) *(nuevo)*

**POST** `/api/v1/admin/residences/{residence_id}/operational-management/grant`

Roles: admin; superadmin.

Body:

```json
{
  "reason": "pioneer_beta|purchase|extension|courtesy",
  "free_until": "YYYY-MM-DD|null",
  "notes": "string"
}
```

Reglas: actualiza `has_operational_management_access = true` y `pioneer_free_access_until` si aplica; auditar con motivo; notificar residencia.

**POST** `/api/v1/admin/residences/{residence_id}/operational-management/revoke`

Body: `{ "reason": "string" }`

Reglas: actualiza `has_operational_management_access = false`; auditar; notificar residencia.

---

## 12. Usuarios de residencia y staff

### 12.1. Invitar staff

**POST** `/api/v1/residences/{residence_id}/staff/invite`

Roles: residence owner; staff con `manage_staff`; admin.

Body:

```json
{
  "email": "string",
  "role_label": "staff",
  "permissions": ["view_applications", "manage_applications"],
  "additional_residence_ids": ["uuid"] // nuevo — acceso a múltiples residencias del mismo owner
}
```

Reglas: permisos dentro del catálogo permitido; auditar; enviar invitación.

---

### 12.2. Actualizar permisos de staff

**PATCH** `/api/v1/residences/{residence_id}/staff/{staff_user_id}/permissions`

Roles: owner; admin.

Reglas: auditar cambios; no permitir escalar a owner salvo acción explícita.

---

## 13. Habitaciones, tipos y plazas

### 13.1. Crear tipo de habitación

**POST** `/api/v1/residences/{residence_id}/room-types`

Roles: owner; staff con `manage_rooms`; admin.

Body:

```json
{
  "name": "Individual",
  "capacity": 1,
  "price_usd": "300.00",
  "price_ars": "300000.00",
  "monthly_adjustment_policy": "monthly|quarterly|semiannual|annual|none",
  "reservation_payment_type": "deposit|enrollment|reservation_fee|mixed",
  "reservation_payment_amount_usd": "string",
  "deposit_amount_usd": "string",
  "enrollment_amount_usd": "string"
}
```

Reglas: validar redondeos; si cambia tarifa > 15%, generar alerta admin; auditar.

---

### 13.2. Crear habitación física y plaza

**POST** `/api/v1/residences/{residence_id}/rooms` — solo Gestión Operativa.

**POST** `/api/v1/residences/{residence_id}/places` — solo Gestión Operativa.

---

### 13.3. Actualizar estado de plaza

**PATCH** `/api/v1/places/{place_id}/status`

Body: `{ "status": "available|blocked|maintenance|unavailable", "reason": "string" }`

Reglas: no pasar a `reserved` sin reserva; no pasar a `occupied` sin residente; auditar.

---

## 14. Disponibilidad

### 14.1. Actualizar disponibilidad por tipo

**POST** `/api/v1/residences/{residence_id}/availability/by-room-type`

Roles: owner; staff con `manage_availability`; admin.

Body:

```json
{
  "room_type_id": "uuid",
  "available_count": 3,
  "entry_date_from": "YYYY-MM-DD",
  "status": "available_to_confirm|full|paused_by_residence"
}
```

Reglas: texto visible obligatorio; actualizar `last_availability_update_at`; auditar.

---

### 14.2. Marcar residencia completa

**POST** `/api/v1/residences/{residence_id}/availability/mark-full`

Body: `{ "reason": "string", "enable_waitlist": true }`

---

### 14.3. Job de disponibilidad vencida *(actualizado)*

**JOB** `check_stale_availability`

Frecuencia: diaria.

Reglas:
- si no actualizó en 30 días y no marcó `full`: pasar a `not_updated`, notificar;
- si `not_updated` persiste más de 15 días: registrar `hidden_from_search_at`, ocultar de búsquedas activas;
- impactar métrica de disponibilidad.

---

## 15. Solicitudes de reserva

### 15.1. Crear solicitud de reserva *(actualizado)*

**POST** `/api/v1/application-requests`

Roles:
- **estudiante** (flujo directo);
- admin en casos asistidos.

*Nota: el familiar NO crea solicitudes directamente. El familiar crea `family_application_proposals` (ver sección 9) y el estudiante las aprueba, lo que crea la solicitud automáticamente.*

Body:

```json
{
  "residence_id": "uuid",
  "room_type_id": "uuid",
  "place_id": "uuid|null",
  "desired_entry_date": "YYYY-MM-DD",
  "initial_duration_months": 6,
  "academic_objective": "string",
  "authorized_document_ids": ["uuid"],
  "idempotency_key": "string"
}
```

Validaciones:
- estudiante debe tener perfil mínimo completo;
- si es menor, debe tener familiar vinculado activo;
- residencia debe estar `verified_active`;
- no superar 2 solicitudes activas;
- si hay solicitud avanzando, aplicar reglas de pausa;
- `academic_objective` obligatorio;
- **teléfono del destinatario del contacto obligatorio** (`users.phone` del estudiante, o `family_members.phone` si el contacto irá al familiar);
- guardar `snapshot_original` completo;
- `initiated_by = student`; `contact_target = student` **salvo que el estudiante sea menor de edad, en cuyo caso `contact_target = family_member`**.

Transición: `application_request.status = submitted`, `expires_at = now() + 48h`.

Efectos: notificar residencia; notificar estudiante; audit log; iniciar timers.

---

### 15.2. Marcar solicitud como en revisión

**POST** `/api/v1/application-requests/{application_id}/mark-under-review`

Roles: residence owner; staff con `manage_applications`; admin.

---

### 15.3. Establecer contacto *(actualizado)*

**POST** `/api/v1/application-requests/{application_id}/establish-contact`

Roles: residence owner; staff con `manage_applications`; admin.

Body:

```json
{
  "idempotency_key": "string"
}
```

Validaciones:
- solicitud debe estar `submitted` o `under_review`;
- residencia solo puede avanzar con una solicitud por plaza a la vez;
- si hay otra solicitud del mismo estudiante activa, pausarla.

**DR63:** con `collection_mode = enabled_methods` el endpoint equivale a «Aceptar»: no genera `whatsapp_button_url`. Ver §16.5.

Transición:
- `application_request.status = contact_established`;
- `contact_established_at = now()`;
- `payment_deadline_at = now() + 48h`;
- crear `external_residence_payment.status = pending`.

Efectos secundarios:
- generar `whatsapp_button_url` para la residencia usando el número de `contact_target` (estudiante o familiar según `application_request.contact_target`; si el estudiante es menor de edad, siempre el familiar);
- detener el timer de vencimiento por falta de respuesta de la residencia (48h desde el envío);
- el mensaje pre-formateado incluye: nombre del estudiante, residencia, tipo de habitación, fecha de ingreso, duración y monto requerido para reservar;
- notificar estudiante/familiar según `contact_target`;
- pausar otra solicitud activa del estudiante si existe;
- auditar con `contact_established_at`.

---

### 15.4. Enviar propuesta de ajuste de condiciones *(sección nueva)*

**POST** `/api/v1/application-requests/{application_id}/negotiation-proposal`

Roles: residence owner; staff con `send_negotiation_proposal`; admin.

Body:

```json
{
  "proposed_monthly_price_usd": "string|null",
  "proposed_enrollment_fee_usd": "string|null",
  "proposed_deposit_usd": "string|null",
  "proposed_room_type_id": "uuid|null",
  "proposed_place_id": "uuid|null",
  "proposed_start_date": "YYYY-MM-DD|null",
  "proposed_duration_months": 6,
  "proposed_reservation_payment_amount_usd": "string|null",
  "proposed_adjustment_policy": "monthly|quarterly|semiannual|annual|none|null",
  "special_conditions": "string|null",
  "internal_notes": "string|null",
  "warning_acknowledged": true, // OBLIGATORIO — confirma que leyó la advertencia de 1 sola propuesta
  "idempotency_key": "string"
}
```

Validaciones:
- solicitud debe estar `contact_established`;
- `application_request.proposal_count` debe ser 0 (máximo 1 propuesta);
- `warning_acknowledged` debe ser `true` (el frontend debe mostrar la advertencia antes);
- solo campos modificables; datos del estudiante no pueden cambiarse;
- al menos un campo debe diferir de las condiciones originales.

Transición:
- crear `application_negotiation_proposals`;
- `application_request.status = offer_pending_student_acceptance`;
- `application_request.proposal_count = 1`;
- reiniciar `payment_deadline_at = now() + 48h`.

Efectos secundarios:
- notificar al estudiante/familiar según `contact_target`;
- auditar con campos_modificados (antes vs. después).

---

### 15.5. Responder propuesta de ajuste *(sección nueva)*

**POST** `/api/v1/application-requests/{application_id}/negotiation-proposal/respond`

Roles: estudiante dueño.

Body:

```json
{
  "response": "accepted|rejected_chose_original|rejected_closed",
  "idempotency_key": "string"
}
```

Validaciones:
- solicitud debe estar `offer_pending_student_acceptance`;
- propuesta no debe estar vencida.

Transiciones según respuesta:

**`accepted`:**
- crear `snapshot_final` con los valores propuestos;
- `application_negotiation_proposals.student_response = accepted`;
- `application_request.status = conditions_accepted`;
- `payment_deadline_at = now() + 48h` (reiniciado desde la aceptación).

**`rejected_chose_original`:**
- `snapshot_final_id = snapshot_original_id` (continúa con condiciones originales);
- `application_negotiation_proposals.student_response = chose_original`;
- `application_request.status = conditions_accepted`.

**`rejected_closed`:**
- `application_negotiation_proposals.student_response = rejected`;
- `application_request.status = cancelled_by_student`.

Efectos: notificar a la residencia; auditar.

---

### 15.6. Job de expiración de propuesta de ajuste *(nuevo)*

**JOB** `expire_negotiation_proposals`

Frecuencia: cada hora.

Reglas:
- detectar `application_negotiation_proposals` con `expires_at < now()` sin `student_response`;
- pasar `application_request.status = expired_offer_no_response`;
- notificar a ambas partes;
- auditar.

---

### 15.7. Rechazar solicitud

**POST** `/api/v1/application-requests/{application_id}/reject`

Roles: residence owner; staff con `manage_applications`; admin.

Body:

```json
{
  "reason_code": "no_availability|profile_incomplete|does_not_meet_criteria|already_assigned|dates_incompatible|duration_incompatible|no_response_from_student|residence_paused|other",
  "internal_reason_text": "string|null"
}
```

Reglas: enum; si `other`, texto interno obligatorio; rechazos `no_availability` impactan métricas; auditar; notificar estudiante.

---

### 15.8. Cancelar solicitud por estudiante

**POST** `/api/v1/application-requests/{application_id}/cancel-by-student`

Roles: estudiante dueño; admin.

Body: `{ "reason": "string" }`

Reglas: si ya hay reserva confirmada, no usar este endpoint; auditar; evaluar reactivación de solicitud pausada.

---

### 15.9. Solicitar "Actualizar con mismos parámetros" *(nuevo)*

**POST** `/api/v1/application-requests/{application_id}/refresh-parameters`

Roles: estudiante dueño.

Reglas:
- solo desde solicitudes `expired_no_residence_response` o `expired_no_student_payment`;
- verifica disponibilidad actual de la residencia;
- obtiene tarifa y tipo de cambio actualizados;
- no crea nueva solicitud automáticamente — devuelve los datos actualizados para que el estudiante decida;
- si el estudiante confirma, crea una nueva solicitud con los parámetros actualizados.

Response:

```json
{
  "ok": true,
  "data": {
    "residence_still_available": true,
    "current_monthly_price_usd": "string",
    "current_monthly_price_ars_reference": "string",
    "current_exchange_rate": "string",
    "exchange_rate_modal_text": "string",
    "estimated_fee_ars": "string",
    "can_create_new_application": true
  }
}
```

---

### 15.10. Job de vencimiento de solicitudes *(actualizado)*

**JOB** `expire_application_requests`

Frecuencia: cada hora.

Reglas:
- si `expires_at < now()` y solicitud en estado no terminal: marcar vencida según tipo;
- si pasan 48h desde `contact_established` sin pago a residencia: `expired_no_student_payment`; **DR63:** no aplica si `external_residence_payments.student_reported_paid_at` no es nulo (§16.4);
- si propuesta de ajuste vence sin respuesta: `expired_offer_no_response` (ver job 15.6);
- si residencia no responde dentro del plazo: `expired_no_residence_response`;
- actualizar métricas; notificar; auditar.

---

## 16. Pago a residencia

### 16.1. Estudiante sube comprobante de pago a residencia

**POST** `/api/v1/application-requests/{application_id}/residence-payment/student-reference`

Roles: estudiante; familiar vinculado.

Body multipart/form-data: `file`, `amount_ars`, `amount_usd`, `paid_at`, `notes`.

Reglas: no confirma reserva; solo respaldo; notifica residencia; audita.

**DR63 (2026-11-20):** el comprobante es opcional. «Ya pagué» (§16.4) funciona sin archivo. La residencia ve este comprobante junto a «Pago recibido».

**Fase 5 (2026-11-21):** el endpoint de comprobante separado se retiró. El archivo viaja ahora dentro de «Ya pagué» (§16.4), sin concepto ni montos obligatorios.

---

### 16.2. Residencia marca pago recibido *(actualizado)*

**POST** `/api/v1/application-requests/{application_id}/residence-payment/mark-received`

Roles: residence owner; staff con permiso específico; admin con motivo.

Body:

```json
{
  "received_amount_ars": "string|null",
  "received_amount_usd": "string|null",
  "received_at": "ISO_DATE",
  "payment_method_label": "transfer|cash|virtual_wallet|bank_deposit|other", // DR63: pasa a las claves del catálogo (`lib/payments/paymentMethods.ts`)
  "receipt_document_id": "uuid|null",
  "confirmation_checkbox_accepted": true,
  "terms_acceptance_version": "string", // versión del texto de términos aceptado
  "idempotency_key": "string"
}
```

Validaciones:
- solicitud debe estar `contact_established`, `conditions_accepted` o `residence_payment_pending`;
- `confirmation_checkbox_accepted = true` es obligatorio;
- se crea registro en `consents` vinculado a esta operación.

Transiciones:
- `external_residence_payment.status = reported_received_by_residence`;
- `application_request.status = residence_payment_reported`;
- crear `reservation.status = pending_estured_fee`;
- crear `estured_fee_payment` con `fee_base` calculado sobre `snapshot_final`.

Efectos secundarios:
- iniciar ventana de 48h para fee EstuRed;
- notificar estudiante/familiar;
- iniciar cobro automático si hay medio de pago cargado;
- auditar.

---

### 16.3. Residencia configura el cobro de la reserva *(DR63, propuesto, sin implementar)*

**Server action** `saveReservationPaymentSetup` (sin ruta REST propia: va dentro del guardado del perfil).

Roles: **solo el dueño** de la residencia. El staff no, aunque tenga `profile.edit`.

Body: `reservation_payment_modes` (`enabled_methods`, `whatsapp_direct` o ambos), `accepted_payment_methods` (claves del catálogo) y, por medio, `details` (y `method_label` si es `other`). No hay campo de contacto: la residencia contacta al estudiante (DR63 (j) 2).

Reglas:
- el servidor valida claves contra el catálogo y exige `details` completo por cada medio aceptado;
- con `intent = "submit"` exige al menos una opción completa (requisito 10 de DR59);
- **todo cambio de datos de cobro requiere aprobación del admin (DR63 (j)):** el servidor guarda en `pending_details` (y el nombre de `other` en `pending_method_label`). Siguen rigiendo los datos y el nombre aprobados; al estudiante se le muestra y se congela solo `method_label` aprobado. La aprobación o el rechazo son una acción del admin (con motivo si rechaza) que se audita;
- audita cada cambio con datos enmascarados y avisa al dueño;
- los datos de cobro se leen solo por server action, nunca por la API pública. El staff no los lee.
- **Aprobación (fase 2b, implementada):** server action `reviewCollectionAccount` (`/admin/collection-approvals`). Roles: admin y superadmin; el rol se lee de `user_roles` en el servidor. «Aprobar» copia `pending_details` a `details` y `pending_method_label` a `method_label`, limpia `pending_*` y marca `approved_at` y `approved_by_user_id`. «Rechazar» exige motivo de 10 a 300 caracteres (va en `audit_logs.reason_text`), limpia `pending_*` y deja rigiendo lo aprobado; si nunca hubo datos aprobados, borra la fila. Ambas actualizan solo si `pending_submitted_at` sigue igual al valor que el admin vio; si no, piden recargar. Audita con el dato enmascarado y avisa in-app al dueño, sin el dato.

### 16.4. Estudiante informa el pago «Ya pagué» *(DR63, propuesto)*

**Server action** `reportResidencePaymentPaid`.

Roles: estudiante; familiar vinculado.

Validaciones:
- solicitud en `residence_payment_pending`;
- el pago no está en `reported_received_by_residence`, `expired` ni `disputed`;
- el comprobante es opcional (reusa la validación de §16.1).

Efectos:
- `external_residence_payments.student_reported_paid_at = now()` y `status = student_reported_paid`;
- detiene el vencimiento de 48 horas (§15.10);
- notifica a la residencia (in-app y push de DR61 si corresponde);
- audita. Es idempotente: un segundo toque no cambia nada.

No confirma reserva. Solo §16.2 la confirma.

**Implementación (Fase 5, supuestos reversibles):**
- Núcleo `reportResidencePaymentPaidCore` en `lib/applications/studentPaymentReport.ts`. Acción en `app/students/applications/[id]/payment/actions.ts`.
- El actor sale de la base: el estudiante de la solicitud o el familiar vinculado activo de un menor (`contact_target = family_member`) sin `can_pay_estured_fee` apagado. Antes de «Pago recibido» no existe un pagador designado.
- Solo con `collection_mode = enabled_methods`. Con contacto directo la tarjeta solo informa.
- Con un aviso de «No pude realizar el pago» abierto se rechaza.
- El comprobante es opcional (PDF, JPG, PNG o WebP, hasta 10 MB), bucket privado `payment-proofs`. La residencia lo abre por un link firmado de 5 minutos con permiso `payments.residence`. Cada apertura se audita.
- Se reclama con update condicional: un segundo toque no repite avisos. Limpia las tres marcas `*_sent_at`.
- Los avisos y la auditoría no llevan datos de cobro, montos ni el texto de los motivos.
- Si el job vence la solicitud entre la lectura y el update, el aviso se deshace.

### 16.5. Residencia habilita el pago, camino A o B *(DR63, propuesto)*

**Server action** `enableResidencePayment` (extiende la existente).

Roles: residence owner; staff con permiso de aplicaciones.

Body: `collection_mode` (`enabled_methods` o `whatsapp_direct`), y con `enabled_methods`: `expected_amount_usd`, `expected_amount_ars` y `chosen_method`.

Reglas:
- si la residencia tiene una sola opción activa, el servidor ignora el `collection_mode` enviado y usa esa;
- con `enabled_methods`: precarga monto desde `snapshot_final` y medio desde `preferred_payment_method`;
- congela `instructions_snapshot` desde los `details` **aprobados** de `residence_collection_accounts`. Los datos pendientes no se usan;
- `instructions_snapshot` no es legible por la API (revoke de columna, `docs/06` §12.1). Lo lee una server action solo para el dueño de la residencia, el estudiante de esa solicitud y, si es menor, su familiar vinculado cuando es el pagador (solo lectura);
- la residencia no cambia el monto fuera del proceso de propuesta de ajuste (`docs/04` §6.3);
- con `whatsapp_direct`: igual que hoy. El estudiante ve solo «La residencia te va a escribir por WhatsApp». Nunca recibe un número ni un botón para escribirle;
- tras una propuesta de ajuste, el pase a `residence_payment_pending` es automático. El servidor aplica los valores por defecto de `docs/00` DR63 (k).

**Implementación (Fase 4, supuestos reversibles):** el camino con medios exige ser el dueño (el staff no ve ni congela datos de cobro). El contacto directo lo puede hacer quien tenga `payments.residence`. El monto sale del snapshot y el cliente no lo envía. `collection_mode` queda en `application_requests`. Si solo hay medios y ninguno tiene datos aprobados, el servidor usa contacto directo. Tras una propuesta de ajuste, con medios disponibles, la residencia define el camino desde el detalle y el plazo de 48 horas se reinicia (`chooseResidencePaymentCollectionCore`).

### 16.6. Estudiante elige medio preferido *(DR63, propuesto)*

El campo `preferred_payment_method` viaja en el envío de la solicitud. Es opcional. El servidor valida que la clave esté en `accepted_payment_methods` de la residencia, o que sea nula. Si la clave es del catálogo pero la residencia ya no la ofrece (sin datos de cobro aprobados), se guarda `null` sin error.

### 16.7. Residencia registra «No recibí el pago» *(DR63, supuesto reversible, propuesto)*

**Server action** `disputeReportedResidencePayment`.

Roles: residence owner; staff con permiso de aplicaciones.

Body: `reason` (texto, mínimo 10 caracteres).

Validaciones: pago en `student_reported_paid`.

Efectos:
- `external_residence_payments.status = disputed` y `dispute_reason = reason` (columna sin lectura por API desde 0104: solo service role);
- notifica al estudiante y abre un caso de Soporte;
- audita. El admin resuelve;
- la solicitud pasa a `disputed` solo por acción de Sistema o Admin (`docs/04` §5.4).

**Implementación (Fase 5):** `disputeReportedResidencePaymentCore`. Exige además marcar que leyó el alcance de Soporte (es el recordatorio de términos del caso `residence_claim`, `docs/03` §22.1). Abre el caso `residence_payment` con el motivo; si el caso falla, deshace la disputa. «Pago recibido» sigue disponible tras una disputa.

### 16.8. Recordatorios y alerta del pago a la residencia *(DR63, supuesto reversible)*

**JOB** (dentro de `runExpirationJobs`). Frecuencia: cada hora.

- a las 24 horas de `student_reported_paid_at` (o de `student_payment_issue_at` sin responder) sin respuesta: avisa a la residencia;
- a las 72 horas de lo mismo (decidido por el dueño para «Ya pagué»; supuesto para «No pude realizar el pago»): alerta al admin y abre un caso de Soporte. No hay transición automática;
- 12 horas antes de `payment_deadline_at` sin «Ya pagué» ni aviso de problema: avisa al estudiante;
- marca `residence_reminder_sent_at`, `student_reminder_sent_at` y `admin_alert_sent_at` (alerta de 72 horas) para no repetir;
- el servidor limpia las tres marcas al registrar cada evento nuevo («Ya pagué» o «No pude realizar el pago»), para no suprimir los avisos del segundo evento.

**Implementación (Fase 5):** `lib/jobs/remindResidencePayments.ts`, dentro de `runExpirationJobs`. Cada aviso se reclama con un update sobre su marca (`*_sent_at is null`) y solo se envía si devolvió la fila. Si el caso de Soporte falla, o el aviso de 24 h a la residencia no sale, se devuelve la marca y se reintenta. El aviso de 12 h solo corre con medios habilitados. El caso de las 72 h es `topic = residence_payment` (migración 0103), abierto por el sistema a nombre del estudiante. Un solo caso abierto por solicitud: búsqueda previa e índice único parcial (migración 0104); un 23505 por carrera se trata como éxito. Si el caso ya está abierto o 0103 falta, el admin recibe solo la alerta. El vencimiento (`expireApplicationRequests`) decide por las fechas de aviso, no por el estado: un «Ya pagué» disputado sigue frenado.

### 16.9. Estudiante avisa «No pude realizar el pago» *(DR63 (l), supuesto reversible, propuesto)*

**Server action** `reportResidencePaymentIssue`.

Roles: estudiante; familiar vinculado que es el pagador.

Body: `reason` (texto opcional, máximo 200 caracteres).

Validaciones:
- solicitud en `residence_payment_pending` con `collection_mode = enabled_methods`;
- pago en `pending` y sin aviso abierto.

Efectos:
- `student_payment_issue_at = now()` y `student_payment_issue_reason = reason`;
- detiene el vencimiento de 48 horas (§15.10);
- notifica a la residencia (in-app y push de DR61);
- audita. Es idempotente.

No hay mensaje directo del estudiante a la residencia. Para ayuda, el estudiante usa Soporte de EstuRed.

**Implementación (Fase 5):** `reportResidencePaymentIssueCore`. El motivo es opcional; si se escribe, de 10 a 200 caracteres. Un aviso nuevo tras una respuesta reabre el aviso (una sola marca por pago).

### 16.10. Residencia responde al aviso: contactar o rehabilitar *(DR63 (l), supuesto reversible, propuesto)*

**Server action** `resolveStudentPaymentIssue`.

Roles: residence owner; staff con permiso de aplicaciones.

Body: `resolution` (`contact_whatsapp` o `reenable_payment`) y, con `reenable_payment`, `chosen_method` y `expected_amount_*` opcionales para cambiarlos.

Efectos:
- `student_payment_issue_resolved_at = now()` y `payment_deadline_at = now() + 48h`;
- con `contact_whatsapp`: `application_requests.collection_mode = whatsapp_direct` y la residencia recibe el botón de WhatsApp al número de `contact_target`;
- con `reenable_payment`: congela de nuevo `instructions_snapshot` desde los datos aprobados;
- notifica al estudiante y audita.

**Implementación (Fase 5):** `resolveStudentPaymentIssueCore`. «Volver a habilitar» es solo del dueño y usa los datos aprobados; el monto no cambia. «Contactar por WhatsApp» borra el texto congelado. Ambas limpian las tres marcas y reinician el plazo.

---

## 17. Fee EstuRed *(actualizado)*

### 17.1. Calcular fee estimado

**POST** `/api/v1/fees/estimate`

Roles: estudiante; familiar; residencia; admin; sistema.

Body:

```json
{
  "residence_id": "uuid",
  "room_type_id": "uuid",
  "initial_duration_months": 6,
  "entry_date": "YYYY-MM-DD",
  "use_snapshot_final": true // si hay propuesta de ajuste aceptada
}
```

Reglas: fee = 5% sobre `snapshot_final`; incluir matrícula; excluir depósito; no estimar ajustes futuros; usar tipo de cambio actual; redondear a múltiplos de 500 ARS.

---

### 17.2. Iniciar cobro del fee

**POST** `/api/v1/reservations/{reservation_id}/fee/charge`

Roles: sistema; estudiante/familiar; admin.

Body:

```json
{
  "payment_provider": "mercado_pago|payu_argentina|manual",
  "payment_currency": "ARS|USD",
  "payment_method_id": "uuid|null",
  "payer_billing_data": {
    "name": "string",
    "cuit_cuil": "string|null",
    "iva_condition": "consumidor_final|responsable_inscripto"
  },
  "idempotency_key": "string"
}
```

Validaciones:
- reserva debe estar `pending_estured_fee`;
- pago a residencia debe estar reportado;
- fee no debe estar `paid`;
- si `payment_currency = USD`, `payment_provider` debe ser `payu_argentina`.

Reglas:
- hasta 3 intentos dentro de 48h;
- si vence: fee `expired` (terminal) y reserva `expired_fee_unpaid`;
- no emitir comprobante hasta `paid`;
- `idempotency_key` previene cobros duplicados.

---

### 17.3. Registrar pago manual del fee

**POST** `/api/v1/reservations/{reservation_id}/fee/manual-payment-reference`

Roles: estudiante; familiar vinculado; admin.

Body multipart/form-data: `file`, `amount_ars`, `amount_usd`, `currency`, `paid_at`, `payment_channel`, `payer_billing_data`.

Reglas: queda pendiente de validación admin; no confirmar reserva hasta admin marque `paid`; auditar.

**DR64 (2026-11-21, supuestos del agente):** este endpoint es «Ya pagué» del fee. El **comprobante `file` es obligatorio** (DR8 (1) no se relaja). Exige que el fee tenga `chosen_method` (§17.7), esté en `pending_payment_method`, con plazo vigente y sin aviso «No pude realizar el pago» abierto. El UPDATE condicional pasa el fee a `pending_manual_payment` y setea `student_reported_paid_at = now()`. `payment_channel` pasa a ser la etiqueta del `chosen_method` (el pagador ya no la escribe). El servidor limpia `payer_reminder_sent_at`, `admin_reminder_sent_at` y `admin_alert_sent_at`. Avisa a los admins. Desde ahí el fee **no vence** (§17.10).

---

### 17.4. Admin valida pago manual del fee

**POST** `/api/v1/admin/estured-fee-payments/{fee_payment_id}/mark-paid`

Roles: admin; superadmin.

Body:

```json
{
  "reason": "string",
  "payment_currency": "ARS|USD",
  "received_amount": 140500,
  "payment_provider_reference": "string|null",
  "verified": true,
  "confirm_without_receipt": false,
  "accept_amount_difference": false,
  "receipt_file_id": "uuid|null"
}
```

Reglas (DR8, `docs/00` §31): motivo obligatorio (mín. 5; mín. 10 con override o con diferencia > 1 %); `verified` obligatorio; **comprobante cargado** (`manual_payment_file_id`) **o** `confirm_without_receipt = true` (override con motivo ≥ 10 y solo si no hay comprobante); `received_amount` > 0 comparado contra el fee esperado guardado (tolerancia 1 %; mayor diferencia exige `accept_amount_difference = true` y motivo ≥ 10; si lo recibido es < 90 % del esperado solo `superadmin`; `receipt_file_id` = comprobante visto, debe coincidir con el actual); fee no vencido (`expires_at`) y en `pending_manual_payment`/`pending_payment_method`, con UPDATE condicional (la doble confirmación no hace nada); reserva `pending_estured_fee` y pago a la residencia confirmado; marcar fee `paid`; confirmar reserva; disparar generación de comprobante; disparar emisión de Factura C en TusFacturas.app; auditar (quién, esperado vs. recibido, diferencia, override; sin datos de facturación).


**Enmienda DR64 (d):** el plazo (`expires_at`) se exige solo en `pending_payment_method` (override sin comprobante). En `pending_manual_payment` no se revisa: ese estado ya fue informado a tiempo. `payment_currency` y la moneda de `received_amount` salen de `chosen_method` (la moneda del medio, §17.6). Al marcar pagado se limpia `admin_disputed_*` si había disputa.

---

### 17.5. Webhook de proveedor de pagos *(actualizado)*

**POST** `/api/v1/payment-webhooks/{provider}`

Donde `provider` es `mercado_pago` o `payu_argentina`.

Roles: proveedor externo con validación por firma/secreto.

Reglas:
- validar autenticidad (firma HMAC o equivalente);
- traducir estado externo a estado interno;
- **idempotencia obligatoria** — verificar `idempotency_key` antes de procesar;
- si pago `paid`:
  - marcar `estured_fee_payment.status = paid`;
  - pasar reserva a `confirmed`;
  - disparar generación de comprobante;
  - disparar emisión de Factura C en TusFacturas.app;
- si pago `failed`: incrementar intento; notificar;
- si `chargeback`: marcar el pago como `chargeback` y **alertar admin — sin modificar automáticamente la reserva ni el comprobante** (el admin decide las acciones, auditadas).

### 17.6. Admin configura los medios de cobro del fee *(DR64 (a), supuesto del agente, propuesto)*

**Server action** `saveFeeCollectionMethod` (pantalla `/admin/payment-settings`, `docs/08` §8.10b).

Roles: `superadmin` (escribe). `admin` (solo lectura, datos enmascarados).

Body: `method_key` (clave del catálogo `lib/payments/paymentMethods.ts`), `details` (1 a 500 caracteres), `currency` (`ARS` o `USD`), `is_enabled` y, si `method_key = other`, `method_label` (2 a 60).

Validaciones: rol desde la sesión; clave del catálogo; `details` con `validatePaymentDetails`; moneda válida; no se puede habilitar un medio sin datos.

Efectos: upsert por `method_key` en `estured_fee_collection_methods` (solo service role). Audita `estured_fee_collection_method_updated` con valor anterior y nuevo **enmascarados** (`maskPaymentDetails`). Avisa a todos los superadmin (in-app y email), sin datos de cobro. Acción `importFeeCollectionFromSettings`: crea el medio `transfer_ars` desde la fila de `payment_settings` (el CBU no pasa por el cliente ni por SQL).

**Respaldo:** sin ningún medio habilitado, la pantalla del pagador usa `payment_settings` como `transfer_ars` (comportamiento anterior a DR64).

### 17.7. Pagador elige el medio del fee *(DR64 (b), propuesto)*

**Server action** `chooseFeePaymentMethod`.

Roles: pagador designado (`payer_user_id`): estudiante o familiar vinculado con `can_pay_estured_fee`. Se revalida el vínculo en cada llamada.

Body: `application_id` y `method_key`.

Validaciones: la reserva está `pending_estured_fee` y el fee en `pending_payment_method` con plazo vigente; el medio está habilitado.

Efectos: guarda `chosen_method`, `payment_currency` (la del medio) y `instructions_snapshot` (etiqueta y datos congelados); si la moneda es USD, `fee_amount_usd` = `fee_amount_ars` ÷ cotización del snapshot (`docs/04` §8.4). Cambiar de medio antes de «Ya pagué» vuelve a congelar. Audita sin datos de cobro.

La pantalla del pagador lee `instructions_snapshot` con service role, solo para el pagador designado y el admin. La residencia no.

### 17.8. Pagador avisa «No pude realizar el pago» *(DR64 (e), propuesto)*

**Server action** `reportFeePaymentIssue`.

Roles: pagador designado (mismo control que §17.7).

Body: `reason` (opcional; si se escribe, de 10 a 200 caracteres).

Validaciones: fee en `pending_payment_method`, plazo vigente, sin aviso abierto.

Efectos: `student_payment_issue_at = now()` y `student_payment_issue_reason`; limpia `student_payment_issue_resolved_at` y las tres marcas `*_sent_at`. **Detiene el vencimiento** (§17.10). Avisa a los admins (in-app y push DR61). Audita. Es idempotente. No hay mensaje directo a EstuRed: la ayuda es Soporte.

### 17.9. Admin responde al aviso y registra «No recibí el pago» *(DR64 (d) y (e), propuesto)*

**Server action** `resolveFeePaymentIssue`. Roles: `admin`; `superadmin`. Body: `fee_payment_id`, `resolution` (`contact_payer` o `reopen_payment`) y `reason` (mínimo 5).
- `contact_payer`: abre un caso de Soporte `estured_fee_payment` a nombre del pagador.
- `reopen_payment`: permite elegir otro medio.
- Ambas: `student_payment_issue_resolved_at = now()`, `expires_at = now() + 48 h`, notifican al pagador y auditan.

**Server action** `disputeFeePayment` («No recibí el pago»). Roles: `admin`; `superadmin`. Body: `fee_payment_id`, `reason` (de 10 a 500) y `receipt_file_id` (el comprobante visto, debe coincidir con el actual).
- Validaciones: fee en `pending_manual_payment` con comprobante, sin disputa abierta, reserva `pending_estured_fee`.
- Efectos: `admin_disputed_at`, `admin_dispute_reason` y `admin_disputed_by_user_id`; **el estado del fee y de la reserva no cambia**. Avisa al pagador con texto genérico (sin el motivo). Abre un caso de Soporte `estured_fee_payment`, único por reserva. Audita.
- Salida: marcar pagado (§17.4, limpia la disputa) o `reopenEsturedFeeWindow` extendida (§17.9b).

**§17.9b. Reabrir el plazo** (`reopenEsturedFeeWindow`, `lib/reservations/reopenEsturedFeeWindow.ts`). Hoy vale solo para fees `expired`. DR64 la extiende a fees en `pending_manual_payment` con disputa abierta: el fee vuelve a `pending_payment_method`, `expires_at = now() + 48 h`, y se limpian `student_reported_paid_at`, `manual_payment_file_id` y `admin_disputed_*`. UPDATE condicional por el estado leído. Propuesta sin implementar: máximo 2 reaperturas por fee (`docs/00` DR64 (i)).

### 17.10. Vencimiento, recordatorios y alerta del fee *(DR64 (d) y (f), propuesto)*

**JOB** `expire_estured_fee_windows` (cada hora). Cambios:
- excluye los fees en `pending_manual_payment`;
- excluye los fees en `pending_payment_method` con `student_payment_issue_at` no nulo y `student_payment_issue_resolved_at` nulo.

**JOB** `remindFeePayments` (dentro de `runExpirationJobs`, cada hora). Cada aviso se reclama con un update sobre su marca (`*_sent_at is null`) y solo se envía si devolvió la fila:
- 12 horas antes de `expires_at`, sin «Ya pagué» ni aviso abierto: aviso al pagador (`payer_reminder_sent_at`);
- 24 horas de `student_reported_paid_at` sin validar ni disputa, o de `student_payment_issue_at` sin responder: aviso a los admins (`admin_reminder_sent_at`);
- 72 horas de lo mismo: alerta a los admins y caso de Soporte `estured_fee_payment`, único por reserva (`admin_alert_sent_at`). Sin transición automática.

Índices: `estured_fee_payments_reported_open_idx` y `estured_fee_payments_issue_open_idx` (0105).

### 17.11. Quién lee qué (RLS y columnas) *(DR64, migración 0105)*

El equipo de la residencia lee `estured_fee_payments` por RLS. Por eso solo `chosen_method`, `student_reported_paid_at`, `student_payment_issue_at` y `student_payment_issue_resolved_at` tienen `grant select` a `authenticated`. `instructions_snapshot`, los dos motivos de texto libre, `admin_disputed_*` y las tres marcas `*_sent_at` solo las lee el service role. `estured_fee_collection_methods` no tiene policies ni grants.

---

## 18. Reservas

### 18.1. Obtener reserva

**GET** `/api/v1/reservations/{reservation_id}`

Roles: estudiante dueño; familiar vinculado; residencia asociada; admin.

Reglas: DTO según rol; nunca exponer datos sensibles no autorizados.

---

### 18.2. Confirmar reserva tras fee pagado *(actualizado)*

**Internal Action** `confirmReservationAfterFeePaid`

Invocada por: webhook de pago, admin valida pago manual, sistema.

Reglas:
- requiere `estured_fee_payment.status = paid`;
- requiere `external_residence_payment.status = reported_received_by_residence`;
- pasar reserva a `confirmed`;
- pasar solicitud a `converted_to_reservation`;
- cerrar otras solicitudes activas como `closed_due_to_other_confirmed_reservation`;
- remover estudiante de otras listas de espera;
- actualizar disponibilidad (Perfil Verificado: reducir declarada; GO: plaza → `reserved`);
- disparar `generateBookingReceipt`;
- disparar emisión de Factura C (TusFacturas.app) si no fue emitida ya;
- auditar; notificar.

---

### 18.3. Cancelar reserva por estudiante

**POST** `/api/v1/reservations/{reservation_id}/cancel-by-student`

Body: `{ "reason": "string", "acknowledge_no_refund_policy": true }`

Reglas: fee no reembolsable salvo normativa; si existía comprobante emitido, pasa a `voided`; notificar residencia; auditar.

---

### 18.4. Cancelar reserva por residencia

**POST** `/api/v1/reservations/{reservation_id}/cancel-by-residence`

Body: `{ "reason": "string", "evidence_document_ids": ["uuid"], "acknowledge_penalty_risk": true }`

Reglas: puede activar revisión admin; fee puede ser reembolsable si la causa es atribuible a residencia; impacta métricas; auditar.

---

### 18.5. Marcar no-show

**POST** `/api/v1/reservations/{reservation_id}/mark-no-show`

Roles: residencia asociada; admin.

Body: `{ "reason": "string", "contact_attempts": ["string"], "evidence_document_ids": ["uuid"] }`

Reglas: solo después de 24h sin respuesta; fee no se reembolsa; auditar.

---

### 18.6. Ejercer derecho de revocación del fee *(sección nueva)*

**POST** `/api/v1/reservations/{reservation_id}/revoke-fee`

Roles: estudiante dueño; familiar pagador del fee.

Acceso UI: enlace visible en el footer de la plataforma → pantalla `/students/revocation` (ver `08_UI_SCREENS_AND_FLOWS.md` §6.16).

Body:

```json
{
  "reason": "string|null",
  "acknowledge_understanding": true,
  "idempotency_key": "string"
}
```

(DR6: el campo era `acknowledge_no_automatic_refund`; el checkbox ahora confirma que el estudiante entiende qué pasa al revocar — reserva cancelada, comprobante anulado, reintegro del fee tras la revisión del equipo, lo pagado a la residencia se acuerda con ella.)

Validaciones:
- el fee de la reserva debe estar `paid`;
- deben haber transcurrido **menos de 10 días corridos** desde `paid_at` (fuera de plazo → error `REVOCATION_WINDOW_EXPIRED`);
- `acknowledge_understanding = true` obligatorio.

Transiciones:
- `reservation.status = cancelled_by_student` con `cancellation_reason_code = student_revocation_right`;
- `booking_receipt.status = voided`;
- el fee **permanece `paid`** — no hay transición automática a `refunded` (`docs/04` §8.9);
- se abre un `support_case` interno (`topic = 'fee_revocation'`, sin residencia) para la revisión admin, en modo best-effort (si falla, la revocación igual queda registrada).

Efectos secundarios:
- registrar fecha/hora de la solicitud de revocación (`reservations.cancelled_at`);
- auditar la operación completa;
- notificar a la residencia y al admin: **pendiente** (no existe un notificador genérico a admins; hoy el admin ve la revocación en el contador del dashboard, en Actividad → Revocaciones y en Soporte).

El reintegro del fee es una decisión admin posterior (§18.6bis), nunca automática.

### 18.6bis. Resolver una revocación del fee (admin) *(sección nueva, DR6)*

**Server action** `resolveFeeRevocationAction` (panel Actividad → Revocaciones; no hay endpoint REST público).

Roles: admin / superadmin.

Entrada: `{ decision: "refunded" | "denied", internal_reason: string (10–1000), student_message?: string (≤1000), confirm_refund_amount_ars?: number, refund_method?: "bank_transfer" | "digital_wallet" | "other", refund_reference?: string (3–120), refunded_on?: date, justified_cause?: boolean }`.

Validaciones (servidor, nunca solo en el cliente):
- solo sobre una revocación pendiente (reserva `cancelled_by_student` + `student_revocation_right`, fee `paid`, sin resolución previa); la escritura es condicional por ese estado, así que una doble resolución o una carrera devuelve error y no cambia nada;
- `refunded`: exige confirmar el monto exacto del fee en ARS, medio, referencia y fecha (no futura);
- `denied`: si la revocación se registró **dentro de los 10 días corridos** de `paid_at`, exige `justified_cause = true`; fuera de plazo no.

Transiciones:
- `refunded`: `fee.status = refunded`, `refunded_at`, `refund_amount_ars`, `refund_method`, `refund_reference`, `revocation_resolution = refunded`;
- `denied`: el fee sigue `paid`, `revocation_resolution = denied`;
- en ambas: `revocation_resolved_at/by`, `revocation_internal_reason` (solo servidor) y `revocation_student_message` (visible para el estudiante); se cierra el `support_case` del tipo `fee_revocation` y se notifica in-app al estudiante y al pagador (sin el motivo interno).

Auditoría: `estured_fee_refunded_after_revocation` / `estured_fee_revocation_denied`, con el motivo interno.

El reintegro real (transferencia) se hace por fuera de la plataforma; esta acción solo lo registra.

---

## 19. Comprobantes *(actualizado)*

### 19.1. Generar comprobante de reserva confirmada

**Internal Action** `generateBookingReceipt`

Invocada por: confirmación de reserva, admin reintenta generación.

Reglas:
- solo si reserva `confirmed`;
- generar `verification_code` único e impredecible;
- `qr_code_value` = URL completa `/verify/[verification_code]`;
- incluir condiciones del `snapshot_final` (no del original si hubo ajuste aceptado);
- si falla PDF/QR: estado `generation_failed`, reserva sigue `confirmed`;
- admin puede reemitir.

Contenido obligatorio del PDF: ver `03_BUSINESS_RULES.md` sección 14.

---

### 19.2. Descargar comprobante

**GET** `/api/v1/booking-receipts/{receipt_id}/download`

Roles: estudiante dueño; familiar vinculado; residencia asociada; admin.

Reglas: signed URL temporal; auditar descargas sensibles.

---

### 19.3. Verificar comprobante (endpoint público)

**GET** `/api/v1/verify/{verification_code}`

Roles: público.

Ver sección 7.6 para response.

---

### 19.4. Reemitir comprobante

**POST** `/api/v1/admin/booking-receipts/{receipt_id}/reissue`

Roles: admin; superadmin.

Body: `{ "reason": "string" }`

Reglas: motivo obligatorio; conservar anterior como histórico; estado `reissued`; auditar.

---

## 20. Facturación fiscal *(sección nueva)*

### 20.1. Emitir Factura C (TusFacturas.app)

**Internal Action** `emitFiscalInvoice`

Invocada por: confirmación de fee pagado (automático o manual admin).

Body interno:

```json
{
  "fee_payment_id": "uuid",
  "payer_name": "string",
  "payer_cuit_cuil": "string|null",
  "payer_iva_condition": "consumidor_final|responsable_inscripto",
  "amount_ars": "string",
  "amount_usd": "string|null",
  "currency": "ARS|USD",
  "service_description": "Fee de servicio EstuRed - Reserva en [nombre residencia] para [nombre estudiante]"
}
```

Reglas:
- integración con TusFacturas.app API;
- al invocarse, `fiscal_invoice_status` = `pending_issue`;
- en éxito: guardar `fiscal_invoice_id`, `fiscal_invoice_number`, `fiscal_invoice_issued_at`, `fiscal_invoice_file_id` en `estured_fee_payments` y pasar `fiscal_invoice_status` = `issued`;
- guardar PDF de la factura en bucket `fiscal-documents`;
- enviar por email al pagador;
- auditar emisión;
- si falla: `fiscal_invoice_status` = `issue_failed`, incrementar `fiscal_invoice_retry_count`, registrar `fiscal_invoice_last_error`, alertar admin y reintentar por job (la reserva permanece `confirmed`).

---

### 20.2. Reemitir factura

**POST** `/api/v1/admin/fiscal-invoices/{fee_payment_id}/reissue`

Roles: admin; superadmin.

Body: `{ "reason": "string" }`

Reglas: motivo obligatorio; gestionar nota de crédito si aplica; auditar.

---

## 21. Lista de espera

### 21.1. Entrar en lista de espera

**POST** `/api/v1/waitlists`

Roles: estudiante; admin.

Body:

```json
{
  "residence_id": "uuid",
  "room_type_id": "uuid|null",
  "desired_entry_date": "YYYY-MM-DD",
  "desired_duration_months": 6
}
```

Reglas: no cuenta como solicitud activa; solo estudiantes no confirmados en otra residencia; auditar.

---

### 21.2. Notificar disponibilidad a lista de espera

**Internal/Residence Action** `notifyWaitlistAvailability`

Roles: sistema; residencia; admin.

Reglas: estado `availability_notification_sent`; estudiante decide si activa solicitud; no contaminar métricas.

---

### 21.3. Activar solicitud desde lista de espera

**POST** `/api/v1/waitlists/{waitlist_id}/activate-request`

Roles: estudiante; admin.

Reglas: validar máximo 2 solicitudes activas; crear solicitud normal con snapshot; estado waitlist `student_activated_request`.

---

### 21.4. Job de confirmación de permanencia (90 días)

**JOB** `send_waitlist_90_day_confirmation`

Reglas: nunca vence automáticamente; solo notifica; residencia puede eliminar manualmente.

---

### 21.5. Salir de lista de espera

**POST** `/api/v1/waitlists/{waitlist_id}/remove`

Body: `{ "reason": "student_removed|residence_removed|confirmed_elsewhere|admin_action" }`

---

## 22. Renovaciones

### 22.1. Solicitar renovación (informal)

**POST** `/api/v1/reservations/{reservation_id}/renewal-requests`

Roles: estudiante; admin.

Body: `{ "desired_duration_months": 6, "desired_start_date": "YYYY-MM-DD", "message": "string|null" }`

Reglas: no crea oferta formal; notifica residencia; auditar.

---

### 22.2. Crear oferta de renovación

**POST** `/api/v1/reservations/{reservation_id}/renewal-offers`

Roles: residence owner; staff con `manage_renewals`; admin.

Body:

```json
{
  "period_start": "YYYY-MM-DD",
  "period_end": "YYYY-MM-DD",
  "duration_months": 6,
  "monthly_price_usd": "string",
  "monthly_price_ars": "string",
  "adjustment_policy": "monthly|quarterly|semiannual|annual|none",
  "required_residence_payment_amount_usd": "string|null",
  "enrollment_or_renewal_fee_usd": "string|null",
  "expires_at": "ISO_DATE",
  "notes": "string|null"
}
```

Reglas: fee renovación = misma lógica que reserva inicial (5%, sin excepciones); guardar snapshot; auditar; notificar.

---

### 22.3. Aceptar oferta de renovación

**POST** `/api/v1/renewal-offers/{renewal_offer_id}/accept`

Roles: estudiante; admin en casos asistidos.

Reglas: oferta debe estar `sent` u `viewed`; estudiante acepta condiciones; mismo flujo de pago + fee + comprobante.

---

### 22.4. Residencia marca pago recibido de renovación

**POST** `/api/v1/renewal-offers/{renewal_offer_id}/residence-payment/mark-received`

Misma lógica que sección 16.2 pero para renovación.

---

### 22.5. Generar Comprobante de Renovación Confirmada

**Internal Action** `generateRenewalReceipt`

Reglas: solo después de fee de renovación pagado; nombre oficial: "Comprobante de Renovación Confirmada"; incluir `verification_code` único; incluir período renovado, condiciones, monto informado y fee.

---

## 23. Residentes y comunidad visible

### 23.1. Crear residente desde residencia

**POST** `/api/v1/residences/{residence_id}/residents`

Roles: owner; staff con `manage_residents`; admin.

Body: `{ "email": "string", "first_name": "string|null", "place_id": "uuid|null", "expected_start_date": "YYYY-MM-DD|null" }`

Validación: requiere `has_operational_management_access = true`.

---

### 23.2. Activar cuenta de residente

**POST** `/api/v1/residents/{resident_id}/activate`

Roles: usuario invitado por email; admin.

Reglas: completar perfil; aceptar términos; configurar visibilidad; auditar.

---

### 23.3. Actualizar visibilidad de residente

**PATCH** `/api/v1/residents/{resident_id}/visibility`

Reglas: residencia no puede forzar perfil visible; auditar.

---

## 24. FAQ / Bot asistido *(actualizado)*

### 24.1. Obtener listado predefinido de preguntas

**GET** `/api/v1/faq/predefined-questions`

Roles: residence owner; staff con `manage_faq`; admin.

Reglas: devuelve listado global de preguntas predefinidas que la residencia puede elegir y responder.

---

### 24.2. Configurar FAQ de residencia

**POST/PATCH** `/api/v1/residences/{residence_id}/faq`

Roles: owner; staff con `manage_faq`; admin.

Body:

```json
{
  "items": [
    {
      "predefined_question_id": "uuid|null",
      "question": "string",
      "answer": "string",
      "is_active": true
    }
  ]
}
```

Reglas: el sistema no inventa respuestas; preguntas no respondidas se registran; auditar.

---

### 24.3. Preguntar al bot/FAQ

**POST** `/api/v1/residences/{residence_id}/faq/ask`

Roles: invitado; registrado; estudiante; familiar.

Body: `{ "question": "string" }`

Reglas: buscar en FAQ configuradas y archivos subidos; si no hay respuesta, registrar como `needs_residence_input`; **nunca confirmar disponibilidad no cargada explícitamente**; **nunca inventar precios ni condiciones**.

---

## 25. Soporte y resolución de conflictos *(actualizado)*

### 25.1. Abrir caso de soporte

**POST** `/api/v1/support-cases`

*(Renombrado de `mediation-cases` para evitar implicaciones legales)*

Roles: estudiante; familiar; residencia; admin.

Body:

```json
{
  "case_type": "reservation_issue|payment_issue|misleading_information|cancellation|discrimination|conduct|other",
  "related_entity_type": "application|reservation|renewal|residence|student",
  "related_entity_id": "uuid",
  "description": "string",
  "evidence_document_ids": ["uuid"],
  "terms_reminder_accepted": true
}
```

Reglas: mostrar reminder de términos, alcance y deslinde; EstuRed no está obligada a actuar en todos los casos; abrir caso no suspende estados automáticamente; auditar.

---

### 25.2. Admin actualiza caso

**PATCH** `/api/v1/admin/support-cases/{case_id}`

Roles: admin; superadmin.

Body:

```json
{
  "status": "under_review|needs_more_info|waiting_other_party|in_progress|resolved_by_agreement|closed_no_action|closed_unresolved|admin_action_taken",
  "internal_notes": "string",
  "admin_action": "none|warning|reduced_visibility|pause|suspend|refund|other"
}
```

Reglas: motivo obligatorio; auditar; notificar partes.

---

## 26. Métricas, penalizaciones y visibilidad

### 26.1. Obtener métricas de residencia

**GET** `/api/v1/residences/{residence_id}/metrics`

Roles: owner; staff con `view_metrics`; admin.

Incluye: tasa de respuesta, tiempo promedio, solicitudes vencidas, contacto establecido, reservas confirmadas, rechazos por disponibilidad, reclamos validados, actualización de disponibilidad, uso operativo, propuestas de ajuste enviadas/aceptadas.

---

### 26.2. Job de recálculo de visibilidad

**JOB** `recalculate_residence_visibility_scores`

Frecuencia: diaria y tras eventos críticos.

Ponderación: respuesta y velocidad 25%, disponibilidad 20%, conversión 20%, perfil 15%, reclamos 10%, uso operativo 10%.

---

### 26.3. Admin aplica penalización

**POST** `/api/v1/admin/residences/{residence_id}/visibility-penalty`

Body: `{ "penalty_status": "warning|reduced_visibility|temporarily_paused|suspended|removed_from_network", "reason": "string", "related_case_id": "uuid|null" }`

Reglas: motivo obligatorio; notificar residencia; auditar.

---

## 27. Admin panel

### 27.1. Buscar usuarios

**GET** `/api/v1/admin/users`

Filtros: rol, email, estado, menor de edad, residencia asociada, fecha de registro.

---

### 27.2. Buscar solicitudes

**GET** `/api/v1/admin/application-requests`

Filtros: estado, residencia, estudiante, fecha, motivo de rechazo, tipo de propuesta (`initiated_by`), en negociación.

---

### 27.3. Admin interviene solicitud

**POST** `/api/v1/admin/application-requests/{application_id}/intervene`

Body: `{ "action": "pause|cancel|reactivate|edit|force_transition", "target_status": "string|null", "reason": "string" }`

Reglas: motivo obligatorio; no saltar reglas críticas sin trazabilidad; auditar; notificar.

---

### 27.4. Admin gestiona reserva

**POST** `/api/v1/admin/reservations/{reservation_id}/intervene`

Acciones: confirmar con autorización expresa, cancelar, marcar disputa, no-show, reintentar comprobante, iniciar reembolso.

Reglas: motivo obligatorio; todo auditado.

---

### 27.5. Admin revisa alertas tarifarias

**GET** `/api/v1/admin/pricing-alerts`

Reglas: mostrar cambios > 15%; comparar antes/después; permitir marcar como revisado.

---

### 27.6. Admin actualiza tipo de cambio manualmente

**POST** `/api/v1/admin/exchange-rates`

Body:

```json
{
  "date": "YYYY-MM-DD",
  "ars_per_usd": "string",
  "source": "monedapi_ar|manual",
  "reason": "string"
}
```

Reglas: motivo obligatorio; no modificar snapshots ya emitidos; auditar.

---

### 27.7. Admin busca propuestas del familiar *(nuevo)*

**GET** `/api/v1/admin/family-proposals`

Filtros: estado, familiar, estudiante, residencia, fecha.

---

### 27.8. Admin ve negociaciones activas *(nuevo)*

**GET** `/api/v1/admin/negotiation-proposals`

Filtros: estado, residencia, solicitud, fecha de expiración.

Uso: detectar negociaciones vencidas sin respuesta, intervenir en solicitudes trabadas.

---

## 28. Tipo de cambio

### 28.1. Obtener tipo de cambio actual

**GET** `/api/v1/exchange-rates/current`

Roles: público; sistema; admin.

Response:

```json
{
  "ok": true,
  "data": {
    "date": "YYYY-MM-DD",
    "ars_per_usd": "string",
    "source": "monedapi.ar",
    "rate_type": "blue_sell",
    "is_manual_override": false,
    "updated_at": "ISO_DATE",
    "modal_text": "El valor en pesos es referencial, calculado en base al dólar blue (valor venta) del día de hoy. El valor final en pesos será determinado en el momento en que realices el pago directamente a la residencia."
  }
}
```

---

### 28.2. Job de actualización diaria

**JOB** `sync_daily_exchange_rate`

Frecuencia: diaria.

Reglas: fuente: monedapi.ar (blue, venta); si falla, alertar admin; no bloquear app si ya existe valor válido; guardar histórico; snapshots existentes no cambian.

---

## 29. Notificaciones

### 29.1. Actualizar preferencia de notificación

**PATCH** `/api/v1/notification-preferences`

Roles: usuario autenticado.

Reglas: al menos un canal obligatorio; email como respaldo recomendado.

---

### 29.2. Eventos de notificación obligatorios *(actualizado)*

El sistema debe notificar:

- propuesta del familiar recibida (al estudiante);
- propuesta del familiar aprobada/rechazada/expirada (al familiar);
- solicitud enviada / recibida por residencia;
- recordatorio diario a residencia;
- contacto establecido;
- propuesta de ajuste enviada por residencia (al estudiante/familiar);
- propuesta de ajuste aceptada/rechazada (a la residencia);
- propuesta de ajuste expirada;
- 48h iniciadas / 24h restantes para pago a residencia;
- solicitud vencida (con opción de actualizar parámetros);
- pago a residencia reportado;
- fee pendiente / fallido / expirado / pagado;
- factura emitida;
- reserva confirmada / comprobante emitido;
- renovación ofrecida / aceptada / confirmada;
- lista de espera con disponibilidad / recordatorio 90 días;
- caso de soporte abierto / actualizado;
- cambios críticos de estado.

### 29.1. Push web (DR61)

Todas son server actions con `getSafeUser`, validación de entrada y rate limit; ninguna confía en el `user_id` del cliente.

| Acción | Efecto |
|---|---|
| `subscribePush(subscription)` | Valida `endpoint` (https, proveedor conocido, longitud) y claves; inserta o reactiva la suscripción del usuario; rechaza si ya tiene 10 activas. Responde sin eco de claves. |
| `unsubscribePush(endpoint)` | Revoca solo una suscripción del usuario autenticado (`revoked_at`). |
| `setPushPreference(category, enabled)` | Upsert de la fila del usuario; rechaza categorías `admin_*` si no es admin. |
| `getPushState()` | Devuelve dispositivo suscripto sí/no, preferencias y si el push está disponible (claves VAPID presentes). |

**Envío.** `createNotification` recibe `category` (opcional, por defecto `none`). Si la categoría es elegible, el usuario tiene una suscripción activa y la preferencia está activa: entre las 9:00 y las 23:59 (Argentina) envía con `web-push`; entre las 0:00 y las 8:59 deja `push_status = 'queued'`. El payload es genérico (DR61 punto 4). 404/410 revocan la suscripción. El job horario `/api/cron/expire-stale-records` envía lo `queued` desde las 9:00. `notifyAdmins` pasa la categoría `admin_requests` o `admin_signups`.

---

## 30. Auditoría

### 30.1. Crear audit log

**Internal Action** `writeAuditLog`

```json
{
  "actor_user_id": "uuid|null",
  "actor_role": "string",
  "action": "string",
  "entity_type": "string",
  "entity_id": "uuid",
  "before": {},
  "after": {},
  "reason": "string|null",
  "source": "user|admin|system|payment_provider",
  "request_id": "string|null"
}
```

Reglas: no borrar; no guardar archivos completos; guardar referencias y diffs seguros; admin siempre requiere motivo.

---

## 31. Jobs automáticos del MVP

| Job | Frecuencia | Propósito |
|---|---|---|
| `sync_daily_exchange_rate` | Diario | Actualizar tipo de cambio desde monedapi.ar |
| `expire_family_proposals` | Cada hora | Vencer propuestas del familiar sin respuesta en 48h |
| `expire_negotiation_proposals` | Cada hora | Vencer propuestas de ajuste sin respuesta en 48h |
| `expire_application_requests` | Cada hora | Vencer solicitudes sin avance |
| `retry_failed_fee_payments` | Cada hora | Reintentar cobros fallidos (máx. 3 en 48h) |
| `expire_estured_fee_windows` | Cada hora | Vencer fees sin pago: fee → `expired`, reserva → `expired_fee_unpaid` |
| `check_stale_availability` | Diario | Marcar disponibilidad vencida, ocultar de búsquedas si 15+ días |
| `dispatch_notifications` | Cola continua | Enviar notificaciones pendientes |
| `send_waitlist_90_day_confirmation` | Diario | Notificar lista de espera a los 90 días |
| `recalculate_residence_visibility_scores` | Diario | Recalcular scores y penalizaciones |
| `check_verification_expirations` | Diario | Notificar y vencer verificaciones anuales |
| `generate_pending_receipts` | Cada hora | Reintentar generación de comprobantes fallidos |
| `emit_pending_fiscal_invoices` | Cada hora | Reintentar emisión de Facturas C fallidas |
| `cleanup_orphan_uploads` | Semanal | Limpiar archivos sin entidad asociada |

---

## 32. Orden recomendado de implementación

### Fase 0 — Base técnica
Auth, roles, RLS inicial, audit log, storage privado, exchange rate (monedapi.ar), catálogos/enums.

### Fase 1 — Residencias y búsqueda
Crear residencia, perfil, verificación, búsqueda, detalle, disponibilidad por tipo.

### Fase 2 — Solicitudes y negociación
Perfil estudiante, familiar vinculado, propuestas del familiar, crear solicitud, dashboard residencia, establecer contacto (WhatsApp pre-formateado), propuesta de ajuste de condiciones, rechazar, pausar/reactivar, botón "Actualizar con mismos parámetros".

### Fase 3 — Reserva, fee, comprobante y facturación
Pago a residencia reportado, fee (MercadoPago + PayU), webhooks, pago manual, confirmar reserva, generar comprobante (PDF + QR), URL `/verify/[codigo]`, Factura C (TusFacturas.app).

### Fase 4 — Gestión operativa (freemium)
Habitaciones, plazas, residentes, comunidad visible, lista de espera, feature flags de plan.

### Fase 5 — Renovaciones y FAQ
Solicitud de renovación, oferta formal, aceptación, pago, fee, comprobante de renovación, FAQ (listado predefinido + respuestas + archivos).

### Fase 6 — Admin, métricas, soporte y hardening
Admin panel completo, métricas, alertas tarifarias, penalización/visibilidad, soporte/resolución de conflictos, QA, pruebas con residencias pioneras.

---

## 33. Casos borde obligatorios para QA *(actualizado)*

1. Familiar crea propuesta → estudiante aprueba → solicitud creada con `initiated_by = family_member` y `contact_target = family_member`.
2. Familiar crea propuesta → estudiante rechaza → propuesta cerrada, familiar notificado, no hay solicitud.
3. Propuesta del familiar expira en 48h → estado `expired`, familiar notificado.
4. Estudiante intenta crear tercera solicitud activa → bloqueado.
5. Residencia establece contacto → botón WhatsApp usa número del familiar si `contact_target = family_member`.
6. Residencia envía propuesta de ajuste → estudiante ve comparación original vs. propuesta.
7. Residencia intenta enviar segunda propuesta → bloqueado por `proposal_count = 1`.
8. Estudiante acepta propuesta → `snapshot_final` actualizado, fee recalculado sobre nuevos valores.
9. Estudiante rechaza propuesta y elige condiciones originales → `snapshot_final = snapshot_original`.
10. Propuesta de ajuste expira sin respuesta → `expired_offer_no_response`.
11. Solicitud vence → estudiante ve botón "Actualizar con mismos parámetros" → respuesta incluye tarifa y cotización actualizadas.
12. Residencia no verificada intenta publicar → bloqueado.
13. Fee cobrado con PayU en USD → registra `fee_amount_usd`, convierte desde snapshot_final.
14. Webhook duplicado de pago → `idempotency_key` previene cobro doble.
15. Fee pagado → Factura C emitida automáticamente en TusFacturas.app.
16. Fee pagado → PDF falla → reserva `confirmed`, receipt en `generation_failed`, admin puede reemitir.
17. URL `/verify/[codigo]` muestra datos mínimos, no datos sensibles.
18. Tipo de cambio sube → snapshot existente no cambia.
19. Residencia sin acceso a GO intenta crear habitación → `OPERATIONAL_MANAGEMENT_NOT_ENABLED`.
20. Admin otorga acceso GO a residencia pionera → auditado con motivo.
21. Lista de espera → no vence a los 90 días, solo notifica.
22. Reserva confirmada → sale de listas de espera y cierra otras solicitudes.
23. Bot/FAQ preguntado sobre disponibilidad → responde solo con datos cargados; no inventa.
24. Admin accede a documento sensible → debe ingresar justificación → audit log generado.
25. Admin interviene solicitud → motivo obligatorio → auditado antes/después.
26. Estudiante menor crea solicitud → `contact_target = family_member`; botón WhatsApp usa el teléfono del familiar.
27. Revocación dentro de los 10 días → reserva cancelada (`student_revocation_right`), comprobante `voided`, fee sigue `paid`, `support_case` abierto.
28. Revocación fuera de plazo → `REVOCATION_WINDOW_EXPIRED`.
29. Chargeback → fee `chargeback`, alerta admin, reserva y comprobante sin cambios automáticos.
30. Fee sin ningún intento de pago en 48h → job `expire_estured_fee_windows` pasa la reserva a `expired_fee_unpaid`.
31. Solicitud en Perfil Verificado entra en cola por tipo de habitación (sin `place_id`).

---

## 34. Instrucciones explícitas para Claude Code

1. Leer este archivo junto con `04_STATE_MACHINES.md` y `06_DATA_MODEL.md` antes de implementar endpoints.
2. No inventar nuevas transiciones de estado sin actualizar `04_STATE_MACHINES.md`.
3. No fusionar solicitud, reserva, pago y comprobante.
4. No permitir cambios directos de estados críticos desde el cliente.
5. Implementar validaciones server-side aunque existan validaciones UI.
6. Escribir auditoría en toda acción crítica.
7. Usar DTOs seguros, no filas completas de tablas sensibles.
8. Respetar multi-tenant por residencia (`residence_users`).
9. Respetar visibilidad de datos de estudiantes.
10. No exponer datos sensibles por error.
11. Usar abstracción `PaymentProvider` para MercadoPago y PayU; no hardcodear.
12. Usar abstracción `ExchangeRateProvider` para monedapi.ar; no hardcodear.
13. Implementar idempotencia en pagos, comprobantes y webhooks (`idempotency_key`).
14. El fee siempre se calcula sobre `snapshot_final`, no sobre `snapshot_original` si hubo ajuste aceptado.
15. El botón WhatsApp usa el número del `contact_target` de la solicitud (estudiante o familiar).
16. Solo la residencia puede enviar propuestas de ajuste; máximo 1 por solicitud.
17. Las propuestas del familiar nunca van directamente a la residencia; requieren aprobación del estudiante.
18. La URL `/verify/[codigo]` es pública y no expone datos sensibles.
19. TusFacturas.app se invoca automáticamente cuando el fee es pagado; nunca antes.
20. Priorizar opciones técnicas gratuitas o económicas para jobs y notificaciones.

---

## 35. Pendientes resueltos y no bloqueantes

**Resueltos:**
- ~~Proveedor de pagos~~ → MercadoPago + PayU Argentina.
- ~~Fuente de tipo de cambio~~ → monedapi.ar (blue, venta).
- ~~Facturación fiscal~~ → TusFacturas.app, Factura C.
- ~~WhatsApp~~ → botón pre-formateado, sin API.

**No bloqueantes:**
- Textos legales finales de aceptación.
- Diseño exacto del comprobante PDF.
- Estructura final de templates de email.
- RLS/policies concretas en SQL.
- Límites de rate limiting por endpoint.
- Reglas fiscales para pagadores extranjeros.

---

## 36. Resumen operativo

El backend del MVP debe permitir que EstuRed opere este loop sin ambigüedad:

**Estudiante (o familiar con aprobación del estudiante) busca residencia verificada → envía solicitud → residencia establece contacto → [negociación opcional: residencia propone ajuste, estudiante acepta] → estudiante paga a residencia → residencia marca pago recibido → EstuRed cobra fee (ARS o USD) → Factura C emitida automáticamente → reserva confirmada → comprobante PDF con QR emitido → futuras renovaciones gestionadas dentro de EstuRed.**

Todo endpoint, acción, estado, permiso y validación debe proteger ese loop.
