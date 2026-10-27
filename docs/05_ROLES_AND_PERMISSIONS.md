# 05_ROLES_AND_PERMISSIONS.md
# EstuRed — Roles, permisos y reglas de acceso

Versión: 0.2
Estado: Documento actualizado para construcción
Última actualización: 2026-10-24 (§4.7 y matriz: dueño y staff con permisos que elige el dueño, DR10 + DR11; §14bis: aviso "Quiero cambiar", DR3/DR3b)
Depende de: `00_DECISION_LOG.md`, `03_BUSINESS_RULES.md`, `04_STATE_MACHINES.md`

---

## 1. Propósito del documento

Este documento define la matriz oficial de roles y permisos para el MVP de EstuRed.

Debe usarse como referencia obligatoria para diseñar:

- autenticación y autorización;
- dashboards;
- RLS (Row Level Security) en Supabase/PostgreSQL;
- endpoints / server actions;
- componentes visibles por rol;
- acciones auditables;
- visibilidad de datos personales;
- seguridad de documentos;
- operaciones admin;
- QA de permisos.

**Regla principal:** ningún usuario debe poder ver, editar, crear, confirmar, cancelar, pagar o aprobar algo si su rol no lo permite explícitamente.

Claude Code no debe inferir permisos nuevos sin actualizar este documento.

---

## 2. Principios de permisos

### 2.1. Permisos explícitos

Los permisos deben ser explícitos. No se debe asumir que un usuario puede hacer una acción solo porque puede ver una pantalla.

Ejemplo: un usuario de residencia puede ver una solicitud, pero eso no significa que pueda aceptarla, rechazarla o marcar pago recibido.

---

### 2.2. Seguridad del lado servidor

La UI puede ocultar botones, pero la protección real debe existir en backend/base de datos.

Toda acción crítica debe validarse server-side. El cliente nunca cambia estados críticos directamente.

---

### 2.3. Auditoría obligatoria

Toda acción crítica debe quedar auditada. Acciones críticas incluyen:

- creación y aprobación/rechazo de propuesta de solicitud del familiar;
- envío de solicitud;
- envío de propuesta de ajuste por residencia;
- aceptación/rechazo de propuesta de ajuste por estudiante;
- rechazo de solicitud;
- contacto establecido;
- pago recibido marcado por residencia;
- pago de fee EstuRed;
- emisión, reemisión o anulación de comprobante;
- creación, edición, aceptación o cancelación de renovación;
- cambios de precios, disponibilidad, reglas o condiciones;
- cambios de visibilidad de perfil;
- carga, visualización o descarga de documentos sensibles;
- acciones admin (toda intervención);
- suspensiones y penalizaciones;
- reembolsos;
- override de tipo de cambio;
- cambio de feature flag de plan por residencia.

---

### 2.4. Mínimo acceso necesario

Cada rol debe acceder solo a la información necesaria para cumplir su función.

Aplica especialmente a: documentos, datos personales, datos de contacto, fecha de nacimiento, universidad, información de pago, comprobantes, datos familiares.

---

### 2.5. Consentimiento y visibilidad configurada

La comunidad visible depende de datos ingresados por estudiantes y residentes, más las preferencias de visibilidad que acepten durante el registro o desde su perfil.

Una residencia puede invitar a un residente a activar su cuenta, pero no puede obligarlo a mostrar su perfil completo.

---

### 2.6. Separación entre cuenta y perfil

Una cuenta de usuario puede tener distintos perfiles asociados:

- una cuenta puede ser estudiante;
- una cuenta puede ser familiar vinculado;
- una cuenta puede ser owner de hasta 10 residencias;
- una cuenta puede ser staff de una o más residencias (cada vínculo lo crea el dueño de esa residencia al invitarla por email);
- un familiar puede estar vinculado a más de un estudiante;
- un estudiante solo puede tener un familiar vinculado activo.

---

### 2.7. Loop central protegido

Los permisos del MVP deben proteger el loop central:

```
Estudiante (o familiar con aprobación del estudiante) solicita
→ residencia establece contacto
→ [negociación opcional: solo la residencia propone, 1 vez]
→ estudiante acepta condiciones finales
→ estudiante paga a residencia
→ residencia marca pago recibido
→ EstuRed cobra fee
→ reserva confirmada
→ comprobante emitido
```

---

### 2.8. Multi-residencia y contexto activo

Un owner puede gestionar hasta **10 residencias** desde el mismo login.

El sistema opera en el contexto de la residencia activa seleccionada.

Un staff puede tener acceso a múltiples residencias si el dueño de cada una lo invita explícitamente (un vínculo en `residence_users` por residencia).

**Un staff no puede ver datos de una residencia a la que no fue asignado, aunque pertenezca al mismo owner.**

---

## 3. Roles principales

Los roles oficiales del MVP son:

1. `guest`
2. `registered_user`
3. `student`
4. `student` menor de edad — **no es un rol separado en el enum `user_role` de `06_DATA_MODEL.md`**: es un estudiante con `is_minor = true` y reglas adicionales (ver 4.4)
5. `linked_family`
6. `residence_owner`
7. `residence_staff`
8. `estured_admin`
9. `estured_superadmin`
10. `system`

---

## 4. Definición de cada rol

### 4.1. Guest / Invitado

Usuario no autenticado.

**Puede:**

- ver landing;
- buscar residencias publicadas;
- ver fichas públicas de residencias;
- ver información general de precios, ubicación, servicios, reglas y disponibilidad sujeta a confirmación;
- ver comunidad visible en versión muy limitada (nombre + inicial y foto si el estudiante lo permitió);
- iniciar registro;
- iniciar el formulario de solicitud, pero debe registrarse antes de enviarla.

**No puede:**

- enviar solicitudes;
- pagar fee;
- reservar;
- ver datos completos de residentes;
- ver documentos;
- ver datos de contacto;
- ver apellido completo, mail, teléfono, fecha de nacimiento, universidad o documentos de estudiantes;
- entrar en lista de espera;
- acceder a dashboards;
- abrir reclamos;
- descargar comprobantes.

---

### 4.2. Registered User / Usuario registrado base

Usuario autenticado que todavía no completó un rol operativo.

**Puede:**

- completar su perfil;
- elegir rol;
- configurar visibilidad básica;
- ver información ampliada de residencias;
- ver perfiles de comunidad según permisos configurados por cada residente;
- guardar favoritos si completa rol estudiante o familiar vinculado;
- solicitar vinculación familiar si corresponde.

**No puede:**

- enviar solicitudes sin completar perfil mínimo de estudiante;
- administrar residencias;
- ver documentos de otros usuarios;
- pagar reservas si no está vinculado a una operación válida;
- acceder a admin.

---

### 4.3. Student / Estudiante

Usuario principal del lado demanda.

**Requisitos mínimos para enviar solicitud:**

- nombre;
- apellido (solo para uso interno y documentos);
- nacionalidad;
- fecha de nacimiento;
- lugar donde va a estudiar;
- carrera u objetivo académico;
- duración inicial declarada;
- aceptación de términos y condiciones;
- aceptación de política de privacidad;
- aceptación de reglas de visibilidad;
- medio de contacto válido;
- método preferido para notificaciones.

**Puede:**

- buscar residencias;
- ver fichas completas según su nivel de acceso;
- ver comunidad visible configurada por residentes;
- guardar favoritos;
- enviar hasta 2 solicitudes activas;
- aprobar o rechazar propuestas de solicitud del familiar;
- aceptar o rechazar propuestas de ajuste de condiciones enviadas por la residencia;
- entrar en listas de espera;
- activar solicitud desde lista de espera;
- cancelar solicitudes antes de confirmar reserva;
- subir documentación a su perfil;
- autorizar documentación para una solicitud;
- subir comprobante de pago realizado a residencia para referencia;
- pagar fee EstuRed (en ARS con MercadoPago o en USD con PayU);
- acceder y descargar Comprobante de Reserva Confirmada;
- solicitar renovación (genera notificación a la residencia, no oferta vinculante);
- aceptar o rechazar ofertas de renovación;
- pagar fee de renovación;
- descargar comprobantes;
- abrir reclamos;
- configurar visibilidad de su perfil;
- vincular o desvincular un familiar si es mayor de edad.

**No puede:**

- confirmar su propia reserva;
- marcar pago recibido por la residencia;
- emitir comprobantes manualmente;
- editar datos de residencia;
- modificar disponibilidad;
- ver documentos internos de residencia;
- ver datos sensibles de otros estudiantes;
- tener más de 2 solicitudes activas;
- tener más de un familiar vinculado activo;
- modificar la propuesta de solicitud del familiar (solo aprobar o rechazar);
- modificar la propuesta de ajuste de la residencia (solo aceptar o rechazar).

**Permisos sobre solicitudes:**

Puede: crear solicitud, enviar solicitud, aprobar/rechazar propuesta del familiar, ver estado de solicitud, cancelar antes de confirmación, responder pedido de información adicional, subir documentos para la solicitud, ver condiciones del snapshot original y condiciones propuestas (comparación), aceptar/rechazar propuesta de ajuste, pasar desde lista de espera a solicitud activa.

No puede: cambiar estado a `contact_established`, `residence_payment_reported` o `reservation_confirmed`. No puede reactivar solicitud vencida sin acción del sistema o intervención admin.

---

### 4.4. Estudiante menor de edad (atributo `is_minor`, no rol separado)

Estudiante menor de 18 años. Tiene permisos similares al estudiante, con restricciones adicionales.

**Regla de contacto:** cuando el estudiante es menor, el contacto de la residencia se dirige **siempre** al familiar vinculado (`contact_target = family_member`), incluso si la solicitud fue iniciada por el propio estudiante.

**Reglas especiales:**

- No puede finalizar registro sin familiar vinculado activo.
- No puede enviar solicitud sin familiar vinculado activo.
- No puede pagar fee si las reglas legales o del proveedor de pago no lo permiten.
- El familiar vinculado debe aceptar términos específicos para menores.
- Admin debe poder identificar estudiantes menores desde panel interno.
- Si el familiar se desvincula y el estudiante queda sin familiar activo, el sistema bloquea acciones sensibles y notifica al admin (estado `suspended_minor_no_family` en `family_link`).

**Puede:**

- completar perfil con asistencia del familiar;
- buscar residencias;
- guardar favoritos;
- aprobar o rechazar propuestas de solicitud del familiar;
- configurar visibilidad dentro de límites legales;
- acceder a su dashboard.

**No puede:**

- operar sin familiar vinculado activo;
- desvincular familiar mientras siga siendo menor;
- completar reserva sin participación del familiar cuando corresponda.

---

### 4.5. Linked Family / Padre, madre o familiar vinculado

Usuario secundario clave. Acompaña al estudiante, pero no reemplaza su decisión.

Debe registrarse y vincularse con un estudiante. El estudiante debe aprobar la vinculación.

**Reglas de vinculación:**

- Un estudiante puede tener un solo familiar vinculado activo.
- Un familiar puede vincularse a más de un estudiante.
- El estudiante mayor de edad puede revocar el vínculo.
- El familiar puede desvincularse.
- Si el estudiante es menor, la desvinculación bloquea acciones sensibles hasta que se vincule otro familiar o el admin intervenga.

**Puede:**

- ver dashboard compartido con permisos limitados;
- ver favoritos del estudiante;
- sugerir/agregar residencias a favoritos;
- **crear propuestas de solicitud** para el estudiante (quedan en `pending_student_approval` hasta aprobación del estudiante — nunca van directamente a la residencia);
- **seguir** el estado de las solicitudes y reservas del estudiante vinculado, con textos en tercera persona (DR4);
- subir comprobantes de pago a residencia para referencia;
- **editar su propio perfil** (nombre, teléfono, relación con el estudiante, datos de facturación del pagador y consentimientos; DR4, `docs/00` §31);
- pagar fee EstuRed (en ARS con MercadoPago o en USD con PayU);
- pagar fee de renovación;
- ver y descargar comprobantes;
- ver estado de reserva;
- recibir notificaciones si fue configurado;
- abrir contacto/consulta vinculada a una reserva o solicitud del estudiante;
- participar en resolución de conflictos si está asociado a la operación.

**No puede:**

- enviar solicitudes directamente a la residencia sin aprobación del estudiante;
- **editar el perfil ni los documentos del estudiante, ni cargar documentación en su nombre** (DR4);
- **ver los mensajes privados del estudiante** (p. ej. el mensaje del aviso "Quiero cambiar"; DR4);
- decidir por el estudiante;
- aceptar propuestas de ajuste de la residencia en nombre del estudiante;
- modificar una propuesta de solicitud ya enviada al estudiante;
- aceptar o rechazar renovaciones en nombre del estudiante;
- modificar visibilidad del perfil del estudiante;
- desvincular al estudiante de una residencia;
- cancelar una reserva confirmada;
- ver datos que el estudiante no autorizó, salvo requerimientos por minoridad;
- acceder a perfiles de otros estudiantes fuera del contexto permitido;
- **cancelar solicitudes del estudiante, incluso las que él mismo originó mediante propuesta** (la cancelación es siempre decisión del estudiante o del admin).

**Cuando el familiar inicia la solicitud:**

- La solicitud se crea con `initiated_by = family_member` y `contact_target = family_member`.
- Cuando la residencia establece contacto, el botón de WhatsApp usa el número del **familiar**, no del estudiante.
- Si la solicitud fue aprobada por el estudiante y originada por el familiar, el contacto de la residencia sigue siendo con el familiar.
- **Al crear una propuesta, el familiar acepta expresamente que, si el estudiante la aprueba, su número de teléfono será compartido con la residencia como destino del contacto** (consent `family_contact_disclosure`, registrado en `consents`). El mismo consentimiento aplica cuando el estudiante es menor y el familiar es el `contact_target` por regla.

**Pagos hechos por familiar:**

- La Factura C del fee EstuRed se emite a nombre del familiar pagador, con los datos de facturación (CUIT/DNI y condición de IVA) guardados en su perfil (DR4).
- El familiar pagador ve el desglose de costos y la pantalla de pago del fee (`docs/08` §6.8) para las reservas que el estudiante le asigna como pagador.
- **Avisos que recibe el familiar (DR4):** hitos clave y todo lo relacionado con pagos (propuestas aprobadas/rechazadas, solicitud aceptada, pago a la residencia pedido, fee a pagar y su plazo, reserva confirmada, comprobante, vencimientos, aviso de "Quiero cambiar" de un menor para confirmar). No recibe mensajes privados ni cada movimiento menor.
- El Comprobante de Reserva Confirmada se emite a nombre del estudiante.
- El comprobante puede indicar al familiar como pagador o vinculado.

---

### 4.6. Residence Owner / Owner de residencia

Usuario principal del lado oferta. Tiene control sobre sus residencias dentro de EstuRed (hasta 10).

**Puede:**

- crear o administrar hasta 10 residencias desde el mismo login;
- completar perfil de cada residencia;
- aceptar términos de residencia;
- cargar datos de responsables, DNI, fotos, reglas, servicios, condiciones de reserva;
- configurar tarifas, matrícula, depósito, política de ajustes;
- configurar tipos de habitación, habitaciones y plazas (Gestión Operativa);
- cargar y actualizar disponibilidad;
- marcar residencia como completa;
- pausar solicitudes;
- recibir y revisar solicitudes;
- establecer contacto (botón WhatsApp pre-formateado);
- **enviar propuesta de ajuste de condiciones** (1 vez por solicitud, solo la residencia puede hacerlo);
- rechazar solicitudes con motivo interno (enum);
- marcar pago recibido (con confirmación explícita y aceptación de términos);
- gestionar lista de espera;
- contactar estudiantes de lista de espera sin activar solicitud automáticamente;
- invitar por email a staff de cada una de sus residencias y quitarles el acceso (pantalla "Equipo", DR10, `docs/00` §31) y **elegir, staff por staff, qué acciones puede hacer** (10 permisos, DR11);
- ver métricas básicas de sus residencias;
- crear ofertas de renovación;
- confirmar pagos de renovación;
- gestionar residentes (Gestión Operativa);
- crear residentes con email e invitarlos a activar cuenta;
- ver comunidad de su residencia según reglas;
- cargar FAQ y respuestas estructuradas;
- abrir reclamos o responder resoluciones de conflicto;
- descargar comprobantes vinculados a su residencia.

**No puede:**

- publicar sin verificación presencial aprobada;
- editar información crítica que requiere aprobación y verla publicada sin revisión admin;
- manipular métricas;
- eliminar auditoría;
- confirmar reserva si el fee EstuRed no fue pagado;
- emitir comprobantes EstuRed manualmente;
- forzar visibilidad completa de residentes;
- ver datos sensibles de estudiantes fuera de solicitudes o residentes vinculados;
- rechazar por criterios discriminatorios;
- enviar más de 1 propuesta de ajuste por solicitud;
- cobrar o gestionar fee EstuRed;
- ver datos de pago internos de EstuRed salvo estado necesario.

**Permisos tarifarios:**

Puede editar tarifas, matrícula, depósito, política de ajustes, moneda de publicación y conceptos obligatorios de reserva sin aprobación previa del admin. Pero:

- quedan auditados;
- generan alerta admin si suben o bajan más del 15% en una sola edición;
- no modifican snapshots de solicitudes ya enviadas;
- no modifican condiciones de solicitudes activas sin propuesta formal aceptada por el estudiante.

---

### 4.7. Residence Staff / Staff de residencia *(redefinido por DR10 y DR11, 2026-10-24)*

Usuario invitado por email por el **dueño** de una residencia (pantalla "Equipo", `docs/08` §7.20). Hay dos roles por residencia: dueño (`residence_users.role = owner`) y staff (`residence_users.role = staff`). El rol vale **por residencia**: una misma cuenta puede ser dueña de una y staff de otra, con **permisos distintos en cada una**, y un staff solo ve y toca las residencias donde tiene un vínculo activo en `residence_users` (nunca otra, aunque comparta dueño o email).

**Qué puede hacer el staff lo elige el dueño** (DR11, `docs/00` §31). Los permisos viven en `residence_users.permissions` (jsonb, por miembro y por residencia; no hace falta migración) y se eligen al invitar y después en cualquier momento desde la pantalla Equipo. El dueño siempre puede todo. Hay **10 permisos**, con su valor inicial:

| # | Clave | Qué habilita | Inicial |
|---|---|---|:---:|
| 1 | `applications.review_contact` | Revisar solicitudes y establecer contacto | Sí |
| 2 | `applications.reject` | Rechazar solicitudes | Sí |
| 3 | `payments.residence` | Habilitar el pago a la residencia y marcar pago recibido | Sí |
| 4 | `applications.send_adjustment` | Proponer un ajuste de condiciones (cambia precio o fechas) | **No** |
| 5 | `operations.rooms_availability` | Habitaciones, camas y disponibilidad (incluye pausar solicitudes por tipo) | Sí |
| 6 | `residents.manage` | Residentes: altas, salidas, notas, responder "Quiero cambiar" y salidas anticipadas | Sí |
| 7 | `renewals.manage` | Renovaciones: crear y enviar ofertas, marcar el pago | Sí |
| 8 | `waitlist.manage` | Lista de espera | Sí |
| 9 | `faq.manage` | Preguntas de la ficha: responder, ocultar, restaurar | Sí |
| 10 | `profile.edit` | Guardar el perfil, las tarifas y las condiciones de reserva (el envío a verificación sigue siendo del dueño) | **No** |

**Siempre disponible para todo staff activo, sin casillero:** ver el panel y las pantallas en solo lectura (incluido el perfil), abrir un caso de Soporte y recibir notificaciones del equipo.

**Solo el dueño, no delegable** (el servidor lo rechaza aunque el staff tenga todos los permisos): gestionar el equipo y los permisos (invitar, reenviar o cancelar invitaciones, quitar acceso, cambiar permisos), sumar otra residencia, **enviar o reenviar el perfil a verificación** y ver el reporte PDF del portfolio.

**Reglas del modelo.** Una clave **ausente** vale el valor inicial: los staff creados antes de DR11 (sin permisos guardados) conservan lo que ya hacían, salvo los permisos 4 y 10, que nunca tuvieron y quedan apagados. **Falla cerrado:** una clave desconocida, un valor que no sea booleano o un error de lectura no habilitan nada. El servidor decide con `assertResidencePermission` (el rol y los permisos salen siempre de la base, por residencia, nunca del formulario). Un cambio de permisos rige de inmediato. El dueño no puede editarse permisos a sí mismo ni a otro dueño (no aplica).

**Atajos** (solo rellenan los casilleros; reemplazan a los cuatro presets fijos que figuraban acá como evolución futura): «Solo lectura» (todo apagado), «Atención de solicitudes» (1, 2, 3, 8 y 9) y «Operación completa» (todo salvo 4 y 10).

**El staff tampoco puede** (con ningún permiso): eliminar la residencia, transferir ownership, ver datos fiscales de EstuRed, emitir comprobantes, procesar reembolsos, suspender estudiantes, modificar métricas, cambiar reglas globales, borrar auditoría, ni invitarse a sí mismo como dueño (la invitación solo crea staff).

---

### 4.8. EstuRed Admin / Admin operativo

Usuario interno de EstuRed. Gestiona operación diaria, soporte, verificación, auditoría y casos.

**Puede:**

- ver dashboard admin completo;
- gestionar verificaciones presenciales (programar visita, cargar checklist, aprobar/rechazar);
- aprobar o rechazar ediciones críticas de residencias;
- ver alertas de tarifas con variación mayor al 15%;
- ver, anular, pausar, reiniciar o editar solicitudes;
- confirmar reserva manualmente cuando existe confirmación expresa de la residencia (override auditado);
- emitir, reemitir o anular comprobantes;
- ver pagos de fee, marcar pago manual como recibido;
- iniciar reembolso manual si corresponde;
- gestionar resolución de conflictos;
- aplicar o quitar penalizaciones de visibilidad;
- suspender, bloquear o reactivar usuarios y residencias;
- ver documentos sensibles **con justificación registrada obligatoria** (se genera audit log);
- ver audit log completo;
- crear notas internas;
- enviar notificaciones manuales;
- override manual del tipo de cambio (queda auditado);
- gestionar feature flags de planes freemium por residencia (otorgar/revocar/extender acceso gratuito);
- gestionar listas de espera en casos excepcionales;
- ver métricas operativas;
- revisar motivos de rechazo por residencia;
- revisar rechazos por falta de disponibilidad;
- ver alertas de disponibilidad `not_updated` por más de 15 días.

**No puede:**

- borrar audit logs;
- cambiar reglas globales del sistema sin permiso superadmin;
- cambiar configuración de proveedores de pago;
- eliminar definitivamente datos sensibles sin proceso autorizado;
- crear otros admins salvo permiso especial;
- acceder a secretos técnicos;
- modificar código o configuración de infraestructura.

**Auditoría reforzada para admin:**

Toda acción admin debe registrar: admin_id, acción, entidad afectada, estado anterior, estado nuevo, **motivo obligatorio**, timestamp, evidencia si aplica.

---

### 4.9. EstuRed Superadmin

Rol interno de máximo privilegio.

**Puede:**

- todo lo que puede un admin;
- crear, desactivar o configurar admins;
- configurar parámetros globales y ponderaciones de métricas;
- configurar proveedores de pago (MercadoPago, PayU);
- configurar fuente de tipo de cambio (monedapi.ar);
- configurar integración de facturación (TusFacturas.app);
- configurar canales de notificación;
- acceder a logs avanzados;
- gestionar reglas del sistema;
- aprobar operaciones excepcionales;
- exportar datos operativos;
- administrar integraciones;
- gestionar backups y políticas internas si aplica.

**Incluso el superadmin debe quedar auditado en:**

- borrado de datos;
- modificación de pagos;
- modificación de reservas confirmadas;
- anulación de comprobantes;
- suspensión de residencias;
- acceso a documentos sensibles;
- cambio de permisos críticos.

---

### 4.10. System / Sistema

Rol técnico para automatizaciones y jobs.

**Puede:**

- enviar notificaciones automáticas;
- actualizar tipo de cambio diario (monedapi.ar);
- generar snapshots de solicitud;
- calcular fee estimado;
- redondear tarifas;
- marcar solicitudes vencidas (48h);
- pausar solicitudes alternativas;
- cerrar solicitudes por reserva confirmada;
- retirar estudiantes de listas de espera al confirmar reserva en otra residencia;
- enviar recordatorio de lista de espera a los 90 días;
- ejecutar intentos de cobro de fee (hasta 3 en 48h);
- generar comprobantes PDF + QR;
- crear alertas admin;
- calcular métricas internas;
- generar audit logs de eventos automáticos;
- marcar disponibilidad como `not_updated` cuando corresponda;
- disparar notificación de propuesta de solicitud del familiar al estudiante;
- marcar propuesta de solicitud como `expired` a las 48h sin respuesta;
- marcar propuesta de ajuste como `expired_offer_no_response` a las 48h sin respuesta.

**No puede:**

- aceptar solicitudes por residencia sin regla explícita;
- confirmar pago a residencia;
- inventar condiciones de reserva;
- cambiar precios sin acción de residencia o admin;
- aprobar verificación presencial;
- resolver reclamos sin intervención humana.

---

## 5. Matriz resumida de permisos por módulo

| Módulo / Acción | Guest | Student | Linked Family | Owner | Staff | Admin | Superadmin |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Ver landing | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Buscar residencias | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ver ficha pública | Limitado | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ver comunidad visible | Muy limitado | Según permisos | Según permisos | De su residencia | Según permisos | ✓ | ✓ |
| Crear propuesta de solicitud (familiar) | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Aprobar/rechazar propuesta del familiar | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Enviar solicitud | ✗ | ✓ | ✗ | ✗ | ✗ | Excepcional | Excepcional |
| Aceptar/rechazar propuesta de ajuste | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Cancelar solicitud propia | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Revisar solicitud | ✗ | Propia | Vinculada | ✓ | Con permiso `applications.review_contact` (DR11) | ✓ | ✓ |
| Establecer contacto | ✗ | ✗ | ✗ | ✓ | Con permiso `applications.review_contact` (DR11) | Excepcional | Excepcional |
| Enviar propuesta de ajuste (1 vez) | ✗ | ✗ | ✗ | ✓ | Con permiso `applications.send_adjustment` (apagado por defecto, DR11) | ✗ | ✗ |
| Marcar pago recibido residencia | ✗ | ✗ | ✗ | ✓ | Con permiso `payments.residence` (DR11) | Excepcional | Excepcional |
| Pagar fee EstuRed | ✗ | ✓ | ✓ | ✗ | ✗ | Manual | Manual |
| Ejercer revocación del fee (10 días) | ✗ | ✓ | ✓ solo si es el pagador, tiene vínculo activo y el estudiante es menor de edad (DR6) | ✗ | ✗ | Gestiona revisión | Gestiona revisión |
| Resolver una revocación (reintegrar fee / denegar, con motivo obligatorio — DR6) | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Emitir comprobante | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Descargar comprobante | ✗ | ✓ | ✓ | Vinculado | Vinculado | ✓ | ✓ |
| Crear residencia | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ |
| Editar residencia (perfil, tarifas, condiciones, política de salida) | ✗ | ✗ | ✗ | ✓ | Con permiso `profile.edit` (apagado por defecto, DR11); si no, solo lectura | ✓ | ✓ |
| Enviar o reenviar el perfil a verificación | ✗ | ✗ | ✗ | ✓ | ✗ (solo dueño, no delegable) | ✓ | ✓ |
| Aprobar verificación | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Gestionar el equipo y sus permisos (invitar, quitar acceso, cambiar permisos — DR10/DR11) | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ |
| Reporte PDF del portfolio | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| Gestionar disponibilidad | ✗ | ✗ | ✗ | ✓ | Con permiso `operations.rooms_availability` (DR11) | ✓ | ✓ |
| Gestionar habitaciones | ✗ | ✗ | ✗ | ✓ (GO) | Con permiso `operations.rooms_availability` (GO, DR11) | ✓ | ✓ |
| Gestionar residentes | ✗ | Propio | ✗ | ✓ (GO) | ✓ (GO) | ✓ | ✓ |
| Crear oferta de renovación | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Aceptar renovación | ✗ | ✓ | Puede pagar | ✗ | ✗ | Excepcional | Excepcional |
| Abrir reclamo | ✗ | ✓ | ✓ vinculado | ✓ | ✓ | ✓ | ✓ |
| Resolver reclamo | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Suspender residencia | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Bloquear usuario (no administrativo: estudiante, familiar, residencia — DR9) | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Bloquear/desbloquear a un admin o superadmin (DR9; nadie se auto-bloquea) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Ver audit log | ✗ | ✗ | ✗ | Limitado propio | Limitado si permiso | ✓ | ✓ |
| Override tipo de cambio | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Gestionar feature flags freemium | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |

*(GO) = solo en Modo Gestión Operativa*

---

## 6. Permisos sobre datos personales

### 6.1. Datos nunca visibles públicamente

Estos datos nunca deben mostrarse en perfiles públicos, comunidad visible, fichas públicas o vistas de usuarios no autorizados:

- apellido completo;
- email;
- teléfono;
- fecha de nacimiento;
- universidad;
- documentos;
- datos de pago;
- datos fiscales;
- datos familiares sensibles;
- comprobantes;
- notas internas;
- reclamos;
- mediaciones.

---

### 6.2. Datos visibles para invitados

Solo si el estudiante lo permitió: nombre + inicial, foto o avatar básico.

No se muestran hábitos, intereses completos ni datos ampliados.

---

### 6.3. Datos visibles para usuarios registrados

Según configuración del estudiante/residente:

- nombre + inicial;
- edad;
- nacionalidad/bandera;
- carrera;
- ciudad de origen;
- hábitos e intereses;
- foto real o avatar.

Registrados y compañeros ven la misma información visible según la configuración vigente del estudiante.

---

### 6.4. Datos visibles para residencia durante solicitud

Cuando un estudiante envía una solicitud, la residencia puede ver:

- perfil del estudiante (según datos completados y permisos);
- datos académicos declarados;
- duración inicial y fecha estimada de ingreso;
- hábitos de convivencia declarados;
- documentación cargada/autorizada para esa solicitud;
- datos del familiar vinculado si aplica (solo si la solicitud fue iniciada por el familiar o el familiar está vinculado);
- comprobantes vinculados a esa solicitud;
- estado de la solicitud.

No debe permitir descarga o visualización de datos sensibles sin registro de auditoría.

---

### 6.5. Documentos

Los documentos tienen permisos más estrictos que los datos de perfil.

Reglas:

- solo el estudiante, familiar vinculado, residencia asociada a una solicitud/reserva/renovación y admin autorizado pueden verlos;
- toda visualización o descarga debe quedar auditada;
- los documentos no deben aparecer en URLs públicas;
- deben almacenarse en storage privado (bucket `private-user-documents`, nombre alineado con `06_DATA_MODEL.md` §26 y `10_PRIVACY_AND_LEGAL_RULES.md` §28.3);
- los accesos deben ser temporales o firmados;
- la residencia solo accede a documentos vinculados a solicitudes, reservas, residentes o renovaciones de su propia residencia.

---

### 6.6. Acceso admin a documentos sensibles

Cuando el admin necesita ver documentos sensibles, debe:

1. Registrar una justificación obligatoria en el sistema antes del acceso.
2. El sistema genera un audit log con: admin_id, documento accedido, justificación, timestamp.
3. El superadmin puede revisar estos accesos.

---

## 7. Permisos sobre solicitudes

### 7.1. Crear propuesta de solicitud (familiar)

Solo el familiar vinculado puede crear una propuesta de solicitud.

La propuesta queda en `pending_student_approval`. No es visible para la residencia.

El estudiante puede aprobarla o rechazarla. No puede modificarla.

---

### 7.2. Crear y enviar solicitud

Solo el estudiante (mayor de edad o menor con familiar vinculado activo).

La propuesta aprobada del familiar se convierte en solicitud activa del estudiante.

Para enviarla, el estudiante debe **aceptar el reglamento de la residencia** (propio o modelo, DR14; §16bis). Si el estudiante es menor, lo acepta el familiar vinculado en su nombre; en una solicitud nacida de una propuesta del familiar, la aceptación se pide al aprobar la propuesta *(supuesto reversible)*.

---

### 7.3. Ver solicitud

Pueden verla: estudiante solicitante, familiar vinculado, residencia destinataria, staff con permiso, admin, superadmin.

---

### 7.4. Establecer contacto

Pueden hacerlo: residence_owner, residence_staff con el permiso `applications.review_contact` o `payments.residence` según la acción (DR11), admin en caso excepcional documentado.

El contacto se establece mediante botón WhatsApp pre-formateado. El sistema registra el timestamp como `contact_established`.

Si `contact_target = family_member`, el botón usa el número del familiar. Si el estudiante es menor de edad, `contact_target` es siempre `family_member`.

---

### 7.5. Enviar propuesta de ajuste de condiciones

`residence_owner`, o `residence_staff` solo si el dueño le encendió el permiso `applications.send_adjustment` (DR11; apagado por defecto). Sin ese permiso el staff igual puede habilitar el pago con las condiciones originales (`payments.residence`) o rechazar (`applications.reject`).

**Máximo 1 propuesta por solicitud.** El sistema bloquea un segundo intento con advertencia.

Antes de enviar, el sistema muestra advertencia obligatoria:

> Solo podés enviar una propuesta de ajuste por solicitud. Una vez enviada, no podés modificarla. Asegurate de haber acordado todos los detalles antes de continuar.

---

### 7.6. Aceptar o rechazar propuesta de ajuste

Solo el estudiante puede hacerlo.

El familiar no puede aceptar ni rechazar en nombre del estudiante.

---

### 7.7. Rechazar solicitud

Pueden hacerlo: residence_owner, residence_staff con el permiso `applications.reject` (DR11), admin en caso excepcional.

Debe registrar motivo interno (enum predefinido; si es `other`, requiere nota interna obligatoria).

Motivos válidos (enum): `no_availability`, `profile_incomplete`, `does_not_meet_criteria`, `already_assigned`, `dates_incompatible`, `duration_incompatible`, `no_response_from_student`, `residence_paused`, `other`.

---

### 7.8. Pausar y reiniciar solicitud

Pausar: automático por sistema o por admin.

Reiniciar: solo admin o superadmin, con motivo obligatorio.

---

## 8. Permisos sobre reservas

### 8.1. Crear reserva

La reserva se crea por transición del sistema cuando la residencia marca pago recibido y comienza el paso de fee EstuRed.

Ni estudiante ni residencia crean reserva manualmente desde cero.

---

### 8.2. Confirmar reserva

Una reserva queda confirmada solo cuando:

1. la residencia marcó pago recibido;
2. el fee EstuRed está pagado o validado por admin;
3. el sistema cambia la reserva a `confirmed`.

Residence owner/staff no puede confirmar reserva EstuRed si el fee no fue pagado.

Admin puede confirmar manualmente en casos trabados, con override auditado y motivo obligatorio.

---

### 8.3. Cancelar reserva

Puede cancelar: estudiante (según política y estado), residencia (con motivo), admin (por intervención), sistema (por vencimiento o no-show).

Toda cancelación queda auditada.

---

### 8.4. No-show

Residence owner o staff con el permiso `applications.review_contact` (DR11) puede marcar no-show si el estudiante no se presenta dentro de las 24 horas posteriores a la fecha acordada.

Admin puede revisar y revertir si hubo error.

---

## 9. Permisos sobre pagos y fee EstuRed

### 9.1. Pago a residencia

EstuRed no procesa directamente el pago a residencia en el MVP.

El estudiante paga por el medio indicado por la residencia. Puede subir comprobante para referencia.

### 9.2. Marcar pago recibido

Pueden hacerlo: residence_owner, residence_staff con el permiso `payments.residence` (DR11), admin en caso excepcional.

Esta acción requiere **confirmación explícita y aceptación de términos** antes de completarse. Queda auditada.

### 9.3. Pagar fee EstuRed

Pueden pagarlo: estudiante, familiar vinculado, admin manualmente si registra pago offline.

El pagador elige el proveedor: MercadoPago (ARS) o PayU (USD).

La Factura C se emite a nombre de quien paga.

El Comprobante de Reserva Confirmada queda a nombre del estudiante.

### 9.4. Reembolsos

Solo admin o superadmin pueden iniciar o registrar reembolso.

Aplica solo por: incumplimiento atribuible a residencia, cancelación atribuible a residencia, revisión EstuRed, normativa aplicable.

Debe requerir motivo y quedar auditado.

---

## 10. Permisos sobre comprobantes

### 10.1. Generación automática

El sistema genera Comprobante de Reserva Confirmada cuando la reserva está confirmada y el comprobante pasa a `pending_generation`.

### 10.2. Emisión manual o reemisión

Solo admin o superadmin. Debe registrar motivo. Queda auditado.

### 10.3. Descarga

Pueden descargar: estudiante, familiar vinculado, residencia asociada, staff con permiso, admin, superadmin.

### 10.4. Anulación

Solo admin o superadmin. Debe registrar motivo. Queda auditado.

### 10.5. Verificación pública

La URL `/verify/[codigo]` es pública. Cualquier persona puede verificar la autenticidad del comprobante sin autenticarse. No expone datos sensibles.

---

## 11. Permisos sobre residencia y verificación

### 11.1. Crear residencia

Puede iniciar: residence_owner, admin, superadmin. No puede publicarse sin verificación.

### 11.2. Verificación

Solo admin o superadmin pueden aprobar o rechazar verificación. La visita presencial es obligatoria. La verificación anual debe quedar programada.

### 11.3. Ediciones de perfil

Edita el perfil el **owner** y el staff con el permiso `profile.edit` (DR11, `docs/00` §31); el resto del staff lo ve en solo lectura. Incluye tarifas y condiciones de reserva y la política de salida anticipada. **Enviar o reenviar el perfil a verificación es solo del owner** (no delegable).

Campos críticos que requieren aprobación admin antes de publicarse: fotos, dirección, nombre comercial, servicios incluidos, reglas principales, condiciones de reserva, capacidad total, tipos de habitación, documentación de residencia.

Campos tarifarios que no requieren aprobación previa: tarifas, matrícula, depósito, política de ajustes. Generan auditoría y alertas si varían más del 15% en una edición.

---

## 12. Permisos sobre disponibilidad

Residence owner y staff con el permiso `operations.rooms_availability` (DR11) pueden: editar disponibilidad, marcar completa, pausar solicitudes, gestionar disponibilidad por tipo y por plaza/cama (Gestión Operativa).

Admin puede: pausar disponibilidad, marcar información vencida, penalizar visibilidad, revisar rechazos por falta de disponibilidad, generar alertas.

Sistema puede: marcar disponibilidad como `not_updated`, enviar recordatorios, ocultar residencia de búsquedas si `not_updated` persiste más de 15 días.

---

## 13. Permisos sobre lista de espera

### 13.1. Entrar en lista de espera

Puede entrar: estudiante, menor con familiar vinculado activo.

El familiar **no puede** entrar en nombre del estudiante sin acción/autorización del estudiante.

### 13.2. Gestionar lista de espera

Todo staff activo puede ver la lista de espera; contactar interesados, eliminar estudiantes manualmente y notificar disponibilidad requiere el permiso `waitlist.manage` (DR11) (el owner siempre puede).

No pueden convertir lista de espera en solicitud activa sin acción del estudiante.

### 13.3. Salida automática

Sistema retira al estudiante de otras listas cuando confirma reserva en otra residencia.

La lista no vence automáticamente. A los 90 días, el sistema envía recordatorio.

---

## 14. Permisos sobre renovaciones

### 14.1. Solicitar renovación

Puede hacerlo: estudiante alojado. Genera notificación a la residencia. No crea oferta vinculante.

El familiar puede sugerir o consultar, pero no inicia solicitud de renovación formal.

### 14.2. Crear oferta formal de renovación

Pueden hacerlo: residence_owner, residence_staff (DR10), admin en caso excepcional.

### 14.3. Aceptar o rechazar renovación

Solo el estudiante puede hacerlo. El familiar puede pagar el fee, pero no acepta la renovación en nombre del estudiante.

### 14.4. Confirmar pago recibido por renovación

Residence owner o staff con el permiso `renewals.manage` (DR11). Con confirmación explícita y auditoría.

### 14.5. Emitir Comprobante de Renovación Confirmada

Sistema lo emite cuando la renovación está confirmada. Admin puede reemitir o anular con motivo.

---

## 14bis. Permisos sobre el aviso "Quiero cambiar" *(DR3/DR3b, 2026-10-23)*

Reglas en `docs/04` §12bis.

| Acción | Quién puede |
|---|---|
| Crear, editar y cancelar el aviso | Solo el estudiante alojado (cancelar se bloquea con pago en curso: Soporte). |
| Confirmar el aviso de un menor | Solo el familiar vinculado activo. No crea, edita ni cancela. |
| Ver el aviso | Estudiante; familiar vinculado (solo lectura, **sin el mensaje privado del estudiante**); residencia actual (owner/staff con acceso a residentes); admin. |
| Responder el aviso (costos, condiciones, detalles) | residence_owner y residence_staff con acceso a residentes de la residencia actual; admin en caso excepcional. |
| Definir la política de salida anticipada (perfil) | `residence_owner`, o staff con `profile.edit` (DR11). Es pública en la ficha. |
| Finalizar la estadía con salida anticipada (depósito devuelto / no devuelto / sin depósito, nota) | **Solo la residencia actual** (owner o staff con `residents.manage` (DR11)) o admin; nunca el estudiante, el aviso ni el sistema. |
| Agregar nota de salida del estudiante | Solo el estudiante. |
| Ver la señal "en proceso de mudanza" | La residencia que recibe la solicitud o lista de espera; sin acceso al aviso ni a la residencia de origen. |

---

## 15. Permisos sobre comunidad visible y residentes

### 15.1. Crear residente pendiente

Residence owner o staff con `residents.manage` (DR11) puede crear un residente pendiente con email.

El residente debe activar cuenta y completar registro para mostrar perfil ampliado.

### 15.2. Visibilidad de residente

El estudiante/residente controla su visibilidad. La configuración se obtiene durante el registro.

Si no activa cuenta o no habilita visibilidad: se muestra "Plaza ocupada" o "Residente pendiente de activar cuenta" sin datos personales.

### 15.3. Ver perfiles individuales

Usuarios registrados pueden ver perfiles individuales según permisos configurados por cada estudiante/residente.

Invitados solo ven información limitada.

### 15.4. Datos no visibles

Nunca se muestran: apellido completo, email, teléfono, fecha de nacimiento, universidad, documentos.

---

## 16. Permisos sobre FAQ

Residence owner puede: elegir preguntas del listado predefinido, cargar respuestas, subir archivos (reglamento, normas), agregar preguntas personalizadas, ver preguntas no respondidas. El staff con `profile.edit` también edita las preguntas del perfil; con `faq.manage` (DR11) responde, oculta y restaura las preguntas libres de la ficha.

Admin puede: revisar contenido, pausar respuestas incorrectas, auditar cambios, intervenir si hay información engañosa.

El FAQ/bot no puede: inventar disponibilidad, confirmar precios fuera de datos oficiales, prometer aceptación, modificar condiciones, confirmar reservas.

---

## 16bis. Permisos sobre reglamento, edad de residentes y seguimiento post-ingreso *(DR14, 2026-10-25)*

*Lo marcado como supuesto es reversible (`docs/13` §4).*

**Reglamento.**
- **Ver el reglamento completo:** cualquier visitante, invitados incluidos (está en la ficha, antes de solicitar).
- **Aceptarlo:** solo el estudiante al enviar la solicitud (o el familiar vinculado si es menor, §7.2). La aceptación guardada es de solo lectura: nadie la edita ni la borra; la ven el estudiante, la residencia destinataria (staff con acceso a la solicitud) y admin/superadmin.
- **Cargar o editar el reglamento propio, o adaptar el modelo:** dueño y staff con `profile.edit`. **Sin aprobación del admin:** la residencia decide sola (decisión del dueño, 2026-10-25); la versión nueva rige apenas se publica. Cada versión queda auditada.
- **Efecto:** una versión nueva rige para solicitudes nuevas; las ya aceptadas conservan la versión que aceptaron.

**FAQ (catálogo único).**
- **Administrar el catálogo** (alta, baja, orden, respuesta sugerida): admin/superadmin.
- **Elegir qué preguntas mostrar y editar la respuesta de su residencia:** dueño y staff con `faq.manage` *(supuesto reversible, 2026-10-25: es el mismo permiso de la FAQ libre del estudiante, DR11/D9; antes decía `profile.edit`)*.
- Las restricciones de §16 se mantienen: la FAQ no inventa disponibilidad ni precios ni promete aceptación.

**Edad de residentes.**
- **Definir edad mínima, máxima y si acepta menores:** dueño y staff con `profile.edit`. **Sin aprobación del admin** (decisión del dueño, 2026-10-25): la residencia habilita menores sola; al hacerlo debe completar el apartado para menores.
- El filtro de edad lo aplica el sistema con la fecha de nacimiento del estudiante, que **sigue siendo privada**: la residencia nunca ve la fecha de nacimiento por el filtro, solo ve que su residencia le aparece (o no) al estudiante.

**Seguimiento post-ingreso (`stay_followup`).**
- **Recibir el aviso de recordatorio:** todo staff activo y el dueño de la residencia (sin casillero).
- **Ver respuestas de la encuesta, su estado y notas:** **solo admin y superadmin.** Residencia (dueño y staff), familiar vinculado de otro estudiante y cualquier otro rol: **no**.
- **Responder la encuesta:** el estudiante, y el familiar vinculado si es menor, cada uno la suya.
- **Marcar como revisada / decidir si comunicar algo a la residencia:** admin/superadmin; si lo comunica, por Soporte y con auditoría.

---

**DR18 (2026-10-27).** Sin permisos nuevos: quien tiene `profile.edit` guarda barrio, edad y sedes cercanas como hasta ahora; si guarda una sede a más de 20 cuadras (≈2 km) se registra una auditoría y se avisa a los admin/superadmin (no bloquea). La selección de preguntas de la FAQ sigue bajo `faq.manage`.

## 17. Permisos sobre resolución de conflictos

### 17.1. Abrir reclamo

Pueden abrir reclamo: estudiante, familiar vinculado, residencia owner, todo staff activo (sin casillero, DR11), admin.

Debe mostrarse recordatorio de términos, alcance y deslinde de responsabilidad antes de confirmar.

### 17.2. Gestionar reclamo

Solo admin o superadmin pueden: solicitar evidencia, contactar a partes, dejar notas internas, aplicar acciones, cerrar caso, registrar acuerdo o desacuerdo.

### 17.3. Evidencia

Usuarios pueden subir: fotos, videos, capturas, audios, documentos.

La evidencia se almacena en storage privado y auditado.

---

## 18. Permisos sobre métricas y penalizaciones

### 18.1. Métricas visibles para residencia

Residence owner puede ver métricas propias. Staff puede verlas si tiene permiso.

Métricas disponibles: tasa de respuesta, tiempo promedio de respuesta, tasa de solicitudes vencidas, tasa de contacto establecido, tasa de reserva confirmada, rechazos por falta de disponibilidad, cancelaciones atribuibles a residencia, reclamos validados, actualización de disponibilidad, completitud de perfil, uso operativo, propuestas de ajuste enviadas/aceptadas.

### 18.2. Métricas internas de visibilidad

Solo admin/superadmin puede ver ponderación completa y score interno. No se muestra como ranking público en MVP.

### 18.3. Penalizaciones

Admin puede aplicar: `warning`, `reduced_visibility`, `temporarily_paused`, `suspended`, `removed_from_network`.

Sistema puede sugerir penalización o crear alerta, pero no expulsar automáticamente sin regla específica aprobada.

---

## 19. Permisos sobre notificaciones

Cada usuario debe tener al menos un canal obligatorio activo.

Canales posibles: email (obligatorio como respaldo), in-app.

WhatsApp en MVP: solo botón pre-formateado sin integración API. No hay envío automático por WhatsApp.

Usuarios pueden elegir preferencias, pero eventos críticos deben tener fallback por email si es posible.

---

## 20. Reglas técnicas de autorización

### 20.1. Convención de permisos

Formato: `resource.action.scope`

Ejemplos:

- `applications.view.own`
- `applications.view.residence`
- `applications.contact_establish.residence`
- `applications.send_adjustment_proposal.residence` *(máx. 1 vez)*
- `applications.reject.residence`
- `family_proposals.create.family`
- `family_proposals.approve.student`
- `payments.residence.mark_received`
- `payments.estured.pay_own`
- `receipts.download.own`
- `receipts.issue.admin`
- `residences.edit.own`
- `residences.verify.admin`
- `residence_staff.manage.own`
- `documents.view.authorized`
- `documents.download.authorized`
- `community.visibility.edit_own`
- `admin.audit.view`
- `admin.exchange_rate.override`
- `admin.feature_flags.manage`

---

### 20.2. Regla de ownership

Cada recurso debe tener ownership claro:

- `student_profile.user_id`
- `family_link.student_id`, `family_link.family_user_id`
- `family_application_proposal.family_user_id`, `family_application_proposal.student_id`
- `residence.owner_user_id`
- `residence_users.user_id`, `residence_users.residence_id`
- `application_request.student_id`, `application_request.residence_id`, `application_request.initiated_by`, `application_request.contact_target`
- `reservation.application_request_id`
- `estured_fee_payment.payer_user_id`
- `document.owner_user_id`, `document.related_application_id`
- `booking_receipt.reservation_id`

---

### 20.3. Multi-tenant por residencia

Los usuarios de una residencia solo pueden acceder a datos de su residencia.

Un residence_staff no puede acceder a otra residencia aunque tenga el mismo email o rol general.

Si un usuario gestiona varias residencias, debe existir asociación explícita por residencia en `residence_users`.

El contexto activo (residencia seleccionada) debe validarse en cada request server-side, no solo en frontend.

---

### 20.4. Acceso temporal a documentos

Los documentos deben servirse con URLs firmadas o mecanismo equivalente.

No deben quedar públicos ni accesibles por URL directa.

---

### 20.5. Acciones críticas con confirmación explícita

Deben pedir confirmación explícita antes de ejecutarse:

- enviar solicitud;
- aprobar propuesta del familiar;
- establecer contacto;
- enviar propuesta de ajuste (con advertencia de límite de 1 vez);
- aceptar propuesta de ajuste;
- marcar pago recibido (con aceptación de términos);
- pagar fee;
- cancelar solicitud;
- cancelar reserva;
- confirmar no-show;
- crear oferta de renovación;
- aceptar renovación;
- suspender residencia;
- reembolsar;
- anular comprobante;
- cambiar visibilidad de perfil.

---

## 21. Casos borde obligatorios para QA

1. Guest intenta enviar solicitud → bloqueado.
2. Estudiante intenta enviar tercera solicitud activa → bloqueado.
3. Estudiante menor intenta completar registro sin familiar → bloqueado.
4. Familiar intenta proponer solicitud → entra en `pending_student_approval`, no va a la residencia.
5. Familiar intenta enviar solicitud directamente a residencia → bloqueado.
6. Estudiante rechaza propuesta del familiar → familiar notificado, no hay solicitud creada.
7. Propuesta del familiar expira en 48h → estado `expired`, familiar notificado.
8. Residencia envía propuesta de ajuste → estudiante ve comparación original vs. propuesta.
9. Residencia intenta enviar segunda propuesta de ajuste → bloqueado con advertencia.
10. Estudiante acepta propuesta de ajuste → snapshot_final actualizado, fee recalculado.
11. Estudiante rechaza propuesta de ajuste y elige continuar con condiciones originales → snapshot_final = snapshot_original.
12. Familiar intenta aceptar propuesta de ajuste en nombre del estudiante → bloqueado.
13. Residence staff intenta algo para lo que el dueño no le dio permiso (por ejemplo rechazar una solicitud sin `applications.reject` o proponer un ajuste sin `applications.send_adjustment`) → bloqueado en el servidor con «No tenés permiso para esta acción. Pedíselo al dueño de la residencia.» (DR11). Si intenta algo no delegable (gestionar el equipo y los permisos, enviar el perfil a verificación, ver el reporte PDF, sumar otra residencia) → bloqueado con «Esta acción la puede hacer solo el dueño de la residencia.»
14. Residence staff intenta ver solicitudes de residencia a la que no fue asignado → bloqueado.
15. Residence owner intenta publicar sin verificación → bloqueado.
16. Residencia intenta editar foto crítica sin aprobación → queda en `pending_admin_review`.
17. Residencia cambia tarifa más de 15% → alerta admin generada.
18. Fee cobrado → webhook duplicado → segundo cobro bloqueado por idempotencia.
19. Fee en USD via PayU → se registra monto en ARS y USD, con tipo de cambio del snapshot.
20. Admin accede a documento sensible → debe ingresar justificación, se genera audit log.
21. Reserva confirmada en una residencia cierra otras solicitudes y listas de espera del estudiante.
22. Admin reemite comprobante → motivo obligatorio, auditado.
23. Usuario intenta ver documento sin autorización → bloqueado, intento queda en log.
24. Residencia intenta ver datos sensibles de estudiante sin solicitud activa → bloqueado.
25. Residente pendiente aparece sin datos personales.
26. Estudiante cambia visibilidad → la comunidad se actualiza de inmediato.
27. Familiar paga fee → Factura C a nombre del familiar, comprobante a nombre del estudiante.
28. Reclamo abierto → reserva no se suspende automáticamente.
29. Admin suspende residencia → auditado con motivo.
30. Estudiante menor queda sin familiar activo → acciones sensibles bloqueadas, admin notificado.
31. Estudiante menor envía solicitud propia → el contacto de la residencia se dirige al familiar vinculado (`contact_target = family_member`).
32. Estudiante, o familiar pagador solo si el estudiante es menor de edad (DR6 (i)), ejerce revocación dentro de los 10 días → reserva cancelada, comprobante anulado, fee queda `paid` pendiente de revisión admin; el admin reintegra el fee completo o lo deniega con motivo (DR6). Un familiar vinculado que no es el pagador, o el pagador de un estudiante mayor de edad, no puede revocar (no ve el botón y el servidor lo rechaza).
33. Familiar intenta cancelar una solicitud que originó → bloqueado (solo el estudiante o el admin cancelan).

---

## 22. Pendientes no bloqueantes

- Presets fijos de residence_staff por rol de negocio (`staff_viewer`, `staff_applications`, `staff_operations`, `staff_renewals`, `staff_manager`): **reemplazados por DR11** por 10 permisos que elige el dueño y 3 atajos que rellenan casilleros (§4.7). Siguen fuera de alcance los permisos finos por rol de negocio y los permisos sobre pantallas del admin.
- Textos finales de confirmación por acción crítica.
- Política legal final sobre menores de edad.
- Política legal final sobre no reembolso.
- Detalle de exportación de datos por usuario (derecho de acceso y portabilidad).
- Reglas de retención y eliminación de documentos.
- Permisos específicos para futuros módulos (Señales de Convivencia, reviews).

---

## 23. Regla final para implementación con Claude Code

Claude Code debe implementar primero permisos simples y seguros, aunque eso implique más restricciones iniciales.

No debe crear atajos donde una acción sensible dependa solo de visibilidad en frontend.

Si un permiso no está definido en este documento, la acción debe considerarse **no permitida** hasta que se agregue explícitamente.

Ante ambigüedad de permisos: denegar y preguntar, nunca asumir y permitir.
