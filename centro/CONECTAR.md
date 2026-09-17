# Conectar el Centro de mando con tu Microsoft del trabajo

El centro funciona solo, sin configurar nada: escribes y se guarda en tu navegador.
Esta guía es para el otro pedazo — que **lo del trabajo entre solo**: Planner, los
correos que marcas en Outlook, tus listas de To Do y las reuniones del calendario.

Todo pasa por **un solo flujo de Power Automate tuyo**. El navegador le habla directo:
nada de esto se publica en GitHub ni pasa por ningún servidor intermedio.

---

## Antes de empezar: qué aúna To Do y qué no

Vale la pena tenerlo claro porque define el flujo:

| Fuente | ¿La ves dentro de To Do? | ¿La entrega To Do por API? |
|---|---|---|
| Tus listas de To Do | Sí | **Sí** |
| Correos marcados de Outlook | Sí, lista *Correo marcado* | **Sí** (es una lista de To Do de verdad) |
| Tareas de Planner asignadas a ti | Sí, vista *Asignadas a mí* | **No** — esa vista es solo pantalla |
| Calendario de Outlook | No | No |

Es decir: tu intuición era correcta a medias. To Do **sí** unifica los correos marcados,
pero Planner solo lo *muestra* y el calendario nunca está ahí. Por eso el flujo usa
tres conectores: **To Do**, **Planner** y **Outlook (calendario)**.

Puedes empezar con To Do solo y agregar los otros después: la app acepta respuestas
parciales sin romperse y **una fuente que no viene en la respuesta no borra sus tareas**.

---

## 1. Crear el flujo

En [make.powerautomate.com](https://make.powerautomate.com) → **Crear** → **Flujo de nube instantáneo**
→ disparador **«Cuando se recibe una solicitud HTTP»** (*When an HTTP request is received*).

En el disparador:

- **Método**: `POST`
- **Esquema JSON de la solicitud**: pega esto

```json
{
  "type": "object",
  "properties": {
    "op": { "type": "string" },
    "hoy": { "type": "string" },
    "agendaDesde": { "type": "string" },
    "agendaHasta": { "type": "string" },
    "cambios": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "accion": { "type": "string" },
          "local":  { "type": "string" },
          "sys":    { "type": ["string", "null"] },
          "id":     { "type": ["string", "null"] },
          "texto":  { "type": "string" },
          "fecha":  { "type": ["string", "null"] },
          "hora":   { "type": ["string", "null"] },
          "hecha":  { "type": "boolean" },
          "lista":  { "type": ["string", "null"] }
        }
      }
    }
  }
}
```

> Ojo: `sys`, `id`, `fecha`, `hora` y `lista` aceptan `["string", "null"]`, no solo
> `"string"`. Una tarea recién creada (antes de que Microsoft le asigne un Id) manda esos
> campos vacíos — si el esquema exige texto siempre, Power Automate rechaza el pedido
> **antes de que el flujo siquiera arranque** (no aparece nada en el historial, porque
> nunca llegó a crear una ejecución). Si ya armaste el disparador con el esquema viejo y
> te sale «no se pudo sincronizar (HTTP 400)» apenas creas o mueves algo, este es el motivo:
> entra al disparador, corrige el esquema y guarda de nuevo.

Al **guardar**, el disparador te muestra la **URL HTTP POST**. Esa es la que pegas en
*Ajustes → URL del flujo* dentro del centro. Guárdala como una contraseña: quien la
tenga puede leer y crear tus tareas. Si se te escapa, en el disparador puedes
regenerar la firma (`sig`).

---

## 2. Aplicar lo que hiciste en el centro

Primero lo que **sale** de la app, para que To Do quede al día antes de leerlo.

1. **Inicializar variable** `creadas` (tipo *Matriz*, vacía).
2. **Inicializar variable** `aplicados` (tipo *Matriz*, vacía).
3. **Aplicar a cada uno** sobre `triggerBody()?['cambios']`, y dentro un **Conmutador (Switch)**
   cuyo valor de comparación (arriba del todo, el campo **«en»**) es
   `items('Aplicar_a_cada_uno')?['accion']`.

   El centro solo manda **tres valores posibles** de `accion` — necesitas exactamente
   **tres casos**, ni uno más: `crear`, `completar` y `mover`. (Editar el texto de una tarea
   también viaja como `mover`: para Microsoft, cambiar el título o la fecha es lo mismo,
   así que no hace falta un cuarto caso para eso.)

   ### Caso `crear`

   - **Igual a**: `crear`
   - Acción: To Do · **«Agregar una tarea pendiente (V3)»**
     - Lista: la del campo `lista` (o tu lista predeterminada)
     - Título: `items('Aplicar_a_cada_uno')?['texto']`
     - Fecha de vencimiento: `items('Aplicar_a_cada_uno')?['fecha']`
   - Después, **Anexar a la variable de matriz** → Nombre: `creadas`.

     **Aquí es donde se traban casi todos**: el campo «Valor» de esa acción es de texto,
     y necesitamos meterle un objeto (`{local, sys, id, url}`), no un texto suelto. El truco
     es escribirlo como **expresión** en vez de contenido dinámico:

     1. Haz clic en el campo **Valor** de «Anexar a la variable de matriz».
     2. Arriba del cuadro verás dos pestañas: **Contenido dinámico** y **Expresión**. Cambia
        a **Expresión**.
     3. Escribe esto tal cual, y donde dice `INSERTA AQUÍ...` borra ese texto y, sin salir del
        cuadro de expresión, haz clic en el contenido dinámico correspondiente (verás que se
        inserta solo, con el nombre exacto de tu acción — no lo escribas a mano):

        ```
        json(concat('{"local":"', INSERTA AQUÍ EL "local" DE ESTE ELEMENTO, '","sys":"todo","id":"', INSERTA AQUÍ EL "Id" DE "Agregar una tarea pendiente", '","url":"https://to-do.office.com/tasks/id/', INSERTA AQUÍ EL "Id" DE "Agregar una tarea pendiente" OTRA VEZ, '/details"}'))
        ```

        Es decir: el texto fijo (`concat`, comillas, `json(...)`) lo escribes tú; los dos
        huecos dinámicos (`local` del elemento actual, e `Id` de la tarea recién creada) los
        insertas haciendo clic mientras el cursor está dentro del cuadro, en el punto exacto
        donde deben ir. Al terminar, el resultado debe verse parecido a:

        ```
        json(concat('{"local":"', items('Aplicar_a_cada_uno')?['local'], '","sys":"todo","id":"', body('Agregar_una_tarea_pendiente_(V3)')?['id'], '","url":"https://to-do.office.com/tasks/id/', body('Agregar_una_tarea_pendiente_(V3)')?['id'], '/details"}'))
        ```

     4. **Aceptar**. Si Power Automate no se queja (no aparece el triángulo rojo), quedó bien.

     Por qué el rodeo: si en vez de esto escribes el objeto a mano mezclando texto y
     contenido dinámico directamente en el campo, Power Automate lo guarda como **un texto**,
     no como un objeto — y el centro necesita `creadas[i].local`, `.sys`, `.id`, `.url` como
     propiedades reales, no como un texto que las contiene. `concat(...)` arma el texto
     completo; `json(...)` lo convierte en objeto de verdad.

   ### Caso `completar`

   - **Igual a**: `completar`
   - Dentro, una **Condición** que compare `items('Aplicar_a_cada_uno')?['sys']`:
     - Es igual a `planner` → Planner · **«Actualizar tarea»** con *Porcentaje completado = 100*.
     - Si no (rama «Si no») → To Do · **«Actualizar una tarea pendiente (V3)»**, estado
       *completed* (esta rama cubre `todo` y `correo`: los correos marcados son tareas de
       To Do de verdad, se completan igual, y al completarla el correo se desmarca en Outlook).
   - Después de cualquiera de las dos ramas: **Anexar a la variable de matriz** → Nombre:
     `aplicados`, Valor: `items('Aplicar_a_cada_uno')?['local']` (aquí sí es un solo valor de
     texto — sin `json(concat(...))`, se puede insertar directo desde «Contenido dinámico»).

   ### Caso `mover`

   - **Igual a**: `mover`
   - Acción: To Do · **«Actualizar una tarea pendiente (V3)»**
     - Título: `items('Aplicar_a_cada_uno')?['texto']`
     - Fecha de vencimiento: `items('Aplicar_a_cada_uno')?['fecha']`
   - Después: **Anexar a la variable de matriz** → `aplicados` →
     `items('Aplicar_a_cada_uno')?['local']` (igual que en `completar`).

   **Predeterminado** (lo que corre si `accion` no es ninguna de las tres): déjalo con
   **0 acciones**. No debería ejecutarse nunca; si lo hace, no pasa nada, simplemente esa
   tarea se queda pendiente de enviar y se reintenta después.

> Si algo falla aquí, no pasa nada grave: el centro reintenta el envío en la siguiente
> sincronización. Un cambio no confirmado se ve con una flecha `↑` en la tarea.

---

## 3. Leer las cuatro fuentes

### To Do (tus listas + los correos marcados)

1. To Do · **«Listar listas de tareas pendientes»**.
2. **Aplicar a cada uno** sobre las listas → To Do · **«Listar tareas pendientes (V3)»**.
3. Junta todo en un array con **Redactar**/**Seleccionar**, con esta forma por tarea:

   ```json
   {
     "sys": "todo",
     "id": "<id de la tarea>",
     "texto": "<título>",
     "fecha": "<fecha de vencimiento, solo AAAA-MM-DD>",
     "hora": null,
     "hecha": false,
     "lista": "<nombre de la lista>",
     "url": "https://to-do.office.com/tasks/id/<id>/details",
     "importante": false
   }
   ```

   - Para la fecha usa `formatDateTime(<campo>, 'yyyy-MM-dd')`, y déjala en `null` si no tiene.
   - Filtra las completadas (*status* distinto de `completed`): lo que ya está hecho no
     necesita viajar.
   - Para la lista *Correo marcado* (`wellknownListName = flaggedEmails`) pon
     **`"sys": "correo"`** en vez de `"todo"`. Así aparece con su propio color y sabes de
     un vistazo que eso salió de un correo.

### Planner

Planner · **«Listar mis tareas»** → filtra las que tengan *Porcentaje completado* menor a 100
y mapea:

```json
{
  "sys": "planner",
  "id": "<id de la tarea>",
  "texto": "<título>",
  "fecha": "<dueDateTime en AAAA-MM-DD o null>",
  "lista": "<nombre del plan, si lo tienes a mano>",
  "url": "https://tasks.office.com/<tu-dominio>/Home/Task/<id de la tarea>"
}
```

### Calendario de Outlook

Office 365 Outlook · **«Obtener eventos del calendario (V3)»** con:

- Hora de inicio: `triggerBody()?['agendaDesde']`
- Hora de finalización: `triggerBody()?['agendaHasta']`

y mapea cada evento a:

```json
{
  "id": "<id>",
  "titulo": "<asunto>",
  "inicio": "<inicio en AAAA-MM-DDTHH:mm:ss, en tu hora local>",
  "fin": "<fin igual>",
  "lugar": "<ubicación o 'Teams'>",
  "url": "<vínculo web del evento>",
  "todoElDia": false
}
```

> **La hora importa.** Convierte a la zona de Ecuador antes de responder
> (`convertFromUtc(<fecha>, 'SA Pacific Standard Time', 'yyyy-MM-ddTHH:mm:ss')`),
> porque la app muestra la hora tal cual llega.

---

## 4. Responder

Última acción del flujo: **Respuesta** (*Response*), código **200**, tipo `application/json`:

```json
{
  "ok": true,
  "tareas":   <el array armado en el paso 3>,
  "eventos":  <el array del calendario>,
  "creadas":  @{variables('creadas')},
  "aplicados": @{variables('aplicados')}
}
```

Solo `ok` es obligatorio. Lo demás puede faltar mientras vas armando el flujo por partes.

---

## 5. Probar

En el centro: **Ajustes → pega la URL → «Probar y sincronizar»**.

- Si dice **«Al día con Microsoft»**, listo.
- Si dice **HTTP 4xx/5xx**, abre el historial de ejecuciones del flujo: el error está ahí.
- Si dice **«sin conexión»** y el flujo ni siquiera se ejecutó, casi siempre es el navegador
  bloqueando la llamada (CORS). El disparador HTTP de Power Automate normalmente ya responde
  bien al navegador — es el mismo camino que usan La Mágica y el CLM para subir documentos.
  Si aun así falla, revisa que la URL esté completa, con `sig` incluido.

---

## Cómo se comporta la sincronización

- **Cada 10 minutos**, al abrir la app y al volver a ella (si pasaron más de 2 minutos).
- **El horizonte es tuyo, el contenido es de la fuente.** Si mueves una tarea de Planner a
  «Mediano plazo», ahí se queda; si cambia el título o la fecha en Planner, se actualiza aquí.
  Si la fecha se acerca, la tarea sube sola de plazo.
- **Lo que llega del trabajo sin fecha entra en *Corto plazo*, no en *Hoy*.** Tu «Hoy» solo se llena
  con lo que tú decides o con lo que tiene fecha para hoy.
- **Lo que borras en el origen desaparece de aquí.** Y al revés no: borrar una tarea aquí no
  la borra en To Do (te lo avisa cuando pasa).
- **Sin internet todo sigue funcionando.** Lo que hagas se guarda y se envía cuando vuelva la
  conexión.

## Por qué devolver las tareas a To Do

El centro no manda notificaciones (una página web no es confiable para eso, menos en iPhone).
En vez de competir, empuja: lo que escribes aquí se crea en **To Do**, y ahí ya tienes la
alarma en el celular, el recordatorio en Outlook y el reloj. El centro es la cabeza —
decidir qué importa hoy —; To Do es el despertador.

Si prefieres que no escriba nada en tu Microsoft, apaga *«Devolver a Microsoft To Do»* en
Ajustes: la sincronización sigue trayendo lo del trabajo, pero solo de lectura.
