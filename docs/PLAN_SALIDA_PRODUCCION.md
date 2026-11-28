# EstuRed — Runbook de salida a producción

**Reescrito el 2026-11-13.** Ruta: **proyecto Supabase nuevo y limpio (B1)** + **dominio `estured.com` (comprado en Hostinger)** + Vercel. Lo que había de la ruta anterior (conservar `estured-prod` y aplicar 0036–0055 una por una) se borró de este archivo; queda en el historial de git.

Cómo se usa: cada paso dice **quién lo hace**: **[Vos]** (dashboards, cuentas, claves: yo no tengo ni debo tener acceso) o **[Yo]** (código y repo). Se avanza en orden y se tilda. Ningún paso se ejecuta solo, y **nada de esto se hizo todavía**. Regla: este runbook se actualiza cada vez que un cambio agrega un paso o una variable.

Estado del código (2026-11-13): rama `hardening/pre-produccion-2026-11`, migraciones **0001–0099 (+0043b)** (100 archivos; estado al 2026-11-19, ver D1), auditoría de seguridad final sin críticos ni altos (`docs/audits/PLAN_SEGURIDAD_2026-11-12.md`). `origin/main` (`fbermani/estured-claude`) está ~200 commits atrás y **deploya solo a Vercel al hacer push**.

---

## Paso 0. Salida por etapas: preapertura mínima, campaña y app en paralelo (decidido 2026-11-21)

**Decisión del dueño.** Es un MVP y la primera ventana grande de búsqueda ya está abierta. No se espera a que todo esté perfecto: se sale con lo mínimo y se ajusta con datos reales. Las entrevistas con residencias van a cambiar la app, así que definir todo ahora no sirve.

**Estrategia (ya documentada, no se reabre):** `docs/23_PREAPERTURA.md`, `docs/00` DR42–DR47 y `marketing/instagram/ESTRATEGIA_INSTAGRAM.md`. Los estudiantes atraen a las residencias. No hay contacto en frío a residencias. Los registros y los contadores reales de estudiantes son el argumento para que las residencias fundadoras lleguen solas.

### Estado real al 2026-11-25 (verificado por MCP)

- **Hecho:** Supabase prod viejo dado de baja (A0.1). `hola@estured.com` confirmada (A4). **C3:** Resend con `estured.com` *Verified* (`sa-east-1`) y registros DNS en Hostinger. **F1 (DNS):** `estured.com` ya apunta a Vercel (A `216.198.79.1` y `64.29.17.1`; `www` CNAME). **C1:** widget `EstuRed prod` creado en Cloudflare (`estured.com` y `www`, *Managed*). **LEG-001:** datos del titular en `lib/legal/operator.ts`.
- **Variables de Production ya cargadas en Vercel:** `EMAIL_FROM`, `EMAIL_DOMAIN_VERIFIED=true`, `RESEND_API_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, VAPID (par propio de Production), `VAPID_SUBJECT`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL`, `PREAPERTURA=on`, `GEOCODER_USER_AGENT`.
- **Proyecto nuevo:** `estured-prod`, ref `hioscbefryufsbypsmtx` (creado 2026-11-25). `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` de Production ya apuntan ahí.
- `SUPABASE_SERVICE_ROLE_KEY` de Production actualizada por el dueño (2026-11-25).
- **Base creada** (D1, control del 2026-11-25). Región confirmada: São Paulo (`sa-east-1`).
- **Hecho el 2026-11-25:** buckets (D2); URLs y registro público apagado (D3).
- **Faltan:** secreto del cron en Vault (D1), SMTP y plantilla de mail (D3), merge a `main` y deploy (F2), `NEXT_PUBLIC_META_PIXEL_ID` (cargada el 2026-11-27).
- ⚠ **`estured.com` hoy sirve el deploy viejo de `main`** (Ciclo 30bis, abierto y sin base). Se reemplaza en F2. No hay datos reales en riesgo (la base vieja ya no existe).

### Etapas

1. **Etapa 1 — Cimientos legales y técnicos (antes de gastar en anuncios).**
2. **Etapa 2 — Instagram (puede avanzar en paralelo con la 1).**
3. **Etapa 3 — Producción mínima con `PREAPERTURA=on`.** Solo el popup, la landing y `/fundadoras`. El popup no se cierra.
4. **Etapa 4 — Test de anuncios, una semana, gasto bajo.**
5. **Etapa 5 — Campaña fuerte, solo con datos del test.**
6. **En paralelo, todo el tiempo — App, dashboards y flujos en `staging`.** No pasa a producción hasta cumplir la sección I. Producción solo recibe lo del Paso 0 más fixes.

### Etapa 1 — Cimientos (bloquean la Etapa 4)

- [ ] **Textos legales mínimos publicados** en `/terms`, `/privacy` y `/consentimientos` (partir de `docs/audits/TEXTOS_LEGALES_PROVISORIOS_2026-11-21.md`). Meta exige política de privacidad visible y se captan datos personales (Ley 25.326). Riesgo de no validar con abogado: asumido por el dueño (DR45); aun así, los textos tienen que existir y estar enlazados desde el popup.
- [x] **Links legales visibles dentro del popup no cerrable.** Que no se pueda cerrar no puede ocultar Términos ni Privacidad. Visto en producción el 2026-11-25: `/preregistro` los muestra junto a la casilla; la primera pantalla del popup no tiene ninguno (confirmado en el DOM: solo están en el pie, inerte detrás del popup). Con el pixel cargado, el aviso de cookies muestra «Privacidad» arriba mientras no se elija; «Términos» sigue sin verse. El bloqueo antes de la Etapa 4 es criterio nuestro: no se confirmó contra una regla oficial de Meta. **Resuelto en `staging` el 2026-11-25** (DR67 (i): enlaces al pie de la entrada y de fundadoras). **Publicado y verificado en `estured.com` el 2026-11-26** (`463f165`): «Términos» y «Privacidad» visibles en la primera pantalla (1280×900 y 375×812) y `/consentimientos` responde 200 con las dos anclas. La pantalla de fundadoras no se revisó en prod.
- [ ] **Datos del responsable legal** en la política de privacidad (pendiente en `docs/23` §9).
- [x] **Proyecto Supabase de producción** con bootstrap (D1–D3). Mínimo para preapertura: tablas de preinscriptos y de solicitudes de residencias, Auth y buckets necesarios. Mínimo cumplido el 2026-11-25; quedan abiertos puntos de D1 y D3.
- [ ] **Mails** (C3, A4): `hola@estured.com` leída por alguien y Resend con SPF/DKIM. Sin esto no hay confirmación del preregistro ni mail a fundadoras.
- [x] **Variables de Vercel** (E) con `PREAPERTURA=on`. Sin `DEMO_LOGIN_ENABLED`. Hecho el 2026-11-25.
- [ ] **Medición.** Pixel de Meta y eventos: `PageView`, preregistro completado (estudiante y familiar), solicitud de fundadora. Verificar el dominio en el Business Manager. Cargar el pixel con consentimiento y sin enviar datos personales en claro. **[Yo]** el código; **[Vos]** las cuentas de Meta.
  - Código listo (2026-11-22); `NEXT_PUBLIC_META_PIXEL_ID` cargada en Production el 2026-11-27. Falta verificar dominio en Meta **[Vos]**.
  - Aviso de cookies hecho (2026-11-22); el pixel carga solo con consentimiento.
  - Visto en `estured.com` el 2026-11-26: sin ID no hay aviso, `fbq` ni orígenes de Meta en la CSP (esperado).
  - Contradicción de cookies en `/privacy` corregida en `staging` (aprobada el 2026-11-26).
  - Dueño (2026-11-26): dominio, Instagram con Página de Facebook y `hola@` listos. La Página y el Instagram están en el portfolio «estured.residencias» (`1504579908242494`), administrado desde otro perfil personal de Facebook. El portfolio «EstuRed», creado el mismo día, queda vacío: no se usa ni se borra por ahora.
  - Dos cuentas publicitarias de ese perfil están desactivadas desde 2020 (`10153869134495646`, personal, con saldo pendiente; `335648627820048`, en otro portfolio), sin revisión posible. Meta indica usar otra cuenta publicitaria. Perfil revisado: sin restricción visible sobre el usuario. Riesgo avisado: el dueño tiene dos perfiles personales y Meta pide uno solo.
  - [x] **[Vos]** (2026-11-26) Cuenta publicitaria «EstuRed Ads» creada en «estured.residencias», en dólares, sin medio de pago cargado desde esta guía. Zona horaria confirmada por el dueño.
  - [x] **[Vos]** (2026-11-26) Conjunto de datos «EstuRed Web» creado en «estured.residencias»: ID `1040608202386342`.
  - [x] **[Vos]** (2026-11-26) Coincidencia avanzada automática y registro automático de eventos apagados (informado por el dueño).
  - [x] **[Vos]** (2026-11-27) «EstuRed Web» conectado con «EstuRed Ads» (informado por el dueño).
  - [x] **[Yo]** (2026-11-26) El código apaga la configuración automática del Pixel (`autoConfig`), commit `e8c2616` en `staging`.
  - [x] **[Vos]** (2026-11-26) `e8c2616` publicado en `main` (pixel y texto de `/privacy`). Deploy `dpl_eBUpYi8vF5gu8vVeUtEfZoYnWpZ3` listo. Verificado en `estured.com`: `/`, `/preregistro`, `/fundadoras`, `/terms` y `/privacy` en 200, texto nuevo de cookies, CSP sin Meta (sin ID).
  - [x] **Antes de cargar el ID** (publicado el 2026-11-27 como `4f82924`): publicar en `main` `5761e4c` (sin pixel en `?invitacion=`) y `8a2c037` (sin pixel en cuentas de menores). Los dos en `staging` (2026-11-27). Debajo y en el medio hay commits de otras sesiones (`038f5dd` DR72, `e78a6be` mails): publicar todo con ellos listos, o rama desde `main` (ver «Publicar cambios», paso 4).
  - [x] **[Vos]** (2026-11-27) Meta no mide a menores invitados. Hecho en `8a2c037`; validado con typecheck y build con un ID de prueba. Visitantes sin sesión: edad desconocida, se miden si aceptan.
  - [ ] **Con el ID cargado:** alta de un menor invitado de prueba, aceptar cookies y confirmar que `/mi-lugar` no hace pedidos a `facebook.com/tr`.
  - [x] **[Vos]** (2026-11-27) Conector oficial de Meta conectado. Verificado por el conector (solo lectura): solo aparece el portfolio «estured.residencias»; «EstuRed Ads» activa, USD, zona Buenos Aires, sin medio de pago, sin gasto; «EstuRed Web» activo y conectado a la cuenta, coincidencia avanzada apagada, sin reglas de eventos, nunca recibió eventos; Instagram `estured.residencias` y Página «EstuRed» enlazados. No verificable por el conector: el ajuste «registrar eventos sin código».
  - [ ] **[Vos]** La cuenta personal vieja (`10153869134495646`, desactivada por actividad inusual) figura con medio de pago: revisarlo y quitarlo si no corresponde.
  - [x] **[Vos]** (2026-11-27) Texto sobre Meta aprobado y aplicado: `40281fc` en `staging`, `PREAPERTURA_LEGAL` = `2026-11-27`. Sin validación de abogado.
  - [x] (2026-11-27, SQL solo lectura en prod) 0 estudiantes y familiares de preapertura; 1 solicitud de residencia (la «prueba» del 26): no hay registrados reales a quienes avisar el cambio. Volver a contar antes de publicar.
  - [x] **[Vos]** (2026-11-27, decidido: solo lo de Meta) `git push origin 4f82924:main` hecho; deploy `dpl_GbQy8zGuGpYsDrir8j6kdGQRTZi2`. Rama local `publicar/meta-2026-11-27` = `main` + `5761e4c`, `8a2c037`, `40281fc` (`83f2d35`, `a50398e`, `4f82924`). Validada: 78 tests, lint, typecheck, build con y sin ID. Recuento previo: 0 preregistrados, 1 residencia de prueba. No trae `038f5dd`, `e78a6be` ni `93a8758`.
  - [x] **[Yo]** (2026-11-27) `main` mergeada en `staging` (`999379d`, sin cambios de contenido) y pusheada.
  - [x] **[Yo]** (2026-11-27) Verificado en `estured.com` tras publicar `4f82924`: `/`, `/preregistro`, `/fundadoras`, `/terms` y `/privacy` en 200; texto sobre Meta y fecha 27/11 visibles; CSP sin Meta y sin `fbevents` (sin ID).
  - [x] **[Yo]** (2026-11-27, tras publicar, SQL solo lectura en prod) 0 estudiantes y familiares; 2 solicitudes de residencia, la última del 27/11 a las 01:19 (Argentina).
  - [x] **[Vos]** (2026-11-27) La segunda solicitud de residencia es una prueba del dueño: no hay registrados reales a quienes avisar el cambio de `/privacy`.
  - [x] **[Vos]** (2026-11-27) OK dado. **[Yo]** `NEXT_PUBLIC_META_PIXEL_ID=1040608202386342` cargada solo en Production; redeploy de `4f82924` (`dpl_d1mM7oYXfgwnUeSHCkxBRMCKZCHB`) listo en `estured.com`. Vuelta atrás: borrar la variable y redeploy.
  - [x] **[Yo]** (2026-11-27) Prueba en `estured.com`: las cinco páginas en 200; antes de aceptar, cero pedidos a Meta; al aceptar, `fbevents.js`, configuración y un `PageView`, sin parámetros `ud`/`udff`; tras clics en dos controles sin envíos extra; con `?invitacion=` (token falso) y cookies aceptadas, cero pedidos. Meta registra el disparo (`last_fired_time` 27/11 09:36 Argentina); las estadísticas todavía vacías.
  - Observado (2026-11-27): un `PageView` por carga completa y ninguno al cambiar de pantalla sin recargar. Causa: `lib/analytics/metaPixel.ts` apaga el aviso automático (`disablePushState`) para contar a mano, y el script de Meta descarta el `PageView` manual repetido (`allowDuplicatePageViews` apagado). Los públicos por página van a contar de menos. Arreglo publicado el 2026-11-27 (`8ef6faf`), ver más abajo. Vuelta atrás tras publicar: revertir `8ef6faf` en `main` y redeploy.
  - [x] **[Vos]** (2026-11-27 10:48) Alta de estudiante de prueba en prod. **[Yo]** 1 estudiante en `preapertura_estudiantes`; sin errores de ejecución en los logs. El estudiante no recibe mail: la bienvenida sigue solo en `staging`. Es una cuenta de prueba: ocupa un número de registro y borrarla la decide el dueño.
  - [x] **Primera alta, sin evento (superada por la tercera):** `CompleteRegistration` del alta (a las 10:52 Meta mostraba solo los 3 `PageView` de las 09:00; último disparo 09:36). No llegó ni la visita, así que el Pixel no cargó en el dispositivo del alta (causa probable, no confirmada: cookies sin aceptar o bloqueador). El Chrome del dueño no tiene esa sesión; ahí el Pixel envía `PageView` con cookies aceptadas (10:55). Repetir con otro email, cookies aceptadas antes y pedidos del navegador a la vista.
  - [x] **Segunda alta, sin evento (12:08, superada por la tercera):** 2 estudiantes de prueba en prod; sin errores en logs. Ese dispositivo abrió `/` (12:08:03) y `/preregistro` (12:08:11) sin sesión y Meta no recibió ni la visita: ahí el Pixel no cargó y el camino del registro sigue sin probar. El Chrome del dueño no tiene esa sesión. Sin mail: producción sigue en `4f82924`, sin la bienvenida. A las 12:23 no había una tercera alta (la pestaña preparada quedó sin usar). Para repetir: Chrome de la compu sin incógnito (cookies ya aceptadas), `estured.com/preregistro`, otro email; confirmar en Meta.
  - [x] **Compuerta cumplida (2026-11-27):** `CompleteRegistration` de estudiante visto en Meta; ya se puede usar para medir registros.
  - [ ] **Sin probar:** `Lead`, alta de familiar y menor invitado. Confirmar con pedidos del navegador que en el alta no viaja nada más.
  - [ ] **[Yo]** Confirmar los eventos en las estadísticas de «EstuRed Web» (confirmados `PageView` y `CompleteRegistration`; falta `Lead`).
  - [x] **[Yo]** (2026-11-27) CI de `staging` en verde otra vez (`5a1549b`, corrida #112). Fallaba desde `d5883f9` por una etiqueta faltante; arreglo en `ebe3fb8`.
  - [x] **[Yo]** (2026-11-27, con OK del dueño) Borradas por SQL Editor de prod las 2 cuentas de estudiante de prueba (números 11 y 12) para reusar sus emails. Verificado: 0 cuentas, identidades, usuarios, roles, perfiles, visibilidad, filas de preapertura y consentimientos. Quedan las filas de auditoría; sin fila que registre el borrado. Reemplaza los conteos de estudiantes de arriba. Al borrar, producción quedó sin ninguna cuenta, tampoco admin.
  - [x] **[Yo]** (2026-11-27 19:11) Tercera alta (18:42:36, número 13) confirmada: Chrome de la compu del dueño, cookies aceptadas. La franja de las 18 h de «EstuRed Web» trae 2 `PageView` y 1 `CompleteRegistration`. Vuelve a haber 1 cuenta de prueba. `last_fired_time` quedó en 18:42:07 pese al evento posterior: no sirve para descartar un evento; usar las estadísticas (demora observada: más de 6 minutos).
  - [x] **[Vos]** (2026-11-27) OK dado («como tu digas» sobre la recomendación). **[Yo]** Apagado «Incluir automáticamente información más detallada de las páginas y los productos» en «EstuRed Web»; confirmado «Desactivado» tras recargar. Meta advierte que puede afectar el rendimiento de los anuncios. Vuelta atrás: el mismo interruptor en Configuración. Antes estaban activos sus tipos de datos (página, multimedia, contacto y ubicación, evento y viaje, clasificación). El archivo público del pixel no cambió al momento: efecto en el navegador sin comprobar. «Configuración básica» desactivada y sin categoría; «Medir conversiones en los dispositivos» sigue activado (sin decidir).
  - [x] **[Yo]** (2026-11-27, con OK del dueño) Visitas por pantalla arregladas en `staging`: `8ef6faf` (base `main` `150c334`, 2 archivos), merge `d482163`. El Pixel permite el `PageView` repetido (`allowDuplicatePageViews`, sin documentación de Meta) y mantiene apagado el envío automático. Probado antes en `estured.com`, solo en una pestaña: sin el ajuste no contaba `/fundadoras` al llegar sin recargar; con él sí, con la ruta en `dl`. Con `?invitacion=` (token falso): cero pedidos al cargar y al volver atrás; ningún envío observado llevó el token. La prueba sumó algunas visitas propias. Validado: typecheck, tests de `lib/analytics` (26), build del commit y del merge, lint de esas carpetas. Sin probar: CI de `staging`. Riesgo sin cubrir: un menor que inicia sesión en otra pestaña ya abierta podría contarse al navegar en la anterior.
  - [x] **[Vos]** (2026-11-27) Publicado: `git push origin 8ef6faf:main` (`150c334..8ef6faf`). **[Yo]** Deploy `dpl_5LTsCQdttzcXBS76YNu68AKo6Kp4` *Ready* en `gru1`, alias `estured.com`; ocho páginas públicas en 200; sin errores de ejecución en los primeros minutos. En `estured.com`, sin tocar nada: un `PageView` por pantalla (`/`, `/fundadoras`, `/`) al navegar sin recargar; con `?invitacion=` (token falso) cero pedidos al cargar y al volver atrás; ningún envío observado llevó el token. `staging` ya contiene `main`. Vuelta atrás: promover `dpl_ApeXsq5Dv785uCc3epjW64MVpLPM` o revertir `8ef6faf`.
  - [ ] Antes de armar públicos por pantalla: confirmar que Meta distinga las rutas (sus estadísticas por URL muestran solo el dominio).
  - [ ] **API de Conversiones:** Administrador de eventos ofrece «Conectar» con un clic (no se tocó). Decidir antes de aceptar; revisar `/privacy`.
  - [x] Mail de bienvenida en producción: publicado el 2026-11-27 (`89f8544` y `150c334`, ver «mails»). Falta ver la bienvenida real con un alta.
  - [ ] **Antes de las campañas:** borrar las cuentas de prueba nuevas y reiniciar `preapertura_registro_seq` en 11, solo si no hay estudiantes reales. El próximo registro recibiría el 14. Lo decide el dueño.
- [ ] **Medición sin Meta:** parámetros UTM guardados con cada preregistro, para saber qué pieza trae a quién.
- [ ] **Secuencia de nutrición** para los preregistrados (mails 1 a 3 en las primeras semanas): confirmación, qué pasa ahora, contenido útil de las guías. Sin promesas de disponibilidad ni de match. Un lead sin contacto en semanas se enfría.
- [ ] **Estado real de la preapertura en `MEMORY.md`** con los contadores en cero y la fecha de cierre de fundadoras decidida (A5).

### Etapa 2 — Instagram

- [ ] Cuenta profesional, bio, destacadas y la tanda base de 12 piezas publicada (`marketing/instagram/ESTRATEGIA_INSTAGRAM.md` §2–§4). Meta Ads arranca **después** de las 12 piezas.
  - Aprobado 2026-11-25: 12 piezas (3 fijadas) y 29 historias de destacadas. Producción: una pieza por chat (`marketing/instagram/PRODUCCION.md`). Publicar cuando el link de la bio abra el popup en producción.
  - Pendiente de medición: `/guias` no captura UTM ni carga el pixel (solo `app/(preapertura)/layout.tsx`). Resolver antes de medir links a guías.
- [ ] Regla vigente: ningún post nombra residencias ni muestra precios.
- [ ] Enlace de la bio: `estured.com`, sin UTM (decisión del dueño, 2026-11-26; las altas por la bio no se miden).
- [ ] Rutina de interacción diaria (§5.2). Es la actividad que no se negocia: primero Instagram, después la app.

### Etapa 3 — Producción mínima

Se ejecuta con las secciones A a G de este runbook, con este alcance recortado:

- [x] A1 ya decidido: `PREAPERTURA=on` en producción. Publicado el 2026-11-25.
- [ ] A3, A4, A5, C, D, E y F completas (dominio `estured.com`, DNS de Hostinger hacia Vercel en F2).
- [ ] G completa. Obligatorio: admin real, anon key sin exposición, Advisors, CAPTCHA y límites, mails de punta a punta, smoke test de preregistro (estudiante y familiar) y de solicitud de fundadora.
- [ ] Un solo código para staging y producción. La diferencia es solo la variable `PREAPERTURA`. Nada de ramas paralelas.
- [ ] **Regla de merge:** a `main` solo entra lo que ya pasó por `staging` y no cambia el comportamiento de la preapertura. Lo demás espera a la sección I.
- [ ] Tope de gasto, alertas y WAF (sección «Costos y abuso»): activos antes de la campaña.

### Etapa 4 — Test de anuncios (una semana)

- [ ] Presupuesto bajo y fijo, definido por el dueño antes de empezar. Tope diario por escrito.
- [ ] 3 a 5 ángulos distintos de copy y pieza, todos con mensaje honesto: gratis, sin promesa de disponibilidad.
- [ ] Una sola conversión: preregistro completado. Público: estudiantes y familias que buscan alojamiento en Buenos Aires.
- [ ] Cuenta publicitaria nueva: calentarla y no cambiar anuncios cada día para evitar restricciones.
- [ ] Al cierre de la semana: costo por preregistro por ángulo, tasa de paso 1 a paso 2 y tasa de preregistro por visita.

### Etapa 5 — Campaña fuerte

- [ ] Se escala solo el ángulo con mejor costo por preregistro.
- [ ] **Criterio de corte (completar el dueño antes de la Etapa 4):** costo máximo por preregistro = ___ ARS. Si pasa ese valor tras 7 días, se pausa y se cambia el mensaje.
- [ ] **Cuello de botella:** los registros de estudiantes tienen que convertirse en solicitudes de residencias fundadoras. Medir por separado (DR46): estudiantes registrados y solicitudes de fundadoras recibidas por semana.
- [ ] **Alerta temprana:** si hay más de 300 estudiantes y cero solicitudes de fundadoras tras 3 semanas, revisar el mensaje de `/fundadoras`, su visibilidad en la landing y el canal entrante (Instagram, el contacto directo del dueño con quienes ya preguntan). No se pasa a contactar en frío sin decidirlo de nuevo con el dueño.

### Trabajo en paralelo de la app

- Ajustes de dashboards, flujos y fichas siguen en `staging`.
- Cada bloque cierra con `typecheck` + `lint` + `build` y entra a producción solo con las condiciones de la regla de merge.
- Las entrevistas con residencias alimentan una lista de cambios. No se implementan en caliente: se priorizan una vez por semana.
- **Límite de tiempo:** si la app en paralelo consume más del 50 % del día durante la campaña, parar y volver a la Etapa 2 (Instagram y contenido).

### Criterio de éxito del Paso 0

- Producción en `estured.com` con la preapertura activa y el popup que no se cierra.
- Textos legales publicados y pixel midiendo.
- 12 piezas base en Instagram.
- Una semana de test de anuncios con números por ángulo.
- Decisión escrita de escalar, ajustar o pausar.

---

## A. Decisiones previas (contestar antes de empezar)

- [x] **A1. Lanzamiento en modo preapertura — decidido 2026-11-13: `PREAPERTURA=on` en producción.** Con `PREAPERTURA=on` en producción el sitio abierto queda cerrado (`/` y `/for-students` muestran el popup de preapertura; `/search`, `/register`, `/waitlist` y `/students/*` redirigen). Login, `/admin`, `/for-residences`, `/guias`, `/fundadoras` y `/register/residence` siguen. **Recomendado: salir así** y abrir el sitio completo después (ver sección G). Si se quiere abrir todo ya, dejar la variable vacía, pero entonces hay que cerrar antes los requisitos de la sección G (verificación de email, etc.).
- [x] **A2. Planes — decidido 2026-11-14: empezar en Free (Supabase y Vercel Hobby).** Consecuencias aceptadas, a revisar **antes de abrir el sitio completo o cobrar fees** (pasar a Supabase Pro y Vercel Pro):
  - Supabase Free **no tiene backups propios**: hasta pasar a Pro, hacer un `pg_dump` manual periódico (Dashboard → Connect → connection string; guardar fuera del repo) y antes de cada migración grande.
  - Supabase Free **pausa el proyecto tras ~7 días sin actividad**: el cron horario de la 0013 genera tráfico a la base, pero hay que confirmar tras la primera semana que no se pausó (si pasa, *Restore* desde el dashboard y subir a Pro).
  - **"Leaked password protection" no existe en Free**: la única defensa es el mínimo de contraseña de la app (queda pendiente en la sección I).
  - Vercel Hobby es solo uso no comercial: válido para la preapertura (no se cobra nada); **hay que pasar a Pro antes de cobrar el primer fee**.
- [ ] **A3. Titularidad de las cuentas (organizaciones, no cuentas nuevas).** Mejor ahora, que prod no existe y mover es gratis: *Organization* de GitHub (transferir el repo conserva historial y la conexión con Vercel), *Organization* de Supabase (crear `estured-prod` directamente ahí) y *Team* de Vercel. Dominio: Hostinger con 2FA, auto-renovación y un segundo mail de recuperación (quien controla el dominio controla todos los resets de contraseña). Si el repo se transfiere, cambia el remoto `origin`.
- [ ] **A4. Casilla `hola@estured.com`.** El código la usa como contacto (`lib/constants/contact.ts`) y como `replyTo` de los mails. Tiene que existir y alguien tiene que leerla. En Hostinger: hPanel → Dominio → Correo electrónico (reenvío o buzón; revisar qué incluye tu plan). Si el buzón de Hostinger usa MX propios, **no** toques los MX al configurar Resend (Resend usa registros en un subdominio, ver C3).
- [ ] **A5. Fecha de cierre de fundadoras** (`FOUNDERS_CLOSE_AT`, ISO 8601). Opcional: sin la variable no hay cuenta regresiva.

---

## A0. Orden de trabajo (decidido 2026-11-13)

1. **Liberar el lugar en Supabase** dando de baja el `estured-prod` viejo (paso A0.1).
2. **Staging primero** (A0.2): ensayo general del deploy en Vercel contra `estured-dev`, con `staging.estured.com`. Local sigue igual (`npm run dev`, selector «Simular usuario», `.env.local` → `estured-dev`).
3. Recién después, producción (secciones B a G).

### A0.1 Baja del Supabase prod viejo [Vos]
Es **irreversible**: se pierde la base, Auth y Storage de ese proyecto. Estado conocido: sin usuarios reales, solo residuo demo/tests. Antes de borrar:
- [ ] Entrar a Supabase con la **cuenta de producción** (no la de `estured-dev`) y confirmar en la URL que el ref es `mrwooskdcnkbitkhcvbf`.
- [ ] Confirmar que no hay datos reales: SQL Editor → `select count(*) from auth.users;` y `select count(*) from residences;` (esperado: usuarios demo/test y residencias de prueba). Si hay algo que valga, `Database → Backups` o `pg_dump` antes.
- [ ] Anotar lo que se quiera conservar de Settings (nada que el repo no tenga: las migraciones y los scripts reconstruyen todo).
- [ ] Project Settings → General → *Delete project* (o *Pause* si querés conservar un rollback; ojo: confirmar si un proyecto pausado sigue ocupando el lugar del plan Free).
- [ ] Vercel: desde este momento `estured.vercel.app` (apuntando a esa base) deja de funcionar. Está bien: se reemplaza con el deploy nuevo. No hay usuarios reales.
- [ ] **[Yo]** una vez borrado, dejo el ref viejo en `scripts/production-refs.json` (no molesta: sigue bloqueando seeds/tests contra él) y agrego el ref nuevo en C2.

### A0.2 Staging en Vercel contra `estured-dev` (ensayo) — HECHO 2026-11-14
Deploy de la rama `staging` en *Ready* y login real verificado con Turnstile; ⚠️ **Corrección 2026-11-19:** la URL NO pide login de Vercel hoy y tiene el selector demo público (ver «Staging público» en la sección «Auditoría pre-producción 2026-11-19»). Pendiente menor: Redirect URL de reset de contraseña en Supabase dev (no había acceso a esa cuenta).
Objetivo: probar el deploy real (build, variables, Turnstile, headers) sin tocar producción, y tener un lugar fuera de localhost para probar cada cambio. **No usa `estured.com` ni Hostinger**: el dominio propio es solo de producción.
- **Proyecto de Vercel: se reutiliza `estured-claude`** (cuenta personal `fbermani-gmailcoms-projects`, repo `fbermani/estured-claude`, dominio `estured.vercel.app`). Estaba limpio: 4 variables y 3 deploys viejos de `main`. Se transfiere a un Team más adelante si se decide (A3).
- **Variables separadas por entorno:** *Production* = Supabase nuevo (las 4 viejas quedaron solo en Production, pendientes de reemplazar); *Preview* = `estured-dev`. Ningún preview toca producción. Hecho el 2026-11-14.
- **Rama `staging`** (creada local; el push lo hace el dueño: `git push -u origin staging`). Su URL es `https://estured.vercel.app` (dominio reasignado de Production a la rama `staging` el 2026-11-14; producción irá en `estured.com`).
- **Protección:** el proyecto tiene *Vercel Authentication* con alcance `all_except_custom_domains`: se esperaba que las URLs `*.vercel.app` pidieran login de Vercel (la auditoría del 2026-11-19 comprobó que no es así; por eso el staging usa `estured.vercel.app` y **no** un subdominio de `estured.com`, que quedaría público con la base de dev y sus usuarios demo). El selector «Simular usuario» **sí** va en el staging (decisión del dueño, 2026-11-14), pero solo como variables de *Preview* **acotadas a la rama `staging`** (`DEMO_LOGIN_ENABLED`, `DEMO_USERS_PASSWORD` sensitive, `NEXT_PUBLIC_STAGING=on`, `PREAPERTURA=on`) y detrás del login de Vercel; `isDemoLoginEnabled()` y `isDevUi()` (`lib/dev/devUi.ts`) las ignoran si `VERCEL_ENV=production`. **Nunca** en Production. Verificar en incógnito que la URL pide login.
- **Turnstile propio:** Vercel compila con `NODE_ENV=production`, así que la guarda S3 rechaza las claves de prueba (`1x…`). Widget `EstuRed staging` en Cloudflare con el hostname de la URL de la rama (sin `https://`); sus claves van solo a *Preview* (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`; la secret conviene crearla como *Sensitive*).
- **Variables de Preview cargadas:** claves de `estured-dev`, `NEXT_PUBLIC_APP_URL` y `NEXT_PUBLIC_SITE_URL` = URL de la rama, `NEXT_PUBLIC_APP_NAME`, Turnstile. Sin `PREAPERTURA` (se prueba el sitio completo), sin `RESEND_API_KEY` (mails solo si se quiere probar con el sandbox de Resend, que entrega solo al dueño de la cuenta), sin `CRON_SECRET` (el cron de dev no se aplica).
- **Supabase dev → Auth → URL Configuration → Redirect URLs:** agregar `https://estured.vercel.app/reset-password`.
- **Verificación:** deploy *Ready*; la URL carga (hoy sin login de Vercel, público a propósito: ver «Staging público» en la auditoría 2026-11-19); el widget de Turnstile aparece y un login real funciona; `curl -sI` (con el bypass o ya logueado) muestra CSP Report-Only con `report-uri` y HSTS; sin widget de sesión simulada.
- Costo: ninguno (Hobby alcanza para ensayar; ver A2 para producción).

---

## B. Preparar el código [Yo]

- [x] Cron de la 0013: el placeholder de host ahora es completo (`REEMPLAZAR-CON-TU-DOMINIO`, sin sufijo `.vercel.app`) y `node scripts/build-bootstrap.mjs prod --host=estured.com` lo reemplaza (2026-11-13).
- [x] `NEXT_PUBLIC_SITE_URL` por defecto = `https://estured.com` (`lib/siteUrl.ts`, `lib/arrival/reminderCopy.ts`); antes caía a `estured.vercel.app` (sitemap, canonical, links de mails).
- [x] `scripts/create-admin.mjs` acepta `--superadmin` (antes solo creaba `admin` y `/admin/payment-settings` exige `superadmin`).
- [x] Remitente de mails: ya sale de `EMAIL_FROM` (el cambio de código que figuraba como pendiente no hace falta; solo la variable).
- [x] Antes del push final: `typecheck`, `lint` (0 errores, 34 avisos) y `build` en verde sobre el commit `d89043f` en un worktree limpio (2026-11-25). Repetir si entra código nuevo.
- [ ] Merge de `hardening/pre-produccion-2026-11` a `main` **solo cuando la sección E (variables de Vercel) esté hecha**.

---

## C. Cuentas externas y dominio [Vos, yo te guío]

### C1. Cloudflare Turnstile (CAPTCHA)
- [ ] Cuenta gratuita de Cloudflare → Turnstile → *Add widget*: nombre `EstuRed prod`, dominios `estured.com` (y `www.estured.com`), modo *Managed*.
- [ ] Guardar **Site key** y **Secret key**. Son claves **reales**: las de prueba (`1x…`) rechazan todo en prod (guarda S3 del código).
- No hace falta mover el DNS del dominio a Cloudflare.

### C2. Supabase (proyecto nuevo)
- [ ] Dashboard → Organization (ver A3) → *New project*: nombre `estured-prod`, región cercana a Argentina (`South America (São Paulo)`), contraseña de base fuerte (guardarla en el gestor de contraseñas).
- [ ] En las opciones de creación, dejar activada la **Data API** y la **exposición automática de tablas nuevas** (privilegios por defecto) si el panel las ofrece; sin eso, `service_role` y `authenticated` quedan sin grants sobre las tablas del bootstrap. Control: `select pg_get_userbyid(d.defaclrole), d.defaclobjtype, d.defaclacl::text from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace where n.nspname = 'public';`. **Antes de D1** un proyecto nuevo muestra `arwdDxtm` para `anon`, `authenticated` y `service_role` (visto el 2026-11-25: correcto). **Después de D1** (0090, 0092 y 0098 lo recortan) la fila `postgres` / `r` tiene que quedar como `estured-dev`: `anon=m`, `authenticated=rm`, `service_role=arwdDxtm`.
- **Secret key de prod: no se rota (decisión del dueño, 2026-11-25). Riesgo aceptado.** La única secret key activa (`default`) coincide al comienzo con una que se pegó en un chat. Con ella se accede a toda la base y al Storage salteando RLS. Se recomendó rotarla antes de recibir datos reales: *New secret key* → `SUPABASE_SERVICE_ROLE_KEY` en Vercel → redeploy → borrar `default`.
- Las claves nuevas se llaman distinto: *publishable* (`sb_publishable_…`) va en `NEXT_PUBLIC_SUPABASE_ANON_KEY`; *secret* (`sb_secret_…`) va en `SUPABASE_SERVICE_ROLE_KEY`. `SUPABASE_JWKS_URL` no se usa.
- Las 3 variables de Supabase de Production son *Sensitive* y Vercel no deja cambiarles el tipo. La pantalla rechaza guardar las `NEXT_PUBLIC_*` así; por API se actualizó solo el valor (2026-11-25). Si el build de F2 no las toma, borrarlas y recrearlas como *Config*.
- [x] Región del proyecto confirmada: `sa-east-1` (2026-11-25; la IPv6 de `db.<ref>.supabase.co` cae en el rango de AWS de esa región).
- [x] Región de funciones de Vercel: `gru1` en `vercel.json` (2026-11-25) [Yo]. Afecta también al staging (base en `us-east-1`): algo más lento, aceptado.
- [ ] Anotar el **ref** (el subdominio de la URL), la **URL**, la **anon key** y la **service role key** (Project Settings → API; la service role es secreta).
- [x] Yo agrego el ref a `scripts/production-refs.json` (`hioscbefryufsbypsmtx`, 2026-11-25; así tests y seeds se niegan a correr contra él).

### C3. Resend (mails) y DNS en Hostinger
- [ ] Cuenta de Resend → Domains → *Add domain* `estured.com` (región `sa-east-1` si está) → te muestra registros DNS (SPF/DKIM/MX de retorno bajo `send.`).
- [ ] En Hostinger: hPanel → Dominios → `estured.com` → DNS / Nameservers → *DNS zone* → agregar esos registros **tal cual los muestra Resend** (TXT/CNAME/MX). Esperar a que Resend marque *Verified* (minutos a horas).
- [ ] Crear una **API key** de Resend con permiso *Sending access* solo para ese dominio.
- Cuidado: si Hostinger tiene registros viejos de "parking" (A/AAAA o CNAME de `@` o `www`), se borran en el paso F1, no acá.

### C4. Vercel
- [ ] Team (ver A3) → proyecto de EstuRed conectado al repo de GitHub, *Production Branch* = `main`. Si ya existe el proyecto viejo `estured` apuntando a `estured-prod` viejo, usarlo pero **cambiar todas las variables** (sección E) antes del primer deploy.

---

## D. Base de datos y Storage (Supabase nuevo)

### D1. Bootstrap con las migraciones 0001–0110 [Vos con mi ayuda]
Genera el SQL completo (111 archivos, 0001–0110 con la 0043b; ~560 KB; revisado el 2026-11-25), con el cron de la 0013 ya apuntando a `https://estured.com`. El secreto del cron se guarda en **Supabase Vault** (no queda en texto plano en `cron.job`).

- [ ] **Migraciones 0088, 0089 y 0090 entran en el bootstrap** (el script toma todos los `db/migrations/*.sql`; verificar que aparezcan al final). La **0089** (SEG15-01) crea el índice único `reservations_one_per_application_uidx`: en una base ya poblada correr antes `select application_request_id, count(*) from reservations where application_request_id is not null group by 1 having count(*) > 1;` (debe dar 0 filas). En un bootstrap desde cero no hay datos y no hace falta. La **0090** (SEG15-04) revoca los permisos de escritura de `anon` y `authenticated`: no toca datos; después correr `select grantee, privilege_type, count(distinct table_name) from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') group by 1,2;` (solo debe quedar SELECT).
- [ ] **Migraciones 0091 y 0092 entran en el bootstrap** (auditoría 2026-11-16, aplicadas en dev). La **0091** agrega CHECK de largo (≤2000/1000) a los textos libres de solicitudes, negociación y propuestas del familiar; en base poblada verificar antes que ningún texto lo supere. La **0092** quita SELECT a `anon` en todo lo que no sea catálogo público (10 tablas); después correr `select c.relname from pg_class c where c.relnamespace='public'::regnamespace and c.relkind in ('r','p') and has_any_column_privilege('anon', c.oid, 'SELECT') order by 1;` (deben salir solo: exchange_rates, profile_availability, profile_availability_genders, residence_custom_amenities, residence_faq_items, residence_faq_predefined_questions, residence_profile_sections, residence_regulation_versions, residences, room_types). Una tabla nueva que anon deba leer necesita `grant select` explícito.
- [ ] Generar el secreto y la copia lista para pegar, **fuera del repo** (un solo bloque; deja el secreto en el portapapeles para Vercel y no lo muestra):
  ```bash
  cd "/Users/fabriciobermani/Desktop/EstuRed Claude" && node scripts/build-bootstrap.mjs prod --host=estured.com && S=$(openssl rand -hex 32) && sed "s/REEMPLAZAR-CON-TU-CRON-SECRET/$S/g" db/_generated/prod_bootstrap.sql > ~/Desktop/prod_bootstrap_LISTO.sql && printf %s "$S" | pbcopy && echo "Listo: ~/Desktop/prod_bootstrap_LISTO.sql (secreto en el portapapeles)"
  ```
- [ ] **Guardar el secreto ya** (gestor de contraseñas): es el valor de `CRON_SECRET` de Vercel (sección E) y el portapapeles se pisa fácil.
- [x] **Antes de copiar el SQL:** crear `CRON_SECRET` en Vercel (Production, *Sensitive*) con ese valor [Vos] (creada el 2026-11-25).
- **Camino simple (usado el 2026-11-25):** [Yo] genero el SQL sin secreto y lo dejo en el portapapeles. [Vos] pegar y *Run*. Después, en una consulta nueva, reemplazar el texto de relleno por el `CRON_SECRET` y correr: `select vault.update_secret((select id from vault.secrets where name = 'cron_secret'), 'PEGA-ACA-EL-SECRETO');`. Borrar esa consulta guardada.
- Alternativa: regenerar el SQL **con el mismo secreto** ya guardado (va directo al portapapeles, sin archivo en el Escritorio):
  ```bash
  cd "/Users/fabriciobermani/Desktop/EstuRed Claude" && node scripts/build-bootstrap.mjs prod --host=estured.com && read -rs 'S?Pegá el CRON_SECRET guardado y tocá Enter: ' && sed "s/REEMPLAZAR-CON-TU-CRON-SECRET/$S/g" db/_generated/prod_bootstrap.sql | pbcopy; unset S
  ```
- Estado 2026-11-25: bootstrap ejecutado en `hioscbefryufsbypsmtx` (un segundo Run dio `type "user_role" already exists`, esperado: **no volver a correrlo**).
- **Control del 2026-11-25:** OK `tablas` 77, sin RLS 0, escritura pública 0, `policies` 124, permisos por defecto, huella de tablas, huella de columnas y cron. `huella_funciones` dio `699ed288b7c87ab2870004134904a7b1`: la única diferencia es `public.rls_auto_enable()` (solo en prod, devuelve `event_trigger`). Las 27 funciones propias coinciden por nombre y firma. Por nombre y tipo parece el activador automático de RLS que Supabase agrega a proyectos nuevos; no se borra. `anon` figura con *execute*, pero por la API REST responde error 400.
- [x] Confirmada (2026-11-25): activador `ensure_rls` (`ddl_command_end`, habilitado), dueño `postgres`, `SECURITY DEFINER`. Su cuerpo activa RLS en cada tabla nueva de `public`. Se deja.
- [x] *Security Advisor* (2026-11-25): 0 errores; 12 avisos = `pg_net` en `public`, 9 helpers propios de RLS y 2 de `rls_auto_enable()`; 28 sugerencias informativas. 0 usuarios en `auth.users`.
- [ ] **[Vos] Cargar el secreto del cron en Vault** (el control dice «falta cargarlo»). Sin SQL: [Integrations → Vault → Secrets](https://supabase.com/dashboard/project/hioscbefryufsbypsmtx/integrations/vault/secrets) → `cron_secret` → ⋮ → *Edit* → *Secret value*: pegar el `CRON_SECRET` de Vercel → *Update secret*. Control: la consulta de huella o `select length(decrypted_secret) = 64 from vault.decrypted_secrets where name = 'cron_secret';`. 2026-11-27: las 6 respuestas guardadas del cron en prod eran `401`.
- [ ] Copiar el SQL (`pbcopy < ~/Desktop/prod_bootstrap_LISTO.sql`) → SQL Editor del proyecto `hioscbefryufsbypsmtx` → Run. Si pide confirmar una operación destructiva, confirmar (la base está vacía).
- [ ] **Si falla:** no reintentar ni recrear el proyecto. Los `begin;`/`commit;` internos dejan aplicado lo anterior. Pasar el texto del error y el archivo (`-- ===== 0xxx =====`) donde cortó; se sigue desde ahí.
- [ ] Borrar el *snippet* guardado en el SQL Editor y el archivo `~/Desktop/prod_bootstrap_LISTO.sql`: los dos tienen el secreto.
- [ ] **Verificación (huella contra `estured-dev`)**, en una consulta nueva:
  ```sql
  select
    (select count(*) from pg_class where relnamespace='public'::regnamespace and relkind in ('r','p')) as tablas,
    (select count(*) from pg_class where relnamespace='public'::regnamespace and relkind in ('r','p') and not relrowsecurity) as tablas_sin_rls,
    (select count(*) from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') and privilege_type<>'SELECT') as escritura_publica,
    (select count(*) from pg_policies where schemaname='public') as policies,
    (select count(*) from cron.job where jobname='expire-stale-records-hourly' and active) as cron,
    (select d.defaclacl::text from pg_default_acl d where d.defaclnamespace='public'::regnamespace and d.defaclobjtype='r' and pg_get_userbyid(d.defaclrole)='postgres') as permisos,
    (select md5(string_agg(relname::text, ',' order by relname::text collate "C")) from pg_class where relnamespace='public'::regnamespace and relkind in ('r','p')) as huella_tablas,
    (select md5(string_agg(table_name||'.'||column_name||':'||data_type, ',' order by (table_name||'.'||column_name) collate "C")) from information_schema.columns where table_schema='public') as huella_columnas,
    (select md5(string_agg(proname||'('||pg_get_function_identity_arguments(oid)||')', ',' order by (proname||'('||pg_get_function_identity_arguments(oid)||')') collate "C")) from pg_proc where pronamespace='public'::regnamespace) as huella_funciones;
  ```
  Esperado (dev al 2026-11-25): `tablas` 77 · `tablas_sin_rls` 0 · `escritura_publica` 0 · `policies` 124 · `cron` 1 · `permisos` `{postgres=arwdDxtm/postgres,anon=m/postgres,authenticated=rm/postgres,service_role=arwdDxtm/postgres}` · `huella_tablas` `2faa89b6ffa30e7981702807c9887063` · `huella_columnas` `a1d005b7969299937d3d2916c9d0d93f` · `huella_funciones` `a605f5e281866781c8a5e20dcfea231c`. Si una huella difiere, comparar solo las listas de nombres (sin datos).
- El cron llama a `estured.com` cada hora desde D1. Falla hasta F2 (deploy viejo): es esperado.

### D2. Buckets de Storage [Yo, con acceso al SQL Editor]
- [x] **Hecho el 2026-11-25:** 5 buckets, huella igual a dev, un solo público, 0 policies de Storage.
- SQL Editor del proyecto `hioscbefryufsbypsmtx` (copia de los 5 buckets de `estured-dev`; se puede repetir):
  ```sql
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
    ('public-residence-media', 'public-residence-media', true, 5242880, array['image/jpeg','image/png','image/webp']),
    ('private-residence-documents', 'private-residence-documents', false, 10485760, array['application/pdf']),
    ('payment-proofs', 'payment-proofs', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp']),
    ('support-evidence', 'support-evidence', false, 26214400, array['application/pdf','image/jpeg','image/png','image/webp','video/mp4','video/quicktime','audio/mpeg','audio/mp4','audio/ogg']),
    ('student-documents', 'student-documents', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp'])
  on conflict (id) do nothing;
  select count(*) as buckets, md5(string_agg(id||':'||public::text||':'||file_size_limit::text||':'||array_to_string(allowed_mime_types, ','), ';' order by id collate "C")) as huella from storage.buckets;
  ```
- Éxito: `buckets` 5 y `huella` `6a609523f5d56026a3841434f68acb0a` (dev al 2026-11-25). Solo `public-residence-media` es público. **No agregar policies de Storage** (el acceso privado es por service role).
- Alternativa por Terminal (credenciales solo en esa invocación):
  ```bash
  read -rs 'SR?Pegá la secret key de prod: ' && SUPABASE_SERVICE_ROLE_KEY=$SR NEXT_PUBLIC_SUPABASE_URL=https://hioscbefryufsbypsmtx.supabase.co node scripts/setup-storage.mjs; unset SR
  ```

### D3. Supabase Auth [Vos]
- Estado 2026-11-25: URLs cargadas y registro apagado (`disable_signup: true` verificado). CAPTCHA nativo apagado (correcto). Falta SMTP propio y revisar la plantilla de *Reset Password* (el panel no deja editar plantillas sin SMTP propio; al activarlo el límite pasa a 30 mails por hora, ajustable en *Rate Limits*). La configuración pública de Auth (`/auth/v1/settings`) coincide con la de dev; MFA TOTP habilitado.
- [x] Authentication → URL Configuration: **Site URL** `https://estured.com`; **Redirect URLs**: `https://estured.com/reset-password` y `https://www.estured.com/reset-password`.
- [x] Authentication → Sign In / Providers → **"Allow new users to sign up": apagado** → *Save* (confirmar el ref). Todas las altas usan `auth.admin.createUser` desde el servidor. Verificación: `curl -s https://<ref>.supabase.co/auth/v1/settings -H "apikey: <anon key>"` → `"disable_signup": true`.
- [ ] Authentication → SMTP Settings: SMTP propio con Resend (`smtp.resend.com`, puerto `465`, usuario `resend`, contraseña = API key de C3, remitente `no-reply@estured.com`). El SMTP por defecto de Supabase tiene un límite muy bajo.
- [ ] Authentication → Email Templates: revisar que el de *Reset Password* esté en español.
  - Plantilla lista (2026-11-27): pegar `docs/mail/recuperar-contrasena.html` en *Reset Password*, asunto «Cambiá tu contraseña de EstuRed». Antes publicar en `main` (las imágenes salen de `estured.com/email/`).
- [ ] **"Leaked password protection"**: activar (solo plan Pro; ver A2).
- [x] **CAPTCHA nativo de Supabase: apagado** (el CAPTCHA va en nuestras server actions; activarlo rompe los logins automáticos tras el registro).
- [ ] JWT: dejar el default (1 h).

---

## E. Variables de entorno de Vercel [Vos]

Vercel → Settings → Environment Variables, entorno **Production** (y Preview solo si se usa; Preview **no** debe apuntar a prod sin pensarlo). Las `NEXT_PUBLIC_*` se incrustan en el build: cambiarlas exige redeploy.

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto nuevo |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key del proyecto nuevo |
| `SUPABASE_SERVICE_ROLE_KEY` | service role del proyecto nuevo (marcar *Sensitive*) |
| `NEXT_PUBLIC_APP_URL` | `https://estured.com` (obligatoria: `getAppUrl` lanza en prod si falta) |
| `NEXT_PUBLIC_SITE_URL` | `https://estured.com` (sitemap, canonical, links de mails de avisos) |
| `CRON_SECRET` | el mismo valor guardado en D1 (*Sensitive*) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | clave pública VAPID de ESE entorno (DR61; generala con `npx web-push generate-vapid-keys`) |
| `VAPID_PRIVATE_KEY` | clave privada VAPID del mismo par (*Sensitive*; nunca en el chat ni en el repo) |
| `VAPID_SUBJECT` | la URL del sitio, p. ej. `https://estured.com` (no un email personal) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | site key real (C1) |
| `TURNSTILE_SECRET_KEY` | secret real (C1, *Sensitive*). Sin ella, prod rechaza todos los envíos con CAPTCHA |
| `RESEND_API_KEY` | API key de C3 (*Sensitive*) |
| `EMAIL_FROM` | `no-reply@estured.com` (solo la dirección; dominio verificado en Resend) |
| `EMAIL_DOMAIN_VERIFIED` | `true` **solo** cuando Resend marque el dominio *Verified* (habilita los avisos de llegada y el mail del familiar) |
| `PREAPERTURA` | `on` si se sale en preapertura (A1) |
| `NEXT_PUBLIC_META_PIXEL_ID` | opcional (Paso 0, «Medición»): ID numérico del pixel de Meta. Solo Production; sin ella o fuera de producción el pixel no carga. Se incrusta en el build: redeploy al cambiarla |
| `FOUNDERS_CLOSE_AT` | opcional (A5) |
| `GEOCODER_USER_AGENT` | opcional (DF6, `docs/00` §31): identifica a la app ante Nominatim, p. ej. `EstuRed/1.0 (contacto@estured.com)`. Solo server; sin ella se usa un valor genérico |

- [x] **`DEMO_LOGIN_ENABLED`, `DEMO_USERS_PASSWORD` y `NEXT_PUBLIC_STAGING` NO existen en Production** (solo en Preview de la rama `staging`, ver A0.2). Verificar con el MCP/dashboard que ninguna tenga `production` entre sus entornos. Verificado el 2026-11-25: las tres solo en Preview de `staging`.
- [x] Cargadas todas **antes** del primer deploy a prod. Verificado el 2026-11-25; faltan solo las opcionales `FOUNDERS_CLOSE_AT` y `NEXT_PUBLIC_META_PIXEL_ID`. La segunda se cargó el 2026-11-27.

---

## F. Deploy y dominio

### F1. Dominio `estured.com` en Vercel [Vos]
> **Relevamiento solo lectura (2026-11-19):** `estured.com` activo en Hostinger (registrado 2026-11-14, vence 2027-11-14, lock + privacidad + auto-renovación ON, mail de contacto verificado). Nameservers `aster/helios.dns-parking.com` (zona DNS editable por API). DNS hoy: solo `A @ 2.57.91.91` (TTL 50, parking) y `CNAME www → estured.com`; sin MX/TXT/CAA. Responde 200 con la página de parking de Hostinger. En Vercel (proyecto `estured-claude`) el único dominio es `estured.vercel.app`, atado a la rama `staging`; **no hay dominio de Production ni deploys de `main`**. Hostinger tiene además *Unlimited Web Hosting* (activo, auto-renovación) y *Ecommerce Growth* (en prueba, auto-renovación), sin ningún sitio creado: decidir si se cancelan (pendiente, requiere confirmar ítem y monto). Ningún cambio hecho todavía.
> **Decisión del dueño (2026-11-21):** `estured.com` apunta a Production (proyecto `estured-claude`, rama `main`). `estured.vercel.app` sigue como staging, **sin redirección** a `estured.com`. El DNS de Hostinger se cambia recién en F2, con el deploy de `main` listo, para no servir un 404.
> **Hecho (2026-11-21):** `estured.com` y `www.estured.com` (308 → apex) agregados al proyecto `estured-claude` en Vercel, sin rama (Production). Vercel los marca `verified` pero `misconfigured` (el DNS sigue en parking). Registros que pide Vercel para F2: apex `A 216.198.79.1` y `A 64.29.17.1` (alternativa `76.76.21.21`); `www` `CNAME 19d4c8ed50265c3e.vercel-dns-017.com.` (alternativa `cname.vercel-dns.com.`). Pendiente: cambiar DNS en Hostinger (reemplaza el `A @ 2.57.91.91` y el `CNAME www`), solo cuando el deploy de `main` esté listo.
> **Hecho (2026-11-21, a pedido del dueño: Claude configura Hostinger/Vercel/Supabase dev):** DNS de Hostinger actualizado por API: `A @ 216.198.79.1 + 64.29.17.1` y `CNAME www 19d4c8ed50265c3e.vercel-dns-017.com.` (TTL 300). Verificado: Hostinger y 8.8.8.8 devuelven los valores nuevos; Vercel reporta `misconfigured: false`. Hasta el primer deploy de `main`, `estured.com` no sirve la app. Supabase prod y el deploy de `main` siguen pendientes (el push a `origin/main` es del dueño).
> **HTTPS listo (2026-11-21):** el handshake TLS fallaba (sin certificado); emití el cert de Vercel por API (`cert_qdthUFPITHaWDJOg5sIAqVCX`, `estured.com` + `www.estured.com`, auto-renovación, vence 2027-02). Verificado: `https://estured.com` → 200 con el título de la app; `https://www.estured.com` → 308 a `https://estured.com/`. Ojo: ya sirve un deploy existente, no el de `main` recién pusheado; revisar cuál es antes de F2.
> **A4, buzón comprado (2026-11-22):** *Starter Business Email* 1 año, ARS 17.988 (1.er año; renueva solo a ARS 39.588 el 2027-11-22), 1 buzón. Orden de mail `ORf38f08db766c4ba95ed910df3ef8`, estado `pending_setup`, sin dominio asociado. La API no permite asociar el dominio: **falta que el dueño lo haga en hPanel → Correo electrónico → configurar `estured.com`**. Después: crear `hola@estured.com` (contraseña la pone el dueño), cargar MX/SPF/DKIM de Hostinger en la zona DNS (sin tocar `send.` de Resend, ver C3) y verificar.
> **A4, dominio asociado (2026-11-22):** la orden de mail está `active` con `estured.com`. Hostinger cargó solo en la zona: `MX 5 mx1 / 10 mx2.hostinger.com`, `TXT @ v=spf1 include:_spf.mail.hostinger.com ~all`, 3 CNAME DKIM `hostingermail-{a,b,c}._domainkey`, `autodiscover`, `autoconfig` y `_dmarc v=DMARC1; p=none`. Los `A @` y `CNAME www` de Vercel quedaron intactos. Pendiente: crear la casilla `hola@estured.com` (la crea el dueño en hPanel para no pasar la contraseña por el chat). Para Resend (C3): usa `send.` y no pisa el SPF de la raíz; subir `_dmarc` a `p=quarantine` cuando el correo esté probado.
> **A4, casilla creada (2026-11-25):** el dueño creó `hola@estured.com` en hPanel. MX públicos OK (`mx1`/`mx2.hostinger.com`). **Sin verificar la recepción real:** la API de Hostinger se desconectó de la sesión y la prueba SMTP directa dio `550 Protocol error` (no concluyente). Pendiente: enviar un mail de prueba desde otra cuenta a `hola@estured.com` y confirmar que llega, y otro de respuesta hacia afuera (revisar spam).
> **A4 verificado (2026-11-25):** el dueño confirmó que `hola@estured.com` recibe, responde y no cae en spam.
> **C3, Resend (2026-11-25):** dominio `estured.com` creado en Resend (región `sa-east-1`, solo envío, recepción desactivada, tracking apagado) y **`verified`**. Registros cargados por API en Hostinger: `TXT resend._domainkey` (DKIM), `MX send → 10 feedback-smtp.sa-east-1.amazonses.com.`, `TXT send` (`v=spf1 include:amazonses.com ~all`), `CNAME rsend → send.forge.rmta.net.` (TTL 3600). El SPF y los MX de la raíz (buzón de Hostinger) no se tocaron. Pendiente: API key de Resend con *Sending access* solo para este dominio, cargada como variable *Sensitive* en Vercel Production (`RESEND_API_KEY`), más `EMAIL_FROM=no-reply@estured.com` y `EMAIL_DOMAIN_VERIFIED=true` (ver tabla de variables, sección E).
> **C3 hecho (2026-11-25):** API key de Resend `estured-prod-sending` (id `fce07fac-554d-482f-9db7-fbf510a810ac`, permiso *Sending access* limitado a `estured.com`) creada y cargada solo en Vercel Production como `RESEND_API_KEY` (*Sensitive*; el valor no se guardó en ningún archivo ni se mostró en el chat). También en Production: `EMAIL_FROM=no-reply@estured.com` y `EMAIL_DOMAIN_VERIFIED=true`. Pendiente de la tabla E: variables de Supabase, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`, VAPID, Turnstile y `PREAPERTURA`. Falta probar un envío real tras el deploy de `main`; el SMTP de Supabase Auth usa esta misma key (sección D).
> **Cookies verificadas (2026-11-21):** ninguna cookie de la app define `Domain` (`lib/supabase/cookie-options.ts`, `server.ts`, `middleware.ts`): son host-only, `httpOnly` + `Secure` en prod + `SameSite=Lax`. Un subdominio futuro (`blog.`, `status.`) no puede leer la sesión. Mantener así: no agregar `domain: ".estured.com"`.
> **Opción futura (no se hace ahora): aislar los paneles en `app.estured.com`.** Hoy sitio público y paneles viven juntos en `estured.com` a propósito: el SEO depende de `/search`, fichas y guías, y el dominio está en `SITE_URL`, canonicals, sitemap, robots, CSP, Turnstile, Redirect URLs de Supabase Auth y links de mails. Se reconsidera si los paneles pesan en el rendimiento del sitio público o si hace falta aislar seguridad. Si se hace: (1) agregar `app.estured.com` al proyecto en Vercel y su CNAME en Hostinger; (2) mover paneles y login a ese host y dejar redirects 308 desde las rutas viejas; (3) actualizar Site URL y Redirect URLs de Supabase, dominios de Turnstile, CSP y `NEXT_PUBLIC_APP_URL` (`NEXT_PUBLIC_SITE_URL` queda en el apex); (4) los usuarios deberán volver a iniciar sesión (cookies host-only); (5) `noindex` en el host de la app.
- [x] Vercel → proyecto → Settings → Domains → agregar `estured.com` y `www.estured.com` (www redirige al apex). Vercel muestra los registros exactos.
- [x] Hostinger → DNS zone: **borrar** los registros A/AAAA/CNAME de `@` y `www` que haya por defecto (parking) y crear los que indica Vercel (normalmente `A @ 76.76.21.21` y `CNAME www cname.vercel-dns.com`; **usar los valores que muestre Vercel**). No tocar los registros de Resend ni los MX del correo.
- [x] Esperar a que Vercel ponga ambos dominios en verde (HTTPS automático; propagación de minutos a horas). Verificado el 2026-11-25: DNS sin errores (`misconfigured: false`).

### F2. Push y deploy [Vos con mi ayuda]
- [x] Sección B completa (typecheck/lint/build) y sección E completa.
- [x] `main` es ancestro de `staging`: no hace falta commit de merge. Yo te paso el comando `git push origin <commit validado>:main`; lo corrés vos (dispara el deploy).
  - 2026-11-25: validado `ea9326b` (typecheck, lint 0 errores, build, staging *Ready* en `gru1`). Comando [Vos]: `git push origin ea9326b8f071194ccbb861388f0b8294ec891d7f:main`.
- [x] Éxito: deploy *Ready*; `https://estured.com/` carga (popup de preapertura si A1 = on), `/login` carga, **sin** widget de "Simular usuario" en la esquina. **Publicado el 2026-11-25:** `ea9326b`, deploy `dpl_63XVtaM6qV7vhNXTy1AnvLw3RoaG` en `gru1`; popup visible, `/login` 200, sin selector demo, 0 errores de runtime en los primeros minutos. El servidor se conecta a `hioscbefryufsbypsmtx`: lee los conteos de preregistro y fundadoras (200) y escribe `exchange_rates` (201).

---

## Publicar cambios después del primer deploy
1. El cambio se commitea y se sube a `staging`; se aprueba en `estured.vercel.app`.
2. [Yo] Listo los archivos de código que cambian y valido el commit exacto (typecheck, lint, build). Si trae migración: aplicarla en el Supabase de prod **antes** de publicar. Las variables nuevas se cargan en Vercel Production.
3. [Vos] `git push origin <commit validado>:main`. Publica **todo** lo que haya en `staging` hasta ese commit. Los datos de dev no viajan.
4. Si en `staging` hay algo sin terminar: esperar, o [Yo] armar una rama desde `main` con solo los commits elegidos y validarla aparte. Justo después de publicarla, [Yo] mergeo `main` en `staging` y lo pusheo: si no, el próximo push a `main` falla por *non-fast-forward*.
5. Cada push a `main` crea un deployment nuevo. Rollback en Vercel (*Instant Rollback*; en Hobby solo al anterior). No revierte la base.

- [x] **Publicado el 2026-11-26:** `463f165` (imagen de la vista previa del link, y cartel y enlaces legales del popup). Deploy `dpl_2cQGqUh9QwcUfg7RhiSpuoNZbD62` en `gru1`. Verificado: `og:image` en `estured.com` (`/`, `/preregistro`, `/for-residences`, `/guias`, una guía, `/nosotros`, `/terms`) e imagen 200 `image/png` de 28 KB. Sin fichas de residencia en prod.
- [x] **Publicado el 2026-11-26:** `77c5533` (bloque A del popup, DR67; textos DR68; apertura con el sello; ajustes DR71). Autorizado por el dueño. Verificado en `estured.com` (celular): popup con margen, título «Reservá…», tarjeta de fundadoras centrada y `/fundadoras` con «Sin costo para tu residencia.». Prod muestra «Solo 15 lugares» porque no hay fundadoras cargadas.
- [x] **Publicado el 2026-11-26:** `219cc86`, todo `staging`, autorizado por el dueño: versión de consentimiento de la preapertura `2026-11-26`, DR69 (desde el día 45 sin actualizar no entran solicitudes), ajustes de celular DR68 y apertura suave con «Reducir movimiento». Build validado en worktree limpio. Verificado: `/`, `/fundadoras`, `/preregistro`, `/terms` y `/privacy` en 200; Privacidad dice «vigente desde el 26 de noviembre de 2026».
- [x] **Publicado el 2026-11-26:** `0373a59`, pedido directo del dueño: la apertura con el sello se ve al cargar, antes del popup. Verificado en `estured.com`: la capa cubre el popup y frena los clics mientras se ve; al terminar, los clics llegan al popup. Sin botón de dev. Rollback: *Instant Rollback* en Vercel al deploy de `219cc86`.
- [x] **Publicado el 2026-11-27 (19:40):** `150c334` (mismos archivos que `eca0a46` más los mails `89f8544`): pesos y pago (DR72–DR74), footer, copys, popup y campos (DR75), vista previa de la ficha. Autorizado y corrido por el dueño. Antes: typecheck, lint, build, `npm audit`; suite 3143 pasan y 2 archivos fallan igual en `main`. Deploy `dpl_ApeXsq5Dv785uCc3epjW64MVpLPM` *Ready* en `gru1`. Verificado en `estured.com` (390 y 1366 px): 11 rutas en 200 sin scroll horizontal, `/search` → `/preregistro`, `/terms` y condiciones del 27/11, 7 imágenes de `/email/`, sin pedidos a Meta sin consentimiento, sin errores en logs. Sin probar: alta real, bienvenida, teclado en teléfono, cron y push. `main` mergeado en `staging` (`1b844ea`). Vuelta atrás: *Instant Rollback* al deploy de `89f8544` (`dpl_t6wYFaJ3YEaPp6DL4BetfAqP23Mp`); vuelven los textos legales anteriores.
- [x] **Pesos y pago, fase 3 (DR73, DR74), publicado el 2026-11-27.** Probado en dev el 2026-11-27: alertas 36/24/12/6 h (app y mail a un buzón de prueba de Resend). Sin probar: cron y push en un dispositivo. Controles previos:
  - [x] **Migración 0112** en prod: aplicada el 2026-11-27 desde el SQL Editor y verificada.
  - [x] **[Vos]** (2026-11-27) Aviso del cambio de `/terms`: sin destinatarios reales (cuentas de prueba, confirmado por el dueño). Rige el 27/11.
- [ ] **WhatsApp [Vos]:** mandar `https://estured.com/?v=2`: debe salir la imagen grande.
- [ ] **Popup nuevo (DR67, bloque A), en `staging`.** Verificado el 2026-11-26 en `5480bae`: botón de fundadoras visible en celular (también con aviso de cookies, de 360×600 a 390×844), tarjeta al costado desde 1100 px, sin scroll horizontal a 320 px, y número, perfil y «Mi lugar» con una cuenta de prueba. Antes de pasarlo a `main`:
  - [x] **[Vos]** (2026-11-26, confirmado por el dueño) Hacer un alta real en `estured.vercel.app/preregistro` (el formulario tiene Turnstile; no se automatizó) y confirmar que termina en «Mi lugar» con número.
  - [x] **Migración 0111** en prod: aplicada el 2026-11-26 desde el SQL Editor (columna, trigger, secuencia desde 11, sin permisos para `anon`/`authenticated`; 0 filas al aplicarla). Antes: pegar `db/migrations/0111_preapertura_registration_number.sql` en el [SQL Editor](https://supabase.com/dashboard/project/hioscbefryufsbypsmtx/sql/new). Numera desde 11 a los estudiantes ya registrados. El código funciona sin ella (no muestra número). Quien se registre antes de aplicarla recibe número al aplicarla.
  - [x] **[Vos]** (2026-11-26) Confirmar que existe Instagram `@estured.residencias` (la pantalla final lo enlaza).
  - [x] **[Vos]** (2026-11-26: se sube la versión; `PREAPERTURA_LEGAL` = `2026-11-26` en `lib/legal/versions.ts`) Revisar el cambio en los Términos de la preapertura (`/terms`, `/consentimientos`): ya no nombran el rótulo «Ejemplo», hablan del número de registro y el retiro es «desde tu perfil». No cambié `PREAPERTURA_CONSENT_VERSION` ni la fecha en `lib/legal/versions.ts`: decidilo.
  - [x] **[Vos]** Autorizar la publicación en `main`. Hecho el 2026-11-26 (`77c5533`), con los otros puntos todavía abiertos.

## G. Post-deploy

- [ ] **Crear el admin real y el superadmin** (contraseñas de 12+ caracteres; credenciales del proyecto nuevo solo en esa invocación): **Camino sin Terminal (recomendado):** [Vos] Supabase → Authentication → Users → *Add user* → *Create new user* (email, contraseña de 12+ y *Auto Confirm User*; usar un email distinto al del preregistro de prueba). [Yo] En SQL Editor, con ese email: `with u as (select id, lower(email) email from auth.users where email = lower('TU-EMAIL')), a as (insert into public.users (id, email, primary_role) select id, email, 'superadmin' from u on conflict (id) do update set primary_role = 'superadmin' returning id, email), r as (insert into public.user_roles (user_id, role, scope_type) select id, 'superadmin', 'global' from a on conflict (user_id, role, scope_type, scope_id) do nothing) insert into public.audit_logs (actor_role, action, entity_type, entity_id, is_system_action, source, new_value) select 'system', 'admin_user_created', 'users', id, true, 'admin', jsonb_build_object('email', email, 'role', 'superadmin') from a returning entity_id;` (devuelve 1 fila). Después, enrolar MFA en `/admin-mfa`. Alternativa por Terminal:
  ```bash
  read -rs 'SR?Secret key de prod: ' && read -rs 'PW?Contraseña del admin: ' && SUPABASE_SERVICE_ROLE_KEY=$SR NEXT_PUBLIC_SUPABASE_URL=https://hioscbefryufsbypsmtx.supabase.co node scripts/create-admin.mjs TU-EMAIL "$PW" --superadmin; unset SR PW
  ```
  Éxito: login en `/login` y acceso a `/admin/dashboard`. Un `--superadmin` también puede hacer todo lo del admin; crear un `admin` común aparte solo si lo necesitás.
- [ ] **Datos de cobro:** `/admin/payment-settings` (titular, CBU/alias, CUIT, banco).
- [x] **Exposición con anon key** (solo lectura): crear un archivo fuera del repo con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` de prod y correr `node --env-file=<ese archivo> scripts/check-anon-exposure.mjs --allow-production` → exit 0. No usar `.env.local` (apunta a dev). Hecho el 2026-11-25: exit 0.
- [ ] **Advisors de Supabase** (Dashboard → Advisors → Security): solo los esperados (tablas con RLS y sin policies a propósito, helpers `SECURITY DEFINER` de RLS, `pg_net` en `public`; `auth_leaked_password_protection` hasta pasar a Pro).
- [ ] **Cron:** `GET https://estured.com/api/cron/expire-stale-records` sin header → 401/403; con `Authorization: Bearer <CRON_SECRET>` → 200. Pasada la primera hora: `select status, return_message from cron.job_run_details order by start_time desc limit 3;` y `select status_code from net._http_response order by created desc limit 3;` → 200. 2026-11-25: sin header → 401. Falta el resto.
- [ ] **Tipo de cambio:** `/admin/exchange-rate` muestra un valor del día (monedapi.ar); si falla, cargar override manual.
- [ ] **CAPTCHA y límites:** el widget aparece y funciona en `/login` y `/forgot-password`; con el widget sin resolver el envío se rechaza; una ráfaga de logins fallidos devuelve «Hiciste muchos intentos». El alta de residencias (`/register/residence`) también pide CAPTCHA. 2026-11-25: el widget aparece y valida del lado del navegador en `/login` y `/preregistro` (la verificación del servidor todavía no corrió) (la consola registró un error `600010` de Turnstile con el navegador automatizado; repetir en un navegador común). Falta probar `/forgot-password`, el rechazo sin resolver, la ráfaga y `/register/residence`.
- [ ] **Cookies y headers** (DevTools o `curl -sI https://estured.com`): cookies `sb-*` HttpOnly y Secure; `Content-Security-Policy-Report-Only` (con `report-uri /api/csp-report`), `Strict-Transport-Security`, `Permissions-Policy`; sin `X-Powered-By`. 2026-11-25: headers OK (CSP *Report-Only*, HSTS, `Permissions-Policy`, sin `X-Powered-By`). Faltan las cookies (requiere sesión).
- [ ] **Reset de contraseña de punta a punta** (llega el mail desde `no-reply@estured.com` y el link abre `/reset-password` en `estured.com`).
- [ ] **Mails:** una solicitud de fundadora de prueba (`/register/residence`) manda el mail de confirmación a una casilla externa (revisar spam; si cae en spam, revisar SPF/DKIM en Resend).
  - 2026-11-26: dominio *Verified* y DNS públicos OK (DKIM, SPF y MX en `send.`, DMARC `p=none`). Variables de mail presentes en Production. Producción todavía no envió ningún mail (los dos rechazos revisados en Resend usan el remitente sandbox, de desarrollo).
  - 2026-11-26, primer intento del dueño: no guardó nada (0 solicitudes y 0 intentos a las ~15:38 UTC). Causa sin determinar.
  - 2026-11-26 18:06 UTC, segundo intento: la solicitud «prueba» **se guardó** (recuadro de fundadora visible) y el mail **falló**: `[email] envío falló: validation_error API key is invalid`. El `RESEND_API_KEY` de Production no es válido.
  - [x] **[Vos]** (2026-11-27) Crear una API key nueva en Resend (*Sending access*, dominio `estured.com`), pegarla en Vercel → `RESEND_API_KEY` (Production) y hacer *Redeploy*. Después [Yo] borro la solicitud «prueba» (con tu OK) y repetimos el envío.
  - 2026-11-27: la clave sigue sin cambiar (`RESEND_API_KEY` sin ediciones desde el 2026-11-25; Resend sin clave nueva). La prueba MCP a la casilla del dueño no la valida.
  - 2026-11-27 **[Yo]**: mails con diseño nuevo en `staging` (confirmación a residencia, invitación del familiar, confirmación de cuenta) e imágenes en `public/email/`. Falta aprobación de textos y publicar en `main`. Vista: `design-proposals/mails-2026-11-27/vista.html`.
  - ⚠ Impacto mientras la clave sea inválida: la residencia ve éxito y no recibe mail; **todo preregistro familiar falla** (se deshace la cuenta y muestra «No pudimos enviar la invitación»).
  - 2026-11-27: commit `e78a6be` en `staging`; las 4 imágenes responden 200 `image/png` en `estured.vercel.app/email/`. Consulta en prod: única solicitud de residencia = «prueba»; sin intentos familiares desde el 2026-11-26.
  - [x] **[Yo]** Con la clave pegada: *Redeploy* de Production, repetir el envío real, revisar Resend y logs, y listar `residence_signup_requests` desde el 2026-11-26 (contactar a mano a quien no recibió mail).
  - 2026-11-27: clave `estured-prod-2` cargada por el dueño; **[Yo]** *Redeploy* de `e8c2616` (`dpl_Adh7yATHv8f4dsJ3f192E9AN4LaF`, READY, alias `estured.com`; 200 en `/`, `/preregistro`, `/preregistro/familiar`, `/fundadoras/datos`). Falta el envío real de prueba. Después, borrar en Resend la clave vieja `estured-prod-sending` (con OK).
  - 2026-11-27 04:02 UTC: el envío «prueba 2» no dejó rastro (sin fila en prod ni en dev, sin intentos en `rate_limit_hits`, sin error en logs, sin pedido a Resend). Es el segundo envío sin rastro; el campo trampa `company_site` sigue como sospecha sin confirmar.
  - [x] **2026-11-27 04:19 UTC: envío real OK.** «prueba 2» guardada; mail `Recibimos la solicitud de prueba 2` *delivered* desde `EstuRed <no-reply@estured.com>`, `replyTo` `hola@`. Sin errores en logs. El dueño confirmó que llegó a la bandeja de entrada (Gmail).
  - [x] **[Yo]** (2026-11-27, con OK del dueño) Las 2 solicitudes de prueba quedaron `discarded` por SQL Editor de prod (sin borrar; sin fila de auditoría). 0 solicitudes de otras residencias. `/fundadoras` ya no dice «Ya hay residencias registrándose».
  - [x] **[Vos]** (2026-11-27) Diseño y textos de los 4 mails nuevos **aprobados** (3 muestras *delivered* a tu Gmail + texto de «Confirmá tu email»). Falta publicarlos en `main`: solo `e78a6be`, porque `staging` tiene otros cambios sin publicar.
  - ⚠ Hallazgo 2026-11-27: el preregistro de estudiante (`/preregistro`) **no manda ningún mail**. «Confirmá tu email» es del registro completo, que hoy redirige a `/preregistro`. El mail de bienvenida es del bloque B (DR67), sin implementar.
  - ⚠ Resend plan actual: 100 mails por día, 3000 por mes. Si se llena, falla la invitación y se deshace el alta del familiar. Revisar el plan antes de pautar anuncios.
  - 2026-11-27 **[Yo]**: mail de bienvenida al estudiante (DR67 (j)) en `staging`, versiones adulto y menor invitado; usa parte del mismo cupo diario. Sin sesión, `/preregistro/perfil` ahora lleva a `/login` y vuelve. Para publicar: los commits de mails (`e78a6be` y el de bienvenida), no todo `staging`. El número sale porque la migración 0111 ya está en prod (2026-11-26). Verificado en `staging` (`27d071d`): imagen 200 y redirección; `estured.com/login?next=…` responde 200. Sin probar: `main` + esos dos commits solos (armar rama y validar antes de dar el push; ordenar con el push de Meta pendiente).
  - 2026-11-27 **[Yo]**: cambios del dueño en la bienvenida e Instagram en todos los mails, en `staging`. Sumar ese commit a la publicación. La plantilla `docs/mail/recuperar-contrasena.html` cambió: pegar la versión nueva en Supabase.
  - [ ] **[Vos]** (2026-11-27) Decidir: el casillero del paso 1, Términos y Privacidad dicen que las residencias verificadas ven la búsqueda. Dijiste que no va a pasar. Corregir antes de pautar anuncios.
  - [x] **[Vos]** (2026-11-27) Bienvenida **aprobada con correcciones**. **[Yo]** aplicadas en `staging`. Commits de mails a publicar, en orden: `e78a6be`, `18d9205`, `29c5611`, `6a4dbee`, `11fc9f5`. `scripts/generate-email-images.mjs` recorta la captura de `58db926`: publicarla también, o no regenerar imágenes en `main`. Sin probar solos sobre `main`. Pegar en Supabase la plantilla `docs/mail/recuperar-contrasena.html` de `6a4dbee`, después de publicar.
  - [x] **[Vos]** (2026-11-27) La bienvenida sale con «y por WhatsApp». Decidido sabiendo que todavía no se pide teléfono.
  - [ ] **Antes de abrir (WhatsApp):** pedir teléfono con consentimiento y actualizar `/terms` §24, Privacidad y versión (DR67, bloque B). A quien se registró sin teléfono, avisar por mail.
  - [x] **[Yo]** (2026-11-27) Rama local `publicar/mails-2026-11-27` = `main` (`4f82924`) + los 5 commits de mails (punta `89f8544`; `MEMORY.md` queda como en `main`). Sin migración ni variables nuevas. Typecheck, lint, build y `npm audit` en verde. Suite: 3100 tests pasan; 3 archivos fallan igual en `main` (`expireNegotiationProposals`, `expireContactEstablished`, `support`): usan a Lucía, con una solicitud demo activa del seed de fase 3.
  - [x] **[Vos]** (2026-11-27) Publicado: `git push origin 89f8544:main` (`4f82924..89f8544`).
  - [x] **[Yo]** (2026-11-27) Tras publicar: `main` mergeado en `staging` (`4f7b154`, sin cambios de archivos) y pusheado. Deploy `dpl_t6wYFaJ3YEaPp6DL4BetfAqP23Mp` *Ready* en `gru1`, alias `estured.com`. Las 7 imágenes de `estured.com/email/` responden 200 y son idénticas a las del commit. `/`, `/preregistro`, `/preregistro/familiar`, `/fundadoras/datos` y `/login` en 200; `/preregistro/perfil` redirige a `/login`. Logs: solo avisos esperados de visitas sin sesión.
  - [ ] **[Vos]** Alta de prueba en `estured.com/preregistro` con tu mail, para ver la bienvenida real. **[Yo]** Verificar el envío en Resend y en logs.
  - [ ] **[Vos]** Supabase de prod: activar SMTP propio y pegar `docs/mail/recuperar-contrasena.html` en *Reset Password* (asunto «Cambiá tu contraseña de EstuRed»). Las imágenes ya están publicadas.
  - [x] **[Yo]** (2026-11-27) Los 3 tests usan estudiantes descartables y pasan dos veces seguidas contra dev (`c973e0e`, en `staging`). `support.test.ts` ya no borra los avisos de soporte del seed. `main` y la rama de mails siguen con las 3 fallas hasta publicar ese commit.
  - [x] **Copys, banderas e ícono (DR67 (k)), publicados el 2026-11-27:** `7a568f2`, `173e78d`, `cf80a1e`, `58db926`. Sin migración ni variables. `7a568f2` toca el footer nuevo: publicar después de `24debb8` y `803a092`. Banderas de los datos demo cambiadas solo en `estured-dev`.
- [x] **Migración 0112** en prod (alertas del plazo de pago, DR74): aplicada el 2026-11-27 desde el SQL Editor (2 columnas y el check; `anon` y `authenticated` sin lectura ni escritura; 0 filas al aplicarla).
- [x] **Aviso de cambio de `/terms`** (versión 2026-11-27, DR73: un caso de Soporte sobre el pago frena el vencimiento; plazo nuevo de 24 h): avisar a los usuarios registrados antes de que rija (`/terms` §30), junto con el aviso de DR72. Cambia también `/terms/residencias` (§5): a las residencias, por email (§13). Publicado y vigente desde el 2026-11-27. Mails sin enviar: no había destinatarios reales (dueño). Texto: `docs/propuestas/AVISO_TERMINOS_2026-11-27.md`.
- [ ] **Smoke test por rol** con cuentas reales de prueba creadas por el flujo (no seeds): visitante (`/`, `/for-residences`, `/guias`, `/terms`, `/privacy`, `/verify/<inválido>` = 404 limpio); preregistro estudiante y familiar; residencia (solicitud de alta → cola de admin → invitación); admin (verificar una residencia, `/admin/support-cases`). Si se abrió el sitio completo (A1 = vacío): solicitud → aprobación → pago del fee → comprobante PDF → mail. 2026-11-25, visitante: rutas públicas 200, URL inexistente 404, `/search` → `/preregistro`, `www` 308. `/verify/<inválido>` muestra «No encontramos ese comprobante» pero responde 200, no 404 (igual en staging). **Preregistro de estudiante probado por el dueño el 2026-11-25 (22:36 AR):** 1 cuenta, 1 fila y 4 consentimientos en prod; el anti-bots del servidor pasó. **El alta de estudiante no manda ningún mail** (el código solo manda en fundadoras y en la invitación de un familiar; la bienvenida llega con DR67, bloque B). Envío de mails todavía sin probar. La cuenta de prueba se borró el 2026-11-25 con OK del dueño (`auth.users`, en cascada): prod quedó en 0 cuentas, 0 registros y 0 consentimientos.
- [ ] **Residencias reales:** coordenadas exactas por residencia en `/admin/residences/[id]` (sin ellas la ficha cae al centro del barrio). El seed del CRM (`scripts/seed-crm-residencias.mjs`) necesita `scripts/data/crm-residencias/` en la máquina que lo corre (no viaja con el repo) y la guarda `_assert-dev-project.mjs`: no corre contra prod; la carga a prod es por el flujo normal o un script específico.
- [ ] **Cuentas de prueba:** borrarlas antes de abrir al público.
- [ ] **Monitoreo:** mirar los logs de Vercel por líneas `[csp-report]` (violaciones de CSP) y `[rate-limit]` / `[turnstile]` (errores de configuración).
- [ ] **Auditoría final de seguridad con la skill `security-audit` (modo auditoría completa, no guía):** antes de abrir al público, sobre el código desplegado y las policies de prod. Consume muchos tokens: correrla con aprobación explícita, en una sesión propia. Resultado en `docs/audits/` y hallazgos críticos o altos resueltos antes de cerrar. [Yo con vos].
- [ ] **Actualizar docs:** `MEMORY.md`, `docs/NEXT_STEPS.md`, `docs/audits/PLAN_SEGURIDAD_2026-11-12.md`, `CLAUDE.md` (migraciones y dominio) [Yo].

---

## H. Rollback por paso

| Paso | Rollback |
|---|---|
| Proyecto Supabase nuevo | borrarlo desde Dashboard (no tiene datos aún); el `estured-prod` viejo se da de baja en A0.1 (sin rollback a la base anterior: no había datos reales) |
| Bootstrap (D1) | no es re-ejecutable: vaciar el proyecto (borrar y recrearlo es lo más limpio) |
| Buckets | borrar los buckets vacíos desde Dashboard |
| Variables de Vercel | restaurar el valor anterior y redeploy (las `NEXT_PUBLIC_*` requieren rebuild) |
| Dominio | quitarlo de Vercel y volver los registros de Hostinger; el sitio sigue en `*.vercel.app` |
| Deploy | Vercel → Deployments → *Instant Rollback* al deploy anterior (la base nueva es compatible hacia adelante, no hacia atrás) |
| Cron | `select cron.unschedule('expire-stale-records-hourly');` |
| Admin / datos de cobro | borrar el usuario desde Authentication; el cobro se edita desde `/admin/payment-settings` |

---

## I. Pendientes para abrir el sitio completo (no bloquean la preapertura; sí el lanzamiento público)

- [ ] **Verificación de email (decidido 2026-11-12, opción C):** durante la preapertura las cuentas se crean con `email_confirm: true` (riesgo aceptado: mitigado por Turnstile + rate limit). **Requisito para abrir:** link de verificación a cuentas existentes y nuevas, y exigir email verificado antes de crear solicitudes, pagar o contactar residencias. Necesita el SMTP propio de D3.
- [ ] **Apagar `PREAPERTURA`** (y redeploy) para abrir `/search`, `/register`, etc.
- [ ] **Asesoría legal** de `/terms` y `/privacy` (borradores; Ley 25.326, registro de bases ante la AAIP si corresponde).
- [ ] **Razón social / CUIT** en términos, footer, comprobantes y datos de cobro.
- [ ] **Facturación fiscal real** (hoy el fee es por transferencia manual; `docs/00` §14.3).
- [ ] **Proveedor de teselas con clave** en vez de `tile.openstreetmap.org` (cambio de código + variable; la política de OSM no es apta para tráfico masivo).
- [ ] **CSP a enforce** tras unas semanas sin violaciones legítimas en los logs (`[csp-report]`): cambiar el header en `next.config.ts` y retirar `app/api/csp-report` (M5/S2).
- [ ] **S4** (login no atómico): aceptado; revisar si aparece abuso.
- [ ] **Aviso «Ya hay una cuenta con ese email»** en `/preregistro` (revela qué emails existen; aceptado por el alta con autologin).
- [ ] **Google SSO (DR26):** fuera del MVP; si se decide, el switch de altas de D3 tiene que volver a encenderse y cerrar el alta por email de otra forma.
- [ ] **Pasar a Supabase Pro y Vercel Pro (A2)** antes de abrir/cobrar. **Monitoreo y backups:** alertas de errores (Vercel logs/Sentry), revisión de `cron.job_run_details`, backups de Supabase (según plan).
- [ ] **WAF de Vercel** como segunda capa opcional sobre las rutas públicas.

## Migraciones 0093 y 0094 (2026-11-17)
- **0093** (plazas atómicas vía RPC `decrement_profile_availability` + trigger del tope de 2 solicitudes activas) y **0094** (índices parciales de expiración). Aplicar en dev (SQL Editor) y entrar en el bootstrap de prod: `node scripts/build-bootstrap.mjs prod` las toma solas (esperar 0001–0094). El código ya llama a la RPC: aplicar 0093 en cada proyecto ANTES de desplegar a ese entorno, o la confirmación de reserva no descuenta plazas (solo loguea error).

## Migraciones 0095, 0096 y 0097 (2026-11-17): compartir la ficha, FAQ destacadas y foto principal
- **0095** `residence_share_messages` (mensaje de WhatsApp editable por residencia, RLS + policy `residence_share_messages_only_active_users`), **0096** `is_featured` / `featured_order` en `residence_faq_items` y `residence_faq_questions` (máx. 6 por residencia, trigger) y **0097** `is_cover` en `residence_photo_meta` (índice único parcial: una por residencia). Las tres son aditivas e idempotentes, sin orden entre sí (necesitan 0003/0039/0054/0059/0081 ya aplicadas).
- **Aplicar en dev (SQL Editor, https://supabase.com/dashboard/project/gyfbtsuibmecefwovdgh/sql/new) y, por separado, en el proyecto de producción** (pegar cada archivo y Run); en prod entran solas con `node scripts/build-bootstrap.mjs prod` (esperar 0001–0097).
- **Aplicarlas en `estured-dev` ANTES de pushear `staging`**: el código lee las columnas nuevas (la ficha pública, el perfil y el panel de Preguntas). Si faltan degrada (destaca las primeras 6, la portada sigue siendo la primera de las que rotan, «Compartir ficha» comparte el mensaje original y avisa que guardar todavía no está disponible), pero no se prueba la función real hasta aplicarlas.
- Datos demo: `node --env-file=.env.local scripts/seed-demo-share-featured.mjs` (aditivo, no borra nada; se salta cada parte si falta su migración).
- `scripts/seed-dev-fichas-completas.mjs` es SOLO para desarrollo (completa reglas, FAQ, condiciones y habitaciones demo para revisar el diseño de la ficha): NO se corre en producción, donde cada residencia carga sus datos (la guarda `_assert-dev-project.mjs` lo impide).
- Sin variables nuevas. El link que se comparte usa `NEXT_PUBLIC_APP_URL` (o `NEXT_PUBLIC_SITE_URL`); en prod tiene que apuntar al dominio real, si no, cae a `https://estured.vercel.app` (`lib/share/shareLink.ts`).

---

## Push web (DR61, 2026-11-20): migración 0101, claves VAPID y pruebas

- [ ] **Migración 0101** (`db/migrations/0101_push_notifications.sql`): entra sola con el bootstrap de prod (`node scripts/build-bootstrap.mjs prod --host=estured.com`). En dev se pega a mano: https://supabase.com/dashboard/project/gyfbtsuibmecefwovdgh/sql/new. Sin ella el aviso in-app sale igual y el push no envía nada (degrada sin error). La 0100 (documento de identidad) es de otra rama y es independiente.
- [ ] **Migración 0103** (`db/migrations/0103_support_topic_residence_payment.sql`, DR63 fase 5): agrega el topic `residence_payment` a Soporte. Entra sola con el bootstrap de prod. En dev ya está aplicada. Sin ella la disputa «No recibí el pago» y la alerta de 72 h funcionan, pero sin caso de Soporte. Requiere 0102 para el resto de DR63.
- [ ] **Migración 0104** (`db/migrations/0104_payment_hardening_dispute_reason_and_case_unique.sql`, DR63 fase 5, revisión de seguridad): saca `dispute_reason` de la API y crea el índice único de casos `residence_payment` abiertos. Entra sola con el bootstrap de prod (después de 0102 y 0103). En dev ya está aplicada. Sin ella la app funciona, pero `dispute_reason` queda legible para estudiante y familiar.
- [ ] **Migración 0105** (`db/migrations/0105_estured_fee_collection.sql`, DR64, Pista 2 paso A): tabla `estured_fee_collection_methods` (medios de cobro del fee de EstuRed, solo service role) y 12 columnas nuevas en `estured_fee_payments`. Entra sola con el bootstrap de prod. En dev ya está aplicada. Tras armar prod, un superadmin carga los medios del fee en `/admin/payment-settings` cuando esté el paso B (código). Hasta entonces rige `payment_settings`.
- [ ] **Migración 0108** (`db/migrations/0108_estured_fee_collection_hardening.sql`, DR64, revisión de seguridad): revoca a `authenticated` las 4 columnas de DR64 que 0105 había concedido (`chosen_method`, `student_reported_paid_at`, `student_payment_issue_at`, `student_payment_issue_resolved_at`) y crea el índice único parcial `support_cases_estured_fee_payment_open_uniq` (un caso abierto por reserva). Entra sola con el bootstrap de prod (después de 0105). Si prod ya existe, pegala en el SQL Editor. Idempotente; si hay casos duplicados abiertos avisa con un NOTICE y no crea el índice. En dev ya está aplicada.
- [ ] **Claves VAPID por entorno** (Vercel, sección E): un par para Preview/staging y otro distinto para Production. Una suscripción creada con un par no sirve con otro: si se cambian las claves, hay que volver a activar los avisos en cada dispositivo. `.env.local` ya tiene un par de desarrollo.
- [ ] **Cron de las 9:00:** los push generados entre las 0:00 y las 8:59 (Argentina) quedan en cola y los envía el cron horario existente (`/api/cron/expire-stale-records`, `pg_cron` de la migración 0013). **En staging no hay cron ni `CRON_SECRET`**: allí lo encolado no sale. Para probarlo, llamá al endpoint a mano con el secreto desde un entorno que lo tenga, o probá de día.
- [ ] **Probar en celular real** (HTTPS; en el Preview de `staging`): Android Chrome (instalar, activar avisos, recibir y tocar el aviso, contador del ícono) e iPhone con la app en la pantalla de inicio (iOS 16.4+). Chequear: sin datos personales en la pantalla bloqueada, que el aviso lleve al inicio del área y que el contador baje al leer en la campana.
- [ ] **Publicar `/instalar`:** el DR de esa página dice que no se publica hasta que el push esté activo. Cuando la prueba en celular salga bien, se puede publicar.
- [ ] **Límites conocidos:** «pago rechazado», «comprobante subido a la residencia» y la baja de cuenta no tienen flujo (no avisan). `notifyWaitlistAvailability` inserta directo y no dispara push. El cierre de sesión revoca las suscripciones del mismo navegador (mismo `user_agent`).

## J. SEO (auditoría 2026-11-18, informe en `docs/audits/SEO_2026-11-18.md`)

**Ya aplicado en `staging` (bloque técnico, copy aprobado, schema de ficha, `llms.txt`, robots):** `metadataBase`, canonical y OG por página, JSON-LD Organization/WebSite/LodgingBusiness/BreadcrumbList/FAQPage, sitemap sin `-demo`, `noindex` en `/login` y fichas `-demo`, `/llms.txt`, robots con crawlers de IA permitidos.

**Al desplegar (verificar):**
- [ ] `NEXT_PUBLIC_SITE_URL=https://estured.com` en Production (ya está en la tabla de E). **`app/robots.ts` cierra todo con `Disallow: /` si el host no es `estured.com`:** staging y previews deben tener su propia URL en esa variable (así no se indexan); si Production quedara con otro valor, el sitio entero saldría bloqueado a Google.
- [ ] `https://estured.com/robots.txt` muestra `Allow: /` + Disallow de áreas privadas + bloques de crawlers de IA + `Sitemap`; `/sitemap.xml` sin `-demo` y con host `estured.com`; `/llms.txt` responde 200.
- [ ] En una ficha: `og:image`, `canonical` y `og:url` absolutos con `estured.com` (ya no el host de staging); `curl -s https://estured.com/residencias/<slug> | grep -o 'og:image[^>]*'`.
- [ ] Rich Results Test de Google sobre una ficha (LodgingBusiness, FAQPage, BreadcrumbList) y una guía (Article).
- [ ] **Search Console y Bing Webmaster Tools (el mismo día del despliegue en `estured.com`):** el dueño crea las dos cuentas (Claude no puede) y agrega el registro TXT de verificación en el DNS de Hostinger; luego enviar `sitemap.xml` y revisar Cobertura a la semana.
- [ ] **Solo residencias reales en prod:** el sitemap lista las `verified_active`; sin demos (el prod nuevo nace sin seeds).
- [ ] **Preapertura:** con `PREAPERTURA=on`, `/` sirve la página de preapertura (title «acceso anticipado…», 2 H1, sin canonical/OG/JSON-LD). Aceptado mientras sea temporal; al apagarla, la home real ya tiene canonical, OG del layout y FAQPage. Si la preapertura se alarga, darle canonical + OG + un solo H1.
- [ ] Medir **Core Web Vitals reales** (PageSpeed/CrUX) de `/`, `/search` y una ficha una vez en `estured.com`; el informe SEO solo pudo estimarlos.

**Pendientes del informe (no bloquean salir; sí conviene antes del lanzamiento público):**
- [ ] **Caché de páginas públicas (hecho en código 2026-11-18):** el layout público ya no lee la sesión; con `DEMO_LOGIN_ENABLED` apagado (producción) `/guias`, `/guias/[slug]`, `/terms`, `/privacy` y `/for-residences` se prerenderizan. **Verificar en prod:** `curl -sI https://estured.com/guias` → `x-vercel-cache: HIT` (tras la 2.ª visita) y sin `no-store`; estando logueado, el footer no muestra «Crear cuenta». En staging (demo encendida) siguen dinámicas: es esperado. `/`, `/search`, `/for-students` y fichas siguen dinámicas a propósito (dependen del visitante); cachearlas sería un cambio de producto aparte.
- [ ] **`/nosotros` (creada 2026-11-18, con «Cómo verificamos»):** falta la sección **«quién soy y cómo surgió el proyecto»** (el dueño debe aportar 3–5 líneas; no se inventa) y revisar el texto antes de producción. Con ella, agregar `Person`/`founder` al JSON-LD de Organization (E-E-A-T).
- [ ] **Leyenda «Verificada en persona en [mes/año]» en la ficha (C-07):** la fecha existe en la base (`visited_at` de la verificación, interna). Hoy las fichas son ficticias: mostrarla cuando haya visitas reales, exponiendo solo ese dato a la ficha pública y enlazando a `/nosotros`.
- [ ] **Textos pendientes de aprobación** (`docs/audits/SEO_PROPUESTAS_COPY_2026-11-18.md`): 3 preguntas nuevas del FAQ de `/for-students` (C-09; la de familiares se descartó) y `updated_at` verificado en cada guía (C-06). El `FAQPage` de las 4 existentes ya está aplicado.
- [ ] **Guías por barrio y universidad** (T-11, cluster local; enlazar a `/search` y fichas).
- [ ] **`sameAs` de Organization:** el dueño aún no tiene Instagram oficial (y probablemente no habrá LinkedIn). **Antes de pasar a producción:** crear la cuenta de Instagram y pasar la URL; luego agregarla a `lib/seo/siteJsonLd.ts`. `SearchAction` de WebSite solo si `/search` llega a soportar `?q=`.
- [x] **`favicon.ico`**, **`/.well-known/security.txt`** (contacto `CONTACT_EMAIL`) e **`ItemList`** en `/search` sin filtros (primeras 10 residencias, sin demos): hechos 2026-11-19. Verificar en prod: `/favicon.ico` 200, `/.well-known/security.txt` 200.
- [ ] **CSP a enforce** (ya figura en I): hoy está en Report-Only a propósito; pasarla a enforce solo tras revisar `/api/csp-report` en `estured.com` sin violaciones legítimas.
- [ ] **(Reconsiderar por la decisión anterior) Enlaces a barrios cercanos en la ficha (3 por ficha):** bloque «Otros barrios cerca de [barrio]» con 3 enlaces a `/search?barrio=…`, desde una tabla fija de barrios limítrofes de CABA (no por distancia). **Cuándo:** antes del lanzamiento público si ya hay residencias reales cargadas; si no, apenas las haya. Aporte SEO modesto hasta que existan las guías por barrio.
- [~] **Sugerencias de información y FAQs predeterminadas para residencias (decisión del dueño 2026-11-19):** el mecanismo YA existía (catálogo de 49 FAQs con respuesta sugerida, interruptor «Mostrar» y campos `{…}`, migraciones 0054/0056). Hecho 2026-11-19: etiqueta «Esencial» y contador «Esenciales listas: X de 6» en el panel de Preguntas (FAQ-07, 09, 36, 42, 43, 49). Hecho 2026-11-19: paso «Preguntas esenciales» en el checklist de onboarding (informativo, no bloquea el envío; `essentialFaqs` en `buildOnboardingChecklist`). **Pendiente:** (1) decidido por el dueño 2026-11-19: las esenciales se **recomiendan, no se exigen**, y hay que explicar por qué y para qué (texto aprobado y aplicado en el panel); (2) FAQ-36 «Qué llevar»: cargada en dev en las 13 residencias demo (`scripts/seed-demo-faq-que-llevar.mjs`); las residencias reales la completan ellas mismas **antes del lanzamiento** (la guía de mudanza ya remite a la ficha); (3) decisión del dueño 2026-11-19: no agregar temas al catálogo; en cambio **revisar cuáles descartar** lista aprobada: migración **0099** (desactiva 15; ver docs/06) — aplicada en dev el 2026-11-19 (quedan 33 activas de 51); **pendiente en producción** (se arma con el bootstrap); (4) revisar el texto del panel «Cuanto más respondas, más consultas vas a recibir por EstuRed», aclarado por el dueño: «consultas» = pedidos de reserva, no preguntas; propuesto «Cuanto más completa esté tu ficha, menos preguntas recibís y más reservas directas conseguís» — aprobado y aplicado 2026-11-19.
- [x] **Respuestas directas (GEO) al inicio de las 5 guías públicas:** aplicadas 2026-11-19. Las 2 correcciones de la guía de mudanza también se aplicaron. **Ojo:** ahora dice «Revisá en la ficha qué debés llevar»; antes de producción la ficha tiene que mostrar ese dato (ver sugerencias de información para residencias).
- [x] **Guía «Residencia o departamento compartido»:** aprobada y publicada 2026-11-19 (`content/guias/07-…`; el parser de guías ahora soporta tablas). Verificar en staging cómo se ve la tabla a 320 px y confirmar la frase de garantías de alquiler antes de producción.
- [x] **Guía «Barrios y universidades»: descartada (decisión del dueño 2026-11-19).** Compararía barrios y perjudicaría a las residencias de los que quedaran mal parados; además la mayoría de las residencias están en el centro, Balvanera y San Telmo, zonas que el dueño no aconseja para vivir, y no se puede ser neutral ni honesto sin dañar a alguien. No se publican valoraciones de barrios. Las guías nuevas se deciden después del lanzamiento con las búsquedas reales de Search Console.
- [ ] **Kit de 25 controles (ND1), pendientes pre-lanzamiento:** (22) **hecho 2026-11-22:** `.github/workflows/ci.yml` corre typecheck, lint, `npm audit --audit-level=high` y `npm test` (sin secretos: los tests de integración se saltean solos) en cada push y PR a `staging`/`main`; falta, al abrir el repo en GitHub, activar branch protection en `main` exigiendo que el check `CI / checks` pase y correr `npm test` completo contra estured-dev antes de promover; (24) ensayar una restauración de backup (pasar a Pro o `pg_dump` + restaurar en un proyecto vacío) y anotar el tiempo; (25) pedir revisión externa de seguridad antes de cobrar, con prueba cruzada entre cuentas; (09) la pasada anónima se hizo el 2026-11-25 y pasó; **[Vos]** completar la parte A/B de `docs/audits/FICHA_ACCESO_CRUZADO_2026-11-25.md`; en producción, verificar que el cron sin secreto responda 401. Matriz completa en `docs/audits/PLAN_SEGURIDAD_2026-11-12.md`.
- [ ] **Post-producción (seguridad):** `gitleaks` **hecho 2026-11-25** (historial completo, sin secretos reales; repetir antes de abrir el repo a más gente); pasar la CSP a enforce tras observar reportes; probar server actions por HTTP real en un preview sin SSO; reaperturas de renovaciones **corregidas 2026-11-25** (queda, bajo, verificar filas al actualizar la reserva en `reopenEsturedFeeWindow`, camino vencido). Detalle en `docs/audits/PLAN_SEGURIDAD_2026-11-12.md`.
- [ ] **Post-producción:** menciones externas (blogs universitarios, centros de estudiantes, comunidades) y, recién cuando existan menciones reales, evaluar una sección «Prensa» en `/nosotros`. Es trabajo de marketing, no de código.

## Auditoría pre-producción 2026-11-19 (informe: `docs/audits/PRUEBAS_PRE_PRODUCCION_2026-11-19.md`)
- [ ] **Migración 0098** (endurecimiento de funciones): aplicada en `estured-dev` el 2026-11-19. En prod entra sola con `node scripts/build-bootstrap.mjs prod`; si prod ya se armó, pegar `db/migrations/0098_security_hardening_functions.sql` en su SQL Editor. Verificación: `select has_function_privilege('authenticated','public.is_reservation_student(uuid)','execute');` → `false`.
- [ ] **Supabase → Authentication → Passwords → «Leaked password protection»:** activarla en producción (y en dev). Es un interruptor del panel, no se puede por SQL.
- [x] **Staging público — decisión del dueño 2026-11-20: se deja público, no se cierra.** (Hallazgo original: `estured.vercel.app` NO pide login de Vercel (el runbook A0.2 decía que sí) y tiene el selector demo: cualquiera entra como admin de `estured-dev`. Opciones descartadas: Vercel Authentication en Preview o apagar `DEMO_LOGIN_ENABLED`. No afecta producción (el selector no existe ahí).)
- [ ] **Antes de prod:** correr `npx playwright test` contra staging con las migraciones al día (E2E en `e2e/`; las sesiones se guardan fuera del repo) y, si se quiere carga, `k6 run -e AUTH_DIR=<carpeta de sesiones> -e PEAK=25 e2e/load/k6-lectura.js` (en staging: 25 usuarios simultáneos ok; 50 degrada a p95 4 s; no es capacidad de producción).

## Plan de acción tras las auditorías (2026-11-22)
Todo lo pendiente de las tres auditorías, ordenado por prioridad, en `docs/PLAN_ACCION_POST_AUDITORIAS_2026-11-22.md` (bloqueantes, migración 0107 de seguridad, performance y posterior al lanzamiento).

## Costos y abuso (2026-11-21; informe `docs/audits/COSTOS_ABUSO_2026-11-21.md`)
Sin hallazgos altos. Dos medios y cuatro bajos. Propuestas pendientes de aprobación.
- [ ] **C2 (medio): tope de gasto, alertas y WAF antes de abrir.** Los menús pueden cambiar de nombre; confirmar en cada panel.
  1. **Vercel → Team → Settings → Billing → Spend Management** (solo Pro): activar, fijar un tope mensual y avisos al 50, 75 y 100 %, con acción «pausar proyectos» al llegar al tope. En Hobby no hay cobro extra: al pasar el límite el servicio se frena. Es otra razón para pasar a Pro antes de cobrar (A2).
  2. **Vercel → Proyecto → Firewall:** regla de límite por IP en las rutas públicas (por ejemplo 100 requests por minuto por IP en `/search`, `/residencias/*` y `/api/*`), acción «Challenge» o «Deny». Activar «Attack Challenge Mode» solo si hay un ataque. Revisar cuántas reglas permite el plan.
  3. **Supabase → Organization → Billing:** dejar el *Spend Cap* activado (Pro) para que un pico no se facture. Revisar *Usage* de egress, base y storage cada semana el primer mes. Activar avisos de uso por mail.
  4. **Supabase → Authentication → Rate Limits:** confirmar límites de mails, SMS y registros por hora. Dejarlos igual o más bajos que los de la app.
  5. **Resend → Domains y Usage:** confirmar la cuota diaria del plan (Free: 100 por día y 3.000 por mes). Al llegar, los mails fallan. Pasar a un plan pago antes de la campaña de preapertura.
  6. **Cloudflare Turnstile:** sin cambios. Ya protege login, registro, preregistro y recuperar contraseña.
  7. **Alertas de errores:** decidir Sentry o las alertas de Vercel (P19-06). Sin esto, un abuso se nota recién en la factura.
  Verificación: tras activar todo, anotar en este runbook los topes elegidos (USD por mes, requests por minuto, mails por día).
- [x] **C1 (medio), parcial (2026-11-21):** catálogo ya cacheado (120 s); ahora también la ficha pública (60 s) y la imagen de vista previa (300 s). Un cambio de ficha, cupo o precio tarda hasta ese tiempo en verse. Queda abierto R19-04: `search`, `for-students` y la ficha siguen dinámicas por leer la sesión; hacerlas estáticas exige mover lo personal a componentes cliente.
- [x] **C3 (2026-11-21):** `lib/residents/inviteThrottle.ts` pasó a `consumeRateLimit` (persistente).
- [x] **C4 (2026-11-22):** límite de 10 cargas por hora por usuario en el comprobante del fee y en el de «Ya pagué» (`lib/security/uploadLimits.ts`).
- [x] **C5 (2026-11-21):** cuota diaria de mails por residencia (`lib/security/mailQuota.ts`: 100 avisos y 200 invitaciones por día). Solo corta el mail; el aviso en la app se crea igual.
- [x] **C6:** comentario de `app/api/session/route.ts` corregido (2026-11-21).
- [ ] Confirmar la cuota diaria del plan de Resend antes del registro masivo.

## Seguridad externa — Capa Cero (2026-11-20; informe `docs/audits/CAPA_CERO_DIAGNOSTICO_2026-11-20.md`)
- [x] Diagnóstico inicial gratuito hecho sobre staging. Único hallazgo: E-01, CSP en `Report-Only` con `unsafe-inline` (ya conocido, M5). Next.js 15.5.29 confirmada con los parches vigentes.
- [ ] **Decidir y contratar el pentest focalizado (USD 250)**, solo contra staging y con usuarios demo. Firmar antes NDA y orden de trabajo. Alcance: solicitudes, pagos, comprobantes y Storage con rol estudiante y rol residencia. No entregar claves de producción ni `SERVICE_ROLE_KEY`.
- [ ] Pasar a los pentesters la lista de hallazgos ya conocidos (ver el informe) para evitar duplicados.
- [x] **Versión de Next:** cotejar `package-lock.json` y el log del build de Vercel que se promueva a producción. Fijar versión exacta (hoy `^15.5.29`). 2026-11-25: el lock fija 15.5.29 y `npm audit --omit=dev` da 0 avisos; no se toca `package.json` antes del primer deploy. Falta mirar el log del build de producción. Log del build de producción: Next.js 15.5.29.
- [ ] **E-01:** pasar la CSP a enforce y quitar `unsafe-inline` con nonces o hashes, después de revisar `[csp-report]` en producción. Probar Turnstile, mapas y la caché de rutas públicas. Ya figura en I y en «Post-producción (seguridad)».
- Servicios descartados por ahora: auditoría de código (USD 550), pruebas de carga (USD 400), optimización (USD 450). Reevaluar con usuarios reales.

## Auditoría 2026-11-19 (4 fases): pasos que quedan
Informe: `docs/audits/AUDITORIA_PRE_PRODUCCION_2026-11-19.md`. No hay variables nuevas. Hay correcciones al runbook y tareas nuevas.

**Corregir el runbook**
- [ ] D1: el bootstrap llega a 0099 (100 archivos, con 0043b). Quitar los conteos "0001–0087", "87 migraciones" y "0001–0094/0097" (líneas 3, 91-95, 219).
- [ ] B: el merge a `main` sale de `staging`, no de `hardening/pre-produccion` (`origin/main` está 356 commits atrás).
- [ ] A0.2 contra línea 264: `estured.vercel.app` no pide login de Vercel hoy. El dueño decidió dejarlo público (2026-11-20); falta corregir el texto de A0.2 para que no prometa login de Vercel (S19-01).
- [ ] D3: "Leaked password protection" no existe en Free (A2). Decidir pasar a Pro antes de abrir o aceptar el riesgo por escrito (P19-07).
- [ ] E: verificar el nombre exacto de la variable que exige `lib/appUrl.ts:9` (`NEXT_PUBLIC_APP_URL`) y agregarlo a la tabla si falta (P19-04).

**Tareas nuevas antes de abrir (bloqueantes)**
- [x] Páginas de error en español (P19-05): `app/global-error.tsx` creado el 2026-11-25. `(preapertura)/error.tsx` no hace falta: `app/error.tsx` ya cubre esas rutas.
- [ ] Definir monitoreo: alertas de Vercel y guardia; Sentry opcional. Anotar la decisión (P19-06).
- [ ] Rendimiento: cachear el catálogo y quitar `force-dynamic` de `/` (R19-03, R19-04); quitar `animate.css` (R19-05). Repetir la carga con `e2e/load/k6-publica.js`; meta: 25 usuarios con p95 menor a 2 s.

**No bloqueantes**
- [x] Región de funciones en `gru1` (P19-13): `vercel.json`, 2026-11-25.
- [ ] Redactar errores de Supabase en los logs de registro y auth (S19-05, P19-17).
- [ ] CI mínimo con typecheck, lint y tests (P19-18).
- [ ] Agregar `scratchpad/` a `.gitignore` y `@source not` en `globals.css` (S19-06, R19-07).
- [ ] Aprobar o rechazar el borrado de 2 residencias de test en `estured-dev` (`cleanup-test-residences.mjs --apply`).

---

## K. Checklist de beta y lanzamiento (fusionado de docs 15 y 18, 2026-11-20)

Solo lo vigente y no cubierto arriba. Cada ítem se verificó contra el código o `docs/00`. Texto íntegro original en `docs/archive/15_ENVIRONMENT_AND_SETUP.md` y `docs/archive/18_RELEASE_AND_BETA_CHECKLIST.md`. Los ítems de abajo no cambian reglas de negocio.

**K1. Variables y entorno**
- [ ] `.env.example` coincide con la tabla de E (hoy lo hace). Incluye `GEOCODER_USER_AGENT` (geocodificación de direcciones con Nominatim, DF6; sin clave, máx. 1 req/s). No existen variables de MercadoPago, PayU, TusFacturas ni `QR_SECRET`: el fee se cobra por transferencia manual.
- [ ] Un proyecto Supabase por ambiente (dev, prod). Los datos demo y seeds jamás entran a producción.

**K2. QA antes de abrir (beta privada)**
- [ ] Flujo central completo al menos 3 veces en staging: búsqueda, solicitud, contacto, pago a residencia, «Pago recibido», fee, reserva confirmada, comprobante.
- [ ] Una corrida con propuesta del familiar (aprobada y rechazada) y otra con negociación (aceptada y rechazada, una sola propuesta de ajuste por solicitud).
- [ ] Un owner con 2 residencias no ve datos cruzados; el staff solo ve las asignadas.
- [ ] Un usuario sin permiso no accede a un documento privado.
- [ ] No hay bypass del fee: sin fee pagado no hay reserva confirmada ni comprobante. Fee vencido deja la reserva en `expired_fee_unpaid`.
- [ ] `/verify/<código>` válido muestra solo datos limitados; uno inválido da 404 limpio.
- [ ] Revocación del fee: enlace en el footer, pantalla y revisión en `/admin/revocations`; se bloquea fuera de los 10 días.
- [ ] El contacto con estudiantes menores se dirige al familiar vinculado.
- [ ] `npx playwright test` contra staging con las migraciones al día (ver «Antes de prod»).

**K3. Admin y seguridad**
- [ ] **2FA obligatorio para admin y superadmin** (decidido en `docs/00` §31 «desde la beta privada»). Código hecho (`6c58053`, DR65 (d)). Falta probarlo en producción: ver «Ola 0 de la auditoría legal».
- [ ] El admin puede operar sin tocar la base: solicitudes, pagos, comprobantes, soporte, propuestas del familiar, negociaciones y registro de acciones (`/admin/logs`).
- [ ] Toda acción crítica del admin queda en el registro de auditoría con motivo.

**K4. Residencias pioneras**
- [ ] No publicar una residencia sin: visita presencial hecha, condiciones y precio claros, disponibilidad o «completa» cargada, términos aceptados y responsable validado.
- [ ] Residencias reales con perfil completo, fotos y coordenadas exactas (ya en G). Las residencias capacitadas conocen el flujo, la negociación y su límite.
- [ ] Idealmente un owner con más de una residencia para ver el dashboard multi-residencia con datos reales.

**K5. Contenido y legal**
- [ ] Barrido de copy público: nada de «mediación» (decir «Soporte»), nada de «garantizado» ni «reserva garantizada», el fee explicado antes de enviar la solicitud, «solicitud sujeta a confirmación».
- [ ] Términos y privacidad visibles; aceptación específica de la residencia al marcar «Pago recibido», del estudiante antes de pagar el fee y al aprobar la propuesta del familiar (revisión legal en I).
- [ ] Soporte visible (`hola@estured.com`, A4) y alguien que lo lee.

**K6. Operación de la beta**
- [ ] Día de apertura: login admin, búsqueda, una solicitud de prueba (también por propuesta del familiar), notificaciones, logs de Vercel, dashboard admin. Congelar cambios no críticos.
- [ ] Primeras 48 h, revisión diaria: solicitudes sin respuesta, propuestas del familiar pendientes, errores de usuario y técnicos, dudas sobre el fee y el pago a la residencia, problemas mobile.
- [ ] Primera semana: conversión búsqueda, solicitud, contacto, pago a residencia, fee, comprobante; tiempo de respuesta de las residencias; motivos de rechazo; carga del admin.
- [ ] No escalar tráfico si las residencias no responden o la disponibilidad queda desactualizada de forma recurrente.

**K7. Incidentes y contingencia**
- [ ] Incidentes críticos: fee cobrado dos veces, residencia que ve datos de otra del mismo owner, una propuesta de ajuste duplicada, dato sensible expuesto.
- [ ] Respuesta: 1) pausar lo afectado; 2) registrar; 3) revisar el audit log; 4) contactar a las partes; 5) corregir el dato o estado; 6) documentar la causa; 7) test de regresión; 8) decidir si se reactiva.
- [ ] La operación manual desde el admin no pierde trazabilidad (rollback técnico en H).

**Rendimiento R19-03/04 aplicado (2026-11-20)**
- Catálogo cacheado 120 s (`lib/residences/catalog.ts`, tag `catalog`); un cambio de ficha o cupo tarda hasta 2 min en verse. `/` pasa a ISR de 60 s (`revalidate = 60`); la lectura automática del tipo de cambio ya no usa `no-store` (`lib/exchange/provider.ts`).
- `/` y `/preapertura` solo son estáticas con `DEMO_LOGIN_ENABLED` apagado (como en Production). En el Preview de `staging` (demo activo) siguen dinámicas: allí solo se nota el caché del catálogo.
- [ ] Repetir la carga con `e2e/load/k6-publica.js` tras el deploy. Meta: 25 usuarios con p95 menor a 2 s.
- Rendimiento R19-05/07 aplicado (2026-11-20): se quitó `animate.css` (`StaggerIn` usa `.stagger-in` y `@keyframes fade-in-left` en `globals.css`) y Tailwind excluye `scratchpad/`, `design-references/`, `design-proposals/`, `docs/` y `marketing/` con `@source not`. Build limpio: CSS global de 305 KB a 198 KB (gz 46,9 a 32,1 KB) y sin el chunk de 72 KB. Si el build de Vercel no puede leer Supabase, la home estática tarda más de 60 s y falla: dejar las variables de Supabase en Production antes del primer deploy.
- Rendimiento R19-08/09 aplicado (2026-11-20): la ficha pública ya no encadena rondas. `lib/residences/loadFicha.ts` firma el reglamento, lee el mes vacío y la disponibilidad por género en paralelo; `FichaView.tsx` arranca FAQ, reglamento, edad promedio y amenidades «Otro» junto con cotización y sesión. Sin cambio de datos ni de permisos. Latencia: no medida; repetir `e2e/load/k6-publica.js` tras el deploy.

## Ola 0 de la auditoría legal (2026-11-22 a 2026-11-25; DR65; informe `docs/audits/AUDITORIA_LEGAL_2026-11-21.md`)
- [ ] **[Vos] Casilla `hola@estured.com` creada y probada** (A4). Es el contacto y el email de privacidad publicados en `/terms#quienes-somos` y `/privacy`. `/privacy` promete responder acceso en 10 días corridos y rectificación o supresión en 5 hábiles.
- [ ] **[Vos] Migración 0109** (`db/migrations/0109_ola0_legal_collection_and_faq.sql`): entra sola con `node scripts/build-bootstrap.mjs prod`. Si prod ya existe, pegala en su SQL Editor. Promueve los datos de cobro pendientes (EstuRed ya no los aprueba, DR65 (c)) y quita «certificado de antecedentes» de la FAQ-11. Ya aplicada en dev.
- [ ] **[Vos] Migración 0110** (`db/migrations/0110_payment_reopen_cap_and_escalation.sql`, DR66, 2026-11-25): agrega `reopen_count` y `admin_escalated_at` a `external_residence_payments` y `estured_fee_payments` (tope de 2 reaperturas y escalado a los 7 días a los superadmin) y actualiza el comentario de `preferred_payment_method` («Otro»). Aditiva, idempotente, sin grants (solo service role). Necesita 0102 y 0105. Entra sola con `node scripts/build-bootstrap.mjs prod`; si prod ya existe, pegala en su SQL Editor (https://supabase.com/dashboard/project/mrwooskdcnkbitkhcvbf/sql/new). **Aplicala ANTES de desplegar el código de DR66:** el código lee `reopen_count` y falla sin la migración. Después corré las verificaciones del pie del archivo (las 4 columnas con `has_column_privilege` en false). Aplicada hoy solo en estured-dev.
- [ ] **[Vos] Migración 0107** (`db/migrations/0107_privilege_hardening.sql`, 2026-11-25, aplicada en dev): quita lecturas sin uso a `anon`/`authenticated`. Entra sola con el bootstrap; si prod ya existe, pegala en su SQL Editor.
- [ ] **[Vos] Factura C manual por cada fee cobrado** (LEG-002): emitila en ARCA (monotributo) a nombre de quien pagó y registrá el número y la fecha en `/admin/payments` → «Cobrados» → columna «Factura C». Formato `00001-00000123`. Un número no se repite.
- [ ] **[Vos] Datos del titular**: viven solo en `lib/legal/operator.ts` y se publican en `/terms#quienes-somos` (decisión del dueño: no en el pie). Domicilio publicado: solo «Ciudad Autónoma de Buenos Aires, Argentina» (riesgo aceptado).
- [x] **Región gru1 en Vercel** (decisión del dueño; hecha en `vercel.json` el 2026-11-25, ver C2).
- [ ] **[Vos] MFA de admin** (bloque 9, `6c58053`): en Supabase prod → Authentication → Multi-Factor, TOTP habilitado. Cada admin entra, enrola su app de autenticación en `/admin-mfa` y verifica el código, antes de abrir. `DEMO_LOGIN_ENABLED` no existe en Production (si existe, no se exige MFA).
- [ ] **[Vos] Confirmación de email** (bloque 9): se exige cuando `EMAIL_FROM` es válido (ya cargada en Production) y rige al apagar `PREAPERTURA`. **Obligatorio antes de abrir:** *Confirm email* activado en Supabase prod (Authentication → Sign In / Providers → Email). El login solo bloquea cuando Supabase responde `email_not_confirmed`; con la opción apagada, una cuenta sin confirmar entra igual. Probá: una cuenta nueva no ingresa sin confirmar y el enlace (`/auth/confirmar`, usa `NEXT_PUBLIC_APP_URL`) abre la sesión.
- [ ] **[Vos] Cuenta del menor en espera** (bloque 8, DR65 (e)): sin migración ni variables. No corras `seed-demo-guardian-consent.mjs` en prod. Al apagar `PREAPERTURA`, probá un alta de 14 a 17: queda en espera hasta que el familiar vinculado da su consentimiento.
- Al cambiar un texto legal: actualizá su fecha en `lib/legal/versions.ts`. El hash de `consents.version` cambia solo (`lib/legal/consentVersion.ts`).
