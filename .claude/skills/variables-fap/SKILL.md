---
name: variables-fap
description: >-
  Catálogo único de nombres y formatos de variable para las plantillas y documentos del Fondo de
  Áreas Protegidas (FAP / FIAS, Ecuador). Úsala SIEMPRE antes de crear, editar o rellenar una
  plantilla, o de generar un documento: contratos, órdenes de compra o de servicio, actas de
  adjudicación, de entrega-recepción o de terminación, informes de satisfacción o de justificación,
  invitaciones, solicitudes de cotización, memorandos, adendas, convenios, bases de concurso.
  Dispara con «genera un documento», «rellena la plantilla», «crea una plantilla Word», «qué
  variable uso para…», «añade un campo al documento», docxtemplater, {etiqueta}, {{etiqueta}},
  .docx, plantilla, mail merge, document generation, fill a template, generate a document from a
  template. Da el nombre exacto y el formato exacto de cada dato —montos en letras, fechas,
  separador de miles— y prohíbe inventar sinónimos.
---

# El idioma de las plantillas del FAP

**Si el documento no es del FAP/FIAS, dilo en una línea y sigue sin aplicar nada de esto.** Esta
skill dispara ancho a propósito, para no perderse ningún documento del FAP; lo que la mantiene en
su sitio es esta primera comprobación.

## La regla

**No inventes sinónimos.** Si necesitas un dato, búscalo primero: lo más probable es que ya tenga
nombre. Si de verdad es nuevo, se da de alta en el catálogo **antes** de escribirlo en la plantilla.

Ya pasó una vez. La vía de renovación nació con `contratoAnterior`, `fechaSuscripcionAnt`,
`fechaFinAnterior`, `montoAnterior` y `fechaNotificacion`. En el catálogo eran `contratoNro`,
`fechaContrato`, `fechaFin`, `montoTotal` y `fechanotificacion`. No fue cosmético: los cuatro
primeros los publica el CRM, así que el sinónimo convirtió en tecleo lo que podía ser precarga, y
el quinto se separaba del suyo por una mayúscula.

## Buscar antes de escribir

```bash
python3 scripts/variables.py                          # los grupos
python3 scripts/variables.py "Montos e IVA"           # un grupo, con descripción y ejemplo
python3 scripts/variables.py --buscar monto           # ANTES de inventar un nombre
python3 scripts/variables.py --check                  # las plantillas contra el catálogo
```

El script encuentra el catálogo en tres saltos, y en este orden: la variable de entorno
`FAP_CATALOGO`; el repositorio, si estás dentro de él; y por último la copia que viaja aquí, en
`references/variables_fap.json`. **Dentro del repositorio manda siempre el del repositorio**, nunca
esta copia.

Si no hay Python a mano, `references/variables_fap.json` se lee tal cual: es una lista de objetos
con `nombre`, `grupo`, `tipo`, `descripcion` y `ejemplo`.

**Antes de escribir un `.docx`**, valida con la librería, que es para lo que está:

```python
import sys; sys.path.insert(0, 'scripts')
from variables import exigir
exigir(etiquetas, 'la plantilla de adenda')   # aborta nombrando lo que no está catalogado
```

## Los tres dialectos, un solo vocabulario

| dónde | sintaxis | quién |
|---|---|---|
| Plantillas Word (docxtemplater) | `{etiqueta}` | La Mágica, el CRM, el Calificador |
| Plantillas HTML | `{{etiqueta}}` | el CLM, el generador de instrumentos |
| Relleno a mano | `[CORCHETES]` | las bases de concurso, que llena una persona |

Cambia la sintaxis; **no cambian los nombres**. Una etiqueta que existe como `{montoTotal}` es
`{{montoTotal}}` en una plantilla HTML, nunca `{{monto_total}}`.

## Los tipos, y lo que cada uno imprime

`texto` · `numero` · `fecha` · `letras` · `repetible`.

El **`ejemplo`** de cada variable no es decorativo: **es la declaración del formato**. Un `numero`
cuyo ejemplo es `9.120,45` se imprime con punto de miles y coma decimal (es-EC). Una `fecha` se
escribe larga, `4 de septiembre de 2026`. Antes de dar formato a un valor, mira el ejemplo de su
variable.

**Los montos en letras son la trampa.** Lee `references/formatos.md` antes de tocar ninguno.

## Bloques repetibles y condiciones

Los campos de un bloque se declaran dentro de su `descripcion`, como `Campos: razon, fof, hof.`
Está ahí y no en una clave propia a propósito: el catálogo se importa tal cual al sistema, y un
campo que el sistema no conozca no sobreviviría al viaje de ida y vuelta.

```
{#items}{cantidad}{desc}{punit}{ptotal}{/items}     bucle
{#tecOfs} … {#rows} … {/rows} … {/tecOfs}           bucle anidado
{#docsGate} … {/docsGate}                           condición: aparece o no
```

Un campo de bloque **solo vale dentro de su bloque**. `{razon}` es la razón social de un oferente
dentro de `{#provs}`; suelto en mitad del documento no significa nada.

## Dar de alta un dato nuevo

Solo cuando `--buscar` no ha encontrado nada. Se añade a `generador/variables_fap.json`:

```json
{ "id": "pm…", "grupo": "Montos e IVA", "nombre": "montoGarantia",
  "descripcion": "Valor de la garantía de fiel cumplimiento",
  "ejemplo": "850,00", "tipo": "numero" }
```

Y **avisa de que hay que importarlo al sistema**: el archivo se importa tal cual. En sentido
contrario, para traer al repositorio lo que se haya creado en el sistema:

```bash
python3 scripts/variables.py --unir <export_del_sistema.json>
```

Nunca borra ni pisa una variable existente.

## Si el catálogo que tienes aquí está viejo

El JSON trae la fecha en que se exportó. Si es muy anterior a hoy y hay red, contrástalo con la
copia publicada antes de dar por bueno que un nombre no existe:

```
https://raw.githubusercontent.com/Diegodr76-f/fap-contratos/main/generador/variables_fap.json
```

Sin red, trabaja con la copia local y **dilo**, en vez de dar por nuevo un nombre que quizá ya esté.
