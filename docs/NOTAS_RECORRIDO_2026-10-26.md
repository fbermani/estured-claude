# Notas de recorrido del dueño — 2026-10-26

Auditoría propia de home, /for-students, /for-residences y búsqueda (usuarios aún sin auditar). Textos del dueño tal cual; las marcas ⚠️ son observaciones nuestras contra reglas ya decididas (docs/00 §31, CLAUDE.md), para resolver antes de implementar. Nada de esto está implementado.

## HOME

1. Hero: otra frase inicial que venda mejor el concepto EstuRed. Debajo: «Encontrá tu residencia en BsAs, verificada en persona y sin viajar» (¿o «antes de viajar»?). Bajo los 2 botones: «Explorá sin costo, olvidate de las garantías propietarias, los contratos eternos y costos ocultos.» ⚠️ «garantías propietarias» = DR16 (ya publicado como regla general; coherente). «Contratos eternos» y «verificada en persona»: confirmar que sean ciertos y verificables.
2. «Información verificada»: sacar «el sello residencia verificada no reemplaza que consultes las condiciones de tu estadía». ⚠️ Es un descargo de no-garantía (regla 4); si se saca, que otra parte del flujo lo cubra.
3. «Costos a la vista»: reescribir hablando de ajustes de tarifas, cuentas claras, depósitos, etc. (acompañamiento).
4. «Soporte de EstuRed»: sacar «según el caso…» y «devolución de fee»; hablar de acompañamiento y ayuda para buscar otro lugar «con prioridad y seguridad». ⚠️ «prioridad» y «seguridad» ya se rechazaron antes (prioridad de reubicación = promesa); proponer «te acompañamos a buscar otra opción».
5. Diferencias: en «reserva confirmada» sumar lo del comprobante.
6. Proceso: ¿a qué se refiere el copete «con las mismas reglas…»? Destacar una ventaja (ej. sin viajar a BsAs). Las tarjetas podrían rotar y el texto explicativo verse mejor.
   - Paso 1: «con contexto real» no gusta → otra cosa.
   - Paso 3: «acordar las condiciones» queda raro y quita confianza.
   - Paso 4: «Abonás tu reserva: pago directo a la residencia bajo los términos acordados.»
   - Paso 5: «Confirmá tu lugar, abonás el fee de EstuRed (5%) y obtenés tu comprobante de reserva.» ⚠️ «Confirmá tu lugar» sugiere lugar asegurado; la residencia confirma, el estudiante decide. Alternativa: «Confirmá tu reserva».
7. Sección de costos justo después del paso a paso: redundante → quitarla; queda solo la de /for-students.
8. Catálogo: no gusta «con contexto real»; destacar compañeros, reglas, disponibilidad y precios. En cada tarjeta de residencia: servicios y áreas comunes con íconos, hover que explique cada uno, con alguna animación que llame la atención.
9. «¿Para quién es?»: mejorar formato, destacar perks. Estudiantes: con quién compartís, reglas, servicios, todo verificado. Familias: sin viajar, acompañar el proceso y ser parte, seguridad y tranquilidad.
10. FAQ 5, respuesta nueva: «Cada residencia evalúa las solicitudes entrantes y perfiles de forma independiente para asegurar afinidad y buena convivencia.»

## PARA ESTUDIANTES

1. Sacar lo de garantía propietaria. Usar: «Conocé los requisitos y beneficios de cada residencia sin moverte de tu casa». ⚠️ Revierte parcialmente DR16 en esta landing (DR16 la publicó como regla general). Confirmar si DR16 se mantiene en el resto (FAQ, home).
2. En vez de una foto de residencia: captura de cómo se ven las habitaciones con disponibilidad y los perfiles de estudiantes alojados (pequeña captura de la comunidad + explicación del beneficio). ⚠️ Privacidad: usar perfiles demo/consentidos, nunca reales sin permiso.
3. Beneficios: el cuadro de la izquierda queda mal → buscar otra forma.
4. «Comunidad visible», en «lo que suele pasar»: algo como «no sabés nada hasta que llegás…».
5. Paso a paso:
   - P1: sacar «vos elegís qué mostrás». «Creá tu cuenta, completá tu perfil y buscá tu residencia.» Texto complementario: motivar a completar el perfil, usar filtros y ver reglas, disponibilidad y comunidad.
   - P2: «Enviá tu solicitud». Cuanto más completo tu perfil, mejor… o ponete en lista de espera y te avisamos automáticamente cuando haya disponibilidad.
   - P3: «Si la residencia acepta, te enviará la propuesta definitiva y los valores finales para abonar, sin costos ocultos, todo claro y registrado.»
   - P4: ok.
   - P5: acotar el texto y alinear vocabulario con el paso a paso del home.
6. Costos: mejorar el «gratis» (buscar, conocer perfiles, lista de espera, solicitudes, etc.). A EstuRed: mejorar y acortar. «Verás todos los montos antes de enviar tu solicitud. Solo abonás por nuestro servicio una vez que la residencia confirma tu pago.» Sacar «no es un pago» y poner «Comprobante de reserva: abonado el fee, obtenés tu comprobante y tu reserva queda confirmada.»
7. Soporte: no convence como título/sección («si algo no coincide con lo acordado…»). El copete está bien. Analizar si queda mejor dentro de las FAQ. Rever el punto 3 o no ponerlo así. Punto 4: «te ayudamos o "mediamos" y te damos prioridad para una reubicación rápida y segura». ⚠️ «mediación» está prohibida (regla 4: «Soporte»); «prioridad/rápida y segura» = promesa. Proponer: «Te acompañamos para encontrar otra opción».

## PARA RESIDENCIAS

1. Beneficios: revisar estética, mismo tema que /for-students (ver capturas).
2. «Solicitudes ordenadas» y «condiciones negociables» no son dolores reales (las residencias no quieren negociar). Buscar dolores reales. Ideas del dueño: elegí/priorizá la reserva que más te conviene; gestioná y administrá tu operación desde un solo lugar (control, pagos); cubrí plazas vacías rápido y gestioná renovaciones; anticipá salidas; evitá la rotación por mala convivencia; ocupación estable, rentabilidad constante. ⚠️ «Evitá perfiles conflictivos» (riesgo de discriminación: decir «afinidad y convivencia»), «ocupación estable / rentabilidad constante» (promesa), «cubrí plazas rápido» (promesa de resultados). Formular como herramientas, no como resultados garantizados.
3. Sacar la aclaración de que el plan Premium no tiene precio. El resto OK.
4. «Qué cobra EstuRed»: revisar estética.

## BUSCAR

1. Filtro por universidad: aclarar que solo aparecen residencias dentro de las 15 cuadras de la sede elegida.
2. Sacar filtros por precio y disponibilidad. Agregar filtros por servicios y áreas comunes (los mismos que la residencia elige al completar su ficha). ⚠️ Confirmar que se quiere quitar el precio (usuarios suelen buscarlo); el filtro de disponibilidad es coherente con no prometer disponibilidad.

## Decisiones del dueño sobre las advertencias (2026-10-26)
1. Reubicación/Soporte: «Te acompañamos para encontrar otra opción». Sin «mediamos» ni «prioridad».
2. Paso 5: «Confirmá tu reserva» (no «Confirmá tu lugar»).
3. Dolores de residencias: redactados como herramientas (elegí qué solicitudes aceptar, renovaciones y lista de espera en un solo lugar, perfil y afinidad de convivencia antes de aceptar). Sin prometer ocupación ni rentabilidad; sin «perfiles conflictivos».
4. «Garantía propietaria»: se saca solo de /for-students; sigue en el home (hero) y en la FAQ (DR16 se mantiene).
5. Buscar: se deja el filtro de precio; se saca el de disponibilidad; se suman servicios y áreas comunes.

## Brechas de producto detectadas al cargar Sin Fronteras en dev (2026-10-27)
- Género por habitación no modelado (solo `gender_policy` por tipo de habitación); los triples/dobles de una misma residencia pueden mezclar géneros.
- Un solo precio por tipo: no hay variantes (individual con ventana/interna, doble grande/chica).
- Matrícula: sin campo «no reembolsable» (hoy `enrollment_fee_mode` + texto).
- Sin DNI/pasaporte del estudiante en residentes (solo del familiar).
- Fotos sin asociación a tipo de habitación (una sola galería).
- Sin geocoder: lat/lng vacías hasta que un admin cargue el pin; el mapa cae al barrio.
- La web de la residencia dice 15 hab./28 plazas y los datos del dueño dan 13 hab./26 plazas (falta confirmar una doble).
- Reglamento propio de la residencia trae cláusulas (mora 2% diario, expulsión sin aviso) que fueron quitadas del texto publicado; revisar con el asesor legal.

## Orden sugerido al implementar (sesión de bajo costo)
1. Texto puro (home, /for-students, /for-residences, FAQ 5): `interfaz` o `constructor`, sonnet low, un solo bloque, revisión de reglas con `revisor`.
2. Pasar el diseñador solo por lo estético: beneficios, «Qué cobra», «¿Para quién es?», tarjetas con servicios.
3. Filtros de búsqueda (servicios/áreas comunes, aclaración 15 cuadras): lógica + UI, con tests acotados.

---

# AUDITORÍA DEL USUARIO OWNER — 2026-10-27

Notas del dueño tal cual; ⚠️ = choca con una regla o necesita decisión antes de implementar. Nada implementado.

## Alta y ficha de la propiedad
1. Tipo de propiedad: por ahora solo «Residencia Estudiantil».
2. «Zona» pasa a «Barrio», con todos los barrios de CABA. En los filtros de búsqueda solo aparecen barrios con al menos una residencia registrada.
3. Descripción detallada y frase corta: ayudas de texto sobre qué escribir y qué no, para resaltar y no repetir información.
4. La edad de los residentes (mín./máx./menores) va justo después de los datos básicos.
5. Servicios y áreas comunes: opción «Otro» personalizado; ⚠️ requiere aprobación de EstuRed antes de listarse en esa residencia (cola de aprobación nueva en admin).
6. «Gimnasio» pasa a «Gimnasio / Área para ejercitar»; «Área protegida» suma «(emergencias médicas)».
7. Características de habitación: sumar «Velador» y «Ropero individual».

## Proximidad a universidades
8. Recomendar solo sedes a ≤15 cuadras (≈1,5 km). ⚠️ Alertar a EstuRed (admin) si se eligen sedes a más de 20 cuadras (≈2 km): alerta nueva; definir si bloquea o solo avisa.

## Reglas y reglamento
9. Reglas de convivencia: elegir las 5 más importantes/destacadas; el estudiante descarga o consulta el reglamento completo. Sin reglamento: ayudar a armarlo paso a paso con el modelo de EstuRed y luego descargarlo para compartir (extiende DR14).

## Preguntas frecuentes (catálogo)
10. Recomendar elegir como máximo 10, que son las que se ven en la ficha; una leyenda lleva a las demás (las respondidas por la residencia, además de las 10). Aclarar que cuanto más responda, más consultas tendrá. ⚠️ Decir «más solicitudes/consultas por EstuRed», no «consultas directas» (contacto por fuera).
11. Sacar la FAQ sobre hacer visitas a la residencia. Sacar la FAQ sobre cómo funciona la comida.
12. Agregar «¿Con quién voy a compartir?»: lo que se ve hoy no es necesariamente quienes le van a tocar; la asignación depende de múltiples factores. Agregar explicación detallada del mes vacío y por qué se cobra.

## Ficha y tarjeta
13. Mostrar ocupación y capacidad total de la residencia en ficha y tarjeta (hoy solo en comunidad). ⚠️ Solo tiene dato real con Residentes (Premium); en Verificado sería declarado. Decidir cómo se muestra para no prometer disponibilidad ni ocupación.
14. Galería: fotos generales, por área y por tipo de habitación; funcional y amigable. En la tarjeta, pasar fotos con clic o rotación automática; en la ficha, elegir 5 fotos de la galería que roten. (Hoy hay una sola galería sin asociación.)

## Tipos de habitación
15. «Sin especificar» solo para individuales; las compartidas eligen masculino, femenino o mixto. Un mismo tipo puede tener habitaciones con distinto género (2 dobles: 1 masculina y 1 femenina). Editable después de crear las habitaciones. (Cierra la brecha «género por habitación» de Sin Fronteras.)

## Dinero
16. El pago inicial para reservar puede ser solo la matrícula. Descuentos sobre la matrícula (ej.: 50% a mitad de año, 100% ahora). ⚠️ El fee es 5% de la estadía inicial sin depósito: definir si el descuento cambia la base del fee.
17. Depósito: ofrecer opciones de monto.
18. Mes vacío: explicar bien qué es y aclarar que solo se cobra si la plaza queda vacía realmente, no en toda reserva diferida; sumar % manual. ⚠️ Decisión de negocio nueva (mes vacío + no prorrateo está en backlog).
19. Promociones y descuentos sobre tarifas en cualquier momento del año, sin tocar la configuración general. ⚠️ Función nueva: define cómo se ve en la ficha («antes/ahora»), vigencia y efecto en el fee.

## Residentes
20. Mensaje guía: recomendar enviar un mensaje modelo (ver modelo) al grupo de WhatsApp o a cada residente para que se creen cuenta en EstuRed y se vinculen. Al agregar al residente con el mail/teléfono de su registro (ideal: enviar link de registro y vinculación directo por WhatsApp), la persona se registra y listo. La residencia solo los ordena en habitaciones y completa contratos/estadías. Si se carga solo con nombre y apellido: «residente sin activar» hasta activarlo o relacionar su perfil. ⚠️ El link por WhatsApp debe ser manual (botón/texto pre-formateado), nunca la API de WhatsApp (regla 2).

## Decisiones del dueño sobre las advertencias del Owner (2026-10-27)
1. «Otro» (servicios/áreas): queda pendiente y no se muestra en la ficha hasta que un admin de EstuRed lo aprueba o rechaza, con aviso a la residencia.
2. Sede a más de 20 cuadras (≈2 km): solo alerta al admin; la residencia puede guardarla y se muestra.
3. Ocupación en ficha y tarjeta: «capacidad · residentes» (ej.: «26 plazas · 24 residentes»), sin porcentaje ni «quedan N». Con Premium es dato real; en Verificado, solo capacidad declarada.
4. Fee con matrícula bonificada o promoción: se calcula sobre lo que paga el estudiante (monto final).
5. Mes vacío: se cobra solo si la plaza queda realmente vacía, nunca por toda reserva diferida; % elegible con presets + campo manual; explicado en ficha y en FAQ.
6. Registro/vinculación de residentes: botón «Compartir por WhatsApp» que abre WhatsApp con mensaje y link pre-armados, enviado a mano; sin API de WhatsApp.
