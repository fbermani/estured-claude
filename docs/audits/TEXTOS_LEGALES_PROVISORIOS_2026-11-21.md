# Textos legales provisorios — EstuRed (2026-11-21)

Borradores prudentes para los hallazgos N1 y N2 de `AUDITORIA_LEGAL_2026-11-21.md`. Redacción propia; no copia textos de terceros.

**Reglas de uso**
- Cada texto tiene una versión publicable y una lista de datos pendientes.
- La versión publicable no tiene placeholders. Se apoya en el pie legal (TP-11).
- **Precondición común:** no publicar ningún TP hasta resolver LEG-001. El pie del sitio debe mostrar titular, CUIT, domicilio y un email que funcione. Sin eso, los textos remiten a datos inexistentes.
- Los textos describen solo lo que el código hace hoy. MercadoPago, PayU y TusFacturas no aparecen como activos.
- Mantienen separadas las entidades: propuesta del familiar, solicitud, negociación, pago a residencia, fee, reserva, factura y comprobante.
- La cabecera «BORRADOR PROVISORIO — PENDIENTE DE REVISIÓN LEGAL» va solo en este informe. No se publica.

## Índice

| TP | Texto | Hallazgos | Destino en la app |
|---|---|---|---|
| TP-01 | Política de Privacidad | LEG-006, 007, 008, 023, 026 | `app/(public)/privacy/page.tsx` |
| TP-02 | Cookies y almacenamiento | LEG-019 | sección de TP-01 |
| TP-03 | Términos para estudiantes y familias (cláusulas a reemplazar o agregar) | LEG-010, 011, 032 | `app/(public)/terms/page.tsx` |
| TP-04 | Condiciones para residencias | LEG-003, 013, 029 | ruta nueva, aceptación expresa |
| TP-05 | Rol de EstuRed, disponibilidad y Soporte | LEG-014 | ficha, solicitud, pago, comprobante |
| TP-06 | No responsabilidad por pagos a la residencia | LEG-010, 014 | pantalla de pago, `/terms` |
| TP-07 | Menores de edad y tutor | LEG-004 | registro por invitación, `/privacy` |
| TP-08 | Fee: reintegro y arrepentimiento | LEG-002, 009 | `lib/revocations/copy.ts`, página pública |
| TP-09 | Push y comunicaciones | LEG-020, 021 | tarjeta de avisos, email al familiar |
| TP-10 | Aviso de bot automático | — | ✅ no aplica: no hay bot (D9) |
| TP-11 | Pie de página legal | LEG-001 | `components/layout/Footer.tsx` |
| TP-12 | Canal de denuncias y de derechos | LEG-008, 027 | `/privacy`, `/terms`, «Reportar» |
| TP-13 | Alcance del sello «Residencia Verificada» | LEG-015, 016 | junto al sello |

Textos actuales que ya son adecuados y no se reescriben:
- ✅ Leyenda AAIP de preapertura: `components/preapertura/legal/LegalPreapertura.tsx:172-174`. Coincide con la Res. AAIP 14/2018. TP-01 la reutiliza.
- ✅ Alcance de la verificación en `/nosotros:73-76`, `/terms:318` y `app/(public)/verify/page.tsx:65`. TP-13 lo lleva a la ficha.
- ✅ «Reclamos y Soporte» en `/terms:289-296`.

---

## TP-01 — Política de Privacidad

BORRADOR PROVISORIO — PENDIENTE DE REVISIÓN LEGAL

### Versión publicable

**Política de Privacidad de EstuRed**
Última actualización: la fecha que figura al pie de esta página.

**1. Quién trata tus datos**
El responsable de tus datos es el titular de EstuRed. Su nombre, CUIT y domicilio figuran al pie de este sitio. Para cualquier consulta sobre tus datos escribinos al email de privacidad publicado al pie.

**2. Qué datos tratamos**
- Datos de cuenta: email, teléfono, nombre, apellido y fecha de nacimiento.
- Datos de perfil que elegís cargar: universidad, carrera, origen, biografía, hábitos, intereses y foto.
- Documentos que cargás para una residencia: documento de identidad, comprobante académico y otros que la residencia pida.
- Tipo y número de documento de identidad.
- Datos del familiar vinculado y de quien paga el fee: nombre, documento, teléfono y datos fiscales.
- Comprobantes de pago que subís.
- Datos técnicos: dirección IP y tipo de navegador, para seguridad y para registrar tus aceptaciones.
- Si activás avisos en tu dispositivo: un identificador técnico de suscripción.

**3. Para qué los usamos**
- Crear y administrar tu cuenta.
- Gestionar solicitudes, negociaciones, reservas, comprobantes y el cobro del fee de EstuRed.
- Compartir con la residencia los datos necesarios para tu solicitud, según el estado de la solicitud.
- Mostrar tu perfil en la comunidad, solo si lo elegís.
- Enviarte avisos sobre tus trámites por email y, si los activás, por notificaciones.
- Prevenir abusos y proteger la seguridad del sitio.
- Cumplir obligaciones legales y fiscales.

No vendemos tus datos. No los usamos para publicidad de terceros.

**4. Con quién los compartimos**
- Con la residencia a la que enviás una solicitud, en la medida necesaria para gestionarla.
- Con tu familiar vinculado, en lo que la plataforma le permite ver.
- Con proveedores que nos prestan servicios técnicos:
  - alojamiento de la base de datos y de los archivos;
  - alojamiento del sitio;
  - envío de emails;
  - verificación antibots;
  - íconos y mapas que se cargan en tu navegador;
  - servicios de notificaciones de tu navegador o teléfono.
- Con autoridades, cuando una ley o una orden judicial lo exija.

Algunos de estos proveedores están fuera de Argentina, por ejemplo en Brasil o en Estados Unidos. Trabajamos con ellos bajo garantías contractuales adecuadas a la Ley 25.326.

**5. Datos sensibles**
No te pedimos datos de salud, religión, origen étnico, opiniones políticas ni vida sexual. No los incluyas en campos de texto libre ni en documentos. Si una residencia te pide un documento que los contenga, podés negarte y avisar a Soporte.

**6. Menores de edad**
Para tener una cuenta propia tenés que ser mayor de 18 años. Un menor solo puede usar EstuRed por invitación de su familiar responsable, que acepta estas condiciones en su nombre. El perfil de un menor no se muestra en la comunidad. La residencia se comunica con el familiar.

**7. Cuánto tiempo los guardamos**
Guardamos tus datos el tiempo necesario para la finalidad para la que los diste. Después los eliminamos o los anonimizamos. Conservamos lo que una ley nos obliga a guardar, como los registros fiscales, por el plazo legal.

**8. Seguridad**
Aplicamos medidas técnicas y organizativas razonables. Los documentos se guardan en almacenamiento privado. Cada acceso de una residencia o del equipo de EstuRed a tus documentos queda registrado. Ningún sistema es infalible.

**9. Tus derechos**
Podés pedir acceso, rectificación, actualización o supresión de tus datos. Escribinos al email de privacidad publicado al pie. Te podemos pedir que confirmes tu identidad. Respondemos el pedido de acceso dentro de 10 días corridos. Respondemos rectificación o supresión dentro de 5 días hábiles.

Podés retirar tu consentimiento cuando quieras. Eso no afecta lo hecho antes.

El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley N° 25.326.

LA AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.

**10. Cookies y almacenamiento**
Ver la sección «Cookies y almacenamiento en tu dispositivo» (TP-02).

**11. Cambios**
Si cambiamos esta política, te avisamos por email o en la app antes de que rija. La fecha de última actualización está al pie.

### Datos pendientes
- Titular, CUIT, domicilio y email de privacidad (LEG-001).
- Lista nominal de proveedores con país, si el asesor pide nombrarlos (Supabase, Vercel, Resend, Cloudflare, Google, OpenStreetMap, servicios push).
- Validación de las garantías contractuales con cada proveedor (LEG-006).
- Plazos concretos de retención por categoría (LEG-023).
- Fecha de vigencia.
- Leyendas: la apertura de la primera coincide con el art. 1 de la Disp. DNPDP 10/2008 (Infoleg). La segunda coincide con la versión de preapertura, ya alineada a la Res. AAIP 14/2018. Cotejar el resto literal y los signos «N°» antes de publicar.
- **Condiciones para publicar (el texto no puede afirmar algo falso):**
  - Apartado 4, «garantías contractuales»: solo después de aceptar y archivar los DPA (LEG-006). Antes, publicar: «Estamos formalizando las garantías contractuales con estos proveedores».
  - Apartado 2: solo es completo después de quitar «Antecedentes penales» (LEG-003). Si se mantiene, hay que declararlo.
  - Apartado 6: solo es cierto después de aplicar DR43 con consentimiento del familiar (LEG-004).

---

## TP-02 — Cookies y almacenamiento en tu dispositivo

BORRADOR PROVISORIO — PENDIENTE DE REVISIÓN LEGAL

### Versión publicable

**Cookies y almacenamiento en tu dispositivo**

Usamos pocas herramientas en tu navegador. Casi todas sirven para que el sitio funcione. Las de medición de campañas solo se activan si las aceptás.

| Qué | Para qué | Cuánto dura |
|---|---|---|
| Cookie de sesión | mantener tu sesión iniciada | hasta que cerrás sesión o vence |
| Cookie de aviso de sesión | saber si tenés una sesión abierta | hasta 400 días |
| Almacenamiento local | guardar borradores de formularios y preferencias de pantalla | hasta que enviás el formulario o borrás los datos del navegador |
| Suscripción a avisos | enviarte notificaciones, solo si las activaste | hasta que las desactivás o cerrás sesión |
| Cookie de sesión, antibots y `er-consent` | mantener tu sesión, proteger los formularios y recordar tu elección sobre cookies | sesión; `er-consent`, 180 días |
| Cookie propia `er-attr` | saber por qué pieza de campaña llegaste. Guarda parámetros de la dirección (`utm_*`, `fbclid`). Sin datos personales y sin terceros | 30 días |
| Cookie y píxel de Meta | medir el resultado de nuestras campañas en Meta. Solo se cargan si tocás «Aceptar» | según Meta; no se cargan si elegís «Solo las necesarias» |

Las cookies de medición no se activan hasta que aceptás. Si elegís «Solo las necesarias», el píxel de Meta no se carga. La cookie `er-attr` no depende de tu elección: es nuestra y no comparte datos con terceros.

**Cómo cambiar tu elección.** Borrá la cookie `er-consent` en la configuración de tu navegador. El aviso vuelve a aparecer en tu próxima visita.

Al cargar el sitio, tu navegador se conecta con servicios de terceros:
- un servicio antibots, en las pantallas de ingreso y registro;
- un servicio de íconos;
- un servicio de mapas, cuando ves un mapa.

Esos servicios reciben tu dirección IP y datos técnicos del navegador.

Los borradores quedan solo en tu dispositivo. Si usás una computadora compartida, borralos al terminar.

### Datos pendientes
- Si se autoalojan los íconos (LEG-019), quitar «un servicio de íconos».
- Si se cambia el proveedor de mapas, actualizar la línea.
- Si hay usuarios en la UE, el asesor debe evaluar un mecanismo de consentimiento.
- Aviso de cookies implementado el 2026-11-22 (`components/analytics/CookieNotice.tsx`): se muestra solo si el píxel de Meta está configurado. Sin enlace «Preferencias de cookies» en el pie: el pie de la preapertura queda dentro del fondo inerte. Evaluar uno cuando el pixel cargue en todo el sitio.
- Confirmar con el asesor si `er-attr` (medición propia, 30 días) requiere consentimiento.

---

## TP-03 — Términos para estudiantes y familias (cláusulas)

BORRADOR PROVISORIO — PENDIENTE DE REVISIÓN LEGAL

Reemplaza o agrega cláusulas en `/terms`. No reescribe el documento entero.

### Versión publicable

**Quiénes somos**
EstuRed es una plataforma operada por el titular identificado al pie de este sitio.

**Precios y moneda**
Las residencias publican sus precios en dólares estadounidenses. El importe en pesos es una referencia. Lo calculamos con la cotización de referencia que informa la fuente configurada por EstuRed, del día. Redondeamos el resultado a múltiplos de 500 pesos. El importe final del pago a la residencia lo fija la residencia al momento de cobrar.

**Fee de EstuRed**
- El fee de EstuRed es el 5 % del costo de la estadía inicial. Incluye alojamiento, matrícula y cargos obligatorios. No incluye depósito.
- Se paga después de que la residencia informa que recibió tu pago.
- Se paga por transferencia bancaria a la cuenta de EstuRed que te mostramos en la pantalla del fee.
- Validamos el pago en forma manual. Si hay un problema con la transferencia, te avisamos y podés volver a enviarla.
- Sin fee pagado, la reserva no queda confirmada.
- Cuando el fee queda validado, recibís el comprobante de reserva. El comprobante no es una factura.
- La factura del fee se emite a nombre de quien pagó, según la normativa fiscal aplicable.

**Reintegros**
Ver la cláusula «Fee: reintegro y arrepentimiento» (TP-08). Lo que pagás a la residencia se rige por lo que acuerdes con ella (TP-06).

**Responsabilidad**
- EstuRed responde por el servicio que presta: la plataforma, la gestión de solicitudes, la validación del fee y el comprobante.
- EstuRed no presta el alojamiento. La residencia responde por el alojamiento, sus condiciones, sus cobros y sus devoluciones.
- En la máxima medida permitida por la ley aplicable, y sin perjuicio de los derechos irrenunciables de los consumidores, EstuRed no responde por daños que provengan de actos u omisiones de la residencia o de otros usuarios.

**Modificaciones**
Podemos modificar estos términos. Te avisamos por email o en la app antes de que rijan. Si no estás de acuerdo, podés dejar de usar EstuRed. Los cambios no afectan solicitudes o reservas ya confirmadas. La fecha de última actualización figura al pie.

**Ley aplicable y jurisdicción**
Rigen las leyes de la República Argentina. Son competentes los tribunales ordinarios que correspondan. Si sos consumidor, podés reclamar ante los tribunales de tu domicilio y ante la autoridad de defensa del consumidor de tu jurisdicción, según la ley aplicable.

### Datos pendientes
- Cláusula a eliminar: la frase «EstuRed no reembolsa ni es responsable… bajo ninguna circunstancia» (`terms:247`).
- Cláusulas a eliminar: «hasta 3 intentos dentro de 48 horas» (`terms:232`) y «proveedores de pago habilitados» (`terms:238`).
- La frase de factura solo es cierta si se emite la Factura C (LEG-002). Si no, quitarla.
- Fórmula de la cotización: decidir si se nombra «dólar blue» (docs/10 §31.17).
- Si el asesor indica enlace a Defensa del Consumidor, sumarlo.

---

## TP-04 — Condiciones para residencias

BORRADOR PROVISORIO — PENDIENTE DE REVISIÓN LEGAL

### Versión publicable

**Condiciones para residencias en EstuRed**

**1. Partes y objeto**
Estas condiciones rigen entre el titular de EstuRed, identificado al pie del sitio, y la persona o empresa que publica una residencia («la residencia»). EstuRed ofrece una plataforma para publicar la residencia, recibir solicitudes de estudiantes y gestionarlas. EstuRed no administra la residencia ni presta el alojamiento.

**2. Declaraciones de la residencia**
La residencia declara que:
- tiene derecho a ofrecer el alojamiento publicado;
- los datos, precios, habitaciones, servicios y reglamento que publica son veraces y están actualizados;
- cumple las habilitaciones y normas que le corresponden;
- no exige a los estudiantes garantía propietaria, salvo lo que acuerde por escrito con EstuRed.

**3. Verificación**
EstuRed visita la residencia y controla la identidad del responsable, la dirección y que las fotos coincidan con el lugar. La verificación tiene ese alcance. No certifica habilitaciones, seguridad edilicia, seguros ni calidad del servicio. Vence al año.

**4. Disponibilidad y solicitudes**
La residencia mantiene la disponibilidad al día. Una solicitud no es una reserva. La residencia acepta o rechaza cada solicitud por la plataforma.

**5. Cobro de la reserva**
La residencia cobra la reserva directamente al estudiante, por los medios que carga en la plataforma. EstuRed revisa el formato de esos datos antes de mostrarlos. Esa revisión no implica respaldo del medio de pago. La residencia informa en la plataforma cuando recibe el pago. La residencia es la única responsable de los cobros y devoluciones de lo que cobra.

**6. Contenido y fotos**
La residencia declara que tiene los derechos sobre las fotos, textos y marcas que sube. Si una foto muestra personas identificables, declara que tiene su autorización. Autoriza a EstuRed a publicar ese contenido en la plataforma y en sus canales, sin costo, mientras la residencia esté publicada y por un plazo razonable para retirarlo.

**7. Datos personales de estudiantes**
La residencia usa los datos y documentos de estudiantes solo para gestionar la solicitud y la estadía. No los copia fuera de la plataforma más de lo necesario. No los comparte con terceros. Cada apertura de un documento queda registrada. La residencia no pide por la plataforma certificados de antecedentes penales ni documentos con datos de salud.

**8. Trato no discriminatorio**
La residencia no discrimina por nacionalidad, religión, origen, orientación sexual ni ningún otro motivo prohibido por la Ley 23.592. Las residencias para un solo género lo informan como política de la residencia.

**9. Planes**
Hoy las funciones de gestión son gratuitas para toda residencia verificada. Si en el futuro se cobran, se avisará con anticipación y nadie paga sin aceptarlo.

**10. Suspensión y baja**
EstuRed puede pausar o retirar la publicación ante datos falsos, reclamos fundados o incumplimientos, con aviso y motivo. La residencia puede pedir la baja cuando quiera, sin afectar las reservas ya confirmadas.

**11. Responsabilidad e indemnidad**
La residencia responde frente a EstuRed por los reclamos de terceros que surjan de su alojamiento, sus cobros o su contenido.

**12. Modificaciones, ley y jurisdicción**
EstuRed avisa los cambios por email con anticipación. Rigen las leyes argentinas y los tribunales ordinarios que correspondan.

### Datos pendientes
- Plazo de aviso previo para cambios y para la baja.
- Plazo de licencia de fotos tras la baja.
- Si se mantiene la excepción a la garantía propietaria (DR16) y cómo se verifica.
- Jurisdicción concreta entre empresas (no es relación de consumo): definir con el asesor.
- Aceptación expresa con casilla y versión, separada de `/terms` (LEG-013).

---

## TP-05 — Rol de EstuRed, disponibilidad y Soporte

BORRADOR PROVISORIO — PENDIENTE DE REVISIÓN LEGAL

### Versión publicable

Versión larga (en `/terms` y `/nosotros`):
> EstuRed es una plataforma que facilita el contacto y la gestión de solicitudes entre estudiantes y residencias. No es titular ni administra los alojamientos. No presta el servicio de alojamiento.

Versión corta (ficha y solicitud):
> La disponibilidad la informa la residencia. Tu solicitud está sujeta a confirmación.

Versión corta (comprobante):
> Este comprobante registra tu reserva en EstuRed. El alojamiento lo presta la residencia.

Soporte:
> Si algo no coincide con lo publicado, escribinos a Soporte. Revisamos el caso con vos y con la residencia y te informamos qué podemos hacer.

### Datos pendientes
- Ninguno, salvo la revisión del asesor sobre el art. 40 (LEG-014).

---

## TP-06 — Pagos a la residencia

BORRADOR PROVISORIO — PENDIENTE DE REVISIÓN LEGAL

### Versión publicable

> El pago de la reserva y las mensualidades los cobra la residencia, directamente. EstuRed no recibe, no retiene y no administra ese dinero.
> Los datos de cobro que ves los carga la residencia. EstuRed revisa su formato antes de mostrarlos, pero no responde por el medio de pago ni por la cuenta de destino.
> Las devoluciones de lo que pagaste a la residencia se acuerdan con la residencia. Si tenés un problema, escribinos a Soporte.
> Esto no limita los derechos que te da la ley como consumidor.

Pantalla de pago (una línea):
> Pagás directamente a la residencia. EstuRed no recibe este dinero.

### Datos pendientes
- Validación del asesor de la cláusula DR63(g) frente al art. 40.

---

## TP-07 — Menores de edad y tutor

BORRADOR PROVISORIO — PENDIENTE DE REVISIÓN LEGAL

### Versión publicable

En el registro por invitación (lo acepta el familiar):
> Declaro que soy el padre, la madre o el tutor de [nombre del estudiante, completado por el sistema]. Acepto los Términos y la Política de Privacidad en su nombre. Autorizo el tratamiento de sus datos para gestionar solicitudes y estadías en residencias.

Aviso al menor:
> Como sos menor de 18 años, tu familiar responsable acepta las condiciones con vos. Tu perfil no se muestra en la comunidad. La residencia se comunica con tu familiar.

Aviso al registro abierto (si la fecha indica menos de 18):
> Para crear una cuenta propia tenés que ser mayor de 18 años. Pedile a tu familiar responsable que te invite desde su cuenta.

### Datos pendientes
- **Condición de código:** hoy no existe un alta de menor iniciada por el familiar fuera de preapertura. El menor se registra solo y después invita al familiar, o lo invita una residencia. Este texto se publica cuando exista el flujo con consentimiento del familiar (LEG-004).
- El nombre lo inserta el sistema; no es un placeholder visible.
- Si el asesor pide acreditar el vínculo (documento), definir cómo.
- Riesgo residual de DR32 (menor con dos emails): evaluar con el asesor.

---

## TP-08 — Fee: reintegro y arrepentimiento

BORRADOR PROVISORIO — PENDIENTE DE REVISIÓN LEGAL

### Versión publicable

**Botón de arrepentimiento**
> Podés arrepentirte del pago del fee de EstuRed dentro de los 10 días corridos desde que lo pagaste. No necesitás explicar por qué ni pagar nada. Entrá a «Botón de arrepentimiento» al pie del sitio. Te pedimos tu email y el código de tu reserva para confirmar que sos vos. Te enviamos por email un código de tu pedido en el momento. Te reintegramos el fee completo por transferencia dentro de los plazos de ley.

**Otros reintegros del fee**
> Si la residencia no cumple lo confirmado, escribinos a Soporte. Revisamos el caso y, si corresponde, te reintegramos el fee.

**Qué no cubre**
> El arrepentimiento del fee no incluye lo que pagaste a la residencia. Eso se acuerda con la residencia.
> Nada de esto limita los derechos que te da la ley como consumidor.

### Datos pendientes
- Si el asesor confirma que la excepción de servicio ya prestado aplica tras confirmar la reserva (Disp. 954/2025).
- Plazo de reintegro y tratamiento de la factura (nota de crédito) con el contador.
- Quitar del código: «salvo que la revisión detecte un uso indebido» y la mención a la Res. 424/2020.
- **Condición de código:** la página pública y el código de pedido deben existir antes de publicar este texto (LEG-009).

---

## TP-09 — Push y comunicaciones

BORRADOR PROVISORIO — PENDIENTE DE REVISIÓN LEGAL

### Versión publicable

Tarjeta de activación de avisos:
> Activá avisos para enterarte cuando cambie tu solicitud o tu reserva. No llevan datos personales. Podés desactivarlos cuando quieras desde tu perfil.

Email al familiar (primer contacto):
> Hola. Te escribimos de EstuRed porque [nombre del estudiante, completado por el sistema] te indicó como familiar. Usamos tu email solo para avisos de sus solicitudes y reservas. Si no querés recibirlos o no conocés a esta persona, respondé este email o escribinos al contacto que figura al pie.

Pie de emails transaccionales:
> Recibís este email porque tenés una cuenta o un trámite en EstuRed. No enviamos publicidad.

### Datos pendientes
- Si en el futuro hay emails promocionales, requieren consentimiento separado, opcional y sin casilla premarcada, más enlace de baja.

---

## TP-10 — Aviso de bot automático

✅ No aplica hoy. No hay bot ni proveedor de IA (D9; `docs/10` §23.2). Si se incorpora, redactar el aviso antes de publicarlo.

---

## TP-11 — Pie de página legal

BORRADOR PROVISORIO — PENDIENTE DE REVISIÓN LEGAL

### Versión publicable (estructura)

> EstuRed es operada por [titular], CUIT [número], con domicilio en [domicilio]. Contacto: [email]. Privacidad: [email].
> Términos · Privacidad · Condiciones para residencias · Botón de arrepentimiento · Verificar comprobante
> Última actualización de los textos legales: [fecha].

Este texto **no** se puede publicar con los corchetes. Es el único TP que depende enteramente de LEG-001.

### Datos pendientes
- Titular, CUIT, domicilio, emails, fecha.
- Enlace a Defensa del Consumidor si el asesor confirma que es exigible.

---

## TP-12 — Canal de denuncias y de derechos

BORRADOR PROVISORIO — PENDIENTE DE REVISIÓN LEGAL

### Versión publicable

**Derechos sobre tus datos**
> Para pedir acceso, rectificación o supresión de tus datos escribinos al email de privacidad publicado al pie. Indicá qué pedís y desde qué email tenés la cuenta.

**Denuncias de contenido**
> Si ves un perfil, una foto, una publicación o una pregunta que te parece ofensiva, discriminatoria o falsa, usá «Reportar» o escribinos a Soporte. Revisamos cada denuncia. Si el contenido no cumple nuestras reglas, lo retiramos y avisamos a quien lo publicó.

### Datos pendientes
- Botón «Reportar» (LEG-027). Hasta tenerlo, quitar «usá Reportar o».
- Plazo interno de revisión de denuncias.

---

## TP-13 — Alcance del sello «Residencia Verificada»

BORRADOR PROVISORIO — PENDIENTE DE REVISIÓN LEGAL

### Versión publicable

Junto al sello (una línea + enlace):
> Visitada en persona por EstuRed. Controlamos la identidad del responsable, la dirección y que las fotos coincidan. [Qué verificamos →](/nosotros)

Tooltip o texto ampliado:
> La verificación no certifica habilitaciones, seguridad edilicia, seguros ni calidad del servicio. Vence al año.

Reemplazo de `CostsBoard.tsx:55-58`:
> EstuRed la visitó en persona: controlamos la identidad del responsable, la dirección y que las fotos coincidan.

Reemplazo de `/nosotros:66-67` (sin firma de las partes):
> Usamos una lista de control en cada visita.

### Datos pendientes
- Validación del asesor del copy del sello (`docs/10` §31.14).
- Si se agrega al checklist la coincidencia de habitaciones y servicios, se puede volver a afirmar.

### Nota para TP-02: Meta Pixel y cookie de atribución (2026-11-22)

Código listo para la campaña con anuncios de Meta. El texto legal de TP-02 y de la privacidad tiene que incluirlo.

- **Contradicción a corregir.** La versión publicable de TP-02 dice «No usamos cookies de publicidad ni de analítica». Con el pixel activo eso deja de ser cierto.
- **Cookie `er-attr` (propia).** Guarda los parámetros de la URL de la campaña: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` y `fbclid`. Dura 30 días, solo se crea si el enlace trae esos parámetros y no se pisa. Sin datos personales. Se copia al preregistro (estudiante y familiar) y a la solicitud de residencia para saber qué anuncio la trajo.
- **Meta Pixel (tercero).** Solo en producción y con la variable `NEXT_PUBLIC_META_PIXEL_ID`. Carga un script de `connect.facebook.net`. Meta recibe la dirección IP, datos del navegador, la página vista y los eventos `PageView`, `CompleteRegistration` (preregistro de estudiante o de familiar) y `Lead` (solicitud de residencia fundadora). Meta puede sumar sus propias cookies (`_fbp`, `_fbc`). El código no envía email, nombre ni teléfono.
- **Consentimiento.** Hoy no hay aviso de cookies: el pixel carga sin consentimiento previo. Decisión pendiente del dueño y del texto legal: aviso con aceptación antes de cargar el pixel, o informarlo en TP-02.
- **Datos pendientes.** Responsable y base legal del tratamiento, y alcance de la transferencia internacional a Meta (LEG-006).
