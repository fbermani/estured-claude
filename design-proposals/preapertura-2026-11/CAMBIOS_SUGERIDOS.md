# Preapertura 2026-11 · Cambios sugeridos, supuestos y dudas (v4)

La v2 aplica el feedback del dueño: la landing se ve blureada y todo el registro pasa a un pop-up. El objetivo es generar urgencia, sacar fricción y lograr registros tempranos. Fuente de verdad: decisiones 1–11 + este feedback.

## A validar con el dueño (prioritario)

1. **Consentimiento de la opción C dentro del casillero de Términos.** El casillero obligatorio del paso 1 dice: «Acepto los Términos y la Privacidad, incluido mostrar mi búsqueda sin nombre ni contacto a residencias verificadas». El detalle está en Términos §7.
   - Riesgo: si la opción C va atada a la cuenta, deja de ser opcional, y la decisión 2 la definía como opcional. La Ley 25.326 pide un consentimiento libre y específico.
   - Mitigación diseñada: el contacto se entrega solo con un clic aparte, la C se puede desactivar y la residencia actual nunca ve la búsqueda.
   - Alternativa si se quiere blindar: una segunda casilla de una línea, «Que residencias verificadas vean mi búsqueda (sin nombre ni contacto)», tildada por el usuario.
2. **Comunidad pública en una sola línea (resuelto por el dueño):** «Mostrar mi perfil (nombre, edad, país, carrera, hábitos e intereses) en la comunidad de la web», con el casillero sin tildar. Que sea pública y que se pueda retirar va en los Términos. Para quitarla: «Editar mi perfil» desde Mi lugar.
3. **La pantalla de cada estudiante ya no explica «qué compartís» ni «vos decidís».** Todo eso vive en Términos y Privacidad (`consentimientos.html`).

## Cambios propuestos (uno por ítem)

4. **Contador:** mostrar el número recién desde 25 registrados. Con menos, «Sé de los primeros». *Motivo:* un número chico resta confianza.
5. **«#348, tu lugar si terminás ahora» en el paso 1** (el número real de registrados + 1). *Motivo:* la urgencia sale de un dato real. Los Términos aclaran que el lugar no da prioridad ni reserva nada.
6. **Hábitos con nombres neutros** («Madrugo», «Orden ante todo», «Prefiero la calma»…). *Motivo:* los masculinos quedan mal en una tarjeta pública.
7. **Edad: 18 o más para cuenta propia; menores solo invitados por un familiar (resuelto por el dueño).** La fecha de nacimiento va en el paso 1. Si es menor, el paso 1 lo deriva al registro familiar con copy cálido. El menor invitado no puede activar la comunidad. A definir en el producto: cómo se valida la edad del familiar (hoy es una declaración en los Términos).
8. **Meses de ingreso enero a abril sin año.** Se asume la próxima temporada (2027). Hay que guardar el año en el servidor.
9. **El formulario de residencia pide 5 campos obligatorios** (residencia, dirección, nombre, teléfono, email; decisión del dueño: dirección en lugar de barrio). Instagram y camas se piden en la charla. Hoy `residence_signup_requests` guarda barrio: hace falta una columna de dirección o derivar el barrio.
10. **Fundadoras dice «en proceso»** y no «tomados». *Motivo:* el lugar se libera si una residencia no avanza (decisión 11).
11. **El familiar se registra en una sola pantalla** (su cuenta + el email del hijo/a). Se quitó el aviso «una sola invitación, sin recordatorios»: la regla se mantiene en el sistema, pero no se comunica.

12. **CTA de residencias en la entrada con urgencia real:** cupo de 10 y número real de las que están en proceso. En desktop ancho flota fuera del pop-up para que se vea sin hacer scroll.

13. **Chips compactos (34 px)** para reducir el scroll, a pedido del dueño. Quedan por debajo de la regla interna de 44 px; si se quiere cumplirla, se puede agrandar el área táctil sin cambiar el tamaño visual.

## Supuestos

- Rutas: `/preregistro`, `/preregistro/familiar` y `/mi-lugar`. En el producto, el fondo blureado es la landing real con `inert` y el pop-up es un `dialog` que no se puede cerrar.
- «Lo completo después» en el paso 2 lleva a Mi lugar con el perfil incompleto, que a su vez invita a completarlo.

## Dudas reales

1. ¿Se acepta la opción C dentro de Términos (punto 1) o va en una casilla aparte?
2. ~~¿El Plan Premium bonificado sigue vigente?~~ **Resuelto por el dueño: sí.** Se muestra en una línea en fundadoras y en el mail de confirmación, sin planes, precios ni comisión.
3. Siguen abiertas: fecha de cierre de fundadoras, cuánto dura la insignia y la jerarquía, plazo de contacto a residencias, si existe Google, datos del responsable para la política e Instagram.

Riesgo legal (una vez): textos sin validación frente a la Ley 25.326.
