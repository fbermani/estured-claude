# 03_BUSINESS_RULES.md
# EstuRed — Reglas de Negocio del MVP

Versión: 0.2
Estado: Documento actualizado para construcción
Última actualización: 2026-06-27
Depende de: `00_DECISION_LOG.md`, `01_PRODUCT_BRIEF.md`, `02_MVP_SCOPE.md`

---

## 1. Propósito de este documento

Este documento define las reglas de negocio que deben gobernar el MVP de EstuRed.

Su objetivo es transformar las decisiones estratégicas en reglas operativas claras para diseño, desarrollo, QA, administración interna y construcción por Claude Code.

Este archivo debe usarse como referencia obligatoria para construir:

- solicitudes de reserva;
- propuestas de solicitud iniciadas por familiar;
- flujo de negociación y ajuste de condiciones;
- disponibilidad;
- pagos a residencias;
- fee EstuRed;
- comprobantes;
- renovaciones;
- lista de espera;
- dashboards;
- admin panel;
- comunidad visible;
- auditoría;
- métricas de visibilidad;
- soporte y resolución de conflictos.

Ante conflicto entre documentos, aplica la jerarquía de `13_CLAUDE_PROJECT_INSTRUCTIONS.md` sección 2: `00_DECISION_LOG.md` prevalece siempre. Este documento no prevalece sobre `00`. Si una contradicción no se resuelve por jerarquía, detenerse y pedir aclaración — no elegir una versión silenciosamente.

---

## 2. Principio central de negocio

El MVP de EstuRed debe estar gobernado por un loop principal único:

```
Estudiante busca residencia
→ envía solicitud de reserva (o aprueba propuesta del familiar)
→ residencia responde / establece contacto
→ [negociación opcional: la residencia puede proponer ajustes, 1 sola vez]
→ estudiante acepta condiciones finales
→ estudiante paga a la residencia lo requerido para reservar
→ residencia marca "Pago recibido"
→ EstuRed cobra el fee de servicio
→ reserva confirmada
→ comprobante emitido
```

No existe reserva confirmada dentro de EstuRed si el fee de servicio no fue pagado o validado correctamente.

Cualquier funcionalidad que no apoye este loop, las renovaciones, la disponibilidad, la trazabilidad o la operación mínima de residencias debe quedar fuera del MVP o detrás de una prioridad menor.

---

## 3. Definiciones operativas

### 3.1 Solicitud de reserva

Una solicitud de reserva es el pedido formal que un estudiante envía a una residencia desde EstuRed, o que el estudiante aprueba luego de que un familiar la propuso.

No confirma disponibilidad ni reserva automáticamente.

La solicitud representa:

- interés del estudiante;
- datos declarados del estudiante;
- condiciones vistas al momento de solicitar;
- residencia elegida;
- tipo de habitación/plaza solicitada;
- fecha estimada de ingreso;
- duración inicial declarada;
- snapshot de precios, moneda, tipo de cambio y condiciones.

### 3.2 Propuesta de solicitud (iniciada por familiar)

Una propuesta de solicitud es una sugerencia que el familiar vinculado hace al estudiante.

No es una solicitud activa. No es visible para la residencia.

Solo se convierte en solicitud real cuando el estudiante la aprueba.

Ver sección 10bis para reglas completas.

### 3.3 Contacto establecido

Contacto establecido es el estado en el que la residencia decide avanzar con una solicitud y habilita el contacto directo con el estudiante o familiar (según quién inició la solicitud), mediante botón de WhatsApp pre-formateado.

**Si el estudiante es menor de edad, el contacto se dirige siempre al familiar vinculado (`contact_target = family_member`), independientemente de quién haya iniciado la solicitud.**

Este estado inicia el plazo de 48 horas para que el estudiante avance con el pago o para que la residencia y el estudiante acuerden ajustes de condiciones. El vencimiento de 48 horas por falta de respuesta de la residencia (contado desde el envío) se detiene en este momento.

### 3.4 Negociación de condiciones

Instancia posterior al contacto donde la residencia puede proponer ajustes a las condiciones originales de la solicitud.

Solo la residencia puede enviar propuestas formales de ajuste. Solo puede hacerlo 1 vez.

Ver sección 10ter para reglas completas.

### 3.5 Pago a residencia

Es el pago que el estudiante realiza directamente a la residencia para asegurar la plaza, según las condiciones finales aceptadas.

EstuRed no procesa este pago en el MVP. La residencia debe marcar `Pago recibido` cuando lo haya recibido.

### 3.6 Fee EstuRed

Es el fee de servicio que paga el estudiante o familiar vinculado a EstuRed.

Se cobra después de que la residencia marca `Pago recibido`.

Se calcula **siempre sobre los valores finales aceptados** por el estudiante (no sobre los valores originales de la solicitud si hubo negociación).

Sin fee EstuRed pagado o validado, no hay reserva confirmada dentro de EstuRed ni comprobante emitido.

### 3.7 Reserva confirmada

Una reserva confirmada es una operación que cumple todas estas condiciones:

1. el estudiante envió o aprobó una solicitud;
2. la residencia decidió avanzar;
3. se aceptaron las condiciones finales (originales o ajustadas);
4. el estudiante pagó a la residencia lo requerido;
5. la residencia marcó `Pago recibido`;
6. el fee EstuRed fue pagado o validado;
7. el sistema generó el `Comprobante de Reserva Confirmada`.

### 3.8 Comprobante de Reserva Confirmada

Documento emitido por EstuRed cuando la reserva queda confirmada.

Registra la operación dentro de EstuRed, pero no convierte a EstuRed en prestador directo del alojamiento ni en garante del comportamiento futuro de las partes.

---

## 4. Reglas de usuarios y roles

### 4.1 Invitado

Puede explorar la plataforma con acceso limitado.

No puede: enviar solicitudes, ver datos completos de residentes, pagar fee, acceder a comprobantes, gestionar reservas ni cargar documentación.

### 4.2 Estudiante

Puede:

- registrarse y completar perfil;
- configurar visibilidad;
- buscar residencias;
- ver comunidad visible según permisos;
- enviar solicitudes (máximo 2 activas);
- aprobar o rechazar propuestas de solicitud del familiar;
- aceptar o rechazar propuestas de ajuste de la residencia;
- subir documentación opcional;
- subir comprobantes de pago a residencia;
- pagar fee EstuRed;
- descargar comprobantes;
- solicitar renovación;
- gestionar vínculo familiar.

### 4.3 Familiar vinculado

Debe vincularse con un estudiante y ser aprobado por ese estudiante.

Puede:

- ver dashboard compartido con permisos limitados;
- sugerir/agregar favoritos;
- cargar documentación;
- cargar comprobantes de pago a residencia;
- pagar el fee EstuRed;
- acceder y descargar el comprobante de reserva;
- iniciar una propuesta de solicitud (que el estudiante debe aprobar antes de activarse).

Reglas:

- un estudiante puede tener 1 familiar vinculado activo;
- un familiar puede vincularse a más de un estudiante;
- si el estudiante es menor de edad, el familiar vinculado es obligatorio;
- el recibo/factura del fee EstuRed se emite a nombre de quien paga;
- el comprobante de reserva queda asociado al estudiante beneficiario.

### 4.4 Residencia Owner

Puede administrar la residencia y crear subusuarios staff.

Puede:

- completar y editar perfil de cada residencia que gestiona;
- configurar tarifas, matrícula, depósito y conceptos de reserva;
- configurar disponibilidad;
- gestionar solicitudes;
- establecer contacto;
- enviar propuesta de ajuste de condiciones (1 vez por solicitud);
- marcar pago recibido;
- gestionar habitaciones/plazas (Gestión Operativa);
- gestionar residentes (Gestión Operativa);
- gestionar renovaciones;
- marcar residencia como completa;
- pausar solicitudes;
- invitar staff y asignar permisos;
- gestionar hasta 10 residencias desde el mismo login.

### 4.5 Residencia Staff

Puede operar según permisos otorgados por el Owner.

Los permisos exactos se definen en `05_ROLES_AND_PERMISSIONS.md`.

Un staff puede tener acceso a múltiples residencias del mismo owner si el owner lo habilita explícitamente.

### 4.6 Admin EstuRed

Debe existir desde el MVP.

Puede:

- crear, editar, pausar, suspender o archivar residencias;
- aprobar verificaciones;
- revisar checklist de visitas;
- ver, anular, pausar, reiniciar o editar solicitudes;
- intervenir operaciones trabadas;
- confirmar reservas manualmente con override auditado;
- emitir, reemitir o anular comprobantes;
- validar pagos manuales del fee;
- procesar reembolsos del fee EstuRed;
- ver documentos sensibles con justificación registrada obligatoria;
- gestionar resolución de conflictos;
- aplicar penalizaciones de visibilidad;
- suspender usuarios o residencias;
- revisar métricas operativas;
- auditar acciones críticas;
- hacer override manual del tipo de cambio;
- gestionar feature flags de planes freemium por residencia;
- otorgar, revocar o extender acceso gratuito a módulos pagos.

Toda acción sensible del admin debe quedar auditada con: actor, timestamp, entidad, estado anterior, estado nuevo, motivo.

---

## 5. Reglas de residencia verificada

### 5.1 Publicación

Ninguna residencia puede publicar en EstuRed sin estar verificada.

El sello público es:

> Residencia Verificada

### 5.2 Verificación inicial

La verificación incluye:

- identidad del responsable;
- fotocopia de DNI del responsable;
- fotocopia de DNI del coordinador, si hubiera;
- dirección;
- visita presencial obligatoria;
- comparación de la residencia real con las fotos publicadas;
- checklist firmado por ambas partes;
- aceptación de términos y condiciones;
- aceptación del disclaimer y deslinde de responsabilidades;
- declaración de que la residencia es responsable por la actividad de alojamiento.

La visita presencial será realizada inicialmente por el fundador.

### 5.3 Renovación de verificación

La verificación debe renovarse anualmente.

Si vence y no se renueva, la residencia puede: perder temporalmente el sello, reducir visibilidad, ser ocultada de búsqueda, quedar en estado `verification_expired`.

### 5.4 Alcance del sello

El sello no significa garantía absoluta de calidad, convivencia, conducta futura o cumplimiento legal integral.

Debe comunicarse como verificación de: identidad, dirección, existencia física y similitud razonable con fotos.

Texto recomendado:

> Residencia Verificada: identidad, ubicación y fotos revisadas por EstuRed mediante control presencial.

---

## 6. Modos de residencia y modelo freemium

### 6.1 Modo Perfil Verificado — Gratuito

Para residencias que quieren publicar información, recibir solicitudes y confirmar disponibilidad manualmente.

Incluye:

- perfil completo;
- verificación presencial;
- dashboard de solicitudes;
- módulo de carga de disponibilidad;
- disponibilidad semi-real;
- confirmación manual de reservas;
- comprobantes;
- lista de espera;
- renovaciones;
- FAQ asistida.

### 6.2 Modo Gestión Operativa — Plan pago

Para residencias que quieren gestionar su operación dentro de EstuRed.

Incluye todo lo del Modo Perfil Verificado más:

- habitaciones y plazas/camas;
- estado de plaza;
- residentes;
- disponibilidad real;
- solicitudes por plaza;
- comunidad visible;
- métricas básicas operativas.

Quedan fuera de Gestión Operativa MVP: tickets de mantenimiento, inventario detallado, check-in/check-out avanzado, reportes avanzados, IA avanzada, PMS complejo.

**No usar la palabra `PMS` en comunicación comercial. Usar `Gestión Operativa`.**

### 6.3 Residencias pioneras de beta

Las residencias que participan en la beta tienen acceso gratuito completo (incluyendo Gestión Operativa) durante 1 año.

Pasado ese período, deben suscribirse al plan pago para mantener Gestión Operativa.

El precio del plan pago se definirá antes del lanzamiento público.

### 6.4 Feature flags por residencia

El sistema debe implementar feature flags por residencia para controlar el acceso a módulos pagos.

El admin puede:

- otorgar acceso gratuito a Gestión Operativa (beta, cortesía, período de prueba);
- revocar ese acceso;
- extender el período;
- activar el plan pago.

---

## 7. Perfil de residencia y edición de datos

### 7.1 Perfil obligatorio

Toda residencia debe completar:

- nombre comercial;
- dirección;
- responsable;
- fotos;
- reglas principales;
- servicios incluidos;
- áreas comunes;
- tipos de habitación;
- composición estructural;
- tarifas (se recomienda configurarlas en USD; ver sección 8);
- matrícula, si aplica;
- depósito, si aplica;
- concepto requerido para reservar;
- política de ajustes;
- condiciones de reserva;
- medios de pago aceptados para pagos a la residencia;
- disponibilidad o estado `Completa`.

### 7.2 Ediciones auditadas

Toda edición importante del perfil debe quedar auditada con: usuario, fecha/hora, campo modificado, valor anterior, valor nuevo, residencia afectada, impacto potencial en solicitudes activas.

### 7.3 Campos que requieren revisión/aprobación admin

Requieren aprobación admin antes de publicarse:

- fotos;
- dirección;
- nombre comercial;
- reglas principales;
- servicios incluidos;
- tipos de habitación;
- condiciones de reserva;
- capacidad total;
- documentación de residencia;
- cambios que afecten el alcance de la verificación presencial.

### 7.4 Tarifas, matrícula y depósito

Las tarifas son gestionadas por cada residencia y no requieren aprobación manual del admin en cada cambio.

Sin embargo:

- todos los cambios deben quedar auditados;
- el sistema debe generar alertas cuando una tarifa suba o baje más de 15% en una sola edición;
- el admin debe poder revisar estadísticas de tarifas y detectar cambios sospechosos;
- los cambios no deben alterar condiciones ya congeladas en solicitudes activas sin aceptación explícita del estudiante.

### 7.5 Redondeo de tarifas

Las tarifas en USD deben terminar en 0 o 5.

Las tarifas en ARS deben terminar en 500 o 000.

Cuando se convierten tarifas entre monedas, el sistema debe redondear respetando estos criterios.

---

## 8. Moneda, tipo de cambio y snapshot

### 8.1 Moneda de publicación

Las tarifas de las residencias se publican en dólares estadounidenses (USD) y se muestran también en pesos argentinos (ARS) como referencia.

**Se recomienda fuertemente a todas las residencias configurar sus tarifas en USD**, por las siguientes razones:

- el tipo de cambio a pesos se actualiza diariamente (dólar blue, valor venta);
- los valores en ARS se redondean para comodidad visual;
- la tarifa final en pesos se acuerda entre la residencia y el estudiante al momento del pago, ya que puede haber variaciones del tipo de cambio entre la solicitud y el pago efectivo;
- las tarifas en USD son más estables y evitan tener que actualizar el perfil constantemente.

Si una residencia configura tarifas en ARS (no recomendado operativamente), el sistema mostrará también la referencia en USD calculada al dólar blue del día, redondeada para comodidad visual. En ese caso aplica el mismo aviso referencial.

### 8.2 Fuente del tipo de cambio — DECISIÓN CONFIRMADA

**Fuente: monedapi.ar — valor de venta del dólar blue.**

- Se actualiza automáticamente de forma diaria.
- Admin puede hacer override manual si la fuente falla.
- Cada solicitud guarda snapshot del tipo de cambio al momento de crearla.

### 8.3 Modal de tipo de cambio referencial — OBLIGATORIO

Siempre que se muestren precios en ARS convertidos desde USD, debe mostrarse un aviso claro con este contenido:

> El valor en pesos es referencial, calculado en base al dólar blue (valor venta) del día de hoy. El valor final en pesos será determinado en el momento en que realices el pago directamente a la residencia, según la cotización vigente en ese momento.

Este modal debe mostrarse en:

- la ficha de residencia al ver tarifas en ARS;
- el resumen de solicitud al ver el monto estimado en ARS;
- cualquier pantalla donde se muestre conversión de USD a ARS.

### 8.4 Snapshot de solicitud

Cuando el estudiante envía (o aprueba) una solicitud, el sistema guarda snapshot de:

- precio USD;
- precio ARS (referencial al momento del snapshot);
- tipo de cambio usado;
- fuente del tipo de cambio;
- fecha/hora del snapshot;
- tipo de habitación/plaza;
- fecha estimada de ingreso;
- duración inicial declarada;
- matrícula;
- depósito;
- monto requerido para reservar;
- política de ajustes;
- reglas principales;
- condiciones de cancelación;
- fee EstuRed estimado;
- residencia;
- usuario estudiante;
- estado de disponibilidad al momento de solicitar.

Una vez enviada la solicitud, el snapshot no cambia automáticamente.

### 8.5 Solicitud vencida y botón "actualizar con mismos parámetros"

Las solicitudes vencen a las **48 horas** de ser enviadas (ver sección 10.10).

El motivo del vencimiento es que los precios y la disponibilidad pueden haber cambiado en ese período.

Cuando una solicitud vence, el sistema debe:

1. Mostrar al estudiante el detalle completo de la solicitud vencida: residencia, tipo de habitación, fechas, duración, tarifa original, fee estimado, tipo de cambio usado.
2. Mostrar un botón de **"Actualizar con mismos parámetros"** que permita al estudiante verificar si esa residencia todavía tiene disponibilidad y cuál sería la tarifa aproximada actualizada.
3. Aclarar que la tarifa final en pesos es siempre definida por la residencia al momento del pago.
4. Si hay disponibilidad y el estudiante confirma, se crea una nueva solicitud con los parámetros actualizados (nuevo snapshot, nueva cotización).
5. Si no hay disponibilidad, ofrecer la opción de entrar en lista de espera.

### 8.6 Cambios de condiciones en solicitud activa

Si la residencia modifica precio, tipo de habitación, fecha, matrícula o condiciones después de enviada una solicitud, el estudiante debe aceptar explícitamente las nuevas condiciones antes de avanzar.

### 8.7 Moneda del fee EstuRed

El fee EstuRed puede cobrarse en ARS o USD, según lo que elija el pagador y soporte el proveedor seleccionado.

- Si el pago es en ARS: se usa el tipo de cambio del snapshot de la solicitud para la base del cálculo.
- Si el pago es en USD (vía PayU): el fee base se calcula en ARS y se convierte a USD usando el tipo de cambio del snapshot de la solicitud. Se muestra en pantalla al pagador el texto:

  > El monto en USD se calculó usando la cotización del dólar blue al momento de crear la solicitud.

---

## 9. Reglas de disponibilidad

### 9.1 Disponibilidad semi-real (Perfil Verificado)

En Modo Perfil Verificado, la disponibilidad es informada por la residencia y requiere confirmación.

Texto visible:

> Disponibilidad informada por la residencia. Requiere confirmación al solicitar.

### 9.2 Disponibilidad asegurada (Gestión Operativa)

En Modo Gestión Operativa, cuando la residencia administra plazas reales dentro del sistema:

> Disponibilidad asegurada.

### 9.3 Nivel de disponibilidad

La disponibilidad puede definirse por:

- residencia;
- tipo de habitación;
- plaza/cama específica, si usa Gestión Operativa.

### 9.4 Actualización mínima

Cada residencia debe actualizar disponibilidad al menos cada 30 días.

Si no hay modificación o confirmación en ese plazo:

- se envían recordatorios;
- la residencia puede aparecer como `sin disponibilidad actualizada`;
- puede perder visibilidad;
- puede recibir advertencias operativas.

### 9.5 Estado `Completa`

`Completa`: la residencia declara que no tiene disponibilidad porque está llena.

Diferente de `Sin disponibilidad actualizada` (la residencia no actualizó info en plazo).

### 9.6 Solicitudes cuando disponibilidad está `not_updated`

Una residencia con estado `not_updated` puede seguir recibiendo solicitudes, pero con una advertencia visible para el estudiante:

> Esta residencia no ha actualizado su disponibilidad recientemente. La confirmación puede demorar más de lo habitual.

Si el estado `not_updated` persiste más de 15 días, la residencia deja de aparecer en búsquedas activas hasta que actualice.

### 9.7 Falsa disponibilidad

El rechazo constante de solicitudes por falta de disponibilidad sin actualización correcta penaliza visibilidad. Si se acumulan faltas graves, la residencia puede ser suspendida o expulsada.

---

## 10. Reglas de solicitudes

### 10.1 Solicitudes activas por estudiante

Un estudiante puede tener máximo 2 solicitudes activas simultáneas.

Las solicitudes en estado `pending_student_approval` (propuestas del familiar no aprobadas aún) **no cuentan** dentro de este límite hasta que el estudiante las apruebe.

### 10.2 Pausa de solicitudes alternativas

Si una solicitud avanza a contacto o proceso activo, la otra solicitud del estudiante queda pausada, no anulada.

Cuando una reserva se confirma, las demás solicitudes activas o pausadas del estudiante se cierran automáticamente.

### 10.3 Solicitudes por plaza o tipo de habitación

La cola aplica en ambos modos: por **plaza** en Gestión Operativa y por **tipo de habitación** en Perfil Verificado (donde no existen plazas individuales).

Una plaza (GO) o un tipo de habitación (PV) puede tener:

- hasta 3 solicitudes visibles para la residencia;
- hasta 2 solicitudes adicionales en cola.

La residencia solo puede avanzar con una solicitud por plaza (o por tipo de habitación, en PV) a la vez.

### 10.4 Cola por plaza o tipo de habitación

Si una solicitud activa se cancela, vence o no avanza, la residencia puede avanzar con la siguiente en cola.

### 10.5 Datos mínimos para solicitar

El estudiante debe completar como mínimo:

- nombre;
- apellido;
- nacionalidad;
- fecha de nacimiento;
- dónde va a estudiar;
- fecha estimada de ingreso;
- duración inicial declarada;
- **teléfono válido** (necesario para el botón de contacto por WhatsApp; si el estudiante es menor, el teléfono obligatorio es el del familiar vinculado, que será el destinatario del contacto);
- aceptación de términos y condiciones;
- configuración mínima de visibilidad.

Aunque apellido, fecha de nacimiento y dónde estudia son requeridos operativamente, no deben mostrarse públicamente.

### 10.6 Documentación

La documentación es opcional para enviar solicitud, salvo que una residencia configure requisitos específicos.

Se recomienda un máximo de 30 días luego de la llegada a la residencia cuando la residencia permita completarla después.

### 10.7 Información adicional por residencia

La residencia puede pedir información adicional antes de avanzar, relacionada con: datos de la solicitud, hábitos de convivencia, requisitos declarados, fechas, duración, documentación o condiciones de pago.

No debe solicitar ni usar información discriminatoria no permitida.

### 10.8 Rechazo de solicitudes

La residencia puede rechazar una solicitud seleccionando un motivo del siguiente listado (enum, no texto libre):

| Código enum | Texto visible |
|---|---|
| `no_availability` | Sin disponibilidad en las fechas solicitadas |
| `profile_incomplete` | Perfil del estudiante incompleto |
| `does_not_meet_criteria` | No cumple con los criterios de la residencia |
| `already_assigned` | La plaza fue asignada a otro estudiante |
| `dates_incompatible` | Fechas incompatibles con la residencia |
| `duration_incompatible` | Duración incompatible |
| `no_response_from_student` | El estudiante no respondió a tiempo |
| `residence_paused` | La residencia pausó solicitudes temporalmente |
| `other` | Otro motivo (requiere nota interna obligatoria) |

El admin debe poder ver rechazos de forma detallada, especialmente los de tipo `no_availability`.

### 10.9 Métricas de rechazo

Debe trackearse: motivo, residencia, tipo de habitación/plaza, fecha, usuario que rechazó, si el rechazo se debió a falta de disponibilidad, si la disponibilidad estaba vencida o incorrecta.

### 10.10 Vencimientos de solicitud

**La solicitud vence a las 48 horas de ser enviada.**

Motivo: los precios y la disponibilidad pueden cambiar. Al vencer, se muestra al estudiante el detalle y el botón "Actualizar con mismos parámetros" (ver sección 8.5).

Reglas adicionales:

- recordatorios diarios a la residencia sobre solicitudes nuevas y pendientes;
- si la residencia no responde a una solicitud en 48 horas, la solicitud se da de baja, se advierte a la residencia y se penaliza visibilidad según recurrencia.

---

## 10bis. Propuesta de solicitud iniciada por familiar

### 10bis.1 Qué es

El familiar vinculado puede iniciar una **propuesta de solicitud** dirigida al estudiante.

Esta propuesta **no es una solicitud activa**. No es visible para la residencia hasta que el estudiante la apruebe.

### 10bis.2 Flujo

1. El familiar elige una residencia y completa los parámetros de la propuesta (tipo de habitación, fecha de ingreso, duración).
2. El sistema crea la propuesta en estado `pending_student_approval`.
3. El estudiante recibe notificación: "Tu familiar sugirió una residencia para vos".
4. El estudiante tiene **48 horas** para aprobar o rechazar.
5. Si aprueba: la propuesta se convierte en solicitud real en estado `submitted`, visible para la residencia. Se genera el snapshot en ese momento. La solicitud queda asociada al estudiante.
6. Si rechaza o no responde en el plazo: la propuesta expira. Se notifica al familiar.

### 10bis.3 Qué puede hacer el estudiante con la propuesta

El estudiante solo puede **aprobar o rechazar** la propuesta del familiar.

No puede modificar los parámetros. Si quiere cambiar algo, debe rechazar la propuesta e iniciar una nueva solicitud por su cuenta (o pedirle al familiar que cree una nueva propuesta con los parámetros correctos).

### 10bis.4 Contacto cuando la solicitud fue iniciada por el familiar

Si la solicitud fue aprobada por el estudiante pero **originalmente propuesta por el familiar**:

- el campo `initiated_by` de `application_requests` tiene el valor `family_member`;
- el campo `contact_target` tiene el valor `family_member`;
- cuando la residencia establece contacto, el botón de WhatsApp pre-formateado usa el número del **familiar**, no del estudiante.

### 10bis.5 Límite de propuestas

Las propuestas del familiar en estado `pending_student_approval` no cuentan dentro del límite de 2 solicitudes activas del estudiante.

Una vez aprobadas por el estudiante, sí cuentan como solicitudes activas.

### 10bis.6 El familiar nunca reemplaza la decisión del estudiante

El familiar no puede:

- enviar la solicitud directamente a la residencia sin aprobación del estudiante;
- modificar una propuesta ya enviada al estudiante;
- cancelar una solicitud activa sin que el estudiante lo autorice;
- aceptar propuestas de ajuste de la residencia en nombre del estudiante.

---

## 10ter. Flujo de negociación y ajuste de condiciones

### 10ter.1 Cuándo aplica

Después de que la residencia establece contacto con el estudiante o familiar, pueden surgir cambios en las condiciones originales de la solicitud.

Las conversaciones de negociación informal (descuentos, ajustes, fechas) ocurren por WhatsApp fuera de la plataforma.

Cuando residencia y estudiante/familiar lleguen a un acuerdo, **la residencia formaliza los cambios dentro de EstuRed enviando una propuesta de ajuste**.

### 10ter.2 Quién puede enviar propuesta de ajuste

**Solo la residencia puede enviar propuestas formales de ajuste de condiciones.**

El estudiante no puede modificar la solicitud una vez enviada. Solo puede aprobar o rechazar.

### 10ter.3 Límite de propuestas de ajuste

**La residencia puede enviar una única propuesta de ajuste por solicitud.**

Al presionar "Editar / Enviar propuesta de ajuste", el sistema muestra una advertencia obligatoria:

> Solo podés enviar una propuesta de ajuste por solicitud. Una vez enviada, no podés modificarla. Asegurate de haber acordado todos los detalles con el estudiante antes de continuar.

Si la propuesta es rechazada por el estudiante, la solicitud puede cerrarse o seguir con las condiciones originales (ver 10ter.7).

### 10ter.4 Qué puede modificar la residencia en la propuesta de ajuste

**Todo es modificable, excepto los datos del estudiante.**

Campos modificables por la residencia:

- tarifa mensual (puede incluir descuento o tarifa promocional);
- matrícula;
- depósito;
- tipo de habitación/plaza;
- fecha estimada de ingreso;
- duración inicial;
- política de ajustes;
- conceptos de reserva (monto requerido para reservar);
- condiciones de cancelación;
- condiciones especiales o notas adicionales.

Campos que **no puede** modificar:

- nombre del estudiante;
- apellido;
- fecha de nacimiento;
- nacionalidad;
- dónde va a estudiar;
- documentos del estudiante.

### 10ter.5 Estado de la solicitud durante la negociación

Cuando la residencia envía la propuesta de ajuste, la solicitud pasa al estado:

> `offer_pending_student_acceptance`

En este estado:

- el estudiante ve un panel de comparación entre las condiciones originales y las condiciones propuestas;
- el estudiante puede ver el historial de condiciones: las originales y la propuesta actual;
- el estudiante debe **aceptar o rechazar** explícitamente la propuesta;
- el estudiante no puede modificar la propuesta.

### 10ter.6 Timer durante la negociación

Cuando la residencia envía una propuesta de ajuste, el plazo de 48 horas se reinicia.

El estudiante tiene 48 horas para responder a la propuesta de ajuste.

**Si el estudiante acepta la propuesta, el plazo de 48 horas para el pago a la residencia se reinicia nuevamente, contado desde la aceptación** (para que el estudiante disponga del plazo completo bajo las condiciones finales).

### 10ter.7 Aceptación de la propuesta de ajuste

Si el estudiante acepta:

- la solicitud actualiza su snapshot con los nuevos valores acordados;
- se registra el historial de condiciones anteriores;
- la solicitud pasa a estado `accepted_conditions_pending_payment`;
- el fee EstuRed se recalcula sobre los **nuevos valores finales aceptados**;
- el estudiante procede con el pago a la residencia según las nuevas condiciones.

### 10ter.8 Rechazo de la propuesta de ajuste

Si el estudiante rechaza la propuesta:

- la solicitud puede continuar con las **condiciones originales** si el estudiante lo elige;
- o el estudiante puede cerrar la solicitud.

El sistema debe preguntar al estudiante:

> ¿Querés continuar con las condiciones originales de la solicitud o cerrarla?

### 10ter.9 Cálculo del fee sobre valores finales

**El fee EstuRed siempre se calcula sobre los valores finales aceptados por el estudiante.**

Si no hubo propuesta de ajuste: los valores finales son los del snapshot original.

Si hubo propuesta de ajuste aceptada: los valores finales son los de la propuesta aceptada.

Si el estudiante rechazó la propuesta y eligió continuar con las condiciones originales: los valores finales son los del snapshot original.

### 10ter.10 Auditoría del proceso de negociación

Deben registrarse:

- timestamp de envío de propuesta de ajuste por residencia;
- campos modificados (valor anterior vs. valor nuevo);
- timestamp de respuesta del estudiante;
- decisión del estudiante (aceptó / rechazó / eligió condiciones originales);
- quién realizó cada acción.

---

## 11. Lista de espera

### 11.1 Cuándo se usa

La lista de espera se usa cuando una residencia no tiene disponibilidad o está en estado `Completa`.

### 11.2 No cuenta como solicitud activa

Entrar en lista de espera no cuenta como una de las 2 solicitudes activas del estudiante.

### 11.3 Quién puede permanecer

Solo pueden permanecer estudiantes que no tengan reserva confirmada en EstuRed.

Si un estudiante confirma reserva en otra residencia, desaparece automáticamente de las demás listas de espera.

### 11.4 Datos registrados

La lista de espera debe registrar:

- residencia;
- tipo de habitación/plaza deseada;
- fecha estimada de ingreso;
- duración deseada;
- estudiante;
- fecha de ingreso a lista;
- preferencias relevantes;
- estado.

### 11.5 Activación cuando aparece disponibilidad

Cuando aparece disponibilidad:

- los estudiantes en lista reciben notificación especial;
- la residencia puede contactar o invitar al estudiante;
- no se activa una solicitud automáticamente;
- el estudiante decide si activa solicitud o sale de la lista.

---

## 12. Pago a residencia

### 12.1 Configuración por residencia

Cada residencia configura su metodología de pago para reservar (seña, matrícula, depósito, otros medios).

El monto establecido no puede modificarse caso por caso en una solicitud activa, salvo mediante el proceso de propuesta de ajuste (sección 10ter).

### 12.2 Contacto y pago

Cuando la residencia decide avanzar:

1. establece contacto con el estudiante o familiar (según `contact_target`);
2. se genera botón de WhatsApp con número pre-cargado y mensaje pre-formateado;
3. el mensaje incluye: nombre del estudiante, residencia, tipo de habitación, fecha de ingreso, duración y monto requerido para reservar;
4. el estudiante (o familiar) tiene 48 horas para realizar el pago;
5. la residencia marca `Pago recibido` cuando efectivamente recibe el pago.

### 12.3 Botón de WhatsApp — DECISIÓN CONFIRMADA

EstuRed **no integra la API de WhatsApp Business** en el MVP.

El sistema genera un enlace `wa.me/[número]?text=[mensaje_codificado]` con el mensaje pre-formateado y los datos de la solicitud.

La residencia debe copiar y pegar el mensaje al iniciar la conversación.

El sistema registra como `contact_established` el momento en que la residencia presiona el botón.

EstuRed no registra ni controla la conversación posterior.

### 12.4 Comprobantes de pago a residencia

- El estudiante puede cargar comprobante de pago a residencia como referencia.
- La residencia puede cargar comprobante o evidencia para referencia propia.
- Si el pago fue en efectivo, debe quedar constancia.

### 12.5 Confirmación de pago a residencia

La residencia es la única que puede marcar `Pago recibido`.

Al marcarlo, declara que:

- recibió el importe correspondiente;
- la plaza queda retenida para el estudiante;
- la información de la solicitud es correcta y vigente;
- acepta que se active el cobro del fee EstuRed.

Esta acción requiere confirmación explícita con aceptación de términos antes de completarse. Queda auditada.

---

## 13. Fee EstuRed

### 13.1 Quién paga

El fee EstuRed lo paga el estudiante o su familiar vinculado.

### 13.2 Fórmula del fee

El fee EstuRed es el **5% fijo del total de la estadía inicial reservada**, calculado sobre los **valores finales aceptados**.

La base del fee incluye:

- tarifa mensual final aceptada × duración inicial reservada;
- matrícula o cargo de ingreso obligatorio no reembolsable, si existiera.

La base del fee excluye:

- depósito reembolsable;
- servicios opcionales;
- consumos variables;
- multas;
- costos no obligatorios;
- ajustes futuros.

### 13.3 Ajustes futuros

El fee se calcula sobre la tarifa final al momento de aceptar las condiciones.

No considera ajustes futuros. La política de ajuste queda informada en el snapshot, pero no recalcula el fee inicial.

### 13.4 Moneda del fee

El fee EstuRed puede cobrarse en ARS o USD, según lo que elija el pagador:

- **ARS**: usando el tipo de cambio del snapshot de la solicitud para convertir si la tarifa base está en USD.
- **USD** (vía PayU): el fee base se calcula en ARS y se convierte a USD usando el tipo de cambio del snapshot. Se muestra aclaración al pagador.

**Regla del tipo de cambio con negociación:** si hubo propuesta de ajuste aceptada, el `snapshot_final` hereda el tipo de cambio, la fuente y la fecha del snapshot original de la solicitud. La aceptación actualiza montos y condiciones, nunca la cotización.

### 13.5 Redondeo del fee

El fee EstuRed debe redondearse al múltiplo de 500 ARS más cercano. En caso de empate exacto entre dos múltiplos, se redondea hacia arriba.

### 13.6 Proveedores de pago del fee — DECISIÓN CONFIRMADA

El sistema soporta dos proveedores simultáneamente:

| Proveedor | Uso recomendado |
|---|---|
| **MercadoPago** | Pagadores en Argentina |
| **PayU Argentina** | Pagadores fuera de Argentina |

Ambos están disponibles al mismo tiempo para que el pagador elija.

Si el pagador está fuera de Argentina, la UI sugiere PayU como opción recomendada, sin forzarla.

Debe existir la abstracción técnica `PaymentProvider` desacoplada de cualquier proveedor específico.

### 13.7 Modo manual del fee

El sistema debe soportar validación manual del fee por admin (transferencia, comprobante subido por usuario).

El admin valida y confirma manualmente, generando auditoría.

### 13.8 Estado pendiente de fee

Después de que la residencia marca `Pago recibido`, la operación pasa a:

> Fee EstuRed pendiente

Visible para estudiante:

> La residencia informó que recibió el pago de reserva. Para confirmar la reserva dentro de EstuRed y emitir tu comprobante, falta abonar el fee de servicio.

Visible para residencia:

> Pago recibido informado. La reserva quedará confirmada en EstuRed cuando se complete el fee de servicio.

### 13.9 Vencimiento del fee

El estudiante/familiar tiene 48 horas para pagar el fee después de que la residencia marca `Pago recibido`.

Si no paga:

- no hay reserva confirmada en EstuRed;
- la reserva pasa a `expired_fee_unpaid` (estado terminal propio, distinto de una cancelación del estudiante);
- no se emite comprobante;
- la solicitud puede cerrarse por falta de pago del fee;
- la residencia puede liberar la plaza;
- queda registro interno.

Si falla el cobro automático: hasta 3 reintentos dentro de las 48 horas.

### 13.10 Idempotencia del cobro

El cobro del fee debe ser idempotente.

Si el proveedor de pago envía el webhook múltiples veces, no debe generarse un cobro duplicado ni un comprobante duplicado.

### 13.10bis Chargeback — DECISIÓN CONFIRMADA

Si el proveedor informa un contracargo sobre un fee ya pagado:

- el fee pasa a estado `chargeback`;
- se genera una **alerta admin**;
- **no se anulan automáticamente la reserva ni el comprobante**: el admin revisa el caso y decide las acciones (anulación del comprobante, apertura de caso de soporte, suspensión), todas auditadas con motivo.

### 13.11 Reembolso del fee

El fee no es reembolsable si el estudiante se arrepiente, cancela por decisión propia, no se presenta o no continúa.

El fee puede ser evaluado para reintegro si: la cancelación es atribuible a la residencia, hay incumplimiento sustancial verificado por EstuRed, o corresponde según normativa aplicable.

> Fee no reembolsable salvo incumplimiento atribuible a residencia, revisión de EstuRed y normativa aplicable.

La posibilidad técnica de reembolso debe existir aunque la política sea restrictiva.

### 13.11bis Derecho de revocación del fee EstuRed — DECISIÓN CONFIRMADA

El estudiante o familiar pagador puede ejercer el derecho de revocación sobre el fee EstuRed dentro de los **10 días corridos** posteriores al pago, mediante el enlace disponible en el footer de la plataforma.

Al ejercerse:

- la reserva pasa a `cancelled_by_student` con `reason_code = student_revocation_right`;
- el comprobante emitido se anula (`voided`);
- el fee EstuRed **no se reembolsa automáticamente**;
- se abre revisión admin obligatoria antes de cualquier reembolso;
- admin evalúa el caso individualmente para detectar patrones de bypass (por ejemplo, revocar el fee después de haber usado el contacto para acordar directamente con la residencia);
- admin puede cotejar con la residencia antes de resolver.

El reembolso del fee, si corresponde, es una decisión admin, no automática.

Este mecanismo aplica exclusivamente al fee EstuRed. **EstuRed no reembolsa ni gestiona reembolsos de montos pagados directamente a la residencia** bajo ninguna circunstancia — esa relación y sus condiciones de devolución son responsabilidad exclusiva de la residencia y el estudiante/familiar.

### 13.12 Facturación del fee — DECISIÓN CONFIRMADA

EstuRed emite **Factura C** como monotributista.

Integración con **TusFacturas.app** para emisión automática.

La factura se emite a nombre de quien paga el fee (estudiante o familiar pagador).

La descripción debe indicar el beneficiario del servicio reservado (nombre del estudiante si el pagador es el familiar).

Datos a recolectar del pagador para la factura:

- nombre completo o razón social;
- CUIT/CUIL (opcional para consumidor final);
- condición frente al IVA (por defecto: consumidor final).

La factura se emite cuando el fee es cobrado correctamente (automático) o cuando el admin confirma el pago manual.

---

## 14. Reserva confirmada y comprobante

### 14.1 Condiciones para confirmar reserva

La reserva queda confirmada dentro de EstuRed solo cuando:

- la residencia marcó `Pago recibido`;
- el fee EstuRed está pagado o validado;
- no hay bloqueo activo por disputa o revisión crítica;
- se emite el comprobante.

### 14.2 Nombre del documento

> Comprobante de Reserva Confirmada

### 14.3 Contenido mínimo del comprobante

Debe incluir:

- ID de reserva;
- QR o código verificable;
- fecha de emisión;
- datos del estudiante;
- datos del familiar/pagador si aplica;
- datos de residencia;
- responsable de residencia;
- tipo de habitación/plaza;
- fecha estimada de ingreso;
- duración inicial declarada;
- objetivo académico declarado;
- moneda y tipo de cambio usado;
- condiciones finales aceptadas (si hubo negociación, refleja los valores finales);
- monto abonado a residencia, informado por la residencia;
- fee EstuRed;
- estado de pago del fee;
- política de ajustes futuros;
- disclaimer legal;
- contacto de soporte EstuRed.

### 14.4 Objetivo académico declarado

Obligatorio para emitir comprobante. Debe formar parte de la solicitud.

### 14.5 Monto abonado a residencia

El comprobante muestra el importe abonado a la residencia con la aclaración:

> Pago a residencia informado por la residencia como recibido.

### 14.6 Ajustes futuros

El comprobante aclara que los valores de meses siguientes pueden estar sujetos a modificaciones según la política de la residencia.

### 14.7 Alcance del comprobante

El comprobante registra una operación dentro de EstuRed. No significa que EstuRed presta directamente el alojamiento, garantiza convivencia, conducta futura de las partes, ni responde por devoluciones de pagos hechos directamente a la residencia.

### 14.8 URL de verificación pública

El comprobante incluye un QR que apunta a una URL pública `/verify/[codigo]` donde cualquier persona puede verificar que el comprobante es auténtico y no fue alterado.

Esa URL debe mostrar: estado de la reserva, nombre del estudiante (inicial de apellido), residencia, fecha de ingreso y duración. No debe mostrar datos sensibles.

---

## 15. No-show y cancelaciones

### 15.1 No-show del estudiante

Si el estudiante no se presenta dentro de las 24 horas posteriores a la fecha/hora de ingreso acordada:

- la residencia puede marcar `No show`;
- la residencia puede liberar la plaza;
- el fee EstuRed no se reembolsa;
- queda registro interno.

### 15.2 Cancelación por estudiante

Si el estudiante cancela después de pagar a la residencia o después de pagar el fee:

- el fee EstuRed no es reembolsable, salvo normativa aplicable;
- la devolución de pagos a residencia depende de la política de la residencia;
- se cierra la operación y queda registro.

### 15.3 Cancelación por residencia

Si la residencia cancela una operación confirmada sin causa atribuible al estudiante:

- el estudiante puede abrir reclamo;
- EstuRed investiga;
- EstuRed puede devolver el fee si corresponde;
- EstuRed puede ayudar al estudiante a buscar alternativa;
- la residencia puede recibir penalización de visibilidad;
- si se repite, puede perder sello o ser expulsada.

### 15.4 Diferencias entre publicado y real

Pueden considerarse incumplimiento: habitación significativamente distinta, servicios publicados inexistentes, precio distinto sin aceptación, reglas no informadas, ubicación incorrecta, fotos engañosas.

No se consideran incumplimiento automático: diferencias subjetivas, expectativas no publicadas, preferencias personales no acordadas.

---

## 16. Renovaciones

### 16.1 Renovaciones en MVP

Renovaciones son Must Have en el MVP. El objetivo es que EstuRed no termine su valor en la búsqueda inicial, sino que acompañe la continuidad de la estadía.

### 16.2 Quién inicia una renovación

La residencia puede emitir una oferta formal de renovación.

El estudiante puede solicitar renovación, pero esa acción solo genera una notificación interna para que la residencia emita la oferta formal. No crea renovación directamente.

### 16.3 Oferta de renovación

La residencia debe configurar:

- período renovado;
- precio mensual;
- moneda;
- política de ajustes;
- monto requerido para asegurar renovación, si aplica;
- fecha límite de aceptación;
- habitación/plaza;
- condiciones especiales si hubiera.

### 16.4 Aceptación de renovación

El estudiante puede aceptar o rechazar.

Si acepta:

1. paga a la residencia lo que corresponda, si aplica;
2. la residencia marca `Pago recibido`;
3. EstuRed cobra fee de renovación;
4. se emite comprobante de renovación.

### 16.5 Fee de renovación

El fee de renovación usa **exactamente el mismo criterio** que la reserva inicial, sin excepciones, para reducir complejidad de código:

- 5% del total del período renovado;
- base incluye tarifa mensual × duración del período renovado y matrícula/cargo de renovación obligatorio no reembolsable si existiera;
- excluye depósito reembolsable;
- no considera ajustes futuros;
- se calcula sobre la tarifa actual al momento de la renovación.

### 16.6 Renovación confirmada

No existe renovación confirmada dentro de EstuRed si no está pagado o validado el fee de renovación.

---

## 17. Comunidad visible y privacidad

### 17.1 Principio general

La comunidad visible es parte del MVP y debe respetar consentimiento explícito y privacidad.

El consentimiento se obtiene en el registro, con información clara sobre qué datos se muestran y a quién.

### 17.2 Datos nunca visibles públicamente

- apellido completo;
- email;
- teléfono;
- fecha de nacimiento;
- universidad;
- documentos;
- datos sensibles.

### 17.3 Datos visibles según permiso del estudiante

Pueden mostrarse según configuración:

- nombre + inicial de apellido;
- foto o avatar;
- edad;
- nacionalidad/bandera;
- carrera;
- ciudad de origen;
- hábitos e intereses.

### 17.4 Configuración de visibilidad

La configuración se realiza durante el registro y puede modificarse desde el perfil en cualquier momento.

Grupos de visibilidad:

- Invitados (no registrados).
- Usuarios registrados.
- Compañeros de residencia.
- Residencias con solicitud activa.

### 17.5 Residente cargado por residencia

En Modo Gestión Operativa, la residencia puede crear una cuenta de residente con email.

El residente debe completar registro y aceptar términos para activar su cuenta.

Si no activa: aparece como `Residente pendiente de activar cuenta` o `Plaza ocupada`. No se muestran datos personales.

La residencia no puede forzar visibilidad individual completa.

---

## 18. Menores de edad

Si el estudiante es menor de edad:

- debe tener familiar vinculado obligatoriamente;
- no puede finalizar registro sin vinculación aprobada;
- el familiar puede acompañar, pagar y proponer solicitudes;
- la visibilidad de datos debe ser especialmente prudente;
- el sistema debe marcar internamente la cuenta como menor de edad;
- si el familiar se desvincula y el estudiante queda sin familiar activo siendo menor, el sistema debe bloquear acciones sensibles y notificar al admin.

La revisión legal de este flujo es obligatoria antes del lanzamiento público.

---

## 19. FAQ asistida por residencia

### 19.1 Alcance confirmado para MVP

El módulo FAQ entra en el MVP.

Cada residencia puede:

- elegir preguntas frecuentes de un listado predefinido por EstuRed;
- cargar sus propias respuestas para cada pregunta;
- subir archivos adicionales (reglamento interno, normas, servicios, etc.);
- agregar preguntas personalizadas no incluidas en el listado base.

La información de estas respuestas y archivos forma la base de conocimiento con la que el sistema responde consultas.

### 19.2 Cómo funciona

- El estudiante puede hacer preguntas desde la ficha de la residencia.
- El sistema busca la respuesta en las FAQ configuradas y los archivos subidos.
- Si no encuentra respuesta: registra la pregunta como "no respondida" para que la residencia la vea y pueda agregarla.
- El sistema **no inventa respuestas**. Solo responde con información cargada.

### 19.3 Restricciones obligatorias

El FAQ no puede:

- inventar precios;
- confirmar disponibilidad no cargada explícitamente;
- prometer condiciones;
- decir que una reserva está confirmada si no lo está;
- modificar estados;
- dar asesoramiento legal.

### 19.4 IA avanzada

IA avanzada queda para fase posterior. En MVP el sistema es estrictamente basado en información cargada por la residencia.

---

## 20. Multi-residencia por owner

### 20.1 Capacidad

Un owner puede gestionar hasta 10 residencias desde el mismo login.

### 20.2 Usuarios y acceso multi-residencia

El owner puede crear usuarios de staff con acceso a múltiples residencias o a residencias específicas.

El acceso es por `residence_users`, que vincula un usuario a una o más residencias con permisos específicos por residencia.

No hay permisos globales cross-residencia salvo para el owner.

### 20.3 Dashboard multi-residencia

No hay dashboard agregado con métricas consolidadas.

El owner ve los dashboards individuales de cada residencia en **scroll vertical simultáneo**.

Hay un filtro/selector en la parte superior para mostrar solo las residencias deseadas.

Cada dashboard mantiene su estructura y datos propios.

### 20.4 Contexto activo

Cuando el owner trabaja dentro de una residencia específica, el sistema opera en el contexto de esa residencia.

El nombre de la residencia activa debe estar visible en la UI en todo momento (header del dashboard de residencia).

---

## 21. Métricas de visibilidad

### 21.1 Uso inicial

Las métricas de visibilidad se usan internamente. No se muestran como ranking público en el MVP.

### 21.2 Ponderación inicial

- Respuesta y velocidad: 25%.
- Disponibilidad actualizada: 20%.
- Conversión a reserva: 20%.
- Perfil completo/verificado: 15%.
- Baja tasa de reclamos validados: 10%.
- Uso operativo de la plataforma: 10%.

Esta ponderación es editable y puede ajustarse cuando haya más data.

### 21.3 Métricas base

Deben calcularse o registrarse:

- tasa de respuesta;
- tiempo promedio de respuesta;
- tasa de solicitudes vencidas;
- tasa de contacto establecido;
- tasa de reserva confirmada;
- rechazos por falta de disponibilidad;
- cancelaciones atribuibles a residencia;
- reclamos validados;
- actualización de disponibilidad;
- completitud del perfil;
- uso del dashboard;
- variaciones de tarifa superiores al 15%.

### 21.4 Penalizaciones

Posibles medidas: advertencia, menor visibilidad, pausa temporal, suspensión, pérdida de sello, expulsión.

La penalización no debe depender de una única métrica aislada sin revisión contextual, especialmente durante el MVP con pocas residencias.

---

## 22. Soporte y resolución de conflictos

### 22.1 Apertura de reclamo

Los usuarios pueden iniciar un reclamo desde el apartado de soporte.

Antes de iniciar, debe mostrarse recordatorio de: términos y condiciones, alcance de la intervención de EstuRed, deslinde de responsabilidad, posibles resultados.

**Nota:** Se prefiere el término "resolución de conflictos" o "soporte de gestión" sobre "mediación" en la comunicación pública, para evitar implicaciones legales del término mediación formal en Argentina (Ley 26.589).

### 22.2 Evidencia permitida

Los usuarios pueden aportar: fotos, videos, capturas, audios, comprobantes, mensajes, documentación relevante.

### 22.3 Alcance

EstuRed puede analizar casos y actuar cuando lo considere pertinente. No está obligada a intervenir en todos los casos.

Abrir un reclamo no suspende automáticamente una solicitud, reserva o renovación. El admin puede suspender manualmente si el caso lo amerita.

### 22.4 Resultados posibles

- Cierre sin acción.
- Advertencia.
- Acuerdo entre partes.
- Reembolso del fee EstuRed, si corresponde.
- Recomendación de alternativa.
- Penalización de visibilidad.
- Suspensión.
- Expulsión.

### 22.5 Responsabilidad

EstuRed actúa como plataforma intermediaria de contacto, registro, solicitud, comprobante y soporte operativo.

La prestación efectiva del alojamiento, reglas internas, pagos mensuales, convivencia, permanencia y cumplimiento de condiciones son responsabilidad de la residencia y del estudiante según los acuerdos entre ellos.

---

## 23. Política antidiscriminación

La residencia puede declarar condiciones estructurales legítimas (femenina, masculina, mixta, habitaciones separadas por género, requisitos objetivos publicados).

No puede rechazar solicitudes por: raza, nacionalidad usada como criterio discriminatorio, religión, ideología, orientación sexual, discapacidad no relacionada con imposibilidad objetiva, u otros criterios contrarios a normativa o política de EstuRed.

Si se comprueba comportamiento sistemático inadecuado, EstuRed puede expulsar a la residencia o al estudiante.

---

## 24. Notificaciones

### 24.1 Canal obligatorio

El usuario debe tener al menos un canal obligatorio de notificación.

Email funciona como respaldo siempre que sea posible.

WhatsApp: el sistema genera mensajes pre-formateados que las partes pueden enviar manualmente; no hay integración de API de WhatsApp en el MVP.

### 24.2 Eventos mínimos a notificar

- Propuesta de solicitud recibida (al estudiante, cuando el familiar la crea).
- Propuesta de solicitud aprobada/rechazada (al familiar).
- Solicitud enviada (al estudiante).
- Solicitud recibida (a la residencia).
- Contacto establecido (al estudiante/familiar según `contact_target`).
- Inicio de plazo de 48 horas.
- Recordatorio de plazo.
- Propuesta de ajuste enviada por residencia (al estudiante).
- Propuesta de ajuste aceptada/rechazada (a la residencia).
- Pago recibido informado por residencia (al estudiante).
- Fee EstuRed pendiente (al estudiante/familiar).
- Fee pagado (a la residencia y al admin).
- Reserva confirmada (a ambas partes).
- Comprobante emitido (a ambas partes).
- Solicitud vencida (al estudiante, con botón de actualizar parámetros).
- Solicitud rechazada (al estudiante).
- Lista de espera activada.
- Disponibilidad nueva para lista de espera.
- Renovación ofrecida (al estudiante).
- Renovación aceptada/rechazada (a la residencia).
- Reclamo abierto.
- Resolución de conflicto actualizada.
- Cambio crítico de condiciones.

---

## 25. Auditoría

### 25.1 Acciones auditables

Deben auditarse:

- edición de perfil de residencia (todos los campos);
- cambios de tarifa, matrícula, depósito;
- cambios de disponibilidad;
- cambios de política de ajustes;
- creación de propuesta de solicitud por familiar;
- aprobación/rechazo de propuesta de solicitud por estudiante;
- solicitud enviada;
- contacto establecido (timestamp del botón WhatsApp presionado);
- propuesta de ajuste enviada por residencia;
- aceptación/rechazo de propuesta de ajuste por estudiante;
- rechazo de solicitud + motivo;
- pago recibido marcado por residencia;
- comprobante de pago cargado;
- fee pagado;
- fee validado manualmente;
- fee reembolsado;
- comprobante emitido;
- comprobante reemitido o anulado;
- reserva cancelada;
- no-show marcado;
- usuario vinculado/desvinculado;
- cambio de visibilidad de perfil;
- apertura de reclamo;
- resolución de conflicto;
- suspensión o expulsión;
- override de tipo de cambio por admin;
- acción de admin sobre cualquier operación (edición, pausa, anulación, override, reemisión, reembolso);
- cambio de feature flag de plan por residencia.

### 25.2 Datos mínimos de auditoría

Cada evento debe guardar:

- ID de evento;
- actor (userId);
- rol del actor;
- entidad afectada (tabla + ID);
- acción;
- valor anterior;
- valor nuevo;
- timestamp;
- IP/dispositivo si corresponde;
- motivo si aplica;
- fuente de la acción: usuario, admin, sistema, webhook.

---

## 26. Casos borde obligatorios para QA

Antes de lanzamiento, QA debe probar:

- familiar crea propuesta de solicitud → estudiante recibe notificación → aprueba → se convierte en solicitud activa;
- familiar crea propuesta → estudiante rechaza → propuesta expira → familiar notificado;
- propuesta del familiar en `pending_student_approval` no cuenta en el límite de 2 solicitudes del estudiante;
- estudiante intenta enviar más de 2 solicitudes activas → bloqueado;
- solicitud vence a las 48 horas → se muestra detalle + botón "Actualizar con mismos parámetros";
- residencia envía propuesta de ajuste → timer de 48h se reinicia;
- residencia intenta enviar segunda propuesta de ajuste → bloqueado con mensaje de advertencia;
- estudiante acepta propuesta de ajuste → fee se recalcula sobre nuevos valores;
- estudiante rechaza propuesta de ajuste → puede continuar con condiciones originales o cerrar;
- solicitud avanza y la otra solicitud del estudiante queda pausada;
- reserva confirmada cierra automáticamente las demás solicitudes del estudiante;
- plaza con 3 solicitudes visibles y 2 en cola;
- residencia marca pago recibido → se activa cobro del fee;
- fee EstuRed vence 48h sin pago → solicitud se cierra, residencia puede liberar plaza;
- fee cobrado → cobro duplicado bloqueado por idempotencia;
- fee manual validado por admin → factura emitida automáticamente;
- residencia cancela después de reserva confirmada → estudiante puede abrir reclamo;
- estudiante no se presenta → residencia puede marcar no-show;
- residencia rechaza por falta de disponibilidad repetidamente → alerta admin;
- disponibilidad `not_updated` por más de 15 días → residencia desaparece de búsquedas;
- residencia marca `Completa`;
- estudiante con reserva confirmada desaparece de listas de espera;
- disponibilidad nueva notifica lista de espera;
- tarifa sube más de 15% → alerta admin;
- menor de edad sin familiar vinculado → bloqueado en acciones sensibles;
- owner accede a dos residencias → contexto activo visible en UI;
- staff con acceso a dos residencias → no puede ver datos de residencia sin acceso;
- comprobante se emite solo con fee pagado;
- admin reemite comprobante → auditoría registrada;
- admin procesa reembolso del fee → auditoría registrada;
- reclamo abierto no suspende reserva automáticamente;
- usuario cambia visibilidad de datos → cambio reflejado de inmediato;
- solicitud iniciada por familiar → contacto de residencia va al familiar (no al estudiante);
- estudiante menor de edad con solicitud iniciada por él mismo → contacto de la residencia va al familiar vinculado;
- estudiante ejerce revocación dentro de los 10 días → reserva cancelada (`student_revocation_right`), comprobante anulado, fee queda `paid` pendiente de revisión admin;
- estudiante intenta revocar fuera de los 10 días → bloqueado con mensaje claro;
- fee con chargeback → alerta admin; reserva y comprobante no cambian automáticamente;
- fee vence sin ningún intento de pago → reserva pasa a `expired_fee_unpaid`.

---

## 27. Pendientes no bloqueantes

Los siguientes puntos no bloquean la construcción pero deben resolverse antes del lanzamiento público:

1. Revisión legal de fee no reembolsable y botón de arrepentimiento (incluyendo la alternativa "reembolso por defecto salvo servicio sustancialmente prestado").
2. Revisión legal de datos personales y menores de edad.
3. Redacción final de términos y condiciones (con revisión profesional).
4. Redacción final del acuerdo para residencias (con revisión profesional).
5. Precio del plan pago de Gestión Operativa.
6. Fórmulas definitivas de penalización cuando haya data suficiente.
7. Validación comercial/regulatoria del cobro en USD vía PayU (antes de activar PayU en producción).

---

## 28. Regla final para construcción

Claude Code no debe inventar reglas alternativas de solicitud, propuesta de familiar, negociación, reserva, pago, fee, comprobante, disponibilidad, renovación, lista de espera o visibilidad.

Si una regla no está definida en este documento, debe marcarse como pendiente antes de implementarse.
