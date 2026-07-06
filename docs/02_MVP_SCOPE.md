# 02_MVP_SCOPE.md
# EstuRed — Alcance del MVP

Versión: 0.2
Estado: Documento actualizado para construcción
Última actualización: 2026-06-27
Depende de: `00_DECISION_LOG.md`, `01_PRODUCT_BRIEF.md`

---

## 1. Propósito de este documento

Este documento define el alcance funcional del MVP de EstuRed.

Su objetivo es evitar ambigüedad durante la construcción y dejar claro:

- qué debe construirse en la primera versión;
- qué queda fuera;
- qué funcionalidades son obligatorias (Must Have);
- qué puede implementarse si no bloquea el lanzamiento (Should Have / Could Have);
- qué límites no deben cruzarse durante el desarrollo.

Este archivo debe leerse antes de comenzar cualquier implementación. Claude Code no debe agregar funcionalidades fuera de este alcance sin actualizar este documento.

---

## 2. Definición del MVP

El MVP de EstuRed es una webapp responsive funcional, enfocada inicialmente en CABA, para estudiantes del interior de Argentina y del exterior que buscan residencias estudiantiles confiables.

El MVP no es una demo ni un prototipo. Es un producto real, operativo y escalable, con capacidad para gestionar:

- búsqueda de residencias verificadas;
- solicitudes de reserva (iniciadas por estudiante o propuestas por familiar con aprobación del estudiante);
- negociación estructurada de condiciones;
- confirmación de reservas y cobro de fee;
- comprobantes verificables (PDF + QR);
- dashboard de residencia (incluyendo multi-residencia);
- dashboard de estudiante/familiar;
- admin interno completo;
- lista de espera;
- renovaciones;
- FAQ asistida por residencia;
- gestión operativa para residencias que la usen;
- modelo freemium por residencia.

El MVP debe mantener arquitectura modular para escalar hacia señales de convivencia, IA, analítica avanzada y servicios complementarios.

---

## 3. Loop central del MVP

El loop principal definitivo del MVP es:

```
Estudiante busca residencia
→ envía solicitud (o aprueba propuesta del familiar)
→ residencia responde / establece contacto
→ [negociación opcional: residencia propone ajuste, 1 vez; estudiante acepta o rechaza]
→ estudiante acepta condiciones finales
→ estudiante paga a la residencia lo requerido para reservar
→ residencia marca "Pago recibido"
→ EstuRed cobra el fee de servicio
→ reserva confirmada
→ comprobante emitido
```

Este loop gobierna todo el alcance.

Cualquier funcionalidad del MVP debe fortalecer uno de estos pasos:

1. descubrimiento de residencias confiables;
2. envío o aprobación de solicitudes;
3. gestión de solicitudes por residencia;
4. negociación y aceptación de condiciones finales;
5. confirmación de pago recibido por residencia;
6. cobro del fee EstuRed;
7. emisión de comprobante verificable;
8. trazabilidad, soporte y auditoría;
9. continuidad mediante renovación;
10. actualización de disponibilidad y ocupación.

---

## 4. Principio rector de alcance

El MVP debe resolver bien la operación mínima necesaria para que exista una reserva confiable y registrada.

Debe ser lo suficientemente simple para lanzarse, pero lo suficientemente robusto para que:

- el estudiante confíe;
- la familia pueda acompañar y proponer;
- la residencia pueda operar y negociar;
- EstuRed pueda auditar;
- el fee pueda cobrarse (en ARS o USD);
- el comprobante tenga sentido y sea verificable;
- las renovaciones puedan gestionarse;
- la disponibilidad no se vuelva caótica;
- el producto pueda escalar sin rehacerse desde cero.

---

## 5. Mercado inicial

El MVP se enfoca en:

- Ciudad Autónoma de Buenos Aires, Argentina;
- estudiantes del interior de Argentina que se mudan a CABA;
- estudiantes internacionales que se mudan a CABA;
- familias que acompañan la decisión;
- residencias estudiantiles ubicadas en CABA.

No diseñar el MVP para múltiples ciudades, departamentos compartidos, hoteles, alquileres tradicionales ni marketplace inmobiliario generalista.

---

## 6. Usuarios incluidos en el MVP

### 6.1 Invitado

Usuario no registrado.

Puede: entrar a la landing, buscar residencias con acceso limitado, ver fichas resumidas, ver información básica pública, entender el funcionamiento de EstuRed, iniciar registro.

No puede: enviar solicitudes, ver datos completos de residentes, acceder a documentación, reservar, pagar fee, acceder a comprobantes.

---

### 6.2 Estudiante

Usuario principal del lado demanda.

Puede:

- registrarse y completar perfil;
- configurar visibilidad de datos;
- buscar residencias;
- ver comunidad visible según permisos;
- enviar solicitudes (máximo 2 activas);
- aprobar o rechazar propuestas de solicitud del familiar;
- aceptar o rechazar propuestas de ajuste de condiciones enviadas por la residencia;
- subir documentación opcional;
- subir comprobante de pago a residencia para referencia;
- cancelar solicitudes antes de confirmación;
- pagar fee EstuRed (en ARS con MercadoPago o en USD con PayU);
- descargar comprobante;
- acceder a soporte;
- participar en renovaciones;
- gestionar vínculo familiar.

---

### 6.3 Padre, madre o familiar vinculado

Usuario secundario clave.

Debe registrarse y vincularse con un estudiante. La vinculación debe ser aprobada por el estudiante.

Puede:

- ver dashboard compartido con permisos limitados;
- proponer solicitudes de residencia al estudiante (quedan en `pending_student_approval` hasta aprobación);
- sugerir o agregar favoritos;
- cargar documentación;
- cargar comprobantes de pago a residencia;
- pagar el fee EstuRed (en ARS o USD);
- acceder y descargar el comprobante de reserva.

No puede:

- decidir por el estudiante;
- enviar solicitudes directamente a la residencia sin aprobación del estudiante;
- aceptar propuestas de ajuste de la residencia en nombre del estudiante;
- reemplazar al estudiante en decisiones de convivencia;
- vincularse sin aprobación del estudiante.

Reglas:

- un estudiante puede tener solo 1 familiar vinculado activo;
- un familiar puede estar vinculado a más de un estudiante;
- si el estudiante es menor de edad, debe tener familiar vinculado obligatoriamente.

---

### 6.4 Residencia Owner

Usuario principal del lado oferta.

Puede:

- crear o administrar hasta 10 residencias desde el mismo login;
- completar perfil de cada residencia;
- configurar precios, reglas, disponibilidad y condiciones;
- gestionar solicitudes;
- establecer contacto con estudiante o familiar (según quién inició la solicitud);
- enviar propuesta de ajuste de condiciones (1 vez por solicitud);
- marcar pago recibido (con confirmación explícita);
- gestionar habitaciones y plazas (Gestión Operativa);
- gestionar residentes (Gestión Operativa);
- gestionar renovaciones;
- crear subusuarios staff con acceso a una o múltiples residencias;
- otorgar permisos internos por residencia;
- pausar solicitudes;
- marcar residencia como completa;
- actualizar disponibilidad;
- responder requerimientos de EstuRed.

---

### 6.5 Residencia Staff

Usuario interno de una residencia.

Puede operar según permisos otorgados por el owner.

Un staff puede tener acceso a múltiples residencias del mismo owner si el owner lo habilita explícitamente.

Los permisos exactos se definen en `05_ROLES_AND_PERMISSIONS.md`.

---

### 6.6 Admin EstuRed

Rol interno obligatorio desde el MVP.

Puede:

- gestionar residencias;
- aprobar o rechazar verificaciones;
- revisar checklist de visita;
- aprobar o rechazar ediciones de residencia;
- ver, pausar, anular, reiniciar o editar solicitudes;
- intervenir en solicitudes trabadas;
- confirmar reserva manualmente (con override auditado);
- emitir, reemitir o anular comprobantes;
- gestionar pagos y reembolsos;
- validar pagos manuales del fee;
- ver documentos sensibles con justificación registrada obligatoria;
- gestionar resolución de conflictos;
- aplicar penalizaciones de visibilidad;
- suspender residencias o usuarios;
- auditar acciones críticas;
- hacer override manual del tipo de cambio;
- gestionar feature flags de planes freemium por residencia.

Todas las acciones sensibles deben quedar auditadas.

---

### 6.7 Superadmin EstuRed

Rol con control total del sistema.

Gestiona: configuración global, usuarios internos, parámetros de negocio, ponderaciones de visibilidad, tipo de cambio, auditoría y seguridad.

---

## 7. Must Have del MVP

Las siguientes funcionalidades son obligatorias para considerar el MVP completo.

### 7.1 Landing pública

Debe explicar: qué es EstuRed, para quién es, cómo funciona, beneficios para estudiantes, familias y residencias, qué significa residencia verificada, cómo iniciar búsqueda, cómo sumar una residencia.

---

### 7.2 Búsqueda de residencias

Debe permitir:

- ver residencias verificadas;
- filtrar por zona, precio, tipo de habitación/plaza y disponibilidad;
- ver cards claras con estado (disponible, completa, sin disponibilidad actualizada);
- entrar al perfil de residencia.

---

### 7.3 Perfil completo de residencia

Debe incluir:

- nombre, ubicación/zona, fotos, descripción;
- servicios, áreas comunes, reglas, condiciones de reserva;
- precios en USD y ARS con modal de tipo de cambio referencial;
- política de ajustes;
- composición estructural de habitaciones;
- tipos de plazas y disponibilidad;
- estado de verificación y modo operativo;
- FAQ asistida por la residencia;
- CTA para enviar solicitud;
- CTA para lista de espera si no hay disponibilidad.

---

### 7.4 Registro y autenticación

Debe permitir registro/login de: estudiante, familiar, residencia owner, residencia staff, admin EstuRed.

Debe contemplar: email/password, recuperación de contraseña, validación de email, posibilidad futura de magic link.

---

### 7.5 Perfil de estudiante

Datos obligatorios para solicitar:

- nombre, apellido (privado), nacionalidad, fecha de nacimiento (privada), dónde va a estudiar, carrera, ciudad de origen, email (privado), teléfono (privado), configuración de visibilidad.

Datos opcionales: documentación, hábitos, intereses, foto, información adicional solicitada por residencia.

Datos nunca públicos: apellido completo, email, teléfono, fecha de nacimiento, universidad, documentos.

---

### 7.6 Configuración de privacidad del estudiante

El estudiante configura qué datos mostrar a: invitados, usuarios registrados, compañeros/residentes, residencias con solicitud activa.

Datos visibles según permiso: nombre + inicial, foto o avatar, edad, nacionalidad/bandera, carrera, ciudad de origen, hábitos, intereses.

---

### 7.7 Vinculación familiar

Debe permitir:

- crear cuenta de familiar;
- solicitar vínculo con estudiante;
- aprobación del estudiante;
- dashboard compartido con permisos limitados;
- propuesta de solicitud al estudiante;
- carga de documentación;
- pago del fee EstuRed (ARS o USD);
- acceso y descarga de comprobante.

Si el estudiante es menor de edad, la vinculación es obligatoria.

---

### 7.8 Solicitudes de reserva

Debe permitir:

- enviar solicitud a residencia (tipo de habitación/plaza y condiciones específicas);
- propuesta de solicitud por familiar → estado `pending_student_approval` → aprobación/rechazo del estudiante;
- guardar snapshot de condiciones al momento de enviar o aprobar;
- limitar a 2 solicitudes activas por estudiante (las propuestas en `pending_student_approval` no cuentan);
- pausar la segunda solicitud cuando una avanza;
- cerrar solicitudes restantes cuando se confirma una reserva;
- gestionar cola por plaza;
- rechazar con motivo (enum predefinido);
- cancelar por estudiante antes de confirmación;
- registrar auditoría de cambios.

Vencimiento de solicitud: **48 horas** desde el envío. Al vencer mostrar detalle + botón "Actualizar con mismos parámetros".

---

### 7.9 Flujo de negociación de condiciones

Debe permitir:

- que la residencia envíe una propuesta de ajuste de condiciones (1 vez por solicitud);
- mostrar advertencia obligatoria antes de enviar la propuesta: "Solo podés enviar una propuesta de ajuste por solicitud. Una vez enviada, no podés modificarla.";
- cambiar el estado de la solicitud a `offer_pending_student_acceptance`;
- mostrar al estudiante un panel de comparación: condiciones originales vs. condiciones propuestas;
- permitir al estudiante aceptar o rechazar la propuesta;
- si acepta: actualizar snapshot con valores finales y recalcular fee;
- si rechaza: continuar con condiciones originales o cerrar la solicitud;
- reiniciar el plazo de 48 horas con cada propuesta enviada;
- registrar historial de condiciones y auditoría completa.

Campos modificables por la residencia: tarifa, matrícula, depósito, tipo de habitación/plaza, fecha de ingreso, duración, política de ajustes, conceptos de reserva, condiciones especiales.

Campos NO modificables: datos del estudiante.

---

### 7.10 Dashboard de estudiante/familiar

Debe mostrar:

- perfil y vínculo familiar;
- propuestas del familiar pendientes de aprobación;
- solicitudes activas, pausadas, vencidas, rechazadas;
- propuestas de ajuste pendientes de respuesta;
- reservas confirmadas;
- documentación;
- comprobantes;
- fee pendiente con botón de pago;
- comprobante emitido con QR;
- próximos pasos claros.

---

### 7.11 Dashboard de residencia

Multi-residencia: el owner ve los dashboards de cada residencia en scroll vertical simultáneo, con filtro/selector en la parte superior. El nombre de la residencia activa visible en el header en todo momento.

Cada dashboard individual debe permitir:

- gestionar perfil;
- editar datos (sujetos a auditoría/aprobación);
- gestionar disponibilidad;
- ver y gestionar solicitudes;
- establecer contacto (botón WhatsApp pre-formateado);
- enviar propuesta de ajuste de condiciones;
- marcar pago recibido (con confirmación explícita y aceptación de términos);
- confirmar reservas;
- rechazar solicitudes con motivo (enum);
- gestionar cola de solicitudes;
- gestionar lista de espera;
- ver métricas básicas;
- gestionar renovaciones;
- acceder a Gestión Operativa si corresponde al plan.

---

### 7.12 Admin panel

Must Have completo desde el MVP. Ver `09_ADMIN_PANEL_SPEC.md` para especificación detallada.

Capacidades mínimas:

- gestionar usuarios y residencias;
- aprobar verificaciones y ediciones;
- intervenir solicitudes trabadas;
- gestionar pagos, reembolsos y comprobantes;
- gestionar resolución de conflictos;
- aplicar penalizaciones;
- suspender usuarios o residencias;
- ver audit log completo;
- override de tipo de cambio;
- gestionar feature flags de freemium por residencia.

---

### 7.13 Verificación presencial de residencias

Ninguna residencia puede publicarse sin verificación aprobada.

Incluye: DNI del responsable, aceptación de términos y disclaimer, declaración de responsabilidad, visita presencial, comparación con fotos, checklist firmado, aprobación admin, renovación anual.

---

### 7.14 Disponibilidad

Modo Perfil Verificado:

- disponibilidad por tipo de habitación/plaza;
- confirmación manual;
- texto: "Disponibilidad informada por la residencia. Requiere confirmación al solicitar."

Modo Gestión Operativa:

- disponibilidad real por plaza/cama;
- texto: "Disponibilidad asegurada."

Estados relevantes (nomenclatura oficial en `04_STATE_MACHINES.md` §10):

- Disponibilidad en Perfil Verificado (por residencia/tipo de habitación): `available_to_confirm`, `full`, `not_updated`, `paused_by_residence`, `paused_by_admin`.
- Plazas en Gestión Operativa: `available`, `in_contact`, `temporarily_held`, `reserved`, `occupied`, `blocked`, `maintenance`, `unavailable`.

La residencia debe actualizar disponibilidad al menos cada 30 días. Si no actualiza y el estado es `not_updated` por más de 15 días, desaparece de búsquedas activas.

---

### 7.15 Lista de espera

Permite que estudiantes se anoten cuando una residencia está completa.

- No cuenta como solicitud activa.
- Registra: residencia, tipo de habitación, fechas deseadas, duración, estudiante, fecha de ingreso a lista.
- Cuando aparece disponibilidad: notificación al estudiante, la residencia puede contactar. No activa solicitud automáticamente.
- Si el estudiante confirma reserva en otra residencia, desaparece de todas las listas de espera.

---

### 7.16 Cola de solicitudes por plaza o tipo de habitación

La cola aplica por **plaza** en Gestión Operativa y por **tipo de habitación** en Perfil Verificado.

- Hasta 3 solicitudes visibles por plaza (GO) o tipo de habitación (PV).
- Hasta 2 solicitudes adicionales en cola.
- La residencia solo puede avanzar con una solicitud por plaza/tipo a la vez.
- Si la solicitud activa se cancela, vence o rechaza, puede avanzar la siguiente.

---

### 7.17 Pago a residencia

- Monto configurado en el perfil de la residencia (no modificable caso por caso, salvo mediante propuesta de ajuste).
- El contacto se establece por botón WhatsApp pre-formateado (sin API).
- El mensaje pre-formateado incluye: nombre del estudiante, residencia, tipo de habitación, fecha, duración y monto requerido.
- El estudiante puede subir comprobante de pago como referencia.
- La residencia marca "Pago recibido" con confirmación explícita y aceptación de términos.

---

### 7.18 Cobro del fee EstuRed

Reglas confirmadas:

- lo paga estudiante o familiar;
- 5% fijo sobre valores finales aceptados;
- incluye tarifa mensual × duración + matrícula/cargo de ingreso no reembolsable;
- excluye depósito reembolsable;
- puede cobrarse en ARS (MercadoPago) o USD (PayU Argentina);
- no es reembolsable salvo incumplimiento atribuible a residencia, revisión de EstuRed y normativa aplicable;
- se cobra después de que la residencia marque "Pago recibido";
- sin fee pagado: no hay reserva confirmada, no hay comprobante;
- idempotente: cobro duplicado bloqueado;
- hasta 3 reintentos en 48 horas si falla el cobro automático;
- modo manual disponible: admin valida y confirma;
- factura C emitida automáticamente via TusFacturas.app;
- si el fee vence sin pago, la reserva pasa a `expired_fee_unpaid`;
- **derecho de revocación del fee**: enlace visible en el footer, ejercitable dentro de los 10 días corridos desde el pago; cancela la reserva, anula el comprobante y abre revisión manual admin (sin reembolso automático — ver `03` §13.11bis).

---

### 7.19 Comprobante de Reserva Confirmada

Nombre oficial:

> Comprobante de Reserva Confirmada

Se emite únicamente cuando: residencia marcó "Pago recibido" + fee pagado + reserva confirmada.

Debe incluir:

- ID de reserva;
- QR o código verificable (URL `/verify/[codigo]`);
- fecha de emisión;
- datos del estudiante;
- datos del familiar/pagador si aplica;
- datos de residencia y responsable;
- tipo de habitación/plaza;
- fecha estimada de ingreso;
- duración inicial declarada;
- objetivo académico declarado (obligatorio);
- condiciones finales aceptadas (originales o ajustadas);
- monto abonado a residencia informado por la residencia;
- fee EstuRed abonado;
- moneda y tipo de cambio usado;
- política de ajustes futuros;
- disclaimer de responsabilidad;
- contacto de soporte EstuRed.

La URL `/verify/[codigo]` es pública y permite verificar autenticidad del comprobante sin exponer datos sensibles.

---

### 7.20 Renovaciones

Must Have del MVP.

El módulo mínimo debe permitir:

- que una residencia ofrezca renovación a un estudiante/residente;
- definir nueva duración, precio, condiciones y fecha límite de aceptación;
- aceptación por estudiante/familiar;
- pago a residencia + "Pago recibido" por residencia;
- cobro de fee EstuRed de renovación (misma lógica que reserva inicial: 5% sobre período renovado, sin excepciones);
- emisión de Comprobante de Renovación Confirmada;
- actualización de disponibilidad/ocupación.

Fee de renovación: **idéntico al de la reserva inicial** (5%, misma base de cálculo, sin variaciones). Decisión tomada para reducir complejidad de código.

---

### 7.21 Gestión Operativa — Plan pago (freemium)

Debe existir desde el MVP para residencias que lo usen (o que estén en período de beta gratuita).

No es obligatorio para todas las residencias. El sistema debe soportarla con feature flags por residencia.

Incluye como mínimo:

- habitaciones y tipos de habitación;
- plazas/camas;
- disponibilidad real por plaza;
- residentes;
- ocupación, próximas entradas y próximas salidas;
- reservas confirmadas;
- renovaciones;
- comunidad visible;
- estado de plazas;
- disponibilidad asegurada cuando corresponda.

No incluye en MVP: tickets de mantenimiento, inventario, check-in/check-out avanzado, gestión contable, liquidaciones, reportes financieros avanzados.

**No usar la palabra PMS en comunicación comercial.**

---

### 7.22 FAQ asistida por residencia

Must Have del MVP.

Cada residencia puede:

- elegir preguntas de un listado predefinido por EstuRed;
- cargar sus respuestas;
- subir archivos (reglamento interno, normas, servicios);
- agregar preguntas personalizadas.

El sistema responde solo con información cargada. No inventa respuestas, disponibilidad ni precios.

Preguntas no respondidas quedan registradas para que la residencia las agregue.

IA avanzada queda fuera del MVP.

---

### 7.23 Comunidad visible

Formato híbrido: agregado e individual con consentimiento.

El consentimiento se obtiene durante el registro, con información clara sobre qué datos se muestran y a quién.

Reglas:

- invitados tienen acceso limitado;
- usuarios registrados pueden ver perfiles según configuración del estudiante;
- residentes no activados aparecen como "plaza ocupada" sin datos personales;
- la residencia no puede obligar a mostrar datos personales;
- no hay Señales de Convivencia en esta etapa.

Datos posibles según permiso: nombre + inicial, foto, edad, nacionalidad/bandera, carrera, ciudad de origen, hábitos, intereses.

Datos nunca visibles: apellido completo, email, teléfono, fecha de nacimiento, universidad, documentos.

---

### 7.24 Notificaciones

Sistema de notificaciones básico.

Canales: email (obligatorio como respaldo), in-app.

WhatsApp: botón pre-formateado sin integración API. No hay envío automático por WhatsApp.

Eventos mínimos:

- propuesta del familiar recibida (al estudiante);
- propuesta del familiar aprobada/rechazada (al familiar);
- solicitud enviada / recibida;
- contacto establecido;
- propuesta de ajuste enviada por residencia (al estudiante);
- propuesta de ajuste aceptada/rechazada (a la residencia);
- plazo de pago iniciado / recordatorio 24h / vencido;
- solicitud vencida (con opción de actualizar parámetros);
- pago recibido marcado;
- fee pendiente / pagado;
- reserva confirmada / comprobante emitido;
- solicitud pausada / rechazada;
- lista de espera activada / disponibilidad nueva;
- renovación ofrecida / aceptada;
- reclamo abierto / actualizado.

---

### 7.25 Auditoría

Must Have. Toda acción crítica debe quedar auditada.

Acciones auditables mínimas:

- edición de residencia (todos los campos);
- aprobación/rechazo de edición;
- cambios de tarifa, matrícula, depósito;
- cambios de disponibilidad;
- creación de propuesta de solicitud por familiar;
- aprobación/rechazo de propuesta por estudiante;
- solicitud enviada;
- contacto establecido (timestamp del botón WhatsApp);
- propuesta de ajuste enviada por residencia;
- aceptación/rechazo de propuesta de ajuste;
- rechazo de solicitud + motivo;
- pago recibido marcado (con timestamp de aceptación de términos);
- fee pagado / validado manualmente / reembolsado;
- comprobante emitido / reemitido / anulado;
- reserva cancelada / no-show;
- usuario vinculado/desvinculado;
- cambio de visibilidad;
- reclamo abierto / resuelto;
- suspensión o expulsión;
- override de tipo de cambio;
- acción admin sobre cualquier operación;
- cambio de feature flag por residencia.

Cada evento debe guardar: actor, rol, entidad afectada, acción, valor anterior, valor nuevo, timestamp, IP/dispositivo si aplica, motivo si aplica, fuente (usuario/admin/sistema/webhook).

---

## 8. Should Have del MVP

Importantes, pero pueden implementarse después de los Must Have si el tiempo lo exige.

### 8.1 Favoritos

Permite que estudiante/familiar guarde residencias para comparar. El familiar puede sugerir favoritos en el dashboard compartido.

### 8.2 Documentación avanzada

La carga básica de documentación es Must Have. Los flujos avanzados de vencimiento, validación documental y documentos requeridos por residencia pueden implementarse progresivamente.

### 8.3 Panel de aprobación de ediciones refinado

Debe existir aprobación de ediciones. Una versión con comparador visual e historial detallado puede llegar en iteración posterior.

### 8.4 Métricas visibles para residencia

Métricas básicas son Must Have. Dashboards analíticos más ricos pueden iterarse.

### 8.5 Soporte y resolución de conflictos estructurada

Debe existir formulario/contacto básico. Un sistema avanzado con SLA y estados detallados puede iterarse.

---

## 9. Could Have del MVP

Deseables, pero no bloquean el lanzamiento.

### 9.1 Mejoras de onboarding guiado

Wizard avanzado para estudiantes y residencias con progress indicator y guardado de borradores.

### 9.2 Badges privados o internos

Badges internos para operación, no rankings públicos. Ejemplos: "Responde rápido", "Disponibilidad actualizada", "Perfil completo".

---

## 10. Fuera del MVP

No construir en MVP:

- Señales de Convivencia;
- reviews y evaluaciones;
- rankings públicos;
- comentarios libres públicos;
- IA avanzada / bot entrenable;
- tickets de mantenimiento;
- check-in/check-out avanzado;
- inventario;
- firma digital;
- escrow;
- app móvil nativa;
- marketplace de servicios;
- analítica avanzada pública;
- sistema de puntos;
- pagos mensuales recurrentes a residencia;
- contabilidad completa para residencias;
- dashboard agregado multi-residencia.

---

## 11. Reglas de solicitudes — resumen

- Máximo 2 solicitudes activas por estudiante.
- Propuestas del familiar en `pending_student_approval` no cuentan en el límite.
- Si una solicitud avanza, la otra queda pausada (no anulada).
- Cuando una reserva se confirma, las demás solicitudes se cierran automáticamente.
- Una plaza puede tener 3 solicitudes visibles + 2 en cola.
- **Vencimiento de solicitud: 48 horas** desde el envío.
- Al vencer: mostrar detalle + botón "Actualizar con mismos parámetros".
- Rechazos con motivo (enum, no texto libre).
- Negociación: solo la residencia propone ajustes, 1 vez por solicitud.

---

## 12. Snapshot de solicitud

Cada solicitud debe guardar snapshot al momento de enviar o aprobar:

- residencia;
- tipo de habitación/plaza;
- fecha de ingreso estimada;
- duración inicial;
- precio en USD;
- precio en ARS referencial;
- tipo de cambio usado (monedapi.ar, blue venta);
- fuente y fecha/hora del tipo de cambio;
- política de ajustes;
- matrícula/cargo de ingreso;
- depósito reembolsable;
- monto requerido para reservar;
- base de cálculo del fee;
- fee EstuRed estimado;
- reglas principales;
- condiciones de reserva;
- estado de disponibilidad al momento de solicitar;
- `initiated_by` (student / family_member);
- `contact_target` (student / family_member).

Si la residencia envía y el estudiante acepta una propuesta de ajuste, el snapshot se actualiza con los valores finales. El historial de condiciones anteriores se conserva.

---

## 13. Moneda, conversión y redondeo

- Tarifas mostradas en USD y ARS.
- **Fuente del tipo de cambio: monedapi.ar — dólar blue valor venta.** Actualización diaria automática.
- Modal referencial obligatorio: "El valor en pesos es referencial. El valor final lo define la residencia al momento del pago."
- El snapshot guarda el tipo de cambio usado.
- Fee EstuRed: puede cobrarse en ARS (MercadoPago) o USD (PayU).
- Tarifas en USD: deben terminar en 0 o 5.
- Tarifas en ARS: deben terminar en 500 o 000.
- Fee EstuRed: redondeado a múltiplos de 500 ARS.

---

## 14. Ajustes futuros de tarifas

Cada residencia define su política de ajustes: mensual, trimestral, semestral, anual o sin ajustes.

El comprobante y la solicitud aclaran que los valores de meses futuros pueden modificarse según la política de la residencia.

---

## 15. Modos de residencia y freemium

### 15.1 Modo Perfil Verificado — Gratuito

Incluye: perfil completo verificado, dashboard de solicitudes, disponibilidad semi-real, confirmación manual, reservas, comprobantes, lista de espera, renovaciones, FAQ asistida.

### 15.2 Modo Gestión Operativa — Plan pago

Incluye todo lo del Perfil Verificado más: habitaciones, plazas/camas, residentes, disponibilidad real, ocupación, comunidad visible, métricas operativas.

### 15.3 Residencias pioneras de beta

Acceso gratuito completo durante 1 año. El sistema gestiona esto mediante feature flags por residencia (campo en tabla de residencias o tabla de suscripciones).

---

## 16. Métricas de visibilidad interna

No se publican como ranking en MVP.

Ponderación inicial:

- respuesta y velocidad: 25%;
- disponibilidad actualizada: 20%;
- conversión a reserva: 20%;
- perfil completo/verificado: 15%;
- baja tasa de reclamos validados: 10%;
- uso operativo de la plataforma: 10%.

Métricas base: tasa de respuesta, tiempo promedio de respuesta, solicitudes vencidas, contacto establecido, reservas confirmadas, rechazos por falta de disponibilidad, cancelaciones atribuibles a residencia, reclamos validados, disponibilidad actualizada, completitud de perfil, uso del dashboard, propuestas de ajuste enviadas/aceptadas.

---

## 17. Penalizaciones de visibilidad

Motivos: no responder solicitudes, dejar vencer solicitudes, rechazar frecuentemente por falta de disponibilidad, publicar disponibilidad incorrecta, cancelar reservas sin causa válida, modificar condiciones sin aceptación, acumular reclamos validados, incumplir términos.

Escalera: advertencia → menor visibilidad → pausa temporal → pérdida de sello → suspensión o expulsión.

---

## 18. Soporte y resolución de conflictos

Formulario/contacto para estudiantes, familiares y residencias.

EstuRed puede intervenir cuando las partes lo soliciten y el caso lo amerite. No garantiza resultado ni reemplaza responsabilidades de las partes.

Se muestra recordatorio de términos y alcance antes de abrir un reclamo.

**Usar el término "resolución de conflictos" o "soporte de gestión", no "mediación", en comunicación pública.**

---

## 19. Condiciones legales pendientes antes de lanzamiento público

- Términos y condiciones para estudiantes (revisión profesional).
- Términos y condiciones para residencias (revisión profesional).
- Política de no reembolso del fee.
- Normativa aplicable al derecho de arrepentimiento.
- Protección de datos personales y menores de edad.
- Disclaimers de intermediación.
- Alcance del sello "Residencia Verificada".
- Precio del plan pago de Gestión Operativa.

Este punto no bloquea la construcción técnica, pero sí debe bloquear el lanzamiento público sin revisión.

---

## 20. Criterios de aceptación del MVP

El MVP se considera completo cuando permite:

1. publicar residencias verificadas en CABA;
2. mostrar tarifas en USD y ARS con modal referencial;
3. mostrar disponibilidad semi-real o asegurada según modo;
4. registrar estudiantes, familiares, residencias y admin;
5. buscar residencias y ver fichas completas con FAQ;
6. ver comunidad visible según permisos y consentimiento;
7. proponer solicitudes desde familiar y aprobarlas como estudiante;
8. enviar solicitudes con snapshot y límite de 2 activas;
9. gestionar cola por plaza y lista de espera;
10. establecer contacto por botón WhatsApp pre-formateado;
11. enviar y responder propuestas de ajuste de condiciones (1 vez);
12. controlar plazo de 48 horas con botón de actualización al vencer;
13. marcar pago recibido con confirmación explícita;
14. cobrar o registrar fee EstuRed (ARS o USD, MercadoPago o PayU);
15. emitir Factura C automáticamente via TusFacturas.app;
16. emitir Comprobante de Reserva Confirmada (PDF + QR verificable);
17. verificar comprobante en URL pública `/verify/[codigo]`;
18. gestionar renovaciones con fee idéntico al inicial;
19. operar dashboard de estudiante/familiar;
20. operar dashboard multi-residencia (scroll vertical, filtro, contexto activo);
21. operar admin panel completo;
22. auditar todas las acciones críticas;
23. registrar métricas de visibilidad;
24. gestionar resolución de conflictos básica;
25. aplicar estados de disponibilidad y solicitud coherentes;
26. gestionar feature flags de planes freemium por residencia;
27. ejercer el derecho de revocación del fee desde el enlace del footer, con revisión admin.

---

## 21. Riesgos de alcance

El MVP definido es más amplio que un MVP mínimo clásico.

Riesgos principales:

- exceso de módulos iniciales;
- complejidad del flujo de negociación;
- complejidad de Gestión Operativa;
- privacidad de comunidad visible;
- pagos manuales y automáticos combinados;
- dos proveedores de pago simultáneos;
- documentación legal pendiente;
- onboarding pesado para residencias;
- necesidad de admin robusto desde el inicio.

Mitigación:

- construir por fases internas (ver sección 22);
- no lanzar todos los módulos a todas las residencias al mismo tiempo;
- activar Gestión Operativa solo para residencias preparadas (feature flags);
- mantener IA fuera del MVP crítico;
- auditar todo;
- priorizar el loop reserva-fee-comprobante;
- usar admin para resolver casos manuales;
- validar con 5 a 10 residencias pioneras.

---

## 22. Fases internas de construcción del MVP

**Nota:** la numeración canónica de fases de construcción es la de `12_BUILD_PLAN.md` (Fases 0 a 16, incluyendo 5bis y 9bis). Las fases MVP-0 a MVP-6 de esta sección son una agrupación conceptual de alto nivel; ante cualquier referencia cruzada por número de fase, prevalece `12_BUILD_PLAN.md`.

Aunque todo lo anterior pertenece al MVP, debe construirse en orden.

### Fase 0 — Preparación técnica

- repositorio y estructura de proyecto;
- configuración Next.js + TypeScript;
- Supabase configurado (DB, Auth, Storage);
- variables de entorno documentadas;
- sistema base de componentes UI;
- layouts: público, autenticado, admin;
- toasts, modals, confirm dialogs, loading states.

### Fase MVP-1 — Núcleo público y usuarios

- landing;
- auth (registro/login de todos los roles);
- roles básicos y permisos;
- perfil estudiante;
- perfil residencia (sin Gestión Operativa);
- búsqueda y filtros;
- ficha de residencia;
- modal de tipo de cambio referencial;
- verificación básica de residencias;
- admin base.

### Fase MVP-2 — Solicitudes, propuestas y disponibilidad

- disponibilidad (estados y actualización);
- solicitud de reserva con snapshot;
- propuesta de solicitud por familiar (`pending_student_approval`);
- flujo de negociación de condiciones (`offer_pending_student_acceptance`);
- botón "Actualizar con mismos parámetros" al vencer;
- límite de 2 solicitudes activas;
- cola por plaza;
- lista de espera;
- dashboard residencia básico;
- dashboard estudiante/familiar.

### Fase MVP-3 — Contacto, pago y comprobante

- contacto por botón WhatsApp pre-formateado;
- marcado de "Pago recibido" con confirmación explícita;
- cobro de fee EstuRed (MercadoPago + PayU + modo manual);
- recalculo de fee sobre valores finales aceptados;
- idempotencia de cobro;
- facturación automática (TusFacturas.app, Factura C);
- generación de comprobante PDF con QR;
- URL pública de verificación `/verify/[codigo]`;
- notificaciones;
- auditoría completa.

### Fase MVP-4 — Gestión Operativa y freemium

- habitaciones, plazas y residentes;
- disponibilidad asegurada;
- comunidad visible con consentimiento;
- métricas operativas;
- feature flags de planes freemium por residencia;
- dashboard multi-residencia (scroll vertical, filtro, contexto activo).

### Fase MVP-5 — Renovaciones y FAQ

- oferta de renovación por residencia;
- aceptación por estudiante/familiar;
- fee de renovación (idéntico al inicial);
- comprobante de renovación;
- actualización de disponibilidad/ocupación;
- FAQ asistida por residencia (listado predefinido + respuestas + archivos).

### Fase MVP-6 — Hardening operativo

- soporte y resolución de conflictos básica;
- penalizaciones de visibilidad;
- ajustes legales y textos finales;
- QA completo;
- pruebas con residencias pioneras (beta privada).

---

## 23. Reglas para Claude Code

Claude Code debe respetar siempre:

1. No cambiar el loop central.
2. No llamar reserva confirmada a nada que no tenga fee EstuRed pagado/registrado.
3. No emitir comprobante antes de reserva confirmada.
4. No mostrar datos sensibles públicamente.
5. No construir rankings públicos.
6. No implementar Señales de Convivencia en MVP.
7. No inventar políticas de reembolso.
8. No hardcodear proveedor de pago en lógica de negocio.
9. No hardcodear fuente de tipo de cambio en lógica de negocio.
10. No eliminar auditoría de acciones críticas.
11. No permitir residencias no verificadas publicadas.
12. No permitir cambios de condiciones en solicitud activa sin aceptación del estudiante.
13. No convertir Gestión Operativa en PMS complejo.
14. No depender de IA para información crítica.
15. No asumir que WhatsApp reemplaza trazabilidad interna.
16. No calcular el fee sobre valores originales si hubo propuesta de ajuste aceptada.
17. No permitir que el familiar envíe solicitudes directamente a la residencia sin aprobación del estudiante.
18. Priorizar opciones técnicas gratuitas o económicas en igualdad de condiciones.

---

## 24. Documento siguiente recomendado

```
03_BUSINESS_RULES.md
```

Ese documento define con precisión todas las reglas operativas del MVP.
