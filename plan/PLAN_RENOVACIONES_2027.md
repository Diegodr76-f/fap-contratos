# Plan de renovaciones y procesos nuevos — FAP 2027

Corte de datos: **1 de septiembre de 2026**. Fuentes: «Sistema de Alertas de Contratos FIAS»
(hoja 2026), «Matriz de procesos de adquisición, contratación y renovación FAP» y el
«Análisis de tiempos solicitud → contrato FAP 2026».

> El detalle contrato por contrato (números, proveedores, montos, administradoras y correos)
> **no está en este repositorio**: es público y la política del proyecto es no publicar datos de
> contratos en claro. Ese detalle vive en el anexo `Anexo_Renovaciones_2027_FAP.xlsx`, que se
> genera con `scripts/plan_renovaciones.py` a partir del Excel de alertas.

---

## 1. La pregunta que ordena el año

Para cada contrato de servicio recurrente hay una sola pregunta: **¿se puede renovar, o hay que
hacer un nuevo proceso administrativo?** El FIAS permite renovar **una sola vez**, así que la
respuesta ya está determinada por lo que se firmó en 2026.

| Para 2027 | Por qué | Contratos | Monto 2026 (USD) |
|---|---|---:|---:|
| **Se puede renovar** | El contrato de 2026 se firmó como nuevo: conserva su única renovación | **39** | 125 623 |
| **Nuevo proceso administrativo** | El contrato de 2026 ya era una renovación: el cupo está agotado | **89** | 372 007 |
| | **Total** | **128** | **497 630** |
| Fuera de esta campaña | Objeto no recurrente: 2 consultorías y 1 adquisición de equipos, de nivel central | 3 | 131 678 |

**La modalidad de los 89 procesos nuevos es contratación directa**, con el criterio de
**proveedor calificado y recurrencia del servicio**: el mismo proveedor ya está evaluado, el
servicio es continuo y en territorio son de los pocos que facturan y operan legalmente. Eso hay
que sostenerlo en el informe de justificación de cada expediente, no darlo por supuesto.

### Lo que sí y lo que no depende de nosotros

**Sí:** llegar al 31 de diciembre de 2026 con los 128 expedientes precontractuales hechos y
revisados.

**No:** la firma. **El PAG se aprueba en promedio hasta el 15 de enero**, y sin PAG no se puede
suscribir ni siquiera pedir una cotización en firme, porque es el PAG el que fija el presupuesto
de cada área. Con esa fecha, **la retroactividad no se elimina: se reduce**. Ningún contrato que
arranque el 1 de enero puede firmarse antes del 25 de enero, en ningún escenario.

Lo que el plan cambia es **cuánto dura esa irregularidad y cuántos contratos la arrastran hasta
mayo** — y eso depende enteramente de cuándo entre cada expediente.

### El antecedente

- El 52 % de los envíos de 2026 llegó en enero; la cola tocó 60 procesos simultáneos el 4 de
  febrero. Cada 10 procesos delante añaden ~3 días de espera: lo solicitado en enero tardó 36
  días, lo de junio, 12.
- Las 81 renovaciones de 2026 iniciaron plazo el 1 de enero y se firmaron entre febrero y julio:
  **64 días de mediana de servicio prestado sin contrato suscrito**, hasta 151 días, con
  USD 357 395 comprometidos en esa situación.

---

## 2. No todo tiene que estar firmado el 31 de diciembre

El sucesor arranca el día siguiente al vencimiento del contrato vigente, y los vencimientos no son
todos iguales:

| Grupo | Arranca el sucesor | Contratos | Se renuevan | Proceso nuevo | Monto |
|---|---|---:|---:|---:|---:|
| **1-ene** | 1 de enero de 2027 | **75** | 31 | 44 | USD 271 933 |
| **1-feb** | 1 de febrero de 2027 | **49** | 5 | 44 | USD 222 012 |
| posterior | entre febrero de 2027 y 2029 | 4 | 3 | 1 | USD 3 684 |

### Dos verificaciones legales pueden mover contratos a proceso nuevo

No se resuelven desde los datos y hay que hacerlas antes de lanzar la consulta a las
administradoras:

- **Cláusula previa de renovación.** La Matriz condiciona el contrato de renovación a que el
  contrato original la contemple. Hay que revisar los 39 renovables uno por uno: el que no la
  tenga pasa a proceso nuevo y cambia de semana en el calendario.
- **Calificación del ordenador de gasto para arrendamientos.** La Matriz enumera como renovables
  combustibles, mantenimiento de vehículos, muellaje, estacionamiento, radiofrecuencia,
  telecomunicaciones y servicios básicos «y similares calificados por el ordenador de gasto». Los
  arrendamientos renovables necesitan esa calificación expresa.

---

## 3. Fase 1 — Consultar a las administradoras (2 al 30 de septiembre)

**Un correo por cada una de las 20 administradoras contadoras** de áreas protegidas. Cada correo
trae, en dos listas separadas, **cuáles de sus contratos se pueden renovar y cuáles necesitan un
nuevo proceso administrativo**, con el vencimiento de cada uno, cuándo arranca su sucesor y la
semana en que le toca ingresar el expediente. Ya están redactados: `correos/<Administradora>.txt`.

**Se le pide una sola cosa:** confirmar contrato por contrato si el área necesita mantener el
servicio en 2027 — incluido decir cuáles *no*, que es la única forma de no tramitar lo que no se
va a usar.

**Y se le pide por formulario, no por correo.** Cada contrato lleva en el correo su propio botón
*Confirmar*, que abre un Microsoft Forms con el número de contrato, el área y el detalle ya
rellenados; la AC solo responde si continúa, si sigue el mismo proveedor y cuánto consumió este
año. Las respuestas caen solas en un Excel y el script las cruza con el plan, así que nadie
transcribe nada y en cualquier momento se sabe qué porcentaje del portafolio está confirmado y
quién falta. Todo con el Microsoft 365 básico: sin conectores premium, sin disparador HTTP y sin
pedirle nada a IT. El montaje está en
**[`plan/FORMULARIO_CONFIRMACION.md`](FORMULARIO_CONFIRMACION.md)**.

Lo del monto se le advierte, pero para más adelante: cuando toque cotizar, la base es el **consumo
ejecutado de 2026**, no el presupuesto del contrato vigente. De las 13 adendas firmadas este año,
11 fueron aumentos de valor por consumo subestimado; ese trabajo reingresa a la unidad 107 días
después en mediana.

**Los plazos de respuesta están escalonados** según la primera semana de cada administradora:

| Responde antes de | Administradoras |
|---|---:|
| 16 de septiembre | 9 |
| 23 de septiembre | 7 |
| 30 de septiembre | 1 |
| 21 de octubre | 2 |
| 11 de noviembre | 1 |

**Si no responde:** a los tres días hábiles del plazo, la Coordinación del FAP escala al
responsable del área protegida; si a la semana siguiente sigue sin respuesta, el expediente sale
del lote y se reprograma a la última semana disponible.

**Por dónde se responde:** el formulario de procesos administrativos, no el correo. En 2026, 18 de
los 132 contratos (14 %) entraron sin formulario y hubo que reconstruirlos desde el Planner.

---

## 4. Fase 2 — Los documentos, partidos por el PAG

El corte es simple: **todo lo que no necesita saber el monto se hace ya; lo que lo necesita
espera**.

### Bloque 1 — sin PAG (septiembre a diciembre)

| | Qué produce la administradora ahora | ¿La Mágica lo genera? |
|---|---|---|
| **Renovación** | Informe de satisfacción con análisis técnico, geográfico y económico, firmado por la AC y el responsable del AP. Verificación de la cláusula de renovación. | **No** — el informe existente es de satisfacción de ejecución, no el análisis de renovación |
| **Proceso nuevo** | Solicitud de inicio del responsable del área e informe de justificación que motive la contratación directa: proveedor calificado, recurrencia del servicio y condiciones del territorio. | Sí, completo |

En paralelo, del lado de la Unidad Legal: revisión de las 39 cláusulas de renovación y **modelos
de contrato pre-aprobados por categoría**.

### Bloque 2 — requiere el PAG aprobado

| | Qué falta cuando salga el PAG |
|---|---|
| **Renovación** | Solicitud de cotización para el nuevo período con el presupuesto asignado → cotización → notificación → contrato de renovación, que elabora la Unidad Operativa |
| **Proceso nuevo** | Solicitud de cotización en firme → cotización → orden o notificación → contrato |

La Matriz exige el PAG expresamente en la vía de renovación; en el proceso nuevo condiciona el
monto, que a efectos prácticos es lo mismo.

---

## 5. Fase 3 — El calendario: 13 semanas, cupo de 10 expedientes

Primero lo que arranca antes; dentro de eso, los procesos nuevos antes que las renovaciones,
porque llevan un documento más; y dentro de cada nivel, **agrupado por categoría**, para que la
revisión vaya en lotes del mismo objeto.

| Semana | Expedientes | Se renuevan | Proceso nuevo | Arrancan el | Categorías del lote |
|---|---:|---:|---:|---|---|
| 21 sep | 10 | — | 10 | 1 ene | Arrendamiento (6), Mantenimiento (4) |
| 28 sep | 10 | — | 10 | 1 ene | Mantenimiento (10) |
| 5 oct | 10 | — | 10 | 1 ene | Mantenimiento (10) |
| 12 oct | 10 | — | 10 | 1 ene | Mantenimiento (10) |
| 19 oct | 10 | 6 | 4 | 1 ene | Arrendamiento (5), Limpieza (2), Mantenimiento (3) |
| 26 oct | 10 | 10 | — | 1 ene | Mantenimiento (7), Internet (3) |
| 2 nov | 10 | 10 | — | 1 ene | Mantenimiento (10) |
| 9 nov | 10 | 5 | 5 | 1 ene / 1 feb | Combustible (5), Radiofrecuencia (3), Mantenimiento (2) |
| 16 nov | 10 | — | 10 | 1 feb | Combustible (10) |
| 23 nov | 10 | — | 10 | 1 feb | Combustible (10) |
| 30 nov | 10 | — | 10 | 1 feb | Combustible (10) |
| 7 dic | 10 | 1 | 9 | 1 feb | Combustible (9), Mantenimiento (1) |
| 14 dic | 8 | 7 | 1 | 1 feb y posteriores | Combustible (4), Internet (3), Arrendamiento (1) |

**Por qué importa el orden aunque la firma dependa del PAG.** Entrar temprano no adelanta la firma
más allá del 25 de enero. Lo que define es **el puesto en la fila**. Un expediente que entra la
semana del 21 de septiembre se firma a fines de enero; el mismo expediente enviado la semana del
14 de diciembre se firma a fines de abril con 9 firmas semanales, o a fines de marzo con 13.

**Las tres reglas que sostienen el calendario:**

- **Cupo de 10 expedientes por semana.** La unidad legal firmó 5,4 instrumentos por semana de
  promedio en 2026, 8,8 sostenidos en febrero-abril y 13 en su mejor semana.
- **Dentro de cada semana, lotes de la misma categoría.** Revisar diez expedientes de combustible
  seguidos cuesta menos que alternarlos: el revisor contrasta contra el mismo modelo de contrato.
- **Sin formulario no hay cola.** El expediente que entra por correo no se numera ni se programa.

**Lo que el calendario no cubre y compite por la misma capacidad:** en 2026 la unidad tramitó
además 12 adendas y 6 gestiones jurídicas que no generan contrato. Son ~25 expedientes al año que
no aparecen en ninguna estadística de contratos firmados.

---

## 6. La revisión: dónde se van los días y cómo bajarlos

Dos cosas quedan claras del análisis de 2026: **los 28 días de mediana transcurren íntegramente
dentro de la unidad legal** —el rezago entre el envío del formulario y la creación de la tarea es
de cero días— y **no se puede saber en qué se van**, porque el Planner solo conserva la fecha de
creación y la de cierre.

**1 · Modelos de contrato pre-aprobados por categoría.** Los 128 procesos son apenas 6 categorías,
y 104 son mantenimiento o combustible. Aprobar un modelo por categoría al inicio del ciclo
convierte la revisión de cada expediente en verificación de campos variables —partes, monto,
plazo, garantías, causal— en vez de redacción.

**2 · Revisión por lotes de la misma categoría.** Ya está en el calendario.

**3 · Expediente completo o no entra.** El 11 % de los envíos de 2026 fueron duplicados o
correctivos, y los devueltos para corrección consumen revisión legal completa sin producir
instrumento. La Mágica ya sabe qué tipo de proceso es y qué documentos generó: puede **bloquear el
botón de envío a la Unidad Operativa** hasta que el conjunto obligatorio esté completo, con los
cuadres automáticos hechos (montos contra ítems, IVA, plazo contra garantías, causal presente).

**4 · Un modelo de informe de justificación de la contratación directa.** Los 89 procesos nuevos
comparten el mismo argumento: proveedor calificado, recurrencia del servicio y condiciones del
territorio. Redactarlo una vez y bien, y que cada expediente solo cambie los hechos concretos,
ahorra tanto en elaboración como en revisión — y evita que la causal quede débil en unos y sólida
en otros.

**5 · Medir las etapas.** Registrar la fecha de cada cambio de depósito: recepción, inicio de
revisión, devolución por subsanación, retorno, instrumento elaborado, enviado a firma, firma del
proveedor, firma del FIAS. Sin esto no se puede verificar si alguna de estas medidas funcionó.

**6 · Plazos de tarea realistas y por tipo.** De las 103 tareas con vencimiento fijado en 2026,
**100 se cerraron después de esa fecha**, con 9 días de atraso mediano. El plazo que se fija al
abrir la tarea (13 días de mediana) es el mismo para todo.

**7 · Separar la toma de firmas de la revisión.** Sesiones fijas de firma, un día a la semana, por
lotes, para que un instrumento terminado no espere días por un hueco de agenda.

**8 · No gastar capacidad en adendas evitables.** Pedir el consumo ejecutado de 2026 como base del
monto al momento de cotizar.

---

## 7. La simulación: cuándo saldría firmado cada contrato

Modelo calibrado contra 2026: días de revisión = base del tipo de proceso + 0,3 días por cada
expediente en cola el día de la solicitud (la pendiente medida: cada 10 procesos delante añaden
unos 3 días). Base de 15 días para renovación y contratación directa, 30 para comparación de
precios. Con esos parámetros el modelo reproduce las medianas observadas: 31 días en renovación,
21 en contratación directa, 40 en comparación de precios. La firma se habilita 10 días después del
PAG y de ahí en adelante se despacha al ritmo que sostenga la unidad, en orden de expediente listo.

Con el **PAG el 15 de enero de 2027**:

| Escenario | Ene | Feb | Mar | Abr | May | Jun | Última firma | Retro. mediana |
|---|---:|---:|---:|---:|---:|---:|---|---:|
| **Con el plan · 13 firmas/sem** | 13 | 52 | 63 | — | — | — | **29 mar** | **42 d** |
| **Con el plan · 9 firmas/sem** | 9 | 36 | 45 | 36 | 2 | — | 3 may | 59 d |
| Sin plan · 13 firmas/sem | 13 | 24 | 40 | 41 | 10 | — | 14 may | 60 d |
| Sin plan · 9 firmas/sem *(2026)* | 9 | 18 | 30 | 41 | 20 | 10 | 18 jun | 80 d |

«Sin plan» es el contrafactual: las solicitudes vuelven a llegar todas en enero, como en 2026.
Referencia real de 2026: 64 días de retroactividad mediana, 151 de máxima, en el 100 % de las
renovaciones.

**El plan no cambia la fecha del PAG ni el ritmo de firma.** Mueve la última firma de junio a
marzo y la retroactividad mediana de 80 a 42 días. Los dos factores que faltan —adelantar el PAG y
sostener 13 firmas semanales en vez de 9— valen tanto como el plan mismo y no están en el mismo
par de manos.

Hay un **simulador interactivo** que permite mover la fecha de solicitud, el tipo de proceso, la
fecha del PAG y el ritmo de firma, y ver la fecha estimada de firma de un expediente concreto.

---

## 8. Qué hay que ampliar en La Mágica

El plan multiplica por cinco lo que una administradora lleva en paralelo: hoy trabaja uno o dos
expedientes; entre septiembre y diciembre llevará entre 1 y 13, y algunos quedarán abiertos meses
esperando el PAG.

### 8.1 · La vía de renovación no existe

La Mágica solo conoce comparación de precios, selección directa por excepción y compra directa.
Los documentos de la renovación —informe de satisfacción con el análisis de renovación, solicitud
de cotización del nuevo período y notificación— **no tienen plantilla**. Son 39 procesos.

Hay que añadir `Renovación` como tipo de proceso, con su captura por momentos y tres plantillas
Word. Como el informe de satisfacción es del bloque 1 y la solicitud de cotización del bloque 2, la
captura debe permitir **cerrar el expediente sin monto** y retomarlo cuando salga el PAG. El
contrato de renovación sigue siendo de la Unidad Operativa.

### 8.2 · Los arreglos de almacenamiento

Lo que encontré revisando `generador/index.html` (conviene confirmar que son los que habíamos
hablado):

- **`save()` se traga el error de cuota en silencio** (`catch(e){}`). Si el navegador se queda sin
  espacio, la AC sigue trabajando sin ver nada raro y pierde el expediente al cerrar la pestaña.
- **Las plantillas ocupan dos veces el espacio.** El seed embebido pesa ~2 MB dentro del propio
  HTML y además se copia entero a `localStorage`, sobre una cuota típica de 5 MB.
- **No hay respaldo de los expedientes.** `exportBuild()` exporta la herramienta con plantillas y
  configuración, pero **no los procesos en curso**. Con expedientes abiertos tres o cuatro meses
  esperando el PAG, esto pasa de incómodo a crítico.
- **`fap_pendientes` admite hasta 1 000 entradas** y `fap_historial` crece sin tope.

### 8.3 · Ver los procesos activos

Hoy la única forma de saber qué expedientes tiene una AC es **un desplegable en la barra lateral**.
Hace falta una pantalla *Mis procesos* con una fila por expediente —nombre, área, si se renueva o
es proceso nuevo, momento alcanzado, documentos generados, si ya se envió a la Unidad Operativa— y
**el contrato que reemplaza, cuándo arranca su sucesor, la semana asignada y si está esperando el
PAG**.

### 8.4 · La lista de verificación que bloquea el envío

Es la medida 3 de la sección 6, y la que más tiempo de revisión ahorra.

### 8.5 · Secuencia propuesta

| Sprint | Qué entra | Antes de | Por qué esa fecha |
|---|---|---|---|
| **1** | Arreglos de almacenamiento + pantalla *Mis procesos* | **18 sep** | La primera ola arranca el 21 de septiembre con 10 expedientes simultáneos |
| **2** | Vía de renovación + 3 plantillas + expediente sin monto | **12 oct** | La primera ola con renovaciones es la del 19 de octubre |
| **3** | Lista de verificación que bloquea el envío | **31 oct** | Rinde sobre los 90 expedientes que faltan por ingresar |
| **4** | Cola precargada por AC + panel de avance semanal | noviembre | Mejora el seguimiento; no bloquea ninguna ola |

Los sprints 1 a 3 están en el camino crítico; el 4 no.

---

## 9. Riesgos

| Riesgo | Efecto | Cómo se maneja |
|---|---|---|
| El PAG se aprueba después del 15 de enero | Cada semana de retraso son ~7 días más de retroactividad en 124 contratos | Confirmar la fecha con quien lo aprueba y ajustar la simulación; es el único factor de mayor impacto que el plan |
| Contratos renovables sin cláusula de renovación | Pasan a proceso nuevo y cambian de semana | Revisión legal de los 39 antes de la Fase 1; el calendario se regenera con el script |
| La causal de contratación directa no se sostiene en algún caso | Ese proceso pasa a comparación de precios: 40 días en vez de 21 | Modelo único de informe de justificación, revisado por la Unidad Legal antes de la Fase 1 |
| Administradoras que no responden | Expedientes sin confirmar entrando a diciembre | Escalamiento a los tres días hábiles; reprogramación a la última semana |
| Se mantiene el canal paralelo por correo | Vuelve el 14 % de expedientes sin trazabilidad | No numerar ni programar lo que no entre por formulario |
| El ritmo de firma se queda en 9/semana | La última firma pasa de marzo a mayo | Las siete medidas de la sección 6; el ritmo es el segundo factor de mayor impacto |
| Expedientes abiertos meses esperando el PAG | Pérdida de trabajo ya hecho | Respaldo y restauración en La Mágica (sprint 1) |

---

## 10. Cómo se regenera este plan

```bash
python3 scripts/plan_renovaciones.py <Sistema_Alertas_Contratos_FIAS.xlsx> <carpeta_salida>
```

Produce, **fuera del repositorio**:

- `Anexo_Renovaciones_2027_FAP.xlsx` — resumen, maestro de los 128 expedientes, calendario, carga
  por administradora, una hoja por administradora, la simulación de firma y los que quedan fuera
  de la campaña.
- `correos/<Administradora>.txt` y `.html` — los 20 correos de la Fase 1, con sus dos listas. El
  HTML es el que se envía: lleva el botón *Confirmar* de cada contrato.

Con `--form "<URL>"` los correos incluyen el enlace de confirmación de cada contrato, y con
`--respuestas <xlsx>` el anexo se cruza con lo que hayan contestado las administradoras
(ver [`FORMULARIO_CONFIRMACION.md`](FORMULARIO_CONFIRMACION.md)).

Los parámetros —cupo semanal, fecha del PAG, días tras el PAG, base y pendiente del modelo de
tiempos, primera semana, objetos no recurrentes— están al inicio del script. Si la revisión legal
mueve contratos de renovación a proceso nuevo, basta corregir el Excel de alertas y volver a
correrlo: el calendario y la simulación se recalculan enteros.
