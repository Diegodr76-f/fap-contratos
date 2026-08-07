# Mapa de áreas protegidas — de dónde salen las coordenadas

El módulo **Mapa de áreas** del CLM ubica cada contrato del FAP sobre el área
protegida a la que pertenece. Este documento explica de dónde sale cada dato,
para que cualquiera pueda revisarlo o corregirlo sin adivinar.

La tabla vive en la constante `AREAS_GEO` dentro de `clm/index.html`. **No se
edita el JSON de contratos para esto**: el mapa cruza el campo `area` que ya
trae la hoja *Export* del Excel maestro contra esta tabla.

## Por qué es una tabla fija y no un servicio

Las áreas protegidas del SNAP son un catálogo cerrado —hoy 44 aparecen en la
base de contratos— y no se mueven de sitio. Escribir la tabla una vez evita
depender de un servicio externo de mapas, que además no funcionaría en las
redes institucionales que bloquean CDNs, ni sin internet. Por la misma razón la
silueta del país es un trazado SVG incrustado y no un mapa de teselas: el CLM
sigue siendo un archivo HTML que se abre solo.

## Qué es cada punto

Cada área protegida se representa con **un punto de referencia**, no con su
polígono real. Un parque como el Sangay ocupa medio millón de hectáreas: el
punto dice *dónde está*, no *hasta dónde llega*. Para leer montos por área eso
es suficiente y es lo que el mapa promete en su nota al pie.

El tamaño del círculo es el monto vigente (o el número de contratos, según el
selector) y el **área** del círculo —no su diámetro— crece con el valor, que es
como el ojo compara círculos. El color es el estado más urgente del área:
rojo si tiene algún contrato vencido, ámbar si tiene alguno por vencer (≤ 90
días), azul si está al día y gris si todo está terminado o cerrado.

## Verificación

Las 44 coordenadas se contrastaron contra el polígono de Ecuador de Natural
Earth (escala 1:10 m): 36 caen dentro del territorio y las 8 restantes son
reservas marinas, islas y desembocaduras que por definición quedan sobre el
agua o en el borde (El Pelado a 5 km de la costa, Isla Santa Clara a 22 km en
el golfo de Guayaquil, Galera San Francisco, Isla Santay, el estuario del río
Esmeraldas). Ninguna quedó en el país equivocado.

## Tabla de coordenadas y fuentes

`Pub.` = coordenada publicada, copiada tal cual. `Desc.` = derivada de la
ubicación oficial (cantón, parroquia o hito descrito en la fuente). `Hito` =
centrada en el accidente geográfico homónimo del área.

| Área protegida | Lat | Lon | Origen | Referencia |
|---|---:|---:|---|---|
| PN Cayambe Coca | -0.3500 | -77.9500 | Hito | Macizo Cayambe–Coca (Napo/Imbabura/Pichincha/Sucumbíos) |
| PN Cotacachi Cayapas | 0.5833 | -78.6833 | Pub. | 0°35′00″N 78°41′00″O |
| PN Cotopaxi | -0.6800 | -78.4400 | Hito | Volcán Cotopaxi |
| PN Antisana | -0.5000 | -78.1400 | Hito | Volcán Antisana |
| PN Llanganates | -1.1500 | -78.2000 | Hito | Cordillera de los Llanganates |
| PN Machalilla | -1.5500 | -80.7500 | Hito | Franja costera de Manabí sur |
| PN Podocarpus | -4.1200 | -79.1000 | Hito | Nudo de Sabanilla (Loja/Zamora Chinchipe) |
| PN Río Negro Sopladora *(Tinajillas Río Gualaceño)* | -2.7339 | -78.5441 | Pub. | 2°44′01.87″S 78°32′38.58″O |
| PN Sangay | -2.0000 | -78.3333 | Hito | Volcán Sangay |
| PN Sumaco Napo Galeras | -0.3833 | -77.5500 | Pub. | 0°23′00″S 77°33′00″O |
| PN Yacuri | -4.7060 | -79.3650 | Pub. | 4°42′22″S 79°21′54″O |
| PN Yasuní | -0.9500 | -75.9000 | Hito | Interfluvio Napo–Curaray (Orellana/Pastaza) |
| RE Arenillas | -3.5380 | -80.1370 | Pub. | Punto medio de 03°25.93′S 80°06.50′O (Cayancas) y 03°38.59′S 80°09.94′O (El Cubo) |
| RE Cofán Bermejo | 0.3170 | -77.3121 | Pub. | Centro del recuadro 0.21286/-77.50332 – 0.42112/-77.12090 |
| RE El Ángel | 0.7167 | -77.9500 | Hito | Páramo de El Ángel (Carchi) |
| RE Los Ilinizas | -0.7000 | -78.8000 | Hito | Entre los Ilinizas y el Quilotoa |
| RE Mache Chindul | 0.4772 | -79.7856 | Pub. | 0°28′38″N 79°47′08″O |
| RE Manglares Cayapas Mataje | 1.2200 | -78.9300 | Desc. | Cuencas bajas del Cayapas y el Mataje (San Lorenzo / Eloy Alfaro) |
| RE Manglares Churute | -2.4200 | -79.6500 | Hito | Cerros de Churute (Guayas) |
| RB Cerro Plateado | -4.6000 | -78.7667 | Pub. | 4°36′S 78°46′O |
| RB Colonso Chalupas | -0.9500 | -77.9500 | Desc. | Archidona/Tena, entre el Antisana y los Llanganates |
| RB El Cóndor | -3.4476 | -78.1979 | Pub. | 3°26′51.45″S 78°11′52.57″O |
| RB El Quimi | -3.5000 | -78.3800 | Desc. | Valle de El Quimi, cordillera del Cóndor sur, Gualaquiza (Morona Santiago) |
| RB Limoncocha | -0.4167 | -76.5833 | Pub. | 00°25′S 076°35′O |
| RG Pululahua | 0.0333 | -78.5000 | Hito | Caldera del Pululahua |
| RM El Pelado | -1.9362 | -80.7889 | Pub. | Bajo «El Acuario», 1°56′10.20″S 80°47′20.12″O |
| RM Galera San Francisco | 0.7500 | -80.1200 | Desc. | Frente a las parroquias Galera, Quingue y San Francisco (Muisne) |
| RM Isla Santa Clara | -3.1700 | -80.4400 | Desc. | 43 km al oeste de Puerto Bolívar, golfo de Guayaquil |
| RPF Chimborazo | -1.4700 | -78.8200 | Hito | Volcán Chimborazo |
| RPF Cuyabeno | 0.0000 | -76.1800 | Hito | Cuenca del río Cuyabeno (Sucumbíos) |
| RPF Marino Costera Puntilla Santa Elena | -2.2000 | -80.9800 | Desc. | De La Chocolatera a Punta Ancón, cantón Salinas |
| RVS El Pambilar | 0.5000 | -79.3000 | Desc. | Cantón Quinindé, Esmeraldas (según el SNAP) |
| RVS El Zarza | -3.8000 | -78.5000 | Desc. | Parroquia Los Encuentros, cantón Yantzaza (Zamora Chinchipe) |
| RVS Estuario Río Esmeraldas | 0.9800 | -79.6500 | Desc. | Desembocadura del río Esmeraldas, parroquia Tachina |
| RVS Isla Corazón y Fragatas | -0.6600 | -80.3800 | Desc. | Desembocadura del río Chone, frente a Bahía de Caráquez |
| RVS La Chiquita | 1.2200 | -78.7800 | Desc. | 11 km al sureste de San Lorenzo, vía a Ricaurte |
| RVS Machángara Tomebamba | -2.7500 | -79.0500 | Desc. | Páramos al norte de Cuenca (Azuay/Cañar) |
| RVS Manglares El Morro | -2.6800 | -80.3100 | Desc. | Canal de El Morro, entre Puerto El Morro y Posorja |
| RVS Manglares Estuario Río Muisne | 0.6000 | -80.0200 | Desc. | Desembocadura del río Muisne |
| RVS Pasochoa | -0.4667 | -78.4833 | Hito | Volcán Pasochoa |
| ANR El Boliche | -0.6000 | -78.5000 | Hito | Junto al PN Cotopaxi, sector El Boliche |
| ANR Isla Santay | -2.2170 | -79.8500 | Pub. | 2°13′S 79°51′O |
| ANR Playas de Villamil | -2.6600 | -80.3500 | Desc. | De General Villamil a Data de Posorja |
| **DAPOFC** *(no es un área protegida)* | -0.1807 | -78.4678 | — | Dirección de Áreas Protegidas y Otras Formas de Conservación: se ubica en **Quito** por ser una unidad administrativa. En el mapa aparece con un marcador cuadrado violeta y se cuenta aparte de las áreas. |

## Nombres repetidos que el mapa unifica

El Excel maestro trae la misma área escrita de varias formas. Al cargar la
base, `canonAreas()` la reescribe a un solo nombre —y eso beneficia también al
repositorio, al buscador global y a los reportes, no solo al mapa—. El texto
original queda guardado en `areaOriginal` por si hace falta rastrearlo.

| Como aparece en el Excel | Se unifica en |
|---|---|
| `Reserva Biológica El Condor` | Reserva Biológica El Cóndor |
| `Parque Nacional  Sumaco Napo Galeras` (espacio doble) | Parque Nacional Sumaco Napo Galeras |
| `Parque Nacional Podocarpus-sector Bombuscaro` | Parque Nacional Podocarpus |
| `Reserva de Producción de Fauna Marina Costera Puntilla Santa Elena` | …Marino Costera Puntilla Santa Elena |
| `Reserva Biológica Colonso Chalupas ` (espacio final) | Reserva Biológica Colonso Chalupas |
| `Reserva Ecológica Cayambe Coca` · `Cotacachi Cayapas` · `Antisana` | Parque Nacional … *(recategorizadas)* |

La comparación ignora tildes, mayúsculas, signos y espacios repetidos, así que
las variantes nuevas de ese estilo se absorben solas.

## Cómo agregar o corregir un área

1. Abre `clm/index.html` y busca `const AREAS_GEO`.
2. Agrega la fila con el nombre **tal como llega del Excel** y su `lat`/`lon` en
   grados decimales (sur y oeste van en negativo).
3. Si el Excel usa un nombre distinto al oficial, agrégalo en `AREA_ALIAS`
   apuntando al nombre bueno, en minúsculas y sin tildes.
4. Añade la fila a la tabla de arriba con su fuente.

Un área que no esté en la tabla **no desaparece**: sus contratos se siguen
sumando y el mapa la lista abajo como «sin ubicación en el catálogo», para que
el faltante se vea en vez de perderse.

## Silueta del mapa

El contorno de Ecuador y de los países vecinos viene de **Natural Earth**
(dominio público, escala 1:10 m), simplificado con Douglas–Peucker y proyectado
al encuadre `MAP_VIEW` (lon −81.30…−75.05, lat −5.20…1.60). Al estar sobre la
línea ecuatorial, una proyección equirrectangular no distorsiona de forma
apreciable, así que la conversión de grados a píxeles es lineal. Son ~6 KB de
trazado incrustados en el HTML; no se descarga nada al abrir el mapa.
