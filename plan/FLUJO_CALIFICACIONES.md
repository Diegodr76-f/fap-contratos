# Calificación de proveedores: del CLM al Registro, sin pegar nada

Cuando una administradora (AC) confirma la calificación de un proveedor en el CLM, la
calificación viaja sola a una **tabla del Excel maestro** por un flujo de Power Automate.
El robot de cada mañana publica esa tabla, y desde entonces la calificación la ven todas
las computadoras: la alerta «Proveedor sin calificar» se apaga para todos.

Esto se configura **una sola vez**. Son tres cosas: la tabla, el flujo y la URL del flujo en el CLM.

## El proceso, de punta a punta

1. **Solo califica la AC del contrato, desde su entrada.** La Unidad Operativa y las áreas
   ven las calificaciones, pero no las ponen.
2. La AC llena los 13 criterios (FO-AD-ABC-017) y pulsa **«Revisar calificación»**: ve el
   puntaje, el semáforo, los cuatro indicadores y la consecuencia, y puede escribir una
   observación.
3. Pulsa **«Confirmar calificación»**. Desde ahí ya no se cambia en el CLM.
4. El CLM manda la calificación al flujo, que:
   - agrega la fila a la tabla del Registro de Calificaciones;
   - le manda un correo de confirmación a la AC;
   - si el proveedor quedó **no elegible** (menos de 70), avisa también a la Unidad Operativa.
5. **Sin señal no se pierde:** queda guardada en ese navegador como «pendiente de envío», la AC
   ve una alerta con «Reintentar» y el CLM la reintenta solo cada vez que se abre.
6. A la mañana siguiente el robot publica el Registro y la calificación cuenta en todas las
   computadoras.
7. **Si hubo un error, o era una prueba**, la AC avisa a la Unidad Operativa, que corrige o
   **borra la fila** en la tabla. Cuando el robot publica, el CLM muestra lo corregido; y si la
   fila se borró, el contrato **vuelve a quedar por calificar**: en el navegador de la AC se
   libera la calificación que ya no está en el Registro y reaparecen «Calificar proveedor» y su
   alerta. (Solo si el Registro se publicó después de enviarla: una calificación de hoy, que el
   robot todavía no leyó, no se da por retirada.) Si un contrato tiene varias filas, vale la de
   fecha más reciente.

   Para no esperar a la mañana siguiente: en GitHub, **Actions → «Actualizar datos del CRM» →
   Run workflow**. En uno o dos minutos el Registro queda publicado; recarga el CLM (Ctrl+Shift+R).

## 1. La tabla en el Excel maestro

1. En el Excel maestro (el mismo que lee el robot), crea una hoja llamada
   **Registro de Calificaciones**.
2. En la primera fila escribe estos 15 encabezados, uno por columna y en este orden:

   | | | | |
   |---|---|---|---|
   | Nro. Contrato | Nombre Proveedor | Área Protegida | Categoría |
   | Administrador/a AC | Fecha Evaluación | Calidad (40%) | Plazo (30%) |
   | Atención (5%) | Cump. Contractual (25%) | PUNTAJE TOTAL | RESULTADO |
   | Elegible Futuros Proc. | Observaciones | Id calificación | |

3. Selecciona esa fila y pulsa **Insertar → Tabla** (marca «La tabla tiene encabezados»).
   Power Automate solo escribe en tablas de Excel, no en hojas sueltas.
4. En **Diseño de tabla**, cámbiale el nombre a **Calificaciones**.

Los rótulos importan: el robot busca las columnas por su nombre. Si un día se cambia uno,
hay que cambiarlo también en el CLM (`CSV_CALIF_ENC`) y en el robot.

## 2. El flujo de Power Automate

En Power Automate: **Crear → Flujo de nube instantáneo**, y como desencadenador
**«Cuando se recibe una solicitud HTTP»** (el mismo que usa el envío de documentos a la Unidad).

**Paso 1 · Cuando se recibe una solicitud HTTP.** En «Esquema JSON del cuerpo de la
solicitud» pega esto:

```json
{
  "type": "object",
  "properties": {
    "origen":          { "type": "string" },
    "idCalificacion":  { "type": "string" },
    "contratoNro":     { "type": "string" },
    "proveedor":       { "type": "string" },
    "area":            { "type": "string" },
    "categoria":       { "type": "string" },
    "ac":              { "type": "string" },
    "acCorreo":        { "type": "string" },
    "fechaEvaluacion": { "type": "string" },
    "calidad":         { "type": "number" },
    "plazo":           { "type": "number" },
    "atencion":        { "type": "number" },
    "cumplimiento":    { "type": "number" },
    "puntaje":         { "type": "number" },
    "resultado":       { "type": "string" },
    "elegible":        { "type": "string" },
    "observaciones":   { "type": "string" },
    "enviadoEn":       { "type": "string" }
  },
  "required": ["idCalificacion", "contratoNro", "puntaje"]
}
```

Los cuatro puntajes por indicador (`calidad`, `plazo`, `atencion`, `cumplimiento`) no son
obligatorios: una calificación hecha antes de que el CLM los guardara llega sin ellos, y esas
celdas quedan vacías.

> **Si en el paso 2 no te aparecen los campos** (por ejemplo `calidad`, `plazo`, `atencion` o
> `cumplimiento`): el esquema del paso 1 tiene algún tipo de la forma `["number","null"]`, que
> Power Automate no entiende. Debe decir `"type": "number"`. Corrígelo, guarda y vuelve a abrir
> el paso 2. Mientras tanto puedes escribir el campo con una expresión: en la pestaña
> **Expresión** del campo, `triggerBody()?['calidad']`, `triggerBody()?['plazo']`,
> `triggerBody()?['atencion']` y `triggerBody()?['cumplimiento']`.

**Paso 2 · Agregar una fila a una tabla** (Excel Online (Business)). Ubicación y archivo: los
del Excel maestro; tabla: **Calificaciones**. Cada columna con su campo:

| Columna de la tabla | Campo del CLM |
|---|---|
| Nro. Contrato | `contratoNro` |
| Nombre Proveedor | `proveedor` |
| Área Protegida | `area` |
| Categoría | `categoria` |
| Administrador/a AC | `ac` |
| Fecha Evaluación | `fechaEvaluacion` |
| Calidad (40%) | `calidad` |
| Plazo (30%) | `plazo` |
| Atención (5%) | `atencion` |
| Cump. Contractual (25%) | `cumplimiento` |
| PUNTAJE TOTAL | `puntaje` |
| RESULTADO | `resultado` |
| Elegible Futuros Proc. | `elegible` |
| Observaciones | `observaciones` |
| Id calificación | `idCalificacion` |

**Paso 3 · Respuesta** (Solicitud): código de estado **200**. **Va justo después de agregar la
fila, antes de los correos.** Una «Respuesta» no detiene el flujo: lo que va después sigue
corriendo. Así el CLM sabe que la fila quedó en la tabla y no la reenvía si un correo falla
(una dirección mal escrita, un buzón lleno). Si la «Respuesta» estuviera al final, un correo
fallido haría que el CLM reintentara y la tabla tendría la misma calificación dos veces.

**Paso 4 · Condición:** `elegible` es igual a `No`. Solo una fila, sin filas vacías (una fila
sin valores puede dar error al guardar o comparar mal).

**Paso 5 · Los correos (Enviar un correo electrónico V2, Office 365 Outlook):**

- **Sí es elegible (rama False):** un correo a `acCorreo`. Asunto sugerido:
  `Calificación registrada: contratoNro · proveedor`. En el cuerpo, el puntaje, el resultado y las
  observaciones, y una línea: «Si no fuiste tú, o hay un error, avisa a la Unidad Operativa».
- **No es elegible (rama True):** el mismo correo a `acCorreo`, **y además** a la Unidad
  Operativa (en «Para», con la AC, o con un segundo correo). La AC tiene que recibir su
  confirmación en los dos casos: es la alarma si alguien calificó en su nombre. Conviene que el
  asunto de esta rama diga **«Proveedor NO elegible»**.

Guarda el flujo y copia la **URL HTTP POST** que aparece en el paso 1.

## 3. La URL en el CLM

La URL va en `clm/index.html`, en `FLOW_CALIF_URL` (junto a `FLOW_DOCS_URL`); ya está puesta.
Si algún día se recrea el flujo, la URL cambia y hay que actualizarla ahí. Si el flujo está
apagado o la URL no responde, las calificaciones confirmadas quedan guardadas en el navegador
de cada AC como «pendientes de envío» y salen solas cuando vuelva a funcionar.

**La primera vez que cada AC abra el CLM después de esto**, se enviarán las calificaciones que
ya tenía hechas en su navegador (solo las de sus contratos), cada una con su correo de
confirmación. Es lo esperado: es como llegan al Registro las calificaciones anteriores.

**La primera prueba real:** califica un contrato de prueba y mira que (1) aparezca la fila en la
tabla, (2) llegue el correo a la AC, (3) el CLM diga «confirmada y enviada». Si el CLM dice que
no se pudo enviar aunque el flujo corrió, es el permiso del navegador (CORS) hacia el flujo.

## Lo que hay que saber

- **La entrada del CLM no tiene contraseña por persona**: cualquiera puede elegir el nombre de
  una AC. «Solo califica la AC» es una regla de la pantalla, no una seguridad. Por eso el correo
  de confirmación va a la AC: si alguien califica en su nombre, ella se entera.
- **La URL del flujo queda en el repositorio**, que es público, como la de `FLOW_DOCS_URL`.
  Quien la tenga podría mandar una fila falsa; el correo a la AC es también la alarma para eso.
- Una calificación reenviada después de un corte lleva el mismo `idCalificacion`: si llegara a
  quedar dos veces en la tabla, son la misma fila repetida y el CLM toma la más reciente.
- Del Registro, el robot publica solo n.º de contrato, fecha, puntajes y observación, cifrados.
  El RUC no está en la tabla y no se publica.
