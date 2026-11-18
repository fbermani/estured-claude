# Propuestas de copy SEO — PENDIENTE DE APROBACIÓN (2026-11-18)

Nada de esto está aplicado en el sitio. Cada texto sale de las reglas ya documentadas (`docs/03` §5.2–5.4, `docs/19` §6.6) y respeta las reglas del proyecto: voseo, «Soporte», «solicitud sujeta a confirmación», sin garantías ni disponibilidad. Lo que falta saber está marcado **[A COMPLETAR]**.

## 1. Página «Cómo verificamos» (nueva, ruta propuesta `/como-verificamos`)

**Title:** Cómo verificamos las residencias
**Description:** Qué revisa EstuRed en cada residencia antes de publicarla: identidad, dirección y fotos, con una visita presencial. Y qué no garantiza el sello.
**H1:** Cómo verificamos cada residencia

**Intro:** Una residencia aparece en EstuRed como verificada solo después de una visita presencial. Esto es lo que revisamos, lo que no podemos garantizar y cómo te ayudamos si algo no coincide.

**H2. Qué revisamos antes de publicar**
- La identidad del responsable de la residencia y, si lo hay, del coordinador.
- Que la dirección existe y que la residencia funciona ahí.
- Que las fotos publicadas se parecen razonablemente al lugar real.
- Que existen los tipos de habitación y las áreas comunes declarados, y que los servicios publicados coinciden con lo que vimos.
- Que el perfil no contradice lo que ve quien visita.

**H2. La visita presencial**
Es obligatoria y la hace una persona de EstuRed en la residencia. Se completa una lista de control que firman las dos partes, y queda registrada la fecha y quién estuvo presente. [A COMPLETAR: si se quiere mostrar quién visita («el equipo fundador de EstuRed») y desde cuándo.]

**H2. Cada cuánto se renueva**
La verificación se renueva todos los años. Si vence sin renovarse, la residencia puede perder el sello y dejar de mostrarse en la búsqueda.

**H2. Qué no garantiza el sello**
Verificada no significa garantía de calidad, de convivencia ni de que se cumpla todo lo legal. Tampoco garantiza que los precios o las condiciones no cambien. Verificamos identidad, ubicación y fotos mediante control presencial.

**H2. Si algo no coincide con lo publicado**
Abrís un caso de Soporte desde tu reserva. Revisamos lo que pasó, hablamos con la residencia y, si hace falta, te acompañamos para encontrar otra opción.

**Cierre / contacto:** ¿Dudas? Escribinos a hola@estured.com. [A COMPLETAR: razón social y CUIT cuando estén definidos (plan §I).]

**Enlaces a agregar (cuando se apruebe):** desde el pie de las fichas («Cómo verificamos»), `/for-students`, `/for-residences` y `/llms.txt`; JSON-LD `WebPage` + `BreadcrumbList`.

Estado: **PENDIENTE DE APROBACIÓN**. Decisiones tuyas: (a) ruta `/como-verificamos` o `/nosotros`; (b) si se nombra a quién visita; (c) si va en el footer.

## 2. Línea «Verificada en persona» en la ficha (C-07)

**Texto propuesto:** «Verificada en persona en [mes y año]» + enlace «Cómo verificamos».
**Requiere dato:** fecha de la visita por residencia. ¿Existe hoy en el panel de admin (visita de verificación)? Si no, hay que cargarla o derivarla de la verificación aprobada. Estado: **PENDIENTE DE APROBACIÓN Y DE DATO**.

## 3. FAQ de `/for-students` (C-09)

**Hecho (no requiere aprobación):** la página ya tenía 4 preguntas visibles; se agregó el JSON-LD `FAQPage` que las refleja exactamente (el reporte de la auditoría que decía «sin FAQ» era incorrecto).

**Preguntas nuevas propuestas** (a sumar a las 4 actuales):

1. **¿Enviar una solicitud me asegura la habitación?** — No. La solicitud queda registrada y sujeta a confirmación de la residencia. Cuando la residencia responde, lo ves en tu panel.
2. **¿Cómo sé que la residencia existe y es como en las fotos?** — Antes de publicarla, una persona de EstuRed la visita en persona y compara lo que ve con lo publicado. En «Cómo verificamos» está el detalle. (Depende de aprobar la página 1.)
3. **¿Puedo mandar una solicitud por mi hijo o hija?** — Sí, si sos familiar vinculado a la cuenta del estudiante. [A COMPLETAR: confirmar el flujo exacto de vinculación de familiar con `docs/05`/`docs/08` antes de publicar.]
4. **¿A quién pago?** — A la residencia le pagás lo acordado con ella, por fuera de EstuRed. A EstuRed solo el fee, y recién cuando la residencia confirma. (Coherente con la respuesta existente de «¿Cuánto cuesta?».)

Estado: **PENDIENTE DE APROBACIÓN** (la 3 además de confirmación de flujo).
