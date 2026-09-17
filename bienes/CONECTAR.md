# Conectar bienes y contratos con SharePoint y la cuenta de FIAS

Esta guía monta el **login real** que usan las tres herramientas del CLM que
manejan datos sensibles: **bienes**, **CLM** y **CRM**. Cada quien entra con su
cuenta de Microsoft de FIAS, y quién ve qué lo decide una lista de accesos, no
una frase compartida. No hace falta Power Apps ni ninguna licencia nueva — todo
lo de aquí viene incluido en un Microsoft 365 que ya tiene SharePoint, Outlook y
Power Automate, que es lo que este proyecto ya usa.

> **Ojo con la parte 1.** Esa parte crea una Lista de SharePoint para los
> bienes, y **eso ya no es el plan**: la matriz se queda en el Excel. Empieza
> por [`AVISAR_A_CATA.md`](AVISAR_A_CATA.md) y vuelve aquí para el login
> (parte 3), la lectura por área (parte 4) y todo lo de contratos (partes 5
> y 6), que siguen valiendo igual.

Las partes 1 a 4 son de **bienes**; las partes 5 y 6 son de **contratos**
(CLM/CRM) y reutilizan la **misma app de Entra ID** de la parte 3 — no hay que
registrar una segunda. Todo lo arma quien administre esa cuenta de Microsoft 365
(Cata, o quien tenga ese rol); lo único que toca en código es pegar unos IDs.

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
> el primero sola, y el segundo lo dibuja ella misma en el navegador —el de la
> columna del Excel nunca funcionó (ver `MATRIZ.md`, sección 6).

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

- **Nombre**: `CLM FAP` (una sola app para bienes, CLM y CRM — no hace falta una por herramienta)
- **Tipos de cuenta admitidos**: *Solo cuentas de este directorio organizativo*
- **URI de redirección**: tipo **SPA (aplicación de una sola página)**, y aquí se
  agregan **las tres URLs**, una por herramienta (el botón «Agregar URI» permite
  varias):
  - `https://[usuario].github.io/fap-contratos/bienes/`
  - `https://[usuario].github.io/fap-contratos/clm/`
  - `https://[usuario].github.io/fap-contratos/crm/`

Al terminar, copia dos valores de la página **Información general**:

- **Id. de aplicación (cliente)** → va en `MSAL_CONFIG.clientId`
- **Id. de directorio (inquilino)** → va en `MSAL_CONFIG.authority`, así:
  `https://login.microsoftonline.com/<Id.-de-directorio>`

### 3.2 Exponer una API

En el mismo registro → **Exponer una API → Agregar** (acepta el URI de
aplicación que propone, algo como `api://<client-id>`).

**Agregar dos ámbitos** (uno por dominio de datos — así una persona autorizada
solo para bienes nunca recibe, ni por accidente, un token que también sirva
para leer contratos):

| Nombre del ámbito | Nombre para mostrar | Descripción |
|---|---|---|
| `Bienes.Leer` | Leer mis bienes | Permite consultar los bienes que le corresponden a quien inicia sesión |
| `Contratos.Leer` | Leer mis contratos | Permite consultar los contratos que le corresponden a quien inicia sesión |

En los dos, «Quién puede dar su consentimiento»: *Administradores y usuarios*.

Cada ámbito completo va en la constante `MSAL_API_SCOPE` de su propia
herramienta: `api://<client-id>/Bienes.Leer` en bienes, `api://<client-id>/Contratos.Leer` en CLM y CRM.

### 3.3 Permisos de API

**Autorizar clientes cliente** (en la misma pantalla de «Exponer una API») → pega
el mismo Id. de aplicación (cliente) del paso 3.1, marca **los dos ámbitos**
(`Bienes.Leer` y `Contratos.Leer`) → **Agregar una aplicación**. Esto le dice a
Entra ID que la propia app tiene permiso de pedirse esos ámbitos a sí misma — es
el patrón normal para una SPA que llama a su propio backend.

### 3.4 Pegar los valores en cada herramienta

Los dos primeros valores son **los mismos en las tres herramientas** (es la
misma app); el tercero cambia según el ámbito de cada una.

En `bienes/index.html`:
```js
var MSAL_CONFIG = {
  clientId: '',      // Id. de aplicación (cliente) — paso 3.1, igual en las tres
  authority: '',      // https://login.microsoftonline.com/<Id. de directorio> — igual en las tres
  redirectUri: window.location.origin + window.location.pathname
};
var MSAL_API_SCOPE = '';   // api://<client-id>/Bienes.Leer
```

En `clm/index.html` **y** `crm/index.html` (el mismo `MSAL_CONFIG`, el scope de contratos):
```js
const MSAL_CONFIG = { clientId: '', authority: '', redirectUri: window.location.origin + window.location.pathname };
const MSAL_API_SCOPE = '';   // api://<client-id>/Contratos.Leer
```

Con esto el botón de login ya funciona en las tres.

### 3.5 Permiso para llamar a los flujos protegidos (importante, no te lo saltes)

Esto se descubrió probando: **el token de `MSAL_API_SCOPE` (el de arriba) no
sirve para llamar a un disparador de Power Automate protegido con «Cualquier
usuario de mi inquilino»**. Ese candado de Power Automate no revisa nuestra
propia app — pide un token específico del servicio de Power Automate. Sin
esto, la llamada se rechaza **antes** de llegar al flujo (no aparece ni en
«Ejecuciones»), así que no hay nada que depurar del lado del flujo — el
arreglo es este permiso.

1. En el mismo registro de la app (`Bienes FAP` / `CLM FAP`) → **Permisos de
   API** → **Agregar un permiso**.
2. **APIs que usa mi organización** → busca **`Power Automate`** (a veces
   aparece como *Microsoft Flow Service*).
3. **Permisos delegados** → marca la casilla **`User`** (es el permiso de
   `user_impersonation`, «actuar en nombre del usuario que inició sesión») →
   **Agregar permisos**.
4. Clic en **«Conceder consentimiento de administrador para [tu organización]»**.
   - Si el botón está deshabilitado o no aparece, necesitas que alguien con
     rol de administrador en Microsoft 365 (de IT) haga este único clic — no
     hace falta que haga nada más de esta guía, solo este botón.

Con eso, en el código, el token para llamar flujos protegidos se pide con:

```js
var MSAL_FLOW_SCOPE = 'https://service.flow.microsoft.com//user_impersonation';
```

(la doble barra antes de `user_impersonation` es correcta, así lo pide
Microsoft — no es un error de tipeo). Esta constante es la misma en las tres
herramientas, no cambia por scope de bienes/contratos como `MSAL_API_SCOPE`.

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

## Parte 5 · La lista de SharePoint «Contratos»

Mismo espíritu que la lista de Bienes, pero más simple de llenar: hoy el CRM ya
lee el Excel maestro con una lógica de columnas resuelta (hoja **2026** para los
datos del contrato, hoja **Export** cruzada por número de contrato para el
enlace y el estado). Antes de crear la lista, usa esa misma lógica para no
tener que rehacerla a mano:

1. Abre el **CRM** (`crm/index.html`) directamente y pulsa **«Abrir el Excel
   maestro (OneDrive)»** — ya cruza las dos hojas y te deja `CONTRACTS` armado
   en el navegador con los nombres de campo correctos.
2. En la consola del navegador (F12): `copy(JSON.stringify(CONTRACTS))` copia
   esa lista al portapapeles, ya en el formato que necesita la lista de
   SharePoint.
3. **Contenido del sitio → Nuevo → Lista → En blanco**, nómbrala `Contratos`, y
   crea una columna por cada campo — usando el nombre del campo tal cual
   (`nro`, `detalle`, `area`, `cat`, `monto`, `montoTotal`, `cerrado`, `inicio`,
   `firma`, `fin`, `tipo`, `proveedor`, `plazo`, `adenda`, `tipoAdenda`,
   `modificacion`, `firmaAdenda`, `ac`, `correo`, `link`) — otra vez, nombrar
   igual que el JSON ahorra un paso de traducción en el flujo.
4. Importa el JSON copiado (Power Automate, o a mano si son pocos contratos —
   crece unas decenas al año, no miles).

De ahí en adelante, **el flujo de ingreso de nuevos contratos** (si el equipo
decide automatizar también esa parte, con un formulario parecido al de bienes)
escribiría directamente en esta lista con **SharePoint: Crear elemento** — el
mismo patrón de la parte 2. Mientras tanto, los contratos nuevos se agregan a
mano a la lista, o se sigue usando el Excel y se reimporta.

`correo` es la columna que hace todo el trabajo de acceso: **cualquiera cuyo
correo aparezca ahí ve automáticamente esos contratos al iniciar sesión**, sin
que nadie tenga que darlo de alta en ninguna lista aparte. Vale la pena
revisar que esté bien escrito (el correo real de Microsoft 365, no una
variante) para que el cruce del flujo de la parte 6 no falle en silencio.

---

## Parte 6 · El flujo protegido «obtener mis contratos»

Mismo mecanismo que la parte 4 (Azure AD en el disparador, identidad leída del
encabezado `X-MS-CLIENT-PRINCIPAL`, nunca de lo que mande el navegador — repasa
4.1 y 4.2 antes de esta parte, son los mismos pasos). Lo que cambia es la
regla de negocio: aquí no hay una sigla de área que buscar, hay **dos fuentes
de acceso que se combinan**.

### 6.1 Crear el flujo

Igual que 4.1: disparador HTTP, método `GET`, seguridad Azure AD OAuth con
«Cualquier usuario de mi inquilino», usando la misma app `CLM FAP`. Resuelve
el correo de quien llama exactamente como en 4.2–4.3 (decodificar
`X-MS-CLIENT-PRINCIPAL`, ubicar el `typ` del correo verificado contra tu
tenant).

### 6.2 Resolver el alcance

Con el correo ya resuelto, en orden:

1. **Buscar en `Accesos`**, columna `Contratos` (no la de `Bienes` — es la
   misma lista, otra columna): filtro `Correo eq '<correo>'`.
   - Si el valor es `TODAS` → alcance `todas`, se traen todos los contratos.
   - Si el valor es un nombre de área → alcance `area`, se filtra `Contratos`
     por `area eq '<ese valor>'`.
2. **Si no hay entrada en Accesos, o el valor no es ninguno de los dos
   anteriores** → se buscan en `Contratos` las filas donde
   `correo eq '<el correo de quien llama>'` (sus propios contratos, los que
   la matriz ya le tiene asignados). Si hay alguna → alcance `ac`.
3. **Si ninguna de las dos búsquedas trae nada** → **Respuesta** código `403`.
   Una cuenta válida de FIAS sin contratos propios y sin entrada en Accesos no
   tiene nada que ver aquí — no es un error, es que a esa persona no le toca
   nada todavía.

Esto es el motivo por el que **no hace falta mantener una lista de
administradoras**: en cuanto un contrato trae su correo en la columna
`correo`, esa persona ya puede iniciar sesión y verlo. `Accesos` solo cubre
las excepciones — alguien que debe ver todo, o toda una área más allá de lo
que tiene asignado a su nombre.

### 6.3 Responder

**Respuesta**, código 200:

```json
{
  "alcance": "@{if(equals(variables('esTodas'), true), 'todas', if(equals(variables('esArea'), true), 'area', 'ac'))}",
  "area": "@{variables('areaEncontrada')}",
  "contratos": @{body('Obtener_elementos_de_Contratos')?['value']}
}
```

(Ajusta los nombres de variable/acción a como te haya quedado el flujo — lo
importante es que `contratos` sea siempre un arreglo, aunque esté vacío, y que
`alcance` sea uno de los tres valores exactos que espera `bienes/index.html`,
`clm/index.html` y `crm/index.html`: `'todas'`, `'area'` o `'ac'`.)

### 6.4 Pegar la URL

En `clm/index.html` **y** `crm/index.html`:

```js
const API_MIS_CONTRATOS_URL = '';   // URL del disparador de este flujo — la misma en las dos
```

Es el mismo flujo para ambas: el CLM y el CRM piden exactamente lo mismo, cada
uno pinta la respuesta a su manera.

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
| «AADSTS65001» o pantalla de consentimiento atascada | Falta el consentimiento del administrador para `Bienes.Leer`/`Contratos.Leer` (Entra admin center → Permisos de API → Conceder consentimiento) |
| El login funciona pero «no pude consultar tus bienes/contratos» | `API_MIS_BIENES_URL`/`API_MIS_CONTRATOS_URL` vacío, o el flujo correspondiente (parte 4 o 6) no está publicado |
| Login correcto pero «no está en la lista de accesos» (bienes) | Falta agregar ese correo en la lista `Accesos`, columna Bienes (parte 1.2) — es el comportamiento esperado, no un error |
| Login correcto pero «no tiene contratos ni acceso registrado» | Ni tiene contratos con su correo en la columna `correo` de `Contratos`, ni una entrada en `Accesos` columna Contratos — revisa que el correo esté bien escrito en ambos lados |
| El flujo de consulta da 401 | La seguridad del disparador (4.1/6.1) no quedó en «Cualquier usuario de mi inquilino», o el scope pedido no coincide con `MSAL_API_SCOPE` de esa herramienta |
| Alguien ve bienes o contratos que no son suyos | Revisa la lista `Accesos` primero — es la causa más probable y la más fácil de arreglar |
| CLM/CRM: «AADSTS9002326» (cross-origin token redemption) | El URI de redirección de `clm/` o `crm/` no está registrado como tipo **SPA** — revisa 3.1 |
