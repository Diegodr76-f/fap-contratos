# FAP Contratos — notas para trabajar en este repositorio

Herramientas web estáticas para el Fondo de Áreas Protegidas (FIAS), publicadas en
GitHub Pages. No hay build, ni framework, ni dependencias instaladas: cada carpeta
es un `index.html` que se abre tal cual, también desde el disco y sin conexión.

## El idioma de las plantillas: `generador/variables_fap.json`

**Antes de escribir o modificar cualquier plantilla, consulta el catálogo.** Es la
copia en el repositorio del catálogo de variables que maneja el sistema, y es el
vocabulario único de todos los documentos: las plantillas Word de La Mágica, las
plantillas HTML del CLM y lo que el CRM publica.

```bash
python3 scripts/variables.py                  # los 13 grupos
python3 scripts/variables.py Fechas           # un grupo, con descripción y ejemplo
python3 scripts/variables.py --buscar monto   # antes de inventar un nombre, BUSCA
python3 scripts/variables.py --check          # plantillas contra catálogo
```

La regla es una sola: **no inventes sinónimos**. Si necesitas un dato, búscalo
primero; lo más probable es que ya tenga nombre. Ya pasó una vez: la vía de
renovación nació con `contratoAnterior`, `fechaSuscripcionAnt`, `fechaFinAnterior`,
`montoAnterior` y `fechaNotificacion`, que en el catálogo eran `contratoNro`,
`fechaContrato`, `fechaFin`, `montoTotal` y `fechanotificacion`. No es cosmético:
los cuatro primeros los publica el CRM, así que el sinónimo convertía en tecleo lo
que podía ser precarga, y el quinto se separaba del suyo por una mayúscula.

Si el dato de verdad es nuevo: añádelo a `generador/variables_fap.json` con su
grupo, tipo, descripción y ejemplo, y avisa de que hay que **importarlo al sistema**
(el archivo se importa tal cual). En sentido contrario, para traer al repositorio lo
que se haya creado en el sistema:

```bash
python3 scripts/variables.py --unir <export_del_sistema.json>
```

Dos comprobaciones lo sostienen, y conviene correr ambas antes de dar algo por bueno:
`scripts/variables.py --check` mira las plantillas, y `scripts/probar_generador.js`
mira lo que La Mágica les entrega —y, de paso, rellena las 18 de verdad.

## Que los .docx se abran: `scripts/validar_docx.py`

**Un .docx puede ser un zip con XML impecable y aun así estar roto.** En
septiembre de 2026 llegaron a `main` once plantillas que Word declaraba dañadas:
al convertir los cuadros combinados en variables se sustituyó un `<w:sdt>` que
envolvía un PÁRRAFO entero por una corrida suelta, y quedó un `<w:r>` donde iba
un `<w:p>`.

Lo peor no fue el fallo sino que **nada lo detectaba**: python-docx abría las
once sin protestar y LibreOffice las convertía a PDF tan contento. Los dos son
permisivos; Word no. Por eso hay un validador que contrasta contra el esquema
oficial ISO/IEC 29500-4:2016, que está copiado en `scripts/esquemas/`.

```bash
python3 scripts/validar_docx.py                    las plantillas del repo
python3 scripts/validar_docx.py <carpeta|archivo>  lo que se le diga
```

**Y que abra no basta: tiene que rellenarse.** `{monto (` —una llave sin cerrar— da
un `.docx` que Word abre y el esquema aprueba, pero que docxtemplater rechaza al
compilarlo: el documento no se puede generar. Eso lo ve `scripts/probar_generador.js`,
que rellena las 18 plantillas con datos reales en cada corrida. Córrelo también.

**Córrelo después de tocar cualquier .docx**, y también sobre los documentos ya
rellenados, que es lo que la AC abre de verdad. `concordancia.py --aplicar` lo
usa solo: si lo que escribe no abriría en Word, restaura el original y aborta.

Dos reglas que se aprendieron ahí, por si hay que volver a manipular XML de Word:

- Un `<w:sdt>` puede envolver corridas **o un párrafo entero**. No se sustituye
  el control por algo nuevo: se desenvuelve, dejando su contenido con su
  estructura, y solo se cambia el texto de dentro.
- El orden de los hijos no es libre. En `<w:tblPr>` va tblW → tblBorders →
  tblLayout → tblCellMar → tblLook; con tblBorders detrás de tblLayout el
  documento queda inválido. Eso la comprobación de estructura no lo ve, el
  esquema sí.

## Concordancia de género: `scripts/concordancia.py`

Las plantillas llevaban **187 cuadros combinados** que la AC elegía a mano en cada
documento. El que se olvidaba no fallaba en silencio: imprimía la barra
—«Administrador/a Contador/a», «del/a»— en un papel que se firma.

Hoy **163 de esos 187 salen de variables**. Solo se elige el género de la AC y el
del responsable del área (una vez, en la Hoja de Datos) y el del proveedor (una
vez por proveedor, porque cada invitación va dirigida a uno distinto). El género
del nombre del área se propone desde el propio nombre («la Reserva», «el
Parque»), y el número —bien/bienes, día/días— y la naturaleza —adquisición/
contratación— se derivan de lo ya capturado. El motor está en `concordancias()`
dentro de `generador/index.html`.

**Los 24 controles que quedan NO se tocan, y la razón importa:** «Cumple / No
cumple» es un juicio sobre cada oferta, «Presencial / Virtual» es cómo asistió
cada miembro a la sesión, «solicitud / cotización» es qué documento se nombra, y
el `el/la` que va delante de `{objeto}` depende del género de un texto libre que
escribe la AC — elegir uno sería adivinar.

El conversor trabaja **con lista blanca**: convierte solo lo que una regla nombra
explícitamente, y deja intacto todo lo demás. Si aparece un control sin regla,
avisa y no lo toca.

```bash
python3 scripts/concordancia.py --revisar     qué se convertiría y qué no
python3 scripts/concordancia.py --aplicar     reescribe las plantillas
python3 scripts/concordancia.py --verificar   que lo que no es concordancia sigue ahí
```

Corre `--verificar` después de cualquier cambio en las plantillas: comprueba que
los 24 controles de juicio siguen estando, uno por uno.

## Dos cosas de las plantillas que no se ven leyendo el Word

**Los montos en letras ya traen el número.** `{montoLetras}`, `{presupuestoLetras}`,
`{montoTotalLetras}` y compañía no son solo las palabras: `montoEnLetras()` devuelve
`USD 1.150,00 (Mil ciento cincuenta con 00/100 dólares de los Estados Unidos de
América) incluidos impuestos`. En la plantilla van **solos**; escribir
`USD {monto} ({montoLetras})` —que es lo natural si uno viene del generador de
instrumentos jurídicos, donde esa variable sí son solo las palabras— duplica el
número en el documento firmado.

**Las plantillas se editan en Word, a mano.** No hay script que las genere: el
formato es de quien firma los documentos. Después de tocar una, siempre:

```bash
python3 scripts/validar_docx.py        # ¿abre en Word?
node scripts/probar_generador.js       # ¿se rellena? ¿tiene dato cada etiqueta?
python3 scripts/variables.py --check   # ¿usa nombres del catálogo?
python3 scripts/concordancia.py --verificar
python3 scripts/embeber_plantillas.py  # y el seed, en el mismo commit
```

## La renovación no lleva notificación

La notificación al proveedor la hace el **Director Ejecutivo** con la Unidad Operativa,
ya revisado el proceso y antes del contrato. La administradora arma el informe de
satisfacción (Momento 1), pide la cotización (Momento 2), registra el monto en firme
(Momento 3) y envía el expediente (Momento 4). Como así ningún documento cierra el
expediente, el cierre lo registra `marcarEnviadoUO()` al salir hacia la Unidad.

## Orden o contrato: lo decide el plazo de ejecución

**La regla es una sola: si la ejecución dura más de 30 días, va por contrato.**
Las garantías contractuales (anticipo, fiel cumplimiento) también obligan a
contrato, pero son un eje aparte y opcional — la mayoría de los procesos no
llevan ninguna.

El instrumento **no se marca: se deriva**, en `motivoContrato()`, que devuelve
por qué va por contrato (`'plazo'`, `'garantias'`, `'renovacion'`) o `''` si se
resuelve con orden. `esContrato()` y `puedeOrden()` cuelgan de ahí, y la captura
muestra el resultado en un cartel, no en una casilla.

El plazo se captura como lo que es: **entrega puntual** (días) o **servicio
continuo** (fecha de inicio y fin, y los días salen de `diasEntre()`, que cuenta
los dos extremos — del 1 de enero al 31 de diciembre son 365). En continuo, el
número calculado se guarda igualmente en `d.plazo` para que plantillas y
comprobaciones lean siempre del mismo sitio; `diasEjecucion()` es la autoridad.

No confundir con la **garantía técnica** del bien, que vive en el Momento 3
(`garantiaAplica`, `garantiaMeses`): esa no obliga a contrato, una orden de
compra puede llevarla.

Antes esto estaba al revés: tres casillas de «modalidad de pago / garantías»
decidían el instrumento, y `ordenDoc()` miraba solo las garantías, así que un
contrato de enero a diciembre **dejaba generar la orden de compra** con un aviso
amarillo. Y la lista de verificación exigía marcar una de las tres, de modo que
la AC tenía que declarar algo falso para poder enviar.

## La Mágica — `generador/index.html`

Un solo archivo de ~2,4 MB: la aplicación y, embebidas en base64, las 18 plantillas
Word. Todo es JavaScript de navegador sin módulos ni transpilación; sigue el estilo
que ya está (`var`, funciones sueltas, HTML como cadenas).

- **Las plantillas están dos veces**: los `.docx` sueltos en `generador/plantillas/`
  y el seed embebido de `index.html`. Al cambiar una, corre
  `python3 scripts/embeber_plantillas.py` para reconstruir el seed, y súbelo en el
  mismo commit. `--check` avisa si quedaron desfasados.
- **A `localStorage` solo va lo que la AC escribió**: expedientes, historial, cola
  de envío y las plantillas que subió a mano. El seed nunca se copia allí — llenaba
  2 MB de una cuota de 5.
- **Toda escritura a `localStorage` pasa por `lsSet()`**, que avisa cuando falla.
  Un `catch(e){}` mudo hace que la AC pierda el expediente sin enterarse.
- Las plantillas nuevas van a `TPL_SLOTS` (en la app) y a `ORDEN` (en
  `scripts/embeber_plantillas.py`).

### Probarla

```bash
npm install jsdom pizzip@3.2.0 docxtemplater@3.66.4
node scripts/probar_generador.js
```

Carga el HTML en un DOM de mentira y lo maneja desde fuera. Cubre las cuatro vías,
el almacenamiento, la lista de verificación y la generación real de `.docx`. Si
tocas la app, corre esto; si añades comportamiento, añade la comprobación.

## Datos de contratos

**Nunca publiques datos de contratos en claro.** El sitio es público y estático:
`crm/contratos_export.json` va cifrado con AES-256-GCM y lo sobrescribe el robot
diario (`scripts/actualizar_datos.py`); no se edita a mano. El detalle contrato por
contrato tampoco va en los documentos del repositorio — vive en el anexo que genera
`scripts/plan_renovaciones.py` fuera de aquí.

## Los flujos de Power Automate

Dos URLs con firma dentro de `generador/index.html`: `FLOW_DOCS_URL` (envío de
documentos a la Unidad Operativa) y `FLOW_URL` (registro central en un Microsoft
List). Los dos disparadores aceptan texto libre en `tipoProceso`. El registro
central recibe `D().tipoProceso` **en crudo**, sin pasar por `uoTipoForms()`: por
eso las renovaciones se pueden contar aparte, y por eso no conviene mapearlas a
«contratación directa» para salir del paso.

## Idioma

Todo en español: interfaz, comentarios, mensajes de commit y documentación. Es una
herramienta que usan 20 administradoras contadoras en Ecuador.
