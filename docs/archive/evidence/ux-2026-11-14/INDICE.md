# Evidencia del recorrido UX de Codex — 2026-11-14

Registro de estados observados en el navegador local; no equivale a completar todas las transiciones de negocio. `recorridos.json` conserva capturas repetidas; `recorridos-validos.json` conserva el último estado por etiqueta y excluye capturas vacías/transitorias conocidas. Hay capturas manuales adicionales que no están en el registro JSON.

## Recorridos registrados

| Evidencia | Perfil declarado durante el recorrido | URL observada | Ancho CSS |
|---|---|---|---:|
| [02-busqueda-desktop](02-busqueda-desktop.md) | visitante | `/search` | 1280 |
| [03-busqueda-sin-resultados](03-busqueda-sin-resultados.md) | visitante | `/search?hab=Compartida` | 1280 |
| [04-busqueda-mobile](04-busqueda-mobile.md) | visitante | `/search?hab=Compartida` | 375 |
| [05-filtros-mobile](05-filtros-mobile.md) | visitante | `/search?hab=Compartida&genero=solo_mujeres` | 375 |
| [06-vacio-mobile](06-vacio-mobile.md) | visitante | `/search?hab=Compartida&genero=solo_mujeres` | 375 |
| [07-mapa-mobile](07-mapa-mobile.md) | visitante | `/search?vista=mapa` | 375 |
| [08-ficha-visitante-mobile](08-ficha-visitante-mobile.md) | visitante | `/residencias/residencia-norte-demo` | 375 |
| [09-solicitud-visitante-mobile](09-solicitud-visitante-mobile.md) | visitante | `/residencias/residencia-norte-demo` | 375 |
| [10-camila-dashboard-mobile](10-camila-dashboard-mobile.md) | Camila · estudiante en búsqueda | `/students/dashboard` | 375 |
| [11-camila-perfil-mobile](11-camila-perfil-mobile.md) | Camila · estudiante en búsqueda | `/students/profile` | 375 |
| [12-camila-solicitudes-desktop](12-camila-solicitudes-desktop.md) | Camila · estudiante en búsqueda | `/students/applications` | 1280 |
| [13-camila-detalle-vencida-desktop](13-camila-detalle-vencida-desktop.md) | Camila · estudiante en búsqueda | `/students/applications/0e6f33fe-eda2-4161-89de-60069991be44` | 1280 |
| [14-camila-espera](14-camila-espera.md) | Camila · estudiante en búsqueda | `/students/waitlist` | 1280 |
| [15-camila-favoritos](15-camila-favoritos.md) | Camila · estudiante en búsqueda | `/students/favorites` | 1280 |
| [16-camila-soporte](16-camila-soporte.md) | Camila · estudiante en búsqueda | `/students/support` | 1280 |
| [17-camila-estadia](17-camila-estadia.md) | Camila · estudiante en búsqueda | `/students/residency` | 1280 |
| [18-camila-arrepentimiento](18-camila-arrepentimiento.md) | Camila · estudiante en búsqueda | `/students/revocation` | 1280 |
| [19-camila-ficha-desktop](19-camila-ficha-desktop.md) | Camila · estudiante en búsqueda | `/residencias/residencia-norte-demo` | 1280 |
| [21-lucia-dashboard-desktop](21-lucia-dashboard-desktop.md) | Lucía · estudiante alojada | `/students/dashboard` | 1280 |
| [22-lucia-estadia-desktop](22-lucia-estadia-desktop.md) | Lucía · estudiante alojada | `/students/residency` | 1280 |
| [23-lucia-estadia-mobile](23-lucia-estadia-mobile.md) | Lucía · estudiante alojada | `/students/residency` | 375 |
| [25-lucia-renovaciones-mobile](25-lucia-renovaciones-mobile.md) | Lucía · estudiante alojada | `/students/renewals` | 375 |
| [26-lucia-comprobante-mobile](26-lucia-comprobante-mobile.md) | Lucía · estudiante alojada | `/students/receipts/077e9372-0b57-4a3d-a482-1e7fcbc6f54c` | 375 |
| [27-lucia-renovacion-detalle-mobile](27-lucia-renovacion-detalle-mobile.md) | Lucía · estudiante alojada | `/students/renewals/80e21896-f584-4af6-b803-d3b1c856e91f` | 375 |
| [28-valentina-dashboard-mobile](28-valentina-dashboard-mobile.md) | Valentina · estudiante menor | `/students/dashboard` | 375 |
| [29-valentina-perfil-mobile](29-valentina-perfil-mobile.md) | Valentina · estudiante menor | `/students/profile` | 375 |
| [30-valentina-ficha-no-admite-menores](30-valentina-ficha-no-admite-menores.md) | Valentina · estudiante menor | `/residencias/residencia-norte-demo` | 375 |
| [32-martin-propuestas-desktop](32-martin-propuestas-desktop.md) | Martín · familiar vinculado | `/students/family-proposals` | 1280 |
| [31-martin-dashboard-desktop](31-martin-dashboard-desktop.md) | Martín · familiar vinculado | `/students/dashboard` | 1280 |
| [33-martin-dashboard-mobile](33-martin-dashboard-mobile.md) | Martín · familiar vinculado | `/students/dashboard` | 375 |
| [34-martin-mi-estadia](34-martin-mi-estadia.md) | Martín · familiar vinculado | `/students/residency` | 375 |
| [35-ricardo-dashboard-desktop](35-ricardo-dashboard-desktop.md) | Ricardo · dueño de dos residencias | `/residence/dashboard` | 1280 |
| [36-norte-panel-desktop](36-norte-panel-desktop.md) | Ricardo · dueño de dos residencias | `/residence/1c4daf03-e33f-490d-a0c9-c1e46f8bb82e` | 1280 |
| [37-norte-solicitudes-desktop](37-norte-solicitudes-desktop.md) | Ricardo · dueño de dos residencias | `/residence/1c4daf03-e33f-490d-a0c9-c1e46f8bb82e/applications` | 1280 |
| [38-norte-disponibilidad-desktop](38-norte-disponibilidad-desktop.md) | Ricardo · dueño de dos residencias | `/residence/1c4daf03-e33f-490d-a0c9-c1e46f8bb82e/availability` | 1280 |
| [39-norte-disponibilidad-mobile](39-norte-disponibilidad-mobile.md) | Ricardo · dueño de dos residencias | `/residence/1c4daf03-e33f-490d-a0c9-c1e46f8bb82e/availability` | 375 |
| [40-norte-habitaciones-mobile](40-norte-habitaciones-mobile.md) | Ricardo · dueño de dos residencias | `/residence/1c4daf03-e33f-490d-a0c9-c1e46f8bb82e/rooms` | 375 |
| [41-norte-residentes-mobile](41-norte-residentes-mobile.md) | Ricardo · dueño de dos residencias | `/residence/1c4daf03-e33f-490d-a0c9-c1e46f8bb82e/residents` | 375 |
| [43-norte-renovaciones-mobile](43-norte-renovaciones-mobile.md) | Ricardo · dueño de dos residencias | `/residence/1c4daf03-e33f-490d-a0c9-c1e46f8bb82e/renewals` | 375 |
| [44-norte-espera-mobile](44-norte-espera-mobile.md) | Ricardo · dueño de dos residencias | `/residence/1c4daf03-e33f-490d-a0c9-c1e46f8bb82e/waitlist` | 375 |
| [45-norte-preguntas-mobile](45-norte-preguntas-mobile.md) | Ricardo · dueño de dos residencias | `/residence/1c4daf03-e33f-490d-a0c9-c1e46f8bb82e/faq` | 375 |
| [46-norte-reglamento-mobile](46-norte-reglamento-mobile.md) | Ricardo · dueño de dos residencias | `/residence/1c4daf03-e33f-490d-a0c9-c1e46f8bb82e/regulation` | 375 |
| [47-norte-perfil-mobile](47-norte-perfil-mobile.md) | Ricardo · dueño de dos residencias | `/residence/1c4daf03-e33f-490d-a0c9-c1e46f8bb82e/profile` | 375 |
| [48-norte-equipo-mobile](48-norte-equipo-mobile.md) | Ricardo · dueño de dos residencias | `/residence/1c4daf03-e33f-490d-a0c9-c1e46f8bb82e/team` | 375 |
| [49-norte-soporte-mobile](49-norte-soporte-mobile.md) | Ricardo · dueño de dos residencias | `/residence/1c4daf03-e33f-490d-a0c9-c1e46f8bb82e/support` | 375 |
| [50-norte-plan-mobile](50-norte-plan-mobile.md) | Ricardo · dueño de dos residencias | `/residence/1c4daf03-e33f-490d-a0c9-c1e46f8bb82e/plan` | 375 |
| [51-admin-dashboard-desktop](51-admin-dashboard-desktop.md) | Admin operativo | `/admin/dashboard` | 1280 |
| [52-admin-dashboard-mobile](52-admin-dashboard-mobile.md) | Admin operativo | `/admin/dashboard` | 375 |
| [53-residences](53-residences.md) | Admin operativo | `/admin/residences` | 1280 |
| [53-verifications](53-verifications.md) | Admin operativo | `/admin/verifications` | 1280 |
| [53-profile-edits](53-profile-edits.md) | Admin operativo | `/admin/profile-edits` | 1280 |
| [54-solicitudes-alta](54-solicitudes-alta.md) | Admin operativo | `/admin/solicitudes-alta` | 1280 |
| [54-residencias-pedidas](54-residencias-pedidas.md) | Admin operativo | `/admin/residencias-pedidas` | 1280 |
| [54-faq](54-faq.md) | Admin operativo | `/admin/faq` | 1280 |
| [54-custom-amenities](54-custom-amenities.md) | Admin operativo | `/admin/custom-amenities` | 1280 |
| [55-applications](55-applications.md) | Admin operativo | `/admin/applications` | 1280 |
| [55-family-proposals](55-family-proposals.md) | Admin operativo | `/admin/family-proposals` | 1280 |
| [55-payments](55-payments.md) | Admin operativo | `/admin/payments` | 1280 |
| [55-activity](55-activity.md) | Admin operativo | `/admin/activity` | 1280 |
| [56-admin-revocaciones-desktop](56-admin-revocaciones-desktop.md) | Admin operativo | `/admin/activity?tab=revocations` | 1280 |
| [57-admin-revocaciones-mobile](57-admin-revocaciones-mobile.md) | Admin operativo | `/admin/activity?tab=revocations` | 375 |
| [59-actividad-reservations](59-actividad-reservations.md) | Admin operativo | `/admin/activity?tab=reservations` | 1280 |
| [59-actividad-renewals](59-actividad-renewals.md) | Admin operativo | `/admin/activity?tab=renewals` | 1280 |
| [59-actividad-receipts](59-actividad-receipts.md) | Admin operativo | `/admin/activity?tab=receipts` | 1280 |
| [59-actividad-waitlists](59-actividad-waitlists.md) | Admin operativo | `/admin/activity?tab=waitlists` | 1280 |
| [59-actividad-logs](59-actividad-logs.md) | Admin operativo | `/admin/activity?tab=logs` | 1280 |
| [60-followups](60-followups.md) | Admin operativo | `/admin/followups` | 1280 |
| [60-community](60-community.md) | Admin operativo | `/admin/community` | 1280 |
| [60-visibility](60-visibility.md) | Admin operativo | `/admin/visibility` | 1280 |
| [60-pricing](60-pricing.md) | Admin operativo | `/admin/pricing` | 1280 |
| [61-documents](61-documents.md) | Admin operativo | `/admin/documents` | 1280 |
| [61-exchange-rate](61-exchange-rate.md) | Admin operativo | `/admin/exchange-rate` | 1280 |
| [61-users](61-users.md) | Admin operativo | `/admin/users` | 1280 |
| [61-support-cases](61-support-cases.md) | Admin operativo | `/admin/support-cases` | 1280 |
| [62-superadmin-dashboard](62-superadmin-dashboard.md) | SuperAdmin | `/admin/dashboard` | 1280 |
| [63-superadmin-pagos](63-superadmin-pagos.md) | SuperAdmin | `/admin/payments` | 1280 |
| [64-superadmin-cobrados](64-superadmin-cobrados.md) | SuperAdmin | `/admin/payments?tab=paid` | 1280 |
| [65-superadmin-config-cobro](65-superadmin-config-cobro.md) | SuperAdmin | `/admin/payment-settings` | 1280 |
| [66-public-home](66-public-home.md) | Visitante | `/` | 1280 |
| [67-preap-registro](67-preap-registro.md) | Visitante | `/preregistro` | 1280 |
| [68-preap-familiar](68-preap-familiar.md) | Visitante | `/preregistro/familiar` | 1280 |
| [69-fundadoras](69-fundadoras.md) | Visitante | `/fundadoras` | 1280 |
| [70-login](70-login.md) | Visitante | `/login` | 1280 |
| [71-recuperar](71-recuperar.md) | Visitante | `/forgot-password` | 1280 |
| [72-registro](72-registro.md) | Visitante | `/register` | 1280 |
| [74-guias](74-guias.md) | Visitante | `/guias` | 1280 |
| [75-recheck-para-estudiantes](75-recheck-para-estudiantes.md) | Visitante | `/for-students` | 1280 |
| [76-para-residencias](76-para-residencias.md) | Visitante | `/for-residences` | 1280 |
| [77-guia-detalle](77-guia-detalle.md) | Visitante | `/guias/como-elegir-residencia-estudiantil-buenos-aires` | 1280 |
| [78-verificar](78-verificar.md) | Visitante | `/verify` | 1280 |
| [79-terminos](79-terminos.md) | Visitante | `/terms` | 1280 |
| [80-privacidad](80-privacidad.md) | Visitante | `/privacy` | 1280 |
| [81-valentina-recheck](81-valentina-recheck.md) | Valentina (menor vinculada) | `/students/dashboard` | 1280 |
| [82-valentina-edad](82-valentina-edad.md) | Valentina (menor vinculada) | `/residencias/residencia-norte-demo` | 1280 |
| [83-pregunta-pendiente-recheck](83-pregunta-pendiente-recheck.md) | Ricardo (dueño) | `/residence/1c4daf03-e33f-490d-a0c9-c1e46f8bb82e/faq` | 375 |
| [87-perfil-residencia-recheck](87-perfil-residencia-recheck.md) | Ricardo (dueño) | `/residence/1c4daf03-e33f-490d-a0c9-c1e46f8bb82e/profile` | 375 |
| [89-familiar-residencia-recheck](89-familiar-residencia-recheck.md) | Martín (familiar) | `/students/residency` | 375 |
| [91-admin-comunidad-mobile](91-admin-comunidad-mobile.md) | Admin operativo | `/admin/community` | 375 |
| [93-admin-solicitudes-recheck](93-admin-solicitudes-recheck.md) | Admin operativo | `/admin/applications` | 1280 |
| [95-mi-lugar-cuenta-existente](95-mi-lugar-cuenta-existente.md) | Camila (estudiante en búsqueda) | `/mi-lugar` | 1280 |
| [96-fundadoras-formulario](96-fundadoras-formulario.md) | Visitante | `/fundadoras/datos` | 1280 |
| [97-consentimientos](97-consentimientos.md) | Camila (estudiante en búsqueda) | `/consentimientos` | 1280 |
| [98-verificacion-publica-comprobante](98-verificacion-publica-comprobante.md) | Visitante | `/verify/2dd7beb0-6bd6-4538-9cdd-97da333bf352` | 1280 |
| [99-comunidad-visitante](99-comunidad-visitante.md) | Visitante | `/residencias/residencia-norte-demo/comunidad` | 1280 |
| [100-ficha-tipos-completos](100-ficha-tipos-completos.md) | Camila (estudiante en búsqueda) | `/residencias/wanna-tango` | 1280 |
| [101-lista-espera-formulario](101-lista-espera-formulario.md) | Camila (estudiante en búsqueda) | `/residencias/wanna-tango` | 1280 |

## Exclusiones de lectura

| Etiqueta | Motivo |
|---|---|
| `31-martin-dashboard-mobile` | captura sin contenido durante navegación |
| `90-familiar-dashboard-recheck` | captura sin contenido durante navegación |
| `73-para-estudiantes` | 404 transitorio; resultado válido revalidado en 75-recheck-para-estudiantes |

- `03-busqueda-sin-resultados-desktop` conserva un nombre preliminar: para demostrar cero resultados usar `05-filtros-mobile` / `06-vacio-mobile` según los archivos disponibles.
- `/students/family-proposals` se abrió directamente como familiar y devolvió 404: control de acceso/contexto, no enlace roto observado ni pantalla funcional auditada.
- Las sesiones y los datos de prueba compartidos cambiaron mientras corrían tests de otra sesión. El informe distingue esas interferencias de los hallazgos reproducibles.
