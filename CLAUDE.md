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
mira lo que La Mágica les entrega. Además, `scripts/plantillas_renovacion.py` se
niega a escribir un `.docx` con una etiqueta sin catalogar.

## La Mágica — `generador/index.html`

Un solo archivo de ~2,4 MB: la aplicación y, embebidas en base64, las 19 plantillas
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
