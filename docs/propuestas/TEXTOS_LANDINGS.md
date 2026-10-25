# Textos de las tres landings de EstuRed (volcado literal)

Volcado fiel, tal como está hoy en el código (2026-10-25), de todos los textos visibles de `/` (home), `/for-students` y `/for-residences`. Orden = orden en pantalla. No es una propuesta: es el estado actual.

## Contexto para otra IA

- EstuRed es una plataforma intermediaria de residencias estudiantiles en CABA (primera etapa). Verifica residencias presencialmente, registra el proceso (solicitud, condiciones), emite un Comprobante de Reserva Confirmada y ofrece Soporte. No aloja, no alquila, no garantiza disponibilidad.
- Público de home: estudiantes, familias y residencias. `/for-students`: estudiantes y familias. `/for-residences`: dueños y gestores de residencias.
- Voz: español rioplatense con voseo («buscá», «sumate»), botones en infinitivo o imperativo voseante corto, sin promesas de disponibilidad ni garantías, sin «mediación» (se dice «Soporte»), «respaldo» evitado (se usa «verificable» / «registro»). Marca siempre «EstuRed».
- Reglas clave: el fee de EstuRed es 5% de la estadía inicial, sin contar el depósito; el pago a la residencia es aparte y directo (EstuRed no lo cobra); la residencia confirma si hay lugar; el estudiante decide (la familia propone, no decide); toda solicitud está sujeta a confirmación de la residencia.
- Los precios se muestran en USD con equivalente ARS referencial (dólar blue venta del día).
- Los textos entre «» o “” son literales. Los textos dinámicos (catálogo, tarjetas de residencias) no se incluyen.

---

# 1. HOME (`/`)

**Metadatos:** no define `metadata` propio en `app/(public)/page.tsx` (hereda el del layout raíz; no incluido en este volcado).

## 1.1 Hero
- Etiqueta (pill): Primera etapa: Ciudad de Buenos Aires
- Título: No solo elijas dónde vivir, sino cómo.
- Bajada: Residencias estudiantiles verificadas en CABA, cerca de tu facultad, con información clara, solicitudes registradas y un comprobante verificable cuando se confirma tu reserva.
- Botón primario: Buscar residencia en CABA
- Botón secundario: Sumar mi residencia
- Nota: Enviar una solicitud es gratis. La residencia revisa tu perfil y confirma si hay lugar.
- Tarjeta flotante 1 (título): Comprobante de Reserva Confirmada
- Tarjeta flotante 1 (código de ejemplo): ER-2027-0413
- Tarjeta flotante 2 (título): Solicitud registrada
- Tarjeta flotante 2 (texto): Condiciones claras, sin idas y vueltas por chat
- (Junto a esto se muestra una ResidenceCard del catálogo, contenido dinámico.)

## 1.2 Por qué EstuRed (carrusel RotatingBenefits)
- Eyebrow: Por qué EstuRed
- Título: Elegir a distancia, con todo a la vista
- Bajada: Reservar a distancia genera dudas. En EstuRed cada paso es claro, las residencias están verificadas y todo queda registrado.
- Etiquetas fijas del componente: «Lo que suele pasar» / «Cómo es con EstuRed»

**Beneficio 1: Información verificada**
- Resumen: Identidad, ubicación y fotos revisadas por EstuRed mediante control presencial antes de publicarse.
- Lo que suele pasar: Cuando buscás a distancia, solo tenés fotos y descripciones que nadie revisó. Es difícil saber si coinciden con el lugar antes de pagar una seña.
- Cómo es con EstuRed: Identidad, ubicación y fotos revisadas por EstuRed mediante control presencial antes de publicarse. El sello Residencia Verificada no reemplaza que consultes las condiciones de tu estadía.
- Conclusión: Elegís con información revisada en persona.

**Beneficio 2: Solicitud registrada**
- Resumen: Tu solicitud, la respuesta de la residencia y cualquier ajuste de condiciones quedan registrados en la plataforma. Nada depende de un chat que se pierde.
- Lo que suele pasar: Un acuerdo por chat se puede perder o editar, y después cuesta saber qué quedó acordado.
- Cómo es con EstuRed: Tu solicitud, la respuesta de la residencia y cualquier ajuste de condiciones quedan registrados en la plataforma, con fecha y estado siempre visibles.
- Conclusión: Todo el proceso queda por escrito, no en un chat que se borra.

**Beneficio 3: Comprobante verificable**
- Resumen: Cuando tu reserva se confirma, EstuRed emite un Comprobante de Reserva Confirmada con código público. Un registro claro para vos y tu familia.
- Lo que suele pasar: Transferir una seña sin un comprobante formal deja dudas, para vos y para quien te ayuda a pagar.
- Cómo es con EstuRed: Cuando tu reserva se confirma, EstuRed emite un Comprobante de Reserva Confirmada con un código que cualquier persona puede verificar públicamente.
- Conclusión: Un comprobante verificable, no una captura de un chat.

## 1.3 Comparativa
- Eyebrow: La diferencia
- Título: Reservar con EstuRed vs. reservar por fuera
- Bajada: Instagram, WhatsApp y los referidos sirven para descubrir. Para decidir y reservar, conviene que todo quede registrado.
- Columna 1 (título; logo «E»): Con EstuRed
- Columna 2 (título): Por fuera de EstuRed

Cada ítem tiene etiqueta y detalle (el detalle se ve al pasar el mouse / expandir).

Con EstuRed:
1. Etiqueta: Residencias visitadas y verificadas presencialmente. Detalle: El equipo de EstuRed confirma que existe, que es real y que la información publicada coincide.
2. Etiqueta: Precios publicados con política de ajustes explícita. Detalle: Sabés de antemano bajo qué condiciones puede cambiar un precio, no te enterás después.
3. Etiqueta: Solicitud y condiciones registradas en la plataforma. Detalle: Todo el proceso queda documentado, no depende de capturas de pantalla de un chat.
4. Etiqueta: Comprobante de Reserva Confirmada con código verificable. Detalle: Cada reserva confirmada tiene su comprobante, con un código verificable, para las dos partes.
5. Etiqueta: Soporte de EstuRed si algo se traba en el proceso. Detalle: Hay alguien a quien recurrir si la residencia no responde o algo no queda claro.

Por fuera de EstuRed:
1. Etiqueta: Fotos y datos que nadie chequeó. Detalle: Lo que ves puede no coincidir con la realidad — no hay ninguna verificación presencial de por medio.
2. Etiqueta: Precios que cambian de un chat a otro. Detalle: Sin nada publicado, el precio final puede depender de quién te responda ese día.
3. Etiqueta: Acuerdos por WhatsApp que se pierden o se niegan. Detalle: Sin registro, tu única prueba de lo acordado es tu propia memoria.
4. Etiqueta: Señas transferidas sin comprobante ni registro. Detalle: Si algo sale mal, no tenés ningún documento formal que muestre que pagaste.
5. Etiqueta: Nadie a quien recurrir si algo sale mal. Detalle: Si surge un problema, lo resolvés por tu cuenta.

## 1.4 Si algo no coincide con lo publicado (componente `WhenSomethingDiffers`; idéntico en home y `/for-students`)
- Eyebrow: Soporte
- Título: Si algo no coincide con lo publicado
- Bajada: Si al llegar encontrás algo muy distinto de lo que la residencia publicó o de lo que aceptaste (otra habitación, otro precio, una dirección que no es), escribinos a Soporte.
- Paso 1: Abrís un caso desde tu reserva y nos contás qué pasó.
- Paso 2: Revisamos la evidencia (fotos, mensajes, documentos) y hablamos con la residencia.
- Paso 3: Según el caso, puede corresponder la devolución del fee EstuRed.
- Paso 4: Te ayudamos a buscar otra residencia en EstuRed, aunque no siempre haya un lugar equivalente disponible.
- Nota al pie: Aplica a diferencias importantes y comprobables, no a expectativas. Lo que pagaste a la residencia se resuelve con ella, según sus condiciones. Abrir un caso no suspende la reserva de forma automática.

## 1.5 Cómo funciona (5 pasos, `HowItWorksSteps`)
- Eyebrow: El proceso
- Título: De la búsqueda al comprobante, en cinco pasos
- Bajada: Cada paso queda registrado, con las mismas reglas para estudiantes, familias y residencias.

1. Título: Buscás con contexto real. Descripción: Filtrá por barrio, tipo de habitación y presupuesto. Cada ficha muestra reglas, servicios, universidades cercanas y disponibilidad. Detalle (hover): Ver reglas y disponibilidad antes de escribir evita perder tiempo con residencias que no son para vos.
2. Título: Enviás tu solicitud. Descripción: Es gratis y queda registrada en la plataforma. La residencia revisa tu perfil y te responde. Un familiar también puede proponerte opciones. Detalle: Tu solicitud queda registrada y no depende de conversaciones por WhatsApp que puedan perderse.
3. Título: Acordás las condiciones. Descripción: La residencia confirma tus condiciones o te propone un único ajuste antes de confirmar. Vos siempre tenés la última palabra. Detalle: Si te proponen un ajuste, sos vos quien decide aceptarlo o no — nunca queda forzado.
4. Título: Pagás a la residencia. Descripción: Le pagás directamente lo acordado para reservar, por ejemplo el primer mes o la matrícula. La residencia confirma que lo recibió. Detalle: EstuRed no cobra ese dinero: queda registrado que la residencia lo recibió.
5. Título: Pagás el fee EstuRed y recibís tu comprobante. Descripción: Pagás a EstuRed un fee del 5% de tu estadía inicial, sin contar el depósito. Ves el monto exacto antes de pagar. Con el fee pago, tu reserva queda confirmada y recibís el Comprobante de Reserva Confirmada. Detalle: El comprobante tiene un código que cualquier persona puede verificar.

## 1.6 Qué pagás y a quién (`WhatYouPay`, variante estudiante; idéntico en home y `/for-students`)
- Eyebrow: Costos
- Título: Qué pagás y a quién
- Bajada: Cuatro cosas distintas, cada una con su momento.
- Tarjeta 1: Etiqueta: Enviar una solicitud. Título: Gratis. Texto: No pagás nada por solicitar ni por sumarte a una lista de espera.
- Tarjeta 2: Etiqueta: A la residencia. Título: Lo acordado para reservar. Texto: Por ejemplo, el primer mes o la matrícula, y después las mensualidades. Le pagás directamente a la residencia, que confirma que lo recibió. EstuRed no cobra ese dinero.
- Tarjeta 3: Etiqueta: A EstuRed. Título: Fee del 5%. Texto: Sobre el total de tu estadía inicial, sin contar el depósito. Se paga una sola vez, después de que la residencia confirma tu pago, y lo podés pagar vos o el familiar que designes. Ves el monto exacto antes de pagar y recibís la factura de EstuRed.
- Tarjeta 4: Etiqueta: No es un pago. Título: Comprobante de Reserva Confirmada. Texto: Lo emite EstuRed cuando tu reserva se confirma, con un código que cualquier persona puede verificar.
- Nota: Los precios se publican en dólares, con su equivalente referencial en pesos actualizado a diario. (+ icono de información «ExchangeRateNote», aria-label: «Por qué este valor en pesos es referencial»)
- Texto del modal ExchangeRateNote: El valor en pesos es referencial, calculado en base al dólar blue (valor venta) del día de hoy. El valor final en pesos será determinado en el momento en que realices el pago directamente a la residencia, según la cotización vigente en ese momento.

## 1.7 Catálogo (solo si hay residencias)
- Eyebrow: Catálogo
- Título: Explorá opciones con contexto real
- Bajada: Una muestra de cómo vas a ver cada residencia: verificación, disponibilidad, precios claros y universidades cercanas.
- (3 ResidenceCard dinámicas)
- Botón: Ver todas las residencias

## 1.8 Para quién es
- Eyebrow: Para quién es
- Título: Una solución para cada uno
- Tarjeta 1: Título: Estudiantes. Texto: Elegí dónde y con quiénes vas a vivir con información real: convivencia, reglas, servicios y cercanía a tu facultad. Enlace: Cómo funciona para vos (→ /for-students)
- Tarjeta 2: Título: Familias. Texto: Acompañá la decisión a la distancia: proponé opciones, seguí cada paso del proceso y recibí el comprobante de la reserva. Enlace: Cómo acompañar (→ /for-students)
- Tarjeta 3: Título: Residencias. Texto: Menos consultas repetidas, solicitudes completas y herramientas para profesionalizar tu gestión. Hoy, sin costo para residencias verificadas. Enlace: Sumar mi residencia (→ /for-residences)

## 1.9 Lo que viene (roadmap)
- Eyebrow: Lo que viene
- Título: Así seguimos construyendo EstuRed
- Bajada: Cada etapa se construye con lo que ya pasa en la plataforma, por eso no tienen fecha fija.
- Tarjeta 1: Estado: Ya arrancó. Título: Comunidad EstuRed. Texto: Hoy ya podés conocer a quienes viven en cada residencia antes de solicitar, según lo que cada residente elige mostrar: nombre, carrera e intereses. Seguimos sumando más señales de cada residente para que conozcas mejor a tus futuros compañeros antes de mudarte.
- Tarjeta 2: Estado: En diseño. Título: Señales de convivencia. Texto: Una primera lectura del estilo de cada casa —ritmos, hábitos y ambiente— construida a partir de lo que ya compartís vos y tus futuros compañeros de cuarto, para elegir donde realmente encajás.
- Tarjeta 3: Estado: Depende de las primeras estadías. Título: Reseñas de residentes. Texto: Las habilitamos apenas las primeras reservas confirmadas completen su primera estadía real: opiniones de gente que efectivamente vivió ahí, no de cualquiera.

## 1.10 FAQ
- Eyebrow: Preguntas frecuentes
- Título: Dudas comunes
1. P: ¿EstuRed es una inmobiliaria? R: No. EstuRed es una plataforma que conecta estudiantes y familias con residencias estudiantiles verificadas. No alquilamos ni administramos alojamientos. Cobramos un fee por nuestro servicio una vez que la residencia confirma tu pago (mirá «¿Cuánto cuesta usar EstuRed?»).
2. P: ¿Cuánto cuesta usar EstuRed? R: Enviar una solicitud es gratis. Si la reserva avanza, pagás a la residencia lo acordado y a EstuRed un fee del 5% sobre tu estadía inicial, sin contar el depósito. El monto exacto lo ves antes de pagar.
3. P: ¿Qué significa que una residencia esté verificada? R: Que el equipo de EstuRed la visitó presencialmente, validó que existe, que es quien dice ser y que su información publicada es real. Solo las residencias verificadas aparecen en el catálogo.
4. P: Si una residencia figura con lugar, ¿ya tengo mi lugar? R: Todavía no. La disponibilidad la informa cada residencia y puede cambiar. Enviás tu solicitud, la residencia revisa tu perfil y confirma si hay lugar. Tu lugar queda reservado cuando la reserva se confirma.
5. P: ¿EstuRed verifica a los estudiantes? R: No. EstuRed verifica a las residencias, no a las personas. Vos elegís qué mostrás en tu perfil, y cada residencia revisa las solicitudes que recibe antes de confirmar.
6. P: ¿Qué recibo cuando se confirma mi reserva? R: Un Comprobante de Reserva Confirmada emitido por EstuRed, con un código que cualquier persona puede verificar públicamente. Sirve para mostrar que tu reserva quedó confirmada y registrada en EstuRed, a vos y a tu familia.
7. P: ¿Qué pasa si algo no coincide con lo publicado? R: Podés abrir un caso de Soporte desde tu reserva. Revisamos la evidencia y, según el caso, puede corresponder la devolución del fee EstuRed. Más detalle en «Si algo no coincide con lo publicado».

## 1.11 CTA final
- Título: La convivencia también se elige.
- Texto: Ya podés buscar, comparar y enviar tu solicitud a las primeras residencias verificadas de Buenos Aires.
- Botón primario: Buscar residencia
- Botón secundario: Crear cuenta

## 1.12 Footer (compartido por las tres landings; `components/layout/Footer.tsx`)
- Marca: EstuRed
- Lema: La convivencia también se elige. Residencias estudiantiles verificadas en CABA, con solicitudes registradas y comprobantes verificables.
- Columna «Explorar» (título): Explorar. Enlaces: Buscar residencias · Para estudiantes y familias · Para residencias · Crear cuenta (se oculta con `hideSignup`)
- Columna «Confianza» (título): Confianza. Ítems: Residencias verificadas presencialmente · Solicitudes registradas en la plataforma · Comprobante de Reserva Confirmada · Qué pagás y a quién (enlace a /#que-pagas) · Contacto: (CONTACT_EMAIL, valor de `lib/constants/contact`)
- Aviso legal: EstuRed actúa como plataforma intermediaria de búsqueda, solicitud, registro y comprobante. No presta directamente el alojamiento. Los precios en ARS son referenciales al dólar blue del día. Botón de arrepentimiento · Verificar un comprobante · Términos y condiciones · Política de privacidad.
- Cierre: Hecho con ♥ en Buenos Aires

---

# 2. PARA ESTUDIANTES Y FAMILIAS (`/for-students`)

**Metadatos**
- title: Para estudiantes y familias
- description: Mudarse a CABA con más confianza: residencias verificadas, solicitudes registradas y comprobante de reserva verificable.

## 2.1 Hero
- Etiqueta (pill): Para estudiantes y familias
- Título: Mudarte a CABA con más confianza
- Bajada: Elegir dónde vivir es una de las decisiones más importantes de tu nueva etapa. EstuRed la hace clara: residencias verificadas, proceso registrado y un comprobante verificable de tu reserva.
- Botón primario: Buscar residencia en CABA
- Botón secundario: Crear cuenta de estudiante
- Foto: nombre y zona de la residencia (dinámico); alt: «Residentes en [nombre]» / «Residencia verificada»
- Tarjeta flotante 1: Verificada presencialmente
- Tarjeta flotante 2: Comunidad visible antes de mudarte

## 2.2 Beneficios (carrusel RotatingBenefits; etiquetas fijas «Lo que suele pasar» / «Cómo es con EstuRed»)
- Eyebrow: Beneficios
- Título: Lo que cambia cuando buscás con EstuRed

**1. Residencias verificadas**
- Resumen: Identidad, ubicación y fotos revisadas por EstuRed mediante control presencial.
- Lo que suele pasar: Elegir dónde vivir sin conocer el lugar es una de las decisiones más difíciles de mudarte a otra ciudad.
- Cómo es con EstuRed: Identidad, ubicación y fotos revisadas por EstuRed mediante control presencial, no una foto de stock ni una descripción exagerada. El sello Residencia Verificada no reemplaza que consultes las condiciones de tu estadía.
- Conclusión: Elegís con información revisada en persona.

**2. Solicitudes registradas**
- Resumen: Tu solicitud, las respuestas y cualquier ajuste de condiciones quedan registrados en la plataforma. Nada se pierde en un chat.
- Lo que suele pasar: Negociar condiciones por WhatsApp significa que después cuesta saber qué quedó acordado.
- Cómo es con EstuRed: Tu solicitud, las respuestas y cualquier ajuste de condiciones quedan registrados en la plataforma. Nada se pierde en un chat.
- Conclusión: Un historial claro de todo lo que se acordó.

**3. Tu familia puede acompañarte**
- Resumen: Un familiar vinculado puede proponerte opciones y seguir el proceso. Vos siempre tenés la última palabra sobre tu solicitud.
- Lo que suele pasar: Si tu familia está lejos, seguir cada paso de tu mudanza a la distancia es difícil — y una decisión así se toma mejor en compañía.
- Cómo es con EstuRed: Un familiar vinculado puede proponerte opciones y seguir el proceso paso a paso. Vos siempre tenés la última palabra sobre tu solicitud.
- Conclusión: Con compañía, y la decisión sigue siendo tuya.

**4. Comprobante de Reserva Confirmada**
- Resumen: Cuando tu reserva se confirma, recibís un comprobante que cualquier persona puede verificar.
- Lo que suele pasar: Pagar una matrícula o un depósito sin ningún papel te deja con dudas, a vos y a tu familia.
- Cómo es con EstuRed: Cuando tu reserva se confirma, recibís un comprobante verificable por cualquier persona, con los datos de tu reserva.
- Conclusión: Un registro claro, no una promesa de palabra.

**5. Comunidad visible**
- Resumen: Conocé cómo es la convivencia antes de decidir: quiénes viven en la residencia, según lo que cada residente elige compartir.
- Lo que suele pasar: Vas a convivir con gente que no elegiste, en un lugar que no conocés. Saber con quién vas a vivir ayuda a decidir con más tranquilidad.
- Cómo es con EstuRed: Conocé cómo es la convivencia antes de decidir: quiénes viven en la residencia, según lo que cada residente elige compartir.
- Conclusión: Elegís tu lugar sabiendo también con quién vas a compartirlo.

**6. Precios claros**
- Resumen: Tarifas en dólares con su equivalente referencial en pesos, actualizado a diario. Matrícula y depósito a la vista, y la política de ajustes publicada.
- Lo que suele pasar: Los precios que cambian según a quién le preguntes, o que aparecen recién cuando ya avanzaste con una residencia, generan desconfianza.
- Cómo es con EstuRed: Tarifas en dólares con su equivalente referencial en pesos, actualizado a diario. Matrícula y depósito a la vista, y la política de ajustes publicada.
- Conclusión: Sabés qué vas a pagar y a quién antes de comprometerte.

## 2.3 Para las familias (`FamilyHighlight`)
- Etiqueta: Para las familias
- Título: Acompañá la mudanza sin quedarte afuera
- Bajada: Creás una cuenta de familiar y pedís vincularte con tu estudiante, que aprueba la vinculación. Desde ahí acompañás el proceso con la información que corresponde a tu rol.
- Aviso (candado): Tu estudiante mantiene el control: sus documentos y mensajes privados son suyos, y las solicitudes se envían solo desde su cuenta. Toda solicitud está sujeta a la confirmación de la residencia.
- Botón primario: Crear cuenta de familiar
- Botón secundario: Explorar residencias
- Ítem 1: Título: Seguís cada paso. Texto: Ves en qué estado están las solicitudes y la reserva, y te avisamos de los hitos importantes: solicitud aceptada, pago, plazos y reserva confirmada.
- Ítem 2: Título: Proponés opciones. Texto: Le sugerís residencias que te gusten. Tu estudiante las revisa y decide si avanza: vos acompañás, la decisión es suya.
- Ítem 3: Título: Pagás el fee si te designa. Texto: Si tu estudiante te elige para pagar el fee EstuRed, ves el monto, los datos de transferencia y el plazo, y los datos de facturación del pago quedan a tu nombre.

## 2.4 «Quiero cambiar», variante estudiantes (`StayChangeHighlight variant="students"`)
- Etiqueta: Si ya vivís en una residencia
- Título: Cambiarte de residencia, sin esconderte y con los costos claros
- Bajada: Si el lugar donde vivís ya no es para vos, avisale con un botón y buscá otro aunque tu contrato siga vigente. Antes de decidir, sabés qué costos tiene salir.
- Paso 1: Título: Avisás con un botón. Texto: Desde Mi residencia tocás “Quiero cambiar”. Tu residencia se entera con tiempo y tu reserva sigue igual.
- Paso 2: Título: Buscás sin trabas de fechas. Texto: Solicitás y te sumás a listas de espera aunque se superpongan con tu estadía. Te avisamos si se libera lugar.
- Paso 3: Título: Conocés los costos antes. Texto: Tu residencia te informa por escrito depósito, preaviso y entrega. Lo ves vos y tu familia.
- Botón primario (si el usuario ya es estudiante): Ir a Mi residencia
- Botón primario (si no): Crear cuenta de estudiante
- Botón secundario: Buscar residencias
- Nota: Lo cancelás cuando quieras. Las otras residencias solo ven que estás en proceso de mudanza, no de cuál venís. Los costos de salida los informa cada residencia: EstuRed no los fija ni los cobra. Toda solicitud está sujeta a confirmación.
- Recuadro familias: Título: Para familias: te enterás de todo. Texto: Si estás vinculado como familiar, ves el aviso, la fecha estimada de salida y los costos que informe la residencia. Podés proponer opciones; la decisión es de tu estudiante. Botón: Vincularme como familiar
- Maqueta decorativa (aria-hidden): Aviso abierto · Estás buscando un cambio · Ya podés solicitar y sumarte a listas de espera aunque las fechas se superpongan con tu estadía. · Etapas: Avisaste / Responde / Buscás / Confirmás · Costos de salida · Lo informa tu residencia por escrito, antes de que decidas.
- Tarjetas flotantes: Tu reserva sigue igual · Costos de salida, por escrito

## 2.5 Paso a paso (`StepsList`, 7 pasos; el detalle aparece al pasar el mouse)
- Eyebrow: Paso a paso
- Título: Así funciona el proceso
- Bajada: Enviar una solicitud es gratis. La residencia revisa tu perfil y confirma si hay lugar.
1. Texto: Creá tu cuenta y completá tu perfil: de dónde venís, dónde y qué estudiás, y contanos un poco sobre vos, tus intereses y tus hábitos. Vos elegís qué mostrás; la residencia ve tu perfil cuando le enviás una solicitud. Detalle: Cuantos más datos completes, más fácil vas a poder enviar solicitudes cuando encuentres la residencia indicada.
2. Texto: Buscá y compará residencias verificadas. Guardá tus favoritas. Detalle: Comparar varias opciones a la vez te ayuda a decidir con más contexto, no solo por la primera que viste.
3. Texto: Enviás tu solicitud de reserva, gratis. Si ese tipo de habitación está completo, te sumás a su lista de espera. Detalle: Tu solicitud queda registrada y no depende de conversaciones por WhatsApp que puedan perderse.
4. Texto: La residencia te responde. Puede confirmar tus condiciones o proponerte un único ajuste, que podés aceptar o rechazar. Detalle: Si te proponen un ajuste, la decisión final siempre es tuya — nadie confirma nada sin tu aprobación.
5. Texto: Le pagás a la residencia lo acordado para reservar (por ejemplo, el primer mes o la matrícula) y la residencia confirma que lo recibió. Detalle: La residencia confirma la recepción del pago, así que ese paso también queda con registro.
6. Texto: Pagás el fee EstuRed: el 5% de tu estadía inicial, sin contar el depósito. Ves el monto exacto antes de pagar, y lo podés pagar vos o el familiar que designes. Detalle: Se paga una vez que la residencia confirma que recibió tu pago. La factura de EstuRed sale a nombre de quien paga.
7. Texto: Tu reserva queda confirmada en EstuRed y recibís tu Comprobante de Reserva Confirmada. Detalle: Ese comprobante deja registrada tu reserva, con un código que cualquiera puede verificar.

## 2.6 Qué pagás y a quién
Idéntico al bloque 1.6 (`WhatYouPay`, variante estudiante).

## 2.7 Si algo no coincide con lo publicado
Idéntico al bloque 1.4 (`WhenSomethingDiffers`).

## 2.8 FAQ
- Eyebrow: Preguntas frecuentes
- Título: Dudas comunes
1. P: ¿Cuánto cuesta usar EstuRed? R: Enviar una solicitud es gratis. Si la reserva avanza, pagás a la residencia lo acordado y a EstuRed un fee del 5% sobre tu estadía inicial, sin contar el depósito. El monto exacto lo ves antes de pagar.
2. P: ¿EstuRed verifica a los estudiantes? R: No. EstuRed verifica a las residencias, no a las personas. Vos elegís qué mostrás en tu perfil, y cada residencia revisa las solicitudes que recibe antes de confirmar.
3. P: ¿Qué pasa si algo no coincide con lo publicado? R: Podés abrir un caso de Soporte desde tu reserva. Revisamos la evidencia y, según el caso, puede corresponder la devolución del fee EstuRed. Más detalle en «Si algo no coincide con lo publicado».

## 2.9 CTA final
- Título: Empezá tu búsqueda con todo a la vista
- Texto: Buscá entre las residencias verificadas de CABA y enviá tu solicitud. Es gratis.
- Botón primario: Buscar residencia
- Botón secundario: Crear cuenta

## 2.10 Footer
Idéntico al bloque 1.12.

---

# 3. PARA RESIDENCIAS (`/for-residences`)

**Metadatos**
- title: Para residencias
- description: EstuRed no reemplaza tu operación. La ordena, la hace más clara y te ayuda a convertir mejores solicitudes.

## 3.1 Hero
- Etiqueta (pill): Para residencias estudiantiles
- Título: Menos mensajes, más residencia
- Bajada: EstuRed no reemplaza tu operación: la ordena. Menos consultas repetidas, solicitudes completas, lista de espera y renovaciones con un proceso claro. Hoy, sin costo para las residencias verificadas.
- Botón primario: Sumar mi residencia
- Botón secundario: Ver cómo funciona (ancla a #como-funciona)
- Maqueta del panel: Solicitud nueva · Iniciales «MJ» · Nombre: María José R. · Detalle: Habitación Doble · Desde marzo · Botones de ejemplo: Establecer contacto / Ver perfil
- Tarjeta flotante 1: Título: Preguntas frecuentes en tu ficha. Texto: Menos consultas repetidas por WhatsApp
- Tarjeta flotante 2: Lista de espera ordenada

## 3.2 Beneficios (carrusel; etiquetas fijas «Lo que suele pasar» / «Cómo es con EstuRed»)
- Eyebrow: Beneficios
- Título: Profesionalizá tu gestión sin cambiar tu forma de trabajar

**1. Menos consultas repetidas**
- Resumen: Tu perfil verificado responde las preguntas de siempre: precios, servicios, reglas y disponibilidad. Sumá preguntas frecuentes en tu ficha para resolver el resto.
- Lo que suele pasar: Responder las mismas preguntas de precio, servicios y disponibilidad, una y otra vez por WhatsApp, te come el tiempo que deberías usar en gestionar tu residencia.
- Cómo es con EstuRed: Tu perfil verificado responde las preguntas de siempre: precios, servicios, reglas y disponibilidad. Sumá preguntas frecuentes en tu ficha para resolver el resto.
- Conclusión: Menos tiempo respondiendo lo mismo, más tiempo gestionando.

**2. Solicitudes ordenadas**
- Resumen: Recibís solicitudes completas, con el perfil que cada estudiante elige compartir y sus preferencias. Decidís si avanzás, proponés un ajuste o rechazás.
- Lo que suele pasar: Recibir consultas sueltas por distintos canales, sin el contexto del estudiante, hace difícil evaluar quién realmente encaja.
- Cómo es con EstuRed: Recibís solicitudes completas, con el perfil que cada estudiante elige compartir y sus preferencias. Decidís si avanzás, proponés un ajuste o rechazás.
- Conclusión: Toda la información que necesitás, en un solo lugar.

**3. Condiciones negociables con reglas claras**
- Resumen: Antes de confirmar, podés proponer un ajuste de condiciones por solicitud. Todo registrado, sin idas y vueltas informales.
- Lo que suele pasar: Negociar condiciones por chat, sin un proceso claro, genera confusión sobre qué quedó acordado y qué no.
- Cómo es con EstuRed: Antes de confirmar, podés proponer un ajuste de condiciones por solicitud. Todo registrado, sin idas y vueltas informales.
- Conclusión: Un acuerdo claro, con historial, no un ida y vuelta que se pierde.

**4. Lista de espera ordenada**
- Resumen: Si estás completa, los interesados se anotan solos. Cuando se libera una plaza, avisás con un clic.
- Lo que suele pasar: Cuando estás completa, seguir anotando manualmente a quién avisarle si se libera un lugar es trabajo extra que nadie tiene tiempo de hacer bien.
- Cómo es con EstuRed: Si estás completa, los interesados se anotan solos. Cuando se libera una plaza, avisás con un clic.
- Conclusión: Sabés a quién avisarle cuando se libera un lugar.

**5. Renovaciones sin fricción**
- Resumen: Gestioná renovaciones de tus residentes actuales con ofertas y estados claros, sin perseguir confirmaciones.
- Lo que suele pasar: Perseguir a tus residentes actuales para confirmar si renuevan es una tarea manual, repetitiva y fácil de postergar.
- Cómo es con EstuRed: Gestioná renovaciones de tus residentes actuales con ofertas y estados claros, sin perseguir confirmaciones.
- Conclusión: Renovaciones con un proceso claro, sin perseguir a nadie.

**6. Sello de Residencia Verificada**
- Resumen: La verificación presencial te diferencia de las publicaciones informales y les da tranquilidad a estudiantes y familias.
- Lo que suele pasar: Compitiendo con publicaciones informales, es difícil demostrarle a un estudiante que tu residencia es seria y real, sin pedirle que confíe a ciegas.
- Cómo es con EstuRed: La verificación presencial te diferencia de las publicaciones informales y les da tranquilidad a estudiantes y familias.
- Conclusión: Un sello que genera confianza antes de la primera consulta.

## 3.3 «Quiero cambiar», variante residencias (`StayChangeHighlight variant="residences"`)
- Eyebrow: Previsibilidad
- Título: Enterate de una salida con tiempo, no el día que se van
- Bajada: Cuando un residente se va sin avisar con tiempo, se desordenan tu ocupación, tu planificación y tus renovaciones. Con “Quiero cambiar”, el residente te avisa cuando empieza a buscar.
- Beneficio 1: Título: Anticipás la salida. Texto: Sabés quién busca otro lugar y para cuándo, en vez de enterarte el día que se va.
- Beneficio 2: Título: Comunicás los costos antes. Texto: Informás depósito, preaviso y condiciones por escrito, con plantillas listas para completar.
- Beneficio 3: Título: Planificás la plaza. Texto: Ves cuántas plazas se liberarían y desde qué mes, para ordenar tu ocupación y tus renovaciones.
- Beneficio 4: Título: Tenés la oportunidad de escuchar. Texto: Si el motivo es algo que podés mejorar, lo sabés a tiempo y podés ofrecer una alternativa.
- Nota: Tu respuesta es informativa: no reemplaza el contrato ni el preaviso que acordaste con el residente. Las otras residencias no ven a tus residentes. EstuRed es una plataforma intermediaria y no fija ni cobra costos de salida.
- Maqueta decorativa (aria-hidden): 2 residentes buscan cambiar · Respondé con los costos, las condiciones y los detalles de la salida. · Fila 1: Lucía F. · Salida estimada · diciembre · Sin responder · Fila 2: Tomás R. · Salida estimada · marzo · Respondida · vista
- Tarjeta flotante: Lucía avisó que busca cambiar de residencia. Respondele con los costos y condiciones.

## 3.4 Planes
- Eyebrow: Planes
- Título: Hoy, todo sin costo
- Bajada: Mientras armamos la red, todas las herramientas son gratis para las residencias verificadas.

**Tarjeta 1**
- Badge: Gratuito
- Título: Perfil Verificado
- Bajada: Tu residencia en el catálogo, con el sello de verificación presencial y gestión de solicitudes.
- Ítems (etiqueta / detalle al pasar el mouse):
  1. Perfil público verificado con fotos, servicios y reglas / Es lo primero que ve un estudiante al buscar — reduce las consultas de gente que no tenía la información básica.
  2. Disponibilidad informada por tipo de habitación / Mostrás cupo por tipo de habitación sin necesidad de gestionar cada cama individualmente.
  3. Solicitudes de reserva registradas / Cada solicitud queda con fecha y estado, sin depender de tu memoria o de un chat.
  4. Lista de espera / Cuando un tipo de habitación está completo, los interesados se anotan en tu lista. Si se libera un lugar, les avisás desde tu panel.
  5. Preguntas frecuentes / Cargá hasta 5 preguntas y respuestas en tu ficha para que los interesados resuelvan dudas básicas antes de escribirte.
  6. Renovaciones / Gestioná renovaciones de tus residentes actuales sin tener que perseguir confirmaciones.

**Tarjeta 2**
- Badges: Plan Premium — Bonificado el 1er año · Incluido hoy
- Título: Gestión Operativa
- Bajada: Todo lo del Perfil Verificado, más la gestión de tus habitaciones, plazas y residentes.
- Ítems (etiqueta / detalle):
  1. Habitaciones y plazas / Cargás tus habitaciones y camas, y ves la ocupación de cada una.
  2. Residentes / Registrás altas, salidas y notas, y respondés los avisos de «Quiero cambiar».
  3. Comunidad visible / Los estudiantes conocen a quienes viven en tu residencia, según lo que cada residente elige mostrar.
  4. Elección de plaza / El estudiante puede indicar una plaza libre al solicitar; la residencia confirma.

- Nota al pie: Si te sumás como Residencia fundadora, tu primer año de Plan Premium está bonificado. El plan todavía no tiene precio: te lo vamos a informar con anticipación y nadie paga nada sin aceptarlo antes.

## 3.5 Qué cobra EstuRed (`WhatYouPay variant="residence"`)
- Eyebrow: Costos
- Título: Qué cobra EstuRed
- Línea 1: Lo que el estudiante te paga es tuyo: se lo cobrás directamente y confirmás en EstuRed que lo recibiste. EstuRed no lo toca.
- Línea 2: EstuRed cobra un fee del 5% al estudiante o a su familia, aparte de lo que te pagan a vos.
- Línea 3: Hoy, publicar y gestionar tu residencia no tiene costo.

## 3.6 CTA final
- Título: Sumate como Residencia fundadora
- Texto: Estamos sumando las primeras residencias de CABA: las Residencias fundadoras. Creá tu cuenta y, cuando completes tu perfil, coordinamos la visita de verificación.
- Botón: Sumar mi residencia

## 3.7 Footer
Idéntico al bloque 1.12.

---

# Notas para el análisis

1. Los textos con riesgo legal están catalogados con «L» en `design-proposals/voz-y-tono/INVENTARIO_COPY.md` (16 entradas, más la lista consolidada del §9 para el asesor). Afirmaciones como «verificada presencialmente», «comprobante verificable» y el reembolso del fee dependen de esa revisión.
2. El bloque «Si algo no coincide con lo publicado» (DR13) menciona la posible devolución del fee: queda pendiente que el asesor valide el alcance («según el caso, puede corresponder»). El bloque «Si te arrepentís» (§7.5) se descartó para las landings (DR13).
3. DR12 fijó el plan de `/for-residences` (variante B «Hoy, todo sin costo»): quedan sin definir qué incluye Premium, desde cuándo corre el año bonificado, cuánto cuesta y qué pasa después; la nota al pie dice «el plan todavía no tiene precio».
4. «Elección de plaza» se mantiene suavizada (el estudiante indica y la residencia confirma); «Disponibilidad asegurada» se quitó por revisión legal (P02, D/L).
5. DR13 reemplazó «respaldo» por «verificable» / «registro» en home, `/for-students`, footer y metadatos; las páginas legales (`/terms`) no se tocaron.
6. El home no define `metadata` propio, y la home y `/for-students` comparten bloques idénticos (WhatYouPay, WhenSomethingDiffers, FAQ): decidir si se quiere variar el texto por página.
7. Textos del roadmap («Lo que viene») y de «Comunidad EstuRed» describen funciones en distintos estados; confirmar con el dueño que reflejan el producto vigente.
8. «Hoy, sin costo» (hero de `/for-residences`, home) y «Residencias fundadoras» deben mantenerse coherentes con DR12 si cambia el modelo comercial. El nombre «Plan Premium» es comercial; no crea funciones nuevas.
