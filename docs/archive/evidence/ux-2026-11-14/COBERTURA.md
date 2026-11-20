# Cobertura y límites de la auditoría UX — 2026-11-14

## Alcance real

- Siete usuarios demo: Camila, Lucía, Valentina, Martín, Ricardo, Admin Operativo y SuperAdmin; además visitante.
- Escritorio de 1280 × 900 y móvil emulado de 375 × 812. No se probó hardware físico ni todos los dispositivos.
- 80 URLs distintas con contenido observado (incluyen filtros, pestañas y un control 404). Las rutas dinámicas se probaron con ejemplos, no con todos los registros.
- 106 estados registrados válidos por etiqueta. Se suman archivos manuales de formularios/capturas. Abrir una pantalla no acredita haber completado sus envíos.
- Inventario estático: 94 archivos `page.tsx`. El conteo no es comparable uno a uno con URLs: hay aliases, rewrites y detalles que también se muestran dentro de paneles.

## Inventario por ruta

| Ruta de página | Estado de cobertura |
|---|---|
| `/consentimientos` | Recorrido en navegador |
| `/fundadoras/datos` | Recorrido en navegador |
| `/fundadoras` | Recorrido en navegador |
| `/mi-lugar` | Recorrido en navegador |
| `/preapertura` | Sin recorrido directo registrado |
| `/preregistro/familiar` | Recorrido en navegador |
| `/preregistro` | Recorrido en navegador |
| `/preregistro/perfil` | Destino recorrido; alias inspeccionado en código |
| `/for-residences` | Recorrido en navegador |
| `/for-students` | Recorrido en navegador |
| `/forgot-password` | Recorrido en navegador |
| `/guias/[slug]` | Recorrido en navegador |
| `/guias` | Recorrido en navegador |
| `/login` | Recorrido en navegador |
| `/` | Recorrido en navegador |
| `/privacy` | Recorrido en navegador |
| `/register/family` | Destino recorrido; alias inspeccionado en código |
| `/register` | Recorrido en navegador |
| `/register/residence/invitacion/[token]` | Pendiente de invitación/token válido |
| `/register/residence` | Sin recorrido directo registrado |
| `/register/staff/[token]` | Pendiente de invitación/token válido |
| `/register/student` | Destino recorrido; alias inspeccionado en código |
| `/reset-password` | Sin recorrido directo registrado |
| `/residencias/[slug]/comunidad` | Recorrido en navegador |
| `/residencias/[slug]` | Recorrido en navegador |
| `/residencias` | Destino recorrido; alias inspeccionado en código |
| `/search` | Recorrido en navegador |
| `/terms` | Recorrido en navegador |
| `/verify/[verification_code]` | Recorrido en navegador |
| `/verify` | Recorrido en navegador |
| `/admin/activity` | Recorrido en navegador |
| `/admin/applications` | Recorrido en navegador |
| `/admin/community` | Recorrido en navegador |
| `/admin/custom-amenities` | Recorrido en navegador |
| `/admin/dashboard` | Recorrido en navegador |
| `/admin/documents` | Recorrido en navegador |
| `/admin/exchange-rate` | Recorrido en navegador |
| `/admin/family-proposals` | Recorrido en navegador |
| `/admin/faq` | Recorrido en navegador |
| `/admin/followups` | Recorrido en navegador |
| `/admin/logs` | Sin recorrido directo registrado |
| `/admin/negotiations` | Pendiente de estado demo específico |
| `/admin/payment-settings` | Recorrido en navegador |
| `/admin/payments` | Recorrido en navegador |
| `/admin/pricing` | Recorrido en navegador |
| `/admin/profile-edits` | Recorrido en navegador |
| `/admin/receipts` | Destino recorrido; alias inspeccionado en código |
| `/admin/renewals` | Destino recorrido; alias inspeccionado en código |
| `/admin/reservations` | Destino recorrido; alias inspeccionado en código |
| `/admin/residences/[id]` | Sin recorrido directo registrado |
| `/admin/residences` | Recorrido en navegador |
| `/admin/residencias-pedidas` | Recorrido en navegador |
| `/admin/revocations` | Destino recorrido; alias inspeccionado en código |
| `/admin/solicitudes-alta` | Recorrido en navegador |
| `/admin/support-cases` | Recorrido en navegador |
| `/admin/users` | Recorrido en navegador |
| `/admin/verifications` | Recorrido en navegador |
| `/admin/visibility` | Recorrido en navegador |
| `/admin/waitlists` | Destino recorrido; alias inspeccionado en código |
| `/residence/[residence_id]/applications/[id]/negotiation` | Pendiente de estado demo específico |
| `/residence/[residence_id]/applications/[id]` | Sin recorrido directo registrado |
| `/residence/[residence_id]/applications` | Recorrido en navegador |
| `/residence/[residence_id]/availability` | Recorrido en navegador |
| `/residence/[residence_id]/faq` | Recorrido en navegador |
| `/residence/[residence_id]` | Recorrido en navegador |
| `/residence/[residence_id]/plan` | Recorrido en navegador |
| `/residence/[residence_id]/profile` | Recorrido en navegador |
| `/residence/[residence_id]/regulation` | Recorrido en navegador |
| `/residence/[residence_id]/renewals/[id]` | Sin recorrido directo registrado |
| `/residence/[residence_id]/renewals` | Recorrido en navegador |
| `/residence/[residence_id]/residents` | Recorrido en navegador |
| `/residence/[residence_id]/rooms` | Recorrido en navegador |
| `/residence/[residence_id]/support` | Recorrido en navegador |
| `/residence/[residence_id]/team` | Recorrido en navegador |
| `/residence/[residence_id]/waitlist` | Recorrido en navegador |
| `/residence/dashboard` | Recorrido en navegador |
| `/residence/settings/new` | Sin recorrido directo registrado |
| `/students/applications/[id]/fee` | Pendiente de estado demo específico |
| `/students/applications/[id]/negotiation` | Pendiente de estado demo específico |
| `/students/applications/[id]` | Recorrido en navegador |
| `/students/applications` | Recorrido en navegador |
| `/students/dashboard` | Recorrido en navegador |
| `/students/family-proposals` | Control 404 con familiar; contenido pendiente |
| `/students/favorites` | Recorrido en navegador |
| `/students/followup/[id]` | Pendiente de estado demo específico |
| `/students/profile` | Recorrido en navegador |
| `/students/receipts/[id]` | Recorrido en navegador |
| `/students/renewals/[id]` | Recorrido en navegador |
| `/students/renewals` | Recorrido en navegador |
| `/students/residency/invite` | Pendiente de invitación/token válido |
| `/students/residency` | Recorrido en navegador |
| `/students/revocation` | Recorrido en navegador |
| `/students/support` | Recorrido en navegador |
| `/students/waitlist` | Recorrido en navegador |

## Conteos del inventario

| Estado | Cantidad |
|---|---:|
| Recorrido en navegador | 68 |
| Sin recorrido directo registrado | 8 |
| Destino recorrido; alias inspeccionado en código | 9 |
| Pendiente de invitación/token válido | 3 |
| Pendiente de estado demo específico | 5 |
| Control 404 con familiar; contenido pendiente | 1 |

## Pruebas que siguen pendientes

- Altas y consentimientos finales; email real, invitaciones y restablecimiento efectivo de contraseña. Se inspeccionaron formularios, sin aceptar acuerdos ni crear cuentas.
- Solicitud enviada → respuesta → ajuste → pago a residencia → fee → reserva: se inspeccionaron entradas e historiales disponibles, sin crear un caso nuevo ni registrar pagos.
- Ofertas de renovación abiertas y vencimientos con datos de hoy; cola/lista de espera con respuestas corriendo; confirmaciones de familiares de menores.
- Staff con permisos granulares: no aparece en el selector demo actual. La documentación enumera ocho usuarios; la UI disponible expone siete.
- Subida/borrado de archivos, reordenamiento de fotos, acciones de moderación, bloqueo de usuarios y cambios de equipo/permisos.
- Lectores de pantalla reales, zoom 200–400 %, navegadores Safari/Firefox, teclado virtual móvil, redes lentas y rendimiento de producción.
- Producción no recorrida. La navegación fue local y el contexto fue desarrollo.

## Evidencia principal

Consultar [índice de estados](INDICE.md), [registro JSON](recorridos-validos.json) y el [informe principal](../../AUDITORIA_UX_RECORRIDO_CODEX_2026-11-14.md).
