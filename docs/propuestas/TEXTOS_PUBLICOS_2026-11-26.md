# Textos aprobados de las páginas públicas (2026-11-26)

El dueño aprobó estos textos de a uno. Decisión: `docs/00` DR68 y DR69. Lo no listado queda igual.

## Regla de copy

- No usar «solicitar». Usar «enviar tu solicitud de reserva».
- Aplica a páginas públicas, ficha, registro, paneles y metadata.
- Renovación y cambio de habitación usan «pedir».
- No usar «Explorar es gratis» ni «Cada solicitud la confirma la residencia», ni paráfrasis.
- «Sujeta a confirmación» sigue en ficha, formulario, reglamento, emails y legales.

## Home `/`

Orden: hero, 4 pasos, «Por qué EstuRed», residencias, audiencias, guías, preguntas, cierre.

### Hero
- Sobretítulo «Ciudad de Buenos Aires» (igual).
- Título: «Encontrá y reservá tu residencia, con la seguridad de elegir bien.»
- Subtítulo: «Visitamos y verificamos residencias estudiantiles, para que vos elijas con tranquilidad y confianza.»
- Chips bajo el buscador: «Proceso registrado» · «Costos a la vista» · «Reglamento claro».
- Tarjeta clara para residencias: «¿Tenés una residencia?» · «Recibí solicitudes completas, sin comisión sobre tu tarifa.» · botón «Sumá tu residencia, es gratis».
- El naranja queda solo en «Buscar».

### Paso a paso (4 pasos)
- Título: «Reservá en 4 pasos, sin viajar a Buenos Aires».
- Bajada: «No hace falta ir a verlas: ya las visitamos nosotros.»
- Salen el eslogan por paso y la píldora «Todo a distancia».

| Paso | Título | Texto |
|---|---|---|
| 1 | Buscá y compará | Filtrá por universidad, barrio y precio. Conocé la comunidad. |
| 2 | Enviá tu solicitud de reserva | Antes de enviarla ves cuánto y a quién pagás, y el reglamento completo. Enviarla es gratis. |
| 3 | Esperá la respuesta y pagá | La residencia tiene 48 horas para responder. Si te acepta, le pagás a ella lo acordado. Cuando confirma tu pago, abonás a EstuRed el 5% de tu estadía inicial. |
| 4 | Recibí tu comprobante de reserva | Cuando validamos tu pago, tu reserva queda confirmada. Las condiciones y los pagos de la reserva quedan registrados en tu cuenta. |

- Capturas: usar las actuales 1, 2, 4 y 5.
- El bloque de texto de cada paso va sobre `forest-ink` con letra clara.

### Por qué EstuRed
- Sobretítulo «Por qué EstuRed». Título: «Con EstuRed, todo queda registrado y por escrito.» Sin bajada.

| Fila | Con EstuRed | Por fuera |
|---|---|---|
| La residencia | La visitamos en persona | La chequeás por tu cuenta |
| Costos | A la vista antes de enviar tu solicitud de reserva | Los consultás uno por uno |
| Tu reserva | Tenés tu comprobante | Queda en chats sueltos |
| Si algo no coincide | Abrís un caso de Soporte | Lo resolvés directo con la residencia |

- Miniatura del comprobante: «Con código y QR propios».

### Residencias
- Sobretítulo «Residencias verificadas en CABA».
- Título: «Conocé la comunidad antes de elegir».
- Bajada: «Con tu cuenta, podés ver los perfiles de quienes ya están en la resi, qué estudian, sus intereses y preferencias.»
- Botón en cada tarjeta: «Ver comunidad», a `/residencias/[slug]/comunidad`. Oculto sin perfiles visibles.
- Si ninguna destacada tiene perfiles: título «Residencias verificadas en CABA», sin bajada.

### Audiencias
- Título: «¿Desde qué lado llegás?» Sin bajada.
- Sin las 3 notas al pie ni la etiqueta «Perfil Verificado gratuito». Dos ítems por tarjeta.

| Tarjeta | Título | Ítems | Botón |
|---|---|---|---|
| Estudiantes | Sabé cómo vas a vivir, antes de mudarte. | «Reglamento completo»: «Lo leés antes de enviar tu solicitud de reserva.» · «Cerca de tu facultad»: «Ves qué universidades quedan cerca.» | Ver cómo funciona |
| Familias | Acompañá aunque estés lejos. | «Proponé opciones»: «Vos sugerís, tu estudiante decide.» · «Ves el comprobante»: «Y seguís cada paso de la solicitud.» | Ver cómo acompañar |
| Residencias | Menos mensajes repetidos, mejor gestión. | «Conocé a quien quiere reservar»: «Ves su perfil antes de responder.» · «Todo en un panel»: «Solicitudes, residentes y renovaciones.» | Sumá tu residencia, es gratis |

- Miniatura de familias: «Código y QR».

### Guías y preguntas
- Guías: título igual. Bajada: «Para elegir residencia y mudarte a Buenos Aires.»
- 5 preguntas (respuesta / «Ver más»):

1. «¿EstuRed es una inmobiliaria?» Sin cambios.
2. «¿Cuánto cuesta usar EstuRed?» «Enviar tu solicitud de reserva es gratis. Si la reserva avanza, pagás a la residencia y, aparte, a EstuRed un 5% de tu estadía inicial.» / «Son dos pagos separados. El monto exacto lo ves antes de pagar.»
3. «¿Qué significa que una residencia esté verificada?» «La visitamos en persona. Controlamos la identidad del responsable, la dirección y que las fotos coincidan.» / «Solo las verificadas aparecen en el catálogo. Verificamos residencias, no estudiantes.»
4. «¿Cuándo queda reservado mi lugar?» «Primero la residencia confirma que recibió tu pago. Después abonás el fee. Cuando lo validamos, tu reserva queda confirmada.» / «Enviar tu solicitud de reserva no te asegura el lugar.»
5. «¿Qué pasa si algo no coincide con lo publicado?» Sin cambios.

### Cierre
- Queda. Bajada: «Ya podés buscar, comparar y enviar tu solicitud de reserva a las primeras residencias verificadas de Buenos Aires.»

## `/for-students`

### Hero
- Título: «No elijas tu residencia a ciegas.»
- Subtítulo: «Mirá la comunidad, el reglamento y los costos antes de enviar tu solicitud de reserva.»
- Sale «Explorar es gratis · Cada solicitud la confirma la residencia».
- Tarjeta flotante: «Con código y QR propios». Botones y franja de confianza iguales.

### Beneficios
- Título: «Lo que ves antes de elegir». Sin bajada. Sobretítulo igual.
- Cabeceras de color pleno: «A ciegas» y «Con EstuRed». Cambian rótulo móvil y `aria-label`.

| Beneficio | A ciegas | Con EstuRed |
|---|---|---|
| Comunidad visible | no sabés con quién vivís hasta que llegás. | Con tu cuenta, podés ver perfiles antes de enviar tu solicitud de reserva. |
| Reglas antes de escribir | (igual) | (igual) |
| Tu familia te acompaña | tu familia se entera por capturas. | Sigue cada paso y te propone opciones. |
| Precios claros | costos que aparecen al final. | Mensualidad, matrícula y depósito, a la vista. |
| Comprobante de reserva | tu reserva depende de un mensaje. | Cuando validamos tu pago, recibís un comprobante con código y QR. |

### Comunidad
- Título: «Mirá cómo es por dentro».
- Bajada: «En cada ficha ves las habitaciones. Con tu cuenta, también los perfiles de la comunidad.»
- Punto 1: «Habitaciones y precios»: «Los ves en cada ficha. Enviar tu solicitud de reserva no te asegura el lugar.»

### Familias
- Tercer ítem: «Ves el comprobante» · «El de la reserva de tu estudiante» · detalle: «Cuando la reserva se confirma, lo abrís desde tu panel. Tiene código y QR propios.»
- Bajada, suma al final: «Si tu estudiante te designa, también podés pagar el fee de EstuRed.»
- Nota del candado: «Tu estudiante mantiene el control: sus documentos y mensajes privados son suyos. Las solicitudes de reserva se envían solo desde su cuenta.»

### Qué pagás y cuándo (reemplaza «Paso a paso» y «Qué pagás y a quién»)
- Conserva `id="que-pagas"`. Sobretítulo «Costos». Título «Qué pagás y cuándo».
- Bajada: «Sabés qué pagás ahora y qué después.»

| Momento | Cuánto | Detalle |
|---|---|---|
| Al enviar tu solicitud de reserva | Nada | Buscar, ver perfiles y anotarte en lista de espera tampoco tiene costo. |
| Si te aceptan | La reserva | Le pagás a la residencia lo acordado, como el primer mes o la matrícula. |
| Cuando la residencia confirma tu pago | 5% a EstuRed | Sobre tu estadía inicial. Lo pagás vos o el familiar que designes. Al validarlo, tu reserva queda confirmada. |
| Durante tu estadía | Mensualidades | Se las pagás a la residencia, según sus condiciones. |

- Link «Ver los 4 pasos» a `/#el-proceso`.
- Nota de pesos: **en revisión** (choca con `docs/00` §13.3). Mientras tanto queda la nota actual.

### Cambio de residencia
- Sale «Toda solicitud está sujeta a confirmación.»
- Tarjeta: «Ya podés enviar solicitudes de reserva y anotarte en listas de espera, aunque las fechas se superpongan.»

### Preguntas, cierre y metadata
- Sale «¿Cuánto cuesta usar EstuRed?».

1. «¿Qué requisitos piden las residencias?» «Los ves en la ficha y en el reglamento de cada residencia, antes de enviar tu solicitud de reserva.»
2. «¿Qué pasa si no hay lugar?» «Podés anotarte en la lista de espera de esa habitación. La residencia puede avisarte si se libera un lugar.»
3. «¿EstuRed verifica a los estudiantes?» «No. Verificamos residencias, no personas. Vos elegís qué mostrás en tu perfil.»
4. «¿Qué pasa si algo no coincide con lo publicado?» Sin cambios.

- Cierre: título igual. «Buscá entre las residencias verificadas de CABA. Enviar tu solicitud de reserva es gratis.»
- Metadata: «Residencias en CABA visitadas en persona. Mirá comunidad, reglamento y costos antes de enviar tu solicitud de reserva.»

## `/for-residences`

Orden: hero, beneficios, ficha, previsibilidad, planes, costos, preguntas, cierre.

### Hero
- Título: «Menos mensajes repetidos, mejor gestión». Sin párrafo. Botones iguales.
- Chips: «Solicitudes completas» · «Lista de espera y renovaciones» · «Sin comisión sobre tu tarifa» · «Perfil Verificado gratis».

### Beneficio 4
- «Afinidad de convivencia antes de responder»: «Ves intereses y hábitos de cada estudiante. Pensás en quién ya vive en esa habitación.»

### Tu ficha
- Sobretítulo «Tu ficha pública». Título «Tu ficha, casi tu propia web».
- Bajada: «Fotos, precios, reglamento y comunidad en un link.»
- «Compartila por WhatsApp»: «Con un mensaje ya listo, que podés editar.»
- «Tu comunidad a la vista»: «Con su cuenta, el estudiante ve qué estudian y qué les interesa, si lo muestran.»
- «Vos y tus residentes controlan qué se ve»: igual.
- Captura: queda la actual. La de la ficha completa es un pendiente.

### Planes, costos y preguntas
- Planes: sale la nota repetida bajo las tarjetas.
- Costos: «También lo paga el estudiante, después de que confirmás su pago.»
- Pregunta 3: «¿Quién define precios y condiciones?» «Tu residencia. También responde cada solicitud de reserva.»
- Pregunta 4, «Ver más»: «EstuRed cobra aparte, al estudiante, un 5% de su estadía inicial. No se descuenta de lo que te pagan.»
- Metadata: «Menos mensajes repetidos y mejor gestión: solicitudes completas, lista de espera y sin comisión sobre tu tarifa.»
- Funciones de planes: «antes de enviar su solicitud de reserva» y «al enviar su solicitud de reserva».

## Otras pantallas

- `/fundadoras`: «Menos mensajes repetidos, mejor gestión. Y gratis.»
- Metadata de la home: «Residencias estudiantiles en CABA que visitamos en persona. Mirá costos y reglamento antes de enviar tu solicitud de reserva.»
- `StatusTag`: «Disponibilidad informada por la residencia. Requiere confirmación al enviar tu solicitud de reserva.»
- Ficha, tarifas: «Precios mensuales por tipo de habitación, visibles para todos.»
- Ficha, días 30 a 45: «La residencia no actualizó su disponibilidad. Podés enviar tu solicitud de reserva igual, pero no te asegura el lugar.»
- Ficha, desde el día 45: «La residencia no actualizó su disponibilidad. Por ahora no recibe solicitudes de reserva.»
- Error al enviar desde el día 45: «La residencia no actualizó la disponibilidad de esta habitación. Probá otro tipo.»
- Panel de la residencia: «Hay habitaciones sin actualizar hace más de 45 días. No se ven en las búsquedas ni reciben solicitudes de reserva. Actualizá tu disponibilidad.»
- Paneles: «Quién quiere reservar», «Pedí tu renovación».
