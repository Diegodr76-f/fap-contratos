# Sistema de diseño de las herramientas del FAP

Las ocho herramientas —CLM, La Mágica, CRM, Calificador, Bienes, Renovaciones,
Planificador e Instrumentos— son HTML sueltos, sin hoja de estilos compartida.
Se parecen porque cada una se copió de la anterior, no porque algo las obligue.
Este documento es ese «algo»: qué colores, qué tamaños y qué reglas valen para
todas, por qué, y cómo se comprueba.

La vara es la del CLM: **rápido, fácil e intuitivo** para una administradora
contadora en territorio, con señal floja y muchas veces desde el teléfono.

## Cómo se comprueba

```bash
python3 scripts/probar_diseno.py          # corre en el CI: 75 comprobaciones, sin navegador
node scripts/medir_diseno.js              # a mano, en Chromium a 390 px: 19 pantallas
node scripts/medir_diseno.js --detalle    # además, qué elemento es cada cosa
node scripts/medir_diseno.js --capturas <carpeta>
```

`probar_diseno.py` lee los archivos: contraste de los tokens, que la paleta sea
una sola, la regla de 16 px, que nada frene la carga y que haya foco de teclado.
`medir_diseno.js` abre cada pantalla en un navegador de verdad con contratos de
mentira y mide lo que no se ve leyendo el CSS: qué se sale de la pantalla, qué
campo haría zoom, qué texto no contrasta, qué botón es pequeño. jsdom no sirve
para eso —no tiene anchos ni colores calculados—, así que **después de tocar la
cara de una herramienta se corre `medir_diseno.js`**, no se calcula.

## La auditoría de noviembre de 2026

Se recorrieron las ocho herramientas en Chromium, a 1366 px y a 390 px, como
Unidad Operativa y como AC, con un portafolio de mentira de 139 contratos.

| Qué se midió (19 pantallas, a 390 px) | Antes | Después |
|---|---|---|
| Pantallas donde algo se salía por la derecha | 3 (CRM lista y ficha: 52 px; Calificador: 15 px) | 0 |
| Campos que hacían zoom en el iPhone | 157 de 157 | 0 |
| Textos por debajo de 4,5:1 de contraste | 326 | 0 |
| Botones de menos de 36 px de alto o ancho | 167 | 35 |
| Herramientas donde la letra de Google frenaba la primera pantalla | 7 de 8 | 0 |
| Herramientas que pedían su motor de Word a un CDN | 2 (La Mágica y el CRM) | 0 |
| Herramientas sin recuadro de foco para el teclado | 5 de 8 | 0 |

**Puntaje: de 41 a 82 sobre 100** (criterio propio, 20 puntos por eje: tokens,
contraste, celular, componentes, y documentación con guardia). Lo que falta para
100 está al final, en «Lo que queda».

Lo que se encontró, de lo más grave a lo menos:

1. **El estado de un contrato no se leía.** «Por vencer · 63d» estaba a 2,7:1,
   «Vigente» a 3,1:1 y los rótulos de los campos («PROVEEDOR», «MONTO») a 2,6:1.
   Es lo primero que una AC busca, y a pleno sol en un teléfono no se veía.
2. **Cada campo hacía zoom en el iPhone.** Safari acerca la página al tocar un
   campo con letra de menos de 16 px y la deja acercada: había que alejarla con
   dos dedos después de cada dato. La captura de La Mágica tiene 22 campos.
3. **El CRM no tenía diseño de celular.** La cabecera se salía 49 px, «Salir»
   quedaba fuera de vista y el nombre de la herramienta cortado por arriba.
   El Calificador igual: 60 px fijos de barra para siete botones.
4. **La Mágica y el CRM dependían de dos CDN** para generar un Word, con las
   copias exactas ya en `clm/vendor/`. Con el CDN bloqueado —pasa en redes
   institucionales— La Mágica decía «descarga este HTML», y el HTML descargado
   los pedía al mismo sitio. Y como eran `<script>` normales en la cabecera, con
   señal floja la página se quedaba en blanco esperándolos.
5. **La letra frenaba la primera pantalla** en siete herramientas. Solo el CLM
   la cargaba sin bloquear.
6. **En La Mágica, en el teléfono, no se sabía en qué pantalla se estaba**: el
   menú es una fila deslizable y la pestaña activa quedaba fuera de vista. Y la
   caja «Expediente activo» ocupaba 165 px arriba de cada pantalla.
7. **En el CRM la categoría se montaba sobre «Vigencia»** en la tarjeta, en
   cuanto esa línea ocupaba dos renglones.
8. **La Mágica y el CRM no decían cómo se llaman.** La cabecera era «Fondo de
   Áreas Protegidas»; en el teléfono, donde el subtítulo se esconde, solo eso.
   El CLM las llama «La Mágica» y «CRM» en su menú y en sus botones.

## Color

Una sola paleta, con dos juegos de nombres: el del CLM (que comparten CRM,
Calificador y Bienes) y el español de Planificador y Renovaciones. La Mágica
escribe los mismos valores en línea, sin tokens. Instrumentos tiene los suyos,
más sobrios, y también pasan.

| Para qué | CLM y familia | En español | Valor | Sobre blanco |
|---|---|---|---|---|
| Marca, enlaces, botón principal | `--navy` | `--azul` | `#00249C` | 12,1:1 |
| Títulos y texto | `--ink` | `--ink` | `#0B153F` | 17,6:1 |
| Fondo de la página | `--bg` | `--papel` | `#F4F6FB` | — |
| Fondo suave (activo, píldora neutra) | `--tint` | `--azul-claro` | `#EEF1FB` | — |
| Texto secundario | `--muted` | `--tenue` | `#5A6072` | 6,3:1 |
| Texto terciario: rótulos, ayudas | `--muted2` | `--debil` | `#666C7B` | 5,3:1 |
| Texto de ejemplo de un campo vacío | `--ph` | — | `#9AA0B2` | 2,6:1 (a propósito) |
| Bien, vigente, listo | `--green` | `--ok`, `--ren` | `#1E7A4D` | 5,3:1 |
| Aviso, por vencer, pendiente | `--amber` | `--alerta`, `--nue` | `#96590B` | 5,6:1 |
| Mal, vencido, bloquea | `--red` | `--critico`, `--rojo` | `#B23B3B` | 5,9:1 |
| Ámbar **de marca** (punto, borde, mapa) | `--amber-s` | — | `#C98A08` | no es para texto |
| Proveedores, calificación | `--teal` | — | `#0A7780` | 5,3:1 |
| Solicitudes | `--violet` | — | `#6A44C9` | 6,4:1 |

Las reglas:

- **Todo color que se usa como texto pasa 4,5:1** sobre blanco, sobre el fondo
  de la página y sobre su propio fondo claro (`--greenbg`, `--amberbg`,
  `--redbg`). Lo comprueba `probar_diseno.py`.
- **`--amber-s` nunca es texto.** Es el ámbar vivo de antes, que no contrasta
  (2,9:1) pero se distingue del rojo de un vistazo: sirve para el punto de la
  lista, el borde de la tarjeta y el mapa. El texto «Por vencer» va en `--amber`.
- **`--ph` es solo para `::placeholder`.** Un campo vacío tiene que verse vacío.
  Un rótulo, una ayuda o un «sin registrar» no son un placeholder: van en
  `--muted2`.
- **El color nunca va solo.** El punto verde lleva «201 días restantes» al lado;
  la tarjeta de borde rojo, la píldora «Vencido». Así tiene que seguir.
- Un botón apagado cuyo rótulo es la instrucción («Completa lo que falta»,
  «Cambia la vía en el Momento 1») se escribe en `--muted2`, no en gris claro:
  es justo lo que la AC tiene que leer.

Un color nuevo se añade al `:root` de la herramienta con su contraste medido, y
si es de estado, a `DIALECTOS` en `probar_diseno.py`.

## Letra

Titillium Web (300, 400, 600, 700), con la letra del sistema de respaldo
mientras llega: `'Titillium Web',system-ui,-apple-system,'Segoe UI',sans-serif`.
El Planificador añade Source Serif 4 para el párrafo de entrada, y nada más.

Los tamaños que de verdad hacen falta son siete; conviene elegir de aquí antes
de inventar un 12,8 o un 13,5:

| Uso | Tamaño | Peso |
|---|---|---|
| Rótulo en mayúsculas, píldora | 11 px | 700 |
| Ayuda, dato secundario | 12 px | 400–600 |
| Texto de tabla y de tarjeta | 13 px | 400–600 |
| Texto base, campos en escritorio | 14 px | 400 |
| **Campos en el teléfono** | **16 px** | 400 |
| Título de panel o de modal | 19 px | 700 |
| Cifra de un indicador, título de pantalla | 24–28 px | 700 |

## Forma y espacio

- **Radios**: 9–11 px en botones y campos, 14–15 px en tarjetas y paneles, 18 px
  en la tarjeta de ingreso, 99 px en píldoras. Instrumentos usa 6–8 px.
- **Sombras**: en el CLM y su familia las tarjetas no llevan sombra en reposo,
  solo borde `--line2`; aparece al pasar el cursor, y en modales y avisos flotantes.
- **Movimiento**: una sola animación de entrada (`up`, 0,25 s) y transiciones de
  0,15 s. Con `prefers-reduced-motion` se apagan todas.

## Componentes

| Componente | Dónde vive | Variantes | Estados | Qué vigilar |
|---|---|---|---|---|
| Botón (`.btn`) | todas | principal, `.line`, `.danger`, `.sm` | reposo, cursor, foco, apagado; «ocupado» con `mientras()` en el CLM | lleva `all:unset`: **vuelve a `content-box`** y pierde el foco. Un `min-height` necesita `box-sizing:border-box`, y declarado ANTES del `all:unset` se pierde |
| Campo (`.frow input`, `.inp`, `.in`) | todas | texto, lista, área de texto | reposo, foco (borde azul), falta (ámbar, La Mágica), error (`.bad`, Bienes), apagado | 16 px en el teléfono; el rótulo es un `<label>`, no un placeholder |
| Píldora de estado (`.badge .b-g/.b-a/.b-r/.b-d`) | CLM, CRM, Calificador, Bienes | verde, ámbar, rojo, neutra | — | texto en el color de estado, fondo en su `-bg` |
| Filtro (`.chip`) | CLM, CRM, Bienes | — | reposo, activo (`.on`, fondo `--ink`) | 40 px de alto en el teléfono |
| Tarjeta de contrato (`.cc`) | CLM, CRM | `.g .a .r .done` por el borde izquierdo | reposo, cursor | nada con `position:absolute` dentro: se monta sobre el texto cuando este ocupa dos renglones |
| Tabla (`table.list`) | CLM, CRM | — | fila con cursor | dentro de `.tablewrap` con `overflow-x:auto`; ver en CLAUDE.md la regla de las siete columnas |
| Modal (`.overlay > .modal`) | CLM, CRM, Bienes | — | — | en el CLM se abre con `openModal()`, que pregunta antes de botar lo escrito |
| Aviso flotante (`.toast`) | todas | — | — | ancho máximo `calc(100vw - 24px)` |
| Pasos (`.phase > .step`) | CLM, CRM, La Mágica | pasado, actual, pendiente | — | `flex-wrap` en el teléfono |
| Aviso de lo que falta | La Mágica | — | — | enlaces que llevan al campo; ver «Decir QUÉ falta» en CLAUDE.md |

## Reglas del teléfono

1. **Los campos, a 16 px**, dentro de la media query de la herramienta y con
   `!important` (un tamaño en línea le ganaría):
   ```css
   input:not([type=checkbox]):not([type=radio]):not([type=range]),select,textarea{font-size:16px!important}
   ```
2. **Nada se sale por la derecha.** Las tres causas que se encontraron: un hijo
   de `grid` o de `flex` sin `min-width:0`; una barra con alto fijo y `nowrap`;
   y un `minmax(330px,1fr)` más ancho que la pantalla.
3. **Lo que se toca mide 40 px de alto.** Quedan por debajo, a sabiendas, los
   enlaces dentro de un texto y la cabecera de Instrumentos.
4. **El menú es una fila que se desliza**, y la pestaña activa queda a la vista
   (`render()` de La Mágica la centra; el CLM ya lo hacía).
5. **Los estilos del teléfono van en la media query, no en `style=""`.** Si el
   elemento ya lleva el estilo en línea, hace falta `!important` propiedad por
   propiedad —un `all:unset` en línea borra todo lo demás—.

## Reglas de carga

- **La letra no frena**: `media="print" onload="this.media='all'"`, con su
  `<noscript>`. La página se pinta con la letra del sistema y cambia al llegar.
- **Ningún `<script>` de fuera en la cabecera.** Lo que haga falta se copia a
  `clm/vendor/` —una sola copia para todas— y se pide de ahí.
- **El motor de Word** (PizZip 3.2.0 y docxtemplater 3.66.4) sale de
  `clm/vendor/`; el CDN queda de respaldo con `onerror="fapMotor(…)"`, para la
  copia exportada de La Mágica, que se abre suelta desde el disco. Cuando llega
  tarde, `motorListo()` quita el aviso sin recargar y sin tocar un campo en el
  que se esté escribiendo.

## Nombres

Cada herramienta dice cómo se llama en su cabecera, igual que la llama el CLM:
«CLM · FAP», «La Mágica · FAP», «CRM de Contratos · FAP», «Calificador de
Ofertas», «Bienes del FAP». La institución va en el subtítulo.

## Lo que queda

No se hizo, y por qué:

1. **La Mágica no tiene tokens.** Son 569 colores escritos a mano, repartidos
   en 407 atributos `style`. Se corrigieron los tres que no contrastaban, pero pasarla a `:root`
   es un cambio grande en la herramienta más delicada; conviene hacerlo pantalla
   por pantalla, cuando se toque cada una.
2. **Demasiados tamaños de letra**: entre 13 y 27 distintos por herramienta, con
   medios píxeles. Y en el teléfono hay mucho texto de menos de 12 px —108
   trozos en el repositorio del CLM—. Subirlo cambia cuánto cabe en tablas que
   están medidas para entrar en 1280 px: hay que decidirlo viendo a una AC usarlo.
3. **`alert()`, `confirm()` y `prompt()` del navegador**: 41 y 29 en
   Instrumentos, 9 en el CRM, 12 en el CLM, 8 en La Mágica. No llevan el estilo
   de la herramienta y en el teléfono tapan la pantalla. El CLM ya tiene
   `openModal()` y el aviso flotante para reemplazarlos de a poco.
4. **Lo que se pulsa y no es un botón.** Las tarjetas de indicadores, las filas
   de las tablas y las tarjetas de contrato son `div` o `tr` con `onclick`: con
   el teclado no se llega a ellas. Se arregla con `tabindex="0"`, `role="button"`
   y Enter, o con un botón de verdad dentro.
5. **Iconos**: el CLM mezcla iconos dibujados con emoji («📄 Abrir», «📍»,
   «📁»), e Instrumentos usa solo emoji. Un emoji se ve distinto en cada
   teléfono.
6. **La cabecera de Instrumentos en el teléfono** ocupa 190 px. Es de la Unidad
   Legal y se usa en escritorio; un menú «Más» la dejaría en una línea.
7. **Bienes por dentro no se revisó a ojo**: se entra con la cuenta de Microsoft
   de FIAS y aquí solo se pudo ver la pantalla de ingreso. Sí recibió los
   tokens, la regla de 16 px, el foco y la carga.
8. **Falta la prueba en un iPhone de verdad.** El zoom es un comportamiento de
   Safari; aquí se midió el tamaño calculado en Chromium, que es la causa, no el
   efecto.
