# La matriz de bienes: qué dice y qué se automatizó

Este documento explica de dónde sale cada regla y cada lista de la herramienta,
para que cualquiera pueda revisarlo o corregirlo sin adivinar. Todo lo de aquí se
sacó de la **MATRIZ NACIONAL DE ACTIVOS Y BIENES 2026**: 1.260 bienes repartidos en
dos hojas, con 44 columnas cada una.

| Hoja | Filas con datos | Valor mínimo | Valor máximo | Mediana |
|---|---:|---:|---:|---:|
| `Activos ` (activos fijos) | 504 | $500,00 | $39.487,47 | $794,50 |
| `Bienes control` | 756 | $45,00 | $1.196,00 | $240,00 |
| **Total** | **1.260** | | | |

De esas 1.260 filas, **1.247 son bienes reales**: cuatro son marcadores de sitio
escritos donde va el código y nueve son copias duplicadas. Las dos cosas están
explicadas en el punto 6.

---

## 1. De 44 columnas a 12 campos

La AC llena 12 cosas. Las otras 32 columnas salen de tres sitios: se calculan, son
fijas, o vienen del catálogo. Ese es el corazón del ahorro de tiempo.

### Se llena a mano (12)

Descripción · detalle · tipo de bien · valor con IVA · fecha de compra · proveedor y
RUC · n.º de factura · marca, modelo y serie · custodio (cédula y nombre) ·
ubicación · enlaces (factura, acta, foto).

### Se calcula (10)

| Columna | Regla |
|---|---|
| `CODIGO` | Secuencial siguiente del área: `02-SIGLA-###-SUF` |
| Hoja destino | Activo fijo desde **$500**; por debajo, bien de control |
| `Vida útil estimada` | Por tipo contable (tabla del punto 3) |
| `Depreciación Lineal Anual` | `valor ÷ vida útil` |
| `Depreciación Mensual` | `anual ÷ 12` |
| `Depreciación Acumulada` | `mensual × meses completos desde la compra`, topada al valor |
| `Valor residual` | `valor − acumulada` |
| `ESTADO DE GARANTIA` | `Vigente` / `Caducado` / `N/A` comparando con hoy |
| `TIPO DE BIEN SEGUROS` | Por tipo contable |
| Sufijo del código | Por tipo contable: `EC`, `EO`, `MA`, `ME`, `VH` |

### Es fijo o viene de la póliza (10)

`PROYECTO` (FAP en el 99,6 % de la matriz) · `CANTIDAD` (1) · `ASEGURADO` ·
`ASEGURADORA` · `NRO DE POLIZA` · `INICIO SEGURO` · `FIN SEGURO` · `INSTITUCIÓN` ·
`Estado físico` (NUEVO por defecto) · `Código QR`.

Los datos de la póliza vigente están en una sola constante de `index.html`:

```js
var POLIZA = { aseguradora:'ASEGURADORA DEL SUR', nro:'201752',
               inicio:'2026-01-01', fin:'2027-01-01' };
```

Cuando el FAP renueve la póliza se cambia ahí, una vez, y todos los bienes que se
registren después salen bien.

---

## 2. El umbral de los $500

No es una suposición: **es lo que ya hace la matriz**. Los 504 registros de la hoja
*Activos* valen $500 o más —el mínimo exacto es $500,00— y los de *Bienes control*
están casi todos por debajo. Por eso la herramienta rutea sola y no le pregunta a la
AC en qué hoja va su bien, que es justo la parte que requiere criterio contable.

Once filas de la matriz de hoy no cumplen esa regla, pero al mirarlas de cerca solo
**una** es un problema de clasificación: las otras diez resultaron ser copias
duplicadas y filas que ni siquiera son bienes (ver el punto 6). Salen separadas en
**Alertas**, cada una con su arreglo.

---

## 3. Tipo de bien: de 49 formas de escribirlo a 5

La columna `TIPO DE BIEN SEGUROS` tiene **49 variantes** para lo que en realidad son
cinco categorías. Están, todas juntas: `EQUIPO DE OFICINA`, `Equipo de oficina/campo`,
`Equipos de oficina - campo`, `EQUIPO DE OFICINA CAMPO`, `EQUIPO DE OFICINA - CAMPO`,
`EQUIIPO DE OFICINA Y CAMPO`, `EQUIPO DE OFINA / CAMPO`, `EQUIPO OFICINA`… y así con
computación (13 variantes) y maquinaria (6).

La columna `TIPO DE BIEN SISTEMA CONTABLE` sí está limpia —cinco valores— pero está
**vacía en las 756 filas de *Bienes control***.

La herramienta pregunta **una sola cosa** (el tipo contable, con ejemplos de qué
entra en cada uno) y de ahí deriva las otras tres columnas:

| Tipo contable | Vida útil | Sufijo | Tipo para el seguro |
|---|---:|---|---|
| EQUIPO DE COMPUTACIÓN | 3 años | `EC` | EQUIPO DE COMPUTACIÓN |
| EQUIPO DE OFICINA/CAMPO | 10 años | `EO` | EQUIPO DE OFICINA Y CAMPO |
| MAQUINARIA Y EQUIPO DE CAMPO | 10 años | `MA` | MAQUINARIA Y EQUIPO |
| MUEBLES Y ENSERES | 10 años | `ME` | MUEBLES Y ENSERES |
| VEHÍCULOS | 5 años | `VH` | VEHÍCULO |

Las vidas útiles se leyeron de la matriz, no se inventaron: de los 176 equipos de
computación, 175 tienen 3 años; los 161 de oficina/campo y los 110 de maquinaria
tienen 10; de los 21 vehículos, 19 tienen 5.

El mismo tratamiento reciben las otras columnas de texto libre que se repetían mal
escritas: **donante** (`KFW`, `KfW`, `kwf` eran el mismo), **aseguradora** (cinco
formas de escribir *Aseguradora del Sur*), **institución** e **ubicación**, que
ahora se ofrece como lista de las que ya usa cada área.

---

## 4. La depreciación estaba congelada a fechas distintas

Las cinco columnas que la matriz llama «Campo Automático» **no tienen fórmula**: son
números pegados a mano. Y como se pegaron en momentos distintos, hoy conviven en el
mismo archivo cifras calculadas a fechas diferentes:

- 900 filas están calculadas con corte al **31 de marzo de 2026**
- otras a **febrero de 2026** (por ejemplo `02-REVISMEM-036-ECAMPO`, con 33 meses en
  vez de 34)
- y algunas compradas en noviembre de 2025 quedaron en **cero** (`02-RBCP-074-EO`,
  $3.220, nunca se depreció)

La fórmula que sí usaron, verificada contra esas 900 filas, es depreciación lineal
**a valor residual cero**:

```
anual     = valor ÷ vida útil
mensual   = anual ÷ 12
acumulada = mín( mensual × meses completos desde la compra , valor )
residual  = valor − acumulada
```

La herramienta hace exactamente eso, **con corte del día en que se abre**. Por eso el
robot no publica la depreciación: la recalcula la herramienta. Congelarla en el
archivo publicado sería volver a crear el problema.

131 bienes ya cumplieron su vida útil y están en cero; salen marcados como
*totalmente depreciados* en vez de con números negativos.

---

## 5. Las 46 áreas y sus siglas

El área de cada bien **no está en ninguna columna**: vive dentro del código, en el
segundo bloque (`02-`**`RBL`**`-014-EC`). De ahí sale quién ve qué. Las 44 áreas con
bienes en la matriz —una de ellas, El Pambilar, escondida dentro de la sigla de
otra— más dos que todavía no tienen ninguno:

| Sigla | Área | Bienes |
|---|---|---:|
| RVSMCP | RVS Marino Costero Pacoche | 103 |
| PNCCa | PN Cotacachi Cayapas | 79 |
| RBCP | RB Cerro Plateado | 68 |
| PNSNG | PN Sumaco Napo Galeras | 62 |
| RBL | RB Limoncocha | 61 |
| RMPSE | RPF Marino Costera Puntilla Santa Elena | 60 |
| PNP | PN Podocarpus | 49 |
| RMGSF | RM Galera San Francisco | 49 |
| PNY | PN Yasuní | 44 |
| REI | RE Los Ilinizas | 42 |
| REMACH | RE Mache Chindul | 41 |
| PNLL | PN Llanganates | 40 |
| PNYCI | PN Yacuri | 39 |
| PNA | PN Antisana | 36 |
| PNC | PN Cotopaxi | 33 |
| RGP | RG Pululahua | 33 |
| ANRIS | ANR Isla Santay | 33 |
| RVSEP | RVS El Pambilar | 33 |
| RMEP | RM El Pelado | 26 |
| RVSCH | RVS La Chiquita | 26 |
| RVSMERE | RVS Estuario del Río Esmeraldas | 26 |
| RPFC | RPF Cuyabeno | 25 |
| RBCC | RB Colonso Chalupas | 24 |
| PNCC | PN Cayambe Coca | 20 |
| RCM | RE Manglares Cayapas Mataje | 20 |
| RVSMERM | RVS Manglares Estuario Río Muisne | 20 |
| RVSP | RVS Pasochoa | 19 |
| RBEC | RB El Cóndor | 17 |
| RVSEZ | RVS El Zarza | 15 |
| REEA | RE El Ángel | 14 |
| RBEQ | RB El Quimi | 14 |
| RVSMT | RVS Machángara Tomebamba | 13 |
| REVISICOF | RVS Isla Corazón y Fragatas | 11 |
| PNM | PN Machalilla | 10 |
| REVISMEM | RVS Manglares El Morro | 8 |
| ANRPL | ANR Playas de Villamil | 7 |
| RPFMS | RPF Manglares El Salado | 7 |
| RMISC | RM Isla Santa Clara | 7 |
| DAPOFC | Dirección de Áreas Protegidas (oficina central) | 5 |
| REAR | RE Arenillas | 5 |
| ANRB | ANR El Boliche | 4 |
| RECB | RE Cofán Bermejo | 3 |
| PNRNS | PN Río Negro Sopladora | 3 |
| REMCH | RE Manglares Churute | 2 |
| PNS | PN Sangay | 0 |
| RPFCH | RPF Chimborazo | 0 |

Coincide con el catálogo de 44 áreas que ya usa el **Mapa de áreas** del CLM (ver
[`../clm/MAPA_AREAS.md`](../clm/MAPA_AREAS.md)), con tres diferencias que valía la
pena registrar:

- **Pacoche, El Salado y El Pambilar** tienen bienes pero no aparecen en la base de
  contratos, así que no estaban en el mapa.
- **PN Sangay y RPF Chimborazo** están en el mapa pero no tienen ningún bien
  registrado. Se dejaron en la lista para que puedan registrar.
- **`RVSP` se usó para dos áreas a la vez**: 19 bienes son de Pasochoa y 33 de El
  Pambilar. Como el código no las distingue, la herramienta desempata por la
  ubicación (si dice «Pambilar», es Pambilar) y de aquí en adelante El Pambilar usa
  **`RVSEP`**.

Y tres formas de escribir que apuntan a lo mismo, tratadas como alias: `RMPCPS` →
`REVISICOF`, `RPFMCPSE` → `RMPSE`, `RECM` → `RCM`.

### El código nuevo

`02-SIGLA-###-SUF`, donde `###` es el secuencial siguiente del área. La herramienta
lo propone sola cuando la AC inició sesión y su cuenta está en la lista de accesos
(porque solo entonces sabe hasta qué número va su área). Sin sesión, la
administradora lo asigna.

Se estandarizó ese orden porque es el que usan **1.108 de los 1.260** bienes. Los 152
restantes se desvían de cinco maneras, y la herramienta las lee todas aunque no las
reproduzca:

| Desviación | Ejemplo | Bienes |
|---|---|---:|
| Bloques de más | `02-RVSMCP-001-EO-2` | 90 |
| Empieza con `FIAS-` en vez de `02-` | `FIAS-REI-007-EO` | 35 |
| Bloque separado por espacio | `02 RPFMS-026-001-EO` | 9 |
| Tipo antes del número | `02-DAPOFC-EC-004` | 5 |
| Notas y erratas dentro del código | `02-RVSCH-026MA`, `'02-PNA-055-EO`, `02-RBCP-074-EO NO ESTA EN LA MATRIZ DEL ÁREA` | 13 |

Ese último grupo es el que conviene limpiar en el Excel: hay comillas sueltas al
inicio, guiones que faltan y **comentarios escritos dentro de la celda del código**.

---

## 6. Lo que la revisión encontró en la matriz de hoy

Todo esto sale en **Alertas** cuando la administradora abre el panel. No lo arregla
la herramienta —los datos viven en el Excel— pero deja de ser invisible.

| Hallazgo | Filas |
|---|---:|
| Sin fotografía | 75 |
| Bienes sin seguro | 85 |
| Seguro vencido o por vencer en 60 días | 59 |
| **El mismo bien copiado en las dos hojas** | 20 |
| Sin custodio | 16 |
| Sin acta de entrega | 15 |
| Códigos repetidos (dos bienes distintos) | 6 |
| Sin fecha de compra | 4 |
| Valor incompatible con la hoja donde está | 1 |

Hay 13 códigos que aparecen dos veces, y son **dos problemas distintos** con dos
arreglos distintos. Por eso la herramienta los separa:

**Nueve bienes están literalmente duplicados**: la misma fila —mismo código, misma
descripción, mismo valor, mismo custodio— está en *Activos* **y** en *Bienes
control*. Ocho son de Los Ilinizas (`FIAS-REI-007-EO`, `FIAS-REI-009-MA`,
`FIAS-REI-010-MA`, `FIAS-REI-011-MA`, `02-REI-014-EO`, `02-REI-015-EO`,
`02-REI-018-EC`, `02-REI-019-MA`) y uno de El Pelado (`02-RMEP-008-MA`). Los nueve
valen $500 o más, así que la copia que sobra es la de *Bienes control*. Mientras
estén, **el patrimonio está inflado en $6.401,53**. Ese mismo error es el que
producía casi toda la alerta de «hoja equivocada»: una vez separado, esa alerta baja
de 11 a 1.

**Tres son colisiones de código de verdad**: `02-RVSP-002-EC`, `-003-EC` y `-004-EC`
son a la vez un computador portátil de Pasochoa y una motosierra, un taladro y una
amoladora de El Pambilar. Es la consecuencia práctica de que las dos áreas
compartieran la sigla `RVSP`. Aquí no sobra ninguna fila: hay que recodificar las de
El Pambilar con `RVSEP`.

El par 13 no es un bien (ver abajo).

Otros tres detalles que no son alertas pero conviene saber:

- **Cuatro filas de la matriz no son bienes**, sino marcadores de sitio escritos en
  la columna del código: `PARA COMPLERAR AL FINAL` y `ESPACIO PARA PLAYAS` en
  *Activos*, `ESPACIO PARA EL MORRO` y otro `ESPACIO PARA PLAYAS` en *Bienes
  control*. Inflan el conteo, y las dos de «PLAYAS» son uno de los 13 pares
  repetidos. Conviene borrarlas.

- **El código QR nunca funcionó.** Las 1.260 filas tienen `#VALUE!` en esa columna:
  la fórmula usa `IMAGE()`, que la versión de Excel del equipo no reconoce. Además
  llama a un servicio externo (`api.qrserver.com`), que en la red institucional
  suele estar bloqueado.
- **50 bienes tienen `S/S` como número de serie** y otros cinco dicen `SIN NUMERO`.
  No es un error —hay bienes sin serie— pero conviene que se escriba siempre igual;
  el formulario sugiere `S/N`.

---

## 7. Quién ve qué

La matriz junta dos cosas delicadas a la vez: cédula y nombre de cada custodio
(dato personal), y un inventario con ubicación exacta y número de serie de equipos
portátiles caros (un mapa de qué robar y dónde, si cae en las manos equivocadas).
Eso pesa más que "cómodo de compartir", así que el acceso no depende de una frase
que alguien pueda reenviar por WhatsApp sin querer: depende de **iniciar sesión
con la cuenta real de FIAS**.

| Entra como | Ve |
|---|---|
| Sin iniciar sesión | Solo el formulario de registro |
| Cuenta de FIAS, en la lista de Accesos con un área | El formulario y los bienes de esa área |
| Cuenta de FIAS, en Accesos como `TODAS` | Todo: panel, revisión, alertas |
| Cuenta de FIAS que no está en Accesos | Solo el formulario — el login no basta por sí solo |

El mecanismo tiene dos capas que hacen preguntas distintas, y las dos tienen que
responder que sí:

1. **¿Es una cuenta real de FIAS?** Lo verifica Entra ID (el directorio de
   Microsoft 365) cuando alguien toca «Iniciar sesión con Microsoft». Esto
   descarta a cualquiera fuera de la organización, sin que este archivo tenga
   que saber nada de contraseñas.
2. **¿Qué le toca ver a esa cuenta?** Lo decide un flujo de Power Automate que
   nunca confía en lo que diga el navegador: lee la identidad que el propio
   inicio de sesión certificó, la busca en la lista **Accesos** de SharePoint
   (correo → área), y filtra los bienes con ese resultado antes de mandar nada.
   Este archivo HTML solo pinta lo que ese flujo decide — no puede decidirlo por
   su cuenta ni aunque alguien le cambiara el código en su propio navegador,
   porque los datos de las demás áreas nunca llegan a descargarse.

La diferencia con el modelo anterior (una frase compartida, cifrado en el propio
navegador) es esa segunda capa: antes, quien tenía la frase maestra podía ver todo
sin que nadie más lo supiera. Ahora, dar o quitar acceso es editar dos columnas en
una lista de SharePoint, queda con el registro de quién lo cambió, y se puede
revocar al instante — algo que una frase ya repartida no permite deshacer.

El paso a paso completo, incluyendo cómo el flujo verifica la identidad sin
confiar en el cliente, está en [`CONECTAR.md`](CONECTAR.md).
