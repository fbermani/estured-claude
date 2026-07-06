# 09_ADMIN_PANEL_SPEC.md
# EstuRed — Especificación del Panel de Administración

**Versión:** 0.2
**Estado:** Documento actualizado para construcción
**Última actualización:** 2026-06-27
**Depende de:** `00_DECISION_LOG.md`, `03_BUSINESS_RULES.md`, `04_STATE_MACHINES.md`, `05_ROLES_AND_PERMISSIONS.md`, `06_DATA_MODEL.md`, `07_API_SPEC.md`, `08_UI_SCREENS_AND_FLOWS.md`

---

## 1. Propósito

El panel de administración de EstuRed es el sistema operativo interno de la plataforma.

Es un módulo **Must Have** del MVP porque EstuRed no es solo un marketplace público. Verifica residencias, gestiona flujos sensibles de reserva, sigue pagos, emite comprobantes, audita cambios, gestiona propuestas de solicitud del familiar, negociaciones de condiciones, casos de soporte, monitorea calidad y puede intervenir manualmente cuando una operación queda trabada.

El panel debe permitir al equipo de EstuRed operar el producto de forma segura sin editar la base de datos directamente.

Propósitos centrales:

- Verificar residencias antes de publicación.
- Monitorear solicitudes, propuestas del familiar, negociaciones, reservas, pagos y comprobantes.
- Gestionar facturación fiscal automática (TusFacturas.app).
- Gestionar acceso freemium a Gestión Operativa por residencia.
- Revisar riesgos y alertas operativas.
- Auditar cambios críticos.
- Gestionar soporte y resolución de conflictos.
- Aplicar penalizaciones de visibilidad cuando corresponda.
- Mantener la confianza del marketplace.
- Prevenir fraude, disponibilidad desactualizada, información engañosa y abuso operativo.

El panel admin no es opcional. Sin él, el MVP dependería de cambios manuales en base de datos y sería operativamente inseguro.

---

## 2. Estructura de rutas

Ruta base oficial:

```
/admin
```

Rutas internas recomendadas:

```
/admin/dashboard
/admin/residences
/admin/residences/[id]
/admin/residences/[id]/plan
/admin/verifications
/admin/profile-edits
/admin/pricing
/admin/applications
/admin/applications/[id]
/admin/family-proposals
/admin/negotiations
/admin/reservations
/admin/reservations/[id]
/admin/payments
/admin/invoices
/admin/receipts
/admin/users
/admin/documents
/admin/waitlists
/admin/renewals
/admin/community
/admin/support-cases
/admin/visibility
/admin/notifications
/admin/exchange-rate
/admin/audit-log
/admin/settings
```

Claude Code puede adaptar convenciones de nombres, pero la separación funcional debe mantenerse.

---

## 3. Roles de administración

### 3.1 Admin EstuRed

Puede operar la plataforma: revisar casos, verificar residencias, gestionar solicitudes, propuestas del familiar y negociaciones, intervenir en reservas, validar pagos manuales, gestionar facturación fiscal, reemitir comprobantes, gestionar casos de soporte, aplicar acciones operativas y gestionar acceso freemium por residencia.

Las acciones de admin siempre deben quedar auditadas.

### 3.2 Superadmin EstuRed

Control total del sistema. Permisos adicionales:

- Crear, editar y desactivar usuarios admin.
- Configurar reglas de negocio globales.
- Configurar proveedores de pago (MercadoPago, PayU Argentina).
- Configurar fuente de tipo de cambio (monedapi.ar) u overrides.
- Configurar integración de facturación fiscal (TusFacturas.app).
- Configurar ponderaciones de score de visibilidad.
- Acceder a todos los audit logs.
- Ejecutar acciones irreversibles o de alto riesgo.
- Restaurar residencias o usuarios suspendidos.

### 3.3 Actor Sistema

Procesos automatizados: jobs, recordatorios, actualización de tipo de cambio, expiración de flujos (solicitudes, propuestas del familiar, propuestas de ajuste), disparo de alertas, procesamiento de webhooks, emisión automática de facturas fiscales y generación de notificaciones.

Las acciones del sistema también deben auditarse cuando afectan entidades críticas del negocio.

---

## 4. Principios generales de administración

### 4.1 Sin cambios silenciosos

Cualquier acción admin que cambie el estado de una entidad debe requerir:

- ID del admin.
- Timestamp.
- Entidad afectada.
- Valor anterior.
- Valor nuevo.
- Motivo o nota interna.
- Fuente: acción manual admin, job del sistema, webhook de pago, webhook de facturación, o caso de soporte.

### 4.2 Sin dependencia directa de base de datos

El panel admin debe exponer acciones controladas. EstuRed no debería necesitar editar filas de base de datos manualmente para operaciones normales.

### 4.3 Toda acción crítica debe ser reversible o trazable

Cuando la reversión no es posible, la acción debe mostrar una advertencia explícita antes de ejecutarse.

Ejemplos: suspender una residencia, emitir un reembolso, anular un comprobante, anular una factura fiscal, confirmar una reserva manualmente, remover un usuario de la plataforma.

### 4.4 Los overrides de admin están permitidos, pero son excepcionales

Los admins pueden corregir operaciones trabadas, pero todo override debe ser visible en el audit log.

### 4.5 El panel admin no debe saltear reglas de negocio silenciosamente

Si un admin cambia un estado fuera del flujo normal, el sistema debe registrarlo como override.

Ejemplo:

```
reservation.status cambió de pending_estured_fee a confirmed por override de admin
motivo: pago manual validado tras falla del proveedor
```

---

## 5. Dashboard admin

**Ruta:** `/admin/dashboard`

Propósito: dar a EstuRed una vista operativa en tiempo real.

### 5.1 Cards principales

- Residencias pendientes de verificación.
- Residencias con verificación por vencer.
- Solicitudes activas.
- Solicitudes por vencer.
- Solicitudes vencidas por inactividad de residencia.
- **Propuestas del familiar pendientes de aprobación del estudiante.**
- **Propuestas del familiar por vencer o vencidas.**
- **Negociaciones activas (propuesta de ajuste enviada, esperando respuesta).**
- **Negociaciones vencidas sin respuesta.**
- Reservas pendientes de fee EstuRed.
- Pagos de fee fallidos.
- Comprobantes pendientes de generación.
- **Facturas fiscales pendientes o fallidas (TusFacturas.app).**
- Casos de soporte abiertos.
- Alertas de tarifas (±15%).
- Residencias con disponibilidad desactualizada.
- Residencias con rechazos repetidos por falta de disponibilidad.
- Usuarios pendientes de activación de cuenta.
- Residentes pendientes de activación.
- Pagos manuales pendientes de validación.

### 5.2 Secciones recomendadas del dashboard

**Operativo hoy** — acciones que requieren atención en las próximas 24 horas.

**Alertas de riesgo** — problemas que podrían dañar la confianza:
- Residencia aceptó y luego canceló.
- Residencia marcó pago recibido pero el comprobante no se emitió.
- Alto número de solicitudes rechazadas por falta de disponibilidad.
- Cambio de precio grande.
- Disponibilidad vencida.
- Múltiples reclamos contra la misma residencia.
- **Negociación vencida sin respuesta del estudiante.**
- **Factura fiscal fallida repetidamente.**

**Ingresos** — fees pagados, pendientes, fallidos, reembolsados, por período; reservas confirmadas; fees de renovación confirmados; **desglose por proveedor (MercadoPago/PayU) y moneda (ARS/USD)**.

**Salud del marketplace** — residencias verificadas, activas, completas, con disponibilidad, en Modo Gestión Operativa, **residencias con acceso freemium activo y su fecha de vencimiento**, desempeño de respuesta.

---

## 6. Gestión de residencias

**Rutas:** `/admin/residences`, `/admin/residences/[id]`

Propósito: gestionar todas las cuentas de residencia y su estado operativo.

### 6.1 Filtros de listado

Borrador; pendiente de verificación; visita programada; verificada activa; necesita cambios; pausada por residencia; pausada por admin; suspendida; verificación vencida; archivada; Modo Perfil Verificado; Modo Gestión Operativa; **con acceso freemium activo**; **acceso freemium por vencer**; con disponibilidad activa; completa; disponibilidad desactualizada; con alertas de tarifa; con reclamos; **con múltiples residencias del mismo owner** (para detectar patrones a nivel owner).

### 6.2 Detalle de residencia

Debe mostrar:

- Información básica.
- Usuarios owner y staff (y **otras residencias que gestiona el mismo owner**, hasta 10).
- Estado de verificación.
- Completitud de perfil.
- Datos públicos actuales del perfil.
- Ediciones de perfil pendientes.
- Precios actuales e historial de precios.
- Estado de disponibilidad.
- Habitaciones y plazas.
- Solicitudes, **propuestas del familiar asociadas**, **negociaciones activas**.
- Reservas.
- Lista de espera.
- Residentes.
- Renovaciones.
- Comprobantes.
- **Facturas fiscales emitidas.**
- **Estado del plan freemium** (Perfil Verificado / Gestión Operativa / acceso gratuito hasta fecha X).
- Reclamos y casos de soporte.
- Score de visibilidad.
- Penalizaciones.
- Historial de auditoría.

### 6.3 Acciones admin

Ver detalle; editar datos; pausar; despausar; suspender; archivar; restaurar; marcar como "necesita cambios"; disparar re-verificación; cambiar modo operativo si corresponde; **gestionar acceso freemium (enlaza a 6.4)**; agregar notas internas; ver historial de auditoría.

Las acciones que afectan publicación o visibilidad requieren motivo.

### 6.4 Gestión de plan freemium por residencia

**Ruta:** `/admin/residences/[id]/plan`

Propósito: controlar el feature flag `has_operational_management_access`.

**Debe mostrar:**
- Estado actual del flag.
- Si es residencia pionera: fecha de fin de acceso gratuito.
- Historial de cambios (otorgado por quién, cuándo, motivo).

**Acciones:**
- Otorgar acceso — motivo obligatorio (`pioneer_beta` / `purchase` / `extension` / `courtesy`), fecha límite opcional.
- Revocar acceso — motivo obligatorio.

Toda acción queda auditada. **Esta es una decisión de negocio, no técnica — no debe delegarse a Claude Code.**

---

## 7. Verificación de residencias

**Rutas:** `/admin/verifications`, `/admin/residences/[id]/verification`

Propósito: gestionar el proceso de verificación que habilita el sello **Residencia Verificada**.

### 7.1 Requisitos mínimos de verificación

Identidad del responsable revisada; DNI del responsable cargado; DNI del coordinador si aplica; dirección verificada; visita presencial completada; similitud entre fotos publicadas y espacio real revisada; checklist completo y firmado por ambas partes; residencia aceptó términos, disclaimer y declaración de responsabilidad.

### 7.2 Estados de verificación

`draft`, `pending_verification`, `verification_scheduled`, `verified_active`, `needs_changes`, `paused_by_admin`, `suspended`, `verification_expired`, `archived`.

### 7.3 La pantalla de verificación debe mostrar

Información de residencia; usuario responsable; documentos cargados; fecha de visita; notas de visita; ítems del checklist; fotos revisadas; problemas detectados; estado de firma; fecha de vencimiento de verificación; última fecha de verificación.

### 7.4 Acciones admin

Programar visita; marcar visita completada; cargar checklist; aprobar verificación; rechazar verificación; pedir cambios; vencer verificación manualmente; suspender verificación; agregar notas internas.

### 7.5 Vencimiento de verificación

Válida por un año. El sistema debe generar alertas: 60 días antes, 30 días antes, 7 días antes, y en la fecha de vencimiento.

Si vence, el admin puede pausar la publicación hasta la re-verificación.

---

## 8. Revisión de ediciones de perfil

**Ruta:** `/admin/profile-edits`

Propósito: revisar cambios críticos del perfil público.

### 8.1 Cambios que requieren aprobación admin antes de publicarse

Fotos; dirección; nombre comercial; servicios incluidos; reglas principales; condiciones de reserva; capacidad total; tipos de habitación; documentación de residencia.

### 8.2 Cambios que no requieren aprobación previa, pero deben auditarse

Precios; matrícula; depósito; política de ajustes; FAQ; descripciones menores; texto de bienvenida; preferencias de contacto.

Los cambios de precio generan alertas cuando la variación supera ±15% en una sola edición.

### 8.3 La pantalla de revisión debe mostrar

Residencia; campo modificado; valor anterior; valor nuevo; fecha del cambio; usuario que lo hizo; nivel de riesgo; alerta relacionada si existe.

### 8.4 Acciones admin

Aprobar cambio; rechazar cambio; pedir corrección; agregar nota interna; contactar residencia; pausar publicación si es crítico.

---

## 9. Administración de tarifas

**Ruta:** `/admin/pricing`

Propósito: monitorear el comportamiento de precios sin aprobar manualmente cada movimiento.

### 9.1 Datos de precios a mostrar

Residencia; tipo de habitación; plaza/cama si aplica; precio USD anterior y nuevo; precio ARS anterior y nuevo (referencial); cambio porcentual; cambio de matrícula; cambio de depósito; cambio de política de ajustes; fecha; usuario que lo cambió; estado de alerta.

### 9.2 Reglas de alerta

Crear alerta si: el precio sube o baja más de 15% en una edición; la matrícula cambia más de 15%; el depósito cambia más de 15%; cambia la configuración de moneda; cambia la política de ajustes.

### 9.3 Acciones admin

Marcar como revisado; agregar nota interna; contactar residencia; crear caso de soporte; pausar residencia si se sospecha comportamiento engañoso.

### 9.4 Reglas de redondeo a validar

Precios en USD terminan en 0 o 5. Precios en ARS terminan en 500 o 000. El fee EstuRed se redondea al múltiplo de 500 ARS más cercano.

El panel admin debe exponer valores de precio inválidos si evaden la validación de frontend.

---

## 10. Administración de solicitudes

**Rutas:** `/admin/applications`, `/admin/applications/[id]`

Propósito: monitorear e intervenir en solicitudes de reserva.

### 10.1 Filtros

Enviada; en revisión; contacto establecido; **en negociación (propuesta de ajuste enviada, esperando respuesta)**; **condiciones aceptadas**; pausada por otra solicitud activa; pago a residencia pendiente; pago a residencia reportado; convertida a reserva; rechazada; vencida por falta de respuesta de residencia; vencida por falta de pago del estudiante; **vencida por falta de respuesta a propuesta de ajuste**; cancelada por estudiante; cancelada por residencia; cerrada por otra reserva confirmada; en disputa.

### 10.2 El detalle de la solicitud debe mostrar

- Estudiante.
- Familiar vinculado si existe.
- **`initiated_by` (estudiante/familiar) y `contact_target` (a quién contacta la residencia).**
- **Si se originó en una propuesta del familiar: enlace a esa propuesta.**
- Residencia.
- Habitación/plaza solicitada.
- Snapshot original de condiciones.
- **Propuesta de ajuste enviada por la residencia, si existe (con comparación original vs. propuesta).**
- **Snapshot final de condiciones aceptadas.**
- Estado actual.
- Plazos (incluyendo reinicio de timer por negociación).
- Estado del pago a residencia.
- Estado del fee EstuRed si existe reserva.
- Documentos relacionados.
- Timestamp del botón de WhatsApp presionado (contacto establecido).
- Acciones de la residencia.
- Acciones del estudiante.
- Historial de auditoría.

### 10.3 Acciones admin

Pausar solicitud; reanudar solicitud; cancelar solicitud; reabrir solicitud; mover a disputa; editar notas internas; forzar cierre por reserva confirmada en otro lado; marcar como vencida cuando corresponda; corregir estado trabado; **intervenir en una negociación trabada (ver 10.5)**.

Los cambios manuales de estado requieren motivo.

### 10.4 Monitoreo de rechazos

El admin debe poder analizar: rechazos por residencia; distribución de motivos de rechazo; rechazos por falta de disponibilidad; rechazos después de mostrar disponibilidad; patrones repetidos.

Esto es necesario para detectar residencias que no actualizan disponibilidad correctamente.

### 10.5 Intervención en negociaciones trabadas

Si una propuesta de ajuste queda sin respuesta cerca de vencer, o si hay disputa entre residencia y estudiante sobre lo acordado por WhatsApp, el admin puede:

- Ver el detalle completo de la propuesta (campos modificados, fecha de envío).
- Contactar a ambas partes.
- Forzar expiración manual si corresponde.
- Derivar a un caso de soporte si hay conflicto sobre lo pactado fuera de la plataforma.

**Regla:** el admin no puede crear ni modificar una propuesta de ajuste en nombre de la residencia. Solo la residencia puede proponer, y el límite de una propuesta por solicitud aplica también en casos de intervención admin — si se necesita una excepción, debe quedar como override auditado con motivo explícito.

---

## 11. Propuestas del familiar (admin) — sección nueva

**Ruta:** `/admin/family-proposals`

Propósito: monitorear el uso del flujo de propuestas del familiar y detectar patrones problemáticos (familiares que crean muchas propuestas rechazadas, disputas entre familiar y estudiante).

### 11.1 Estados

`draft`, `pending_student_approval`, `approved_by_student`, `rejected_by_student`, `expired`.

### 11.2 La pantalla debe mostrar

Listado con: familiar, estudiante vinculado, residencia sugerida, estado, fecha de creación, fecha de vencimiento (48h), tiempo de respuesta del estudiante si respondió, solicitud creada (si fue aprobada, con enlace).

### 11.3 Acciones admin

Ver detalle; agregar nota interna; **derivar a soporte si hay conflicto entre familiar y estudiante** (el admin no puede aprobar/rechazar propuestas en nombre del estudiante — esa decisión es exclusiva del estudiante).

### 11.4 Métrica a vigilar

Tasa de rechazo de propuestas por familiar. Una tasa alta y sostenida puede indicar fricción entre familiar y estudiante que amerite intervención de soporte, no solo un patrón de uso normal.

---

## 12. Negociaciones activas (admin) — sección nueva

**Ruta:** `/admin/negotiations`

Propósito: detectar negociaciones trabadas o vencidas sin respuesta, y monitorear el uso general del flujo de propuestas de ajuste.

### 12.1 Estados relevantes de la solicitud asociada

`offer_pending_student_acceptance`, `conditions_accepted`, `expired_offer_no_response`.

### 12.2 La pantalla debe mostrar

Listado con: residencia, solicitud, estudiante, campos modificados (comparación original vs. propuesta), fecha de envío, fecha de expiración (48h desde el envío), respuesta del estudiante si existe (`accepted` / `rejected_chose_original` / `rejected_closed`).

### 12.3 Acciones admin

Ver detalle completo; intervenir en la solicitud asociada (ver 10.5); agregar nota interna.

### 12.4 Métrica a vigilar

Tasa de propuestas de ajuste que vencen sin respuesta. Puede indicar que las residencias están usando el mecanismo de negociación para presionar tiempos, o que el plazo de 48h es insuficiente para decisiones que involucran cambios de tarifa importantes. **Esto es una señal a monitorear en beta, no una decisión a tomar ahora.**

---

## 13. Administración de reservas

**Rutas:** `/admin/reservations`, `/admin/reservations/[id]`

Propósito: gestionar reservas confirmadas y en proceso.

### 13.1 Estados de reserva

`pending_estured_fee`, `estured_fee_processing`, `estured_fee_failed`, `confirmed`, `receipt_pending`, `receipt_issued`, `cancelled_by_student`, `cancelled_by_residence`, `no_show`, `completed`, `disputed`.

### 13.2 El detalle de la reserva debe mostrar

Estudiante; pagador familiar si existe; residencia; habitación/plaza; fecha de ingreso; duración inicial; objetivo académico; monto informado por la residencia; base del fee EstuRed (**sobre snapshot final, no original, si hubo negociación**); monto del fee; **moneda y proveedor de pago (MercadoPago/PayU)**; estado del pago; estado del comprobante; **estado de la factura fiscal**; política de ajustes futuros; solicitud relacionada; audit log relacionado; casos de soporte relacionados.

### 13.3 Acciones admin

Confirmar manualmente con evidencia; cancelar reserva; marcar no-show; mover a disputa; reabrir si se canceló por error; disparar generación de comprobante; reemitir comprobante; **disparar o reemitir emisión de factura fiscal**; agregar nota interna; disparar reintento de fee; procesar reembolso cuando corresponda.

La confirmación manual requiere: motivo, evidencia o nota interna, checkbox de confirmación del admin.

---

## 14. Administración de pagos de fee

**Ruta:** `/admin/payments`

Propósito: gestionar pagos del fee EstuRed.

### 14.1 Estados de pago

`not_required_yet`, `pending_payment_method`, `pending_manual_payment`, `pending_auto_charge`, `processing`, `paid`, `failed`, `expired`, `refunded`, `chargeback`.

### 14.2 El listado de pagos debe mostrar

Reserva o renovación; pagador; estudiante beneficiario; residencia; monto; **moneda (ARS/USD)**; **proveedor (MercadoPago/PayU/manual)**; método de pago; estado; intentos; plazo; estado de reembolso; **estado de factura fiscal asociada**.

### 14.3 Acciones admin

Validar pago manual; rechazar pago manual; reintentar cobro automático; marcar pago como fallido; marcar pago como vencido; emitir reembolso; registrar chargeback; agregar nota interna.

### 14.4 Regla de reintento automático

Si el cobro del fee falla, el sistema puede intentar hasta **3 reintentos dentro de 48 horas**. Cada intento debe registrarse.

### 14.5 Regla de pago manual

Los pagos manuales del fee pueden aceptarse por transferencia u otro canal habilitado. La reserva no se confirma hasta que el fee se marca como `paid`. Al marcarlo `paid` (manual o automático), se dispara automáticamente la emisión de la factura fiscal.

---

## 15. Facturación fiscal (admin) — sección nueva

**Ruta:** `/admin/invoices`

Propósito: monitorear la emisión automática de Factura C vía TusFacturas.app (EstuRed opera como monotributista).

### 15.1 Estados de factura

`not_required`, `pending_issue`, `issued`, `issue_failed`, `voided`, `reissued`.

### 15.2 El listado debe mostrar

Pago de fee asociado; reserva o renovación asociada; pagador (nombre, CUIT/CUIL si corresponde, condición IVA); monto; moneda; fecha de emisión; ID de factura en TusFacturas.app; estado; motivo de fallo si aplica.

### 15.3 Acciones admin

Reintentar emisión fallida; reemitir factura (requiere motivo, gestionar nota de crédito si aplica); descargar PDF; ver detalle del pago asociado.

### 15.4 Regla

La factura se emite automáticamente cuando el fee se marca `paid` (automático o manual). Nunca antes. Si la emisión falla, el pago del fee y la reserva **no quedan bloqueados** — la reserva puede confirmarse igual, pero la factura queda en `issue_failed` y debe reintentarse. **Decisión confirmada (ver §34.2): es aceptable que exista una reserva confirmada sin factura emitida temporalmente, siempre que el estado de falla sea visible en `/admin/invoices`.**

### 15.5 Límite del monotributo — riesgo a vigilar

EstuRed opera como monotributista con límites de facturación anual. Esta pantalla debe eventualmente mostrar el acumulado facturado en el período fiscal vigente para anticipar el cambio de categoría. **No es Must Have para el MVP, pero recomiendo dejarlo planificado antes de escalar el volumen de residencias.**

---

## 16. Administración de comprobantes

**Ruta:** `/admin/receipts`

Propósito: gestionar comprobantes de reserva y renovación.

### 16.1 Tipos de comprobante

Comprobante de Reserva Confirmada; Comprobante de Renovación Confirmada.

### 16.2 Estados

`not_available`, `pending_generation`, `issued`, `generation_failed`, `voided`, `reissued`.

### 16.3 Datos del comprobante

ID de comprobante; **código de verificación público (`verification_code`) para `/verify/[codigo]`**; QR; fecha de emisión; datos del estudiante; datos del pagador/familiar si aplica; datos de residencia; tipo de habitación/plaza; fecha de ingreso; duración inicial o período de renovación; objetivo académico; monto abonado a residencia informado por la residencia; fee EstuRed y moneda; estado del pago del fee; **factura fiscal asociada**; política de ajustes; disclaimer legal; contacto de soporte.

### 16.4 Acciones admin

Generar comprobante; regenerar comprobante fallido; reemitir comprobante; anular comprobante; descargar PDF; **ver estado de verificación pública (`/verify/[codigo]`)**.

Anular o reemitir requiere motivo.

---

## 17. Administración de usuarios

**Ruta:** `/admin/users`

Propósito: gestionar usuarios de la plataforma.

### 17.1 Tipos de usuario

Estudiante; estudiante menor de edad; familiar vinculado; residence owner (**con indicador de cuántas residencias gestiona, hasta 10**); residence staff (**con indicador de a qué residencias tiene acceso**); admin; superadmin.

### 17.2 El detalle del usuario debe mostrar

Estado de cuenta; rol; perfil; relación familiar vinculada; relación con residencia(s) si aplica; metadata de documentos; solicitudes; **propuestas del familiar creadas (si es familiar) o recibidas (si es estudiante)**; reservas; listas de espera; renovaciones; comprobantes; casos de soporte; configuración de visibilidad; actividad de auditoría.

### 17.3 Acciones admin

Ver usuario; suspender; restaurar; bloquear; resetear estado de cuenta; reenviar email de activación; revisar vínculo familiar; remover vínculo familiar si es legal u operativamente necesario; agregar nota interna.

Los admins no deben exponer ni descargar documentos sensibles salvo necesidad y autorización según rol (ver §18.2 — justificación obligatoria).

---

## 18. Administración de documentos

**Ruta:** `/admin/documents`

Propósito: ver metadata de documentos y acceder a documentos sensibles solo cuando sea necesario.

### 18.1 Categorías de documento

Documento de identidad del estudiante; documento académico; documento del familiar/pagador responsable; DNI del responsable de residencia; DNI del coordinador; checklist de verificación firmado; referencias de pago; comprobantes; **facturas fiscales**; evidencia de casos de soporte.

### 18.2 Reglas de documentos

Los documentos son privados por defecto. El acceso debe ser contextual. **El acceso admin debe requerir justificación obligatoria registrada antes de visualizar, generando un audit log específico** (no solo "se accedió", sino el motivo declarado). El acceso de residencia se limita a documentos autorizados para una solicitud, reserva, residente o renovación específica. El acceso público nunca está permitido.

### 18.3 Acciones admin

Ver metadata; ver documento si el permiso lo permite (con justificación); descargar si es necesario; marcar como inválido; pedir recarga; restringir acceso; eliminar o archivar según política.

---

## 19. Administración de lista de espera

**Ruta:** `/admin/waitlists`

Propósito: monitorear la salud de las listas de espera.

### 19.1 Reglas de lista de espera

No cuenta como solicitud activa; no afecta estadísticas de solicitudes hasta que el estudiante activa una solicitud; si el estudiante confirma reserva en otra residencia, se remueve automáticamente de las demás listas; a los 90 días recibe notificación preguntando si quiere continuar; no vence automáticamente solo por tiempo; la residencia puede remover manualmente estudiantes de su lista.

### 19.2 La pantalla debe mostrar

Residencia; estudiante; tipo de habitación/plaza; fecha deseada; duración deseada; fecha de ingreso a la lista; última notificación de confirmación a los 90 días; estado.

### 19.3 Acciones admin

Remover entrada; restaurar entrada si se removió por error; disparar notificación; ver historial de auditoría.

---

## 20. Administración de renovaciones

**Ruta:** `/admin/renewals`

Propósito: monitorear e intervenir en flujos de renovación.

### 20.1 Estados

`created_by_student` (solicitud informal), `notified_to_residence`, `offer_received`, `closed_no_offer`, `draft` (oferta), `sent`, `viewed`, `accepted_by_student`, `rejected_by_student`, `expired`, `residence_payment_pending`, `residence_payment_reported`, `estured_fee_pending`, `estured_fee_processing`, `confirmed`, `receipt_pending`, `receipt_issued`, `cancelled_by_residence`, `cancelled_by_student`, `disputed`.

*(Nota: separados en `renewal_request` y `renewal_offer` según `04_STATE_MACHINES.md` — evitar el solapamiento conceptual que tenía la versión original.)*

### 20.2 La pantalla debe mostrar

Estudiante; residencia; reserva original; período de renovación; tarifa actual; base del fee; monto del fee (**misma lógica que reserva inicial, sin excepciones**); estado del pago a residencia; estado del fee EstuRed; estado del comprobante; **estado de la factura fiscal**; fecha de vencimiento de la oferta.

### 20.3 Acciones admin

Ver renovación; cancelar; reabrir; confirmar manualmente con evidencia; disparar reintento de fee; generar o reemitir comprobante de renovación; abrir caso de soporte.

---

## 21. Administración de comunidad

**Ruta:** `/admin/community`

Propósito: monitorear visibilidad y privacidad de residentes.

### 21.1 La pantalla debe mostrar

Residencia; habitación/plaza; estado del residente; estado de visibilidad; estado de activación; reportes; estado de consentimiento/auditoría.

### 21.2 Estados de residente

`created_by_residence`, `pending_activation`, `active`, `visibility_limited`, `hidden_by_user`, `inactive`.

### 21.3 Acciones admin

Ocultar perfil; restaurar visibilidad de perfil; reenviar invitación de activación; revisar reportes; marcar residente como inactivo; auditar historial de consentimiento.

### 21.4 Regla de privacidad

Datos nunca visibles públicamente: apellido completo, email, teléfono, fecha de nacimiento, universidad, documentos.

---

## 22. Soporte y resolución de conflictos (admin)

**Ruta:** `/admin/support-cases`

*(Renombrado desde "Mediations" — se evita el término "mediación" en comunicación pública por sus implicancias legales bajo la Ley 26.589 de Argentina; internamente puede seguir usándose para búsqueda/documentación técnica.)*

Propósito: gestionar reportes, reclamos y casos de soporte.

### 22.1 Estados del caso

`opened`, `terms_reminder_shown`, `submitted`, `under_review`, `needs_more_info`, `waiting_other_party`, `in_progress`, `resolved_by_agreement`, `closed_no_action`, `closed_unresolved`, `admin_action_taken`.

### 22.2 Datos del caso

Reportante; parte reportada; residencia si aplica; solicitud/reserva/renovación relacionada; **propuesta del familiar o negociación relacionada si el caso surge de una disputa sobre condiciones acordadas por WhatsApp**; archivos de evidencia; línea de tiempo; notas internas; respuesta pública si existe; decisión admin.

### 22.3 Acciones admin

Revisar caso; pedir más evidencia; contactar a la otra parte; adjuntar evidencia; cerrar sin acción; cerrar sin resolver; marcar resuelto por acuerdo; aplicar penalización; suspender usuario o residencia; disparar reembolso del fee cuando corresponda.

### 22.4 Regla importante

Abrir un caso de soporte no pausa automáticamente una solicitud, reserva o renovación. El admin puede pausar manualmente si es necesario.

---

## 23. Visibilidad y penalizaciones (admin)

**Ruta:** `/admin/visibility`

Propósito: gestionar ranking interno, visibilidad y penalizaciones de calidad.

### 23.1 Estados de visibilidad

`normal_visibility`, `warning`, `reduced_visibility`, `temporarily_paused`, `suspended`, `removed_from_network`.

### 23.2 Ponderación aprobada para MVP

Respuesta y velocidad: 25%. Disponibilidad actualizada: 20%. Conversión a reserva: 20%. Perfil completo/verificado: 15%. Baja tasa de reclamos validados: 10%. Uso operativo de la plataforma: 10%.

### 23.3 Factores a monitorear

Tasa de respuesta baja; tiempo de respuesta lento; solicitudes vencidas; rechazos por falta de disponibilidad; disponibilidad desactualizada; cancelaciones atribuibles a residencia; reclamos validados; información engañosa; violaciones de términos; **tasa de propuestas de ajuste vencidas sin respuesta** (nuevo — puede ser señal de mala fe operativa).

### 23.4 Acciones admin

Emitir advertencia; reducir visibilidad; pausar temporalmente; suspender; remover de la red; restaurar visibilidad normal; agregar nota interna.

No debe mostrarse ranking público en el MVP.

---

## 24. Administración de notificaciones

**Ruta:** `/admin/notifications`

Propósito: monitorear notificaciones críticas y estado de entrega.

### 24.1 Canales de notificación

Email (respaldo obligatorio). In-app. **WhatsApp NO es un canal de notificación automática — es únicamente un botón pre-formateado que la residencia dispara manualmente hacia el estudiante/familiar. No hay integración de WhatsApp Business API en el MVP.**

Al menos un canal de notificación debe estar habilitado por el usuario.

### 24.2 Eventos a monitorear

Solicitud enviada; solicitud recibida por residencia; recordatorio diario a residencia; **propuesta del familiar creada / aprobada / rechazada / vencida**; contacto establecido (**timestamp del botón de WhatsApp presionado, no un envío del sistema**); **propuesta de ajuste enviada / respondida / vencida**; timer de 48 horas para pago del estudiante; vencimiento de solicitud (48h); pago a residencia reportado; fee pendiente; fee fallido; fee pagado; **factura fiscal emitida / fallida**; reserva confirmada; comprobante emitido; disponibilidad en lista de espera; confirmación de lista de espera a 90 días; oferta de renovación enviada; renovación aceptada; caso de soporte abierto; acción admin tomada.

### 24.3 Acciones admin

Reenviar notificación; marcar notificación como fallida; ver estado de entrega; ver template; deshabilitar canal roto.

---

## 25. Administración de tipo de cambio

**Ruta:** `/admin/exchange-rate`

Propósito: monitorear el tipo de cambio oficial usado para visualización y cálculo del fee.

### 25.1 Reglas

- Tarifas mostradas en USD y ARS.
- **Fuente confirmada: monedapi.ar — dólar blue, valor de venta.**
- El fee puede cobrarse en ARS (MercadoPago) o USD (PayU Argentina), no solo en ARS.
- La conversión usa el tipo de cambio diario de la fuente confirmada.
- Admin puede hacer override manual si la fuente falla, **con motivo obligatorio**.
- Cada solicitud guarda un snapshot del tipo de cambio usado al momento de enviarse (o de aceptar la propuesta de ajuste, si hubo negociación).

### 25.2 La pantalla debe mostrar

Tipo de cambio ARS/USD actual; fuente (monedapi.ar); hora de última actualización; estado de actualización automática; estado de override manual; valores históricos; alertas de actualización fallida.

### 25.3 Acciones admin

Forzar actualización; establecer override manual (motivo obligatorio); quitar override; agregar nota interna.

---

## 26. Audit log

**Ruta:** `/admin/audit-log`

Propósito: dar trazabilidad a las acciones críticas.

### 26.1 Debe auditar

Creación de usuario; cambios de rol; cambios de vínculo familiar; **creación, aprobación y rechazo de propuestas del familiar**; ediciones de residencia; cambios de precio; cambios de verificación; cambios de disponibilidad; cambios de estado de solicitud; **envío y respuesta de propuestas de ajuste (negociación)**; cambios de estado de reserva; pago a residencia reportado; cambios de pago de fee; **emisión, anulación o reintento de factura fiscal**; generación, anulación o reemisión de comprobante; acciones de renovación; acceso a documentos (**con justificación registrada**); eliminación de documentos; casos de soporte; penalizaciones; overrides de admin; reembolsos; suspensiones; **cambios de feature flag freemium por residencia**.

### 26.2 Campos del registro de auditoría

ID; tipo de actor (usuario, admin, superadmin, sistema, webhook); ID del actor; tipo de entidad; ID de entidad; acción; valor anterior; valor nuevo; motivo; timestamp; IP/dispositivo cuando esté disponible; ID de solicitud relacionada si aplica.

### 26.3 Acciones admin

Los audit logs deben ser de solo lectura para admins normales. Solo el superadmin puede exportar logs, si se implementa. Los audit logs no deben ser editables.

---

## 27. Configuración admin

**Ruta:** `/admin/settings`

Propósito: configurar reglas a nivel de plataforma.

### 27.1 Configuración exclusiva de superadmin

Ponderaciones del score de visibilidad; **configuración de proveedores de pago (MercadoPago, PayU Argentina)**; **configuración del proveedor de tipo de cambio (monedapi.ar)**; **configuración de la integración de facturación fiscal (TusFacturas.app)**; porcentaje del fee; regla de redondeo del fee; límite de solicitudes activas; tamaño de cola por plaza; plazos de pago (48h); período de validez de verificación; templates de notificación; versiones de texto legal; gestión de roles admin.

### 27.2 Regla importante

Cambiar configuración crítica de negocio debe versionarse.

Ejemplo: si el porcentaje del fee cambia en el futuro, las reservas existentes deben conservar su snapshot original.

---

## 28. Estados vacíos requeridos

Sin verificaciones pendientes; sin solicitudes abiertas; **sin propuestas del familiar pendientes**; **sin negociaciones activas**; sin alertas de tarifa; sin pagos fallidos; **sin facturas fiscales fallidas**; sin casos de soporte abiertos; sin comprobantes pendientes; sin disponibilidad desactualizada; sin entradas en lista de espera; sin renovaciones pendientes.

Los estados vacíos deben ser operativos, no decorativos.

Ejemplo:

```
Sin alertas de precio por ahora. Los cambios superiores a ±15% van a aparecer acá.
```

---

## 29. Estados de error requeridos

Falla de webhook del proveedor de pago; falla de webhook de facturación fiscal; falla en generación de comprobante; QR faltante; **código de verificación inválido en `/verify/[codigo]`**; documento faltante; permiso denegado; entidad ya modificada por otro admin; transición de estado inválida; falla al actualizar tipo de cambio; falla de entrega de notificación; falla al subir a storage; **intento de segunda propuesta de ajuste bloqueado por constraint**.

---

## 30. Confirmaciones requeridas

Las siguientes acciones admin deben mostrar un modal de confirmación:

Suspender residencia; remover residencia de la red; confirmar reserva manualmente; cancelar reserva; emitir reembolso; anular comprobante; reemitir comprobante; **anular o reemitir factura fiscal**; cambiar penalización de visibilidad; bloquear usuario; eliminar o restringir documento; hacer override de tipo de cambio; cambiar configuración crítica de negocio; **otorgar o revocar acceso freemium a Gestión Operativa**.

El modal de confirmación debe incluir: resumen de la acción, consecuencias, motivo obligatorio, checkbox de confirmación final para acciones de alto riesgo.

---

## 31. Casos de QA para el panel admin

Claude Code debe implementar o preservar testabilidad para estos casos:

1. Admin aprueba verificación de residencia.
2. Admin rechaza verificación y pide cambios.
3. Admin ve alerta de precio tras cambio de tarifa mayor al 15%.
4. Admin revisa solicitud rechazada por falta de disponibilidad.
5. Admin pausa manualmente una residencia.
6. Admin restaura una residencia pausada.
7. Admin valida un pago manual del fee → **se dispara automáticamente la emisión de Factura C**.
8. Admin dispara reemisión de comprobante.
9. Admin abre un caso de soporte desde una reserva.
10. Admin aplica visibilidad reducida.
11. Admin quita visibilidad reducida.
12. Admin ve el log de acceso a documentos (**con justificación registrada**).
13. Admin no puede editar el audit log.
14. Admin cambia el override de tipo de cambio y el sistema guarda la entrada de auditoría.
15. Admin intenta una transición de estado inválida y el sistema la bloquea.
16. Superadmin cambia las ponderaciones del score de visibilidad.
17. Admin normal no puede cambiar configuración exclusiva de superadmin.
18. Falla de generación de comprobante aparece en el dashboard.
19. Falla de notificación aparece en administración de notificaciones.
20. Recordatorio de lista de espera a 90 días aparece en logs de notificación.
21. **Admin ve propuesta del familiar vencida en `/admin/family-proposals`.**
22. **Admin ve negociación vencida sin respuesta en `/admin/negotiations`.**
23. **Admin reintenta emisión de factura fiscal fallida.**
24. **Admin otorga acceso freemium a residencia pionera con fecha límite, queda auditado.**
25. **Admin intenta forzar una segunda propuesta de ajuste en nombre de la residencia → bloqueado por constraint, debe usar override auditado explícito si es excepcional.**
26. **Admin revisa reserva confirmada con factura fiscal en estado `issue_failed` — el comprobante existe igual, la reserva no queda bloqueada.**

---

## 32. Reglas para Claude Code

1. No crear acciones admin que evadan el audit logging.
2. No permitir validación de permisos admin solo del lado del cliente.
3. Usar validación server-side para toda transición de estado.
4. No exponer documentos completos salvo que el permiso y el contexto lo permitan, y con justificación registrada.
5. No permitir que residencias se publiquen sin verificación.
6. No confirmar reservas salvo que el fee EstuRed esté pagado o exista un override de admin explícitamente registrado.
7. No emitir comprobantes antes de confirmar la reserva o renovación.
8. No emitir factura fiscal antes de que el fee esté pagado.
9. No fusionar responsabilidades de admin dentro de los dashboards públicos de usuario.
10. Mantener las rutas admin separadas bajo `/admin`.
11. Usar modales de confirmación explícitos para acciones destructivas o de alto riesgo.
12. Mantener abstraída la lógica de proveedor de pago (`PaymentProvider`: MercadoPago, PayU).
13. Mantener abstraída la lógica de proveedor de tipo de cambio (`ExchangeRateProvider`: monedapi.ar).
14. Mantener abstraída la lógica de facturación fiscal (TusFacturas.app) detrás de una interfaz propia.
15. Usar DTOs y nunca exponer filas crudas de base de datos innecesariamente.
16. Todo override manual debe requerir motivo.
17. No implementar rankings públicos basados en métricas internas de visibilidad en el MVP.
18. No permitir que el admin cree o modifique una propuesta de ajuste en nombre de la residencia fuera de un override explícito y auditado.
19. Respetar el límite de una sola propuesta de ajuste por solicitud también en el panel admin.
20. No bloquear la confirmación de una reserva por una falla en la emisión de la factura fiscal — la factura se reintenta de forma independiente.

---

## 33. Decisiones pendientes no bloqueantes

No bloquean la construcción de la estructura del panel admin, pero deben resolverse antes del lanzamiento público:

- Revisión legal final de términos y condiciones.
- SLA o política de respuesta exacta para casos de soporte.
- Proceso exacto de reembolso.
- ~~Política de 2FA~~ → Resuelto: 2FA (TOTP vía Supabase Auth MFA) obligatorio para admin y superadmin desde la beta privada.
- Política de retención de datos para documentos y evidencia de casos de soporte.
- Precio del plan pago de Gestión Operativa (impacta el copy de `/admin/residences/[id]/plan`).
- Umbral y proceso de aviso al acercarse al límite de facturación del monotributo.

---

## 34. Preguntas resueltas — DECISIONES CONFIRMADAS

1. **Conversación de WhatsApp:** el admin **nunca** ve el contenido de la conversación (no hay integración de API). Si un caso de soporte necesita esa evidencia, se sube manualmente como captura de pantalla (§22.2). — CONFIRMADO.
2. **Factura fiscal fallida (§15.4):** es aceptable que exista una reserva confirmada con Factura C en `issue_failed` temporalmente; la factura se reintenta por job y el estado debe ser visible en `/admin/invoices`. La reserva nunca se bloquea por facturación. — CONFIRMADO.
3. **Familiar con alta tasa de propuestas rechazadas (§11.4):** queda como **métrica pasiva** que el admin revisa manualmente; sin marca automática en el MVP. — CONFIRMADO.

Estas decisiones también están registradas en `00_DECISION_LOG.md` §28.1.

## 35. Revocaciones del fee (admin) — sección nueva

Las revocaciones ejercidas desde el enlace del footer (`07_API_SPEC.md` §18.6) abren automáticamente un `support_case` interno de categoría revocación. El admin debe:

- ver las revocaciones pendientes de revisión (dashboard y `/admin/support-cases`);
- evaluar patrones de bypass (p. ej., revocar el fee tras usar el contacto para acordar por fuera);
- poder cotejar con la residencia antes de resolver;
- resolver manualmente el reembolso (o su denegación) con motivo obligatorio y auditoría, desde `/admin/payments`.

El fee permanece `paid` hasta la resolución; el reembolso nunca es automático.
