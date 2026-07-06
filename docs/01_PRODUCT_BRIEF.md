# 01_PRODUCT_BRIEF.md
# EstuRed — Product Brief

Última actualización: 2026-06-27

Este documento describe EstuRed desde una perspectiva estratégica de producto. Sirve para alinear a fundadores, diseñadores, desarrolladores, colaboradores y Claude Code antes de entrar en especificaciones técnicas, pantallas, base de datos o arquitectura.

Debe leerse después de `00_DECISION_LOG.md` y antes de los documentos de alcance, reglas de negocio, flujos, estados y arquitectura.

---

## 1. Resumen ejecutivo

EstuRed es una webapp responsive para estudiantes que llegan a CABA desde el interior de Argentina o desde el exterior y necesitan encontrar una residencia estudiantil confiable antes de mudarse.

La plataforma conecta estudiantes, familias y residencias estudiantiles verificadas en un flujo estructurado: búsqueda, solicitud de reserva, revisión por parte de la residencia, negociación opcional de condiciones, pago inicial a la residencia, cobro del fee EstuRed y emisión de un comprobante de reserva confirmada.

El producto no busca ser un portal inmobiliario genérico ni un PMS tradicional. Su objetivo es construir una capa de confianza, transparencia y operación liviana para un mercado que hoy funciona de forma muy informal, dispersa y dependiente de WhatsApp, Instagram, recomendaciones o contactos directos.

El MVP debe validar una hipótesis central:

> Si EstuRed ofrece residencias verificadas, información clara, solicitud registrada, soporte y comprobante de reserva, estudiantes y familias estarán dispuestos a pagar un fee de servicio del 5% sobre la estadía inicial reservada, excluyendo el depósito reembolsable.

La visión futura es que EstuRed acompañe toda la experiencia del estudiante en la residencia, incluyendo renovaciones, comunidad visible, disponibilidad más confiable, métricas operativas, servicios complementarios y, más adelante, señales de convivencia.

---

## 2. Definición del producto

EstuRed es una plataforma digital especializada en residencias estudiantiles.

Permite que estudiantes y familias puedan:

- Buscar residencias verificadas en CABA.
- Comparar opciones con información estructurada.
- Revisar fotos, precios, reglas, composición de habitaciones y disponibilidad informada.
- Enviar solicitudes de reserva, o aprobar propuestas iniciadas por un familiar.
- Cargar datos y documentación de soporte.
- Negociar condiciones con la residencia dentro de un flujo estructurado.
- Registrar el proceso de reserva dentro de EstuRed.
- Pagar el fee de servicio (en ARS o USD, con MercadoPago o PayU).
- Obtener un comprobante de reserva confirmada con QR verificable.

Permite que residencias puedan:

- Publicar un perfil verificado.
- Reducir consultas repetidas.
- Recibir solicitudes más ordenadas.
- Confirmar disponibilidad manualmente o mediante gestión operativa.
- Gestionar solicitudes desde un dashboard.
- Proponer ajustes de condiciones a solicitudes activas (una vez por solicitud).
- Construir demanda futura mediante lista de espera.
- Acceder progresivamente a módulos de gestión operativa bajo un modelo freemium.
- Mejorar su visibilidad en función de métricas de respuesta, disponibilidad y cumplimiento.
- Gestionar hasta 10 residencias desde un mismo login (multi-residencia).

EstuRed debe entenderse como una plataforma de confianza y operación, no como un simple listado de alojamientos.

---

## 3. Posicionamiento

### 3.1. Posicionamiento principal

EstuRed ayuda a estudiantes que llegan a CABA a encontrar residencias verificadas y solicitar una reserva con mayor confianza, claridad y respaldo.

### 3.2. Frase conceptual

> La convivencia también se elige.

### 3.3. Frase funcional

> Encontrá una residencia verificada en CABA, enviá tu solicitud y confirmá tu reserva con comprobante EstuRed.

### 3.4. Qué NO es EstuRed

EstuRed no es:

- Un portal inmobiliario genérico.
- Un clasificado de residencias.
- Un marketplace masivo sin curaduría.
- Un PMS complejo.
- Una inmobiliaria tradicional.
- Una garantía absoluta sobre el comportamiento futuro de estudiantes o residencias.
- Un reemplazo de los acuerdos particulares entre residencia y estudiante.

### 3.5. Qué SÍ es EstuRed

EstuRed sí es:

- Una plataforma especializada en residencias estudiantiles.
- Un sistema de búsqueda confiable y curado.
- Un entorno de solicitud, negociación y reserva registrada.
- Una capa de verificación y control de calidad.
- Una herramienta operativa liviana para residencias (con opción de Gestión Operativa avanzada).
- Un sistema escalable hacia renovaciones, comunidad visible y gestión durante la estadía.

---

## 4. Problema principal

El problema principal no es solo encontrar una cama disponible.

El problema real es que muchos estudiantes deben elegir residencia desde otra ciudad o país con información incompleta, poco estructurada, informal o difícil de verificar.

Actualmente, el proceso suele depender de:

- Instagram.
- WhatsApp.
- Recomendaciones informales.
- Fotos no siempre actualizadas.
- Listas dispersas.
- Contactos directos con cada residencia.
- Condiciones poco estandarizadas.
- Disponibilidad que puede cambiar sin aviso.

Esto genera incertidumbre en estudiantes y familias, especialmente cuando la decisión debe tomarse antes de llegar a CABA.

Del lado de las residencias, el problema no siempre es falta de demanda. Muchas residencias pueden estar llenas o tener alta ocupación. Sus dolores están en:

- Consultas repetidas.
- Solicitudes desordenadas.
- Falta de trazabilidad.
- Dificultad para mostrar información completa.
- Dificultad para ordenar disponibilidad.
- Necesidad de construir demanda futura.
- Necesidad de profesionalizar su imagen.
- Riesgo de falsas expectativas o conflictos por condiciones mal entendidas.

EstuRed busca resolver esta brecha creando un flujo más confiable, verificable y estructurado.

---

## 5. Usuarios objetivo

### 5.1. Estudiante

El estudiante es uno de los dos usuarios primarios del producto.

Perfil inicial:

- Estudiante del interior de Argentina que llega a CABA.
- Estudiante extranjero que llega a CABA.
- Puede estar buscando su primera experiencia fuera de casa.
- Puede tener poca información local.
- Puede estar comparando opciones antes de viajar.

Necesidades:

- Encontrar residencias confiables.
- Comparar opciones de forma clara.
- Entender precios, reglas y disponibilidad.
- Saber qué pasos seguir para reservar.
- Evitar estafas o sorpresas.
- Obtener respaldo documental de la reserva.

Dolores:

- Distancia.
- Incertidumbre.
- Información dispersa.
- Desconfianza sobre fotos o condiciones.
- Falta de claridad sobre pagos iniciales.
- Ansiedad por perder disponibilidad.

Resultado esperado:

- Enviar una solicitud de reserva informada.
- Avanzar con una residencia confiable.
- Confirmar una reserva dentro de EstuRed.
- Obtener un comprobante verificable.

---

### 5.2. Residencia

La residencia es el segundo usuario primario del producto.

Perfil inicial:

- Residencia estudiantil ubicada en CABA.
- Puede tener alta ocupación o disponibilidad limitada.
- Opera con procesos manuales, WhatsApp o planillas.
- Necesita ordenar consultas y solicitudes.
- Puede querer profesionalizar su imagen.
- Puede gestionar hasta 10 residencias desde un mismo owner.

Necesidades:

- Mostrar información clara y verificada.
- Recibir solicitudes más estructuradas.
- Reducir consultas repetidas.
- Gestionar disponibilidad.
- Construir lista de espera.
- Mejorar previsibilidad de reservas.
- Acceder progresivamente a herramientas operativas (modelo freemium).

Dolores:

- Exceso de mensajes repetitivos.
- Falta de tiempo para responder.
- Solicitudes incompletas.
- Cambios constantes de disponibilidad.
- Dificultad para mostrar valor diferencial.
- Falta de métricas.

Resultado esperado:

- Recibir solicitudes mejor calificadas.
- Confirmar reservas con menos fricción.
- Mejorar visibilidad en la plataforma.
- Mantener ocupación y demanda futura.

---

### 5.3. Padre, madre o familiar vinculado

El familiar vinculado es usuario secundario clave.

Rol:

- Acompaña el proceso del estudiante.
- Puede proponer solicitudes de residencia al estudiante (propuesta que el estudiante debe aprobar antes de activarse).
- Puede sugerir favoritos.
- Puede cargar documentación.
- Puede pagar el fee EstuRed (en ARS o USD).
- Puede acceder a información relevante de la solicitud y descargar comprobantes.
- No reemplaza la decisión del estudiante.

Reglas principales:

- Debe registrarse y solicitar vinculación.
- El estudiante debe aceptar la vinculación.
- Un estudiante puede tener solo un familiar vinculado activo.
- Un familiar puede estar vinculado a más de un estudiante.
- Si el estudiante es menor de edad, el familiar vinculado es obligatorio.

---

### 5.4. Admin EstuRed

El admin interno es un usuario operativo obligatorio desde el MVP.

Responsabilidades:

- Verificar residencias.
- Aprobar cambios de perfil.
- Auditar acciones críticas.
- Supervisar solicitudes y reservas.
- Gestionar pagos y comprobantes.
- Procesar casos trabados.
- Administrar resolución de conflictos.
- Penalizar visibilidad.
- Suspender usuarios o residencias si corresponde.
- Gestionar feature flags de planes freemium por residencia.
- Override manual de tipo de cambio.

El panel admin no es un agregado posterior. Es parte del núcleo operativo del producto.

---

## 6. Propuesta de valor

### 6.1. Para estudiantes

EstuRed permite encontrar residencias verificadas en CABA, entender sus condiciones y enviar una solicitud de reserva con mayor confianza.

Valor principal:

- Menos incertidumbre.
- Información más clara.
- Residencias verificadas con visita presencial.
- Solicitud registrada y trazable.
- Comprobante de reserva confirmada con QR verificable.
- Soporte y acompañamiento durante la experiencia.

---

### 6.2. Para familias

EstuRed ofrece más claridad y respaldo en una decisión sensible, especialmente cuando el estudiante se muda desde otra ciudad o país.

Valor principal:

- Mayor seguridad percibida.
- Información centralizada.
- Participación controlada: pueden proponer, acompañar y pagar sin reemplazar la decisión del estudiante.
- Carga de documentación.
- Pago del fee (en ARS o USD, con MercadoPago o PayU).
- Acceso a comprobante verificable.

---

### 6.3. Para residencias

EstuRed ayuda a ordenar solicitudes, reducir consultas repetidas, mejorar visibilidad y profesionalizar la operación sin exigir la adopción de un PMS complejo.

Valor principal:

- Perfil verificado con sello EstuRed.
- Solicitudes más estructuradas y calificadas.
- Menos mensajes repetitivos.
- Mejor organización y trazabilidad.
- Lista de espera activa.
- Métricas de respuesta y conversión.
- Modelo freemium: módulos base gratuitos, Gestión Operativa como plan pago.
- Soporte para múltiples residencias desde un mismo login.

---

## 7. Loop principal del MVP

El producto debe organizarse alrededor de un único loop primario:

> Estudiante (o familiar con aprobación del estudiante) solicita → residencia responde → [negociación opcional de condiciones] → estudiante acepta condiciones finales → estudiante paga a la residencia → residencia confirma pago recibido → EstuRed cobra fee → reserva confirmada → comprobante emitido.

Este loop debe gobernar todas las decisiones del MVP.

Cualquier funcionalidad que no fortalezca este loop debe considerarse secundaria o futura.

### 7.1. Resultado del loop

El loop es exitoso cuando:

1. El estudiante encuentra una residencia confiable.
2. Envía (o aprueba) una solicitud.
3. La residencia decide avanzar.
4. Se acuerdan las condiciones finales (originales o ajustadas).
5. El estudiante completa el pago inicial requerido por la residencia.
6. La residencia confirma pago recibido.
7. EstuRed cobra el fee.
8. La reserva queda confirmada.
9. El estudiante recibe comprobante con QR verificable.

### 7.2. Restricción clave

No debe existir una reserva confirmada dentro de EstuRed si el fee de servicio no fue pagado correctamente.

---

## 8. MVP

### 8.1. Objetivo del MVP

Validar que estudiantes y familias están dispuestos a usar y pagar EstuRed para reservar una residencia verificada, y que residencias están dispuestas a gestionar solicitudes dentro de la plataforma.

El MVP debe probar tres cosas:

1. **Confianza:** los usuarios perciben más seguridad que en canales informales.
2. **Conversión:** los estudiantes envían solicitudes y avanzan a reserva.
3. **Negocio:** el fee del 5% sobre estadía inicial reservada puede capturar valor suficiente.

---

### 8.2. Alcance funcional del MVP

Incluye:

- Landing.
- Búsqueda de residencias.
- Fichas verificadas con FAQ asistida por residencia.
- Solicitudes de reserva (iniciadas por estudiante o propuestas por familiar con aprobación del estudiante).
- Flujo de negociación estructurado (1 propuesta de ajuste por solicitud, solo la residencia propone).
- Dashboard básico de residencia.
- Dashboard estudiante/familiar.
- Panel admin completo.
- Verificación presencial de residencias.
- Disponibilidad semi-real (Perfil Verificado) y real (Gestión Operativa).
- Contacto por WhatsApp (botón pre-formateado, sin integración API).
- Registro de pago recibido por residencia.
- Cobro de fee EstuRed (MercadoPago + PayU, o modo manual).
- Facturación automática del fee (Factura C, TusFacturas.app).
- Comprobante de Reserva Confirmada (PDF + QR verificable).
- Auditoría de acciones críticas.
- Comunidad visible básica con consentimiento explícito.
- Perfil de estudiante.
- Familiar vinculado.
- Lista de espera básica.
- Renovaciones.
- Multi-residencia por owner (hasta 10 residencias, scroll vertical, contexto activo).
- Modelo freemium para residencias.

---

### 8.3. Fuera del MVP

No incluir inicialmente:

- App móvil nativa.
- Señales de Convivencia.
- Reviews 360°.
- Ranking público.
- Comentarios libres.
- Firma digital.
- Escrow.
- Sistema avanzado de tickets.
- Check-in/check-out.
- Inventario.
- Marketplace de servicios.
- IA avanzada.
- Analítica avanzada.
- PMS complejo.
- Dashboard agregado multi-residencia.

---

## 9. Modelo de negocio

El modelo inicial combina:

- **Freemium para residencias:** módulos base (solicitudes, renovaciones, FAQ, lista de espera) son gratuitos. Gestión Operativa es plan pago.
- **Fee por reserva confirmada:** pagado por estudiante o familiar, en ARS o USD.
- **Suscripción mensual futura:** para residencias con módulos avanzados adicionales.

### 9.1. Fee EstuRed

El fee EstuRed es:

> 5% del total de la estadía inicial reservada, calculado sobre los valores finales aceptados por el estudiante, excluyendo únicamente el depósito reembolsable.

Incluye en la base de cálculo:

- Tarifa mensual final aceptada × duración inicial reservada.
- Matrícula o cargo de ingreso no reembolsable, si corresponde.

Excluye:

- Depósito en garantía reembolsable.

El fee es fijo. No se implementan descuentos en MVP.

El fee puede cobrarse en ARS (MercadoPago) o USD (PayU Argentina), según elección del pagador.

### 9.2. Justificación del fee

EstuRed entrega valor mediante:

- Curaduría y verificación presencial de residencias.
- Solicitud registrada y trazable.
- Flujo de negociación estructurado y documentado.
- Soporte y resolución de conflictos.
- Comprobante de Reserva Confirmada con QR verificable.
- Registro de condiciones aceptadas.
- Factura fiscal (Factura C).
- Acompañamiento ante casos relevantes.
- Acceso a la plataforma durante la experiencia.
- Renovaciones.

### 9.3. Residencias pioneras de beta

Las residencias que participan en la beta tienen acceso gratuito completo (incluyendo Gestión Operativa) durante 1 año.

Objetivo:

- Reducir fricción de adopción inicial.
- Construir oferta con pocas residencias curadas.
- Validar funcionamiento real del producto.
- Conseguir datos operativos antes de monetizar.

---

## 10. Moneda y precios

Las tarifas se muestran en USD y ARS.

**Se recomienda que las residencias configuren sus tarifas en USD** para mayor estabilidad. El sistema convierte a ARS usando el dólar blue (valor venta) de monedapi.ar, actualizado diariamente.

Siempre que se muestren precios en ARS, debe aparecer un aviso aclarando que es un valor referencial y que el valor final en pesos lo define la residencia al momento del pago.

El fee puede cobrarse en ARS o USD, según lo elija el pagador.

Reglas de redondeo:

- Tarifas en USD deben terminar en 0 o 5.
- Tarifas en ARS deben terminar en 500 o 000.
- El fee EstuRed se redondea a múltiplos de 500 ARS.

Las tarifas futuras pueden estar sujetas a ajustes definidos por cada residencia (mensual, trimestral, semestral, anual o sin ajustes).

---

## 11. Verificación y confianza

Ninguna residencia puede publicar sin estar verificada.

El sello público es:

> Residencia Verificada

Alcance del sello:

- Identidad de responsables revisada.
- Dirección verificada.
- Visita presencial realizada.
- Similitud con fotos revisada.
- Checklist firmado.
- Términos y responsabilidades aceptados.

El sello no significa que EstuRed garantice toda conducta futura, convivencia, permanencia, condiciones contractuales o cumplimiento absoluto de las partes.

Texto recomendado:

> Identidad, ubicación y fotos revisadas por EstuRed mediante control presencial.

---

## 12. Comunidad visible

La comunidad visible es un diferencial estratégico del producto.

En MVP existe en modalidad básica, combinando:

- Información agregada de residencia.
- Perfiles individuales cuando el estudiante haya aceptado visibilidad explícitamente.
- Datos limitados para invitados.
- Datos ampliados para usuarios registrados según configuración del estudiante.

Reglas:

- El estudiante controla visibilidad de su perfil.
- El consentimiento se obtiene en el registro con información clara.
- Datos sensibles nunca se muestran.
- Residentes no activados aparecen como "plaza ocupada" o "pendiente de activar cuenta".
- La residencia no puede forzar visibilidad individual completa.

Nunca mostrar públicamente: apellido completo, mail, teléfono, fecha de nacimiento, universidad, documentación.

La comunidad visible no incluye Señales de Convivencia en la primera etapa.

---

## 13. Disponibilidad

La disponibilidad del MVP es semi-real en Perfil Verificado.

Texto visible:

> Disponibilidad informada por la residencia. Requiere confirmación al solicitar.

Si una residencia usa Gestión Operativa con disponibilidad real por plaza/cama:

> Disponibilidad asegurada.

Reglas:

- La disponibilidad se define por tipo de habitación (Perfil Verificado) o plaza/cama (Gestión Operativa).
- La residencia debe actualizar disponibilidad al menos cada 30 días.
- Si no actualiza, recibe recordatorios, pierde visibilidad y puede desaparecer de búsquedas activas.
- Debe existir estado "Completa" para residencias sin cupos por ocupación total.
- Rechazos reiterados por falta de disponibilidad sin actualización afectan visibilidad.

---

## 14. Comprobante de reserva

El comprobante se llama:

> Comprobante de Reserva Confirmada

Se emite solo cuando:

1. La residencia informó pago recibido.
2. El fee EstuRed fue pagado correctamente.
3. La reserva quedó confirmada dentro de EstuRed.

Debe incluir:

- Datos del estudiante.
- Datos del familiar pagador, si aplica.
- Datos de la residencia.
- Tipo de habitación/plaza.
- Fecha estimada de ingreso.
- Duración inicial declarada.
- Objetivo académico declarado.
- Condiciones finales aceptadas.
- Monto informado por la residencia como abonado.
- Fee EstuRed abonado.
- Moneda, tipo de cambio y snapshot de condiciones.
- QR o código verificable (URL pública `/verify/[codigo]`).
- Aclaraciones sobre pagos futuros y ajustes.
- Disclaimer de alcance de EstuRed.

---

## 15. Métricas de éxito del MVP

Métricas de producto:

- Residencias verificadas activas.
- Solicitudes enviadas.
- Solicitudes respondidas.
- Tasa de respuesta en 48 horas.
- Tiempo promedio de primera respuesta.
- Solicitudes que avanzan a contacto.
- Solicitudes con propuesta de ajuste enviada.
- Propuestas de ajuste aceptadas vs. rechazadas.
- Reservas confirmadas.
- Fees cobrados.
- Conversión de ficha a solicitud.
- Conversión de solicitud a reserva.
- Solicitudes vencidas por falta de respuesta.
- Rechazos por falta de disponibilidad.
- Reclamos validados.

Métricas de negocio:

- Ingresos por fee.
- Fee promedio por reserva.
- Duración promedio de estadía reservada.
- Valor total de estadías reservadas.
- Tasa de objeción al fee.
- Tasa de cancelación atribuible a residencia.
- Residencias en plan freemium vs. plan pago.

Métricas de oferta:

- Residencias verificadas.
- Residencias activas.
- Residencias con disponibilidad actualizada.
- Residencias completas.
- Residencias con lista de espera.
- Residencias penalizadas.

---

## 16. Visión futura

La visión futura de EstuRed es acompañar toda la experiencia del estudiante y la residencia, no solo la búsqueda inicial.

Módulos y expansiones futuras:

- Señales de Convivencia.
- Evaluaciones Estudiante → Residencia.
- Evaluaciones Residencia → Estudiante.
- Bot asistido por IA avanzada.
- Servicios complementarios.
- Convenios con universidades.
- Expansión geográfica.
- Analítica avanzada pública.
- Dashboard agregado multi-residencia.
- Firma digital.
- Check-in/check-out avanzado.

El producto debe construirse con arquitectura modular para permitir estas expansiones sin reescribir el MVP.

---

## 17. Principios estratégicos

1. Confianza antes que volumen.
2. Loop de reserva antes que features secundarias.
3. Información clara antes que exceso de opciones.
4. Disponibilidad honesta antes que promesas absolutas.
5. Verificación real antes que crecimiento rápido.
6. Admin interno desde el día uno.
7. Auditoría de acciones críticas.
8. Privacidad y consentimiento desde el diseño.
9. Escalabilidad modular.
10. La experiencia no termina con la reserva.
11. Freemium primero, monetización de residencias progresiva.

---

## 18. Implicancias para diseño y desarrollo

El producto debe diseñarse alrededor de estados, no solo pantallas.

Las pantallas críticas son:

- Landing.
- Búsqueda.
- Ficha de residencia (con FAQ asistida y modal de tipo de cambio).
- Registro/login.
- Perfil estudiante.
- Vinculación familiar.
- Solicitud de reserva.
- Aprobación de propuesta del familiar.
- Negociación de condiciones (comparación original vs. propuesta).
- Dashboard estudiante/familiar.
- Dashboard multi-residencia (scroll vertical con filtro).
- Admin EstuRed.
- Pago de fee (selección MercadoPago / PayU).
- Comprobante (PDF + QR).
- Verificación pública de comprobante (`/verify/[codigo]`).
- Comunidad visible.

El sistema debe incluir desde MVP:

- Roles y permisos.
- Auditoría.
- Estados de solicitud (incluyendo `pending_student_approval` y `offer_pending_student_acceptance`).
- Estados de reserva.
- Estados de pago.
- Estados de residencia.
- Estados de verificación.
- Notificaciones.
- Gestión de documentos.
- Panel admin.
- Feature flags por residencia (freemium).
- Multi-tenant con contexto activo por residencia.

---

## 19. Pendientes no bloqueantes

Estos temas no impiden construir el MVP, pero deben resolverse antes del lanzamiento público:

- Revisión legal de términos y condiciones (requiere profesional).
- Revisión legal de fee no reembolsable y derecho de arrepentimiento.
- Revisión legal de protección de datos y menores de edad.
- Precio del plan pago de Gestión Operativa.
- Redacción final de textos legales del comprobante y del sello "Residencia Verificada".
- Protocolo operativo de resolución de conflictos.

---

## 20. Uso de este documento

Este archivo debe usarse para:

- Alinear visión estratégica.
- Explicar EstuRed a colaboradores.
- Orientar decisiones de UX.
- Evitar que el MVP crezca sin control.
- Servir como input para documentos técnicos.
- Guiar a Claude Code durante la construcción.

No debe usarse como especificación técnica completa. Para eso leer los documentos posteriores en este orden:

- `02_MVP_SCOPE.md`
- `03_BUSINESS_RULES.md`
- `04_STATE_MACHINES.md`
- `05_ROLES_AND_PERMISSIONS.md`
- `06_DATA_MODEL.md`
- `07_API_SPEC.md`
- `08_UI_SCREENS_AND_FLOWS.md`
- `09_ADMIN_PANEL_SPEC.md`
- `10_PRIVACY_AND_LEGAL_RULES.md`
- `11_TECH_ARCHITECTURE.md`
- `12_BUILD_PLAN.md`
- `13_CLAUDE_PROJECT_INSTRUCTIONS.md`
- `15_ENVIRONMENT_AND_SETUP.md`
