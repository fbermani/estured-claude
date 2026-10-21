# Auditoría de producto y experiencia — EstuRed

**Fecha:** 2026-10-20 · **Alcance:** app completa (público, estudiante, familia, residencia owner/staff, admin) · **Estado auditado:** `main` en `b08e789` (Ciclo 43, migración 0035 aplicada) · **Primera auditoría** en `docs/audits/` (antecedentes: auditorías UX de los Ciclos 35–35septies registradas en `MEMORY.md`, cuyos hallazgos no se repiten acá).

**Método:** recorrido real con el dev server (`estured-dev`) y el widget "Simular usuario" como Lucía, Camila, Valentina, Martín, Ricardo, Sofía y Admin operativo, en 1280px y 375px. Solo navegación y lectura: no se ejecutó ninguna acción que mute datos compartidos. Para confirmar causas se leyó código (`app/`, `lib/`) y se hicieron consultas **de solo lectura** a Supabase.

**Evidencia (capturas, fuera del repo):** `/private/tmp/claude-501/-Users-fabriciobermani-Desktop-EstuRed-Claude/94ba1258-4fc8-4493-b283-e1ba44e50eb7/scratchpad/evidencia/` (`01_…` a `09_…`, referenciadas en cada hallazgo como [cap. NN]).

**Leyenda de tipo:** **[Doc]** desvío objetivo de `docs/00`–`22` · **[Producto]** opinión de producto del auditor · **[Ambos]** desvío más opinión.

---

## 1. Resumen ejecutivo

EstuRed tiene una base visual y de copy cuidada. La transparencia del formulario de solicitud es muy buena y las reglas sensibles se validan del lado del servidor. Pero **la historia que cuenta la app no es coherente**. Un mismo hecho (si una reserva está confirmada, cuándo termina un contrato, cuánto se paga, si hay lugar) se muestra distinto según la pantalla y el rol. Para un producto cuyo valor es la confianza, este es el problema de fondo. Además, el **loop central tiene dos puntos ciegos justo donde se cobra**: el estudiante no sabe cómo pagar el fee y las reservas canceladas o vencidas se le muestran como pendientes de pago. Las familias, que la landing presenta como público clave, tienen hoy una experiencia mínima con un enlace roto. El dataset demo se degradó con el paso del tiempo y con los tests que corren contra la misma base, así que hoy una demo mostraría un catálogo sin disponibilidad y notificaciones de "Residencia Test Integración".

**Los 5 problemas más importantes:**

1. **Estados de reserva mal comunicados (H01, crítico).** A Camila se le muestran una reserva cancelada y una con fee vencido como "Reserva creada — Ya podés pagar el fee EstuRed", sin botón para hacerlo. La residencia y el admin ven "Reserva creada" en reservas confirmadas, canceladas y vencidas por igual.
2. **El cobro del fee no tiene camino (H02, crítico).** La pantalla del fee dice "coordiná el pago por transferencia con soporte", sin datos de pago, sin plazo visible y con un Soporte pensado para reclamos contra residencias.
3. **La disponibilidad tiene tres verdades (H03, crítico).** La card dice "Sin disponibilidad actualizada", Disponibilidad dice "Completa", la ficha ofrece "Cama disponible — Elegí este lugar" y Habitaciones dice "9 vacantes", todo en la misma residencia.
4. **Privacidad de la comunidad sin control del estudiante (H04, crítico).** Guardar "Mi perfil" vuelve visible el perfil, no hay ningún control de visibilidad (tampoco para menores) y la pantalla de Residentes le dice a la residencia que "el residente controla su propia visibilidad", lo cual es falso.
5. **La misma estadía cuenta dos historias (H05, alto).** Lucía ve el contrato hasta el 20/1/2027 a USD 350, "quedan ~3 meses" y "renovación confirmada". Ricardo ve el contrato hasta el 15 jul 2027 a USD 280 "personalizada". El fix del Ciclo 43 cubrió solo el lado residencia.

---

## 2. Hallazgos

Formato: **ID · Título** — Severidad · Rol · Dónde · Tipo · Agente sugerido · Esfuerzo.

### A. Loop central: solicitud → pago → fee → reserva → comprobante

#### H01 · Las reservas canceladas o con fee vencido se muestran como pendientes de pago, y los tres roles ven estados distintos
- **Severidad:** crítico · **Rol:** estudiante, residencia, admin · **Tipo:** [Doc] docs/08 §2.3 (separar solicitud y reserva), §12 (estados de error) · **Agente sugerido:** `constructor` · **Esfuerzo:** M
- **Dónde:** `/students/applications`, `/students/applications/[id]`, `/students/dashboard` (Camila, Lucía); `/residence/[id]` y `/residence/[id]/applications` (Ricardo y Sofía); `/admin/applications`.
- **Qué pasa:**
  - **Estudiante.** La lista y el detalle leen `application_requests.status` (`converted_to_reservation`) e ignoran el estado de la reserva salvo `confirmed`/`pending_estured_fee`. Las reservas `cancelled_by_student` y `expired_fee_unpaid` de Camila aparecen como **"Reserva creada — La residencia confirmó tu pago. Ya podés pagar el fee EstuRed"**, sin CTA, y con el formulario "Subir comprobante de pago" del paso anterior. En la reserva confirmada de Lucía, el badge dice "Reserva confirmada" pero el texto de ayuda dice "Ya podés pagar el fee para confirmar tu reserva", y el inicio la resume como "Reserva creada".
  - **Residencia.** El panel muestra "Reserva creada" y el inbox muestra "Reserva" para las tres reservas de Camila (confirmada, cancelada y fee vencido). La residencia no puede saber quién viene de verdad.
  - **Admin.** `/admin/applications` dice "RESERVA CREADA" para las cuatro. Solo `/admin/activity?tab=reservations` muestra el estado real.
- **Por qué importa:** el estudiante puede creer que todavía puede (o debe) pagar algo que ya no existe. La residencia puede guardar una plaza para alguien que canceló. Es exactamente la confusión entre solicitud y reserva que el producto promete evitar.
- **Recomendación:** derivar en un solo helper la etiqueta que se muestra a partir de solicitud + reserva (`reservation.status` manda cuando existe) y usarlo en los tres roles. Mapear `cancelled_*`, `expired_fee_unpaid`, `revoked` y `pending_manual_payment` con copy propio y una acción siguiente ("Tu reserva venció porque no se pagó el fee. Si querés retomarla, escribinos"). Ocultar la subida de comprobante a residencia cuando la reserva ya existe.

#### H02 · El paso del fee EstuRed no le dice al estudiante cómo pagar
- **Severidad:** crítico · **Rol:** estudiante y familiar pagador · **Tipo:** [Ambos] docs/02 §7.18 y docs/08 §6.8 (MercadoPago/PayU, ARS o USD); [Producto] el modo manual no tiene instrucciones · **Agente sugerido:** `dueño` (definir cómo se cobra en modo manual) → `constructor` · **Esfuerzo:** M
- **Dónde:** `/students/applications/[id]/fee` (revisado por código: no hay datos demo en `pending_estured_fee`).
- **Qué pasa:** la pantalla dice "El cobro automático… todavía no está activado. Mientras tanto, coordiná el pago por transferencia con soporte y subí el comprobante acá". No hay CBU/alias, monto a transferir con referencia, plazo (la ventana vence sola por `expireEsturedFeeWindows`), enlace a soporte con el contexto precargado ni opción en USD. Soporte (`/students/support`) es un formulario de reclamo ("¿Algo no salió como esperabas con una residencia?") que exige elegir residencia y aceptar un descargo.
- **Por qué importa:** es el momento en que EstuRed cobra. Si el estudiante no sabe a dónde transferir, la reserva vence y el loop se rompe justo en el punto de monetización. Además le pedimos datos de facturación antes de explicarle cómo pagar.
- **Recomendación:** el dueño decide los datos de cobro manual (cuenta, alias, titular) y si el fee se puede pagar en USD. Mostrarlos en la pantalla junto al monto exacto, una referencia única (n.º de reserva) y la cuenta regresiva del plazo. Sumar un CTA "Tengo un problema con el pago" que abra soporte con la reserva precargada. Mostrar el plazo también en "Mis solicitudes".

#### H03 · La disponibilidad tiene tres fuentes de verdad que se contradicen
- **Severidad:** crítico · **Rol:** estudiante, invitado, residencia · **Tipo:** [Ambos] docs/08 §2.6 y §4.5 ("Disponibilidad asegurada" solo con Gestión Operativa); [Producto] fuente de verdad única · **Agente sugerido:** `dueño` (qué manda: tipo de habitación o cama) → `constructor` · **Esfuerzo:** L
- **Dónde:** Residencia Río de la Plata: `/search` y la landing ("Sin disponibilidad actualizada" + "Sin lugares informados") [cap. 01]; `/residence/[id]/availability` (Cuádruple y Doble "Completa"; Individual y Triple "Sin actualizar · oculta de las búsquedas"); `/residence/[id]/rooms` ("9 vacantes", Cuádruple 1 y Doble 1) [cap. 06]; ficha `/residencias/[slug]#disponibilidad` y `/students/residency` ("Cama disponible — Elegí este lugar para tu solicitud" en Cuádruple, Doble, Individual y Triple).
- **Qué pasa:** el catálogo deriva el estado de `profile_availability` por tipo de habitación. El bloque "Comunidad y disponibilidad" de la ficha deriva camas libres de las habitaciones físicas y de `resident_stays`, sin mirar `profile_availability`. Resultado: la ficha invita a elegir una cama concreta de un tipo que la residencia marcó "Completa" (y que no tiene Gestión Operativa, H09). Lucía, ya alojada, ve en "Mi residencia" el CTA "Elegí este lugar para tu solicitud".
- **Por qué importa:** "Cama disponible" a nivel de cama es lenguaje de disponibilidad asegurada. Si el estudiante elige una cama y la residencia la rechaza porque está completa, el producto mintió. La residencia tampoco puede controlar lo que se publica.
- **Recomendación:** decidir la fuente de verdad. En Perfil Verificado debería mandar el estado por tipo de habitación: el mapa de camas solo informa ocupación y no ofrece "Elegir" si el tipo no está `available_to_confirm`. En Gestión Operativa, la cama. Unificar el copy con `StatusTag`. Sacar el CTA de solicitud del contexto "Mi residencia".

#### H04 · Comunidad visible sin control del estudiante (incluidos menores) y con un copy falso hacia la residencia
- **Severidad:** crítico · **Rol:** estudiante (especialmente menores), residencia · **Tipo:** [Doc] docs/00 §18 ("la configuración de visibilidad… puede modificarse en cualquier momento"), docs/10 §7.1, §7.6, §8.2, §9.2, docs/02 §7.6 · **Agente sugerido:** `dueño` + `seguridad` → `constructor` · **Esfuerzo:** M
- **Dónde:** `/students/profile` (no hay ningún control de visibilidad); `app/students/profile/actions.ts` (al guardar fuerza `is_individual_profile_visible: true`); `/residence/[id]/residents` (pie de página: "El residente controla su propia visibilidad en la comunidad pública"); registro de estudiante (no pide ni explica consentimiento de comunidad).
- **Qué pasa:** la decisión de los Ciclos 37/39 (sacar el toggle) no pasó por los docs (protocolo docs/13 §5). Cualquier estudiante que guarde su perfil queda visible para cualquier usuario registrado (crear una cuenta es libre), con su bio, que no tiene control propio. El `is_minor` no cambia nada. A la vez, los campos individuales (`show_*_to_registered`) nacen en `false` y no tienen UI. Por eso los perfiles reales nunca van a mostrar carrera, intereses ni nacionalidad, que es lo que la landing vende ("Hoy ya podés ver… nombre, carrera, intereses"): solo lo muestran los residentes del seed.
- **Por qué importa:** expone a menores sin consentimiento explícito, le dice algo falso a la residencia y vacía de contenido real el diferencial "comunidad visible".
- **Recomendación:** volver a un control simple en "Mi perfil" (vista previa de "así te ven" + 3 o 4 interruptores con defaults recomendados) y pedir el consentimiento en el registro (paso 2). Para menores: perfil individual oculto por defecto para registrados (docs/10 §9.2). Si el dueño mantiene "siempre visible", actualizar docs/00 §18 y docs/10 §7, corregir el copy de Residentes y pasarlo por revisión legal.

#### H05 · La misma estadía cuenta dos historias: fecha de fin y tarifa distintas para estudiante y residencia
- **Severidad:** alto · **Rol:** estudiante, residencia · **Tipo:** [Ambos] continuidad del Ciclo 43; docs/08 §2.7 (contexto y snapshot) · **Agente sugerido:** `constructor` · **Esfuerzo:** M
- **Dónde:** Lucía en `/students/dashboard` [cap. 03], `/students/residency` y `/students/renewals` ("Fin del contrato 20/1/2027", "Restante 92 días", "Renovación confirmada", "USD 350"); `/students/renewals/[id]` ("Nuevo período 2027-01-15 → 2027-07-15", que se superpone 5 días con el 20/1); Ricardo en `/residence/[id]/residents` ("Contrato hasta 15 jul 2027", "USD 280 personalizada"); comprobante: "Tarifa mensual acordada USD 350".
- **Qué pasa:** del lado estudiante, la fecha se calcula con `addMonthsDateOnly(start_date, initial_duration_months)` (`app/students/residency/page.tsx`, `renewals/page.tsx`, `dashboard/page.tsx`) e ignora renovaciones y `resident_stays.expected_end_date`. La tarifa "personalizada" de la estadía no coincide con el snapshot de la reserva ni de la renovación.
- **Por qué importa:** una estudiante que renovó y pagó un segundo fee sigue viendo "quedan ~3 meses". Si residencia y estudiante discuten cuánto se paga por mes, la app avala las dos versiones.
- **Recomendación:** que el lado estudiante lea el fin de contrato vigente (estadía vinculada → `expected_end_date`; si no, la última renovación confirmada; si no, la reserva) y muestre "Renovada hasta…". Para la tarifa, el dueño decide si una "tarifa personalizada" de Residentes puede diferir del snapshot aceptado. Si puede, mostrársela al estudiante y registrarla. Si no, bloquearla para estadías vinculadas. Corregir también el solapamiento de fechas de la renovación del seed.

#### H06 · `contact_established` nunca vence, y la residencia tiene un paso manual que los docs no prevén
- **Severidad:** alto · **Rol:** estudiante, residencia · **Tipo:** [Doc] docs/04 l.303 (`contact_established → expired_no_student_payment` a las 48 h) y l.286 (el paso a `residence_payment_pending` lo hace el sistema) · **Agente sugerido:** `depurador` (job) + `dueño` (paso manual) · **Esfuerzo:** M
- **Dónde:** `lib/jobs/expireApplicationRequests.ts` (solo vence `residence_payment_pending`); `enableResidencePayment` ("Continuar sin cambios (habilitar pago)"); `/residence/[id]/applications` de Norte (Camila y Lucía en "Contacto establecido" desde el 22/7, agrupadas como "Próximas a vencer" y "En negociación" respectivamente).
- **Qué pasa:** si la residencia no envía propuesta ni toca "habilitar pago", la solicitud queda en contacto establecido para siempre. Como establecer contacto pausa las demás solicitudes del estudiante, la solicitud de Camila a Río de la Plata está "Pausada" hace tres meses.
- **Por qué importa:** son solicitudes zombis que bloquean al estudiante sin que nadie lo vea, y un paso extra para la residencia que el doc no pide.
- **Recomendación:** que el job también venza `contact_established` con `payment_deadline_at` pasado. El dueño decide si el pago se habilita solo al establecer contacto (como dice docs/04) o se mantiene el botón. En ese caso, documentarlo y mostrar el plazo en el inbox.

#### H07 · Detalle de solicitud y comprobante sin snapshot; el precio se lee del valor actual
- **Severidad:** alto · **Rol:** estudiante, familiar · **Tipo:** [Doc] docs/02 §12 (snapshot), docs/08 §2.7, docs/01 §14 (contenido del comprobante) · **Agente sugerido:** `constructor` · **Esfuerzo:** M
- **Dónde:** `/students/applications` ("Importe estimado" = `room_types.monthly_price_usd` actual); `/students/applications/[id]` (sin montos ni línea de tiempo); `/students/receipts/[id]`.
- **Qué pasa:** si la residencia cambia el precio, la solicitud del estudiante muestra el precio nuevo. El detalle no muestra lo que se acordó (USD/ARS, tipo de cambio, matrícula, depósito, base del fee, fee) ni los pasos recorridos. El comprobante no incluye el monto informado como pagado a la residencia, depósito/matrícula, tipo de cambio, política de ajustes ni el familiar pagador, y muestra al usuario un texto de desarrollo: "Descarga de Factura C disponible cuando exista la integración de facturación fiscal real".
- **Recomendación:** leer siempre del snapshot (final, y si no, original). Agregar al detalle una línea de tiempo (enviada → contacto → pago a residencia → fee → confirmada) con la próxima acción. Completar el comprobante según docs/01 §14 y reemplazar el texto de Factura C por "Tu factura llega por email" o quitarlo.

#### H08 · No está definido qué paga el estudiante a la residencia y cuándo
- **Severidad:** alto · **Rol:** estudiante, familia, residencia · **Tipo:** [Producto] · **Agente sugerido:** `dueño` · **Esfuerzo:** S (decisión) + S (copy)
- **Dónde:** ficha → `ApplyForm` ("Total de la reserva USD 1.800", que excluye el depósito); WhatsApp pre-formateado de la residencia ("Monto para reservar: USD 300"); fee ("Va aparte del pago que le hiciste directamente a la residencia").
- **Qué pasa:** la solicitud muestra el total de la estadía, el WhatsApp habla de un "monto para reservar" igual a un mes, y en ningún lado se dice cuánto es el pago inicial a la residencia (¿primer mes?, ¿depósito?, ¿matrícula?).
- **Por qué importa:** el paso "pagar a la residencia" es el corazón del loop y la familia necesita saber cuánto transferir. Sin eso, la negociación por WhatsApp vuelve a la informalidad que el producto quiere reemplazar.
- **Recomendación:** que la residencia defina en el perfil un "pago inicial para reservar" (o una regla fija) y que se muestre igual en la ficha, la solicitud, el WhatsApp y el fee: "A la residencia: USD X antes de [fecha] · A EstuRed: fee USD Y".

### B. Público y descubrimiento

#### H09 · La frontera freemium es incoherente: "sin acceso" a Gestión Operativa, pero se usan sus funciones
- **Severidad:** alto · **Rol:** residencia, admin · **Tipo:** [Ambos] docs/08 §3.3 (Habitaciones y Residentes son Gestión Operativa), docs/02 §15 · **Agente sugerido:** `dueño` · **Esfuerzo:** M
- **Dónde:** `/residence/[id]/plan` ("Sin acceso a Gestión Operativa"); el sidebar ofrece Habitaciones y Residentes a todas; `/admin/residences` ("SIN ACCESO" en las tres); la ficha deja elegir cama exacta; `/for-residences` vende como plan pago "Gestión de habitaciones, plazas y residentes", "El estudiante elige la cama exacta", "Métricas de gestión" y "Prioridad de visibilidad".
- **Por qué importa:** la residencia no entiende qué tiene y qué no; el plan pago pierde sentido si lo pago ya está abierto, y la landing promete métricas que no existen (no hay `/metrics`).
- **Recomendación:** el dueño decide qué queda en el plan gratuito (por ejemplo, Residentes sí y cama exacta no). Reflejarlo en el sidebar (candado más explicación), en "Tu plan" (qué incluye y cómo pedirlo, con CTA) y en la landing. Sacar de la landing lo que no existe.

#### H10 · La ficha pública no muestra precios, condiciones ni estado de disponibilidad, salvo a estudiantes logueados
- **Severidad:** alto · **Rol:** invitado, familiar, residencia (vista previa) · **Tipo:** [Doc] docs/08 §4.5 (precio USD + ARS + modal, política de ajustes, matrícula, depósito, bloque de disponibilidad), docs/02 §7.3 · **Agente sugerido:** `interfaz` · **Esfuerzo:** M
- **Dónde:** `/residencias/[slug]` como invitado (verificado con `curl`, sin "USD" en todo el HTML), como Ricardo [cap. 02] y como Martín (solo ve los precios por tipo dentro del selector, sin desglose).
- **Qué pasa:** los precios, el desglose (renta, depósito, fee) y las condiciones solo aparecen dentro de `ApplyForm`. La card del catálogo muestra "USD 170 desde" y la ficha nada. `/for-students` promete "matrícula y depósito explícitos, políticas de ajuste publicadas".
- **Por qué importa:** el precio es lo primero que compara una familia. Obligar a crear una cuenta de estudiante para verlo contradice "Precios claros" y empuja al usuario de vuelta a WhatsApp.
- **Recomendación:** una sección "Tarifas y condiciones" visible para todos (tabla por tipo de habitación: USD, ARS referencial con `ExchangeRateNote`, matrícula, depósito, estadía mínima, política de ajustes) más el `StatusTag` con `withTip` por tipo. El desglose del fee puede quedar en el formulario.

#### H11 · Promesas y datos no respaldados en las landings y en el copy
- **Severidad:** alto · **Rol:** todos · **Tipo:** [Ambos] CLAUDE.md regla 4 y "no replicar datos falsos" · **Agente sugerido:** `interfaz` (copy) · **Esfuerzo:** S
- **Dónde y qué:**
  - `/for-residences`: "–70% menos consultas repetidas por WhatsApp" (no hay dato que lo respalde); "Una FAQ asistida responde por vos" y "Responde automáticamente…" (no existe, ver H12).
  - Landing y `/for-students`: "Lo que ves publicado es lo que vas a encontrar" / "Lo que ves publicado es real" (es una garantía; docs/01 §11 dice que el sello no garantiza todo).
  - `/students/dashboard`: "enviá tu primera solicitud para asegurar tu lugar"; `StartRenewalModal`: "Renová con anticipación para asegurar tu lugar".
  - `/for-students` paso 1: "completá… tu presupuesto y tu fecha estimada de mudanza" (el perfil no tiene esos campos).
- **Recomendación:** quitar la cifra o reemplazarla por un beneficio cualitativo; describir la FAQ como lo que es ("Preguntas frecuentes en tu ficha"); cambiar "asegurar tu lugar" por "dar el primer paso" y "renovar con tiempo"; reescribir la promesa de verificación con el texto recomendado por docs/01 §11.

#### H12 · Faltan Must Have del MVP: FAQ asistida, métricas, facturas y detalle de residencia en admin
- **Severidad:** alto · **Rol:** estudiante, residencia, admin · **Tipo:** [Doc] docs/02 §7.22 (FAQ asistida, Must Have), §20 criterios 5, 15, 23; docs/08 §3 (rutas `/residence/[id]/faq`, `/metrics`, `/reservations`, `/receipts`, `/residence/settings`, `/students/documents`, `/students/family-link`, `/students/settings`, `/admin/residences/[id]`, `/admin/invoices`, `/admin/settings`) · **Agente sugerido:** `dueño` (re-priorizar o recortar alcance) + `documentador` · **Esfuerzo:** L
- **Qué pasa:** la ficha tiene una FAQ estática (sin el campo de pregunta libre ni el registro de preguntas sin respuesta), y varias rutas oficiales no existen o se fusionaron en otras (`/students/residency`, `/admin/activity`) sin que el doc lo refleje.
- **Recomendación:** el dueño decide qué sigue siendo MVP. Mientras tanto, docs/02 §20 y docs/08 §3 deberían reflejar el routing y el alcance reales, para que el MVP no se considere "completo" con criterios abiertos.

#### H13 · Login sin recuperación de contraseña y registro que acepta términos que no se pueden leer
- **Severidad:** alto · **Rol:** todos · **Tipo:** [Ambos] docs/10 (consentimiento informado), docs/21 (plantilla de términos) · **Agente sugerido:** `constructor` (reset por Supabase) + `dueño` (texto de términos) · **Esfuerzo:** M
- **Dónde:** `/login` ("La recuperación de contraseña se habilita próximamente. Si no podés entrar, escribinos.", sin enlace ni email); `/register/student` ("Acepto los términos y condiciones…" y "Acepto la política de privacidad", sin enlaces); footer (sin Términos ni contacto).
- **Por qué importa:** con el producto en producción, un usuario que olvida la contraseña no tiene salida. Aceptar términos que no se pueden leer debilita el consentimiento.
- **Recomendación:** activar "Olvidé mi contraseña" (el email transaccional ya existe vía Resend). Publicar `/terms` desde docs/21, aunque sea como borrador como `/privacy`, y enlazarlo desde el registro y el footer. Agregar un email de contacto visible.

#### H14 · El número de comprobante impreso no sirve para verificarlo
- **Severidad:** alto · **Rol:** residencia, familia, terceros · **Tipo:** [Ambos] docs/08 §4.6 · **Agente sugerido:** `constructor` · **Esfuerzo:** S
- **Dónde:** el comprobante muestra "N.º ER-2026-3C48C4"; `/verify/ER-2026-3C48C4` → "Código inválido"; solo funciona `/verify/<uuid>`; `/verify` sin código → 404 en inglés.
- **Por qué importa:** quien recibe un comprobante en papel o PDF y teclea el número va a concluir que es falso. Es el artefacto de confianza más visible del producto.
- **Recomendación:** que `/verify/[code]` acepte también el número público, y crear `/verify` con un campo "Ingresá el número del comprobante", enlazado desde el footer.

#### H15 · La navbar pública ignora la sesión
- **Severidad:** medio · **Rol:** todos los logueados · **Tipo:** [Producto] · **Agente sugerido:** `interfaz` · **Esfuerzo:** S
- **Dónde:** `/`, `/search` y `/residencias/[slug]` estando logueado (Ricardo, Lucía) [cap. 01, 02]: "Ingresar / Crear cuenta".
- **Recomendación:** si hay sesión, mostrar "Mi panel" (según `roleHome`) y el nombre.

### C. Estudiante y familia

#### H16 · La experiencia del familiar está incompleta, habla con voz de estudiante y tiene un enlace roto
- **Severidad:** alto · **Rol:** familiar · **Tipo:** [Ambos] docs/08 §3.2 y §6.15; landing "seguí cada paso del proceso" · **Agente sugerido:** `constructor` · **Esfuerzo:** L
- **Dónde:** Martín: `/students/dashboard` [cap. 04] muestra solo "Lucia F. — Vínculo activo" y sus propuestas. No muestra que Lucía está alojada, ni su reserva, renovación o comprobante. El sidebar "Mi perfil" → **404 de Next en inglés y fondo negro** [cap. 05]. "Mis solicitudes" le habla como si fuera el estudiante ("Seguimiento de tus solicitudes", "Tu objetivo académico", "La residencia va a escribirte por WhatsApp"). "Mi estadía" (el estudiante lo ve como "Mi residencia") dice "TU ESTADÍA" y "Completar documentación". En la ficha, el familiar no ve el desglose de costos aunque suele ser quien paga.
- **Recomendación:** un inicio del familiar centrado en el estudiante: estado actual, próxima acción, comprobante, renovación y pagos. Copy en tercera persona ("La solicitud de Lucía…"). Quitar o crear "Mi perfil" del familiar. Mostrar el desglose de costos en la propuesta. Mismo nombre de sección para ambos roles.

#### H17 · Menor de edad: dos instrucciones contradictorias y un formulario que solo falla al enviarlo
- **Severidad:** medio · **Rol:** estudiante menor (Valentina) · **Tipo:** [Ambos] docs/10 §9.1 · **Agente sugerido:** `interfaz` · **Esfuerzo:** S
- **Dónde:** `/students/dashboard`: el banner dice "un padre… debe crear su cuenta en Crear cuenta → Familiar y vos aprobar la vinculación acá", mientras la card del familiar ofrece "Enviar invitación" con el copy "para que **en el futuro** pueda ver información… **cuando esa funcionalidad esté disponible**" (el mismo copy le aparece a Camila). En la ficha, Valentina puede completar todo el formulario y recién el servidor lo rechaza.
- **Recomendación:** un solo camino ("Invitá a tu familiar", que funciona por email desde el Ciclo 37) y un copy que diga que para un menor es obligatorio. En la ficha, si es menor sin familiar con teléfono, reemplazar el formulario por el bloqueo y el CTA de invitar.

#### H18 · Estadías vencidas sin tratamiento
- **Severidad:** medio · **Rol:** estudiante, residencia · **Tipo:** [Producto] · **Agente sugerido:** `dueño` → `constructor` · **Esfuerzo:** M
- **Dónde:** Camila: "¡Ya estás alojado/a!" con "Fin de contrato 1/8/2026 · Vencido", "Restante —" e "Iniciar renovación". En Residentes de Río de la Plata, 10 o más residentes "Activo" con "Contrato hasta" ya pasado (13 ago, 20 ago, 10 sep…).
- **Recomendación:** definir el estado "contrato vencido" (¿se renueva fuera de EstuRed? ¿se marca la salida?). Mostrarlo como alerta en Residentes ("N contratos vencidos sin renovar ni salida registrada") y del lado estudiante ("Tu contrato venció el…: ¿seguís en la residencia?").

#### H19 · "Mi residencia" manda todo contacto con la residencia a Soporte de EstuRed
- **Severidad:** medio · **Rol:** estudiante alojado · **Tipo:** [Producto] (posicionamiento: "Soporte, no mediación") · **Agente sugerido:** `dueño` · **Esfuerzo:** S
- **Dónde:** `/students/residency`: "Para cualquier consulta sobre tu estadía, contactate con soporte de EstuRed — coordinamos con la residencia por vos". `/students/support` solo permite abrir reclamos y no muestra los casos abiertos.
- **Por qué importa:** convierte a EstuRed en intermediario de la vida diaria (cuesta caro de operar y suena a mediación), y el estudiante no tiene el contacto de su propia residencia.
- **Recomendación:** mostrar al alojado el contacto de la residencia (WhatsApp o teléfono) y dejar Soporte para problemas. En Soporte, agregar "Mis casos" con su estado y una categoría "Consulta general / pagos".

#### H20 · Las notificaciones no llevan a ningún lado
- **Severidad:** medio · **Rol:** todos · **Tipo:** [Producto] · **Agente sugerido:** `constructor` · **Esfuerzo:** S
- **Dónde:** campana de Lucía (20 sin leer, 0 enlaces dentro del panel) [cap. 09].
- **Recomendación:** que cada notificación enlace a su entidad, se marque como leída al abrirla y que haya un "Marcar todo como leído".

#### H21 · Perfil: nacionalidades limitadas y encabezado fuera de contexto
- **Severidad:** bajo · **Rol:** estudiante · **Tipo:** [Producto] · **Agente sugerido:** `interfaz` · **Esfuerzo:** S
- **Qué:** el selector ofrece solo 19 países de Latinoamérica, mientras la comunidad muestra residentes de España, Italia, Francia, Alemania, EE. UU. y Reino Unido, y el brief apunta también a quienes llegan "desde el exterior". A Lucía, ya alojada, se le dice "completá estos datos para aumentar tus probabilidades de ser aceptado".
- **Recomendación:** lista completa de países con Latinoamérica primero; un encabezado distinto para quien ya está alojado.

### D. Residencia (owner / staff)

#### H22 · "+ Sumar otra residencia" es un CTA muerto
- **Severidad:** alto · **Rol:** owner (y staff, que no debería verlo) · **Tipo:** [Doc] docs/08 §3.3 (`/residence/settings/new`, solo owner) · **Agente sugerido:** `constructor` · **Esfuerzo:** S–M
- **Dónde:** `/residence/dashboard` → `/register/residence`, que redirige al dashboard si hay sesión (`register/residence/page.tsx:11`). Sofía (staff) también ve el botón y "Reporte PDF".
- **Recomendación:** un flujo de alta para un owner ya logueado (crea la residencia en `draft` asociada a su cuenta) y ocultarlo para staff.

#### H23 · La residencia no se entera de que su disponibilidad venció y quedó oculta de las búsquedas
- **Severidad:** medio · **Rol:** owner, staff, admin · **Tipo:** [Doc] docs/01 §13 (recordatorios) · **Agente sugerido:** `interfaz` · **Esfuerzo:** S
- **Dónde:** el aviso existe solo dentro de `/residence/[id]/availability` ("· oculta de las búsquedas"). El dashboard ("Verificada y publicada"), el Panel y `/admin/dashboard` no dicen nada.
- **Recomendación:** un banner en el Panel y en la card del dashboard ("2 tipos de habitación ocultos de las búsquedas — actualizá tu disponibilidad") y una métrica en el admin ("residencias con disponibilidad vencida").

#### H24 · Inbox de solicitudes: acciones que siempre fallan y rótulos engañosos
- **Severidad:** medio · **Rol:** owner, staff · **Tipo:** [Ambos] docs/04 l.305–309 (las pausadas solo las mueve el sistema) · **Agente sugerido:** `interfaz` · **Esfuerzo:** S
- **Qué:** "Establecer contacto" se ofrece en solicitudes "Pausadas" y el servidor lo rechaza siempre. "Tarifa acordada" aparece en solicitudes todavía no acordadas. El mismo estado `contact_established` cae en "Próximas a vencer" para Camila y en "En negociación" para Lucía. El mensaje de WhatsApp no identifica a la residencia ("Hola! Te escribo por la solicitud…").
- **Recomendación:** mostrar las acciones solo en estados válidos (en pausadas: explicar "pausada porque el estudiante avanzó con otra residencia"); usar "Tarifa solicitada" hasta que haya aceptación; agrupar por estado real; empezar el WhatsApp con "Hola, te escribimos de [Residencia]…".

### E. Admin

#### H25 · Admin: estados crudos, sin histórico de cobros y sin vista de detalle
- **Severidad:** medio · **Rol:** admin · **Tipo:** [Ambos] MEMORY §3 ("nunca mostrar estados técnicos crudos"); docs/08 §8.2, §8.10, §8.11 · **Agente sugerido:** `interfaz` · **Esfuerzo:** M
- **Qué:**
  - En "Actividad reciente" de `/admin/dashboard` conviven claves crudas (`user_blocked`, `residence_paused_by_admin`, `family_proposal_expired`) con frases traducidas.
  - "FEE COBRADO (MES) $0" no indica la moneda.
  - `/admin/payments` solo lista pagos pendientes y no hay histórico de fees cobrados.
  - No hay `/admin/residences/[id]`.
  - El copy expone la ruta "/admin/verifications".
  - En mobile, la tabla de solicitudes corta la columna Estado [cap. 07].
- **Recomendación:** mapear todas las acciones de auditoría a frases, indicar ARS/USD, agregar la pestaña "Cobrados", crear un detalle de residencia que reúna estado, disponibilidad, ocupación, reservas y casos, y convertir la ruta en un enlace.

### F. Datos demo, entorno y calidad transversal

#### H26 · Los tests de integración escriben en la misma base que usan las demos (y quizás producción)
- **Severidad:** alto · **Rol:** todos (demo y operación) · **Tipo:** [Producto/proceso] · **Agente sugerido:** `tester` + `base-datos` · **Esfuerzo:** M
- **Evidencia:** 218 eventos de auditoría hoy entre las 21:21 y las 21:37 (corridas de vitest del Ciclo 43): `user_blocked`, `residence_paused_by_admin`, `availability_hidden_from_search` ×8, entre otros. Lucía tiene notificaciones de "Residencia Test Integración (Ciclo 30 — renovaciones)" [cap. 09]. El admin ve esa actividad como real.
- **Por qué importa:** el entorno de demo se degrada en cada ciclo y la auditoría pierde valor probatorio. Si producción (`estured.vercel.app`) comparte el proyecto Supabase, como sugiere MEMORY §1, los tests afectan a usuarios reales.
- **Recomendación:** un proyecto Supabase separado para tests (o un esquema o branch) y, como mínimo, un prefijo o flag `is_test` que excluya esos eventos del admin y de las notificaciones. Confirmar qué base usa Vercel.

#### H27 · El dataset demo se degradó y tiene incoherencias que harían fracasar una demo
- **Severidad:** alto · **Rol:** todos · **Tipo:** [Producto] · **Agente sugerido:** `base-datos` · **Esfuerzo:** M
- **Qué:**
  - Todas las residencias aparecen "Sin disponibilidad actualizada" en el catálogo y la landing, incluida la card del hero [cap. 01].
  - No queda ninguna solicitud en `submitted`, `offer_pending`, `residence_payment_pending` ni `pending_estured_fee`, así que los pasos centrales del loop no se pueden mostrar.
  - Lucía está alojada pero tiene otra solicitud activa en "Contacto establecido" (docs/03 l.572 dice que se cierra al confirmar la reserva) y su solicitud se "envió" el 22/7, después del ingreso del 20/7.
  - Muchas fechas de ingreso ya pasaron.
  - Las fotos de Río de la Plata llevan la marca de agua de otro sitio, "WWW.BA-H.COM.AR" [cap. 02, 03]: riesgo legal y de confianza en una ficha "Verificada".
  - El widget describe a Lucía como "buscando residencia".
- **Recomendación:** que el seed genere fechas relativas a hoy (`now() ± n días`) y se pueda re-correr antes de cada demo, cubriendo de nuevo un estado por pantalla (Ciclo 31). Reemplazar las fotos con marca de agua por fotos propias o libres.

#### H28 · Tipo de cambio: aviso obligatorio ausente y ARS sin redondear
- **Severidad:** medio · **Rol:** todos · **Tipo:** [Doc] docs/08 §2.8 (texto exacto en todas las pantallas con conversión), docs/00 §13.5 (ARS termina en 500/000) · **Agente sugerido:** `interfaz` · **Esfuerzo:** S
- **Dónde:** `ExchangeRateNote` solo está en fee, negociación y perfil de residencia. Falta en la card del catálogo y la landing ("≈ ARS 266.900", sin redondear), en `ApplyForm` ("≈ ARS 141.500"), en el detalle de renovación ("USD 350 (ARS 532.000)") y en el dashboard del owner ("≈ ARS 342.260", sin redondear). `ResidenceCard` usa `usdToArs` sin `roundArs`.
- **Recomendación:** pasar todo el ARS mostrado por `roundArs` y poner `ExchangeRateNote` junto a cada conversión. En los snapshots, decir "al tipo de cambio del [fecha]".

#### H29 · Copy y formato inconsistentes
- **Severidad:** bajo · **Rol:** todos · **Tipo:** [Producto] · **Agente sugerido:** `interfaz` · **Esfuerzo:** S
- **Qué:**
  - Fechas en cuatro formatos: "2026-07-20", "20/1/2027", "13 ago 2026" y "29/7/2026, 09:26:31" (con segundos, y además irrelevante una vez confirmada la renovación).
  - Iniciales con doble punto ("Ana J..", "Camila R..") en el panel, Residentes y admin.
  - "Lucia" sin tilde (dato del seed).
  - Slugs públicos con sufijo "-demo".
  - "alojado/a".
- **Recomendación:** un helper `formatDate` único (por ejemplo "20 ene 2027") y otro de iniciales.

#### H30 · 404 sin marca, rutas documentadas que no existen y una `/waitlist` que contradice el estado del producto
- **Severidad:** bajo · **Rol:** todos · **Tipo:** [Doc] docs/08 §3.1 (`/r/[slug]`) · **Agente sugerido:** `interfaz` + `documentador` · **Esfuerzo:** S
- **Qué:**
  - Fuera de `(public)`, el 404 es el de Next en inglés con fondo negro (`/foo`, `/verify`, "Mi perfil" del familiar).
  - `/r/[slug]` da 404, aunque es la ruta oficial y quizás la que aparezca en materiales compartidos.
  - `/waitlist` sigue publicada con "EstuRed está llegando a CABA… Estamos verificando las primeras residencias".
- **Recomendación:** un `app/not-found.tsx` con marca; un redirect de `/r/:slug` a `/residencias/:slug`; redirigir `/waitlist` a `/register`.

#### H31 · Accesibilidad y mobile
- **Severidad:** medio · **Rol:** todos · **Tipo:** [Ambos] docs/08 §14 · **Agente sugerido:** `interfaz` · **Esfuerzo:** S–M
- **Qué:**
  - El selector "Tipo de habitación" del formulario de solicitud se anuncia como "Elegí una opción" (label no asociado).
  - En 375px, los resultados de `/search` empiezan debajo del pliegue [cap. 08], y en la ficha el panel de solicitud está a unos 2.400px de una página de unos 8.500px, sin CTA fijo propio.
  - Los KPIs de Residentes ocupan una pantalla entera (uno por fila).
  - No hay scroll horizontal de página (bien).
- **Recomendación:** asociar `label`/`id`; compactar los filtros en mobile (botón "Filtros" + hoja); agregar en la ficha mobile una barra fija "Desde USD X · Solicitar" que lleve a `#solicitud`; KPIs en grilla 2×2.

#### H32 · Documentación desincronizada con decisiones y routing
- **Severidad:** bajo · **Rol:** equipo · **Tipo:** [Doc] protocolo docs/13 §5 · **Agente sugerido:** `documentador` · **Esfuerzo:** S
- **Qué:**
  - Visibilidad de comunidad (Ciclos 37/39) no reflejada en docs/00 §18 ni en docs/10 §7.
  - El paso "habilitar pago" no figura en docs/04.
  - Routing real distinto del de docs/08 §3 (`/residencias`, `/students/residency`, `/admin/activity`, `/admin/logs`).
  - docs/06 §14.2/§15.1 dice `end_date` y el código usa `expected_end_date` (pendiente ya conocido).
  - La cabecera de `MEMORY.md` dice "Última actualización 2026-07-24".
  - `docs/NEXT_STEPS.md` está parcialmente obsoleto.

### Derivaciones técnicas (fuera de foco de esta auditoría)
- **`depurador`:** job de vencimiento de `contact_established` (H06). El histórico del tipo de cambio tiene un hueco del 15/8 al 20/10 en `/admin/exchange-rate`, así que la actualización "diaria" no corre: revisar el cron. El dashboard del estudiante tarda unos 5–8 s en renderizar en dev (medir en producción).
- **`seguridad`:** visibilidad forzada de perfiles y de menores (H04). Confirmar si los tests escriben en la base de producción (H26). Revisar que la bio, que no tiene control propio, no exponga datos de menores a cualquier cuenta registrada.

---

## 3. Lo que funciona bien (no romper)

- **Formulario de solicitud transparente:** renta × meses, depósito "reembolsable", fee 5% con "Se abona solo al confirmarse la reserva. Enviar la solicitud es gratis", SLA de 48 h y el descargo "no garantiza tu lugar". Es el mejor ejemplo de confianza de la app.
- **Privacidad para invitados:** en la comunidad solo ven el nombre. La página `/verify` muestra lo mínimo (nombre + inicial, sin montos ni contacto) y el comprobante incluye el descargo de plataforma intermediaria.
- **Validación en el servidor como red de seguridad:** el menor sin familiar no puede enviar, no se puede establecer contacto en estados inválidos y el alta de residencia nunca otorga Gestión Operativa.
- **Voseo y tono consistentes**, con descargos correctos en Soporte ("no garantiza un resultado ni interviene en todos los reclamos") y en la landing ("¿EstuRed es una inmobiliaria?").
- **Habitaciones (residencia):** KPIs útiles, vacantes por tipo y gestión por habitación. Es buena base para un panel operativo.
- **Admin "Actividad":** consolida la lectura y es el único lugar donde el estado real de las reservas es correcto. Usarlo como referencia para H01.
- **Tipo de cambio en admin:** fuente explícita, histórico y override manual.
- Sin scroll horizontal a 375px en las pantallas recorridas.

---

## 4. Quick wins y cambios de fondo

**Quick wins (un ciclo chico, sin decisión de producto):**
- H01: helper de estado combinado solicitud + reserva y copy para los estados que faltan.
- H14: `/verify` acepta el número público y existe una página para ingresarlo.
- H22: ocultar "Sumar otra residencia" a staff y llevar al owner a un alta interna.
- H11: limpiar promesas y la cifra "–70%".
- H28: `roundArs` + `ExchangeRateNote` en todas las conversiones.
- H17: un solo camino para vincular familiar y bloquear el formulario a menores sin familiar.
- H23: banner de disponibilidad vencida.
- H24: acciones y rótulos del inbox.
- H20: enlaces en notificaciones.
- H29 y H30: formato de fechas e iniciales, 404 con marca, redirects `/r` y `/waitlist`.
- H16 (parcial): arreglar el 404 de "Mi perfil" del familiar y pasar su copy a tercera persona.
- H13 (parcial): reset de contraseña y enlaces a privacidad.

**Cambios de fondo (requieren decisión del dueño):**
- H02: cómo se cobra el fee en modo manual (datos, moneda, plazo).
- H03: fuente de verdad de la disponibilidad (tipo de habitación o cama) y qué se le ofrece al estudiante.
- H04: política de visibilidad de la comunidad y de menores (más revisión legal).
- H05: si la tarifa "personalizada" de Residentes puede diferir del snapshot aceptado.
- H08: definición del "pago inicial a la residencia".
- H09: qué es gratis y qué es Gestión Operativa.
- H12: re-priorizar los Must Have (FAQ asistida, métricas, facturas).
- H06: si el pago se habilita automáticamente al establecer contacto.
- H18: tratamiento de los contratos vencidos.
- H19: contacto directo con la residencia para los alojados.
- H26 y H27: base separada para tests y seed con fechas relativas.

---

## 5. No auditado

- **Pasos intermedios del loop con datos reales:** propuesta de ajuste (estudiante y residencia), pago a residencia, pantalla del fee, aprobación de propuestas del familiar y revocación del fee. No queda ninguna solicitud o reserva demo en esos estados (H27). La pantalla del fee se revisó solo por código.
- **Acciones que mutan datos** (enviar, rechazar, confirmar, pagar, liberar plaza, renovar, abrir casos): excluidas por la consigna. Por eso no se verificaron mensajes de éxito ni de error en vivo.
- **Admin:** no se recorrieron `/admin/verifications`, `/admin/profile-edits`, `/admin/pricing`, `/admin/documents`, `/admin/community`, `/admin/visibility`, `/admin/support-cases` ni `/admin/users` en detalle. Tampoco el superadmin.
- **Registro completo** de estudiante, familiar y residencia (solo se leyeron los formularios), el perfil de residencia (`/profile`), las descargas de PDF (comprobante, reporte de portfolio) y los emails transaccionales.
- **Tablet, modo oscuro, lector de pantalla y medición de contraste con herramienta.**
- **Producción** (`estured.vercel.app`): no se comparó con el entorno local.

---

## 6. Tabla resumen

| ID | Hallazgo (corto) | Severidad | Agente sugerido | Esfuerzo |
|---|---|---|---|---|
| H01 | Estados de reserva mal comunicados en los tres roles | crítico | constructor | M |
| H02 | El fee no tiene camino de pago | crítico | dueño → constructor | M |
| H03 | Disponibilidad con tres fuentes contradictorias | crítico | dueño → constructor | L |
| H04 | Comunidad sin control de visibilidad (menores) y copy falso | crítico | dueño + seguridad → constructor | M |
| H05 | Fin de contrato y tarifa distintos para estudiante y residencia | alto | constructor | M |
| H06 | `contact_established` no vence y hay un paso manual no documentado | alto | depurador + dueño | M |
| H07 | Detalle y comprobante sin snapshot | alto | constructor | M |
| H08 | Pago inicial a la residencia sin definir | alto | dueño | S |
| H09 | Frontera freemium incoherente | alto | dueño | M |
| H10 | Ficha pública sin precios ni condiciones | alto | interfaz | M |
| H11 | Promesas y datos no respaldados en el copy | alto | interfaz | S |
| H12 | Faltan Must Have (FAQ asistida, métricas, facturas…) | alto | dueño + documentador | L |
| H13 | Sin recuperación de contraseña; términos sin enlace | alto | constructor + dueño | M |
| H14 | El n.º de comprobante no verifica | alto | constructor | S |
| H15 | La navbar pública ignora la sesión | medio | interfaz | S |
| H16 | Familiar: experiencia incompleta y "Mi perfil" con 404 | alto | constructor | L |
| H17 | Menor: instrucciones contradictorias y bloqueo tardío | medio | interfaz | S |
| H18 | Estadías vencidas sin tratamiento | medio | dueño → constructor | M |
| H19 | Contacto con la residencia solo vía Soporte EstuRed | medio | dueño | S |
| H20 | Notificaciones sin enlace ni "leída" | medio | constructor | S |
| H21 | Nacionalidades limitadas; encabezado del perfil fuera de contexto | bajo | interfaz | S |
| H22 | "Sumar otra residencia" es un CTA muerto | alto | constructor | S |
| H23 | Disponibilidad vencida sin alerta a residencia ni admin | medio | interfaz | S |
| H24 | Inbox: acciones inválidas y rótulos engañosos | medio | interfaz | S |
| H25 | Admin: estados crudos, sin histórico de cobros ni detalle | medio | interfaz | M |
| H26 | Los tests escriben en la base compartida | alto | tester + base-datos | M |
| H27 | Dataset demo degradado e incoherente (fotos con marca de agua) | alto | base-datos | M |
| H28 | Aviso de tipo de cambio ausente y ARS sin redondear | medio | interfaz | S |
| H29 | Formatos de fecha e iniciales inconsistentes | bajo | interfaz | S |
| H30 | 404 sin marca, `/r/[slug]` y `/waitlist` | bajo | interfaz + documentador | S |
| H31 | Accesibilidad y mobile (label, filtros, CTA de ficha) | medio | interfaz | S |
| H32 | Docs desincronizados con decisiones y routing | bajo | documentador | S |
