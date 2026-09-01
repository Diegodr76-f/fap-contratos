# Plan de renovaciones y procesos nuevos — FAP 2027

Corte de datos: **1 de septiembre de 2026**. Fuentes: «Sistema de Alertas de Contratos FIAS»
(hoja 2026), «Matriz de procesos de adquisición, contratación y renovación FAP» y el
«Análisis de tiempos solicitud → contrato FAP 2026».

> El detalle contrato por contrato (números, proveedores, montos, administradoras y correos)
> **no está en este repositorio**: es público y la política del proyecto es no publicar datos de
> contratos en claro. Ese detalle vive en el anexo `Anexo_Renovaciones_2027_FAP.xlsx`, que se
> genera con `scripts/plan_renovaciones.py` a partir del Excel de alertas.

---

## 1. Por qué este año no se puede esperar a enero

Tres hechos que, juntos, definen el plan:

**El cupo de renovación está agotado en la mayoría del portafolio.** El FIAS permite renovar un
contrato **una sola vez**: no hay renovación sobre renovación. De los 128 contratos activos de
servicios recurrentes de áreas protegidas, **89 (70 %) ya se firmaron en 2026 como renovación** y
para 2027 tienen que salir como **proceso nuevo** — con solicitud de inicio, cotizaciones,
comisión de calificación cuando corresponda y adjudicación. Solo 39 conservan su renovación.

**Un proceso nuevo tarda más que una renovación, y llega a una cola que ya está saturada.** En
2026 la comparación de precios tardó 40 días de mediana contra 21 de la contratación directa. Y
el tiempo no lo pone el expediente sino la cola: el 52 % de los envíos del año llegó en enero, la
cola tocó 60 procesos simultáneos el 4 de febrero, y cada 10 procesos delante añaden ~3 días de
espera. Lo solicitado en enero tardó 36 días; lo de junio, 12.

**La retroactividad de 2026 fue total.** Las 81 renovaciones emparejadas iniciaron su plazo el 1
de enero de 2026 pero se firmaron entre febrero y julio: **64 días de mediana de servicio prestado
sin contrato suscrito**, hasta 151 días, con USD 357 395 comprometidos en esa situación. Ese
indicador no depende de la velocidad de la unidad legal: depende de cuándo se inicia el trámite.

Si en 2027 se repite el patrón de 2026 —con 70 % del portafolio convertido en procesos nuevos,
más lentos— la retroactividad no se mantiene: empeora.

**La meta del plan:** que los 128 procesos entren a la Unidad Operativa **antes del 18 de diciembre
de 2026**, escalonados, y que ningún contrato de 2027 empiece a ejecutarse sin estar firmado.

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

**Dos verificaciones que pueden mover contratos de la vía A a la B o C.** No se pueden resolver
desde los datos y las hace la Unidad Legal antes de la Fase 1:

- **Cláusula previa de renovación.** La Matriz condiciona el contrato de renovación a que el
  contrato original la contemple. Hay que revisar los 39 de la vía A uno por uno: el que no la
  tenga cae a proceso nuevo y cambia de semana en el calendario.
- **Calificación del ordenador de gasto para arrendamientos.** La Matriz enumera como renovables
  combustibles, mantenimiento de vehículos, muellaje, estacionamiento, radiofrecuencia,
  telecomunicaciones y servicios básicos «y similares calificados por el ordenador de gasto». Los
  5 arrendamientos de la vía A necesitan esa calificación expresa.

**Una dependencia dura:** ninguna renovación puede tramitarse sin el **PAG 2027 aprobado
MAE-FAP**. Si el PAG se aprueba después de noviembre, las 39 renovaciones se atascan aunque todo
lo demás esté listo. Conviene fijar esa fecha antes de lanzar la Fase 1.

---

## 3. Fase 1 — Consultar a las administradoras (2 al 30 de septiembre)

**Un correo por cada una de las 20 administradoras contadoras** de áreas protegidas, con su lista
de contratos, la vía que le corresponde a cada uno, la semana en que le toca enviarlo y qué tiene
que preparar. Los correos ya están redactados y personalizados: `correos/<Administradora>.txt`
dentro del anexo.

**Se le piden dos cosas, no una:**

1. **Confirmar contrato por contrato si el servicio continúa en 2027** — incluido decir cuáles
   *no* continúan, que es la única forma de no tramitar lo que no se va a usar.
2. **Revisar el monto contra el consumo ejecutado de 2026.** En 2026, 11 de las 13 adendas
   firmadas fueron aumentos de valor por consumo subestimado, sobre contratos pequeños. Es trabajo
   que reingresa a la unidad 107 días después en mediana, cuando ya está tramitando otra cosa.

**Los plazos de respuesta están escalonados según la primera semana de cada administradora**, no
son iguales para todas: quien tiene procesos de comparación de precios responde antes, porque su
lote entra primero.

| Responde antes de | Administradoras | Por qué |
|---|---:|---|
| 16 de septiembre | 7 | Su primer lote entra la semana del 21 de septiembre (comparación de precios) |
| 23 de septiembre | 7 | Primer lote la semana del 28 de septiembre |
| 7 y 14 de octubre | 5 | Lotes de octubre, mayoría renovaciones |
| 11 de noviembre | 1 | Un solo proceso, de vía B |

**Si no responde:** el silencio no puede convertirse en una prórroga automática. A los tres días
hábiles del plazo, la Coordinación del FAP escala al responsable del área protegida; si a la
semana siguiente sigue sin respuesta, el proceso se saca del lote y se reprograma a la última
semana disponible, con constancia de que la demora no se originó en la unidad legal.

**Por dónde se responde:** el formulario de procesos administrativos, no el correo. En 2026, 18
de los 132 contratos (14 %) entraron sin formulario y hubo que reconstruirlos desde el Planner;
10 de ellos de una sola administradora. Los expedientes que llegan por correo no entran a la cola.

---

## 4. Fase 2 — Los documentos de cada vía

### Vía A · Renovación (39 procesos)

Los seis documentos que exige la Matriz:

| # | Documento | Quién lo firma | ¿Lo genera La Mágica hoy? |
|---|-----------|----------------|---------------------------|
| 1 | **Informe de satisfacción** con análisis técnico, geográfico y económico del servicio a renovar | AC + responsable del AP | **No** — el `10_Informe_satisfaccion` es de satisfacción de ejecución, no el análisis de renovación |
| 2 | PAG 2027 aprobado | MAE-FAP | No aplica (documento externo) |
| 3 | **Solicitud de cotización** al proveedor para el nuevo período (alcance, plazo, presupuesto) | AC | **No** |
| 4 | Cotización del proveedor | Proveedor | No aplica |
| 5 | **Notificación** al proveedor | AC | **No** |
| 6 | Contrato de renovación (identifica el original, fija nuevo plazo y valor) | Unidad Operativa | No — y no debe: lo elabora la UO |

**Tres plantillas nuevas** cubren toda la vía A del lado de la AC. Es la brecha documental más
grande del plan.

### Vía B · Selección directa por excepción (55 procesos)

Solicitud de inicio → solicitud de cotización → cotización → **informe de justificación que motive
la causal** → notificación/orden → contrato. **La Mágica ya lo cubre completo**
(`2_Inicio_seleccion`, `4_Invitacion_seleccion`, `6_Informe_justificacion`, órdenes y actas).

Lo único que hay que reforzar es la **motivación de la causal**: para los 43 de combustible la
causal es expresa en la Matriz; para internet, radiofrecuencia y arrendamiento hay que sostenerla
caso por caso en el informe de justificación.

### Vía C · Comparación de precios (34 procesos)

Solicitud de inicio → cotizaciones de **mínimo 3 proveedores** de la base del FAP → convocatoria y
**acta de la Comisión de Calificación** → adjudicación → contrato. **La Mágica ya lo cubre**
(`1_Inicio_comparacion`, `3_Invitacion_comparacion`, `5_Acta_adjudicacion`) y el **Calificador de
Ofertas** produce el acta con el formato oficial y las bases coherentes con la matriz de
evaluación.

Es la vía más lenta —40 días de mediana— y por eso ocupa las cuatro primeras semanas del
calendario.

---

## 5. Fase 3 — El calendario: 13 semanas, cupo de 10 procesos

El orden no es alfabético ni por área: **primero lo que vence antes y lo que más tarda en
tramitarse**. Las cuatro primeras semanas concentran la comparación de precios; las renovaciones,
que son las más rápidas, cierran el plan.

| Semana (lunes) | Procesos | A | B | C | Límite del lote | Holgura |
|---|---:|---:|---:|---:|---|---:|
| 21 sep | 10 | — | — | 10 | 1 nov | 41 d |
| 28 sep | 10 | — | — | 10 | 1 nov | 34 d |
| 5 oct | 10 | — | — | 10 | 1 nov | 27 d |
| 12 oct | 10 | — | 7 | 3 | 1 nov | 20 d |
| 19 oct | 10 | 6 | 4 | — | 16 nov | 28 d |
| 26 oct | 10 | 10 | — | — | 16 nov | 21 d |
| 2 nov | 10 | 10 | — | — | 16 nov | 14 d |
| 9 nov | 10 | 5 | 4 | 1 | 16 nov | 7 d |
| 16 nov | 10 | — | 10 | — | 17 dic | 31 d |
| 23 nov | 10 | — | 10 | — | 17 dic | 24 d |
| 30 nov | 10 | — | 10 | — | 17 dic | 17 d |
| 7 dic | 10 | 1 | 9 | — | 17 dic | 10 d |
| 14 dic | 8 | 7 | 1 | — | 17 dic | 3 d |

**Las tres reglas que sostienen el calendario:**

- **Cupo de 10 procesos por semana.** La unidad legal firmó 5,4 instrumentos por semana de
  promedio en 2026 y 13 en su mejor semana; en el trimestre febrero-abril sostuvo 8,8. Diez es
  exigente pero demostrado, y evita volver a los 60 procesos en cola.
- **Antelación mínima obligatoria: 45 días antes del vencimiento, 60 si es comparación de
  precios.** Es lo que elimina la retroactividad de 64 días, sin cambiar en nada los tiempos de
  tramitación.
- **Sin formulario no hay cola.** El expediente que entra por correo no se numera ni se programa.

Con este reparto, **ningún proceso queda fuera de su fecha límite** y el último lote entra el 18
de diciembre de 2026 — la meta que pidió la Coordinación del FAP.

**Lo que no cubre el calendario y compite por la misma capacidad:** en 2026 la unidad tramitó
además 12 adendas y 6 gestiones jurídicas que no generan contrato (reclamos de seguros,
matrículas, notificación a EP Petroecuador, informes de ampliación de plazo). Son ~25 expedientes
al año que no aparecen en ninguna estadística de contratos firmados. El cupo de 10 debe entenderse
sobre una capacidad que ya está parcialmente ocupada.

---

## 6. Qué hay que ampliar en La Mágica (y por qué está en el camino crítico)

Este plan multiplica por cinco lo que una administradora lleva en paralelo: hoy trabaja uno o dos
expedientes; entre septiembre y diciembre llevará entre 2 y 13, en tres vías distintas y con
semanas asignadas. La herramienta no está construida para eso.

### 6.1 · La vía de renovación no existe en la herramienta

La Mágica solo conoce comparación de precios, selección directa por excepción y compra directa.
Los tres documentos de la vía A —informe de satisfacción para renovación, solicitud de cotización
del nuevo período y notificación— **no tienen plantilla**. Son 39 procesos, el 30 % del plan.

Sin esto, esas 39 renovaciones se redactan a mano, cada una distinta, y se pierde la coherencia
que la herramienta consiguió en las otras dos vías.

**Alcance:** añadir `Renovación` como cuarto tipo de proceso, con su captura por momentos
(contrato original que se renueva, período nuevo, monto nuevo) y tres plantillas Word nuevas. El
contrato de renovación sigue siendo de la Unidad Operativa: la herramienta llega hasta el envío.

### 6.2 · Los arreglos de almacenamiento

Lo que encontré revisando `generador/index.html` (conviene confirmar que son los que habíamos
hablado):

- **`save()` se traga el error de cuota en silencio** (`catch(e){}`). Si el navegador se queda sin
  espacio, la AC sigue trabajando sin ver nada raro y pierde el expediente al cerrar la pestaña.
  Con 10 expedientes simultáneos por AC, deja de ser hipotético.
- **Las plantillas ocupan dos veces el espacio.** El seed embebido pesa ~2 MB dentro del propio
  HTML y además se copia entero a `localStorage` (`fap_tpls`), sobre una cuota típica de 5 MB.
  Guardando solo las plantillas propias y leyendo el resto del seed se libera casi la mitad.
- **No hay respaldo de los expedientes.** `exportBuild()` exporta la herramienta con plantillas y
  configuración, pero **no los procesos en curso**. Si la AC limpia datos del navegador o cambia
  de equipo, pierde todo sin aviso. Falta *Descargar respaldo (.json)* y *Restaurar respaldo*.
- **`fap_pendientes` admite hasta 1 000 entradas** y `fap_historial` crece sin tope. Hay que
  podarlos y avisar cuando el espacio se acerque al límite.

### 6.3 · Ver los procesos activos

Hoy la única forma de saber qué expedientes tiene una AC es **un desplegable en la barra
lateral**. No hay lista, ni estado, ni orden, ni búsqueda: por eso se pierden.

**Alcance:** una pantalla *Mis procesos* con una fila por expediente —nombre, área, vía, momento
alcanzado (1 a 4), documentos generados, si ya se envió a la Unidad Operativa— y, atado a este
plan, **el contrato que reemplaza, su fecha de vencimiento y la semana asignada**, con un aviso
cuando la semana ya pasó y el proceso sigue sin enviarse. Es la misma información que la AC
necesita para no perderse y que la Coordinación necesita para saber si el plan va en hora.

### 6.4 · Secuencia propuesta

| Sprint | Qué entra | Antes de | Por qué esa fecha |
|---|---|---|---|
| **1** | Arreglos de almacenamiento + pantalla *Mis procesos* | **18 sep** | La Ola 1 arranca el 21 de septiembre con 10 procesos simultáneos |
| **2** | Vía de renovación + 3 plantillas nuevas | **12 oct** | La primera ola con procesos de vía A es la del 19 de octubre |
| **3** | Cola precargada por AC desde el Sistema de Alertas + panel de avance semanal para la Coordinación | **noviembre** | Mejora el seguimiento; no bloquea ninguna ola |

Los sprints 1 y 2 **están en el camino crítico del plan**; el 3 no.

---

## 7. Riesgos

| Riesgo | Efecto | Cómo se maneja |
|---|---|---|
| PAG 2027 aprobado tarde | Bloquea las 39 renovaciones | Fijar la fecha de aprobación antes de lanzar la Fase 1 |
| Contratos de la vía A sin cláusula de renovación | Caen a proceso nuevo y cambian de semana | Revisión legal de los 39 antes de la Fase 1; el calendario se regenera con el script |
| Administradoras que no responden | Procesos sin confirmar entrando a diciembre | Escalamiento a los 3 días hábiles; reprogramación a la última semana |
| Se mantiene el canal paralelo (correo) | Vuelve el 14 % de expedientes sin trazabilidad | No numerar ni programar lo que no entre por formulario |
| El cupo de 10 se rompe por acumulación | Vuelve la cola y con ella la retroactividad | Revisión semanal del cupo; lo que excede pasa a la semana siguiente, no se agrega |
| Montos subestimados | Adendas en el segundo semestre de 2027 | Pedir el consumo ejecutado 2026 en la Fase 1 |

---

## 8. Cómo se regenera este plan

```bash
python3 scripts/plan_renovaciones.py <Sistema_Alertas_Contratos_FIAS.xlsx> <carpeta_salida>
```

Produce, **fuera del repositorio**:

- `Anexo_Renovaciones_2027_FAP.xlsx` — resumen, maestro de los 128 procesos, calendario, carga por
  administradora, una hoja por administradora y los que quedan fuera del universo.
- `correos/<Administradora>.txt` — los 20 correos de la Fase 1, ya personalizados.

Los parámetros del plan (cupo semanal, antelación por vía, primera semana, objetos no recurrentes)
están al inicio del script y se cambian ahí. Si la revisión legal mueve contratos de vía, basta
corregir el Excel de alertas y volver a correrlo: el calendario se recalcula entero.
