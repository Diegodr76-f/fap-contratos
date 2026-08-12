# La matriz se queda en Excel y Cata se entera de los cambios

Este es el plan que reemplaza al de pasar todo a una Lista de SharePoint.
**El archivo Excel sigue siendo la matriz oficial.** Nadie tiene que migrar
nada. Lo que se agrega encima son dos flujos:

| Flujo | Para qué | Cuándo avisa |
|---|---|---|
| **1. Bien nuevo** | El formulario de la herramienta escribe la fila directo en el Excel | Al instante, con el detalle de lo que entró |
| **2. Ronda diaria** | Detecta que alguien editó el archivo a mano | Una vez al día, si hubo movimiento |

Son dos porque **Power Automate no tiene un disparador de «cambió una fila
del Excel»**. Existe para Listas de SharePoint, pero no para Excel. Entonces:
lo que entra por el formulario se avisa exacto y al momento (flujo 1), y lo
que alguien cambie abriendo el archivo se avisa como resumen del día
(flujo 2).

---

## Antes de empezar

1. **Usa `MATRIZ_CONTROL_INVENTARIO_FIAS.xlsx`.** Es el formato nuevo (el que
   te pasaron, con las fórmulas automáticas) ya cargado con los datos reales
   de la matriz anterior: **502 activos fijos** y **754 bienes de control**.
   No uses ninguno de los dos originales por separado — el del formato viene
   vacío y con dos columnas rotas que borran lo que escribas, y el de los
   datos no tiene las fórmulas. Está explicado al final, en «Qué se hizo con
   los dos archivos».
2. **Súbelo a un sitio de equipo de SharePoint**, no a tu OneDrive personal.
   Si queda en tu carpeta personal, el día que cambies de cuenta o salgas de
   FIAS los flujos de los demás dejan de funcionar. Si por ahora no hay sitio
   de equipo, sirve igual, pero queda pendiente moverlo.
3. Anota los datos que te van a pedir los flujos: la **biblioteca**, el
   **nombre del archivo**, y los nombres de las dos tablas —
   **`TActivos`** (hoja Activos) y **`TBienesControl`** (hoja Bienes
   control).

---

## Flujo 1 — el bien nuevo entra solo y le avisa a Cata

### 1.1 Crear el flujo

[make.powerautomate.com](https://make.powerautomate.com) → **Crear** →
**Flujo de nube instantáneo** → disparador **«Cuando se recibe una solicitud
HTTP»** → **Crear**.

### 1.2 Protegerlo

Sin esto, cualquiera con el enlace podría escribir en la matriz.

1. En el disparador, abre **Configuración avanzada**.
2. En **«Quién puede desencadenar el flujo»** elige
   **«Cualquier usuario de mi inquilino»**.

Así solo entra gente con cuenta `@fias.org.ec`, y el flujo además sabe
**quién** fue.

### 1.3 Enseñarle al flujo qué datos le van a llegar

**Sin este paso el panel de «contenido dinámico» aparece vacío** y no hay nada
que elegir en los pasos siguientes. El disparador HTTP no adivina la forma de
lo que recibe: hay que mostrársela una vez.

1. En la cajita del disparador, clic en **«Usar carga de muestra para generar
   el esquema»** (*Use sample payload to generate schema*).
2. Se abre un cuadro de texto. Pega ahí **todo** el contenido del archivo
   [`muestra-bien.json`](muestra-bien.json) que está en esta misma carpeta.
3. **Listo** / **Done**.

Power Automate lee ese ejemplo y a partir de ahí ya conoce los 46 campos.
Desde este momento el panel de contenido dinámico los ofrece todos.

> El ejemplo es un bien inventado; solo sirve para que Power Automate aprenda
> los nombres y los tipos de cada campo. No se guarda en ningún lado.

### 1.4 Elegir a qué hoja va

La matriz tiene dos hojas y un bien va a una o a la otra según su valor. La
herramienta ya lo decidió y lo manda en el campo `_hoja`, así que el flujo
solo tiene que obedecer.

**+ Nuevo paso** → **Condición**:

- lado izquierdo: contenido dinámico `_hoja`
- operador: **es igual a**
- lado derecho: `Activos`

Quedan dos ramas: **«En caso afirmativo»** (activos fijos) y **«En caso
contrario»** (bienes de control).

### 1.5 Escribir la fila en el Excel

Dentro de **cada** rama: **Agregar una acción** → **«Agregar una fila a una
tabla»** (Excel Online para empresas).

- **Ubicación** y **Biblioteca**: donde subiste el archivo
- **Archivo**: `MATRIZ_CONTROL_INVENTARIO_FIAS.xlsx`
- **Tabla**: `TActivos` en la rama afirmativa, `TBienesControl` en la otra

Sí, el mapeo de abajo se llena **dos veces**, una por rama. Es la parte
aburrida; es idéntica en las dos.

Al elegir la tabla aparecen las 42 columnas. Se llenan con el contenido
dinámico del disparador, según esta tabla:

| Columna del Excel | Qué poner |
|---|---|
| CODIGO | `codigo` |
| DESCRIPCIÓN | `descripcion` |
| DESCRIPCIÓN(ADICIONAL) | `detalle` |
| CANTIDAD | `cantidad` |
| TIPO DE BIEN | `tipoContable` |
| PROYECTO (FIAS-FEIG-…) | `proyecto` |
| FECHA DE COMPRA | `fechaCompra` |
| DONANTE | `donante` |
| PROVEEDOR | `proveedor` |
| RUC DE PROVEEDOR | `ruc` |
| N° Factura / ACTA DE DONACIÓN | `factura` |
| FACTURA DIGITAL | `facturaLink` |
| VALOR DEL BIEN(INC.IMP) | `valor` |
| MARCA | `marca` |
| MODELO | `modelo` |
| NUMERO DE SERIE | `serie` |
| CEDULA CUSTODIO | `cedula` |
| NOMBRES Y APELLIDOS CUSTODIO | `custodio` |
| INSTITUCIÓN | `institucion` |
| UBICACIÓN | `ubicacion` |
| ACTA ENTREGA | `acta` |
| ASEGURADO (SI/NO) | `asegurado` |
| INICIO SEGURO | `inicioSeguro` |
| FIN SEGURO | `finSeguro` |
| ASEGURADORA | `aseguradora` |
| NRO DE POLIZA | `poliza` |
| GARANTIA TECNICA | `garantia` |
| INICIO GARANTIA (FECHA) | `inicioGarantia` |
| FIN DE GARANTIA (FECHA) | `finGarantia` |
| Estado físico detallado | `estadoFisico` |
| Vida útil estimada (AÑOS) | `vida` |
| Fecha de baja (SI APLICA) | `fechaBaja` |
| Motivo de baja (SI APLICA) | `motivoBaja` |
| OBSERVACIONES | `observaciones` |
| Fotografía del bien | `foto` |
| **ÁREA (AC)** | **`_sigla`** |

> **`ÁREA (AC)` es la que hace que después cada AC vea solo lo suyo.** Es la
> única que no se puede saltar.

**Estas siete se dejan VACÍAS a propósito**, porque el Excel las calcula
solo: `ESTADO DE GARANTIA`, las cuatro de `Depreciación`, `Valor residual` y
`Código QR`.

> Después de la primera prueba, abre el archivo y mira esas siete columnas en
> la fila nueva. Deberían haberse llenado solas. Si aparecieran vacías,
> párate en la celda de arriba, copia, y pega en la de abajo una sola vez:
> Excel entiende el patrón y desde ahí lo hace solo.

### 1.6 Avisarle a Cata

Debajo de la condición (ya fuera de las dos ramas): **+ Nuevo paso** →
**«Enviar un correo electrónico (V2)»** (Office 365 Outlook).

- **Para**: el correo de Cata
- **Asunto**: `Bien nuevo en la matriz: ` + `codigo`
- **Cuerpo**: lo que quieras que lea de un vistazo. Sugerido:

```
Se registró un bien nuevo desde la herramienta.

Tipo:        _hoja
Código:      codigo
Descripción: descripcion
Área:        _area
Valor:       valor
Custodio:    custodio
Ubicación:   ubicacion

Ya está en la matriz, en la última fila. Falta revisarlo.
```

(Las palabras en minúscula son contenido dinámico del disparador, no texto.)

### 1.7 Devolver respuesta

**+ Nuevo paso** → **«Respuesta»** → **Código de estado** `200`. Sin esto la
herramienta se queda esperando y muestra error aunque el bien sí haya
entrado.

### 1.8 Conectar la herramienta

**Guardar**. El disparador ahora muestra una **URL HTTP POST**. Cópiala y
pégala en `bienes/index.html`, en la línea:

```js
var FLOW_BIENES_URL = '';
```

entre las comillas.

> **Por qué ahora pide iniciar sesión al registrar.** Como en el paso 1.2 se
> protegió el flujo para que solo entre gente de FIAS, la herramienta necesita
> demostrar quién eres antes de escribir en la matriz — igual que un banco te
> pide clave antes de una transferencia. Si ya iniciaste sesión con Microsoft
> antes (por ejemplo para ver tus bienes), no notas nada, es automático. Si
> entraste directo a «Registrar un bien» sin iniciar sesión, al apretar
> «Enviar» se abre la ventanita de Microsoft para que confirmes tu cuenta esa
> única vez.

---

## Flujo 2 — la ronda diaria

Avisa si alguien editó el archivo directamente, sin pasar por el formulario.

1. **Crear** → **Flujo de nube programado**.
2. **Se repite cada**: `1` **Día**. Hora: la que prefiera Cata, por ejemplo
   las 17:00.
3. **+ Nuevo paso** → **«Obtener metadatos del archivo»** (SharePoint) →
   apunta al archivo de la matriz.
4. **+ Nuevo paso** → **Condición**:
   - lado izquierdo: contenido dinámico **«Última hora de modificación»**
   - operador: **es mayor que**
   - lado derecho, en el editor de expresiones: `addDays(utcNow(), -1)`
5. En la rama **«En caso afirmativo»**: **«Enviar un correo electrónico
   (V2)»** a Cata, asunto `La matriz de bienes se modificó hoy`, y en el
   cuerpo incluye el contenido dinámico **«Vínculo al elemento»** para que
   pueda abrirla de un clic.

Con esto Cata recibe **como máximo un correo al día**, y solo si hubo
movimiento.

> **Por qué no un aviso inmediato:** existe el disparador «Cuando se modifica
> un archivo», pero Excel guarda solo mientras la gente escribe, así que
> dispararía decenas de correos por una sola sesión de trabajo. La ronda
> diaria dice lo mismo sin volverla loca.

---

## Después: que cada AC vea solo lo suyo

Ese es el tercer flujo, el de lectura, y ya está descrito en
[`CONECTAR.md`](CONECTAR.md) **parte 4**. La única diferencia es que en vez
de «Obtener elementos» de una Lista, se usa **«Enumerar filas presentes en
una tabla»** del Excel, filtrando por la columna `ÁREA (AC)` según quién
inició sesión.

Dos cosas que hay que recordar ahí:

- **Activar la paginación** en ese paso (tres puntos → Configuración →
  Paginación → Umbral `5000`). Sin eso lee solo las primeras 256 filas.
- Necesita la lista **Accesos** (correo → área), que todavía no existe. Está
  descrita en [`SIGUIENTES_PASOS.md`](SIGUIENTES_PASOS.md).

Mientras tanto la herramienta **ya funciona** sin ningún flujo: en la
pantalla de acceso hay un botón para abrir la matriz `.xlsx` desde tu propio
computador, y muestra el panel completo, las alertas y los códigos QR. El
archivo no se sube a ningún lado, se lee en el navegador.

---

## Qué se hizo con los dos archivos

Había uno con el **formato** bueno (fórmulas automáticas, pero vacío) y otro
con los **datos** reales (1.256 bienes, sin fórmulas). Se unieron en uno solo:
el formato nuevo, con dos hojas — `Activos` (502) y `Bienes control` (754) —
y los datos de cada bien puestos en la columna que les toca.

Las columnas que el formato nuevo no tenía se resolvieron así:

- La matriz vieja separaba **TIPO DE BIEN** en «seguros» y «sistema
  contable»; la nueva tiene una sola. Se conservó la del sistema contable,
  que es la que manda en la depreciación.
- La columna **`sigla`** de la matriz vieja pasó a llamarse **`ÁREA (AC)`**.
- Se soltaron **`Depreciación Acumulada Diciembre`** y **`Valor residual
  diciembre 2025`**: eran cortes congelados a una fecha, y las fórmulas
  nuevas recalculan a hoy.
- Los números de depreciación que venían **escritos a mano** se reemplazaron
  por las fórmulas. En la matriz vieja estaban congelados a fechas distintas
  entre sí (ver [`MATRIZ.md`](MATRIZ.md), sección 4), así que no se perdió
  nada bueno.

### Y lo que se corrigió del formato

El Excel del formato tenía cuatro problemas que iban a dar guerra:

1. **`INICIO GARANTIA` y `FIN DE GARANTIA` estaban rotas.** Eran columnas
   calculadas con la fórmula `#REF!`. Cada fila nueva se autollenaba con un
   error y **borraba la fecha que la persona acababa de escribir**. Ahora son
   columnas normales de captura.
2. **`Depreciación Acumulada` tenía el año 2025 escrito a mano.** Estamos en
   2026, así que ya calculaba un año de menos, y el problema se repetía cada
   enero. Ahora usa el año actual automáticamente.
3. **`Código QR` usaba la función `IMAGE()`**, que no existe en la mayoría de
   versiones de Excel: mostraba `#NAME?`. Es la misma fórmula que nunca
   funcionó en la matriz anterior. Ahora esa columna guarda el texto del QR,
   y el código de barras de verdad lo dibuja la herramienta en pantalla,
   listo para imprimir como etiqueta.
4. **`ESTADO DE GARANTIA` marcaba «Caducado» cuando la celda estaba vacía.**
   Ahora una celda vacía dice `N/A`, que es lo correcto.

Y se agregaron dos cosas:

- La columna **`ÁREA (AC)`** al final, que es la que permite que cada AC vea
  solo sus bienes.
- **Listas desplegables** en `ASEGURADO`, `GARANTIA TECNICA`, `Estado físico`
  y `PROYECTO`, para que no se escriban de diez formas distintas. Es la razón
  por la que la matriz anterior terminó tan desordenada.

También se quitó la fila de ejemplo que decía «Ingrese sus datos aquí»,
porque si no se contaba como un bien real con valor 0.

> **Cinco fechas quedaron vacías** porque en el archivo original estaban
> ilegibles (`31/12/202`, `31/07/206`, `5/11/206`, `27/08/219`, `04/0-2020`).
> Son cinco celdas para corregir a mano cuando haya tiempo, revisando la
> factura de cada bien.
