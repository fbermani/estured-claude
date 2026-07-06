# 06_DATA_MODEL.md
# EstuRed — Modelo de datos del MVP

**Versión:** 0.2
**Estado:** Documento actualizado para construcción
**Última actualización:** 2026-06-27
**Depende de:** `00_DECISION_LOG.md`, `01_PRODUCT_BRIEF.md`, `02_MVP_SCOPE.md`, `03_BUSINESS_RULES.md`, `04_STATE_MACHINES.md`, `05_ROLES_AND_PERMISSIONS.md`

---

## 1. Propósito del documento

Este documento define el modelo de datos base para construir el MVP de EstuRed.

Su objetivo es traducir las decisiones de producto, reglas de negocio, estados y permisos en entidades persistentes implementables en **Supabase/PostgreSQL**.

Debe usarse como referencia para:

- diseño de base de datos y migraciones;
- relaciones entre tablas;
- políticas de seguridad/RLS;
- endpoints o server actions;
- dashboards;
- auditoría;
- generación de comprobantes;
- pagos;
- QA funcional;
- instrucciones para Claude Code.

Este documento es una especificación funcional-relacional. Claude Code la convierte en schema técnico y migraciones SQL concretas.

---

## 2. Principios del modelo de datos

### 2.1. Separar identidad, perfil y rol

Un usuario autenticado no es automáticamente un estudiante, familiar, residencia o admin.

Debe existir separación entre: cuenta de autenticación, perfil público/privado, roles, permisos, y relaciones con residencias o estudiantes.

---

### 2.2. Separar solicitud, reserva, pago y comprobante

No deben modelarse como una sola entidad. El loop principal requiere separar:

- `family_application_proposals` = propuesta del familiar al estudiante (nueva);
- `application_requests` = solicitud enviada por estudiante a residencia;
- `application_negotiation_proposals` = propuesta de ajuste enviada por la residencia (nueva);
- `external_residence_payments` = pago realizado por estudiante a la residencia;
- `reservations` = reserva dentro de EstuRed;
- `estured_fee_payments` = pago del fee EstuRed;
- `booking_receipts` = comprobante emitido por EstuRed.

Una solicitud puede no convertirse en reserva. Una reserva puede estar pendiente de fee. Un fee puede fallar. Un comprobante puede fallar técnicamente. Cada cosa necesita estado propio.

---

### 2.3. Guardar snapshots de condiciones

Cuando el estudiante envía o aprueba una solicitud, el sistema guarda una copia congelada de las condiciones vistas (`snapshot_original`).

Si la residencia envía y el estudiante acepta una propuesta de ajuste, el sistema genera un `snapshot_final` con los valores acordados.

El fee **siempre** se calcula sobre `snapshot_final`.

El historial de condiciones (original + propuesta) debe conservarse para transparencia y resolución de conflictos.

---

### 2.4. Todo evento crítico debe auditarse

Cualquier acción que afecte solicitudes, pagos, reservas, disponibilidad, tarifas, verificación, perfiles, documentos, visibilidad, negociación o resolución de conflictos debe generar un registro en `audit_logs`.

---

### 2.5. No exponer datos sensibles por defecto

Nunca deben ser públicos: apellido completo, email, teléfono, fecha de nacimiento, universidad/institución exacta, documentos, comprobantes, datos de pago, identificadores fiscales, notas internas, casos de soporte.

---

### 2.6. Multi-tenant por residencia

Cada residencia funciona como un tenant operativo. Un usuario solo puede acceder a datos de las residencias donde tenga vínculo activo en `residence_users`.

Un owner puede gestionar hasta 10 residencias. El staff puede acceder a múltiples residencias del mismo owner si el owner lo habilita.

---

### 2.7. Estados mediante enums y transiciones controladas

Los estados definidos en `04_STATE_MACHINES.md` deben implementarse con enums o constraints equivalentes.

Los clientes no deben actualizar estados críticos directamente. Las transiciones pasan por server actions que validan permisos, estado anterior, reglas de negocio, generan eventos, notificaciones y auditoría.

---

### 2.8. Modelo freemium por residencia

El acceso a Gestión Operativa se controla mediante feature flags por residencia.

Las residencias pioneras tienen acceso gratuito durante 1 año. El sistema debe soportar otorgar, revocar y extender acceso sin cambiar el rol de la residencia.

---

## 3. Convenciones generales

### 3.1. Naming

Inglés técnico, `snake_case`, plural para tablas. Ejemplos: `student_profiles`, `residences`, `application_requests`, `booking_receipts`, `audit_logs`.

---

### 3.2. Campos estándar

Casi todas las tablas incluyen:

- `id uuid primary key`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `created_by uuid null`
- `updated_by uuid null`

Tablas con soft delete incluyen además: `deleted_at timestamptz null`, `deleted_by uuid null`.

Tablas de eventos/auditoría no deben editarse ni borrarse en condiciones normales.

---

### 3.3. Dinero y monedas

No usar `float` para montos.

Campos:
- `currency_code text` con valores `ARS` o `USD`;
- `amount_ars numeric(14,2)`;
- `amount_usd numeric(14,2)`;
- `exchange_rate_ars_per_usd numeric(14,6)`.

Reglas:
- tarifas en USD terminan en 0 o 5;
- tarifas en ARS terminan en 500 o 000;
- fee EstuRed en ARS se redondea al múltiplo de 500 más cercano; en empate exacto, hacia arriba;
- el fee puede cobrarse en ARS (MercadoPago) o USD (PayU);
- cada solicitud guarda snapshot del tipo de cambio (fuente: monedapi.ar, blue venta); el `snapshot_final` hereda la cotización del snapshot original.

---

### 3.4. Archivos

Los archivos se guardan en storage, no en la base. La base solo guarda metadata: bucket, path, filename, mime type, size, owner, visibility, document type, entidad relacionada, estado de revisión.

---

### 3.5. JSONB permitido con restricciones

`jsonb` se permite para: snapshots, metadata flexible, payloads de webhooks, historial de condiciones congeladas, evidencia estructurada.

No usar `jsonb` para reemplazar relaciones centrales como usuarios, residencias, habitaciones, solicitudes, reservas o pagos.

---

## 4. Enums principales

### 4.1. `user_role`
`guest`, `registered_user`, `student`, `family_member`, `residence_owner`, `residence_staff`, `admin`, `superadmin`, `system`

---

### 4.2. `residence_status`
`draft`, `pending_verification`, `verification_scheduled`, `verified_active`, `needs_changes`, `paused_by_residence`, `paused_by_admin`, `suspended`, `verification_expired`, `archived`

---

### 4.3. `residence_operating_mode`
`verified_profile`, `operational_management`

---

### 4.4. `family_proposal_status` *(nuevo)*
`draft`, `pending_student_approval`, `approved_by_student`, `rejected_by_student`, `expired`

---

### 4.5. `application_status`
`draft`, `submitted`, `queued_for_place`, `under_review`, `contact_established`, `offer_pending_student_acceptance`, `conditions_accepted`, `paused_due_to_other_active_request`, `residence_payment_pending`, `residence_payment_reported`, `converted_to_reservation`, `rejected`, `expired_no_residence_response`, `expired_no_student_payment`, `expired_offer_no_response`, `cancelled_by_student`, `cancelled_by_residence`, `closed_due_to_other_confirmed_reservation`, `disputed`

---

### 4.6. `external_residence_payment_status`
`not_required_yet`, `pending`, `student_reference_uploaded`, `reported_received_by_residence`, `expired`, `disputed`

---

### 4.7. `reservation_status`
`pending_estured_fee`, `estured_fee_processing`, `estured_fee_failed`, `expired_fee_unpaid`, `confirmed`, `receipt_pending`, `receipt_issued`, `cancelled_by_student`, `cancelled_by_residence`, `no_show`, `completed`, `disputed`

---

### 4.8. `estured_fee_status`
`not_required_yet`, `pending_payment_method`, `pending_manual_payment`, `pending_auto_charge`, `processing`, `paid`, `failed`, `expired`, `refunded`, `chargeback`

---

### 4.9. `receipt_status`
`not_available`, `pending_generation`, `issued`, `generation_failed`, `voided`, `reissued`

---

### 4.10. `profile_availability_status`
`available_to_confirm`, `full`, `not_updated`, `paused_by_residence`, `paused_by_admin`

---

### 4.11. `place_status`
`available`, `in_contact`, `temporarily_held`, `reserved`, `occupied`, `blocked`, `maintenance`, `unavailable`

---

### 4.12. `waitlist_status`
`active`, `availability_notification_sent`, `retention_check_sent`, `student_activated_request`, `removed_by_student`, `removed_due_to_confirmed_reservation`, `removed_by_residence`, `removed_by_admin`, `closed_by_residence`

---

### 4.13. `renewal_request_status` *(separado de renewal_offer)*
`created_by_student`, `notified_to_residence`, `offer_received`, `closed_no_offer`, `superseded_by_offer`

---

### 4.14. `renewal_offer_status` *(separado de renewal_request)*
`draft`, `sent`, `viewed`, `accepted_by_student`, `rejected_by_student`, `expired`, `expired_no_student_payment`, `residence_payment_pending`, `residence_payment_reported`, `estured_fee_pending`, `estured_fee_processing`, `confirmed`, `receipt_pending`, `receipt_issued`, `cancelled_by_residence`, `cancelled_by_student`, `disputed`

---

### 4.15. `family_link_status`
`pending_student_approval`, `active`, `rejected_by_student`, `revoked_by_student`, `revoked_by_family`, `suspended_minor_no_family`

---

### 4.16. `support_case_status`
`opened`, `terms_reminder_shown`, `submitted`, `under_review`, `needs_more_info`, `waiting_other_party`, `in_progress`, `resolved_by_agreement`, `closed_no_action`, `closed_unresolved`, `admin_action_taken`

---

### 4.17. `residence_visibility_status`
`normal_visibility`, `warning`, `reduced_visibility`, `temporarily_paused`, `suspended`, `removed_from_network`

---

### 4.18. `document_status`
`uploaded`, `pending_review`, `approved`, `rejected`, `expired`, `archived`

---

### 4.19. `document_type`
`student_identity`, `student_academic_proof`, `student_family_authorization`, `student_payment_proof_to_residence`, `family_identity`, `residence_responsible_identity`, `residence_coordinator_identity`, `residence_signed_checklist`, `residence_terms_acceptance`, `residence_payment_receipt`, `estured_fee_fiscal_receipt`, `other`

---

### 4.20. `payment_provider` *(nuevo)*
`mercado_pago`, `payu_argentina`, `manual`, `other`

---

### 4.21. `fiscal_invoice_status` *(nuevo)*
`not_required`, `pending_issue`, `issued`, `issue_failed`, `voided`, `reissued`

---

## 5. Núcleo de usuarios e identidad

### 5.1. `users`

Representa la identidad de aplicación vinculada a `auth.users` de Supabase.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | Igual o vinculado a `auth.users.id` |
| `email` | text | Email principal, privado |
| `phone` | text null | Teléfono, privado |
| `primary_role` | user_role | Rol principal actual |
| `is_active` | boolean | Cuenta activa |
| `is_blocked` | boolean | Bloqueo por admin |
| `blocked_reason` | text null | Motivo interno |
| `last_login_at` | timestamptz null | Último acceso |
| `preferred_notification_channel` | text | `email`, `in_app` |
| `created_at` | timestamptz | Alta |
| `updated_at` | timestamptz | Actualización |

Reglas:
- todo usuario registrado debe tener un registro en `users`;
- email y teléfono nunca son públicos;
- **el teléfono del destinatario del contacto es obligatorio para enviar o aprobar una solicitud**: si `contact_target = student`, `users.phone` del estudiante debe estar completo; si `contact_target = family_member` (incluye siempre a estudiantes menores), `family_members.phone` debe estar completo;
- bloqueo de usuario debe auditarse.

**Nota de alcance:** no existe una tabla `admin_users` separada — los roles `admin`/`superadmin` se asignan vía `user_roles`. Tampoco existe una tabla `notification_preferences` en el MVP — la preferencia vive en `users.preferred_notification_channel`. (Referencias a esas tablas en `11`/`12` deben leerse con esta aclaración.)

---

### 5.2. `user_roles`

Permite múltiples roles por usuario.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `user_id` | uuid | FK a `users.id` |
| `role` | user_role | Rol asignado |
| `scope_type` | text null | `global`, `residence`, `student` |
| `scope_id` | uuid null | ID del contexto |
| `is_active` | boolean | Rol activo |
| `granted_by` | uuid null | Quién otorgó el rol |
| `created_at` | timestamptz | Alta |

---

### 5.3. `consents`

Registra aceptaciones explícitas de términos, privacidad, visibilidad y responsabilidades.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `user_id` | uuid | Usuario que acepta |
| `consent_type` | text | `terms`, `privacy`, `student_visibility`, `family_payment`, `residence_responsibility`, `mark_payment_received`, `minor_family_terms`, etc. |
| `version` | text | Versión del texto aceptado |
| `accepted_at` | timestamptz | Fecha de aceptación |
| `ip_address` | inet null | IP si aplica |
| `user_agent` | text null | Navegador/dispositivo |
| `related_entity_type` | text null | Entidad asociada |
| `related_entity_id` | uuid null | ID entidad asociada |
| `metadata` | jsonb | Payload adicional |

Reglas:
- cada aceptación crítica debe quedar versionada;
- "Pago recibido" requiere aceptación explícita (`mark_payment_received`);
- menores requieren aceptación del familiar vinculado cuando aplique.

---

## 6. Estudiantes y familiares

### 6.1. `student_profiles`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `user_id` | uuid | FK a `users.id` |
| `first_name` | text | Nombre |
| `last_name` | text | Apellido completo, privado |
| `last_initial` | text | Inicial visible |
| `birth_date` | date | Fecha de nacimiento, privada |
| `display_age` | integer | Edad calculada o cacheada |
| `nationality` | text | Nacionalidad |
| `country_flag` | text null | Código/emoji bandera |
| `origin_city` | text | Ciudad de origen |
| `origin_country` | text null | País de origen |
| `career` | text | Carrera visible si el usuario lo permite |
| `study_institution_private` | text | Dónde va a estudiar, privado |
| `academic_objective` | text | Objetivo académico declarado, obligatorio para comprobante |
| `bio` | text null | Breve descripción |
| `habits` | jsonb | Hábitos según configuración |
| `interests` | jsonb | Intereses |
| `photo_file_id` | uuid null | FK a `files` |
| `avatar_type` | text | `photo`, `flag`, `initials` |
| `is_minor` | boolean | Calculado según fecha |
| `profile_completed_at` | timestamptz null | Perfil completo |
| `created_at` | timestamptz | Alta |
| `updated_at` | timestamptz | Actualización |

Reglas:
- `first_name`, `last_name`, `birth_date`, `nationality`, `study_institution_private` son obligatorios para solicitar;
- apellido completo, fecha de nacimiento e institución exacta nunca son públicos;
- menores no pueden finalizar registro sin familiar vinculado activo;
- objetivo académico es obligatorio para emitir comprobante.

---

### 6.2. `student_visibility_settings`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `student_profile_id` | uuid | FK |
| `show_photo_to_guests` | boolean | Foto a invitados |
| `show_photo_to_registered` | boolean | Foto a registrados |
| `show_age_to_registered` | boolean | Edad visible |
| `show_nationality_to_registered` | boolean | Nacionalidad visible |
| `show_career_to_registered` | boolean | Carrera visible |
| `show_origin_city_to_registered` | boolean | Ciudad visible |
| `show_habits_to_registered` | boolean | Hábitos visibles |
| `show_interests_to_registered` | boolean | Intereses visibles |
| `is_individual_profile_visible` | boolean | Perfil individual visible |
| `updated_at` | timestamptz | Actualización |

---

### 6.3. `family_members`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `user_id` | uuid | FK a `users.id` |
| `first_name` | text | Nombre |
| `last_name` | text | Apellido |
| `relationship_type` | text | padre, madre, tutor, familiar |
| `identity_document_number` | text null | Privado |
| `phone` | text null | Privado, para contacto WhatsApp si es `contact_target` |
| `created_at` | timestamptz | Alta |
| `updated_at` | timestamptz | Actualización |

---

### 6.4. `family_links`

Relación entre estudiante y familiar.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `student_profile_id` | uuid | FK estudiante |
| `family_member_id` | uuid | FK familiar |
| `status` | family_link_status | Estado |
| `requested_by_user_id` | uuid | Quién inició |
| `approved_at` | timestamptz null | Aprobación estudiante |
| `revoked_at` | timestamptz null | Revocación |
| `permissions` | jsonb | Permisos específicos |
| `created_at` | timestamptz | Alta |
| `updated_at` | timestamptz | Actualización |

Permisos posibles en `permissions`:
- `can_view_dashboard`
- `can_add_favorites`
- `can_upload_documents`
- `can_upload_payment_proofs`
- `can_pay_estured_fee`
- `can_download_receipts`
- `can_create_proposals` *(nuevo — puede proponer solicitudes)*

Reglas:
- un estudiante puede tener solo 1 familiar activo (unique partial constraint: `status = 'active'` por `student_profile_id`);
- un familiar puede vincularse a más de un estudiante;
- menores requieren `family_links.status = active`;
- si el familiar se desvincula y el estudiante es menor sin otro familiar, el estado pasa a `suspended_minor_no_family` y se bloquean acciones sensibles.

---

## 7. Propuesta de solicitud del familiar *(tabla nueva)*

### 7.1. `family_application_proposals`

Propuesta que el familiar hace al estudiante para iniciar una solicitud. No es visible para la residencia.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `family_link_id` | uuid | FK al vínculo activo |
| `family_member_id` | uuid | FK familiar |
| `student_profile_id` | uuid | FK estudiante |
| `residence_id` | uuid | Residencia propuesta |
| `room_type_id` | uuid | Tipo de habitación |
| `desired_start_date` | date | Fecha de ingreso propuesta |
| `initial_duration_months` | integer | Duración propuesta |
| `status` | family_proposal_status | Estado |
| `message_to_student` | text null | Mensaje opcional del familiar al estudiante |
| `student_response_at` | timestamptz null | Fecha de respuesta del estudiante |
| `student_response_by_user_id` | uuid null | Usuario que respondió |
| `expires_at` | timestamptz | 48 horas desde creación |
| `converted_to_application_id` | uuid null | FK a `application_requests` si fue aprobada |
| `created_at` | timestamptz | Alta |
| `updated_at` | timestamptz | Actualización |

Reglas:
- el familiar crea la propuesta; no va a la residencia;
- el estudiante tiene 48 horas para aprobar o rechazar;
- si aprueba: se crea `application_requests` con `initiated_by = family_member`;
- si rechaza o expira: el familiar es notificado, no hay acción automática adicional;
- las propuestas en `pending_student_approval` no cuentan en el límite de 2 solicitudes activas del estudiante.

---

## 8. Residencias y operación

### 8.1. `residences`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `name` | text | Nombre comercial |
| `slug` | text unique | URL amigable |
| `description` | text | Descripción pública |
| `status` | residence_status | Estado |
| `operating_mode` | residence_operating_mode | Perfil Verificado o Gestión Operativa |
| `visibility_status` | residence_visibility_status | Visibilidad/penalización |
| `address_line` | text | Dirección privada/completa |
| `public_area` | text | Zona visible |
| `city` | text | CABA inicial |
| `province` | text | Buenos Aires/CABA |
| `country` | text | Argentina |
| `lat` | numeric null | Coordenada |
| `lng` | numeric null | Coordenada |
| `responsible_name` | text | Responsable principal, privado/admin |
| `responsible_contact` | text | Contacto privado/admin |
| `total_capacity` | integer | Capacidad total |
| `verification_expires_at` | timestamptz null | Vencimiento anual |
| `last_availability_update_at` | timestamptz null | Última actualización disponibilidad |
| `is_pioneer` | boolean | Residencia pionera beta |
| `pioneer_free_access_until` | date null | Hasta cuándo tiene acceso gratuito a GO |
| `has_operational_management_access` | boolean | Feature flag Gestión Operativa |
| `om_access_granted_by` | uuid null | Admin que otorgó acceso |
| `om_access_granted_at` | timestamptz null | Cuándo se otorgó |
| `created_at` | timestamptz | Alta |
| `updated_at` | timestamptz | Actualización |

Reglas:
- no publica si no está verificada;
- verificación presencial obligatoria y anual;
- `has_operational_management_access` controla el acceso a Gestión Operativa;
- pioneras tienen `pioneer_free_access_until` = 1 año desde su ingreso;
- cambio de `has_operational_management_access` queda auditado.

---

### 8.2. `residence_users`

Usuarios vinculados a una residencia (owner o staff).

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `residence_id` | uuid | FK residencia |
| `user_id` | uuid | FK usuario |
| `role` | text | `owner` o `staff` |
| `permissions` | jsonb | Permisos delegados por el owner |
| `invited_by` | uuid null | Owner/admin |
| `invitation_status` | text | `pending`, `accepted`, `revoked` |
| `is_active` | boolean | Activo |
| `created_at` | timestamptz | Alta |
| `updated_at` | timestamptz | Actualización |

Reglas:
- un owner puede tener hasta 10 residencias (`residence_users` con role=owner); el límite se valida server-side en el alta (y opcionalmente con trigger);
- un staff puede estar asignado a múltiples residencias del mismo owner;
- el staff solo ve datos de las residencias donde tiene `residence_users` activo;
- el contexto activo se valida server-side en cada request.

---

### 8.3. `residence_verifications`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `residence_id` | uuid | FK residencia |
| `status` | text | `not_started`, `documents_pending`, `visit_pending`, `visit_scheduled`, `under_review`, `approved`, `rejected`, `needs_changes`, `expired`, `revoked` |
| `scheduled_at` | timestamptz null | Visita programada |
| `visited_at` | timestamptz null | Visita realizada |
| `verified_by_user_id` | uuid | Admin/EstuRed |
| `responsible_identity_checked` | boolean | DNI responsable |
| `coordinator_identity_checked` | boolean | DNI coordinador si aplica |
| `address_checked` | boolean | Dirección comprobada |
| `photos_match_reality` | boolean | Similitud con fotos |
| `signed_checklist_file_id` | uuid null | Checklist firmado |
| `notes_internal` | text null | Notas internas |
| `approved_at` | timestamptz null | Aprobación |
| `expires_at` | timestamptz | Vencimiento anual |
| `created_at` | timestamptz | Alta |
| `updated_at` | timestamptz | Actualización |

---

### 8.4. `residence_profile_sections`

Información pública configurable del perfil (reglas, servicios, áreas comunes, FAQ).

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `residence_id` | uuid | FK residencia |
| `section_type` | text | `services`, `rules`, `common_areas`, `policies`, `host_note`, `faq` |
| `content` | jsonb | Datos estructurados |
| `is_public` | boolean | Visible |
| `requires_admin_review` | boolean | Si cambios requieren revisión |
| `created_at` | timestamptz | Alta |
| `updated_at` | timestamptz | Actualización |

---

### 8.5. `residence_profile_edits`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `residence_id` | uuid | FK |
| `field_group` | text | `photos`, `address`, `rules`, `services`, etc. |
| `old_value` | jsonb | Valor anterior |
| `new_value` | jsonb | Valor nuevo |
| `status` | text | `draft_update`, `pending_admin_review`, `approved`, `rejected`, `cancelled_by_residence` |
| `submitted_by` | uuid | Usuario residencia |
| `reviewed_by` | uuid null | Admin |
| `reviewed_at` | timestamptz null | Fecha revisión |
| `review_notes` | text null | Notas |
| `created_at` | timestamptz | Alta |
| `updated_at` | timestamptz | Actualización |

---

### 8.6. `tariff_change_logs`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `residence_id` | uuid | FK |
| `room_type_id` | uuid null | Tipo asociado |
| `changed_by` | uuid | Usuario residencia/admin |
| `field_name` | text | `monthly_price`, `enrollment_fee`, `deposit`, `adjustment_policy` |
| `old_value` | numeric | Valor anterior |
| `new_value` | numeric | Valor nuevo |
| `currency_code` | text | ARS/USD |
| `variation_percent` | numeric | Variación calculada |
| `alert_triggered` | boolean | Si supera 15% |
| `admin_review_status` | text null | `new`, `reviewed`, `ignored`, `flagged` |
| `created_at` | timestamptz | Fecha |

---

## 9. Habitaciones, plazas y disponibilidad

### 9.1. `room_types`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `residence_id` | uuid | FK residencia |
| `name` | text | Individual, doble, triple, etc. |
| `description` | text null | Descripción |
| `capacity_per_room` | integer | Capacidad típica |
| `monthly_price_usd` | numeric(14,2) | Tarifa USD |
| `monthly_price_ars` | numeric(14,2) | Tarifa ARS calculada/publicada |
| `enrollment_fee_usd` | numeric(14,2) | Matrícula/cargo ingreso USD |
| `enrollment_fee_ars` | numeric(14,2) | Matrícula/cargo ingreso ARS |
| `deposit_usd` | numeric(14,2) | Depósito reembolsable USD |
| `deposit_ars` | numeric(14,2) | Depósito reembolsable ARS |
| `deposit_is_refundable` | boolean | Debe ser true si se excluye del fee |
| `reservation_payment_concept` | text | seña, matrícula, depósito, reserva |
| `reservation_payment_amount_usd` | numeric | Monto requerido para reservar USD |
| `reservation_payment_amount_ars` | numeric | Monto requerido ARS |
| `adjustment_policy` | text | `monthly`, `quarterly`, `semiannual`, `annual`, `none` |
| `is_active` | boolean | Activo |
| `created_at` | timestamptz | Alta |
| `updated_at` | timestamptz | Actualización |

Reglas:
- tarifas USD terminan en 0 o 5; tarifas ARS terminan en 500 o 000;
- matrícula entra en base fee; depósito reembolsable no entra;
- monto de reserva no puede cambiarse caso por caso en solicitud activa (solo via propuesta de ajuste formal).

---

### 9.2. `rooms`

Habitaciones reales para Gestión Operativa.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `residence_id` | uuid | FK residencia |
| `room_type_id` | uuid | FK tipo |
| `name` | text | Ej: Habitación 101 |
| `floor` | text null | Piso |
| `capacity` | integer | Capacidad |
| `status` | text | `active`, `blocked`, `maintenance`, `inactive` |
| `notes_internal` | text null | Notas internas |
| `created_at` | timestamptz | Alta |
| `updated_at` | timestamptz | Actualización |

---

### 9.3. `places`

Plazas/camas operativas.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `residence_id` | uuid | FK residencia |
| `room_id` | uuid | FK habitación |
| `room_type_id` | uuid | FK tipo |
| `label` | text | Cama A, Plaza 1, etc. |
| `status` | place_status | Estado |
| `current_student_profile_id` | uuid null | Si está ocupada |
| `reserved_by_reservation_id` | uuid null | Reserva asociada |
| `available_from` | date null | Disponible desde |
| `blocked_reason` | text null | Motivo bloqueo |
| `created_at` | timestamptz | Alta |
| `updated_at` | timestamptz | Actualización |

---

### 9.4. `profile_availability`

Disponibilidad semi-real para Modo Perfil Verificado.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `residence_id` | uuid | FK residencia |
| `room_type_id` | uuid | FK tipo |
| `status` | profile_availability_status | Estado |
| `available_count` | integer null | Cantidad declarada |
| `available_from` | date null | Fecha estimada |
| `last_confirmed_by` | uuid | Usuario residencia |
| `last_confirmed_at` | timestamptz | Fecha actualización |
| `expires_at` | timestamptz | 30 días después si no se actualiza |
| `hidden_from_search_at` | timestamptz null | Cuándo dejó de aparecer en búsquedas (15 días de not_updated) |
| `notes_public` | text null | Nota pública |
| `notes_internal` | text null | Nota interna |
| `created_at` | timestamptz | Alta |
| `updated_at` | timestamptz | Actualización |

Reglas:
- si `not_updated` por más de 30 días: recordatorios;
- si `not_updated` persiste más de 15 días: `hidden_from_search_at` se registra y la residencia desaparece de búsquedas activas.

---

### 9.5. `place_application_queue`

Cola de solicitudes por plaza (Gestión Operativa) **o por tipo de habitación (Perfil Verificado)**.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `residence_id` | uuid | FK residencia |
| `place_id` | uuid null | FK plaza (Gestión Operativa) |
| `room_type_id` | uuid null | FK tipo de habitación (Perfil Verificado) |
| `application_request_id` | uuid | FK solicitud |
| `queue_position` | integer | Posición |
| `is_visible_to_residence` | boolean | Máximo 3 visibles |
| `is_active_candidate` | boolean | Si es la solicitud que avanza |
| `entered_at` | timestamptz | Entrada |
| `removed_at` | timestamptz null | Salida |
| `removed_reason` | text null | Motivo |

Reglas:
- constraint CHECK: **exactamente uno** de `place_id` o `room_type_id` debe ser no nulo;
- en Gestión Operativa la cola se gestiona por `place_id`; en Perfil Verificado, por `room_type_id`;
- máximo 3 visibles + 2 en cola por plaza o tipo (validación server-side).

---

## 10. Búsqueda, favoritos y lista de espera

### 10.1. `favorites`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `student_profile_id` | uuid | Estudiante asociado |
| `created_by_user_id` | uuid | Estudiante o familiar |
| `residence_id` | uuid | Residencia |
| `notes` | text null | Nota privada |
| `created_at` | timestamptz | Alta |

---

### 10.2. `waitlist_entries`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `student_profile_id` | uuid | Estudiante |
| `residence_id` | uuid | Residencia |
| `room_type_id` | uuid null | Tipo deseado |
| `desired_start_date` | date null | Fecha deseada |
| `desired_duration_months` | integer null | Duración deseada |
| `status` | waitlist_status | Estado |
| `joined_at` | timestamptz | Alta |
| `last_keep_alive_notified_at` | timestamptz null | Notificación 90 días |
| `removed_at` | timestamptz null | Remoción |
| `removed_by` | uuid null | Quién removió |
| `removed_reason` | text null | Motivo |
| `created_at` | timestamptz | Alta |
| `updated_at` | timestamptz | Actualización |

---

## 11. Solicitudes de reserva

### 11.1. `application_requests`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `student_profile_id` | uuid | Estudiante |
| `family_link_id` | uuid null | Familiar asociado si aplica |
| `initiated_by` | text | `student` o `family_member` *(nuevo)* |
| `contact_target` | text | `student` o `family_member` *(nuevo)* |
| `family_proposal_id` | uuid null | FK a `family_application_proposals` si fue aprobada *(nuevo)* |
| `residence_id` | uuid | Residencia |
| `room_type_id` | uuid | Tipo de habitación |
| `place_id` | uuid null | Plaza específica si Gestión Operativa |
| `status` | application_status | Estado |
| `desired_start_date` | date | Ingreso deseado |
| `initial_duration_months` | integer | Duración inicial reservada |
| `academic_objective` | text | Objetivo académico declarado |
| `snapshot_original_id` | uuid | FK `application_snapshots` — condiciones al enviar *(renombrado)* |
| `snapshot_final_id` | uuid null | FK `application_snapshots` — condiciones finales si hubo ajuste *(nuevo)* |
| `proposal_count` | integer | Número de propuestas de ajuste enviadas (máx. 1) *(nuevo)* |
| `active_request_group_id` | uuid null | Para controlar máximo 2 activas/pausas |
| `contact_established_at` | timestamptz null | Timestamp del botón WhatsApp presionado |
| `payment_deadline_at` | timestamptz null | 48h desde contact_established o desde propuesta aceptada |
| `rejection_reason_code` | text null | Enum de motivo de rechazo |
| `rejection_reason_internal` | text null | Motivo interno si `other` |
| `cancelled_reason` | text null | Motivo cancelación |
| `expires_at` | timestamptz null | 48h desde envío de solicitud *(actualizado)* |
| `created_by_user_id` | uuid | Estudiante/familiar autorizado |
| `created_at` | timestamptz | Enviada |
| `updated_at` | timestamptz | Actualización |

Reglas:
- máximo 2 solicitudes activas por estudiante;
- propuestas en `pending_student_approval` no cuentan;
- el snapshot_final = snapshot_original si no hubo propuesta de ajuste aceptada;
- el fee siempre se calcula sobre `snapshot_final`;
- `contact_target` determina el número de teléfono del botón WhatsApp; **si el estudiante es menor de edad, `contact_target = family_member` siempre**;
- `payment_deadline_at`: 48h desde `contact_established`; se reinicia al enviarse una propuesta de ajuste y nuevamente al aceptarse;
- `proposal_count` no puede superar 1 — el sistema bloquea un segundo intento.

---

### 11.2. `application_snapshots`

Snapshot congelado de condiciones. Se usa tanto para `snapshot_original` como para `snapshot_final`.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `application_request_id` | uuid | FK solicitud |
| `snapshot_type` | text | `original` o `final` *(nuevo)* |
| `residence_id` | uuid | Residencia |
| `room_type_id` | uuid | Tipo |
| `place_id` | uuid null | Plaza |
| `monthly_price_usd` | numeric | Precio mensual USD |
| `monthly_price_ars` | numeric | Precio mensual ARS referencial |
| `exchange_rate_ars_per_usd` | numeric | Tipo de cambio usado |
| `exchange_rate_source` | text | `monedapi.ar` *(decisión confirmada)* |
| `exchange_rate_date` | date | Fecha TC |
| `initial_duration_months` | integer | Duración inicial |
| `enrollment_fee_usd` | numeric | Matrícula USD |
| `enrollment_fee_ars` | numeric | Matrícula ARS |
| `deposit_usd` | numeric | Depósito USD |
| `deposit_ars` | numeric | Depósito ARS |
| `deposit_excluded_from_fee` | boolean | Debe ser true |
| `reservation_payment_amount_usd` | numeric | Pago a residencia USD |
| `reservation_payment_amount_ars` | numeric | Pago a residencia ARS |
| `adjustment_policy` | text | Política de ajustes |
| `fee_base_usd` | numeric | Base fee USD |
| `fee_base_ars` | numeric | Base fee ARS |
| `estimated_estured_fee_ars` | numeric | Fee calculado y redondeado |
| `main_rules_snapshot` | jsonb | Reglas principales |
| `reservation_conditions_snapshot` | jsonb | Condiciones |
| `services_snapshot` | jsonb | Servicios |
| `raw_snapshot` | jsonb | Copia flexible adicional |
| `created_at` | timestamptz | Fecha snapshot |

Reglas:
- `snapshot_original` se crea cuando el estudiante envía o aprueba la solicitud;
- `snapshot_final` se crea cuando el estudiante acepta una propuesta de ajuste, copiando los nuevos valores de condiciones y montos;
- **el `snapshot_final` hereda `exchange_rate_ars_per_usd`, `exchange_rate_source` y `exchange_rate_date` del `snapshot_original` — la negociación nunca actualiza la cotización**;
- si no hubo propuesta de ajuste, `snapshot_final_id = snapshot_original_id`;
- el fee siempre se calcula sobre el snapshot marcado como `final`.

---

### 11.3. `application_negotiation_proposals` *(tabla nueva)*

Propuesta de ajuste de condiciones enviada por la residencia al estudiante.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `application_request_id` | uuid | FK solicitud |
| `sent_by_user_id` | uuid | Usuario de la residencia |
| `residence_id` | uuid | FK residencia |
| `proposed_monthly_price_usd` | numeric null | Nueva tarifa USD si cambia |
| `proposed_monthly_price_ars` | numeric null | Nueva tarifa ARS |
| `proposed_enrollment_fee_usd` | numeric null | Nueva matrícula USD |
| `proposed_enrollment_fee_ars` | numeric null | Nueva matrícula ARS |
| `proposed_deposit_usd` | numeric null | Nuevo depósito USD |
| `proposed_deposit_ars` | numeric null | Nuevo depósito ARS |
| `proposed_room_type_id` | uuid null | Cambio de tipo de habitación |
| `proposed_place_id` | uuid null | Cambio de plaza |
| `proposed_start_date` | date null | Nuevo ingreso |
| `proposed_duration_months` | integer null | Nueva duración |
| `proposed_adjustment_policy` | text null | Nueva política de ajustes |
| `proposed_reservation_payment_amount_usd` | numeric null | Nuevo monto a pagar a residencia |
| `special_conditions` | text null | Condiciones especiales o descuento |
| `internal_notes` | text null | Notas internas de la residencia |
| `warning_shown_at` | timestamptz null | Cuando se mostró la advertencia de límite de 1 propuesta |
| `warning_accepted_at` | timestamptz null | Cuando el usuario de residencia aceptó la advertencia |
| `student_response` | text null | `accepted`, `rejected`, `chose_original` |
| `student_response_at` | timestamptz null | Fecha respuesta |
| `student_response_by_user_id` | uuid null | Usuario que respondió |
| `expires_at` | timestamptz | 48h desde envío (se reinicia el timer de la solicitud) |
| `created_at` | timestamptz | Alta |
| `updated_at` | timestamptz | Actualización |

Reglas:
- máximo 1 por `application_request_id` (constraint);
- solo la residencia puede crear esta propuesta;
- el estudiante solo puede responder `accepted`, `rejected` o `chose_original`;
- si `accepted`: se crea `snapshot_final` con los nuevos valores y el fee se recalcula;
- si `rejected` y `chose_original`: `snapshot_final = snapshot_original`;
- si `rejected` y el estudiante cierra: solicitud pasa a `cancelled_by_student`;
- si expira: solicitud pasa a `expired_offer_no_response`.

---

### 11.4. `application_status_events`

Historial de estados de solicitud.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `application_request_id` | uuid | FK solicitud |
| `from_status` | application_status null | Estado anterior |
| `to_status` | application_status | Estado nuevo |
| `changed_by_user_id` | uuid null | Usuario/sistema |
| `changed_by_role` | text | Rol |
| `reason_code` | text null | Motivo |
| `reason_text` | text null | Texto |
| `metadata` | jsonb | Datos adicionales |
| `created_at` | timestamptz | Fecha |

---

## 12. Pago a residencia

### 12.1. `external_residence_payments`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `application_request_id` | uuid | FK solicitud |
| `reservation_id` | uuid null | FK reserva si existe |
| `residence_id` | uuid | FK residencia |
| `student_profile_id` | uuid | FK estudiante |
| `status` | external_residence_payment_status | Estado |
| `amount_reported_usd` | numeric | Monto informado USD |
| `amount_reported_ars` | numeric | Monto informado ARS |
| `payment_concept` | text | matrícula, seña, depósito, reserva |
| `payment_method_to_residence` | text null | transferencia, efectivo, billetera |
| `student_proof_file_id` | uuid null | Comprobante cargado por estudiante |
| `residence_receipt_file_id` | uuid null | Recibo/comprobante cargado por residencia |
| `reported_received_by_user_id` | uuid null | Usuario residencia |
| `reported_received_at` | timestamptz null | Fecha pago recibido |
| `mark_received_consent_id` | uuid null | FK a `consents` — aceptación de términos al marcar *(nuevo)* |
| `dispute_reason` | text null | Motivo disputa |
| `created_at` | timestamptz | Alta |
| `updated_at` | timestamptz | Actualización |

Reglas:
- solo la residencia marca "Pago recibido" con confirmación explícita y aceptación de términos;
- la aceptación queda en `consents` vinculada a esta operación;
- el comprobante del estudiante no confirma la reserva.

---

## 13. Reservas, fee y comprobantes

### 13.1. `reservations`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `application_request_id` | uuid | FK solicitud |
| `student_profile_id` | uuid | FK estudiante |
| `family_link_id` | uuid null | Familiar si aplica |
| `residence_id` | uuid | FK residencia |
| `room_type_id` | uuid | Tipo habitación |
| `place_id` | uuid null | Plaza si aplica |
| `status` | reservation_status | Estado |
| `start_date` | date | Fecha ingreso |
| `initial_duration_months` | integer | Duración inicial |
| `academic_objective` | text | Objetivo académico |
| `snapshot_id` | uuid | FK `application_snapshots` — el `snapshot_final` *(aclarado)* |
| `external_residence_payment_id` | uuid | FK pago a residencia |
| `estured_fee_payment_id` | uuid null | FK fee |
| `booking_receipt_id` | uuid null | FK comprobante |
| `confirmed_at` | timestamptz null | Reserva confirmada |
| `cancelled_at` | timestamptz null | Cancelación |
| `cancellation_reason_code` | text null | Motivo codificado de cancelación (incluye `student_revocation_right` para revocaciones) |
| `no_show_at` | timestamptz null | No show |
| `completed_at` | timestamptz null | Cierre |
| `created_at` | timestamptz | Alta |
| `updated_at` | timestamptz | Actualización |

Reglas:
- sin fee paid no hay reserva confirmed;
- reservas confirmadas cierran otras solicitudes y eliminan al estudiante de otras listas de espera;
- si el fee vence sin pago, la reserva pasa a `expired_fee_unpaid` (nunca a `cancelled_by_student`);
- `snapshot_id` apunta al `snapshot_final` de la solicitud.

---

### 13.2. `estured_fee_payments`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `reservation_id` | uuid null | Reserva inicial |
| `renewal_offer_id` | uuid null | Renovación si aplica |
| `payer_user_id` | uuid | Estudiante o familiar |
| `beneficiary_student_profile_id` | uuid | Estudiante beneficiario |
| `status` | estured_fee_status | Estado |
| `fee_rate_percent` | numeric | 5.00 |
| `fee_base_usd` | numeric | Base USD (del snapshot_final) |
| `fee_base_ars` | numeric | Base ARS (del snapshot_final) |
| `fee_amount_ars` | numeric | Fee ARS redondeado a múltiplos de 500 |
| `fee_amount_usd` | numeric null | Fee USD si pagó en USD *(nuevo)* |
| `payment_currency` | text | `ARS` o `USD` *(nuevo)* |
| `payment_provider` | payment_provider | `mercado_pago`, `payu_argentina`, `manual`, `other` *(actualizado)* |
| `provider_payment_id` | text null | ID externo del proveedor |
| `provider_payload` | jsonb null | Payload webhook crudo |
| `idempotency_key` | text unique | Clave de idempotencia *(nuevo)* |
| `manual_payment_file_id` | uuid null | Comprobante manual |
| `attempt_count` | integer | Máximo 3 |
| `first_attempt_at` | timestamptz null | Primer intento |
| `last_attempt_at` | timestamptz null | Último intento |
| `paid_at` | timestamptz null | Pago aprobado |
| `expires_at` | timestamptz | 48h después de requerido |
| `refunded_at` | timestamptz null | Reembolso |
| `refund_reason` | text null | Motivo |
| `fiscal_invoice_status` | fiscal_invoice_status | Estado de la Factura C. Default `not_required` *(nuevo)* |
| `fiscal_invoice_id` | text null | ID de factura en TusFacturas.app *(nuevo)* |
| `fiscal_invoice_number` | text null | Número legible de la Factura C *(nuevo)* |
| `fiscal_invoice_issued_at` | timestamptz null | Fecha emisión Factura C *(nuevo)* |
| `fiscal_invoice_file_id` | uuid null | PDF de la Factura C *(nuevo)* |
| `fiscal_invoice_retry_count` | integer | Reintentos de emisión. Default 0 *(nuevo)* |
| `fiscal_invoice_last_error` | text null | Último error de emisión (visible admin) *(nuevo)* |
| `created_at` | timestamptz | Alta |
| `updated_at` | timestamptz | Actualización |

Reglas:
- constraint CHECK: **exactamente uno** de `reservation_id` o `renewal_offer_id` debe ser no nulo;
- fee = 5% del `snapshot_final` (no del original si hubo ajuste); el `snapshot_final` hereda la cotización del original;
- base: tarifa actual × duración + matrícula/cargos no reembolsables; excluye depósito;
- redondeo al múltiplo de 500 ARS más cercano; en empate exacto, hacia arriba;
- puede cobrarse en ARS (MercadoPago) o USD (PayU Argentina);
- si en USD: `fee_amount_usd` = `fee_amount_ars` / tipo_de_cambio_del_snapshot_final;
- `idempotency_key` previene cobros duplicados si el webhook llega múltiples veces;
- hasta 3 intentos dentro de 48h; si vence: fee `expired` (terminal) y reserva `expired_fee_unpaid`;
- un `chargeback` genera alerta admin; **no** modifica automáticamente la reserva ni el comprobante;
- al pagarse el fee, `fiscal_invoice_status` pasa a `pending_issue`; TusFacturas.app emite la Factura C → `issued`; si falla → `issue_failed` (la reserva permanece `confirmed` y se reintenta por job independiente, incrementando `fiscal_invoice_retry_count`).

---

### 13.3. `booking_receipts`

Comprobante de Reserva Confirmada.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `reservation_id` | uuid | FK reserva |
| `student_profile_id` | uuid | Estudiante |
| `payer_user_id` | uuid | Pagador del fee |
| `residence_id` | uuid | Residencia |
| `status` | receipt_status | Estado |
| `receipt_number` | text unique | Número legible único |
| `verification_code` | text unique | Código para URL `/verify/[codigo]` *(nuevo)* |
| `qr_code_value` | text | URL completa del `/verify/[verification_code]` *(actualizado)* |
| `pdf_file_id` | uuid null | Archivo PDF |
| `issued_at` | timestamptz null | Emisión |
| `voided_at` | timestamptz null | Anulación |
| `reissued_from_receipt_id` | uuid null | Reemisión |
| `receipt_payload` | jsonb | Datos congelados usados para PDF |
| `created_at` | timestamptz | Alta |
| `updated_at` | timestamptz | Actualización |

El campo `receipt_payload` debe incluir:
- ID de reserva, QR/código verificable, fecha de emisión;
- datos del estudiante, familiar/pagador si aplica;
- datos de residencia y responsable;
- tipo de habitación/plaza, fecha estimada de ingreso, duración inicial;
- objetivo académico declarado;
- condiciones finales aceptadas (del snapshot_final);
- monto abonado a residencia (informado por la residencia);
- fee EstuRed pagado, moneda y tipo de cambio usado;
- política de ajustes futuros;
- disclaimer legal, contacto de soporte EstuRed.

Reglas:
- `verification_code` es la clave pública para verificar autenticidad;
- la URL `/verify/[verification_code]` es pública y muestra datos mínimos (estado, nombre con inicial, residencia, fecha, duración) sin exponer datos sensibles;
- el comprobante se emite a nombre del estudiante; el pagador puede figurar como pagador;
- EstuRed no garantiza pagos futuros, conducta de partes ni prestación directa.

---

## 14. Renovaciones

### 14.1. `renewal_requests`

Solicitud informal del estudiante pidiendo renovar (no vinculante).

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `reservation_id` | uuid | Reserva/estadía |
| `student_profile_id` | uuid | Estudiante |
| `residence_id` | uuid | Residencia |
| `message` | text null | Mensaje |
| `desired_duration_months` | integer null | Duración deseada |
| `status` | renewal_request_status | Estado |
| `created_at` | timestamptz | Alta |
| `updated_at` | timestamptz | Actualización |

---

### 14.2. `renewal_offers`

Oferta formal de renovación emitida por residencia.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `reservation_id` | uuid | Reserva original |
| `renewal_request_id` | uuid null | FK si hubo solicitud previa del estudiante |
| `student_profile_id` | uuid | Estudiante |
| `residence_id` | uuid | Residencia |
| `place_id` | uuid null | Plaza |
| `status` | renewal_offer_status | Estado |
| `period_start_date` | date | Inicio renovación |
| `period_end_date` | date | Fin renovación |
| `duration_months` | integer | Duración |
| `monthly_price_usd` | numeric | Tarifa actual USD |
| `monthly_price_ars` | numeric | Tarifa actual ARS |
| `enrollment_or_renewal_fee_usd` | numeric | Cargo no reembolsable si aplica |
| `enrollment_or_renewal_fee_ars` | numeric | ARS |
| `deposit_usd` | numeric | Depósito si aplica |
| `deposit_ars` | numeric | ARS |
| `adjustment_policy` | text | Política ajustes |
| `fee_base_usd` | numeric | Base fee USD |
| `fee_base_ars` | numeric | Base fee ARS |
| `estimated_estured_fee_ars` | numeric | Fee estimado |
| `acceptance_deadline_at` | timestamptz | Fecha límite |
| `sent_by_user_id` | uuid | Usuario residencia |
| `accepted_at` | timestamptz null | Aceptación estudiante |
| `external_residence_payment_id` | uuid null | Pago residencia |
| `estured_fee_payment_id` | uuid null | Fee renovación |
| `renewal_receipt_id` | uuid null | Comprobante renovación |
| `created_at` | timestamptz | Alta |
| `updated_at` | timestamptz | Actualización |

Reglas:
- fee de renovación = misma lógica que reserva inicial: 5% sobre tarifa × duración + cargo no reembolsable si aplica, excluyendo depósito;
- no hay excepciones para simplificar el código;
- comprobante se llama "Comprobante de Renovación Confirmada";
- **al confirmarse la renovación, el sistema extiende `resident_stays.end_date` al fin del período renovado y la plaza mantiene su estado de ocupación** — la renovación no crea una `reservation` nueva.

---

### 14.3. `renewal_receipts`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `renewal_offer_id` | uuid | FK renovación |
| `status` | receipt_status | Estado |
| `receipt_number` | text unique | Número único |
| `verification_code` | text unique | Para URL `/verify/[codigo]` |
| `qr_code_value` | text | URL completa |
| `pdf_file_id` | uuid null | PDF |
| `receipt_payload` | jsonb | Datos congelados |
| `issued_at` | timestamptz null | Fecha |
| `created_at` | timestamptz | Alta |
| `updated_at` | timestamptz | Actualización |

---

## 15. Residentes y comunidad visible

### 15.1. `resident_stays`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `student_profile_id` | uuid null | Estudiante si activó cuenta |
| `residence_id` | uuid | Residencia |
| `room_id` | uuid null | Habitación |
| `place_id` | uuid null | Plaza |
| `reservation_id` | uuid null | Reserva EstuRed si existe |
| `created_by_residence_user_id` | uuid null | Si residencia cargó residente |
| `invite_email` | text null | Email para activar cuenta |
| `status` | text | `created_by_residence`, `pending_activation`, `active`, `visibility_limited`, `hidden_by_user`, `inactive` |
| `start_date` | date null | Ingreso |
| `end_date` | date null | Salida |
| `is_current` | boolean | Actual |
| `created_at` | timestamptz | Alta |
| `updated_at` | timestamptz | Actualización |

---

### 15.2. `community_visibility_snapshots`

Datos agregados de comunidad.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `residence_id` | uuid | Residencia |
| `total_residents` | integer | Total |
| `activated_residents` | integer | Con cuenta activa |
| `pending_activation_residents` | integer | Pendientes |
| `age_range_summary` | text null | Ej. 18-25 |
| `nationality_summary` | jsonb | Países/banderas agregadas |
| `career_summary` | jsonb | Carreras agregadas |
| `room_distribution_summary` | jsonb | Distribución habitaciones |
| `updated_at` | timestamptz | Actualización |

---

## 16. Documentos y archivos

### 16.1. `files`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `owner_user_id` | uuid null | Usuario dueño |
| `related_entity_type` | text | `student`, `residence`, `payment`, `receipt`, `support`, etc. |
| `related_entity_id` | uuid | ID entidad |
| `bucket` | text | Bucket storage |
| `storage_path` | text | Path |
| `filename` | text | Nombre original |
| `mime_type` | text | Tipo |
| `size_bytes` | bigint | Tamaño |
| `visibility` | text | `private`, `context_shared`, `public` |
| `document_type` | document_type | Tipo |
| `status` | document_status | Estado |
| `uploaded_by_user_id` | uuid | Usuario |
| `created_at` | timestamptz | Alta |
| `updated_at` | timestamptz | Actualización |

---

### 16.2. `document_shares`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `file_id` | uuid | Archivo |
| `shared_by_user_id` | uuid | Estudiante/familiar/admin |
| `shared_with_residence_id` | uuid null | Residencia |
| `shared_with_user_id` | uuid null | Usuario específico |
| `context_type` | text | `application`, `reservation`, `renewal`, `support` |
| `context_id` | uuid | ID contexto |
| `can_view` | boolean | Permiso |
| `can_download` | boolean | Permiso |
| `expires_at` | timestamptz null | Expiración |
| `created_at` | timestamptz | Alta |

---

## 17. FAQ asistida por residencia

### 17.1. `residence_faq_predefined_questions` *(tabla nueva)*

Listado predefinido de preguntas disponibles para que las residencias elijan.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `question_text` | text | Texto de la pregunta predefinida |
| `category` | text | `precios`, `reglas`, `disponibilidad`, `convivencia`, `servicios`, `documentacion`, `otros` |
| `display_order` | integer | Orden de presentación |
| `is_active` | boolean | Disponible para elegir |
| `created_at` | timestamptz | Alta |

---

### 17.2. `residence_faq_items`

Preguntas configuradas por residencia (del listado predefinido o personalizadas).

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `residence_id` | uuid | Residencia |
| `predefined_question_id` | uuid null | FK si es del listado predefinido |
| `question` | text | Pregunta (copiada del predefinido o personalizada) |
| `answer` | text | Respuesta cargada por la residencia |
| `category` | text | Categoría |
| `is_active` | boolean | Activa |
| `is_custom` | boolean | True si es personalizada |
| `created_by_user_id` | uuid | Residencia/admin |
| `created_at` | timestamptz | Alta |
| `updated_at` | timestamptz | Actualización |

---

### 17.3. `bot_interactions`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `user_id` | uuid null | Usuario si registrado |
| `residence_id` | uuid null | Residencia consultada |
| `question_text` | text | Pregunta |
| `answer_text` | text null | Respuesta |
| `answered_from_source` | text | `faq`, `profile_data`, `files`, `fallback` |
| `was_answered` | boolean | Respondida |
| `needs_residence_input` | boolean | Falta info para residencia |
| `created_at` | timestamptz | Fecha |

---

## 18. Soporte y resolución de conflictos

### 18.1. `support_cases`

*(Renombrado de `mediation_cases` a `support_cases` para evitar implicaciones legales)*

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `opened_by_user_id` | uuid | Usuario |
| `against_user_id` | uuid null | Usuario involucrado |
| `residence_id` | uuid null | Residencia involucrada |
| `context_type` | text | `application`, `reservation`, `renewal`, `residence`, `user` |
| `context_id` | uuid null | ID contexto |
| `status` | support_case_status | Estado |
| `category` | text | `cancelacion`, `disponibilidad`, `discriminacion`, `informacion_falsa`, `otro` |
| `description` | text | Descripción |
| `terms_reminder_accepted_at` | timestamptz null | Aceptación alcance |
| `assigned_admin_id` | uuid null | Admin responsable |
| `resolution_summary` | text null | Cierre |
| `created_at` | timestamptz | Alta |
| `updated_at` | timestamptz | Actualización |

---

### 18.2. `support_evidence`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `support_case_id` | uuid | Caso |
| `uploaded_by_user_id` | uuid | Usuario |
| `file_id` | uuid null | Archivo |
| `evidence_type` | text | `video`, `photo`, `screenshot`, `audio`, `text` |
| `description` | text null | Descripción |
| `created_at` | timestamptz | Alta |

---

## 19. Métricas, visibilidad y penalizaciones

### 19.1. `residence_metrics_daily`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `residence_id` | uuid | Residencia |
| `date` | date | Día |
| `applications_received` | integer | Solicitudes recibidas |
| `applications_responded_within_48h` | integer | Respondidas en 48h |
| `avg_first_response_hours` | numeric | Promedio respuesta |
| `contact_established_count` | integer | Contactos establecidos |
| `confirmed_reservations_count` | integer | Reservas confirmadas |
| `expired_no_response_count` | integer | Vencidas sin respuesta |
| `rejected_no_availability_count` | integer | Rechazos por falta disponibilidad |
| `validated_claims_count` | integer | Reclamos validados |
| `availability_updated` | boolean | Actualizó disponibilidad |
| `operational_usage_score` | numeric | Uso dashboard |
| `profile_completeness_score` | numeric | Perfil completo |
| `adjustment_proposals_sent` | integer | Propuestas de ajuste enviadas *(nuevo)* |
| `adjustment_proposals_accepted` | integer | Propuestas aceptadas *(nuevo)* |
| `created_at` | timestamptz | Alta |

---

### 19.2. `residence_visibility_scores`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `residence_id` | uuid | Residencia |
| `score_date` | date | Fecha cálculo |
| `response_speed_score` | numeric | 25% |
| `availability_score` | numeric | 20% |
| `conversion_score` | numeric | 20% |
| `profile_verification_score` | numeric | 15% |
| `claims_score` | numeric | 10% |
| `operational_usage_score` | numeric | 10% |
| `total_score` | numeric | Total |
| `visibility_status` | residence_visibility_status | Estado |
| `admin_override` | boolean | Override admin |
| `metadata` | jsonb | Detalle |
| `created_at` | timestamptz | Alta |

---

### 19.3. `residence_penalties`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `residence_id` | uuid | Residencia |
| `penalty_type` | text | `warning`, `reduced_visibility`, `paused`, `suspended`, `removed` |
| `reason_code` | text | Motivo codificado |
| `reason_text` | text | Detalle |
| `applied_by_user_id` | uuid | Admin/system |
| `starts_at` | timestamptz | Inicio |
| `ends_at` | timestamptz null | Fin |
| `is_active` | boolean | Activa |
| `created_at` | timestamptz | Alta |

---

## 20. Tipo de cambio

### 20.1. `exchange_rates`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `rate_date` | date | Fecha |
| `base_currency` | text | `USD` |
| `quote_currency` | text | `ARS` |
| `official_exchange_rate_ars_per_usd` | numeric(14,6) | TC configurado |
| `source_name` | text | `monedapi.ar` *(decisión confirmada)* |
| `source_url` | text null | URL fuente |
| `rate_type` | text | `blue_sell` *(decisión confirmada: dólar blue, valor venta)* |
| `fetched_at` | timestamptz null | Actualización automática |
| `manually_overridden` | boolean | Override admin |
| `overridden_by_user_id` | uuid null | Admin |
| `override_reason` | text null | Motivo del override *(nuevo)* |
| `notes` | text null | Notas |
| `created_at` | timestamptz | Alta |

Reglas:
- fuente: monedapi.ar, dólar blue, valor venta (decisión confirmada);
- se actualiza automáticamente a diario;
- admin puede hacer override manual con motivo obligatorio (queda auditado); **el override no pisa la fila automática: se inserta una fila nueva con `manually_overridden = true`, conservando el histórico** (el unique de `rate_date` pasa a ser parcial: único por fecha entre filas automáticas);
- cada solicitud guarda snapshot del tipo de cambio.

---

## 21. Notificaciones

### 21.1. `notifications`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `recipient_user_id` | uuid | Destinatario |
| `channel` | text | `email`, `in_app` |
| `notification_type` | text | `application_submitted`, `fee_pending`, `family_proposal_received`, `negotiation_proposal_received`, etc. |
| `title` | text | Título |
| `body` | text | Mensaje |
| `related_entity_type` | text null | Entidad |
| `related_entity_id` | uuid null | ID entidad |
| `status` | text | `pending`, `sent`, `failed`, `read` |
| `scheduled_at` | timestamptz null | Programada |
| `sent_at` | timestamptz null | Enviada |
| `read_at` | timestamptz null | Leída |
| `provider_response` | jsonb null | Respuesta canal |
| `created_at` | timestamptz | Alta |

Eventos mínimos:
- propuesta del familiar recibida (al estudiante);
- propuesta del familiar aprobada/rechazada/expirada (al familiar);
- solicitud enviada / recibida por residencia;
- recordatorio diario a residencia;
- contacto establecido;
- propuesta de ajuste recibida (al estudiante);
- propuesta de ajuste respondida (a la residencia);
- propuesta de ajuste expirada;
- 48h iniciadas / 24h restantes / solicitud vencida (con botón de actualizar);
- pago recibido marcado / fee pendiente / fee fallido / fee pagado;
- factura emitida;
- reserva confirmada / comprobante emitido;
- renovación enviada / aceptada / confirmada;
- lista de espera con disponibilidad / recordatorio 90 días;
- reclamo abierto / actualizado.

---

## 22. Auditoría

### 22.1. `audit_logs`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID |
| `actor_user_id` | uuid null | Usuario actor |
| `actor_role` | text | Rol al actuar |
| `action` | text | Acción |
| `entity_type` | text | Tabla/entidad |
| `entity_id` | uuid | ID entidad |
| `old_value` | jsonb null | Valor anterior |
| `new_value` | jsonb null | Valor nuevo |
| `reason_code` | text null | Motivo codificado |
| `reason_text` | text null | Detalle |
| `ip_address` | inet null | IP |
| `user_agent` | text null | User agent |
| `is_system_action` | boolean | Acción automática |
| `source` | text | `user`, `admin`, `system`, `payment_provider` |
| `created_at` | timestamptz | Fecha |

Acciones obligatorias a auditar (ampliado):
- creación de propuesta del familiar / aprobación o rechazo por estudiante;
- envío de solicitud / cambio de estado de solicitud;
- envío de propuesta de ajuste / respuesta del estudiante;
- contacto establecido (timestamp del botón WhatsApp);
- rechazo de solicitud + motivo;
- pago recibido marcado por residencia (con consent_id);
- fee cobrado / fallido / expirado / reembolsado;
- reserva confirmada / cancelada / no-show;
- comprobante emitido / anulado / reemitido;
- factura emitida (TusFacturas.app);
- actualización de tarifas;
- cambio de disponibilidad;
- edición de perfil / aprobación;
- aprobación de verificación;
- suspensión / penalización;
- visualización o descarga de documentos sensibles (con justificación);
- cambios de permisos / vínculo familiar;
- override de tipo de cambio (con motivo);
- cambio de feature flag de plan freemium por residencia;
- reclamos / resolución de conflictos;
- overrides admin.

---

## 23. Relaciones principales

### 23.1. Usuario y estudiante

- `users 1:1 student_profiles`
- `student_profiles 1:1 student_visibility_settings`
- `student_profiles 1:N application_requests`
- `student_profiles 1:N reservations`
- `student_profiles 1:N waitlist_entries`
- `student_profiles 1:N resident_stays`

---

### 23.2. Estudiante y familiar

- `users 1:1 family_members`
- `family_members 1:N family_links`
- `student_profiles 1:0..1 active family_links` (unique partial constraint)
- `family_members 1:N family_application_proposals`
- un familiar puede tener muchos estudiantes; un estudiante solo un familiar activo.

---

### 23.3. Residencia

- `residences 1:N residence_users`
- `residences 1:N room_types`
- `residences 1:N rooms`
- `residences 1:N places`
- `residences 1:N application_requests`
- `residences 1:N reservations`
- `residences 1:N waitlist_entries`
- `residences 1:N renewal_offers`
- `residences 1:N residence_verifications`
- `residences 1:N residence_faq_items`

---

### 23.4. Solicitud y reserva

- `family_application_proposals 1:0..1 application_requests` (si fue aprobada)
- `application_requests 1:1 application_snapshots` (snapshot_original)
- `application_requests 1:0..1 application_snapshots` (snapshot_final)
- `application_requests 1:0..1 application_negotiation_proposals`
- `application_requests 1:N application_status_events`
- `application_requests 1:0..1 external_residence_payments`
- `application_requests 1:0..1 reservations`
- `reservations 1:1 estured_fee_payments`
- `reservations 1:0..1 booking_receipts`

---

### 23.5. Renovaciones

- `reservations 1:N renewal_requests`
- `reservations 1:N renewal_offers`
- `renewal_offers 1:0..1 external_residence_payments`
- `renewal_offers 1:1 estured_fee_payments`
- `renewal_offers 1:0..1 renewal_receipts`

---

### 23.6. Documentos

- `files` se relaciona de forma polimórfica con distintas entidades;
- `document_shares` define acceso contextual;
- documentos sensibles no se exponen por relación directa sin permisos.

---

## 24. Índices recomendados

### 24.1. Usuarios

- `users(email)` unique;
- `student_profiles(user_id)` unique;
- `family_members(user_id)` unique;
- `family_links(student_profile_id, status)`;
- unique parcial: un `family_links` activo por `student_profile_id`.

### 24.2. Propuestas del familiar

- `family_application_proposals(student_profile_id, status)`;
- `family_application_proposals(family_member_id, status)`;
- `family_application_proposals(expires_at)` para jobs de expiración.

### 24.3. Residencias

- `residences(slug)` unique;
- `residences(status, visibility_status)`;
- `residences(city, public_area)`;
- `residence_users(residence_id, user_id)`;
- `room_types(residence_id, is_active)`;
- `places(residence_id, status)`;
- `profile_availability(residence_id, room_type_id, status)`.

### 24.4. Solicitudes y reservas

- `application_requests(student_profile_id, status)`;
- `application_requests(residence_id, status)`;
- `application_requests(place_id, status)`;
- `application_requests(expires_at)` para jobs de vencimiento;
- `application_negotiation_proposals(application_request_id)` unique (máx. 1 por solicitud);
- `reservations(student_profile_id, status)`;
- `reservations(residence_id, status)`;
- `estured_fee_payments(status, expires_at)`;
- `estured_fee_payments(idempotency_key)` unique;
- `booking_receipts(receipt_number)` unique;
- `booking_receipts(verification_code)` unique;
- `estured_fee_payments(fiscal_invoice_status)` para panel de facturas y reintentos.

### 24.5. Lista de espera

- `waitlist_entries(student_profile_id, status)`;
- `waitlist_entries(residence_id, room_type_id, status)`;
- unique parcial: un `waitlist_entries` activo por `student_profile_id` + `residence_id` + `room_type_id`.

### 24.6. Auditoría y notificaciones

- `audit_logs(entity_type, entity_id)`;
- `audit_logs(actor_user_id, created_at)`;
- `notifications(recipient_user_id, status)`;
- `notifications(scheduled_at, status)`.

### 24.7. Tipo de cambio

- `exchange_rates(rate_date)` unique parcial (solo filas con `manually_overridden = false`);
- `exchange_rates(rate_date DESC)` para obtener la cotización más reciente (prevalece el override del día si existe).

### 24.8. Cola de solicitudes

- `place_application_queue(place_id, is_visible_to_residence)`;
- `place_application_queue(room_type_id, is_visible_to_residence)` (Perfil Verificado).

---

## 25. Reglas de seguridad / RLS (conceptuales)

### 25.1. Invitado

Puede leer: residencias verificadas y activas, datos públicos limitados, fotos públicas aprobadas, disponibilidad pública.

No puede leer: perfiles completos de residentes, documentos, solicitudes, reservas, pagos, datos sensibles.

### 25.2. Estudiante

Puede leer y operar: su perfil, sus solicitudes, sus reservas, sus pagos, sus comprobantes, sus documentos, sus listas de espera, sus renovaciones, propuestas del familiar dirigidas a él.

No puede: editar estados críticos directamente, confirmar reserva sin fee, ver documentos de otros estudiantes.

### 25.3. Familiar vinculado

Puede operar solo dentro del estudiante vinculado activo: dashboard compartido, propuestas que creó, documentación autorizada, pagos del fee, comprobantes, solicitudes y reservas asociadas.

No puede: ver datos de otros estudiantes, crear propuestas sin `family_links.status = active`.

### 25.4. Residencia owner/staff

Puede operar solo en residencias donde tiene `residence_users` activo: perfil propio, solicitudes recibidas, documentación compartida en contexto, reservas propias, pagos informados, habitaciones/plazas/residentes/renovaciones/FAQ propias.

No puede: ver otras residencias, modificar auditoría, emitir comprobantes manuales.

### 25.5. Admin

Puede operar casi todo lo necesario para soporte, verificación y resolución de conflictos. Acciones críticas siempre auditadas. Motivo obligatorio para overrides. Documentos sensibles requieren justificación registrada.

---

## 26. Storage buckets sugeridos

### `public-residence-media`
Fotos aprobadas de residencias. Lectura pública; escritura residencia/admin con revisión.

### `private-user-documents`
Documentos de estudiantes y familiares. Privado; lectura solo dueño, admin o residencia con `document_shares` activo.

### `private-residence-documents`
DNI de responsables, checklist, documentación interna. Residencia owner y admin; no público.

### `payment-proofs`
Comprobantes de pagos a residencia y pagos manuales de fee. Privado; acceso contextual.

### `generated-receipts`
PDFs de comprobantes de reserva y renovación. Privado; acceso por URL firmada. La URL `/verify/[codigo]` es pública pero muestra solo datos mínimos, no el PDF completo.

### `fiscal-documents`
Facturas C generadas por TusFacturas.app. Privado; acceso por pagador, estudiante y admin.

### `support-evidence`
Evidencia de casos de soporte. Privado; acceso por partes del caso y admin.

---

## 27. Jobs y automatizaciones necesarias

### 27.1. Tipo de cambio diario
- consultar monedapi.ar (dólar blue, valor venta);
- guardar en `exchange_rates`;
- notificar admin si falla;
- permitir override manual.

### 27.2. Expiración de propuestas del familiar
- detectar `family_application_proposals` con `status = pending_student_approval` y `expires_at < now()`;
- pasar a `expired`, notificar al familiar.

### 27.3. Vencimiento de solicitudes
- detectar `application_requests` con `expires_at < now()` en estados no terminales;
- pasar a `expired_no_residence_response` o `expired_no_student_payment` según corresponda;
- mostrar al estudiante el detalle + botón "Actualizar con mismos parámetros".

### 27.4. Expiración de propuestas de ajuste
- detectar `application_negotiation_proposals` con `expires_at < now()` sin respuesta;
- pasar solicitud a `expired_offer_no_response`.

### 27.5. Vencimiento de disponibilidad
- detectar residencias sin actualización en 30 días → `not_updated`;
- si persiste más de 15 días → registrar `hidden_from_search_at`, ocultar de búsquedas.

### 27.6. Recordatorios de solicitud
- notificar residencia por solicitudes nuevas/pendientes (diario).

### 27.7. Plazos de pago del fee
- 48h para fee después de pago recibido;
- hasta 3 intentos de cobro;
- si vence: `expired`.

### 27.8. Lista de espera
- notificar disponibilidad;
- notificar a los 90 días para confirmar permanencia;
- remover de otras listas si confirma reserva en otra residencia.

### 27.9. Métricas y visibilidad
- calcular métricas diarias;
- actualizar visibility score;
- alertas de tarifas mayores al 15%;
- alertas de rechazos por falta de disponibilidad.

### 27.10. Verificación anual de residencias
- notificar 30 días antes de vencimiento;
- pasar a `verification_expired` si vence sin renovar.

---

## 28. Casos borde que el modelo debe soportar

1. Familiar crea propuesta → estudiante aprueba → solicitud con `initiated_by = family_member` y `contact_target = family_member`.
2. Familiar crea propuesta → estudiante rechaza → propuesta `rejected_by_student`, familiar notificado.
3. Propuesta del familiar expira en 48h → `expired`, familiar notificado.
4. Residencia intenta enviar segunda propuesta de ajuste → bloqueado por unique constraint en `application_negotiation_proposals`.
5. Estudiante acepta propuesta de ajuste → `snapshot_final` creado con nuevos valores → fee recalculado sobre snapshot_final.
6. Estudiante rechaza propuesta y elige continuar → `snapshot_final = snapshot_original`.
7. Estudiante minor sin familiar activo → acciones sensibles bloqueadas, admin notificado.
8. Owner intenta crear una 11ª residencia → bloqueado (límite: 10).
9. Fee cobrado → webhook duplicado → `idempotency_key` previene segundo cobro.
10. Fee en USD via PayU → se registra `fee_amount_usd` y `fee_amount_ars`, con tipo de cambio del snapshot_final.
11. Factura C emitida → vinculada al `estured_fee_payment` con `fiscal_invoice_id`.
12. Comprobante incluye `verification_code` → URL pública `/verify/[codigo]` válida.
13. Fee pagado pero PDF falla → reserva `confirmed`, receipt en `generation_failed`, admin puede reemitir.
14. Disponibilidad `not_updated` por más de 15 días → `hidden_from_search_at` registrado.
15. Estudiante confirma reserva → sale automáticamente de todas las listas de espera y se cierran solicitudes alternativas.
16. Admin accede a documento sensible → debe ingresar justificación, audit log generado.
17. Estudiante menor de edad envía solicitud → `contact_target = family_member` y el teléfono del familiar es obligatorio.
18. Fee vence sin pago → fee `expired` y reserva `expired_fee_unpaid`.
19. Revocación dentro de los 10 días → `reservations.cancellation_reason_code = student_revocation_right`, comprobante `voided`, fee sigue `paid`.
20. Chargeback sobre fee `paid` → alerta admin; reserva y comprobante sin cambios automáticos.
21. Solicitud en Perfil Verificado → cola por `room_type_id`; en Gestión Operativa → cola por `place_id`.

---

## 29. Pendientes técnicos resueltos y no bloqueantes

**Resueltos:**
- ~~Proveedor de pagos~~ → MercadoPago + PayU Argentina.
- ~~Fuente tipo de cambio~~ → monedapi.ar (blue, venta).
- ~~Facturación~~ → TusFacturas.app, Factura C, monotributista.
- ~~WhatsApp~~ → solo botón pre-formateado, sin API.

**No bloqueantes:**
- Texto legal final de términos y condiciones.
- Política legal de reembolso/no reembolso.
- Almacenamiento y caducidad de documentos sensibles.
- Configuración exacta de RLS en Supabase.
- Reglas fiscales para pagadores extranjeros.

---

## 30. Instrucciones para Claude Code

1. No simplificar el modelo fusionando solicitud, reserva, pago y comprobante.
2. No permitir cambios de estado críticos desde el cliente sin validación server-side.
3. No exponer documentos por URL pública sin control.
4. No usar floats para dinero.
5. No recalcular snapshots históricos.
6. No permitir que residencias vean documentos fuera de contexto.
7. No emitir comprobantes si el fee EstuRed no está pagado.
8. No marcar reserva confirmed si el fee no está `paid`.
9. No borrar audit logs.
10. Calcular el fee siempre sobre `snapshot_final`, no sobre `snapshot_original`.
11. Usar `idempotency_key` en todos los cobros de fee para prevenir duplicados.
12. Respetar el límite de 1 propuesta de ajuste por solicitud (constraint de base de datos + validación server-side).
13. Al crear `application_requests` desde propuesta del familiar, copiar `initiated_by = family_member` y `contact_target = family_member`.
14. Al establecer contacto, verificar `contact_target` para determinar el número del botón WhatsApp.
15. El `verification_code` del comprobante debe ser único, no predecible, y la URL `/verify/[codigo]` no debe exponer datos sensibles.
