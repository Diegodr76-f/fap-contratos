# El flujo «Obtener mis bienes» — guía completa

Este es el último flujo. Con este, cuando alguien inicia sesión con Microsoft,
la herramienta le muestra automáticamente **solo los bienes de su área** (o
todos, si es alguien de la lista `TODAS`). Sin este flujo, la herramienta
sigue funcionando para registrar bienes, pero pide elegir el área a mano.

**Antes de empezar, ya deberías tener:**
- El archivo `MATRIZ_CONTROL_INVENTARIO_FIAS.xlsx` en OneDrive, con las tablas
  `TActivos` y `TBienesControl`.
- Un archivo Excel de **Accesos**, con una tabla llamada **`TAccesos`** y dos
  columnas: `Correo` y `Área`.

Si algo de eso falta, es de los pasos anteriores — revisa
[`AVISAR_A_CATA.md`](AVISAR_A_CATA.md) y el mensaje de esta conversación donde
armamos la lista de Accesos.

---

## El plan en una frase

El flujo recibe una llamada, **averigua quién llama** (por el login de
Microsoft, no por lo que diga el navegador), **busca ese correo en Accesos**
para saber su área, **lee los dos Excel de bienes**, y **devuelve solo lo que
le toca** a esa persona.

Son 9 pasos. Ve marcándolos según los completes.

---

## Paso 1 · Crear el flujo

[make.powerautomate.com](https://make.powerautomate.com) → **Crear** →
**Flujo de nube instantáneo** → nómbralo `Obtener mis bienes` → disparador
**«Cuando se recibe una solicitud HTTP»** → **Crear**.

## Paso 2 · Protegerlo

1. En la cajita del disparador, **Configuración avanzada**.
2. **«¿Quién puede desencadenar el flujo?»** → **«Cualquier usuario de mi
   inquilino»**.
3. Si aparece un campo **«Método»**, ponlo en **`GET`** (esta llamada no manda
   datos, solo la credencial de quien entra).

## Paso 3 · Averiguar quién llama

**+ Nuevo paso** → **Compose** (búscalo como «Redactar»).

En el campo de entrada, pega exactamente esto:

```
json(base64ToString(triggerOutputs()?['headers']?['X-MS-CLIENT-PRINCIPAL']))
```

Esto descifra el "carnet de identidad" que Microsoft manda con cada llamada.
Adentro viene una lista de datos sobre la persona (correo, nombre, etc.),
pero el nombre exacto del campo del correo varía según cómo esté configurado
el directorio de FIAS — así que el siguiente paso lo confirma en vez de
adivinarlo.

### 3.1 · Confirmar el nombre del campo del correo (una sola vez)

1. **+ Nuevo paso** → **Respuesta** → código `200` → cuerpo: el contenido
   dinámico del Compose que acabas de crear.
2. **Guardar**.
3. Arriba, botón **«Probar»** → **«Manualmente»** → **«Probar»** → esto te va a
   pedir iniciar sesión (usa tu propia cuenta de FIAS) y ejecuta el flujo una
   vez de verdad.
4. Cuando termine, clic en la ejecución para ver el resultado. Busca la salida
   del paso Compose — es una lista de objetos con `typ` y `val`. Busca el que
   tenga tu **correo** como `val`, y anota el texto exacto de su `typ` (suele
   ser `upn` o `preferred_username`, a veces una URL larga que empieza con
   `http://schemas...`).

Ese texto lo vas a usar en el paso 4. **Bórralo o no del paso de Respuesta**
del punto 1 (esta era solo para la prueba); puedes reemplazarlo por el del
paso 5 más abajo cuando llegues ahí.

## Paso 4 · Sacar el correo de la lista de claims

**+ Nuevo paso** → **Compose**. Nómbralo (clic en los tres puntos → Cambiar
nombre) algo como `Correo de quien llama`. En el campo de entrada, reemplaza
`TU_TYP_AQUI` por lo que anotaste en el paso 3.1:

```
first(filter(outputs('Compose')?['claims'], equals(item()?['typ'], 'TU_TYP_AQUI')))?['val']
```

> Si tu Compose del paso 3 tiene otro nombre (Power Automate a veces le pone
> `Compose_2`, etc.), ajusta `outputs('Compose')` para que diga el nombre
> real — lo ves en el contenido dinámico si buscas «Salidas» de ese paso.

## Paso 5 · Buscar el correo en Accesos

**+ Nuevo paso** → **«Enumerar filas presentes en una tabla»** (Excel Online
Business).

- **Ubicación / Biblioteca**: donde está tu Excel de Accesos
- **Archivo**: el archivo de Accesos
- **Tabla**: `TAccesos`

Abre los **ajustes** de este paso (⋯) → activa **Paginación** → umbral `2000`
(la lista de accesos es chica, pero no cuesta nada dejarlo puesto).

**+ Nuevo paso** → **«Filtrar matriz»** (Filter array):

- **De**: el contenido dinámico `value` del paso anterior (Enumerar filas de
  Accesos)
- **Condición**: clic en «Modo avanzado» y pega:
  ```
  @equals(toLower(item()?['Correo']), toLower(outputs('Correo_de_quien_llama')))
  ```
  (ajusta `Correo_de_quien_llama` al nombre real de tu Compose del paso 4)

## Paso 6 · ¿Está en la lista?

**+ Nuevo paso** → **Condición**:

- Izquierda: `length(body('Filtrar_matriz'))` (ajusta el nombre si tu paso de
  Filtrar matriz se llama distinto)
- Operador: **es mayor que**
- Derecha: `0`

**Si es falso** (no está en Accesos): agrega ahí adentro **Respuesta**, código
`403`, cuerpo `{"error":"No estás en la lista de accesos."}`. Aquí termina
para esa persona — inició sesión bien, pero no ve ningún bien.

**Si es verdadero**, seguimos dentro de esa rama con los pasos 7, 8 y 9.

## Paso 7 · Leer los dos Excel de bienes

Dentro de la rama **«Si es verdadero»**:

**+ Nuevo paso** → **«Enumerar filas presentes en una tabla»**:
- **Archivo**: `MATRIZ_CONTROL_INVENTARIO_FIAS.xlsx`
- **Tabla**: `TActivos`
- Ajustes (⋯) → **Paginación** → umbral `5000` ⚠️ **sin esto, se cortan en
  256 filas**

**+ Nuevo paso** más abajo (mismo nivel), otra **«Enumerar filas presentes en
una tabla»**:
- Mismo archivo, **Tabla**: `TBienesControl`
- Paginación igual, umbral `5000`

## Paso 8 · Juntar todo y filtrar por área

**+ Nuevo paso** → **Compose**, nómbralo `Todos los bienes`:

```
union(body('Enumerar_filas_presentes_en_una_tabla')?['value'], body('Enumerar_filas_presentes_en_una_tabla_2')?['value'])
```

(ajusta los dos nombres a los que tengan tus pasos del paso 7 — los ves en el
contenido dinámico)

**+ Nuevo paso** → **«Filtrar matriz»**, nómbralo `Bienes de mi área`:
- **De**: la salida de `Todos los bienes`
- Modo avanzado:
  ```
  @equals(item()?['ÁREA (AC)'], first(body('Filtrar_matriz'))?['Área'])
  ```
  (`Filtrar_matriz` aquí es el del **paso 5**, el de Accesos — es de donde
  sale el área de la persona)

## Paso 9 · Responder

**+ Nuevo paso** → **Respuesta**, código `200`, **Cuerpo**:

```json
{
  "rol": "@{if(equals(toUpper(first(body('Filtrar_matriz'))?['Área']), 'TODAS'), 'cata', 'area')}",
  "sigla": "@{first(body('Filtrar_matriz'))?['Área']}",
  "bienes": "@{if(equals(toUpper(first(body('Filtrar_matriz'))?['Área']), 'TODAS'), outputs('Todos_los_bienes'), body('Bienes_de_mi_área'))}"
}
```

> Escribe esto en el editor en modo **código/texto** del cuerpo de la
> Respuesta (no en el modo de tabla), y ajusta los nombres entre `@{...}` a
> los tuyos si Power Automate les puso otro nombre a tus pasos.

**Guardar**. El disparador te da una URL — cópiala y pégala en
`bienes/index.html`:

```js
var API_MIS_BIENES_URL = '';   // ← aquí
```

---

## Probarlo

1. **Guardar** → **Probar** → **Manualmente** → esta vez usa tu cuenta (que
   ya está en Accesos como `TODAS`).
2. Revisa que la respuesta tenga `"rol":"cata"` y un `bienes` con más de mil
   elementos.
3. Pega la URL en el código, súbela, y entra a la herramienta con tu cuenta —
   ya no debería salir el aviso amarillo pidiéndote elegir el área.

## Si algo falla

| Pasa esto | Por qué |
|---|---|
| Aparece `403` con tu propia cuenta | El correo del paso 4 no coincide con el de tu fila en Accesos — revisa mayúsculas/typos en ambos lados |
| El flujo tarda mucho o falla | Falta la paginación en algún «Enumerar filas» (paso 7) |
| `bienes` sale vacío para un área que sí tiene bienes | La columna `ÁREA (AC)` del Excel no tiene exactamente el mismo texto que la columna `Área` de Accesos (ej. `PNC` vs `pnc` vs `P.N. Cotopaxi`) |
| El paso 4 da error o vacío | El `typ` que anotaste en 3.1 no es el correcto — repite esa prueba |

Cuando esto funcione, avísame y actualizamos `SIGUIENTES_PASOS.md` para
tacharlo de la lista.
