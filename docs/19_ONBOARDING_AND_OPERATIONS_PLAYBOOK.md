# 19_ONBOARDING_AND_OPERATIONS_PLAYBOOK.md

# EstuRed — Playbook de Onboarding y Operaciones

**Versión:** 1.1
**Estado:** Documento traducido y actualizado para construcción
**Última actualización:** 2026-06-27

## 1. Propósito del documento

Define cómo debe operar EstuRed durante el MVP y la beta controlada, traduciendo estrategia de producto, reglas de negocio, máquinas de estado, requisitos de admin y checklist de release a procedimientos operativos día a día.

Dirigido a: fundador/operador de EstuRed; usuarios admin; colaboradores de operaciones; Claude Code al construir herramientas admin y flujos operativos; futuro equipo de soporte, verificación u onboarding.

El objetivo es que EstuRed sea operativamente confiable antes de escalar. El MVP no es solo un sitio web: es un sistema operativo basado en confianza para descubrimiento, reserva, verificación, soporte y relación continua con residencias estudiantiles.

---

## 2. Principio operativo central

Todo proceso operativo debe proteger el loop central del MVP:

```text
Estudiante (o familiar con aprobación del estudiante) busca residencia
→ envía solicitud
→ residencia revisa
→ residencia establece contacto
→ [negociación opcional: la residencia propone un ajuste, una sola vez]
→ estudiante paga a la residencia
→ residencia marca pago recibido
→ EstuRed cobra el fee de servicio (ARS o USD)
→ se emite la factura fiscal
→ reserva confirmada
→ comprobante emitido
```

Si una tarea operativa no apoya este loop, reduce incertidumbre, mejora confianza, aumenta conversión, reduce carga de soporte o protege calidad, no debe priorizarse durante el MVP.

---

## 3. Filosofía operativa

### 3.1. Confianza antes que escala

Pocas residencias verificadas y bien gestionadas es mejor que un catálogo grande con información débil.

### 3.2. Calidad manual antes que automatización

Durante el MVP, la revisión manual es aceptable si mejora la confiabilidad. Automatizar recién cuando el flujo esté entendido.

### 3.3. Límites de responsabilidad claros

EstuRed facilita, registra, da soporte y puede intervenir en resolución de conflictos en casos específicos. No presta directamente el alojamiento ni garantiza el comportamiento futuro de residencias o estudiantes.

### 3.4. Trazabilidad en toda acción crítica

Debe registrarse: verificación; ediciones de perfil; decisiones sobre solicitudes; propuestas del familiar; negociaciones de condiciones; pagos; facturas fiscales; comprobantes; cancelaciones; soporte y resolución de conflictos; penalizaciones de visibilidad; overrides admin; cambios de feature flag freemium.

### 3.5. Reducir fricción sin ocultar consecuencias

La UX debe ser simple, pero todo pago, confirmación, rechazo, cancelación y decisión de visibilidad debe tener consecuencias claras.

---

## 4. Objetivo operativo de la beta

La beta controlada debe iniciar con: 5 a 10 residencias verificadas en CABA; mezcla de Perfil Verificado y Gestión Operativa (vía feature flag freemium); grupo limitado de estudiantes reales del interior y del exterior; soporte manual de EstuRed durante las primeras solicitudes y reservas; visibilidad admin total sobre cada operación; sin lanzamiento público masivo hasta que el loop principal sea estable.

La beta es exitosa cuando EstuRed puede completar reservas reales con seguimiento confiable, no cuando el sitio público se ve completo.

---

## 5. Onboarding de residencias — visión general

Ocho fases: 1) identificación de lead; 2) conversación de calificación; 3) alineación de propuesta de valor; 4) selección de modo; 5) recolección de datos; 6) visita de verificación; 7) creación y revisión de perfil; 8) capacitación de dashboard y go-live.

Cada fase debe registrarse en el panel admin.

---

## 6. Etapas de onboarding de residencias

### 6.1. Etapa 1 — Identificación de lead

Fuentes posibles: investigación manual; Instagram; Google Maps; referidos; recomendaciones de estudiantes; contactos universitarios; redes de residencias existentes; inbound directo.

Campos mínimos del lead: nombre de residencia; dirección o zona aproximada; persona de contacto; WhatsApp o email; Instagram/sitio web si existe; capacidad estimada; tipo aparente (residencia estudiantil, boutique, casa compartida); notas iniciales de calidad.

Estado admin: `lead_identified`.

### 6.2. Etapa 2 — Conversación de calificación

Debe ser consultiva, no orientada a venta agresiva.

Objetivo: entender ocupación actual; cómo reciben consultas; cómo gestionan disponibilidad; cómo confirman reservas; si cobran depósito, matrícula, seña u otro concepto; cómo gestionan renovaciones; si tienen preguntas recurrentes de estudiantes/familias; si están dispuestos a publicar información estructurada; si están dispuestos a recibir solicitudes verificadas vía EstuRed; si les interesa Perfil Verificado, Gestión Operativa, o ambas cosas eventualmente (aclarando que Gestión Operativa es un plan pago con acceso gratuito por 1 año si son residencia pionera).

Evitar liderar con: "les vamos a traer más demanda"; "somos un PMS"; "somos un marketplace normal"; "vamos a resolver toda su operación".

Liderar con: menos consultas repetidas; solicitudes mejor organizadas; flujo de reserva más claro; demanda futura y lista de espera; imagen profesional; perfil verificado; comprobantes de reserva; renovaciones; posibilidad de proponer un único ajuste de condiciones antes de confirmar una solicitud, si lo necesitan.

Estados admin: `qualification_in_progress`; `qualified`; `not_qualified`.

### 6.3. Etapa 3 — Alineación de propuesta de valor

La residencia debe entender qué es y qué no es EstuRed.

EstuRed es: una plataforma de descubrimiento y reserva de residencias verificadas; un canal de gestión de solicitudes con posibilidad de negociación estructurada de condiciones; una capa de visibilidad y confianza; un sistema de trazabilidad de reservas, pagos del fee y facturación fiscal; una futura herramienta de renovación y gestión operativa (bajo modelo freemium).

EstuRed no es: una garantía de comportamiento del estudiante; un representante legal de la residencia; un reemplazo completo de PMS durante el MVP; un sistema de ranking público; un tablón de anuncios pasivo.

La residencia debe aceptar que: la información publicada debe ser precisa; la disponibilidad debe actualizarse o marcarse como completa; el rechazo repetido por falta de disponibilidad afecta visibilidad; los pagos y reservas confirmados deben informarse con veracidad; no se permiten criterios discriminatorios; EstuRed puede suspender visibilidad si se violan los términos; cualquier cambio de condiciones sobre una solicitud ya enviada debe pasar por el mecanismo formal de propuesta de ajuste (una sola vez por solicitud), no por acuerdos informales fuera de la plataforma que luego generen disputas.

Estados admin: `value_aligned`; `terms_pending`.

### 6.4. Etapa 4 — Selección de modo

Modo A — Perfil Verificado (gratuito): perfil público completo; verificación; dashboard limitado; disponibilidad manual/semi-real por tipo; gestión de solicitudes (incluyendo recepción de propuestas de ajuste que la propia residencia envía); lista de espera; confirmación de reserva; comprobantes; métricas básicas; FAQ asistida.

Modo B — Gestión Operativa (plan pago, vía feature flag freemium): todo lo de Perfil Verificado más: habitaciones; plazas/camas; disponibilidad real o más precisa; residentes; comunidad visible; renovaciones; dashboard más completo; métricas operativas.

El modo puede mejorarse después. Las residencias pioneras de la beta reciben acceso gratuito a Gestión Operativa por 1 año — esto se activa como feature flag admin, no como cambio de plan de facturación automático.

Campo admin: `residence_mode = verified_profile | operational_management` + `has_operational_management_access` (booleano, controla el acceso real).

### 6.5. Etapa 5 — Recolección de datos

Datos requeridos: nombre de residencia; dirección; responsable; copia de DNI del responsable; DNI del coordinador si aplica; datos de contacto; fotos; tipos de habitación; composición estructural; precios en USD y ARS; matrícula si aplica; depósito si aplica; método de pago de reserva a la residencia; política de ajustes; reglas; servicios incluidos; áreas comunes; condiciones de reserva; reglas de cancelación/no-show; configuración de admisión estructural (género) si aplica; si está completa o tiene disponibilidad.

Datos recomendados: FAQ (del listado predefinido de EstuRed); mensaje del host/coordinador; perfil de estudiante que suelen recibir; duración típica de estadía; proceso de renovación; requisitos de check-in; documentos que suelen pedir.

Estados admin: `data_collection_pending`; `profile_data_complete`.

### 6.6. Etapa 6 — Visita de verificación

Obligatoria antes de publicación.

Debe confirmar: la dirección existe; la residencia opera en la dirección declarada; el responsable o coordinador autorizado está presente o validado; las fotos son razonablemente consistentes con el lugar real; existen los tipos de habitación y áreas comunes declaradas; la composición estructural es plausible; los servicios publicados son consistentes con la visita; no hay contradicción obvia entre perfil y realidad.

La verificación NO significa: garantía legal de la actividad de alojamiento; certificación de calidad de servicio futura; garantía de comportamiento de residentes; garantía permanente de precios o condiciones.

Registro requerido: fecha de visita; admin/operador que visitó; persona responsable presente; checklist completado; notas; fotos o evidencia interna si aplica; checklist firmado por ambas partes; decisión de verificación.

Estados admin: `verification_scheduled`; `verification_completed`; `verification_approved`; `verification_rejected`; `needs_changes`.

### 6.7. Etapa 7 — Creación y revisión de perfil

Checklist de revisión: fotos claras; presentación de precios consistente; precios USD terminan en 0 o 5; precios ARS terminan en 500 o 000; depósito separado de la base del fee; matrícula/cargo de ingreso claro; política de ajustes explícita; reglas visibles; lenguaje de disponibilidad correcto; sin lenguaje sensible o discriminatorio; sin garantías irreales; CTA claro; el perfil aclara que las solicitudes están sujetas a confirmación.

Estados de publicación: `profile_ready_for_publication`; `published`.

### 6.8. Etapa 8 — Capacitación de dashboard

Temas mínimos: cómo actualizar disponibilidad; cómo marcar estado completa; cómo revisar solicitudes; cómo establecer contacto; cómo enviar una propuesta de ajuste de condiciones (y que solo puede hacerse una vez por solicitud); cómo rechazar con motivo; cómo marcar pago recibido; cómo funciona la lista de espera; cómo funcionan las renovaciones; cómo funcionan métricas y penalizaciones; cómo evitar disponibilidad desactualizada; qué acciones quedan auditadas; si la residencia gestiona más de una propiedad, cómo funciona el dashboard multi-residencia (scroll vertical + filtro).

Capacitación corta y práctica.

Estados admin: `training_pending`; `training_completed`.

### 6.9. Etapa 9 — Go-live

Antes del go-live: residencia verificada; perfil completo; disponibilidad/estado completa configurado; usuario responsable con acceso; al menos un canal de contacto configurado; términos aceptados; capacitación de dashboard completada o exceptuada explícitamente por admin.

Estado go-live: `verified_active`.

---

## 7. Operaciones de onboarding de estudiante

Priorizar búsqueda rápida y creación confiable de solicitudes.

Datos mínimos requeridos antes de enviar solicitud: nombre; apellido; nacionalidad; fecha de nacimiento; dónde va a estudiar; email; teléfono; objetivo académico declarado; duración inicial de estadía.

Datos adicionales que mejoran probabilidad de aceptación pero no siempre son obligatorios: documentos; hábitos; intereses; ciudad de origen; foto de perfil; vínculo familiar.

Menores no pueden completar el onboarding sin cuenta de familiar vinculado.

---

## 8. Operaciones de onboarding de familiar

Un usuario familiar debe estar vinculado a un estudiante.

Reglas: un familiar activo por estudiante; un familiar puede vincularse a varios estudiantes; el estudiante debe aprobar el vínculo si es mayor de edad; el estudiante menor requiere vínculo familiar; el familiar puede pagar el fee, cargar documentos, subir comprobantes de pago, sugerir favoritos y crear propuestas de solicitud (que requieren aprobación del estudiante antes de llegar a la residencia); el familiar no puede reemplazar la decisión del estudiante ni aceptar una propuesta de ajuste en su nombre.

Casos operativos: si el familiar paga el fee, la factura fiscal se emite a nombre del pagador; el comprobante de reserva queda asociado al estudiante, mostrando al pagador/familiar si aplica; el acceso del familiar puede ser revocado por el estudiante mayor de edad.

---

## 9. Playbook operativo de solicitudes

### 9.1. Ingreso de solicitud

Una solicitud es válida cuando: el estudiante está registrado; los campos requeridos están completos; la residencia está verificada y activa; la residencia acepta solicitudes o tiene lista de espera; se guarda snapshot de condiciones; el estudiante aceptó los términos previos a la solicitud.

Vía adicional: la solicitud también puede originarse en una propuesta de solicitud del familiar aprobada por el estudiante — en ese caso, el snapshot se genera en el momento de la aprobación, no de la creación de la propuesta.

Verificaciones del sistema: el estudiante tiene menos de 2 solicitudes activas (las propuestas del familiar pendientes no cuentan); si otra solicitud está avanzando, aplicar lógica de pausa; si la residencia está completa, sugerir lista de espera en vez de solicitud.

### 9.2. Revisión de la residencia

Debe revisar: perfil del estudiante; campos requeridos; documentos autorizados; fechas; duración; tipo de habitación/plaza; compatibilidad con reglas declaradas de la residencia; quién inició la solicitud (`initiated_by`) y a quién debe dirigirse el contacto (`contact_target`).

Acciones de la residencia: establecer contacto; rechazar con motivo; pedir más información; dejar la solicitud pendiente; enviar una propuesta de ajuste de condiciones (solo una vez, después de establecer contacto).

La falta de respuesta repetida afecta métricas.

### 9.3. Contacto establecido

Cuando la residencia hace clic en "Contactar para avanzar": la solicitud pasa a `contact_established`; se genera el mensaje pre-formateado para WhatsApp (botón manual, sin integración de API), dirigido al número correcto según `contact_target` (si el estudiante es menor de edad, siempre el familiar vinculado); el estudiante o familiar es notificado; comienza el timer de 48 horas para pago a residencia; no existe ningún timer de 72 horas en ningún punto del flujo — corrección respecto a versiones anteriores de este documento; otra solicitud activa del estudiante se pausa.

Importante: el contacto no confirma la reserva.

### 9.3bis. Negociación de condiciones (sección nueva)

Después del contacto, la residencia puede — una sola vez por solicitud — enviar una propuesta formal de ajuste de condiciones dentro de la plataforma (tarifa, tipo de habitación, fecha, duración, depósito, matrícula, política de ajustes, monto de reserva; nunca datos del estudiante).

El sistema debe mostrar una advertencia bloqueante antes de permitir el envío: "Solo podés enviar una propuesta de ajuste por solicitud."

El estudiante ve una comparación entre condiciones originales y propuestas, y responde: acepta (se genera un nuevo snapshot final y el timer de 48h se reinicia para el pago), rechaza y continúa con las condiciones originales, o rechaza y cierra la solicitud.

Regla operativa clave: cualquier acuerdo verbal o por WhatsApp entre residencia y estudiante/familiar que implique un cambio de condiciones debe formalizarse a través de este mecanismo. EstuRed no puede hacer cumplir acuerdos informales no registrados en la plataforma, y en capacitación a residencias esto debe explicarse con claridad para evitar disputas post-reserva.

### 9.4. Pago a residencia

El estudiante paga a la residencia fuera de EstuRed, por el método que la residencia defina. Puede subir un comprobante como referencia propia.

La residencia debe marcar "Pago recibido". Solo esa confirmación avanza la operación.

Si el estudiante sube comprobante pero la residencia no confirma, admin puede revisar si se abre un caso de soporte.

### 9.5. Cobro del fee EstuRed

Después de que la residencia marca pago recibido: el fee EstuRed queda pendiente; fee = 5% del valor de la estadía reservada sobre las condiciones finales (snapshot final, con o sin negociación); incluye matrícula y cargos de ingreso obligatorios no reembolsables; excluye depósito reembolsable; no considera ajustes futuros; se cobra en ARS vía MercadoPago o en USD vía PayU, a elección del pagador — no está limitado a ARS; si el cobro automático falla, el sistema reintenta hasta 3 veces dentro de 48 horas; el pago manual puede ser validado por admin.

La reserva no se confirma hasta que el fee esté pagado. Al confirmarse el pago, se dispara automáticamente la emisión de la Factura C vía TusFacturas.app.

### 9.6. Confirmación de reserva

Se confirma solo cuando: la residencia marcó pago recibido; el fee EstuRed está pagado; no existe disputa bloqueante; se dispara la generación del comprobante.

Tras la confirmación: las demás solicitudes del estudiante se cierran automáticamente; el estudiante sale de otras listas de espera; la plaza puede marcarse reservada; el comprobante queda disponible con su `verification_code`; la factura fiscal queda asociada a la operación (si aún no se emitió, el sistema la reintenta sin bloquear la reserva).

---

## 10. Operaciones de lista de espera

Un estudiante puede sumarse cuando: la residencia está completa; la residencia no tiene disponibilidad visible; el estudiante está interesado en disponibilidad futura.

Reglas: no cuenta como solicitud activa; no genera estadísticas de solicitud; el estudiante permanece hasta ser removido manualmente, reservar en otro lado o elegir salir; a los 90 días recibe notificación preguntando si desea continuar; sin vencimiento automático por tiempo; la residencia puede remover estudiantes manualmente; cuando aparece disponibilidad, el estudiante recibe notificación especial; la residencia puede mostrar interés/contactar, pero la solicitud se activa solo si el estudiante decide activarla.

Admin debe monitorear: tamaño de lista por residencia; conversión de lista a solicitud; residencias que usan lista de espera sin actualizar disponibilidad.

---

## 11. Operaciones de renovación

Must Have.

### 11.1. Inicio de renovación

Dos disparadores posibles: el estudiante hace clic en "Solicitar renovación" (no vinculante); la residencia crea una oferta formal de renovación. Solo la oferta formal genera una renovación accionable.

### 11.2. Campos de la oferta de renovación

Estudiante; residencia; reserva/estadía actual; período de renovación; precio mensual; moneda; política de ajustes; pago requerido a residencia si aplica; fecha límite de aceptación; notas o condiciones.

### 11.3. Confirmación de renovación

Tras la aceptación: el estudiante paga a la residencia si corresponde; la residencia marca pago recibido; EstuRed cobra el fee de renovación (idéntico en fórmula al fee de reserva inicial, sin excepciones: 5% del período renovado, depósito excluido, sin ajustes futuros); se emite la factura fiscal; se emite el Comprobante de Renovación Confirmada con su propio `verification_code`.

### 11.4. Riesgos de las operaciones de renovación

Riesgos: estudiante y residencia renuevan fuera de EstuRed; la residencia demora en emitir la oferta; el estudiante pierde el plazo; los cambios de precio no son claros.

Mitigación: recordatorios tempranos; timeline claro de renovación; valor del comprobante; soporte y beneficios de la plataforma; impacto futuro en visibilidad/reputación.

---

## 12. Operaciones de disponibilidad

### 12.1. Disponibilidad en Perfil Verificado

La residencia publica disponibilidad por tipo de habitación/plaza.

Copy visible: "Disponibilidad informada por la residencia. Requiere confirmación al solicitar."

Debe actualizarse al menos cada 30 días o marcarse como completa. Si no: enviar recordatorios; mostrar "Sin disponibilidad actualizada" si corresponde; si persiste 15 días adicionales, la residencia deja de aparecer en búsquedas activas; penalizar si se repite.

### 12.2. Disponibilidad en Gestión Operativa

La residencia gestiona habitaciones y plazas.

Si la disponibilidad está actualizada y calculada por plaza: "Disponibilidad asegurada."

Estados operativos: `available`, `in_contact`, `temporarily_held`, `reserved`, `occupied`, `blocked`, `maintenance`, `unavailable`.

---

## 13. Operaciones de tarifas

Las residencias pueden editar precios, matrícula y depósito sin aprobación previa de admin.

El sistema debe: auditar cada cambio; guardar valores antes/después; disparar alerta admin ante cambios superiores a ±15% en una edición; mantener historial de tarifas; guardar valores USD y ARS; aplicar reglas de redondeo.

Reglas de precios: USD termina en 0 o 5; ARS termina en 500 o 000; la conversión en pantalla usa monedapi.ar (dólar blue, valor de venta) — corregido respecto a versiones anteriores que mencionaban "BCRA o fuente proxy"; el snapshot de la solicitud congela los valores para esa solicitud (y se actualiza a un snapshot final si hay negociación aceptada); los pagos mensuales futuros pueden cambiar según la política de ajustes de la residencia.

`/admin/pricing` debe soportar: revisión de alertas; marcar como revisado; contactar residencia; pausar publicación si se detecta abuso.

---

## 14. Operaciones de verificación

Anual y obligatoria.

Requerido: copia de DNI del responsable; DNI del coordinador si aplica; aceptación de términos; aceptación de deslinde de responsabilidad; confirmación de dirección; visita presencial; checklist firmado.

Debe renovarse anualmente. Si vence: notificar antes del vencimiento; marcar verificación por vencer; si no se renueva, marcar `verification_expired`; la residencia puede perder visibilidad o publicación hasta renovar.

---

## 15. Operaciones de edición de perfil

Tres clases:

15.1. Ediciones críticas que requieren aprobación admin: fotos; dirección; nombre; servicios incluidos; reglas; condiciones de reserva; capacidad total; tipos de habitación; documentación legal/de verificación.

15.2. Ediciones de precio con auditoría y alerta, sin aprobación: precios; matrícula; depósito; política de ajustes.

15.3. Ediciones menores sin aprobación, con auditoría: FAQ; mensaje de bienvenida; horarios de contacto; texto descriptivo no comercial.

Admin debe poder revisar todo el historial de ediciones.

---

## 16. Operaciones de comunidad visible

Existe en el MVP.

Reglas: invitados ven información limitada; registrados ven perfiles individuales y agregados según permisos; registrados y compañeros ven los mismos datos de comunidad; los residentes configuran visibilidad durante el registro; la residencia no puede forzar visibilidad de perfil completo; la residencia puede invitar a residentes a activar cuentas; los residentes pendientes aparecen como plaza ocupada o pendiente de activación, sin datos personales.

Nunca visibles: apellido completo; email; teléfono; fecha de nacimiento; universidad; documentos.

Admin debe poder: revisar perfiles reportados; ocultar visibilidad de perfil; auditar consentimiento; suspender perfiles abusivos.

---

## 17. Operaciones de soporte y resolución de conflictos

(Renombrado de "Mediación" — se evita ese término en comunicación pública por sus implicancias legales bajo la Ley 26.589 argentina.)

Puede abrirlo estudiante, familiar, residencia o admin.

Antes de proceder, mostrar: recordatorio de términos; alcance de la intervención de EstuRed; deslinde de responsabilidad; pedido de evidencia.

La evidencia puede incluir: fotos; videos; capturas de pantalla (incluyendo capturas de la conversación de WhatsApp, ya que EstuRed no tiene acceso directo a ella); audio; comprobantes; mensajes; descripción escrita.

Abrir un caso no suspende automáticamente reserva, renovación o solicitud. Admin puede suspender manualmente si es necesario.

Resultados posibles: sin acción; pedido de más información; acuerdo entre partes; reembolso de fee; penalización de visibilidad; pausa de residencia; suspensión de usuario; remoción de la red.

**Revocaciones del fee (botón de arrepentimiento):** cada revocación ejercida desde el footer abre automáticamente un caso interno de revisión. El admin evalúa posibles patrones de bypass (por ejemplo, revocar el fee después de usar el contacto para acordar por fuera de la plataforma), puede cotejar con la residencia, y resuelve manualmente el reembolso o su denegación, con motivo y auditoría. El fee permanece `paid` hasta esa resolución.

---

## 18. Operaciones de cancelación y no-show

### 18.1. Cancelación del estudiante después de confirmación

Fee generalmente no reembolsable; el reembolso de la residencia depende de su política; se actualiza el estado de la reserva; auditoría requerida.

### 18.2. Cancelación de la residencia después de confirmación

El estudiante puede abrir reclamo; EstuRed revisa el caso; el fee puede reembolsarse si es atribuible a la residencia; EstuRed ayuda a buscar alternativa cuando sea posible; la residencia puede recibir penalización de visibilidad.

### 18.3. No-show

Si el estudiante no se presenta dentro de las 24 horas del check-in acordado y no puede ser contactado: la residencia puede marcar no-show; la plaza puede liberarse; el fee no se reembolsa; la residencia conserva montos según su política; auditoría requerida.

---

## 19. Operaciones de penalización y visibilidad

Métricas internas durante el MVP.

Ponderación aprobada: respuesta y velocidad 25%; disponibilidad actualizada 20%; conversión a reserva 20%; perfil completo/verificado 15%; baja tasa de reclamos validados 10%; uso operativo de la plataforma 10%.

Etapas de penalización: `normal_visibility`; `warning`; `reduced_visibility`; `temporarily_paused`; `suspended`; `removed_from_network`. Admin puede hacer override con motivo.

Disparadores típicos: sin respuesta; vencimiento repetido; rechazo por falta de disponibilidad; disponibilidad desactualizada; disponibilidad falsa; cancelación confirmada atribuible a residencia; reclamos validados; información engañosa; comportamiento discriminatorio; tasa alta de propuestas de ajuste vencidas sin respuesta (señal observacional, no pondera todavía en el score).

---

## 20. Operaciones de notificaciones

Eventos requeridos: estudiante envía solicitud; residencia recibe solicitud; residencia tiene solicitud pendiente; familiar crea propuesta de solicitud; estudiante aprueba/rechaza propuesta del familiar; residencia establece contacto; residencia envía propuesta de ajuste; estudiante responde propuesta de ajuste; estudiante tiene 48 horas para pagar a residencia; 24 horas restantes; solicitud vencida; residencia marca pago recibido; fee pendiente; fee fallido; reintento de fee; fee pagado; factura fiscal emitida/fallida; reserva confirmada; comprobante emitido; disponibilidad en lista de espera; recordatorio de 90 días en lista de espera; oferta de renovación enviada; renovación por vencer; verificación por vencer; alerta de precio; reclamo/caso de soporte abierto.

Al menos un canal es obligatorio.

Configuración corregida (ya no incluye WhatsApp como canal):

- Email como canal obligatorio de respaldo.
- Notificación in-app cuando el usuario está conectado.
- WhatsApp NO es un canal de notificación del sistema — no hay integración de API. El único artefacto relacionado con WhatsApp es el botón manual pre-formateado que la residencia acciona al establecer contacto. Cualquier mención anterior a "WhatsApp preferido como canal de notificación" queda eliminada.

---

## 21. Ritmo operativo diario

Durante la beta, revisar diariamente: nuevas solicitudes; solicitudes por vencer; residencias sin respuesta; fee pendiente; fee fallido; **revocaciones pendientes de revisión**; **alertas de chargeback**; propuestas del familiar pendientes de aprobación; negociaciones activas por vencer; fallas de generación de comprobante; fallas de emisión de factura fiscal; reclamos abiertos; verificaciones pendientes; notificaciones de lista de espera; alertas de precio; disponibilidad desactualizada.

Checklist admin diario sugerido:

```text
1. Revisar alertas del dashboard admin.
2. Revisar verificaciones de residencia pendientes.
3. Revisar solicitudes activas y vencimientos.
4. Revisar propuestas del familiar y negociaciones pendientes.
5. Revisar pagos de fee pendientes/fallidos (ambos proveedores).
6. Revisar generación de comprobantes.
7. Revisar emisión de facturas fiscales.
8. Revisar reclamos y casos de soporte.
8bis. Revisar revocaciones pendientes y alertas de chargeback.
9. Revisar alertas de precios.
10. Revisar comportamiento de respuesta de residencias.
11. Hacer seguimiento con residencias si es necesario.
12. Registrar intervenciones manuales.
```

---

## 22. Ritmo operativo semanal

Durante la beta, revisar semanalmente: número de residencias activas; número de residencias verificadas; solicitudes enviadas; propuestas del familiar creadas/aprobadas/rechazadas; tasa de contacto establecido; tasa de negociaciones iniciadas/aceptadas; tasa de reserva confirmada; tasa de cobro de fee por proveedor; facturas fiscales emitidas/fallidas; causas de vencimiento de solicitud; causas de rechazo; residencias con mala respuesta; demanda de lista de espera; feedback de estudiantes; feedback de residencias; casos de soporte; bugs y fricción de producto; si hay owner multi-residencia activo, comportamiento del dashboard multi-residencia.

Salida semanal: mejoras de producto; lista de seguimiento de residencias; problemas de UX; problemas legales/de términos; bugs técnicos; prioridades del próximo sprint.

---

## 23. Templates

### 23.1. Primer contacto a residencia

```text
Hola [Nombre], soy [Nombre] de EstuRed.

Estamos construyendo una plataforma para ayudar a estudiantes que llegan a CABA a encontrar residencias verificadas y enviar solicitudes de reserva de forma más clara y ordenada.

No buscamos venderles "más consultas" sin filtro. La idea es ayudarlos a reducir preguntas repetidas, ordenar solicitudes, mostrar información confiable y construir demanda futura cuando estén completos.

¿Te puedo hacer algunas preguntas rápidas para entender cómo manejan hoy disponibilidad, reservas y consultas?
```

### 23.2. Seguimiento a residencia después de calificación

```text
Gracias por la charla. Por lo que me contaste, EstuRed podría ayudarles principalmente en:

- ordenar solicitudes;
- reducir consultas repetidas;
- mostrar disponibilidad de forma más clara;
- generar lista de espera;
- formalizar reservas con comprobante;
- gestionar renovaciones más adelante.

El siguiente paso sería armar el perfil verificado de la residencia y coordinar una visita presencial para validar dirección, fotos e información básica.
```

### 23.3. Coordinación de visita de verificación

```text
Para que la residencia pueda aparecer como "Residencia Verificada" en EstuRed, necesitamos coordinar una visita presencial.

La visita sirve para revisar dirección, responsable, fotos, espacios principales, composición de habitaciones y consistencia de la información publicada.

La verificación no es una garantía legal absoluta, sino una revisión presencial de identidad, ubicación e información básica para generar mayor confianza en estudiantes y familias.
```

### 23.4. Recordatorio de solicitud al estudiante

```text
Tu solicitud con [Residencia] está avanzando.

La residencia habilitó el contacto para que puedas completar el pago requerido por ellos y asegurar la plaza.

Recordá que la reserva dentro de EstuRed se confirma recién cuando la residencia informa el pago recibido y se abona el fee de servicio EstuRed.
```

### 23.5. Recordatorio de propuesta de ajuste recibida (nuevo)

```text
[Residencia] te propuso un ajuste a las condiciones de tu solicitud.

Podés ver la comparación entre lo que solicitaste originalmente y lo que te proponen ahora. Tenés 48 horas para aceptar, o para rechazar y elegir si continuás con las condiciones originales o cerrás la solicitud.

Recordá que esta es la única propuesta de ajuste que la residencia puede enviarte para esta solicitud.
```

### 23.6. Recordatorio de fee pendiente

```text
La residencia informó que recibió el pago de reserva.

Para confirmar la reserva dentro de EstuRed y emitir tu Comprobante de Reserva Confirmada, falta abonar el fee de servicio.

Podés pagarlo en pesos (MercadoPago) o en dólares (PayU). Tenés 48 horas para completar este paso.
```

### 23.7. Recordatorio de solicitud pendiente a residencia

```text
Tenés solicitudes pendientes en EstuRed.

Responder a tiempo mejora la experiencia del estudiante y ayuda a mantener buena visibilidad dentro de la plataforma.

Recordá que las solicitudes sin respuesta o los rechazos frecuentes por falta de disponibilidad pueden afectar la visibilidad de la residencia. Si necesitás ajustar alguna condición antes de confirmar, podés hacerlo una única vez a través de la propuesta de ajuste dentro de la plataforma.
```

---

## 24. Antipatrones operativos

No: publicar residencias no verificadas; confirmar reservas antes de que el fee EstuRed esté pagado; emitir comprobantes antes de confirmar la reserva; emitir facturas fiscales antes de que el fee esté pagado; ignorar pagos de fee fallidos; dejar que residencias rechacen repetidamente por falta de disponibilidad sin penalización; mostrar datos sensibles de estudiantes públicamente; tratar el comprobante subido por el estudiante como confirmación sin acción de la residencia; permitir acciones admin sin audit log; usar rankings públicos durante el MVP; dejar que un bot/IA invente precios, disponibilidad o condiciones; permitir ediciones de perfil sin auditoría; tratar la lista de espera como solicitud activa antes de que el estudiante la active; permitir que una residencia envíe más de una propuesta de ajuste por solicitud; dejar que el familiar envíe una solicitud sin aprobación del estudiante; otorgar acceso a Gestión Operativa sin el feature flag explícito.

---

## 25. Qué debe ser manual durante la beta temprana

Aceptable como trabajo manual: reclutamiento de residencias; verificación de residencias; revisión de calidad de perfil; validación manual de pagos; corrección/reemisión de comprobantes; reemisión manual de facturas fiscales si el proveedor falla repetidamente; soporte y resolución de conflictos; revisión de alertas de precio; escalamiento de soporte; capacitación de residencias; recolección de feedback.

El trabajo manual debe registrarse. Si una operación se repite seguido y de forma estable, puede automatizarse después.

---

## 26. Instrucciones de implementación para Claude Code

Debe usar este documento al construir: flujos de trabajo admin; pantallas de onboarding de residencia; herramientas de verificación; dashboards operativos; jobs de notificación; herramientas de soporte y resolución de conflictos; flujos de lista de espera; flujos de renovación; alertas de precios; dashboards de métricas; flujo de propuesta del familiar; flujo de negociación de condiciones; gestión de feature flags freemium; integración de facturación fiscal.

No debe: inventar atajos operativos; eliminar requisitos de verificación; saltear audit logs; tratar los pagos a residencia como procesados por EstuRed; confirmar reservas antes del pago del fee; emitir factura fiscal antes del pago del fee; hacer que la lista de espera cuente como solicitud activa; construir rankings públicos desde métricas internas; exponer datos sensibles por conveniencia; integrar la API de WhatsApp Business bajo ninguna circunstancia; permitir más de una propuesta de ajuste por solicitud; otorgar acceso a Gestión Operativa sin el feature flag activo.

---

## 27. Checklist de preparación operativa

Antes de la beta:

- [ ] Al menos 5 residencias verificadas.
- [ ] Cada residencia aceptó los términos.
- [ ] Cada residencia completó su perfil.
- [ ] Cada residencia configuró precios, matrícula, depósito y política de ajustes.
- [ ] Cada residencia configuró disponibilidad o estado completa.
- [ ] Cada owner tiene acceso al dashboard (incluyendo owners multi-residencia).
- [ ] Checklist de verificación firmado y almacenado.
- [ ] El panel admin puede gestionar solicitudes, propuestas del familiar, negociaciones, reservas, pagos, facturas fiscales, comprobantes y casos de soporte.
- [ ] Notificaciones configuradas (email + in-app, sin WhatsApp como canal).
- [ ] Flujo de pago de fee probado en ambos proveedores.
- [ ] Flujo de negociación de condiciones probado.
- [ ] Flujo de propuesta del familiar probado.
- [ ] Generación de comprobante probada.
- [ ] Emisión de factura fiscal probada.
- [ ] Lista de espera probada.
- [ ] Flujo de renovación probado.
- [ ] Configuración de privacidad probada.
- [ ] Flujo de soporte/contacto probado.
- [ ] Audit log probado.
- [ ] Feature flag freemium probado.
- [ ] Dashboard multi-residencia probado (si hay owner con más de una residencia en beta).

---

## 28. Regla operativa final

EstuRed no debe escalar agresivamente hasta poder ejecutar de forma confiable:

```text
residencia verificada publicada
→ solicitud real de estudiante enviada (directa o vía propuesta del familiar aprobada)
→ residencia responde a tiempo
→ contacto establecido
→ [negociación opcional resuelta sin abusar del límite de 1 propuesta]
→ pago a residencia confirmado
→ fee EstuRed pagado
→ factura fiscal emitida
→ comprobante emitido
→ operación auditable desde admin
```

Si este loop es inestable, el crecimiento debe pausarse y las operaciones deben corregirse primero.
