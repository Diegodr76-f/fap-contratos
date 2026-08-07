# Conectar el registro de bienes con el Excel matriz

La herramienta **funciona sin configurar nada**: calcula el código, la hoja, la vida
útil y la depreciación, y deja descargado el registro del bien. Esta guía es para el
otro pedazo — que la fila **entre sola** a la MATRIZ NACIONAL DE ACTIVOS Y BIENES y
que a la administradora de bienes **le llegue el aviso**.

Mientras nada de esto esté configurado, la administradora de bienes ya puede usar el
panel completo: en la pantalla de acceso, **«Abre tu matriz .xlsx»** lee el archivo
dentro del navegador —no lo sube a ningún lado— y muestra el patrimonio, la
depreciación al día y las alertas. Ese mismo botón es el respaldo el día que el robot
falle.

Son dos piezas independientes, y se pueden hacer en cualquier orden:

| Pieza | Qué hace | Sin ella |
|---|---|---|
| **Flujo de Power Automate** | La AC envía → la fila cae en el Excel → llega el correo | El registro se descarga y toca pegarlo a mano |
| **Robot diario (GitHub Actions)** | Publica la matriz cifrada para verla en la herramienta | El panel solo funciona abriendo el `.xlsx` a mano |

---

## Parte 1 · El flujo que agrega la fila

### 1.0 Antes de empezar: revisar las tablas del Excel

Power Automate escribe en **tablas** de Excel, no en hojas sueltas. La matriz ya
tiene dos (`Tabla1` en *Activos* y `Tabla16` en *Bienes control*), pero **su rango
está corto**: `Tabla1` llega a la fila 15 y `Tabla16` a la 8, aunque las hojas
tengan cientos de filas. Si se deja así, el flujo insertaría la fila nueva **en la
mitad de los datos**.

Arreglarlo una vez, en Excel de escritorio:

1. Clic en cualquier celda de la tabla → pestaña **Diseño de tabla**.
2. **Cambiar tamaño de la tabla** → poner el rango completo, hasta la última fila
   con datos. Para *Activos*, hoy sería `A1:AR557`; para *Bienes control*, `A1:AR803`.
3. Guardar. De ahí en adelante la tabla crece sola con cada fila que agregue el flujo.

> Mientras se está en eso: conviene **quitar las filas totalmente vacías** que hay en
> medio (por ejemplo la fila 7 de *Activos*). Una tabla con huecos hace que
> «agregar fila» caiga en el hueco en vez de al final.

### 1.1 Crear el flujo

En [make.powerautomate.com](https://make.powerautomate.com) → **Crear** → **Flujo de
nube instantáneo** → disparador **«Cuando se recibe una solicitud HTTP»**
(*When an HTTP request is received*).

- **Método**: `POST`
- **Esquema JSON de la solicitud**: pegar esto tal cual.

```json
{
  "type": "object",
  "properties": {
    "codigo":       { "type": "string" },
    "descripcion":  { "type": "string" },
    "detalle":      { "type": "string" },
    "cantidad":     { "type": "number" },
    "tipoSeguros":  { "type": "string" },
    "tipoContable": { "type": "string" },
    "proyecto":     { "type": "string" },
    "fechaCompra":  { "type": "string" },
    "donante":      { "type": "string" },
    "proveedor":    { "type": "string" },
    "ruc":          { "type": "string" },
    "factura":      { "type": "string" },
    "facturaLink":  { "type": "string" },
    "valor":        { "type": "number" },
    "marca":        { "type": "string" },
    "modelo":       { "type": "string" },
    "serie":        { "type": "string" },
    "cedula":       { "type": "string" },
    "custodio":     { "type": "string" },
    "institucion":  { "type": "string" },
    "ubicacion":    { "type": "string" },
    "acta":         { "type": "string" },
    "asegurado":    { "type": "string" },
    "inicioSeguro": { "type": "string" },
    "finSeguro":    { "type": "string" },
    "aseguradora":  { "type": "string" },
    "poliza":       { "type": "string" },
    "garantia":     { "type": "string" },
    "inicioGarantia": { "type": "string" },
    "finGarantia":  { "type": "string" },
    "estadoGarantia": { "type": "string" },
    "estadoFisico": { "type": "string" },
    "vida":         { "type": "number" },
    "depAnual":     { "type": "number" },
    "depAcumulada": { "type": "number" },
    "depMensual":   { "type": "number" },
    "residual":     { "type": "number" },
    "fechaBaja":    { "type": "string" },
    "motivoBaja":   { "type": "string" },
    "observaciones":{ "type": "string" },
    "foto":         { "type": "string" },
    "_hoja":        { "type": "string" },
    "_sigla":       { "type": "string" },
    "_area":        { "type": "string" },
    "_enviado":     { "type": "string" },
    "_id":          { "type": "string" }
  }
}
```

Los cuatro campos con guion bajo **no son columnas de la matriz**: le sirven al flujo
para decidir la hoja (`_hoja`), armar el correo (`_area`) y no duplicar (`_id`).

### 1.2 Elegir la hoja

Agregar una acción **Condición**:

- Izquierda: `_hoja` (contenido dinámico del disparador)
- Operador: **es igual a**
- Derecha: `Activos`

En la rama **Sí** va la fila a *Activos*; en la rama **No**, a *Bienes control*.
La herramienta ya decidió cuál toca (activo fijo desde **$500**, ver
[`MATRIZ.md`](MATRIZ.md)), así que el flujo solo obedece.

### 1.3 Agregar la fila

En cada rama, acción **Excel Online (Empresa) → Agregar una fila a una tabla**:

- **Ubicación**: OneDrive de la administradora de bienes (o el SharePoint donde viva la matriz)
- **Biblioteca / Archivo**: `ACTIVOS FAP NACIONAL 2026 …/MATRIZ_NACIONAL_ACTIVOS_BIENES_2026.xlsx`
- **Tabla**: `Tabla1` en la rama *Activos*, `Tabla16` en la rama *Bienes control*

Y el mapeo columna por columna. Las 44 columnas de la matriz, en orden:

| # | Columna de la matriz | Campo del JSON |
|---|---|---|
| 1 | CODIGO | `codigo` |
| 2 | DESCRIPCIÓN | `descripcion` |
| 3 | DESCRIPCIÓN(ADICIONAL) | `detalle` |
| 4 | CANTIDAD | `cantidad` |
| 5 | TIPO DE BIEN SEGUROS | `tipoSeguros` |
| 6 | TIPO DE BIEN SISTEMA CONTABLE | `tipoContable` |
| 7 | PROYECTO | `proyecto` |
| 8 | FECHA DE COMPRA | `fechaCompra` |
| 9 | DONANTE | `donante` |
| 10 | PROVEEDOR | `proveedor` |
| 11 | RUC DE PROVEEDOR | `ruc` |
| 12 | N° Factura | `factura` |
| 13 | FACTURA DIGITAL | `facturaLink` |
| 14 | VALOR DEL BIEN(INC.IMP) | `valor` |
| 15 | MARCA | `marca` |
| 16 | MODELO | `modelo` |
| 17 | NUMERO DE SERIE | `serie` |
| 18 | CEDULA CUSTODIO | `cedula` |
| 19 | NOMBRES Y APELLIDOS CUSTODIO | `custodio` |
| 20 | INSTITUCIÓN | `institucion` |
| 21 | UBICACIÓN | `ubicacion` |
| 22 | ACTA ENTREGA | `acta` |
| 23 | ASEGURADO (SI/NO) | `asegurado` |
| 24 | INICIO SEGURO | `inicioSeguro` |
| 25 | FIN SEGURO | `finSeguro` |
| 26 | ASEGURADORA | `aseguradora` |
| 27 | NRO DE POLIZA | `poliza` |
| 28 | GARANTIA TECNICA | `garantia` |
| 29 | INICIO GARANTIA | `inicioGarantia` |
| 30 | FIN DE GARANTIA | `finGarantia` |
| 31 | ESTADO DE GARANTIA | *(rama Activos: vacío · rama Bienes control: `estadoGarantia`)* |
| 32 | Estado físico detallado | `estadoFisico` |
| 33 | Vida útil estimada (AÑOS) | `vida` |
| 34 | Depreciación Lineal Anual | `depAnual` |
| 35 | Depreciación Acumulada | `depAcumulada` |
| 36 | Depreciación Acumulada Diciembre | *(vacío)* |
| 37 | Depreciación Mensual | `depMensual` |
| 38 | Valor residual | `residual` |
| 39 | Valor residual diciembre | *(vacío)* |
| 40 | Fecha de baja | `fechaBaja` |
| 41 | Motivo de baja | `motivoBaja` |
| 42 | OBSERVACIONES | `observaciones` |
| 43 | Fotografía del bien | `foto` |
| 44 | Código QR | *(dejar vacío: la columna ya tiene fórmula)* |

> **Ojo con las fechas.** La herramienta manda `AAAA-MM-DD`. Si la matriz las
> muestra como texto en vez de fecha, envolver el campo en
> `formatDateTime(triggerBody()?['fechaCompra'], 'dd/MM/yyyy')`.

> **Las columnas 31 y 44 se tratan distinto en cada hoja.** En *Activos* las dos son
> fórmulas de la tabla (`=IF(...)` para el estado de garantía e `=IMAGE(...)` para el
> QR): Excel las copia sola a la fila nueva, y escribirlas desde el flujo las
> rompería. En *Bienes control* no son fórmulas sino texto pegado, así que ahí sí hay
> que mandar `estadoGarantia`; el QR se deja vacío en las dos.

> **El QR hoy no funciona en ninguna de las dos hojas**: las 1.260 filas tienen
> `#VALUE!` porque `IMAGE()` no está disponible en la versión de Excel que se usa.
> Es un problema aparte de este flujo; está anotado en [`MATRIZ.md`](MATRIZ.md).

### 1.4 Avisar a la administradora de bienes

Al final, acción **Office 365 Outlook → Enviar un correo electrónico (V2)**:

- **Para**: la administradora de bienes
- **Asunto**: `Bien nuevo en la matriz · @{triggerBody()?['_sigla']} · @{triggerBody()?['codigo']}`
- **Cuerpo**:

```
@{triggerBody()?['_area']} registró un bien nuevo.

Código:     @{triggerBody()?['codigo']}
Bien:       @{triggerBody()?['descripcion']}
Valor:      @{triggerBody()?['valor']}
Hoja:       @{triggerBody()?['_hoja']}
Custodio:   @{triggerBody()?['custodio']}
Ubicación:  @{triggerBody()?['ubicacion']}
Factura:    @{triggerBody()?['factura']}
Acta:       @{triggerBody()?['acta']}
Fotografía: @{triggerBody()?['foto']}

Ya está en la matriz. Para revisarlo, abre /bienes/ y entra a «Revisión».
```

Si se prefiere un solo correo al día en vez de uno por bien, se cambia por una
acción **Agregar fila** a una lista de avisos y un segundo flujo programado que
mande el resumen. Con el volumen actual (unos pocos bienes por semana) el correo
por bien es más simple y llega a tiempo.

### 1.5 Responder que llegó

Última acción: **Respuesta** (*Response*), código **200**, cuerpo `{"ok":true}`.
Sin esta acción el navegador se queda esperando y la herramienta cree que falló
(guardaría el registro en la cola de reintento, y la fila se duplicaría en el
siguiente envío).

### 1.6 Pegar la URL en la herramienta

Guardar el flujo, copiar la **URL HTTP POST** del disparador —completa, incluido el
`&sig=…`— y pegarla en `bienes/index.html`, en esta línea:

```js
var FLOW_BIENES_URL = '';
```

Es la única línea que hay que tocar. Con eso, «Enviar a la matriz» deja de descargar
el archivo y manda la fila de verdad.

---

## Parte 2 · El robot que publica la matriz para verla

Esto es lo que hace que el panel, las alertas y «mis bienes» tengan datos.

1. En OneDrive/SharePoint, sobre el archivo de la matriz → **Compartir** → **Copiar
   vínculo**, con permiso *«Cualquier persona con el vínculo puede ver»*.
2. En el repositorio → **Settings → Secrets and variables → Actions → New repository
   secret**, crear dos secretos:

   | Secreto | Qué es |
   |---|---|
   | `BIENES_EXCEL_URL` | El vínculo del paso 1 |
   | `BIENES_KEY` | **La frase maestra de la administradora de bienes** |

3. Ir a **Actions → Actualizar matriz de bienes → Run workflow** para probarlo.

De ahí en adelante corre solo todas las mañanas (6:45 a. m. de Ecuador) y regenera
`bienes/bienes_export.json` y `bienes/datos/*.json`.

> `BIENES_KEY` es **distinta** de `DATA_KEY` (la del CRM/CLM) a propósito: la de
> contratos la tiene todo el equipo, y aquí la idea es que solo la administradora de
> bienes vea la matriz completa. Si se usa la misma, cualquiera del equipo abre todo.

> Si la matriz no cambió, el robot no vuelve a publicar. Cada cifrado estrena sal e
> IV, así que sin esa comprobación el repositorio recibiría un commit diario aunque
> nadie hubiera tocado el Excel.

---

## Parte 3 · Repartir las frases de acceso

La administradora entra a **Áreas y frases** → **Calcular las frases**. Sale una
tabla con las 46 áreas y la frase de cada una (`XXXXX-XXXXX-XXXXX`). A cada AC se le
manda **solo la suya**, con el enlace de la herramienta.

Las frases **no se guardan en ninguna parte**: se derivan de la frase maestra con
HMAC-SHA256, así que se vuelven a calcular igualitas cuando haga falta. Y como se
derivan, un área no puede deducir la de otra ni la maestra.

Cambiar la frase maestra (`BIENES_KEY`) **cambia todas las frases de área**. Hay que
volver a correr el robot y repartirlas de nuevo.

Quien no tenga frase igual puede registrar bienes: entra por **«Registrar un bien»**
y no descarga ningún dato. Lo único que pierde es que la herramienta no le puede
proponer el código siguiente de su área — se lo asigna la administradora.

---

## Si algo falla

| Síntoma | Causa casi siempre |
|---|---|
| `401` al enviar | La URL del flujo se pegó sin el `&sig=…` completo |
| La fila cae en medio de la hoja | El rango de la tabla está corto (paso 1.0) |
| Fechas raras en Excel | Usar `formatDateTime(...)` en el mapeo (paso 1.3) |
| «Guardado sin conexión» siempre | Falta la acción **Respuesta** en el flujo (paso 1.5) |
| El panel dice «sin copia de la matriz» | El robot no ha corrido, o faltan los secretos |
| «Esa frase no abre nada» | La frase de área quedó vieja porque cambió `BIENES_KEY` |
