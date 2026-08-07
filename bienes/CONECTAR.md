# Conectar el registro de bienes con SharePoint y la cuenta de FIAS

Esta guía monta la versión con **login real**: cada quien entra con su cuenta de
Microsoft de FIAS, y quién ve qué lo decide una lista de accesos, no una frase.
No hace falta Power Apps ni ninguna licencia nueva — todo lo de aquí viene incluido
en un Microsoft 365 que ya tiene SharePoint, Outlook y Power Automate, que es lo que
este proyecto ya usa.

Son cuatro piezas. Las tres primeras las arma quien administre esa cuenta de
Microsoft 365 (Cata, o quien tenga ese rol); la cuarta es pegar unos IDs en un
archivo.

| Pieza | Qué hace | Dónde se hace |
|---|---|---|
| 1. Listas de SharePoint | Guardan los bienes y quién puede ver qué | SharePoint |
| 2. Flujo de ingreso | La fila nueva entra a la lista de Bienes | Power Automate |
| 3. App en Entra ID | Permite iniciar sesión con la cuenta de FIAS | Entra admin center |
| 4. Flujo de consulta | Cada quien recibe solo lo suyo, nunca todo | Power Automate |

Si en algún punto la parte 4 (la más técnica) se atasca, existe un plan B más
simple sin renunciar al login real: al final de esta guía, en **«Si la parte 4 se
complica»**, está la versión que usa los permisos nativos de SharePoint en vez de
un flujo que interpreta el token.

---

## Parte 1 · Las listas de SharePoint

### 1.1 La lista «Bienes»

En el sitio de SharePoint donde hoy vive la matriz → **Contenido del sitio → Nuevo
→ Lista → Desde Excel** → subir `MATRIZ_NACIONAL_ACTIVOS_BIENES_2026.xlsx`, hoja
por hoja (una lista para *Activos*, otra para *Bienes control* — **o, más simple,
una sola lista con todo y una columna extra `hoja`** que diga `Activos` o `Bienes
control`; la herramienta funciona igual con cualquiera de las dos formas, así que
elige la que sea menos trabajo).

**Nombra las columnas igual que el JSON**, no como los encabezados largos del
Excel. Ahorra un paso de traducción en los dos flujos de más abajo:

`codigo, descripcion, detalle, cantidad, tipoSeguros, tipoContable, proyecto,
fechaCompra, donante, proveedor, ruc, factura, facturaLink, valor, marca, modelo,
serie, cedula, custodio, institucion, ubicacion, acta, asegurado, inicioSeguro,
finSeguro, aseguradora, poliza, garantia, inicioGarantia, finGarantia,
estadoFisico, vida, fechaBaja, motivoBaja, observaciones, foto, hoja, sigla`

`sigla` es nueva: el segundo bloque del código (`02-`**`RBL`**`-014-EC`). Vale la
pena tenerla como columna propia — así el flujo de consulta filtra por igualdad
exacta en vez de tener que interpretar el código cada vez. Al importar desde
Excel, se llena con una columna calculada una sola vez; de ahí en adelante, el
flujo de ingreso ya la manda calculada (`_sigla`, ver parte 2).

> No hace falta migrar `ESTADO DE GARANTIA` ni `Código QR`: la herramienta calcula
> el primero sola y el segundo nunca funcionó (ver `MATRIZ.md`, sección 6).

### 1.2 La lista «Accesos»

Una lista nueva, chiquita, dos columnas:

| Correo | Área |
|---|---|
| cata@fias.org.ec | TODAS |
| ac.limoncocha@fias.org.ec | RBL |
| ac.podocarpus@fias.org.ec | PNP |
| … | … |

`TODAS` es el valor especial para quien administra bienes. El correo es el mismo
con el que cada quien inicia sesión en Microsoft 365 — no hace falta que coincida
con nada de la matriz, es una tabla aparte.

**Esta lista es el control de acceso real.** Agregar, mover o sacar a alguien es
editarla — no hay que tocar código ni volver a publicar nada. Quien no esté aquí
puede iniciar sesión igual (es una cuenta válida de FIAS) pero no ve ningún bien:
solo le queda el formulario de registro.

---

## Parte 2 · El flujo de ingreso

Es el mismo flujo que ya existía, con dos cambios: escribe en la Lista de
SharePoint en vez del Excel, y ya no hace falta separar por hoja con una condición
— la columna `hoja` va en la propia fila.

En [make.powerautomate.com](https://make.powerautomate.com) → **Crear → Flujo de
nube instantáneo** → disparador **«Cuando se recibe una solicitud HTTP»**, método
`POST`, con el mismo esquema JSON de antes (los 44 campos del bien más
`_hoja`, `_sigla`, `_area`, `_enviado`, `_id` — sin cambios; si ya tenías el flujo
viejo del Excel, basta con abrirlo y reemplazar el paso de Excel).

**No lleva seguridad de Azure AD.** Es intencional: es un flujo que solo escribe,
nunca devuelve datos de nadie, así que no hay nada que proteger del lado de la
lectura. Sigue protegido igual que antes, con la URL larga y el `sig=…` que trae.

Acción **SharePoint → Crear elemento**:

- **Dirección del sitio**: el sitio donde creaste la lista «Bienes»
- **Nombre de lista**: `Bienes`
- Mapea cada columna al campo del JSON del mismo nombre — como se llamaron igual
  en el paso 1.1, es prácticamente automático.

Al final, igual que antes: acción **Respuesta** (código 200) y el correo a la
administradora de bienes con **Office 365 Outlook → Enviar un correo (V2)**. El
cuerpo del correo puede quedar tal cual estaba en la versión anterior de esta guía.

Copia la URL del disparador y pégala en `bienes/index.html`:

```js
var FLOW_BIENES_URL = '';   // ← aquí
```

---

## Parte 3 · Registrar la app en Entra ID

Esto es lo que permite el botón «Iniciar sesión con Microsoft». Lo hace una vez
quien administre esa cuenta — necesita poder crear registros de aplicación, que en
la mayoría de organizaciones **cualquier usuario puede hacer por defecto** (no
hace falta ser administrador global). Si el botón «Nuevo registro» no aparece,
alguien de IT lo activa en un minuto.

### 3.1 Crear el registro

[entra.microsoft.com](https://entra.microsoft.com) → **Identidad → Aplicaciones →
Registros de aplicaciones → Nuevo registro**.

- **Nombre**: `Bienes FAP`
- **Tipos de cuenta admitidos**: *Solo cuentas de este directorio organizativo*
- **URI de redirección**: tipo **SPA (aplicación de una sola página)**, valor la
  URL exacta donde vive `bienes/index.html`
  (`https://[usuario].github.io/fap-contratos/bienes/`)

Al terminar, copia dos valores de la página **Información general**:

- **Id. de aplicación (cliente)** → va en `MSAL_CONFIG.clientId`
- **Id. de directorio (inquilino)** → va en `MSAL_CONFIG.authority`, así:
  `https://login.microsoftonline.com/<Id.-de-directorio>`

### 3.2 Exponer una API

En el mismo registro → **Exponer una API → Agregar** (acepta el URI de
aplicación que propone, algo como `api://<client-id>`).

**Agregar un ámbito**:
- Nombre del ámbito: `Bienes.Leer`
- Quién puede dar su consentimiento: *Administradores y usuarios*
- Nombre para mostrar del consentimiento del administrador: `Leer mis bienes`
- Descripción: `Permite consultar los bienes que le corresponden a quien inicia sesión`

El ámbito completo (`api://<client-id>/Bienes.Leer`) va en `MSAL_API_SCOPE`.

### 3.3 Permisos de API

**Autorizar clientes cliente** (en la misma pantalla de «Exponer una API») → pega
el mismo Id. de aplicación (cliente) del paso 3.1, marca `Bienes.Leer` → **Agregar
una aplicación**. Esto le dice a Entra ID que la propia app tiene permiso de
pedirse el ámbito a sí misma — es el patrón normal para una SPA que llama a su
propio backend.

### 3.4 Pegar los tres valores

En `bienes/index.html`:

```js
var MSAL_CONFIG = {
  clientId: '',      // Id. de aplicación (cliente) — paso 3.1
  authority: '',      // https://login.microsoftonline.com/<Id. de directorio>
  redirectUri: window.location.origin + window.location.pathname
};
var MSAL_API_SCOPE = '';   // api://<client-id>/Bienes.Leer — paso 3.2
```

Con esto el botón de login ya funciona y pide la sesión de Microsoft — lo único
que falta es que tenga a quién preguntarle los bienes (parte 4).

---

## Parte 4 · El flujo protegido «obtener mis bienes»

Este es el que decide qué ve cada quien. La idea: el disparador, protegido con
Azure AD, garantiza que **solo cuentas de FIAS pueden llamarlo** — pero eso solo
dice *quién es*, no *qué le toca ver*. Ese segundo paso lo hace el flujo, cruzando
el correo contra la lista de Accesos, y filtrando la lista de Bienes antes de
devolver nada. El navegador nunca decide esto por sí mismo: si lo hiciera, bastaría
con cambiar una línea de código para que alguien viera el área de otro.

### 4.1 Crear el flujo y protegerlo

**Crear → Flujo de nube instantáneo** → disparador «Cuando se recibe una solicitud
HTTP», método `GET` (no necesita cuerpo, solo el token).

Abre los **ajustes del disparador** (⚙) → **Seguridad**:
- **¿Quién puede desencadenar el flujo?**: *Cualquier usuario de mi inquilino*

Esto pide un registro de aplicación para la seguridad del propio disparador —
puede ser el **mismo** `Bienes FAP` del paso 3.1, con el mismo Id. de cliente y de
directorio.

### 4.2 Averiguar quién llama — probarlo antes de dar por buena la fórmula

Cuando el disparador tiene seguridad de Azure AD, Power Automate recibe la
identidad de quien llama en un encabezado, **`X-MS-CLIENT-PRINCIPAL`**: un texto
en Base64 que, al decodificarlo, es una lista de "claims" (afirmaciones) sobre esa
persona — entre ellas su correo, aunque el nombre exacto de ese campo cambia según
cómo esté configurado el directorio (a veces es `upn`, a veces
`preferred_username`, a veces la URL larga
`http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn`). En vez de adivinar,
se prueba una vez:

1. Agrega una acción **Compose** justo después del disparador, con esta fórmula:
   ```
   json(base64ToString(triggerOutputs()?['headers']?['X-MS-CLIENT-PRINCIPAL']))
   ```
2. Agrega una acción **Respuesta**, código 200, cuerpo = la salida de ese Compose.
3. Guarda, y llama al flujo una vez de prueba (con `curl` o Postman, pidiendo antes
   un token con `MSAL_API_SCOPE` — o más fácil: usa el botón «Probar» de Power
   Automate, que ya corre autenticado como tú).
4. Mira la lista `claims` que responde. Busca la entrada cuyo `typ` sea tu correo
   — normalmente `upn` o `preferred_username` — y anota el nombre exacto de ese
   `typ` en **tu** tenant.

Con ese nombre confirmado, arma el resto del flujo. No hay atajo honesto para este
paso: los nombres de claims varían de un tenant a otro y una fórmula copiada de
otra guía puede simplemente no calzar con la tuya.

### 4.3 Buscar el correo en Accesos

Acción **Compose** — el correo de quien llama (usa el `typ` que confirmaste en 4.2):

```
first(filter(outputs('Compose_-_decodificar_claims')?['claims'], equals(item()?['typ'], 'upn')))?['val']
```

Acción **SharePoint → Obtener elementos**, lista `Accesos`, filtro de OData:

```
Correo eq '@{outputs('Compose_-_correo')}'
```

Acción **Condición**: `length(body('Obtener_elementos')?['value'])` es mayor que `0`.

- **No** → acción **Respuesta**, código `403`, cuerpo
  `{"error":"No estás en la lista de accesos."}`. Aquí termina: una cuenta válida
  de FIAS que no está en Accesos no ve ningún bien.
- **Sí** → sigue al paso 4.4.

### 4.4 Filtrar Bienes y responder

Con el área ya resuelta (`first(body('Obtener_elementos')?['value'])?['Área']`):

Acción **Condición**: ¿esa área es `TODAS`?

- **Sí** (es Cata) → **SharePoint: Obtener elementos** de la lista `Bienes`, sin
  filtro — trae todo.
- **No** (es un área) → **SharePoint: Obtener elementos** de `Bienes`, filtro
  `sigla eq '<el área encontrada>'`.

Acción **Respuesta**, código 200, cuerpo:

```json
{
  "rol": "@{if(equals(variables('area'), 'TODAS'), 'cata', 'area')}",
  "sigla": "@{if(equals(variables('area'), 'TODAS'), null, variables('area'))}",
  "bienes": @{body('Obtener_elementos_2')?['value']}
}
```

(Ajusta los nombres de las acciones a como te haya quedado el flujo — Power
Automate los va numerando según el orden en que las agregas.)

### 4.5 Pegar la URL

```js
var API_MIS_BIENES_URL = '';   // URL del disparador de este flujo
```

Y, si quieres el atajo directo a la lista de Accesos desde el panel:

```js
var SP_ACCESOS_URL = '';   // enlace a la lista «Accesos» en SharePoint
```

---

## Si la parte 4 se complica

Interpretar el token dentro de un flujo (4.2–4.4) es la pieza más técnica de toda
esta guía, y la única que no se puede probar sin un tenant real — así que es
razonable que tome más de un intento. Si se atasca, hay un plan B que llega al
mismo resultado —login real, cada quien ve solo lo suyo— sin escribir ninguna
fórmula de claims:

**Permisos nativos de SharePoint en vez de un flujo que decide.** En vez de una
lista `Bienes`, se crean carpetas dentro de ella —una por sigla de área— y a cada
carpeta se le **rompe la herencia de permisos** (botón *Compartir → Permisos
avanzados → Dejar de heredar permisos*) dándole acceso de lectura solo a esa área
y a Cata. El navegador, ya con la sesión de Microsoft, consulta la lista
directamente por **Microsoft Graph** (`GET
https://graph.microsoft.com/v1.0/sites/{id}/lists/Bienes/items`) con el token que
entrega MSAL — y SharePoint, no un flujo, decide qué le devuelve: si la carpeta no
es suya, Graph responde vacío o con error, sin que nadie haya tenido que escribir
esa regla en Power Automate. Es más trabajo de configuración manual (una carpeta y
un permiso por área, una vez), pero el mecanismo que manda es el más probado que
existe en SharePoint — el mismo que usa cualquier sitio con carpetas privadas.

---

## Si algo falla

| Síntoma | Causa casi siempre |
|---|---|
| El botón de Microsoft no aparece | `MSAL_CONFIG.clientId` o `.authority` siguen vacíos |
| «AADSTS500011» al iniciar sesión | El URI de redirección (3.1) no coincide exactamente con la URL de la página |
| «AADSTS65001» o pantalla de consentimiento atascada | Falta el consentimiento del administrador para `Bienes.Leer` (Entra admin center → Permisos de API → Conceder consentimiento) |
| El login funciona pero «no pude consultar tus bienes» | `API_MIS_BIENES_URL` vacío, o el flujo de la parte 4 no está publicado |
| Login correcto pero «no está en la lista de accesos» | Falta agregar ese correo en la lista `Accesos` (parte 1.2) — es el comportamiento esperado, no un error |
| El flujo de consulta da 401 | La seguridad del disparador (4.1) no quedó en «Cualquier usuario de mi inquilino», o el scope pedido no coincide con `MSAL_API_SCOPE` |
| Alguien ve bienes de un área que no es la suya | Revisa la lista `Accesos` primero — es la causa más probable y la más fácil de arreglar |
