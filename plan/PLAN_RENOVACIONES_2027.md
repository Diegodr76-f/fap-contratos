# Plan de renovaciones y procesos nuevos — FAP 2027

Corte de datos: **1 de septiembre de 2026**. Fuentes: «Sistema de Alertas de Contratos FIAS»
(hoja 2026), «Matriz de procesos de adquisición, contratación y renovación FAP» y el
«Análisis de tiempos solicitud → contrato FAP 2026».

> El detalle contrato por contrato (números, proveedores, montos, administradoras y correos)
> **no está en este repositorio**: es público y la política del proyecto es no publicar datos de
> contratos en claro. Ese detalle vive en el anexo `Anexo_Renovaciones_2027_FAP.xlsx`, que se
> genera con `scripts/plan_renovaciones.py` a partir del Excel de alertas.

---

## 1. La meta, y qué parte de ella depende de nosotros

**Lo que sí controlamos:** llegar al 31 de diciembre de 2026 con los **128 expedientes
precontractuales generados y revisados**, listos para cotizar y suscribir.

**Lo que no:** la firma. Sin el **PAG 2027 aprobado** no se puede suscribir, y es el PAG el que
fija cuánto presupuesto tiene cada área — así que tampoco se puede pedir una cotización en firme
antes de que exista. La fecha del PAG manda sobre cualquier mejora interna.

Por eso el plan hace una cosa concreta: **que el día que salga el PAG no quede ningún documento
por hacer**. Que lo único pendiente sea cotización en firme → instrumento → firma. En 2026 el PAG
y el expediente se hicieron a la vez, en enero, y por eso las 81 renovaciones se firmaron con el
plazo ya corriendo.

Tres hechos que definen el resto del plan:

**El cupo de renovación está agotado en la mayoría del portafolio.** El FIAS permite renovar un
contrato **una sola vez**: no hay renovación sobre renovación. De los 128 contratos activos de
servicios recurrentes de áreas protegidas, **89 (70 %) ya se firmaron en 2026 como renovación** y
para 2027 tienen que salir como **proceso nuevo** — con solicitud de inicio, cotizaciones,
comisión de calificación cuando corresponda y adjudicación. Solo 39 conservan su renovación.

**El tiempo de tramitación lo pone la cola, no el expediente.** El 52 % de los envíos de 2026
llegó en enero, la cola tocó 60 procesos simultáneos el 4 de febrero, y cada 10 procesos delante
añaden ~3 días de espera. Lo solicitado en enero tardó 36 días; lo de junio, 12.

**La retroactividad de 2026 fue total.** Las 81 renovaciones iniciaron su plazo el 1 de enero de
2026 pero se firmaron entre febrero y julio: **64 días de mediana de servicio prestado sin
contrato suscrito**, hasta 151 días, con USD 357 395 comprometidos en esa situación.

---

## 2. El universo: qué se puede renovar y qué no

| Vía | Qué es | Procesos | Monto 2026 (USD) |
|-----|--------|---------:|-----------------:|
| **A · Renovación** | Contrato 2026 firmado como *Nuevo*: conserva su única renovación | **39** | 125 623 |
| **B · Selección directa por excepción** | Proceso nuevo con causal de excepción motivada | **55** | 207 805 |
| **C · Comparación de precios** | Proceso nuevo con mínimo 3 cotizaciones y Comisión | **34** | 164 202 |
| | **Total universo** | **128** | **497 630** |
| — | Fuera del universo: objeto no recurrente (2 consultorías + 1 adquisición de equipos), nivel central | 3 | 131 678 |

**Cómo se clasificó cada contrato.** La regla es mecánica y sale del campo *Tipo de contrato* del
Sistema de Alertas:

1. `Tipo 2026 = Nuevo` **y** objeto recurrente → **vía A**, todavía puede renovarse.
2. `Tipo 2026 = Renovación` → cupo agotado, **proceso nuevo**. La vía depende del objeto y el monto:
   - **Combustible** → vía B. Es causal expresa de la Matriz («combustible: proveedor más cercano al AP»), cualquier monto. Son 43 de los 55.
   - **Arrendamiento, internet y radiofrecuencia** → vía B con causal a motivar («único proveedor en las inmediaciones», inmueble específico). Con los datos actuales solo caen aquí los 7 arrendamientos: todos los contratos de internet y radiofrecuencia conservan su renovación.
   - **Monto ≤ USD 1 000** con instrumento jurídico → vía B. Son 5 mantenimientos pequeños.
   - **Resto** (32 mantenimientos vehiculares y 2 de limpieza, todos sobre USD 1 000) → vía C, comparación de precios.
3. Objeto no recurrente (consultoría, adquisición de bienes) → nunca renovación, fuera de esta campaña.

### No todo tiene que estar firmado el 31 de diciembre

El sucesor arranca el día siguiente al vencimiento del contrato vigente, y los vencimientos no son
todos iguales. Eso parte el universo en dos grupos con fechas tope distintas:

| Grupo | Arranca | Firmar antes del | Procesos | A | B | C | Monto |
|---|---|---|---:|---:|---:|---:|---:|
| **1-ene** | 1 de enero de 2027 | 31 de diciembre de 2026 | **75** | 31 | 11 | 33 | USD 271 933 |
| **1-feb** | 1 de febrero de 2027 | 31 de enero de 2027 | **49** | 5 | 43 | 1 | USD 222 012 |
| posterior | entre febrero de 2027 y 2029 | — | 4 | 3 | 1 | 0 | USD 3 684 |

La estructura es favorable y conviene aprovecharla: **33 de las 34 comparaciones de precios —la vía
lenta— están en el grupo de enero**, que es el que vence primero; y el grupo de febrero es casi
todo vía B, la vía rápida. Es decir, lo pesado hay que empezarlo ya, y lo que se puede dejar para
noviembre y diciembre es justamente lo que se tramita rápido.

### Dos verificaciones legales pueden mover contratos de la vía A

No se pueden resolver desde los datos y hay que hacerlas antes de la Fase 1:

- **Cláusula previa de renovación.** La Matriz condiciona el contrato de renovación a que el
  contrato original la contemple. Hay que revisar los 39 de la vía A uno por uno: el que no la
  tenga cae a proceso nuevo y cambia de semana en el calendario.
- **Calificación del ordenador de gasto para arrendamientos.** La Matriz enumera como renovables
  combustibles, mantenimiento de vehículos, muellaje, estacionamiento, radiofrecuencia,
  telecomunicaciones y servicios básicos «y similares calificados por el ordenador de gasto». Los
  5 arrendamientos de la vía A necesitan esa calificación expresa.

---

## 3. Fase 1 — Consultar a las administradoras (2 al 30 de septiembre)

**Un correo por cada una de las 20 administradoras contadoras** de áreas protegidas, con su lista
de contratos, la vía de cada uno, cuándo arranca su sucesor, la semana en que entra su expediente
y qué preparar ahora frente a qué esperar al PAG. Los correos ya están redactados y personalizados:
`correos/<Administradora>.txt` dentro del anexo.

**Se le piden dos cosas:**

1. **Confirmar contrato por contrato si el servicio continúa en 2027** — incluido decir cuáles
   *no* continúan, que es la única forma de no tramitar lo que no se va a usar.
2. **Decir si el mismo proveedor le presta el servicio en varias de sus áreas.** Es la base de la
   consolidación de instrumentos de la sección 6.

Lo del monto se le pide igual, pero para más adelante: cuando toque cotizar, la base es el
**consumo ejecutado de 2026**, no el presupuesto del contrato vigente. De las 13 adendas firmadas
este año, 11 fueron aumentos de valor por consumo subestimado; ese trabajo reingresa a la unidad
107 días después en mediana.

**Los plazos de respuesta están escalonados** según la primera semana de cada administradora:

| Responde antes de | Administradoras | Por qué |
|---|---:|---|
| 16 de septiembre | 7 | Su primer lote entra la semana del 21 de septiembre (comparación de precios) |
| 23 de septiembre | 7 | Primer lote la semana del 28 de septiembre |
| 7 y 14 de octubre | 5 | Lotes de octubre, mayoría renovaciones |
| 11 de noviembre | 1 | Un solo proceso, de vía B |

**Si no responde:** a los tres días hábiles del plazo, la Coordinación del FAP escala al
responsable del área protegida; si a la semana siguiente sigue sin respuesta, el proceso sale del
lote y se reprograma a la última semana disponible, con constancia de que la demora no se originó
en la unidad legal.

**Por dónde se responde:** el formulario de procesos administrativos, no el correo. En 2026, 18 de
los 132 contratos (14 %) entraron sin formulario y hubo que reconstruirlos desde el Planner; 10 de
ellos de una sola administradora.

---

## 4. Fase 2 — Los documentos, partidos por el PAG

El corte es simple: **todo lo que no necesita saber el monto se hace ya; lo que lo necesita
espera**. Así el expediente llega completo a diciembre y el PAG solo dispara el tramo corto.

### Bloque 1 — sin PAG (septiembre a diciembre)

| Vía | Qué produce la AC ahora | ¿La Mágica lo genera? |
|---|---|---|
| **A** | Informe de satisfacción con análisis técnico, geográfico y económico, firmado por la AC y el responsable del AP. Verificación de la cláusula de renovación. | **No** — el informe existente es de satisfacción de ejecución, no el análisis de renovación |
| **B** | Solicitud de inicio del responsable del área e informe de justificación que motiva la causal. | Sí, completo |
| **C** | Solicitud de inicio, especificaciones técnicas o TdR, los tres proveedores de la base ya identificados y la Comisión de Calificación designada por memorando. La invitación queda redactada con el presupuesto en blanco. | Sí, completo |

En paralelo, del lado de la Unidad Legal: revisión de las 39 cláusulas de renovación,
**modelos de contrato pre-aprobados por categoría** y decisión sobre los instrumentos
consolidables (sección 6).

### Bloque 2 — requiere el PAG aprobado

| Vía | Qué falta cuando salga el PAG |
|---|---|
| **A** | Solicitud de cotización al proveedor para el nuevo período con el presupuesto asignado → cotización → notificación → contrato de renovación (lo elabora la UO) |
| **B** | Solicitud de cotización en firme → cotización → orden o notificación → contrato |
| **C** | Se cursa la invitación a los tres proveedores → cotizaciones → Comisión → acta de adjudicación → contrato |

La Matriz exige el PAG expresamente en la vía de renovación; en las otras dos condiciona el monto,
que es lo mismo a efectos prácticos: sin techo presupuestario no hay cotización en firme.

---

## 5. Fase 3 — El calendario: 13 semanas, cupo de 10 expedientes

El orden no es alfabético ni por área: **primero lo que vence antes y lo que más tarda en
tramitarse**. Las cuatro primeras semanas concentran la comparación de precios.

| Semana (lunes) | Expedientes | A | B | C | Vencen | Holgura |
|---|---:|---:|---:|---:|---|---:|
| 21 sep | 10 | — | — | 10 | 31 dic | 41 d |
| 28 sep | 10 | — | — | 10 | 31 dic | 34 d |
| 5 oct | 10 | — | — | 10 | 31 dic | 27 d |
| 12 oct | 10 | — | 7 | 3 | 31 dic | 20 d |
| 19 oct | 10 | 6 | 4 | — | 31 dic | 28 d |
| 26 oct | 10 | 10 | — | — | 31 dic | 21 d |
| 2 nov | 10 | 10 | — | — | 31 dic | 14 d |
| 9 nov | 10 | 5 | 4 | 1 | 31 dic / 31 ene | 7 d |
| 16 nov | 10 | — | 10 | — | 31 ene | 31 d |
| 23 nov | 10 | — | 10 | — | 31 ene | 24 d |
| 30 nov | 10 | — | 10 | — | 31 ene | 17 d |
| 7 dic | 10 | 1 | 9 | — | 31 ene | 10 d |
| 14 dic | 8 | 7 | 1 | — | 31 ene y posteriores | 3 d |

Los 75 contratos del grupo de enero entran en las ocho primeras semanas; los 49 del grupo de
febrero, en las cinco últimas. **Ningún expediente queda fuera de su fecha límite.**

**Las tres reglas que sostienen el calendario:**

- **Cupo de 10 expedientes por semana.** La unidad legal firmó 5,4 instrumentos por semana de
  promedio en 2026 y 13 en su mejor semana; en el trimestre febrero-abril sostuvo 8,8. Diez es
  exigente pero demostrado, y evita volver a los 60 procesos en cola.
- **Dentro de cada semana, lotes de la misma categoría.** Revisar diez expedientes de combustible
  seguidos cuesta menos que alternarlos con mantenimientos y arriendos: el revisor contrasta contra
  el mismo modelo de contrato en vez de cambiar de marco en cada expediente.
- **Sin formulario no hay cola.** El expediente que entra por correo no se numera ni se programa.

**Lo que el calendario no cubre y compite por la misma capacidad:** en 2026 la unidad tramitó
además 12 adendas y 6 gestiones jurídicas que no generan contrato (reclamos de seguros, matrículas,
notificación a EP Petroecuador, informes de ampliación de plazo). Son ~25 expedientes al año que no
aparecen en ninguna estadística de contratos firmados.

---

## 6. La revisión: dónde se van los días y cómo bajarlos

El análisis de 2026 deja dos cosas claras. La primera: **los 28 días de mediana transcurren
íntegramente dentro de la unidad legal** — el rezago entre el envío del formulario y la creación de
la tarea es de 0 días, no se pierde tiempo en la recepción. La segunda: **no se puede saber en qué
se van**, porque el Planner solo conserva la fecha de creación y la de cierre; los movimientos
entre depósitos no quedan fechados en el export.

Ocho medidas, ordenadas por lo que rinden:

**1 · Consolidar instrumentos — 20 menos, 16 % de la carga.** Hay 12 casos de misma
administradora, mismo proveedor y misma categoría en varias áreas: cuatro de combustible de una
sola AC con un mismo proveedor, cuatro de mantenimiento con otro, y así. Sacarlos como un contrato
con anexo por área elimina 20 revisiones, 20 elaboraciones y 20 tomas de firma. Es una decisión, no
un desarrollo: la lista está en la hoja *Consolidables* del anexo.

**2 · Modelos de contrato pre-aprobados por categoría.** Los 128 procesos son apenas 6 categorías,
y 104 de ellos son mantenimiento o combustible. Aprobar un modelo por categoría al inicio del ciclo
convierte la revisión de cada expediente en verificación de campos variables —partes, monto, plazo,
garantías, causal— en vez de redacción. Es lo que más comprime la etapa de elaboración del
instrumento.

**3 · Revisión por lotes de la misma categoría.** Ya está en el calendario: el reparto agrupa por
categoría dentro de cada semana.

**4 · Expediente completo o no entra.** El 11 % de los envíos de 2026 fueron duplicados o
correctivos, y hubo expedientes devueltos para corrección que consumieron revisión legal completa
sin producir instrumento. La Mágica ya sabe qué tipo de proceso es y qué documentos generó: puede
**bloquear el botón de envío a la Unidad Operativa** hasta que el conjunto obligatorio esté
completo, y adjuntar la lista de verificación más los cuadres automáticos (montos contra ítems,
IVA, plazo contra garantías, causal presente si es excepción). Es el cambio de La Mágica que más
tiempo de revisión ahorra.

**5 · Medir las etapas.** Registrar la fecha de cada cambio de depósito —recepción, inicio de
revisión, devolución por subsanación, retorno, instrumento elaborado, enviado a firma, firma del
proveedor, firma del FIAS— o dejarla en las notas, como ya se hace en algunos procesos. Sin esto no
se puede verificar si alguna de estas medidas funcionó.

**6 · Plazos de tarea realistas y por vía.** De las 103 tareas con fecha de vencimiento fijada en
2026, **100 se cerraron después de esa fecha**, con un atraso mediano de 9 días. El plazo que se
fija al abrir la tarea (13 días de mediana) es el mismo para todo, cuando la comparación de precios
tarda 40 y la directa 21. Fijarlo por vía convierte el Planner en una herramienta de alerta en vez
de un semáforo permanentemente en rojo.

**7 · Separar la toma de firmas de la revisión.** La firma involucra a terceros y es serial.
Sesiones fijas de firma —un día a la semana, por lotes— evitan que un instrumento terminado espere
días por un hueco de agenda.

**8 · No gastar capacidad en adendas evitables.** 11 de las 13 adendas de 2026 fueron aumentos de
valor por consumo subestimado, y llegan 107 días después del contrato original, cuando la unidad ya
está en otra cosa. Pedir el consumo ejecutado como base del monto es la medida más barata del plan.

---

## 7. La firma: qué pasa según cuándo salga el PAG

Suponiendo lo que este plan garantiza —expediente ya hecho y revisado, así que tras el PAG solo
resta cotización en firme, instrumento y firma— y con dos ritmos de firma: 9 por semana (el
sostenido de febrero-abril de 2026) y 13 (el pico demostrado).

| PAG aprobado | Firmas/semana | Grupo 1-ene a tiempo | Grupo 1-feb a tiempo | Retroactividad mediana | Máxima |
|---|---:|---:|---:|---:|---:|
| 15 de octubre | 9 | 75 de 75 | 39 de 49 | 0 d | 11 d |
| 15 de octubre | 13 | **75 de 75** | **49 de 49** | **0 d** | **0 d** |
| 16 de noviembre | 9 | 31 de 75 | 0 de 49 | 14 d | 46 d |
| 16 de noviembre | 13 | 44 de 75 | 23 de 49 | 0 d | 21 d |
| 1 de diciembre | 9 | 13 de 75 | 0 de 49 | 28 d | 60 d |
| 1 de diciembre | 13 | 18 de 75 | 0 de 49 | 14 d | 35 d |
| 15 de diciembre | 13 | 0 de 75 | 0 de 49 | 25 d | 42 d |
| 5 de enero | 13 | 0 de 75 | 0 de 49 | 39 d | 56 d |
| 1 de febrero *(como 2026)* | 9 | 0 de 75 | 0 de 49 | 84 d | 109 d |

La mediana está calculada sobre los 128 contratos, contando como 0 los que se firman a tiempo.
Referencia de 2026: **64 días de mediana y 151 de máximo**, sobre las 81 renovaciones emparejadas
—todas retroactivas, ninguna firmada a tiempo—.

Tres lecturas:

- **La fecha del PAG vale más que cualquier mejora interna.** Adelantarlo de principios de enero a
  mediados de noviembre lleva la retroactividad mediana de 39 días a 0, y la máxima de 56 a 21.
  Todo lo que podemos hacer nosotros por dentro —sostener 13 firmas semanales en vez de 9,
  consolidar instrumentos— vale entre 3 y 17 días.
- **Aun así, tener el expediente listo antes vale mucho.** En el peor escenario de PAG —febrero,
  como en 2026— la retroactividad mediana baja de 84 a 67 días solo por sostener 13 firmas
  semanales, y eso únicamente es posible si el expediente ya está hecho. Si se empieza a armar
  cuando sale el PAG, se suman los 28 días del ciclo documental encima de todo lo demás.
- **Con el PAG en octubre la retroactividad desaparece.** Es el único escenario que la lleva a
  cero, y no depende de la unidad legal.

**Esta es la conversación que hay que tener con quien aprueba el PAG**, y conviene tenerla antes de
lanzar la Fase 1: cada semana que se adelanta el PAG vale aproximadamente una semana menos de
servicio prestado sin contrato en 124 contratos.

---

## 8. Qué hay que ampliar en La Mágica

Este plan multiplica por cinco lo que una administradora lleva en paralelo: hoy trabaja uno o dos
expedientes; entre septiembre y diciembre llevará entre 1 y 13, en tres vías distintas y con
semanas asignadas. La herramienta no está construida para eso.

### 8.1 · La vía de renovación no existe

La Mágica solo conoce comparación de precios, selección directa por excepción y compra directa. Los
documentos de la vía A —informe de satisfacción para renovación, solicitud de cotización del nuevo
período y notificación— **no tienen plantilla**. Son 39 procesos, el 30 % del plan.

**Alcance:** añadir `Renovación` como cuarto tipo de proceso, con su captura por momentos (contrato
original que se renueva, período nuevo, monto nuevo) y tres plantillas Word nuevas. El contrato de
renovación sigue siendo de la Unidad Operativa: la herramienta llega hasta el envío. Como el
informe de satisfacción es del bloque 1 y la solicitud de cotización del bloque 2, la captura debe
permitir **cerrar el expediente sin monto** y retomarlo cuando salga el PAG.

### 8.2 · Los arreglos de almacenamiento

Lo que encontré revisando `generador/index.html` (conviene confirmar que son los que habíamos
hablado):

- **`save()` se traga el error de cuota en silencio** (`catch(e){}`). Si el navegador se queda sin
  espacio, la AC sigue trabajando sin ver nada raro y pierde el expediente al cerrar la pestaña.
  Con 10 expedientes simultáneos por AC, deja de ser hipotético.
- **Las plantillas ocupan dos veces el espacio.** El seed embebido pesa ~2 MB dentro del propio
  HTML y además se copia entero a `localStorage` (`fap_tpls`), sobre una cuota típica de 5 MB.
  Guardando solo las plantillas propias y leyendo el resto del seed se libera casi la mitad.
- **No hay respaldo de los expedientes.** `exportBuild()` exporta la herramienta con plantillas y
  configuración, pero **no los procesos en curso**. Si la AC limpia datos del navegador o cambia de
  equipo, pierde todo sin aviso. Falta *Descargar respaldo (.json)* y *Restaurar respaldo*.
  Con expedientes que ahora viven abiertos tres o cuatro meses esperando el PAG, esto pasa de
  incómodo a crítico.
- **`fap_pendientes` admite hasta 1 000 entradas** y `fap_historial` crece sin tope. Hay que
  podarlos y avisar cuando el espacio se acerque al límite.

### 8.3 · Ver los procesos activos

Hoy la única forma de saber qué expedientes tiene una AC es **un desplegable en la barra lateral**.
No hay lista, ni estado, ni orden, ni búsqueda: por eso se pierden.

**Alcance:** una pantalla *Mis procesos* con una fila por expediente —nombre, área, vía, momento
alcanzado, documentos generados, si ya se envió a la Unidad Operativa— y, atado a este plan, **el
contrato que reemplaza, cuándo arranca su sucesor, la semana asignada y si está esperando el PAG**,
con aviso cuando la semana ya pasó y el expediente sigue sin enviarse.

### 8.4 · La lista de verificación que bloquea el envío

Es la medida 4 de la sección 6, y es la que más tiempo de revisión ahorra: no dejar enviar a la
Unidad Operativa hasta que el conjunto obligatorio de la vía esté completo, con los cuadres
automáticos hechos y la lista de verificación adjunta.

### 8.5 · Secuencia propuesta

| Sprint | Qué entra | Antes de | Por qué esa fecha |
|---|---|---|---|
| **1** | Arreglos de almacenamiento + pantalla *Mis procesos* | **18 sep** | La primera ola arranca el 21 de septiembre con 10 expedientes simultáneos |
| **2** | Vía de renovación + 3 plantillas + expediente sin monto | **12 oct** | La primera ola con procesos de vía A es la del 19 de octubre |
| **3** | Lista de verificación que bloquea el envío | **31 oct** | Rinde desde la cuarta ola en adelante, sobre 90 de los 128 expedientes |
| **4** | Cola precargada por AC + panel de avance semanal para la Coordinación | noviembre | Mejora el seguimiento; no bloquea ninguna ola |

Los sprints 1 a 3 están en el camino crítico; el 4 no.

---

## 9. Riesgos

| Riesgo | Efecto | Cómo se maneja |
|---|---|---|
| **PAG 2027 aprobado tarde** | Determina toda la retroactividad; en el peor escenario, peor que 2026 | Escalar la fecha ahora, antes de la Fase 1; la tabla de la sección 7 es el argumento |
| Contratos de la vía A sin cláusula de renovación | Caen a proceso nuevo y cambian de semana | Revisión legal de los 39 antes de la Fase 1; el calendario se regenera con el script |
| Administradoras que no responden | Expedientes sin confirmar entrando a diciembre | Escalamiento a los tres días hábiles; reprogramación a la última semana |
| Se mantiene el canal paralelo por correo | Vuelve el 14 % de expedientes sin trazabilidad | No numerar ni programar lo que no entre por formulario |
| El cupo de 10 se rompe por acumulación | Vuelve la cola y con ella la demora | Revisión semanal del cupo: lo que excede pasa a la semana siguiente, no se agrega |
| Expedientes abiertos meses esperando el PAG | Pérdida de trabajo ya hecho | Respaldo y restauración en La Mágica (sprint 1) |
| Montos subestimados | Adendas en el segundo semestre de 2027 | Pedir el consumo ejecutado 2026 al momento de cotizar |

---

## 10. Cómo se regenera este plan

```bash
python3 scripts/plan_renovaciones.py <Sistema_Alertas_Contratos_FIAS.xlsx> <carpeta_salida>
```

Produce, **fuera del repositorio**:

- `Anexo_Renovaciones_2027_FAP.xlsx` — resumen, maestro de los 128 expedientes, calendario, carga
  por administradora, una hoja por administradora, instrumentos consolidables, proyección de firma
  según la fecha del PAG y los que quedan fuera del universo.
- `correos/<Administradora>.txt` — los 20 correos de la Fase 1, ya personalizados y partidos en
  bloque 1 y bloque 2.

Los parámetros (cupo semanal, antelación por vía, primera semana, objetos no recurrentes, fechas de
PAG y capacidades a proyectar) están al inicio del script. Si la revisión legal mueve contratos de
vía, basta corregir el Excel de alertas y volver a correrlo: el calendario y la proyección se
recalculan enteros.
