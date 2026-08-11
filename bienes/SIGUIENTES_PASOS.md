# Siguientes pasos

Esta es la lista de lo que falta, en orden, escrita para retomarla en
cualquier momento aunque haya pasado tiempo. Cada paso dice **qué hacer** y
**en qué documento están los detalles**.

Ya está hecho: el login con Microsoft, la herramienta de bienes, el CLM con
Bienes integrado adentro, el código QR, y la limpieza del Excel histórico
(`MATRIZ_BIENES_TODO_TEXTO.xlsx`). Lo que falta es todo lo relacionado con
**SharePoint** (donde vive la información) y los **flujos de Power Automate**
(que conectan SharePoint con la herramienta).

---

## 1. Terminar de pasar los 502 activos fijos

Si ya guardaste y corriste el flujo: abre la lista `Activos FAP` en
SharePoint y cuenta las filas (arriba a la izquierda suele decir cuántas
hay).

- **Si dice 502** → listo, pasa al paso 2.
- **Si dice menos** → algo falló en algunas filas. En Power Automate, abre el
  flujo → pestaña **«Ejecuciones»** (*Run history*) → clic en la ejecución →
  busca las repeticiones del «Aplicar a cada uno» marcadas en rojo. Cada una
  dice qué fila y por qué falló (normalmente es una columna que quedó con el
  tipo equivocado — revisa la tabla de las 9 columnas en
  [`MIGRAR.md`](MIGRAR.md), sección «Antes: dejar en texto…»).
- **Si no has corrido el flujo todavía** → sigue
  [`MIGRAR.md`](MIGRAR.md) desde el principio.

## 2. Repetir lo mismo para los 754 bienes de control

Es el mismo flujo, cambiando la tabla de origen (`TBienescontrol` en vez de
`TActivos`) y el destino (una lista nueva, que hay que crear primero igual
que se creó `Activos FAP`). Todos los detalles están en
[`MIGRAR.md`](MIGRAR.md), sección **6. Repetir para bienes de control**.

Al final debe decir **754**.

## 3. Revisar dónde vive la lista de SharePoint

Ahora mismo la lista está guardada en tu OneDrive personal
(`fiasec-my.sharepoint.com/personal/administrativofap_fias_org_ec`), no en un
sitio de equipo. Esto puede traer problemas después, porque:

- Si algún día cambias de computador, de cuenta, o sales de FIAS, esa lista
  podría quedar inaccesible para los demás.
- Los flujos de Power Automate que use Cata, la Unidad Operativa o Fernanda
  necesitan poder leer esa lista — y una carpeta personal depende de que tu
  cuenta siga activa y con los permisos bien puestos.

**Recomendación:** mover (o crear de una vez, si aún no lo hiciste) las
listas dentro de un **sitio de equipo** de SharePoint (por ejemplo uno
llamado "FAP" o "Bienes"), no en tu OneDrive personal. Si ya migraste los
datos a tu OneDrive, se pueden copiar las listas a un sitio de equipo después
sin perder nada — solo hay que actualizar la dirección del sitio en los
pasos 4 y 5 de este documento y en los flujos ya creados.

Si no tienes claro cómo crear un sitio de equipo, es un paso para retomar
con ayuda cuando haya tiempo — no bloquea los pasos 1 y 2 de arriba.

## 4. Crear la lista «Accesos»

Es una lista simple de SharePoint con quién puede ver qué. Dos columnas:

| Columna | Tipo | Ejemplo |
|---|---|---|
| Correo | Una línea de texto | `jperez@fias.org.ec` |
| Área | Una línea de texto | `FIAS` o `TODAS` |

- Cada AC (administradora/administrador de contrato) tiene una fila con su
  correo y el nombre de su área (el mismo texto que usa la columna `sigla`
  en la matriz de bienes).
- Quienes deben ver **todo** (Unidad Operativa, Cata, tú, Fernanda) llevan
  `TODAS` en la columna Área.

**Falta:** los correos de Cata y de Fernanda. Sin esos dos correos no se
puede terminar de llenar esta lista. Pídelos y agrégalos como filas con
`TODAS`.

Esta misma lista sirve después tanto para bienes como para contratos (CLM) —
no hay que duplicarla.

## 5. Crear el flujo protegido «obtener mis bienes»

Este es el flujo que la herramienta llama cada vez que alguien inicia
sesión: recibe quién entró, busca su correo en la lista «Accesos», y
devuelve solo los bienes de su área (o todos, si su área dice `TODAS`).

Instrucciones completas, paso a paso, en [`CONECTAR.md`](CONECTAR.md),
**parte 4** (incluye cómo proteger el flujo con la cuenta de Microsoft y
cómo leer el correo de quien inició sesión).

Cuando termines, el flujo te da una dirección web (URL). Esa dirección se
pega en `bienes/index.html`, buscando la línea:

```js
const API_MIS_BIENES_URL = '';
```

y poniéndola entre las comillas.

## 6. Crear la lista «Contratos» y el flujo «obtener mis contratos»

Mismo patrón que bienes, pero para el CLM. Instrucciones en
[`CONECTAR.md`](CONECTAR.md), **partes 5 y 6**. Reutiliza la misma
aplicación de Microsoft (Entra ID) que ya creaste, solo agregando el permiso
`Contratos.Leer`.

La URL que te da ese flujo se pega en `clm/index.html` y `crm/index.html`,
en la línea:

```js
const API_MIS_CONTRATOS_URL = '';
```

## 7. Limpieza final en SharePoint (cuando haya tiempo, no urgente)

- Columna **`DESCRIPCIÓN(ADICIONAL)`**: cambiarla a *varias líneas de texto*
  (hay 37 bienes con descripciones largas que una columna de una línea
  corta).
- Columna **`Código QR`**: se puede borrar, no se usa — la herramienta genera
  el QR sola en el navegador.
- **5 fechas** quedaron vacías porque eran ilegibles en el archivo original
  (`31/12/202`, `31/07/206`, `5/11/206`, `27/08/219`, `04/0-2020`). Toca
  corregirlas a mano revisando el documento físico o la factura de cada
  bien, si se puede encontrar.

## 8. Ver la herramienta funcionando

Una vez estén listos los pasos 5 y 6 (las dos URLs pegadas), la herramienta
queda funcionando de verdad: entras con tu cuenta de Microsoft y ves tus
bienes y tus contratos según tu área. Ese es el momento de probarla en
serio, con tu usuario y si es posible con el de alguna AC, antes de avisarle
a Cata y al resto del equipo que ya pueden usarla.

---

### Orden recomendado

Si quieres ir de a poco: **1 → 2 → 4 (pide los correos ya) → 3 → 5 → 6 → 8 →
7**. Los pasos 1 y 2 son los más urgentes porque son los datos históricos;
el 3 puede resolverse en paralelo mientras esperas los correos del paso 4.
