# Conectar Horizonte con tu Microsoft del trabajo

Horizonte funciona solo, sin configurar nada: escribes y se guarda en tu navegador.
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
          "sys":    { "type": "string" },
          "id":     { "type": "string" },
          "texto":  { "type": "string" },
          "fecha":  { "type": "string" },
          "hora":   { "type": "string" },
          "hecha":  { "type": "boolean" },
          "lista":  { "type": "string" }
        }
      }
    }
  }
}
```

Al **guardar**, el disparador te muestra la **URL HTTP POST**. Esa es la que pegas en
*Ajustes → URL del flujo* dentro de Horizonte. Guárdala como una contraseña: quien la
tenga puede leer y crear tus tareas. Si se te escapa, en el disparador puedes
regenerar la firma (`sig`).

---

## 2. Aplicar lo que hiciste en Horizonte

Primero lo que **sale** de la app, para que To Do quede al día antes de leerlo.

1. **Inicializar variable** `creadas` (tipo *Matriz*, vacía).
2. **Inicializar variable** `aplicados` (tipo *Matriz*, vacía).
3. **Aplicar a cada uno** sobre `triggerBody()?['cambios']`, y dentro un **Conmutador (Switch)**
   sobre `items('Aplicar_a_cada_uno')?['accion']`:

   - **Caso `crear`** → To Do · **«Agregar una tarea pendiente (V3)»**
     - Lista: la del campo `lista` (o tu lista predeterminada)
     - Título: `items('Aplicar_a_cada_uno')?['texto']`
     - Fecha de vencimiento: `items('Aplicar_a_cada_uno')?['fecha']`
     - Después, **Anexar a la variable** `creadas` este objeto:
       ```
       {
         "local": @{items('Aplicar_a_cada_uno')?['local']},
         "sys": "todo",
         "id": @{outputs('Agregar_una_tarea_pendiente')?['body/id']},
         "url": "https://to-do.office.com/tasks/id/@{outputs('Agregar_una_tarea_pendiente')?['body/id']}/details"
       }
       ```

   - **Caso `completar`** → según `sys`:
     - `todo` o `correo` → To Do · **«Actualizar una tarea pendiente (V3)»**, estado *completed*
       (los correos marcados son tareas de To Do en la lista *Correo marcado*, se completan igual;
       al completarla, el correo se desmarca en Outlook)
     - `planner` → Planner · **«Actualizar tarea»** con *Porcentaje completado = 100*

   - **Caso `mover`** y **caso `editar`** → To Do · **«Actualizar una tarea pendiente (V3)»**
     con el título y/o la fecha nuevos.

   Al final de cada caso: **Anexar a la variable** `aplicados` →
   `items('Aplicar_a_cada_uno')?['local']`.

> Si algo falla aquí, no pasa nada grave: Horizonte reintenta el envío en la siguiente
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

En Horizonte: **Ajustes → pega la URL → «Probar y sincronizar»**.

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
  «Este mes», ahí se queda; si cambia el título o la fecha en Planner, se actualiza aquí.
  Si la fecha se acerca, la tarea sube sola de horizonte.
- **Lo que llega del trabajo sin fecha entra en *Corto*, no en *Hoy*.** Tu «Hoy» solo se llena
  con lo que tú decides o con lo que tiene fecha para hoy.
- **Lo que borras en el origen desaparece de aquí.** Y al revés no: borrar una tarea aquí no
  la borra en To Do (te lo avisa cuando pasa).
- **Sin internet todo sigue funcionando.** Lo que hagas se guarda y se envía cuando vuelva la
  conexión.

## Por qué devolver las tareas a To Do

Horizonte no manda notificaciones (una página web no es confiable para eso, menos en iPhone).
En vez de competir, empuja: lo que escribes aquí se crea en **To Do**, y ahí ya tienes la
alarma en el celular, el recordatorio en Outlook y el reloj. Horizonte es la cabeza —
decidir qué importa hoy —; To Do es el despertador.

Si prefieres que no escriba nada en tu Microsoft, apaga *«Devolver a Microsoft To Do»* en
Ajustes: la sincronización sigue trayendo lo del trabajo, pero solo de lectura.
