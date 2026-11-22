# AUDITORÍA LEGAL PRE-PRODUCCIÓN — EstuRed

Fecha: 2026-11-21. Alcance: repo en `staging` (incluye cambios sin commit de DR63 Fase 1–2a). Solo lectura.
Autor: Claude (auditor de cumplimiento, no abogado). Ningún punto de este informe afirma que EstuRed «cumple» una norma. Cada mención normativa significa «suele ser relevante; verificar con el asesor».
Prompt de origen: `docs/audits/PROMPT_AUDITORIA_LEGAL_2026-11-21.md`. Textos provisorios: `TEXTOS_LEGALES_PROVISORIOS_2026-11-21.md`. Paquete para el abogado: `BRIEF_ASESOR_LEGAL_2026-11-21.md`.

## Resumen ejecutivo (máx. 12 líneas)

- **Veredicto:** No se puede abrir al público hoy. Se puede con condiciones: cerrar la Ola 0 y conseguir el dictamen del asesor sobre los N1.
- **Stack y proveedores detectados:** Next.js 15.5 en Vercel (iad1), Supabase (prod planeado en São Paulo), Resend, Cloudflare Turnstile, Google Fonts (Material Symbols), tiles y Nominatim de OSM, monedapi.ar, web push (FCM/Apple/Mozilla), DNS en Hostinger. Sin analytics, píxeles ni IA.
- **Hallazgos:** 🔴 N1: 10 | 🟡 N2: 16 | 🟢 N3: 9 | Técnicos A: 18 | Info del dueño B: 16 | Legales C: 12 (un hallazgo puede tener más de un tipo). Total: 35.
- **Bloquean producción:** 18.
- **Secretos expuestos:** no.
- **Riesgos mayores:**
  1. LEG-001/002: no hay titular, CUIT ni factura, y EstuRed ya cobra el fee a una cuenta propia.
  2. LEG-003: residencias pueden exigir y ver antecedentes penales (Ley 25.326 art. 7.4).
  3. LEG-004: menores de 14–17 se registran y aceptan términos sin tutor, contra DR43.
  4. LEG-009/010: el arrepentimiento exige login y no emite código; /terms excluye toda responsabilidad.
  5. LEG-006/007: /privacy no describe el tratamiento real ni las transferencias a Brasil y EE. UU.

## Matriz de riesgo

| ID | Área | Tema | Gravedad | Probabilidad | Tipo | Nivel | Bloquea |
|---|---|---|---|---|---|---|---|
| LEG-001 | L18, L2 | Responsable del sitio y de los datos sin identificar | Alta | Alta | B | 🔴 N1 | Sí |
| LEG-002 | L6 | Fee cobrado sin forma jurídica ni factura emitida | Alta | Alta | B, C | 🔴 N1 | Sí |
| LEG-003 | L5, L2 | Antecedentes penales pedidos y vistos por residencias | Alta | Media | C | 🔴 N1 | Sí |
| LEG-004 | L4 | Menores de 14–17 se registran y aceptan solos | Alta | Media | C | 🔴 N1 | Sí |
| LEG-005 | L4 | `/verify` público revela dónde vive un menor | Media | Baja | A | 🟢 N3 | Sí |
| LEG-006 | L3 | Transferencias internacionales sin declarar ni contrato | Alta | Alta | C | 🔴 N1 | Sí |
| LEG-007 | L2, L8, L10 | `/privacy` desalineada con el código | Alta | Alta | B | 🟡 N2 | Sí |
| LEG-008 | L2, L19 | Derechos del titular sin canal ni flujo de supresión | Alta | Media | A, B | 🟡 N2 | Sí |
| LEG-009 | L7 | Arrepentimiento con login, sin código y condicionado | Alta | Media | C | 🔴 N1 | Sí |
| LEG-010 | L7, L8 | Cláusulas de exclusión, jurisdicción y no responsabilidad | Alta | Media | C | 🔴 N1 | Sí |
| LEG-011 | L8 | `/terms` promete funciones que no existen | Media | Alta | A | 🟢 N3 | Sí |
| LEG-012 | L8 | Evidencia de aceptación sin versión real ni hash | Media | Alta | A, B | 🟡 N2 | Sí |
| LEG-013 | L9 | Sin acuerdo con residencias en la app | Alta | Alta | C | 🔴 N1 | Sí |
| LEG-014 | L1 | Rol «intermediaria activa» y solidaridad del art. 40 | Alta | Media | C | 🔴 N1 | Sí |
| LEG-015 | L1, L12 | Claims de verificación que el código no respalda | Alta | Alta | A | 🟢 N3 | Sí |
| LEG-016 | L9 | Sello «Residencia Verificada» sin alcance visible | Alta | Media | C | 🔴 N1 | Sí |
| LEG-017 | L12 | Imágenes demo con sello y SEO «verificadas» en preapertura | Media | Media | A | 🟢 N3 | Sí |
| LEG-018 | L12, L1 | Vínculo comercial (DR45) divulgado solo de forma oral | Media | Baja | B | 🟡 N2 | No |
| LEG-019 | L10, L3 | Cookies y almacenamiento sin aviso; IP a Google y OSM | Media | Alta | A, B | 🟡 N2 | No |
| LEG-020 | L10 | Push sin registro del consentimiento | Baja | Media | A | 🟢 N3 | No |
| LEG-021 | L11 | Emails: remitente, contacto del familiar sin consentimiento | Media | Media | A, B | 🟡 N2 | No |
| LEG-022 | L11, L19 | Preapertura promete borrado a 30 días que el código no ejecuta | Media | Alta | A, B | 🟡 N2 | No |
| LEG-023 | L19 | Retención y borrado no implementados | Media | Alta | A, B | 🟡 N2 | No |
| LEG-024 | L16 | Logs con email o teléfono en errores de Supabase | Baja | Media | A | 🟢 N3 | No |
| LEG-025 | L16 | MFA admin, incidentes, backups y email sin verificar | Alta | Media | A, B | 🟡 N2 | Sí |
| LEG-026 | L2 | Datos sensibles por texto libre y documentos «otro» | Media | Media | B | 🟡 N2 | No |
| LEG-027 | L13 | Sin denuncia de contenido; carrusel público | Media | Media | A, B | 🟡 N2 | No |
| LEG-028 | L13 | Filtro «Solo mujeres / Solo hombres» | Baja | Baja | C | 🟡 N2 | No |
| LEG-029 | L14 | Fotos sin licencia de uso; fotos de terceros en el repo | Media | Media | B, C | 🟡 N2 | No |
| LEG-030 | L14 | Marca «EstuRed» sin registro en el INPI | Media | Baja | B | 🟡 N2 | No |
| LEG-031 | L17, L7 | Popup de preapertura no cerrable | Baja | Alta | A | 🟢 N3 | No |
| LEG-032 | L6 | Tipo de cambio: redondeo no informado y nota mal ubicada | Media | Alta | A, C | 🟡 N2 | No |
| LEG-033 | L2 | Base de datos sin inscribir en la AAIP | Media | Media | B | 🟡 N2 | No |
| LEG-034 | L17 | Accesibilidad: botones solo-ícono sin revisar | Baja | Media | A | 🟢 N3 | No |
| LEG-035 | L20, L14 | Universidades, extranjeros, licencias npm, tiles OSM | Baja | Baja | A | 🟢 N3 | No |

## 🔴 N1 — Asesor obligatorio

```
ID: LEG-001
Área: L18, L2
Archivo / línea / componente: app/(public)/terms/page.tsx:351; components/preapertura/legal/LegalPreapertura.tsx:101,105; lib/constants/contact.ts:2-5; components/layout/Footer.tsx:118-150; docs/PLAN_SALIDA_PRODUCCION.md:20,211-212
Hallazgo: No hay responsable identificado. /terms:351 dice «Razón social… ley aplicable y jurisdicción: a completar con asesoría legal». La preapertura muestra «[Responsable: a definir]» y «[Fecha a definir]». /privacy no nombra responsable. El footer no tiene razón social, CUIT, domicilio ni enlace a Defensa del Consumidor. El email `hola@estured.com` es un placeholder y la casilla no existe.
Por qué importa (riesgo concreto): sin responsable identificado no hay a quién dirigir derechos ni reclamos (Ley 25.326 art. 6; Ley 24.240 art. 4). El `replyTo` de los emails apunta a una casilla inexistente. Los placeholders visibles restan validez a los textos.
Gravedad / Probabilidad: Alta | Alta
Tipo: B
Nivel de asesor: N1
Bloquea producción: Sí
Corrección recomendada: definir titular (persona humana monotributista o sociedad), CUIT, domicilio legal y un email operativo. Publicarlos en /terms, /privacy, footer y comprobantes. Preguntar al asesor si corresponde un enlace a Defensa del Consumidor (la Res. 316/2018 fue derogada por la Disp. 954/2025).
Si no hay asesor a tiempo (plan B seguro): no abrir. Este dato no tiene sustituto genérico.
Texto provisorio: ver TP-11
Esfuerzo: S (código) + decisión del dueño
¿Arreglo automático?: No, requiere decisión
Ya cubierto por: docs/PLAN_SALIDA_PRODUCCION.md:212 (pendiente)
```

```
ID: LEG-002
Área: L6
Archivo / línea / componente: lib/payments/paymentSettings.ts:9-30; app/students/applications/[id]/fee/page.tsx:162; app/students/applications/[id]/fee/FeeTransferInstructions.tsx:47; lib/reservations/confirmAfterFeePaid.ts:22-24,244; lib/receipts/receiptView.ts:67; docs/10 §16
Hallazgo: EstuRed cobra el fee (5 %) por transferencia a una cuenta propia configurada en `payment_settings`. No hay razón social ni condición fiscal definidas. La Factura C no se emite: queda en `pending_issue`. El comprobante de reserva aclara que no es factura.
Por qué importa (riesgo concreto): cobrar sin facturar expone a sanciones de ARCA y de Ingresos Brutos. El monotributo tiene topes de facturación. El reintegro por revocación exige nota de crédito si hubo factura. EstuRed no custodia fondos de terceros, así que este N1 sale de lo fiscal, no de normativa financiera.
Gravedad / Probabilidad: Alta | Alta
Tipo: B, C
Nivel de asesor: N1 (asesor legal + contador)
Bloquea producción: Sí
Corrección recomendada: definir quién es titular de la cuenta de `payment_settings`. Inscribir la actividad en ARCA e Ingresos Brutos (CABA). Emitir Factura C manual por cada fee hasta integrar TusFacturas. Guardar el número de factura en la reserva.
Si no hay asesor a tiempo (plan B seguro): ver «Decisiones del propietario» n.º 1. Apagar el fee rompe el loop: sin fee pagado no hay reserva confirmada. Opciones: abrir con fee y Factura C manual desde el día 1, o abrir solo el catálogo y las solicitudes sin confirmar reservas.
Texto provisorio: ver TP-08 (reintegro) y TP-03 §Fee
Esfuerzo: M (código) + trámite fiscal
¿Arreglo automático?: No, requiere decisión
Ya cubierto por: docs/10 §31.7; GAPS.md:38
```

```
ID: LEG-003
Área: L5, L2
Archivo / línea / componente: lib/residences/stayDocuments.ts:14; lib/documents/residenceDocumentAccess.ts:23,101; app/students/profile/page.tsx:181; db/migrations/0077
Hallazgo: la residencia puede exigir «Antecedentes penales» como requisito de estadía. El estudiante lo sube y la residencia lo abre (base `applicant` o `resident`, link de 300 s, registro de acceso).
Por qué importa (riesgo concreto): la Ley 25.326 art. 7 inc. 4 reserva el tratamiento de antecedentes penales a autoridades públicas competentes. Un privado que los pide y almacena puede incurrir en infracción. Además permite discriminar por antecedentes.
Gravedad / Probabilidad: Alta | Media
Tipo: C
Nivel de asesor: N1
Bloquea producción: Sí
Corrección recomendada: quitar el tipo `criminal_record` del catálogo de requisitos. Bloquear subidas nuevas. Definir qué hacer con archivos existentes (en dev son demo).
Si no hay asesor a tiempo (plan B seguro): ocultar la opción en el formulario de requisitos y en el perfil del estudiante (tipo A, S). Mantener el tipo en la base sin uso.
Texto provisorio: ver TP-04 §7
Esfuerzo: S
¿Arreglo automático?: Sí, con confirmación
Ya cubierto por: —
```

```
ID: LEG-004
Área: L4
Archivo / línea / componente: app/(public)/register/student/actions.ts:113-117,190,209-215; lib/preapertura/validation.ts:63-64; next.config.ts:84-89; docs/00 DR43; docs/10 §9.1; app/(public)/privacy/page.tsx:85
Hallazgo: `/register/student` acepta 14 a 17 años sin invitación ni tutor. El menor acepta términos y privacidad por sí mismo. DR43 fija 18 años para cuenta propia. La preapertura sí bloquea al menor sin invitación. Con `PREAPERTURA` encendido solo se redirige `/register` exacto; `/register/student` queda accesible por URL (no lo probé en staging). `is_minor` no se recalcula al cumplir 18.
Por qué importa (riesgo concreto): un contrato de adhesión aceptado por un menor puede ser anulable (CCyC arts. 26, 677 y ss.). El consentimiento de datos de un menor sin el representante puede ser inválido. Tres fuentes dicen tres cosas distintas: docs/10 §9.1, DR43 y /privacy:85.
Gravedad / Probabilidad: Alta | Media
Tipo: C
Nivel de asesor: N1
Bloquea producción: Sí
Corrección recomendada: alinear el código a DR43. Hoy no existe un alta de menor iniciada por el familiar fuera de preapertura: el menor se registra y después invita al familiar (`app/students/family-link-actions.ts:159`), o lo invita una residencia como residente (GAPS.md:392). Opciones: construir el alta por invitación del familiar, o dejar la cuenta del menor en espera hasta que el familiar acepte y consienta con su `user_id`. Cubrir también la invitación de la residencia. Recalcular la minoría por `birth_date`, no por el flag.
Si no hay asesor a tiempo (plan B seguro): bloquear el alta abierta y la invitación de residencia para menores de 18 hasta tener el consentimiento del familiar. Publicar TP-07 solo cuando el flujo exista.
Texto provisorio: ver TP-07
Esfuerzo: L
¿Arreglo automático?: Sí, con confirmación (la regla ya está decidida en DR43)
Ya cubierto por: docs/10 §31.9; MEMORY.md §5 (divergencia /privacy §4)
```

```
ID: LEG-006
Área: L3
Archivo / línea / componente: app/(public)/privacy/page.tsx:57-62,73-75; docs/PLAN_SALIDA_PRODUCCION.md:74,315; app/layout.tsx:54-65
Hallazgo: los datos se alojan o pasan fuera de Argentina: Supabase (prod planeado en São Paulo), Vercel (iad1, EE. UU.), Resend, Cloudflare Turnstile, Google Fonts y los servicios de push. /privacy dice «estamos validando». No hay contrato de transferencia ni DPA archivado en el repo.
Por qué importa (riesgo concreto): la Ley 25.326 art. 12 restringe transferir a países sin protección adecuada. Brasil y EE. UU. no figuran en la lista de la Disp. 60/2016. Hace falta consentimiento o cláusulas modelo (Disp. 60/2016 o Res. AAIP 198/2023).
Gravedad / Probabilidad: Alta | Alta
Tipo: C
Nivel de asesor: N1
Bloquea producción: Sí
Corrección recomendada: aceptar y archivar el DPA de cada proveedor. Pedir al asesor que valide si alcanza o hace falta adenda con las cláusulas modelo. Declarar cada proveedor, país y finalidad en /privacy.
Si no hay asesor a tiempo (plan B seguro): publicar TP-01 §Proveedores. Mover Vercel a gru1 (São Paulo) para reducir destinos. Autoalojar Material Symbols (LEG-019).
Texto provisorio: ver TP-01
Esfuerzo: M
¿Arreglo automático?: No, requiere revisión legal
Ya cubierto por: docs/10 §31.13; P19-13
```

```
ID: LEG-009
Área: L7
Archivo / línea / componente: middleware.ts:61-66 (matcher `/students/:path*`); app/students/revocation/page.tsx; lib/revocations/copy.ts:16-25,42-50; lib/revocations/window.ts:5,46-47; components/preapertura/PreaperturaFooter.tsx:36; next.config.ts:89
Hallazgo: el botón de arrepentimiento lleva a `/students/revocation`, que exige sesión. No se emite código ni acuse de la revocación (no encontré emisión en `lib/revocations/*`). El reintegro se condiciona a «salvo que la revisión detecte un uso indebido». En preapertura el link redirige a `/mi-lugar`. Los textos citan la Res. 424/2020, derogada.
Por qué importa (riesgo concreto): la Disp. 954/2025 prohíbe exigir registración previa. La Disp. 3/2026 solo admite pasos razonables para verificar identidad y exige informar un código dentro de 24 h. El derecho de revocación (Ley 24.240 art. 34; CCyC art. 1110) es irrenunciable. Condicionar el reintegro puede ser nulo.
Gravedad / Probabilidad: Alta | Media
Tipo: C
Nivel de asesor: N1
Bloquea producción: Sí
Corrección recomendada: página pública de arrepentimiento sin login, con verificación de identidad razonable (email de la cuenta + código de reserva). Emitir un código de revocación por email al instante. Quitar «uso indebido» como causal genérica. Pedir al asesor si aplica la excepción de servicio ya prestado una vez confirmada la reserva (Disp. 954/2025).
Si no hay asesor a tiempo (plan B seguro): mantener el reintegro completo sin condiciones dentro de 10 días corridos. Publicar TP-08.
Texto provisorio: ver TP-08
Esfuerzo: M
¿Arreglo automático?: Sí, con confirmación (página pública y código); el copy requiere revisión legal
Ya cubierto por: docs/10 §31.6; DR6 (preguntas al asesor)
```

```
ID: LEG-010
Área: L7, L8
Archivo / línea / componente: app/(public)/terms/page.tsx:247,351; docs/00 DR63(g); docs/10 §14.5, §15
Hallazgo: /terms:247 dice «EstuRed no reembolsa ni es responsable… bajo ninguna circunstancia». No hay cláusula de modificación de términos. La jurisdicción está «a completar». DR63(g) agrega una no responsabilidad por pagos sin salvedad de derechos del consumidor.
Por qué importa (riesgo concreto): las cláusulas que desnaturalizan obligaciones o limitan la responsabilidad por daños se tienen por no convenidas (Ley 24.240 art. 37; CCyC arts. 988 y 1119). Una prórroga de jurisdicción contra el consumidor es inválida.
Gravedad / Probabilidad: Alta | Media
Tipo: C
Nivel de asesor: N1
Bloquea producción: Sí
Corrección recomendada: reemplazar exclusiones totales por la fórmula «en la máxima medida permitida por la ley y sin perjuicio de los derechos irrenunciables del consumidor». Agregar modificación con aviso previo y jurisdicción del domicilio del consumidor.
Si no hay asesor a tiempo (plan B seguro): publicar TP-03 y TP-06.
Texto provisorio: ver TP-03, TP-06
Esfuerzo: S
¿Arreglo automático?: Sí, con confirmación (copy)
Ya cubierto por: docs/10 §31.1, §31.5
```

```
ID: LEG-013
Área: L9
Archivo / línea / componente: app/(public)/register/residence/invitacion/[token]/RedeemInviteForm.tsx:19-23; app/(public)/register/residence/invitacion/[token]/actions.ts:127-128; app/(public)/register/residence/RegisterResidenceForm.tsx:294; lib/residences/addResidenceForOwner.ts:162-170; app/(public)/terms/page.tsx:345,362; docs/20
Hallazgo: no existe el acuerdo con residencias en la app. La residencia acepta «/terms como residencia asociada», pero /terms es «para estudiantes y familias» y su §29 dice que el acuerdo de residencias es otro documento pendiente. En la invitación no se guarda consentimiento de privacidad. En el alta directa la privacidad se acepta implícitamente («Al enviar aceptás»). `docs/20` es solo plantilla.
Por qué importa (riesgo concreto): sin contrato no hay obligaciones exigibles a la residencia: veracidad de precios y disponibilidad, licencia de fotos, cobro (DR63), no exigir garantía propietaria (DR16), indemnidad. Eso deja a EstuRed sola frente al consumidor (art. 40).
Gravedad / Probabilidad: Alta | Alta
Tipo: C
Nivel de asesor: N1
Bloquea producción: Sí
Corrección recomendada: publicar «Condiciones para residencias» en su propia ruta. Aceptación expresa con casilla y versión, separada de /terms y de privacidad. Pedir re-aceptación a residencias ya cargadas.
Si no hay asesor a tiempo (plan B seguro): publicar TP-04 con aceptación expresa. Ninguna residencia se publica sin aceptarlo.
Texto provisorio: ver TP-04
Esfuerzo: M
¿Arreglo automático?: Sí, con confirmación (ruta, casilla, consent); el texto requiere revisión legal
Ya cubierto por: docs/10 §31.2, §31.8
```

```
ID: LEG-014
Área: L1
Archivo / línea / componente: docs/10 §3 (:63-134); lib/residences/collectionApproval.ts; app/admin/collection-approvals/; app/(public)/terms/page.tsx:45,219
Hallazgo: docs/10 §3 define a EstuRed como «plataforma intermediaria activa»: verifica, gestiona solicitudes, cobra el fee y emite comprobantes. Con DR63 el admin además aprueba los datos de cobro que la residencia muestra al estudiante.
Por qué importa (riesgo concreto): cuanto más interviene la plataforma, más se acerca a la cadena de comercialización del art. 40 de la Ley 24.240. Aprobar los datos de cobro puede leerse como respaldo del medio de pago. Un reclamo por alojamiento o por un pago desviado podría dirigirse a EstuRed.
Gravedad / Probabilidad: Alta | Media
Tipo: C
Nivel de asesor: N1
Bloquea producción: Sí
Corrección recomendada: pedir dictamen sobre el alcance de la responsabilidad. Revisar el copy de la aprobación de datos de cobro: «revisado en formato», no «verificado». Mantener la separación de entidades en todos los textos.
Si no hay asesor a tiempo (plan B seguro): publicar TP-05 y TP-06 en ficha, solicitud, pantalla de pago y comprobante.
Texto provisorio: ver TP-05, TP-06
Esfuerzo: S (copy)
¿Arreglo automático?: No, requiere revisión legal
Ya cubierto por: docs/10 §31.11, §31.15
```

```
ID: LEG-016
Área: L9
Archivo / línea / componente: components/residences/TrustBadge.tsx:24,37; components/residences/ficha/ResidencePlate.tsx:102,118; app/(public)/residencias/[slug]/_og/ShareCard.tsx:121; lib/residences/verificationReview.ts:131-143; app/(public)/nosotros/page.tsx:73-76; app/(public)/verify/page.tsx:65
Hallazgo: el sello se apoya en una visita real con tres controles (DNI del responsable, dirección in situ, fotos coinciden) y vence al año. El alcance limitado está bien explicado en /nosotros, /terms:318 y /verify. Pero en la ficha y en las tarjetas el sello no explica su alcance ni enlaza a /nosotros. No se usa el copy de docs/10 §11.3.
Por qué importa (riesgo concreto): «Verificada» sin alcance puede leerse como garantía de habilitación, seguridad o calidad (Ley 24.240 arts. 7–8; DNU 274/2019 art. 11 sobre publicidad engañosa, que derogó la Ley 22.802). Si algo falla, el sello es la prueba del reclamo.
Gravedad / Probabilidad: Alta | Media
Tipo: C
Nivel de asesor: N1
Bloquea producción: Sí
Corrección recomendada: tooltip o línea corta junto al sello con el alcance y enlace a /nosotros. Validar con el asesor qué se puede afirmar.
Si no hay asesor a tiempo (plan B seguro): publicar TP-13 junto al sello en ficha, tarjeta y ShareCard.
Texto provisorio: ver TP-13
Esfuerzo: S
¿Arreglo automático?: Sí, con confirmación
Ya cubierto por: docs/10 §31.14; DR13, DR22
```

## 🟡 N2 — Asesor recomendado

```
ID: LEG-007
Área: L2, L8, L10
Archivo / línea / componente: app/(public)/privacy/page.tsx:57-62,64-65,73-75,85,107,112,122-127,172; components/preapertura/legal/LegalPreapertura.tsx:159,164,168,171-175
Hallazgo: /privacy no coincide con el código.
- Nombra MercadoPago, PayU y TusFacturas, que no están integrados.
- Omite Supabase, Vercel, Resend, Cloudflare, Google Fonts, OSM, Nominatim, monedapi.ar y los servicios de push.
- No tiene la leyenda de la AAIP (solo está en la versión de preapertura).
- Dice «no tenemos plazo definido» de retención; la preapertura promete borrar a los 30 días. Con el flag encendido la página dice ambas cosas.
- No menciona cookies, localStorage ni push.
- No da plazos para responder derechos.
- Afirma que el teléfono del familiar se comparte «si consentiste explícitamente», pero ese consentimiento no existe.
- §4 (:85) dice que un menor no termina el registro sin familiar; el código lo deja registrarse.
- Fecha «julio de 2026» vs. /terms «octubre de 2026».
Por qué importa (riesgo concreto): el deber de información del art. 6 de la Ley 25.326 se mide por lo que el texto dice. Un texto que no describe el tratamiento real no informa. La leyenda AAIP es obligatoria (Disp. 10/2008; Res. AAIP 14/2018).
Gravedad / Probabilidad: Alta | Alta
Tipo: B
Nivel de asesor: N2
Bloquea producción: Sí (publicar TP-01 antes de abrir; la revisión del asesor puede llegar después)
Corrección recomendada: reemplazar /privacy por TP-01. Unificar con la versión de preapertura. Una sola fecha de actualización.
Si no hay asesor a tiempo (plan B seguro): TP-01 versión publicable.
Texto provisorio: ver TP-01, TP-02
Esfuerzo: S
¿Arreglo automático?: Sí, con confirmación
Ya cubierto por: docs/10 §31.3; MEMORY.md §5
```

```
ID: LEG-008
Área: L2, L19
Archivo / línea / componente: app/(public)/privacy/page.tsx:102-141; app/(public)/register/student/actions.ts:240; db/migrations/0002_identity_roles_audit.sql:56; FKs sin `on delete` en 0003:225, 0007:84, 0010:112, 0011:36, 0023:32, 0026:11, 0029:15, 0087:19; GAPS.md:254
Hallazgo: los derechos de acceso, rectificación y supresión se ejercen «por email» a una casilla que no existe. No hay flujo de baja ni de exportación. Unas 42 FKs `NOT NULL` a `users` sin `on delete` impiden borrar a un usuario con actividad (cifra aproximada). `consents` sí hace `on delete cascade`: borrar al usuario borraría la prueba del consentimiento. No hay runbook interno.
Por qué importa (riesgo concreto): el responsable debe responder acceso en 10 días corridos y rectificación o supresión en 5 hábiles (Ley 25.326 arts. 14 y 16). Sin canal ni procedimiento, el plazo vence sin respuesta.
Gravedad / Probabilidad: Alta | Media
Tipo: A, B
Nivel de asesor: N2
Bloquea producción: Sí (el canal real; el flujo automático puede esperar)
Corrección recomendada: crear la casilla de privacidad (precondición). Escribir un runbook manual: verificar identidad, exportar, anonimizar. Diseñar la anonimización: reemplazar PII de `users`, `student_profiles` y `family_members` por valores neutros y conservar `consents`, `audit_logs` y datos fiscales. No quitar el `cascade` suelto: cambiarlo a `set null` sobre un `user_id` anonimizado.
Si no hay asesor a tiempo (plan B seguro): canal por email + runbook manual con plazos de ley. TP-12.
Texto provisorio: ver TP-12
Esfuerzo: L
¿Arreglo automático?: Sí, con confirmación (runbook y migración); requiere decisión sobre plazos
Ya cubierto por: GAPS.md:254
```

```
ID: LEG-012
Área: L8
Archivo / línea / componente: `CONSENT_VERSION = "v0.1-borrador"` en app/(public)/register/student/actions.ts:26, register/family/actions.ts:19, register/staff/[token]/actions.ts:16, register/residence/invitacion/[token]/actions.ts:24, app/students/profile/actions.ts:43, lib/reservations/recordResidencePaymentReceived.ts:18, lib/residences/addResidenceForOwner.ts:11; app/students/applications/[id]/fee/actions.ts:117; FeePaymentForm.tsx:92-97
Hallazgo: `consents` guarda tipo, versión, fecha, IP y user agent. Pero la versión es un string fijo copiado en 7 archivos, que no coincide con la fecha publicada ni con un hash del texto. No hay re-aceptación cuando cambia el texto. La casilla de «no reembolso» del fee se valida pero no se guarda.
Por qué importa (riesgo concreto): ante un reclamo, EstuRed no puede probar qué texto aceptó cada usuario (Ley 25.506 y CCyC art. 288 sobre firma y prueba electrónica). La aceptación del reglamento sí está bien hecha (hash sha256, inmutable).
Gravedad / Probabilidad: Media | Alta
Tipo: A, B
Nivel de asesor: N2
Bloquea producción: Sí (versionado mínimo antes de abrir)
Corrección recomendada: módulo único `lib/legal/versions.ts` con versión y hash de cada texto. Guardar la casilla del fee como consent. Pedir re-aceptación al cambiar versión. Copiar el patrón del reglamento (0053).
Si no hay asesor a tiempo (plan B seguro): igual; es técnico.
Texto provisorio: no aplica
Esfuerzo: M
¿Arreglo automático?: Sí
Ya cubierto por: —
```

```
ID: LEG-018
Área: L12, L1
Archivo / línea / componente: docs/00 DR45 (:1726)
Hallazgo: según DR45, un vínculo comercial del dueño con un tercero del sector se divulga solo de forma oral. No se reabre la decisión.
Por qué importa (riesgo concreto): un vínculo no divulgado por escrito puede afectar la percepción de imparcialidad del sello y la información debida al consumidor (Ley 24.240 art. 4).
Gravedad / Probabilidad: Media | Baja
Tipo: B
Nivel de asesor: N2
Bloquea producción: No
Corrección recomendada: una línea de divulgación por escrito en /nosotros o en las condiciones. Consultarlo una vez con el asesor.
Si no hay asesor a tiempo (plan B seguro): mantener la divulgación oral y no mostrar esa residencia como destacada.
Texto provisorio: no aplica (lo redacta el dueño con el asesor)
Esfuerzo: S
¿Arreglo automático?: No, requiere decisión
Ya cubierto por: DR45
```

```
ID: LEG-019
Área: L10, L3
Archivo / línea / componente: app/layout.tsx:54-65; lib/supabase/cookie-options.ts:7,22,40; lib/forms/localDraft.ts:103; lib/maps/osmTiles.ts:74; components/residences/CompactMap.tsx:44; components/ui/TurnstileWidget.tsx:18
Hallazgo:
- Material Symbols se carga desde `fonts.googleapis.com` en todas las páginas: Google recibe IP y user agent sin aviso.
- Los tiles de `tile.openstreetmap.org` reciben IP y zona en /search y en la ficha. La política de uso de OSM no admite tráfico productivo intenso (ya anotado en CompactMap.tsx:44).
- Turnstile recibe señales del navegador en login, registro y preapertura.
- Cookies: `sb-*-auth-token` (httpOnly) y `er-has-session` (legible por JS, hasta 400 días).
- localStorage guarda borradores de formularios con datos personales en el dispositivo.
- No hay sección de cookies. La preapertura dice «solo cookies necesarias» y omite localStorage.
Por qué importa (riesgo concreto): Argentina no tiene ley de cookies específica, pero el envío de IP a terceros es tratamiento y requiere información (Ley 25.326 art. 6). Los usuarios de la UE, si los hay, activarían reglas más estrictas.
Gravedad / Probabilidad: Media | Alta
Tipo: A, B
Nivel de asesor: N2
Bloquea producción: No
Corrección recomendada: autoalojar Material Symbols (tipo A). Evaluar un proveedor de tiles con licencia productiva. Publicar TP-02. No hace falta banner: todo es esencial o funcional.
Si no hay asesor a tiempo (plan B seguro): TP-02 + autoalojar íconos.
Texto provisorio: ver TP-02
Esfuerzo: M
¿Arreglo automático?: Sí, con confirmación
Ya cubierto por: docs/10 §31.4; GAPS.md (Material Symbols pendiente)
```

```
ID: LEG-021
Área: L11
Archivo / línea / componente: lib/email/sendEmail.ts:9-13,53-56; app/(preapertura)/preregistro/familiar/actions.ts:98; app/students/family-link-actions.ts:229; lib/residents/guardianConfirmation.ts:71; docs/10 §17.1bis
Hallazgo: todos los emails son transaccionales y no hay marketing. Riesgos: el remitente cae a `onboarding@resend.dev` si falta `EMAIL_FROM`. El nombre visible puede ser el de una residencia con `replyTo` de terceros. Se envían emails a familiares cargados por el estudiante. El consentimiento `family_contact_disclosure` no existe.
Por qué importa (riesgo concreto): enviar a un tercero cuyo email cargó otro usuario es tratamiento sin consentimiento directo del tercero. Un remitente ajeno al dominio facilita phishing.
Gravedad / Probabilidad: Media | Media
Tipo: A, B
Nivel de asesor: N2
Bloquea producción: No
Corrección recomendada: exigir `EMAIL_FROM` del dominio propio en producción (fallar al iniciar si falta). Primer email al familiar con identificación de EstuRed, motivo y opción de rechazar el vínculo. Implementar `family_contact_disclosure` o quitar la mención.
Si no hay asesor a tiempo (plan B seguro): TP-09 en el email al familiar.
Texto provisorio: ver TP-09
Esfuerzo: M
¿Arreglo automático?: Sí, con confirmación
Ya cubierto por: MEMORY.md §5 (`family_contact_disclosure`)
```

```
ID: LEG-022
Área: L11, L19
Archivo / línea / componente: components/preapertura/legal/LegalPreapertura.tsx:159; db/migrations/0080_preapertura.sql:56-96; db/migrations/0001 (waitlist_signups); db/migrations/0015:11; docs/00 DR31
Hallazgo: la privacidad de preapertura promete borrar datos a los 30 días (verificar el disparador exacto en el texto). No hay job que lo haga. `waitlist_signups` conserva datos de una lista cerrada (DR31) y solo guarda `privacy_consent_at`, sin versión. `preapertura_invitaciones` guarda emails de terceros.
Por qué importa (riesgo concreto): una promesa incumplida de borrado es un tratamiento sin base (Ley 25.326 art. 4 inc. 7: los datos se destruyen cuando dejan de ser necesarios).
Gravedad / Probabilidad: Media | Alta
Tipo: A, B
Nivel de asesor: N2
Bloquea producción: No (sí antes de que venza el primer plazo prometido)
Corrección recomendada: job de purga según lo prometido. Decidir si `waitlist_signups` se borra o se migra con aviso.
Si no hay asesor a tiempo (plan B seguro): purga manual por SQL con registro en el runbook.
Texto provisorio: no aplica
Esfuerzo: M
¿Arreglo automático?: Sí, con confirmación
Ya cubierto por: DR31
```

```
ID: LEG-023
Área: L19
Archivo / línea / componente: db/migrations/0013 (cron); lib/jobs/*; db/migrations/0083:86; docs/10 §10.5, §27
Hallazgo: el cron solo cambia estados y notifica. La única purga es `rate_limit_hits` a los 2 días. No se purgan archivos de Storage, `audit_logs`, notificaciones, suscripciones push revocadas ni invitaciones vencidas. `docs/10` §27 no fija ningún plazo.
Por qué importa (riesgo concreto): conservar sin límite aumenta el daño ante una brecha y contradice el principio de finalidad. Los comprobantes y facturas tienen plazos fiscales mínimos (verificar con el contador).
Gravedad / Probabilidad: Media | Alta
Tipo: A, B
Nivel de asesor: N2
Bloquea producción: No
Corrección recomendada: tabla de retención por categoría decidida por el dueño y el contador. Job mensual de purga o anonimización.
Si no hay asesor a tiempo (plan B seguro): TP-01 dice «el tiempo necesario para la finalidad y obligaciones legales».
Texto provisorio: ver TP-01 §Conservación
Esfuerzo: L
¿Arreglo automático?: No, requiere decisión
Ya cubierto por: docs/10 §31.10
```

```
ID: LEG-025
Área: L16
Archivo / línea / componente: docs/10 §24.2, §28.6; docs/audits/AUDITORIA_SEGURIDAD_COMPLEMENTARIA_2026-11-15.md:36,203,217; AUDITORIA_PRE_PRODUCCION_2026-11-19.md (P19-06); GAPS.md:396
Hallazgo: siguen abiertos:
- MFA para admin y superadmin: 0 referencias a `aal2`. `docs/10` §24.2 lo exige y §31.16 lo da por resuelto.
- Sin monitoreo, alertas ni responsable de incidentes. No hay procedimiento de aviso a afectados.
- Backups y restauración sin probar.
- Email sin verificar en el alta (`email_confirm: true`): se puede registrar un email ajeno.
Por qué importa (riesgo concreto): el art. 9 de la Ley 25.326 exige medidas de seguridad. Un admin sin MFA accede a DNI y documentos. Ante una brecha sin procedimiento, no hay forma de cumplir la respuesta que pida la AAIP.
Gravedad / Probabilidad: Alta | Media
Tipo: A, B
Nivel de asesor: N2
Bloquea producción: Sí (MFA admin y verificación de email)
Corrección recomendada: MFA TOTP obligatorio para admin. Confirmación de email en el alta. Runbook de incidentes de una página. Prueba de restauración.
Si no hay asesor a tiempo (plan B seguro): igual; es técnico.
Texto provisorio: no aplica
Esfuerzo: M
¿Arreglo automático?: Sí, con confirmación
Ya cubierto por: COMPLEMENTARIA:36,203,217; P19-06; GAPS.md:396
```

```
ID: LEG-026
Área: L2
Archivo / línea / componente: app/students/profile/OtherDocumentsUpload.tsx:32; lib/students/profileOptions.ts:39; resident_notes.body (0026:14); support_cases.description (0023:37); stay_followup_responses.comment (0055:92)
Hallazgo: no hay columnas de salud, religión ni orientación. Pero la UI sugiere subir «seguro médico» como documento «otro». El hábito «Fumador» es un dato cercano a salud. Notas de la residencia, casos de soporte y comentarios aceptan texto libre.
Por qué importa (riesgo concreto): los datos sensibles exigen consentimiento expreso y no se pueden obligar a dar (Ley 25.326 art. 7). Un texto libre sin aviso los capta igual.
Gravedad / Probabilidad: Media | Media
Tipo: B
Nivel de asesor: N2
Bloquea producción: No
Corrección recomendada: quitar «seguro médico» como ejemplo. Aviso junto a cada texto libre: «No incluyas datos de salud, religión u otros datos sensibles». Dejar «Fumador» como preferencia de convivencia opcional.
Si no hay asesor a tiempo (plan B seguro): el aviso.
Texto provisorio: ver TP-01 §Datos sensibles
Esfuerzo: S
¿Arreglo automático?: Sí, con confirmación
Ya cubierto por: —
```

```
ID: LEG-027
Área: L13
Archivo / línea / componente: app/(public)/terms/page.tsx:291,302; app/admin/community/ResidentModerationActions.tsx; docs/00 DR44, DR54.2
Hallazgo: no hay botón para denunciar perfiles, bios o preguntas. La moderación es solo del admin. La bio no tiene filtro. El carrusel de comunidad es público (DR44, riesgo aceptado). Un estudiante bloqueado sigue en el carrusel (DR54.2).
Por qué importa (riesgo concreto): sin canal de denuncia, EstuRed se entera tarde de contenido discriminatorio o lesivo. La respuesta tardía tras tomar conocimiento agrava la responsabilidad (criterio jurisprudencial sobre intermediarios; verificar con el asesor).
Gravedad / Probabilidad: Media | Media
Tipo: A, B
Nivel de asesor: N2
Bloquea producción: No
Corrección recomendada: enlace «Reportar» que abre un caso de Soporte con el ID del contenido. Ocultar del carrusel a bloqueados.
Si no hay asesor a tiempo (plan B seguro): TP-12 con email de denuncia.
Texto provisorio: ver TP-12
Esfuerzo: M
¿Arreglo automático?: Sí, con confirmación
Ya cubierto por: DR54.2 (decisión pendiente)
```

```
ID: LEG-028
Área: L13
Archivo / línea / componente: lib/residences/searchFilters.ts:105-106; app/residence/[residence_id]/rooms/RoomsBrowser.tsx:149; db/migrations/0076:57 (`preferred_gender`)
Hallazgo: el buscador filtra «Solo mujeres / Solo hombres» según la política de la residencia. No hay filtros por nacionalidad ni religión. /terms:302 prohíbe discriminar.
Por qué importa (riesgo concreto): la Ley 23.592 sanciona actos discriminatorios. Las residencias por género son habituales, pero conviene validar el criterio y el copy.
Gravedad / Probabilidad: Baja | Baja
Tipo: C
Nivel de asesor: N2
Bloquea producción: No
Corrección recomendada: describirlo como «Residencia para mujeres / para varones» (política de la residencia), no como filtro de personas. Validar con el asesor.
Si no hay asesor a tiempo (plan B seguro): dejarlo; riesgo bajo.
Texto provisorio: no aplica
Esfuerzo: S
¿Arreglo automático?: Sí, con confirmación
Ya cubierto por: docs/10 §31.12
```

```
ID: LEG-029
Área: L14
Archivo / línea / componente: design-references/Fotos Residencias/ (39 archivos en git); scripts/upload-residence-photos.mjs:2,30; app/residence/[residence_id]/profile/PhotoMetaManager.tsx; GAPS.md:145 (H27)
Hallazgo: al subir fotos la residencia no declara titularidad ni otorga licencia. /terms no tiene cláusula de propiedad intelectual. Hay 39 fotos de terceros con marca de agua commiteadas en el repo; un script las sube a Storage de dev (con guard de dev).
Por qué importa (riesgo concreto): publicar fotos sin licencia expone a reclamos de autor (Ley 11.723). Fotos con personas identificables exigen consentimiento (CCyC art. 53). Si el repo es o se vuelve público, se redistribuyen obras ajenas.
Gravedad / Probabilidad: Media | Media
Tipo: B, C
Nivel de asesor: N2
Bloquea producción: No (sí confirmar que ninguna de esas fotos llegue a producción)
Corrección recomendada: casilla al subir: «Tengo derechos sobre estas fotos y autorizo a EstuRed a publicarlas». Cláusula en TP-04. Sacar la carpeta del repo.
Si no hay asesor a tiempo (plan B seguro): TP-04 §Contenido + casilla.
Texto provisorio: ver TP-04
Esfuerzo: S
¿Arreglo automático?: Sí, con confirmación
Ya cubierto por: H27 (GAPS.md:145)
```

```
ID: LEG-030
Área: L14
Archivo / línea / componente: docs/PLAN_SALIDA_PRODUCCION.md:3,155 (dominio); sin mención del INPI
Hallazgo: no hay registro de la marca «EstuRed» en el INPI ni plan para hacerlo. El dominio `estured.com` está en Hostinger desde 2026-11-14, con WHOIS privado; no consta a nombre de quién.
Por qué importa (riesgo concreto): sin registro, un tercero puede registrar la marca y oponerse al uso. El dominio a nombre personal complica una futura sociedad.
Gravedad / Probabilidad: Media | Baja
Tipo: B
Nivel de asesor: N2
Bloquea producción: No
Corrección recomendada: búsqueda de anterioridad y solicitud en el INPI (clases a definir con el asesor). Confirmar titularidad del dominio.
Si no hay asesor a tiempo (plan B seguro): búsqueda de anterioridad gratuita en el portal del INPI.
Texto provisorio: no aplica
Esfuerzo: M (trámite)
¿Arreglo automático?: No, requiere decisión
Ya cubierto por: —
```

```
ID: LEG-032
Área: L6
Archivo / línea / componente: components/ui/ExchangeRateNote.tsx:7; lib/mock/exchange.ts:29-30; app/students/applications/[id]/fee/page.tsx:228; components/layout/Footer.tsx:121
Hallazgo: la nota informa la fuente («dólar blue, valor venta del día») pero no el redondeo a múltiplos de $500. En la pantalla del fee dice que el valor final se fija «cuando realices el pago directamente a la residencia», pero el fee se paga a EstuRed. «Dólar blue» aparece en textos comerciales.
Por qué importa (riesgo concreto): el precio en pesos debe informarse en forma cierta (Ley 24.240 art. 4). El uso de una cotización no oficial en textos comerciales está pendiente de validación (docs/10 §31.17).
Gravedad / Probabilidad: Media | Alta
Tipo: A, C
Nivel de asesor: N2
Bloquea producción: No
Corrección recomendada: nota específica para el fee. Informar el redondeo. Evaluar la fórmula neutra de docs/10 §31.17.
Si no hay asesor a tiempo (plan B seguro): TP-03 §Precios.
Texto provisorio: ver TP-03
Esfuerzo: S
¿Arreglo automático?: Sí, con confirmación
Ya cubierto por: docs/10 §31.17
```

```
ID: LEG-033
Área: L2
Archivo / línea / componente: docs/PLAN_SALIDA_PRODUCCION.md:211
Hallazgo: la base de datos no está inscripta en el Registro Nacional de Bases de Datos de la AAIP. El runbook lo deja «si corresponde», sin tildar.
Por qué importa (riesgo concreto): la Ley 25.326 art. 21 obliga a inscribir bases privadas destinadas a dar informes, y la AAIP pide inscribir las de uso no exclusivamente personal. El trámite es gratuito y exige primero inscribir al responsable (depende de LEG-001).
Gravedad / Probabilidad: Media | Media
Tipo: B
Nivel de asesor: N2
Bloquea producción: No
Corrección recomendada: inscribir responsable y base por TAD apenas exista el CUIT.
Si no hay asesor a tiempo (plan B seguro): hacerlo igual; no requiere abogado.
Texto provisorio: no aplica
Esfuerzo: S
¿Arreglo automático?: No, requiere decisión
Ya cubierto por: docs/PLAN_SALIDA_PRODUCCION.md:211
```

## 🟢 N3 — Sin asesor

```
ID: LEG-005
Área: L4
Archivo / línea / componente: lib/receipts/verifyLookup.ts:110-136; app/(public)/verify/
Hallazgo: `/verify/[code]` es público y muestra nombre, inicial del apellido y residencia del titular del comprobante. Para un menor, revela dónde vive a quien tenga el código.
Por qué importa (riesgo concreto): dato de ubicación de un menor (Ley 26.061, interés superior). Riesgo bajo porque exige el código, pero el comprobante circula.
Gravedad / Probabilidad: Media | Baja
Tipo: A
Nivel de asesor: N3 (corrección técnica; el criterio de menores ya está decidido)
Bloquea producción: Sí
Corrección recomendada: si el titular es menor, mostrar solo «Comprobante válido» y la residencia, sin nombre. Evaluar lo mismo para todos.
Si no hay asesor a tiempo (plan B seguro): igual.
Texto provisorio: no aplica
Esfuerzo: S
¿Arreglo automático?: Sí
Ya cubierto por: —
```

```
ID: LEG-011
Área: L8
Archivo / línea / componente: app/(public)/terms/page.tsx:232,236-239; app/(public)/privacy/page.tsx:58-61
Hallazgo: /terms promete «hasta 3 intentos dentro de 48 horas» si falla el pago del fee; no hay cobro automático. Habla de «proveedores de pago habilitados»; el pago es por transferencia manual. Afirma que «EstuRed emite el comprobante fiscal»; la factura no se emite (LEG-002).
Por qué importa (riesgo concreto): información inexacta al consumidor (Ley 24.240 art. 4). Se corrige alineando el texto al código.
Gravedad / Probabilidad: Media | Alta
Tipo: A
Nivel de asesor: N3
Bloquea producción: Sí
Corrección recomendada: reemplazar por TP-03 §Fee.
Si no hay asesor a tiempo (plan B seguro): igual.
Texto provisorio: ver TP-03
Esfuerzo: S
¿Arreglo automático?: Sí, con confirmación
Ya cubierto por: —
```

```
ID: LEG-015
Área: L1, L12
Archivo / línea / componente: app/(public)/nosotros/page.tsx:59,66-67; components/residences/ficha/CostsBoard.tsx:55-58; app/admin/verifications/VerificationDetail.tsx:288-291; lib/residences/verificationReview.ts:131-143
Hallazgo: tres afirmaciones exceden lo que el código verifica:
- /nosotros:66-67: «lista de control que firman las dos partes». El checklist son casillas del admin; la residencia no firma nada.
- /nosotros:59: «existen los tipos de habitación… y los servicios publicados coinciden». No hay casilla para eso.
- CostsBoard.tsx:55-58: «EstuRed la visitó en persona y chequeó que lo que ves sea real». Lo verificado es identidad, dirección y similitud de fotos.
Por qué importa (riesgo concreto): afirmaciones falsas sobre el servicio son publicidad engañosa (DNU 274/2019 art. 11; Ley 24.240 art. 8) y prueba en contra ante un reclamo.
Gravedad / Probabilidad: Alta | Alta
Tipo: A
Nivel de asesor: N3 (corrección de copy; el sello en sí es LEG-016)
Bloquea producción: Sí
Corrección recomendada: reescribir las tres frases con lo que se controla de verdad. Ejemplo CostsBoard: «EstuRed la visitó en persona: controlamos la identidad del responsable, la dirección y que las fotos coincidan.» Alternativa: agregar las casillas que faltan al checklist y una firma de la residencia (docs/10 §11.1).
Si no hay asesor a tiempo (plan B seguro): igual.
Texto provisorio: ver TP-13 para el alcance
Esfuerzo: S
¿Arreglo automático?: Sí, con confirmación
Ya cubierto por: —
```

```
ID: LEG-017
Área: L12
Archivo / línea / componente: public/landing/proceso-1-busqueda.webp (usada en components/marketing/HomeLanding.tsx:28) y otras proceso-*.webp; app/layout.tsx:28,32; app/manifest.ts:9; app/llms.txt/route.ts:13; app/(preapertura)/preapertura/page.tsx:12-14
Hallazgo: capturas de la landing muestran residencias demo con sello «Residencia Verificada» y precios, sin rótulo «Datos de ejemplo». El título SEO y el manifest dicen «residencias verificadas» cuando todavía no hay ninguna publicada (la descripción aclara «Estamos visitándolas»).
Por qué importa (riesgo concreto): puede inducir a creer que ya existen residencias verificadas con esos precios (DNU 274/2019 art. 11).
Gravedad / Probabilidad: Media | Media
Tipo: A
Nivel de asesor: N3
Bloquea producción: Sí (mientras no haya residencias verificadas publicadas)
Corrección recomendada: rótulo «Ejemplo ilustrativo» en las capturas. Título SEO de preapertura sin «verificadas» hasta la primera publicación.
Si no hay asesor a tiempo (plan B seguro): igual.
Texto provisorio: no aplica
Esfuerzo: S
¿Arreglo automático?: Sí, con confirmación
Ya cubierto por: —
```

```
ID: LEG-020
Área: L10
Archivo / línea / componente: components/push/PushPermissionCard.tsx:31-33; lib/push/actions.ts:85-133; lib/push/payload.ts:3-6; db/migrations/0101
Hallazgo: el opt-in es explícito, hay baja por categoría y se revoca al cerrar sesión. El contenido es genérico. Falta registro del consentimiento (fecha y versión) y mención en /privacy.
Por qué importa (riesgo concreto): bajo. Sin registro no se prueba el opt-in.
Gravedad / Probabilidad: Baja | Media
Tipo: A
Nivel de asesor: N3
Bloquea producción: No
Corrección recomendada: guardar `consents` tipo `push` al suscribir. TP-09 en la tarjeta de activación.
Si no hay asesor a tiempo (plan B seguro): igual.
Texto provisorio: ver TP-09
Esfuerzo: S
¿Arreglo automático?: Sí
Ya cubierto por: DR61
```

```
ID: LEG-024
Área: L16
Archivo / línea / componente: lib/residents/setResidentEmail.ts:32,49,58,71,83; lib/family/updateFamilyProfile.ts:62; lib/family/emailVerification.ts:22,48; app/(public)/forgot-password/actions.ts:91; app/api/csp-report/route.ts:13-16,30-32
Hallazgo: unos 600 `console.*` imprimen el objeto de error completo de Supabase. Ante un duplicado (23505), `details` trae el email o el teléfono. `csp-report` conserva la ruta del documento: rutas con token (`/register/staff/[token]`) podrían quedar en logs de Vercel. `docs/10` §28.5 no lista email ni teléfono como prohibidos en logs.
Por qué importa (riesgo concreto): datos personales en logs de un tercero (Vercel), sin retención controlada.
Gravedad / Probabilidad: Baja | Media
Tipo: A
Nivel de asesor: N3
Bloquea producción: No
Corrección recomendada: helper `logSupabaseError` que imprima solo `code` y `message`. Redactar segmentos de token en `csp-report`.
Si no hay asesor a tiempo (plan B seguro): igual.
Texto provisorio: no aplica
Esfuerzo: M
¿Arreglo automático?: Sí
Ya cubierto por: P19-17
```

```
ID: LEG-031
Área: L17, L7
Archivo / línea / componente: components/preapertura/PreaperturaDialog.tsx:32-35; components/preapertura/PreaperturaFooter.tsx:36-52
Hallazgo: en producción el popup de preapertura no se cierra (ni con Esc ni con clic afuera) y el fondo es inerte. El footer del popup enlaza Términos, Privacidad, Revocación y /verify.
Por qué importa (riesgo concreto): falla WCAG 2.1.2 (sin trampa de teclado) si el usuario no puede salir. Ley 26.653 aplica en sentido estricto al sector público. Condicionar el acceso al registro es una decisión comercial válida en preapertura.
Gravedad / Probabilidad: Baja | Alta
Tipo: A
Nivel de asesor: N3
Bloquea producción: No
Corrección recomendada: asegurar que todo el contenido del popup sea operable por teclado y que los enlaces legales abran en página propia. No hace falta hacerlo cerrable.
Si no hay asesor a tiempo (plan B seguro): igual.
Texto provisorio: no aplica
Esfuerzo: S
¿Arreglo automático?: Sí, con confirmación
Ya cubierto por: decisión del dueño 2026-11-08 (popup mínimo)
```

```
ID: LEG-034
Área: L17
Archivo / línea / componente: components/** (botones solo-ícono)
Hallazgo: no revisé a fondo los botones solo-ícono sin `aria-label`. El resto de los controles básicos está bien (ver ✅).
Por qué importa (riesgo concreto): bajo. Referencia WCAG 2.1 AA 4.1.2.
Gravedad / Probabilidad: Baja | Media
Tipo: A
Nivel de asesor: N3
Bloquea producción: No
Corrección recomendada: barrido con `axe` o la skill `design:accessibility-review` en las 10 pantallas principales.
Si no hay asesor a tiempo (plan B seguro): igual.
Texto provisorio: no aplica
Esfuerzo: M
¿Arreglo automático?: Sí
Ya cubierto por: —
```

```
ID: LEG-035
Área: L20, L14
Archivo / línea / componente: lib/data/buenosAiresUniversities.ts; app/(public)/search/SearchShell.tsx:350; package.json; lib/maps/osmTiles.ts:74
Hallazgo:
- Universidades: uso nominativo del nombre, sin logos. Riesgo bajo.
- Extranjeros: solo español; precios en USD con ARS referencial. El preregistro pide país (Latinoamérica).
- Licencias npm: todo MIT salvo `web-push` (MPL-2.0, copyleft débil por archivo) y `@img/sharp-libvips-*` (LGPL-3.0, transitiva). Sin GPL ni AGPL.
- Tiles OSM: ver LEG-019.
Por qué importa (riesgo concreto): bajo. MPL y LGPL no obligan a abrir el código propio si no se modifican esas librerías.
Gravedad / Probabilidad: Baja | Baja
Tipo: A
Nivel de asesor: N3
Bloquea producción: No
Corrección recomendada: no modificar `web-push` ni `sharp`. Mantener el uso nominativo sin logos.
Si no hay asesor a tiempo (plan B seguro): igual.
Texto provisorio: no aplica
Esfuerzo: S
¿Arreglo automático?: No hace falta
Ya cubierto por: —
```

## ✅ Verificado correcto (con evidencia)

- **Secretos:** ningún secreto en archivos trackeados. `.env*` en `.gitignore:22`. La historia (4428 blobs) se escaneó en `docs/audits/AUDITORIA_SEGURIDAD_2026-11-14.md:99`. El bootstrap de prod solo tiene placeholders (P19-08).
- **Reglamento:** aceptación con versión, hash sha256, rol y fecha, tabla inmutable (`db/migrations/0053_residence_regulations.sql:120-129`). Si el estudiante es menor, acepta el familiar (`app/students/applications/actions.ts:171`).
- **Contacto con menores:** la residencia contacta al familiar (`app/students/applications/actions.ts:66`). Comunidad oculta para menores (`db/migrations/0037:52-61`). Estadía de un menor requiere confirmación del tutor (`lib/residents/activateResidentStay.ts:141`, tabla 0071).
- **Acceso a documentos:** admin con motivo de ≥10 caracteres, registro y falla cerrada (`lib/documents/requestDocumentAccess.ts:24,37-55`). Residencia con registro en `residence_document_access_log`, link de 300 s y tope de 60/h (DR48).
- **DNI / pasaporte:** tabla privada sin policies, solo service role (`db/migrations/0100`); número enmascarado; residencia lo ve solo con estadía vigente o reserva confirmada (DR58). El log no guarda el número.
- **Buckets:** cuatro privados y uno público solo de fotos de residencias (`scripts/setup-storage.mjs:37-74`). Signed URLs de 60 a 600 s.
- **Rol y Soporte:** /terms dice «Reclamos y Soporte», sin «mediación» (`app/(public)/terms/page.tsx:289`). Aclara que no garantiza el alojamiento (:45) y que no custodia lo pagado a la residencia (:219).
- **Pago a la residencia fuera de la plataforma:** EstuRed no recibe ni retiene ese dinero (DR63 h; `app/residence/[residence_id]/collection/page.tsx:42`).
- **Preapertura:** contadores, cupo de 10 y cuenta regresiva son reales (`lib/preapertura/rules.ts:7`; `components/preapertura/LiveCount.tsx`). Ejemplos ficticios rotulados. «Gratis» solo para sumarse; el fee del 5 % se informa en `/for-students`. La privacidad de preapertura tiene la leyenda AAIP literal (`components/preapertura/legal/LegalPreapertura.tsx:172-174`), plazos de derechos y consentimiento de transferencia.
- **Sin analytics, píxeles ni IA.** No hay bot (D9).
- **Push:** opt-in explícito y baja (LEG-020 solo pide registro).
- **Penalizaciones:** motivo obligatorio y aviso (`lib/residences/setQualityVisibilityByAdmin.ts:17-28,52`).
- **Accesibilidad base:** `lang="es"` (`app/layout.tsx:44`), skip link en los layouts, `alt` en todas las `<Image>`, diálogos con foco y trampa, `<dialog>` nativo con Esc en la FAQ.
- **Fuentes de texto:** Hanken Grotesk y Bricolage Grotesque autoalojadas con `next/font` (OFL).
- **`/search`** aclara «disponibilidad informativa» (:85). Sin «reserva garantizada», «#1», testimonios ni estadísticas inventadas en copy público.
- **Comprobante:** aclara que no es factura (`lib/receipts/receiptView.ts:67`).

## ⚪ Necesita información del propietario

1. Titular del negocio: persona humana o sociedad, razón social, CUIT, domicilio legal, condición frente al IVA (LEG-001, LEG-002).
2. Titular de la cuenta bancaria configurada en `payment_settings` (LEG-002). No se imprime en este informe.
3. Email operativo de contacto y de privacidad con el dominio definitivo (LEG-001, LEG-008).
4. Región final de Supabase prod y de Vercel (LEG-006).
5. Plazos de retención por categoría, con el contador (LEG-023).
6. Si hay o habrá usuarios en la UE (LEG-019).
7. Disparador exacto del borrado de 30 días prometido en preapertura (LEG-022).
8. Titular del dominio `estured.com` (LEG-030).
9. Si el repo es o será público (LEG-029).
10. Si hay contratos con el Estado (reclasificaría accesibilidad, LEG-031, LEG-034).

## Inventario de servicios de terceros

| Servicio | Archivo | Datos que recibe | País | ¿Antes de consentimiento? | ¿Necesario? | ¿En la Política de Privacidad? | ¿Contrato o DPA? |
|---|---|---|---|---|---|---|---|
| Supabase (base, auth, Storage) | toda la app; `lib/supabase/*` | todos los datos personales y archivos | Brasil (prod planeado, runbook:74); dev: PENDIENTE DE INFO | Sí (infraestructura) | Sí | No | PENDIENTE DE INFO |
| Vercel (hosting, logs) | despliegue | IP, URL, logs con errores (LEG-024) | EE. UU. (iad1; gru1 pendiente) | Sí | Sí | No | PENDIENTE DE INFO |
| Resend (email) | `lib/email/sendEmail.ts:69` | email, nombre, contenido del mensaje | PENDIENTE DE INFO (verificar región de la cuenta) | No aplica (transaccional) | Sí | No | PENDIENTE DE INFO |
| Cloudflare Turnstile | `components/ui/TurnstileWidget.tsx:18`; `lib/security/turnstile.ts:14,40` | IP y señales del navegador | Global | Sí (login, registro, preapertura) | Sí (antiabuso) | No | PENDIENTE DE INFO |
| Google Fonts (Material Symbols) | `app/layout.tsx:54-65` | IP, user agent | EE. UU. / global | Sí, en todas las páginas | No (se puede autoalojar) | No | No aplica |
| OpenStreetMap tiles | `lib/maps/osmTiles.ts:74` | IP, zona del mapa | Reino Unido / global | Sí (/search, ficha) | Reemplazable | No | Política de uso de OSM |
| Nominatim (OSM) | `lib/geocoding/nominatim.ts:11,28` | dirección de la residencia (desde el servidor) | Reino Unido / global | No aplica | Sí (DF6) | No | Política de uso de OSM |
| monedapi.ar | `lib/exchange/provider.ts:36` | ninguno | Argentina | No aplica | Sí | No | No aplica |
| Servicios push (FCM, Apple, Mozilla, Microsoft) | `lib/push/endpoint.ts:8-12` | endpoint y texto genérico | EE. UU. / global | No (solo tras opt-in) | Opcional | No | No aplica (del navegador) |
| WhatsApp (`wa.me`) | `lib/share`, `lib/residents` | lo que el usuario decida enviar | EE. UU. | No aplica (link manual) | Opcional | No | No aplica |
| Hostinger (DNS, dominio) | — | ninguno de usuarios | PENDIENTE DE INFO | No aplica | Sí | No | No aplica |
| MercadoPago / PayU / TusFacturas | no integrados | ninguno hoy | — | — | Futuro | **Sí, pero no se usan** (`privacy:57-62`) | — |

## Inventario de datos personales

| Dato | Dónde se pide | Para qué | Dónde se guarda | Quién accede | Retención | ¿Necesario? | Sensible |
|---|---|---|---|---|---|---|---|
| Email, teléfono | registro | cuenta y contacto | `users` (0002:23-24) | titular, admin, residencia (según estado) | sin plazo | Sí | No |
| Nombre, apellido, fecha de nacimiento | registro / perfil | identificación, minoría de edad | `student_profiles` (0002:70-93) | titular, familiar vinculado (0006:49), residencia (parcial), admin | sin plazo | Sí | No (dato de menores: alta protección) |
| Nacionalidad, origen | perfil | comunidad, convivencia | `student_profiles` | según visibilidad | sin plazo | Opcional | Cercano (origen) |
| Universidad, carrera, bio, hábitos, intereses, foto | perfil | comunidad y búsqueda | `student_profiles` | según visibilidad (D4) | sin plazo | Opcional | «Fumador»: cercano a salud |
| Tipo y número de DNI/pasaporte | perfil | identificación ante la residencia | `student_identity_documents` (0100) | titular; residencia con estadía o reserva; admin | sin plazo | A revisar (minimización) | No, pero alto riesgo |
| Documento de identidad (archivo), comprobante académico | perfil / requisitos | requisitos de la residencia | bucket `student-documents` + `files` | titular, residencia (DR48), admin con motivo | sin plazo | Según residencia | No |
| **Antecedentes penales** | requisitos de estadía | requisito de la residencia | bucket `student-documents` | titular, residencia, admin | sin plazo | **No** (LEG-003) | **Sí (art. 7.4)** |
| Documentos «otro» (ej. seguro médico) | perfil | requisitos | bucket `student-documents` | titular, residencia, admin | sin plazo | Según caso | Puede serlo |
| Datos del familiar: nombre, DNI, teléfono, CUIT | vínculo familiar / pago | vínculo, pagador del fee | `family_members` (0004:16-20; 0045:33-34) | titular familiar, admin; DNI/tel/CUIT ocultos al estudiante | sin plazo | Sí | No |
| Datos fiscales del pagador | pantalla del fee | factura | `estured_fee_payments` (0011:25-26) | admin | sin plazo (plazo fiscal PENDIENTE) | Sí | No |
| Comprobantes de pago | fee / pago a residencia | validación | bucket `payment-proofs` | admin, residencia (pago a residencia) | sin plazo | Sí | No |
| Datos de cobro de la residencia (CBU/alias/CVU) | `/residence/[id]/collection` | mostrar medios de pago | `residence_collection_accounts` (0102) | admin, estudiante con pago habilitado | sin plazo | Sí | No |
| Invitación a residente (email, teléfono de un tercero) | panel de residencia | invitar | `resident_stays` (0019:31; 0063:38) | residencia, admin | sin plazo | Sí | No |
| Responsable de la residencia | alta | verificación | `residence_private_details` (0043:64-65) | admin | sin plazo | Sí | No |
| Preregistro (fecha de nacimiento, universidad, provincia, hábitos) | `/preregistro` | lista de preapertura | `preapertura_estudiantes` (0080:56-80) | admin | 30 días prometidos (no implementado) | Sí | No |
| Email de terceros invitados | preapertura | invitación | `preapertura_invitaciones` (0080:96) | admin | sin plazo | Sí | No |
| Lista de espera vieja | `/waitlist` (borrada) | — | `waitlist_signups` (0001) | service role | sin plazo | **No** (DR31) | No |
| Suscripción push | tarjeta de avisos | notificaciones | `push_subscriptions` (0101:44-55) | titular, service role | hasta baja (revocadas sin purga) | Opcional | No |
| IP y user agent | consentimientos, auditoría | prueba y seguridad | `consents`, `audit_logs` (0002:53-62, 118-134) | admin | sin plazo | Sí | No |
| Texto libre (notas, soporte, comentarios) | varias pantallas | gestión | `resident_notes`, `support_cases`, `stay_followup_responses` | residencia / admin | sin plazo | Sí | Puede contener |
| Preferencia de género (cambio de habitación) | «Quiero cambiar» | asignación | `room_change_requests` (0076:57) | residencia, admin | sin plazo | Sí | No |
| IP hasheada | antiabuso | rate limit | `rate_limit_hits` (0083:27) | sistema | 2 días (implementado) | Sí | No |
| Borradores de formularios | navegador | comodidad | localStorage (`lib/forms/localDraft.ts:103`) | solo el dispositivo | hasta envío o borrado | Opcional | Puede contener |

## Inventario de assets y licencias

| Asset | Tipo | Fuente | Licencia | Estado |
|---|---|---|---|---|
| Logo e isotipo (`public/brand/*.svg`, `marketing/instagram/assets/logo/`) | marca | propia | propia (sin registro INPI) | Revisar (LEG-030) |
| Capturas `public/landing/*.webp` | imagen | propias de la app | propia | Revisar (rótulo de ejemplo, LEG-017) |
| Hanken Grotesk, Bricolage Grotesque | fuente | Google Fonts vía `next/font` | OFL | OK |
| Material Symbols | íconos | `fonts.googleapis.com` | Apache-2.0 | Revisar (autoalojar, LEG-019) |
| Tiles de mapa | imagen | OpenStreetMap | ODbL, atribución presente | Revisar (política de uso, LEG-019) |
| Fotos de residencias en producción | imagen | las sube cada residencia | sin licencia declarada | Revisar (LEG-029) |
| `design-references/Fotos Residencias/` (39) | imagen | terceros, con marca de agua | ninguna | Reemplazar / sacar del repo (LEG-029) |
| Ilustraciones de Instagram generadas con IA | imagen | generación propia | según términos del generador usado: PENDIENTE DE INFO | Revisar |
| Dependencias npm | código | npm | MIT; `web-push` MPL-2.0; `sharp-libvips` LGPL-3.0 | OK |
| picsum.photos | imagen | — | — | OK (ya no se usa) |

## Mapa de flujo de dinero

**Respuesta directa:** EstuRed no custodia ni retiene fondos de terceros. Sí recibe su propio fee del 5 % en una cuenta propia y devuelve reintegros del fee. El pago de la reserva va directo del estudiante a la residencia.

| Pago | Quién paga | Quién recibe | Por qué medio | ¿Pasa por EstuRed? | Comprobante | Texto que lo explica en la app |
|---|---|---|---|---|---|---|
| Pago de reserva / pago inicial | estudiante o familiar | residencia | medios que carga la residencia y aprueba el admin (DR63), o contacto de la residencia | No | la residencia marca «Pago recibido» | `app/residence/[residence_id]/collection/page.tsx:42`; `/terms` §14 (:216-219); `components/residences/ficha/CostBreakdown.tsx:174` |
| Fee EstuRed (5 % de la estadía inicial) | estudiante o familiar designado | EstuRed | transferencia manual a la cuenta de `payment_settings` | **Sí** | comprobante PDF + QR (`/verify`). Factura C: **no se emite hoy** | `app/students/applications/[id]/fee/page.tsx:162`; `FeeTransferInstructions.tsx:47` |
| Fee de renovación | estudiante o familiar | EstuRed | transferencia manual | **Sí** | igual que el fee | `lib/renewals/registerRenewalManualFeePayment.ts` |
| Mensualidades | estudiante | residencia | acuerdo directo | No | no hay | `WhatsYouPay.tsx:22`; `ResidencesLanding.tsx:62` |
| Reintegro del fee (revocación en 10 días) | EstuRed | estudiante o pagador | transferencia fuera de la plataforma; se registran medio y últimos 4 dígitos | **Sí** (sale) | registro de auditoría; nota de crédito: PENDIENTE | `lib/revocations/copy.ts:18-25` |
| Devolución de lo pagado a la residencia | residencia | estudiante | entre las partes | No | no hay | `/terms` :219, :247 |
| Planes de residencia (Gestión Operativa) | — | — | no se cobra (D8) | No | — | `docs/00` D8 |

## Discrepancias texto legal vs. comportamiento real

| Texto | Dice | El código hace | Hallazgo |
|---|---|---|---|
| `/privacy` :57-62 | fee por MercadoPago/PayU; factura por TusFacturas | transferencia manual; factura `pending_issue` | LEG-007 |
| `/privacy` :64-65 | teléfono del familiar solo con consentimiento explícito | no existe `family_contact_disclosure` | LEG-021 |
| `/privacy` :73-75 | transferencia internacional «en validación» | Supabase (Brasil), Vercel (EE. UU.) | LEG-006 |
| `/privacy` :85 | el menor no termina el registro sin familiar | el menor de 14–17 se registra solo | LEG-004 |
| `/privacy` :107 | se conserva trazabilidad | `consents` se borra en cascada con el usuario | LEG-008 |
| `/privacy` :112 vs. preapertura :159 | «sin plazo» vs. «borramos a los 30 días» | no hay purga | LEG-022, LEG-023 |
| `/privacy` | — (no menciona cookies, push ni localStorage) | los usa | LEG-019, LEG-020 |
| `/terms` :232 | 3 intentos en 48 h si falla el fee | no hay cobro automático | LEG-011 |
| `/terms` :236-239 | «EstuRed emite el comprobante fiscal»; «proveedores habilitados» | sin factura; transferencia manual | LEG-011, LEG-002 |
| `/terms` :247 | «no reembolsa… bajo ninguna circunstancia» | reintegra el fee en revocación | LEG-010 |
| `/terms` :351 | razón social y jurisdicción «a completar» | — | LEG-001 |
| `/terms` §29 :345 | acuerdo de residencias es otro documento | la residencia acepta `/terms` | LEG-013 |
| `/nosotros` :66-67 | lista de control firmada por las dos partes | casillas del admin | LEG-015 |
| `CostsBoard` :55-58 | «chequeó que lo que ves sea real» | identidad, dirección y fotos | LEG-015 |
| `lib/revocations/copy.ts` | botón de arrepentimiento accesible | exige login; sin código | LEG-009 |
| `ExchangeRateNote` en el fee | valor final al pagar a la residencia | el fee se paga a EstuRed | LEG-032 |
| `docs/10` §31.16 | 2FA admin resuelto | sin implementar | LEG-025 |
| `docs/10` §9.1 vs. DR43 | menor con familiar vs. 18+ | menor solo | LEG-004 |

## Plan de correcciones por olas

### Ola 0 — bloquea abrir al público

| ID | Acción | Dueño | Esfuerzo | Depende de |
|---|---|---|---|---|
| LEG-001 | Definir titular, CUIT, domicilio y email operativo; publicarlos | dueño → Claude | S + trámite | — |
| LEG-002 | Decidir modelo fiscal del fee; Factura C manual por fee | dueño + contador | M | LEG-001 |
| LEG-003 | Quitar «Antecedentes penales» del catálogo de requisitos | Claude | S | aprobación |
| LEG-004 | Aplicar DR43: alta de menor con consentimiento del familiar; cubrir invitación de residencia | Claude | L | decisión del dueño |
| LEG-005 | `/verify` sin nombre si el titular es menor | Claude | S | — |
| LEG-006 | Aceptar y archivar DPAs; Vercel a gru1; publicar proveedores | dueño + Claude | M | LEG-001 |
| LEG-007 | Publicar TP-01 en `/privacy` | Claude | S | LEG-001 |
| LEG-008 | Casilla de privacidad real + runbook manual de derechos | dueño + Claude | M | LEG-001 |
| LEG-009 | Arrepentimiento sin login + código por email; TP-08 | Claude | M | LEG-001 |
| LEG-010, LEG-011 | Publicar TP-03 y TP-06 en `/terms` | Claude | S | LEG-001 |
| LEG-012 | Versionado con hash; guardar casilla del fee | Claude | M | — |
| LEG-013 | Ruta de condiciones para residencias con aceptación expresa (TP-04) | Claude | M | LEG-001 |
| LEG-014 | TP-05 en ficha, solicitud, pago y comprobante | Claude | S | — |
| LEG-015, LEG-017 | Corregir claims y rótulos de ejemplo | Claude | S | — |
| LEG-016 | TP-13 junto al sello | Claude | S | — |
| LEG-025 | MFA admin y confirmación de email | Claude | M | — |

- **Sin asesor:** todo lo tipo A (003, 004, 005, 009 en código, 011, 012, 015, 016 copy, 017, 025) y la publicación de los TP en versión prudente.
- **Espera al asesor:** dictamen sobre art. 40 (014), arrepentimiento y su excepción (009), cláusulas (010), transferencias (006), menores (004), alcance del sello (016). Mientras tanto quedan publicados TP-01, 03, 04, 05, 06, 07, 08 y 13.
- **Limitar con feature flag:** requisito de antecedentes penales (apagar). Alta abierta de estudiantes menores (cerrar). El fee no se apaga sin decisión (Decisión n.º 1).

### Ola 1 — antes de cobrar fee o escalar

| ID | Acción | Dueño | Esfuerzo | Depende de |
|---|---|---|---|---|
| LEG-002 | Inscripción ARCA/IIBB; integrar TusFacturas o mantener manual con registro | dueño + contador | L | Ola 0 |
| LEG-013 | Revisión del asesor de TP-04; re-aceptación de residencias | asesor | M | Ola 0 |
| LEG-022 | Purga de preapertura y `waitlist_signups` | Claude | M | decisión de plazos |
| LEG-023 | Tabla de retención + job de purga/anonimización | dueño + contador + Claude | L | — |
| LEG-008 | Anonimización de cuentas en código | Claude | L | LEG-023 |
| LEG-021 | `EMAIL_FROM` obligatorio; primer email al familiar | Claude | M | — |
| LEG-032 | Nota de tipo de cambio para el fee y redondeo | Claude | S | — |

- **Sin asesor:** 021, 022 (técnico), 032, 008 (código).
- **Espera al asesor y al contador:** 002, 013, plazos de 023.

### Ola 2 — dentro de 90 días

| ID | Acción | Dueño | Esfuerzo |
|---|---|---|---|
| LEG-033 | Inscripción en el Registro de Bases de Datos (AAIP) | dueño | S |
| LEG-030 | Búsqueda de anterioridad y solicitud de marca en el INPI | dueño + asesor | M |
| LEG-018 | Divulgación escrita del vínculo DR45 | dueño + asesor | S |
| LEG-019 | Autoalojar Material Symbols; evaluar tiles; TP-02 | Claude | M |
| LEG-026 | Avisos en texto libre; quitar «seguro médico» | Claude | S |
| LEG-027 | Botón «Reportar»; ocultar bloqueados del carrusel | Claude | M |
| LEG-028 | Copy del filtro de género | Claude + asesor | S |
| LEG-029 | Casilla de licencia de fotos; sacar fotos de terceros del repo | Claude + dueño | S |
| LEG-020 | Registrar consentimiento de push | Claude | S |

### Ola 3 — mejora continua

| ID | Acción | Dueño | Esfuerzo |
|---|---|---|---|
| LEG-024 | Helper de logs sin PII; redactar tokens en `csp-report` | Claude | M |
| LEG-031 | Operabilidad por teclado del popup | Claude | S |
| LEG-034 | Barrido de accesibilidad con `axe` | Claude | M |
| LEG-035 | Higiene de licencias y assets | Claude | S |

## Decisiones del propietario (numeradas)

1. **¿Cómo abrís con el fee mientras no hay forma jurídica ni factura?**
   Sin fee pagado no hay reserva confirmada. Apagarlo deja abrir solo catálogo y solicitudes.
   - A) Abrir recién con CUIT, inscripción y Factura C manual por cada fee.
   - B) Abrir catálogo y solicitudes; no confirmar reservas hasta tener lo fiscal.
   - C) Cobrar el fee sin factura «por ahora».
   - **Recomendación: A.** B es el plan de contingencia. C no es una opción segura.
   - **Resuelto por el dueño (2026-11-21): A.** Inscripción en ARCA e IIBB antes de abrir. Factura C manual por cada fee. Pendiente en código: guardar el número de factura en la reserva y ajustar TP-03 §Fee.
2. **¿Quitás el requisito de antecedentes penales?**
   La ley reserva ese dato a autoridades públicas. Opciones: quitarlo (recomendado) o mantenerlo hasta el dictamen. **Recomendación:** quitarlo ya.
   **Resuelto por el dueño (2026-11-21): esperar al asesor.** LEG-003 sigue bloqueando la apertura hasta el dictamen. Si el dictamen no llega antes de abrir, aplicar el plan B (ocultar la opción).
3. **¿Cerramos el alta abierta de menores según DR43?**
   El código acepta 14–17 sin tutor. Opciones: aplicar DR43 (recomendado) o mantener el alta con aviso. **Recomendación:** aplicar DR43.
   **Resuelto por el dueño (2026-11-21): cuenta en espera.** El menor se registra, pero la cuenta queda inactiva hasta que el familiar acepta y consiente con su propio `user_id`. Cubre también la invitación de residencia. Cambia la letra de DR43: por `docs/13` §5, actualizar primero `docs/00` (DR43) y `docs/10` §9.1, después el código.
4. **¿Quién es el titular y cuál es el email operativo?**
   Opciones: persona humana monotributista o sociedad (SAS). **Recomendación:** decidirlo con el contador; el email `privacidad@` y `hola@` del dominio definitivo antes de abrir.
   **Resuelto por el dueño (2026-11-21):** titular persona humana monotributista, por ahora. Revisar el paso a SAS al escalar. Pendiente: CUIT, domicilio, categoría del monotributo y emails.
5. **¿Mudamos Vercel a São Paulo (gru1)?**
   Reduce un destino de transferencia y la latencia. **Recomendación:** sí.
   **Resuelto por el dueño (2026-11-21): sí, al armar producción** (no en staging). Ya figura en el runbook (`docs/PLAN_SALIDA_PRODUCCION.md:315`, P19-13). TP-01 debe reflejar la región final.
6. **¿Arrepentimiento público sin login?**
   Opciones: página pública con verificación por email + código de reserva (recomendado) o mantener login. **Recomendación:** página pública.
   **Resuelto por el dueño (2026-11-21): mantener login.** Riesgo aceptado hasta el dictamen; LEG-009 sigue N1 y bloqueante. El código de seguimiento por email dentro de 24 h (Disp. 3/2026) es independiente del login y sigue recomendado. Pregunta al asesor: ¿el login cuenta como «paso razonable de verificación de identidad»?
7. **¿Quitás «salvo uso indebido» del reintegro?**
   Puede ser nulo frente a un derecho irrenunciable. **Recomendación:** quitarlo hasta el dictamen.
   **Resuelto por el dueño (2026-11-21): quitarlo.** Reintegro completo dentro de 10 días corridos, sin condición genérica. Cambio en `lib/revocations/copy.ts:18-25` (Ola 0). Como cambia una regla de DR6, actualizar primero `docs/00` (DR6) y `docs/10` §15.
8. **Plazos de retención por categoría.** Definir con el contador. Propuesta inicial: cuentas inactivas 24 meses; preapertura según lo prometido; documentos de estadía 12 meses tras el fin; comprobantes y datos fiscales 10 años (verificar plazo con el contador).
   **Resuelto por el dueño (2026-11-21): aceptada como base.** El contador valida solo el plazo fiscal.

   | Categoría | Plazo | Al vencer |
   |---|---|---|
   | Cuenta inactiva | 24 meses sin ingresar | anonimizar |
   | Documentos de estadía | 12 meses tras el fin de la estadía | borrar |
   | Comprobantes, datos fiscales y fee | 10 años (confirmar con el contador) | borrar |
   | Preapertura | 30 días prometidos (confirmar el disparador) | borrar |
   | `waitlist_signups` | inmediato | borrar |
   | Push revocadas e invitaciones vencidas | 90 días | borrar |
   | Auditoría y logs de acceso | 5 años | borrar |

   Aplicación: plazos en TP-01 §Conservación y en `docs/10` §27 (doc primero); job de purga en la Ola 1.
9. **¿Divulgás por escrito el vínculo de DR45?** **Recomendación:** una línea en /nosotros, redactada con el asesor.
   **Resuelto por el dueño (2026-11-21): por escrito.** Una línea en `/nosotros` o en las condiciones, redactada con el asesor (Ola 2). Complementa DR45; registrarlo en `docs/00` antes de publicarla.
10. **¿Contratás asesor ahora?** **Recomendación:** sí, por bloques (ver brief). Sin asesor, la Ola 0 no se cierra.

### Respuestas del dueño sin asesor (2026-11-21)

El dueño decidió no contratar asesor por ahora. Las respuestas reemplazan, donde choquen, las decisiones anteriores de esta sección. Numeración = LEG-0NN.

| LEG | Respuesta | Efecto |
|---|---|---|
| 001 | Sin enlace a Defensa del Consumidor. El pie muestra los datos del titular y «EstuRed» como nombre de fantasía. | TP-11 se publica con datos reales. Falta: nombre completo, domicilio y emails. El CUIT lo dio el dueño en el chat; no se transcribe en este informe. |
| 002 | Monotributo del titular. Factura C. | Confirma la decisión 2 (A). |
| 003 | Eliminar el pedido de antecedentes penales. | Reemplaza «esperar al asesor». Ola 0, tipo A. |
| 004 | Si no hay solución sencilla, eliminar el registro de menores. El familiar declara al menor y accede al panel del estudiante. | Pendiente de elegir entre «cuenta en espera» y «el familiar opera por el menor». |
| 006 | «Es una transferencia entre particulares.» | **Malentendido:** LEG-006 trata de datos personales alojados fuera de Argentina, no de dinero. Se aplica el plan B: declarar proveedores y países en TP-01 y aceptar los DPA estándar. |
| 009 | Dejar el arrepentimiento como está (con login). | Riesgo aceptado por el dueño. Se recomienda igual el código de seguimiento por email. |
| 010 | «Sí, dejarlo así.» | **Ambiguo:** falta confirmar si se reemplaza la cláusula «bajo ninguna circunstancia» por TP-03. |
| 013 | «No entiendo.» | Explicado en el chat. Pendiente de respuesta. |
| 014 | EstuRed no aprueba datos de cobro; cada residencia responde por los suyos. | **Choca con el código y con DR63:** existe `app/admin/collection-approvals/` y la residencia escribe en `pending_*`. Cambiar requiere actualizar DR63 primero (`docs/13` §5). |
| 016 | Sí: agregar el alcance junto al sello (TP-13). | Ola 0, tipo A. |

**Aclaraciones del dueño (2026-11-21, segunda ronda):**
- 006: OK al plan B (declarar proveedores y países en TP-01; aceptar DPA estándar).
- 010: reemplazar «bajo ninguna circunstancia» por la cláusula de TP-03, con jurisdicción y aviso de cambios.
- 013: OK a publicar TP-04 «Condiciones para residencias» con casilla propia.
- 014: **sacar la aprobación de datos de cobro por el admin.** Cada residencia responde por los datos que carga; debe quedar claro para evitar reclamos. Cambia DR63: actualizar `docs/00` DR63 y `docs/10` §14.5 primero; después quitar `app/admin/collection-approvals/` y el paso `pending_*`; reforzar TP-04 §5 y TP-06 (ya no dicen «EstuRed revisa el formato»).
- 004: cuenta en espera (confirma la decisión 4).

**Aclaraciones del dueño (2026-11-22, tercera ronda, datos del titular):**
- 001: los datos del titular (nombre, CUIT, domicilio, emails) se publican **solo** en `/terms`, sección «Quiénes somos» (`/terms#quienes-somos`). El pie no muestra nombre ni CUIT: enlaza a esa sección («Datos del titular»). `/privacy` y la preapertura remiten a ella. Los comprobantes no suman el nombre. **Desvío de LEG-001 aceptado por el dueño.** Los datos viven solo en `lib/legal/operator.ts`; no se transcriben en docs.
- 001: domicilio publicado = «Ciudad Autónoma de Buenos Aires, Argentina», sin calle ni número. **Riesgo aceptado por el dueño** (Ley 24.240 art. 4 y Ley 25.326 piden un domicilio identificable).
- 001/008: email de contacto y de privacidad = `hola@estured.com` (el mismo). **La casilla todavía no existe** (hallazgo de LEG-001): crearla y probarla antes de abrir; `/privacy` promete respuesta en 10 días corridos y 5 hábiles desde esa casilla. Paso en `docs/PLAN_SALIDA_PRODUCCION.md`.

Sin asesor, los N1 quedan con **riesgo aceptado por el dueño** donde no se aplique el plan B. Este informe no los da por resueltos.

### Ola 0 ajustada (sin asesor)

| # | Ítem | LEG | Doc primero | Esfuerzo |
|---|---|---|---|---|
| 1 | Pie legal con titular, nombre de fantasía y CUIT; `/terms` y `/privacy` sin placeholders | 001 | — | S |
| 2 | Quitar «Antecedentes penales» del catálogo, del perfil y de los requisitos | 003 | `docs/10` §10 | S |
| 3 | Cuenta del menor en espera hasta el consentimiento del familiar; cubrir invitación de residencia | 004 | DR43, `docs/10` §9.1 | L |
| 4 | `/verify` sin nombre si el titular es menor | 005 | — | S |
| 5 | Publicar TP-01 y TP-02 en `/privacy` | 006, 007, 019 | — | S |
| 6 | Quitar «salvo uso indebido»; enviar código de seguimiento por email | 009 | DR6, `docs/10` §15 | M |
| 7 | Reemplazar `/terms:247` y sumar TP-03 (fee manual, precios, jurisdicción, cambios) | 010, 011 | — | S |
| 8 | Versión única con hash de los textos; guardar la casilla del fee | 012 | — | M |
| 9 | Ruta «Condiciones para residencias» (TP-04) con casilla y consentimiento propio | 013 | `docs/20` | M |
| 10 | Quitar la aprobación admin de datos de cobro; TP-06 en la pantalla de pago | 014 | DR63, `docs/10` §14.5 | M |
| 11 | Corregir claims de `/nosotros` y `CostsBoard`; TP-13 junto al sello | 015, 016 | — | S |
| 12 | Rótulo «Ejemplo» en capturas; SEO de preapertura sin «verificadas» | 017 | — | S |
| 13 | MFA admin y confirmación de email en el alta | 025 | — | M |
| 14 | Número de Factura C en la reserva | 002 | — | S |

Datos del dueño que faltan para el ítem 1: nombre completo, domicilio y emails de contacto y privacidad.

## Anexos

### Correcciones a la ficha de contexto (el repo manda)

- **EstuRed sí recibe dinero:** cobra el fee del 5 % por transferencia a una cuenta propia (`payment_settings`, D2). No recibe ni custodia el pago a la residencia (DR63 h).
- **MercadoPago, PayU y TusFacturas no están integrados.** El fee es manual. La Factura C queda en `pending_issue` (`lib/reservations/confirmAfterFeePaid.ts:22-24`).
- **Edad mínima:** DR43 fija 18 años para cuenta propia. El código acepta 14–17 sin tutor en `/register/student` (`app/(public)/register/student/actions.ts:113-117`).
- **Región de datos:** el runbook planea Supabase prod en São Paulo (`docs/PLAN_SALIDA_PRODUCCION.md:74`) y Vercel en iad1, EE. UU. (`:315`, P19-13).
- **Datos sensibles:** hay un tipo de documento «Antecedentes penales» (`lib/residences/stayDocuments.ts:14`). No figuraba en la ficha.
- **Marketing:** no hay emails promocionales. Todo es transaccional (`lib/email/*`).
- **Bot / IA:** no existe. La FAQ es humana (D9). No se envían datos a proveedores de IA.
- **Norma derogada:** la Res. SCI 424/2020 fue derogada por la Disp. SSDCyLC 954/2025 (BO 04-09-2025). `docs/10`, `lib/revocations/copy.ts` y la auditoría previa citan la 424.
- **Norma derogada:** la Ley 22.802 (Lealtad Comercial) fue derogada por el DNU 274/2019. Este informe cita su art. 11.
- **Alta de menores:** fuera de preapertura no existe un alta iniciada por el familiar. El menor crea su cuenta y después invita al familiar (`app/students/family-link-actions.ts:159`). Una residencia también puede invitar a un menor como residente (GAPS.md:392).

### Normas verificadas en fuentes oficiales (2026-11-21)

Solo se consultó el nombre de cada norma. No se enviaron datos del proyecto.

| Norma | Estado verificado | Fuente |
|---|---|---|
| Disp. SSDCyLC 954/2025 (botón de arrepentimiento y de baja) | Vigente. Derogó Res. 424/2020 y Res. 316/2018. Sin registración previa. Excepciones: art. 1116 CCyC y servicio ya usado. | [argentina.gob.ar](https://www.argentina.gob.ar/normativa/nacional/norma-417152/texto) |
| Disp. DNDCyAC 3/2026 | Vigente desde 06-02-2026. Admite pasos razonables solo para verificar identidad. Código de registración de la revocación dentro de 24 h, por el mismo medio. | [Boletín Oficial](https://www.boletinoficial.gob.ar/detalleAviso/primera/338248/20260206) |
| DNU 274/2019 (Lealtad Comercial) | Derogó la Ley 22.802 (art. 72). Publicidad engañosa: art. 11. El prompt citaba la 22.802. | [Boletín Oficial](https://www.boletinoficial.gob.ar/detalleAviso/primera/205888/20190422) |
| Ley 24.240, art. 40 | Responsabilidad solidaria por daño derivado del vicio o riesgo del servicio. No encontré modificación por DNU 70/2023. | [texto actualizado](https://www.argentina.gob.ar/normativa/nacional/norma-638/actualizacion) |
| Disp. DNPDP 10/2008 + Res. AAIP 14/2018 | Leyendas obligatorias. La AAIP reemplaza a la DNPDP como órgano de control (Dec. 899/2017). | [Res. 14/2018](https://www.boletinoficial.gob.ar/detalleAviso/primera/179914/20180309) |
| Disp. DNPDP 60/2016 (mod. Res. AAIP 34/2019) | Lista de países adecuados: UE/EEE, Reino Unido, Suiza, Canadá (privado), Uruguay, Nueva Zelanda, Israel y otros. Brasil y EE. UU. no figuran. Confirmar la lista vigente en la AAIP. | [texto actualizado](https://www.argentina.gob.ar/normativa/nacional/disposici%C3%B3n-60-2016-267922/actualizacion) |
| Res. AAIP 198/2023 | Cláusulas contractuales modelo RIPD. Anexo II: prestación de servicios (responsable → encargado). | [argentina.gob.ar](https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-198-2023-391538/texto) |
| Registro Nacional de Bases de Datos (AAIP) | Trámite gratuito por TAD con clave fiscal. Primero se inscribe el responsable. No vence. | [AAIP](https://argentina.gob.ar/aaip/datospersonales/registrar-bases-privadas) |
| Res. SCI 271/2020 (contratos de adhesión y botón de baja en la web) | No pude confirmar su vigencia actual. Verificar con el asesor. | [Infoleg](https://servicios.infoleg.gob.ar/infolegInternet/anexos/340000-344999/341935/norma.htm) |

No verificado: si sigue exigido un enlace específico a Defensa del Consumidor en el sitio. La Res. 316/2018 fue derogada por la 954/2025. Queda como pregunta al asesor (LEG-001).

### Cobertura de `docs/10` §31 (pendientes críticos)

| §31 | Pendiente | Dónde quedó |
|---|---|---|
| 1 | T&C estudiantes | LEG-010, LEG-011, TP-03 |
| 2 | T&C residencias | LEG-013, TP-04 |
| 3 | Política de Privacidad | LEG-007, TP-01 |
| 4 | Política de Cookies | LEG-019, TP-02 |
| 5 | Reembolsos y Cancelaciones | LEG-009, LEG-010, TP-08 |
| 6 | Botón de arrepentimiento | LEG-009, TP-08 |
| 7 | Factura C y monotributo | LEG-002 |
| 8 | Contrato residencias pioneras / freemium | LEG-013, TP-04 (D8 suspende el cobro de Gestión Operativa) |
| 9 | Datos de menores | LEG-004, LEG-005, TP-07 |
| 10 | Documentos y retención | LEG-003, LEG-023 |
| 11 | Soporte y resolución de conflictos | LEG-014, TP-05. ✅ parcial: «Soporte» se usa bien (`app/(public)/terms/page.tsx:289`) |
| 12 | Antidiscriminación final | LEG-028, LEG-027 |
| 13 | Transferencia internacional | LEG-006 |
| 14 | Copy «Residencia Verificada» | LEG-016, TP-13 |
| 15 | Pagos manuales / MercadoPago / PayU | LEG-002, LEG-011 |
| 16 | 2FA admin «resuelto» | **Divergencia:** el doc lo da por resuelto, pero no está implementado. LEG-025 |
| 17 | «Dólar blue» en textos | LEG-032 |
