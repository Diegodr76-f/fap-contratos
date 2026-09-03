# FAP Contratos — FIAS

Herramientas internas del Fondo de Áreas Protegidas (FAP / FIAS) para la gestión del ciclo de vida de contratos.

## Calificador de Ofertas — evaluación de procesos de selección

**`/calificacion/index.html`** es la herramienta para calcular y ordenar las ofertas de los
**procesos de selección por convocatoria** (los que generan las *bases de concurso*). Nace para
resolver el problema de que la calificación es difícil de aplicar a mano. Es una página HTML
autónoma (sin backend ni librerías externas) y cubre los **dos esquemas** que usa el FAP:

| Esquema | Para qué procesos | Cómo califica |
|---------|-------------------|---------------|
| **Por puntos** | Consultorías y servicios | Criterios técnicos ponderados (p. ej. Perfil 35 + Oferta técnica 45) **+** oferta económica **inverso-proporcional** (20). Solo pasan a la económica quienes superan el **umbral técnico**. Gana el mayor puntaje total (sobre 100). |
| **Cumple / No cumple** | Bienes y servicios con postcalificación | Requisitos legales y técnicos **habilitantes** (todos deben cumplir). Entre quienes cumplen, se adjudica al **menor precio**. |

**Qué hace:**

- Matriz de evaluación **editable** (criterios, puntos, requisitos y umbral) — sirve para *distintos*
  procesos de adquisiciones y consultorías, no solo para un caso.
- Ingreso de varios oferentes con su precio y el puntaje consolidado de la Comisión por criterio.
- Cálculo automático: puntaje técnico, aplicación del umbral, puntaje económico inverso-proporcional,
  total, **orden de prelación** y **oferta recomendada** para adjudicación.
- **Acta de adjudicación** con el formato oficial de la Comisión (Acta N.º, Datos del proceso,
  quórum, orden del día, PRIMERO–QUINTO, cierre y firmas por rol). Se puede **imprimir/guardar en PDF**
  (la vista se adapta al esquema: puntajes o Cumple/No cumple, con desglose de IVA) o **descargar en Word**
  (botón *Acta Word*), que rellena la plantilla correcta con el mismo motor docxtemplater que usa La Mágica.
  Según el esquema, el botón elige automáticamente la plantilla:
  `plantillas/Acta_de_adjudicacion.docx` (Cumple/No cumple · comparación de precios, la plantilla oficial
  del equipo) o `plantillas/Acta_de_adjudicacion_puntos.docx` (consultorías por puntos, con tablas de
  puntaje técnico y económico). Las dos plantillas usan bucles: el quórum se adapta a los miembros
  agregados en la herramienta (`{#items}{miembros}`) y las tablas técnica y económica generan una fila
  o bloque por oferente (Word no permite columnas dinámicas). Presupuesto y monto adjudicado se expresan
  también en letras. La lista completa de tags para editar las plantillas está en
  `calificacion/plantillas/TAGS.md`.
- Exportación **CSV** de resultados, guardar/abrir el proceso en **JSON**, y persistencia local.
- **Sección de calificación para las bases**: genera el texto normalizado (idéntico a la matriz)
  para pegarlo en la sección de criterios de calificación de las bases — así las *bases* y la
  *herramienta* siempre dicen lo mismo.

Trae dos ejemplos precargados con casos reales: **Consultoría de Delitos Ambientales** (por puntos,
35/45/20, umbral 75) y **Adquisición de motor fuera de borda PN Machalilla** (Cumple/No cumple, menor
precio). Está integrada dentro del CLM (menú *Herramientas integradas → Calificador de ofertas*).

## Plantillas de bases de concurso

**`/bases/`** contiene dos **plantillas estándar de bases** en Word, actualizadas y con la sección de
calificación redactada de forma clara y sin ambigüedad (coincide exactamente con el Calificador):

- `Plantilla_Bases_Consultoria_por_puntos_FAP-FIAS.docx` — consultorías (calificación por puntos).
- `Plantilla_Bases_Bienes_Servicios_CumpleNoCumple_FAP-FIAS.docx` — bienes/servicios (Cumple/No cumple + menor precio).

Se reutilizan reemplazando los campos entre `[CORCHETES]`. La sección de criterios de calificación de
cada plantilla puede regenerarse desde el Calificador de Ofertas para mantener la coherencia.

## CLM — Contract Lifecycle Management (aplicación unificada)

**`/clm/index.html`** es la plataforma única y funcional que reúne todo el ciclo de vida
del contrato en una sola aplicación, siguiendo el modelo estándar de un CLM
(intake → elaboración → firma → ejecución → obligaciones → renovación → analítica).
Lee la misma base viva del CRM (`crm/contratos_export.json`) y usa las mismas
plantillas Word reales (`crm/plantillas/`).

**Módulos:**

| Módulo | Qué hace |
|--------|----------|
| **Panel** | KPIs en vivo, estado del portafolio, vencimientos a 12 meses, valor por categoría, alertas urgentes y actividad reciente |
| **Pipeline** | Kanban del ciclo completo: Solicitud → En ejecución → Por vencer → Vencido → Terminado |
| **Contratos** | Repositorio central con búsqueda global, filtros por estado/categoría, listado y tarjetas; detalle con stepper de 5 fases y línea de tiempo |
| **Solicitudes** | Intake precontractual: la regla oficial (garantías o plazo > 30 días → contrato) decide la vía y enruta a La Mágica o a la Unidad Operativa |
| **Alertas** | Motor de reglas: vencidos, ventana de renovación (≤90 d), envíos pendientes a la UO, proveedores sin calificar |
| **Reportes** | Analítica por categoría/área/AC + exportación CSV del portafolio |
| **Mapa de áreas** | Mapa del Ecuador con las áreas protegidas que tienen contratos: cada círculo es un área, su tamaño el monto (o el n.º de contratos) y su color el estado más urgente; al tocar una se listan sus contratos y montos, con salida a CSV |
| **Bitácora** | Registro de auditoría de cada acción (autor, fecha, contrato) |
| **La Mágica / CRM clásico** | Las herramientas originales embebidas, completas y funcionales |

**Acciones del ciclo de vida** (desde el detalle del contrato, con las plantillas
oficiales): modificación con reglas 25 % (adenda) / 50 % (bloqueo) e informe
FAP-2026-11; terminación con causal y acta FAP-2026-12; calificación de proveedor
FO-AD-ABC-017 (13 criterios, 40/30/5/25) con CSV para el banco de calificaciones;
y envío a la Unidad Operativa por el mismo flujo de Power Automate
(`FLOW_DOCS_URL`) que usan La Mágica y el CRM.

El **Mapa de áreas** es autónomo como el resto del CLM: la silueta del país es un
trazado SVG incrustado (Natural Earth, dominio público) y las coordenadas de las
44 áreas protegidas viven en una tabla fija dentro del propio archivo, así que no
llama a ningún servicio de mapas —funciona igual en redes que bloquean CDNs y sin
internet—. La procedencia de cada coordenada, las variantes de nombre que el CLM
unifica y cómo agregar un área están en **[`clm/MAPA_AREAS.md`](clm/MAPA_AREAS.md)**.

**Roles de ingreso:** Administradora (AC), Área protegida o Unidad Operativa
(portafolio completo). El estado propio del CLM (solicitudes, terminaciones,
calificaciones, bitácora) se guarda en el navegador (`localStorage`).

## Centro de mando diario — herramienta personal

**`/centro/index.html`** es una herramienta **personal**, aparte del ciclo de vida de contratos:
no lee la base del CRM ni toca el CLM. Nace de un problema distinto — que las cosas se olvidan
porque viven repartidas entre Recordatorios, Microsoft To Do, Planner, los correos marcados y el
calendario — y las junta en **un solo lugar**.

**La idea:** cuatro plazos en vez de una lista infinita — *Hoy* (ahora), *Corto plazo* (esta
semana), *Mediano plazo* (este mes) y *Largo plazo* (algún día). Lo que tiene fecha **sube solo** de plazo
cuando se acerca, así que nada se queda escondido en «algún día», y la **revisión del día** obliga
a decidir, una por una, qué pasa con lo que se pasó de fecha (lo que ni Recordatorios ni To Do hacen:
ahí lo vencido se queda en rojo para siempre).

**Qué más trae:** captura en lenguaje natural (*«pagar el arriendo el viernes 9am»* se entiende sola,
con `#personal`/`#trabajo`/`#curso` y `cada semana`), agenda de ocho días, notas, exportación a
`.ics` para llevarte los pendientes a Recordatorios, copia de seguridad en JSON y atajos de teclado
(`/` capturar, `1`–`4` plazos, `r` revisión).

**Automatización con el trabajo:** un único flujo de Power Automate propio trae las tareas de
**To Do**, las de **Planner** asignadas a ti, los **correos marcados** de Outlook y las reuniones del
**calendario**; y devuelve a **To Do** lo que escribes aquí, para que la alarma suene donde ya suena
(celular, Outlook, reloj). El paso a paso está en **[`centro/CONECTAR.md`](centro/CONECTAR.md)**.

> Ojo con un detalle que define el diseño: To Do sí unifica los **correos marcados**, pero las tareas
> de **Planner** solo las *muestra* en «Asignadas a mí» (no las entrega por API) y el **calendario**
> nunca está ahí. Por eso el flujo lee tres conectores, no uno.

**Privacidad:** a diferencia del CRM/CLM, aquí **no se publica ningún dato**. Las tareas viven en el
navegador (`localStorage`) y viajan directo entre tu dispositivo y tu flujo; la URL del flujo se
guarda solo en tu navegador y nunca en el repositorio. Es una **PWA**: se instala en el celular
(*Compartir → Añadir a pantalla de inicio*) y en el escritorio, y funciona sin internet — lo que no
se pueda enviar se envía después.

GitHub Pages gratuito no permite sitios privados, así que la primera vez que abres `/centro/` en
cada dispositivo te pide **crear tu propia frase de acceso** (no se comparte con nadie ni sale de
ese navegador); sin ella nadie que encuentre el link ve nada. No es cifrado real —es una cortina,
no una caja fuerte—, pero cumple su función: nadie entra sin la frase, y como las tareas nunca se
publican, tampoco hay nada que robar aunque alguien la esquivara.

## Confirmación de renovaciones — la pantalla de las administradoras

**`/renovaciones/index.html`** es donde cada administrador/a contador/a entra, elige su nombre y ve
**sus contratos vigentes desplegados**, cada uno con su monto del año (adendas incluidas), el
proveedor y la fecha en que arrancaría el contrato de 2027. Para cada contrato responde una sola
pregunta, la que corresponde:

- **Si se puede renovar** — porque el contrato de 2026 se firmó como nuevo: *¿renuevas con el mismo
  proveedor, cambias de proveedor, o el área ya no necesita el servicio?*
- **Si necesita proceso nuevo** — porque ya renovó y el cupo está agotado: *¿contratación directa
  con el mismo proveedor, o comparación de precios?* Al elegir comparación aparece en pantalla lo
  que exige esa vía: mínimo tres invitaciones y Comisión de Calificación.

Lee la **misma base cifrada** que el CRM y el CLM (`crm/contratos_export.json`, que el robot diario
regenera), con la misma frase de acceso, así que no hay una segunda lista que mantener. Las
decisiones se guardan solas en el navegador mientras trabaja —puede cerrar y volver— y salen por
dos vías: **descargando un CSV** que responde por correo, o **enviándose a Power Automate** si se
configura `FLOW_URL` en el archivo. Sin flujo configurado la pantalla funciona igual: el CSV no
depende de nada.

## Plan de renovaciones 2027

**[`plan/PLAN_RENOVACIONES_2027.md`](plan/PLAN_RENOVACIONES_2027.md)** responde, contrato por
contrato, la pregunta que ordena el año: **¿se puede renovar, o hay que hacer un nuevo proceso
administrativo?** El FIAS permite renovar una sola vez, así que de los 128 contratos activos de
servicios recurrentes de áreas protegidas **39 se pueden renovar y 89 no**: esos salen por
contratación directa, con el criterio de proveedor calificado y recurrencia del servicio.
Después de ese corte se sumó un contrato de comunicación con posibilidad de renovación, así que
el universo vigente es de **129 contratos: 40 renovables y 89 procesos nuevos**.

La meta es el expediente, no la firma. **El PAG se aprueba en promedio hasta el 15 de enero**, y
sin PAG no se puede suscribir ni pedir una cotización en firme, porque es el PAG el que fija el
presupuesto de cada área. Por eso el plan separa los documentos que no necesitan el monto (bloque
1, septiembre a diciembre) de los que sí (bloque 2), reparte los 128 expedientes en 13 semanas con
un cupo de 10 —el orden no adelanta la firma, pero define el puesto en la fila del 15 de enero en
adelante— y trae ocho medidas para bajar el tiempo de revisión.

La simulación, calibrada contra los tiempos reales de 2026, estima cuándo saldría firmado cada
contrato: con el plan y 13 firmas semanales, la última firma pasa de junio a marzo y la
retroactividad mediana de 80 a 42 días.

Las administradoras responden por **Microsoft Forms**, con un enlace por contrato que ya lleva el
número, el área y el detalle rellenados: las respuestas caen solas en un Excel y el script las
cruza con el plan, sin transcribir nada. Funciona con el Microsoft 365 básico —sin conectores
premium, sin disparador HTTP y sin permisos de IT— y el montaje está en
**[`plan/FORMULARIO_CONFIRMACION.md`](plan/FORMULARIO_CONFIRMACION.md)**.

El anexo operativo —maestro contrato por contrato, calendario, carga por administradora, la
simulación y los 20 correos de consulta ya redactados, cada uno con sus dos listas y sus botones de
confirmación— **no se versiona**: el repositorio es público y lleva datos de contratos. Se regenera cuando se necesita:

```bash
python3 scripts/plan_renovaciones.py <Sistema_Alertas_Contratos_FIAS.xlsx> <carpeta_salida>
```

## Planificador adaptativo — planificar por rutas alternas

**`/planificador/index.html`** es la herramienta general de planificación. Nace del plan de
renovaciones 2027, pero no está atada a ese caso: maneja **varios planes**, con distintos métodos,
y no depende de un Excel.

Aplica el método de **rutas adaptativas** (*Dynamic Adaptive Policy Pathways*, la formalización
del ciclo de adaptación que usa la UICN). La idea de fondo: un plan a un año no falla de golpe,
se va desviando, y para no descubrirlo tarde hay que decidir **por anticipado** qué se mide, en
qué valor se cambia de estrategia y cuánto tarda ese cambio en montarse.

| Concepto | Qué es | Ejemplo en renovaciones 2027 |
|---|---|---|
| **Señal** | Lo que se mide para saber si el plan sigue sirviendo | Cobertura de respuesta de las administradoras |
| **Disparador** | El valor en que hay que **empezar a preparar** la ruta alterna | Bajo 80 % |
| **Punto de no retorno** | El valor en que la estrategia actual ya dejó de servir | Bajo 60 % |
| **Ruta alterna** | A qué se cambia | Extender el plazo y escalar al responsable del área |
| **Tiempo de preparación** | Cuánto tarda esa ruta en estar operando | 7 días |

**Qué hace, que un Excel no hace:**

- **Navega por etapa.** Se entra a una etapa y se ve solo lo suyo —su narrativa, sus señales, sus
  hitos, sus alertas—, no las seis a la vez. El *Panel general* da la vista completa.
- **Las rutas se arman solas.** Cada ruta queda enganchada a una señal: cuando esa señal cruza el
  disparador la ruta pasa a *armada*, y al cruzar el no retorno a *activada*. Nadie tiene que
  acordarse de revisarlas. Se pueden fijar a mano cuando hace falta.
- **Calcula la fecha límite para decidir**, que es la fecha en que la ruta debe estar operando
  menos su tiempo de preparación. Es el número que se pasa sin que nadie se dé cuenta: si una ruta
  toma 45 días en montarse y debe operar el 1 de diciembre, la decisión se toma el 17 de octubre,
  no en noviembre.
- **Avisa cuando la señal avisaría tarde.** Con el historial de mediciones proyecta cuándo se
  cruzaría el disparador; si esa fecha cae después de la fecha límite para decidir, lo dice: hay
  que medir más seguido o adelantar el disparador.
- **Reclama las mediciones vencidas.** Cada señal declara su cadencia y la herramienta marca las
  que llevan demasiado sin medirse.
- **Guarda el historial** de cada medición con su fecha, con tendencia y minigráfico.
- **Cierra etapas** dejando la entrada automática en la bitácora, y al cerrar la última reabre el
  ciclo.

**Métodos que trae:** ciclo de planificación adaptativa (6 etapas), PHVA (4), campaña
administrativa (4) y uno libre de una sola etapa. Las etapas se renombran y un plan se puede
**duplicar como plantilla** —conserva estructura, pone las mediciones en cero— para el ciclo
siguiente o para otro caso.

**Dónde viven los datos:** en el navegador (`localStorage`), como el resto de las herramientas.
No hay servidor. Para respaldar, compartir o abrir un plan en otra máquina se **exporta a JSON**;
también exporta **CSV** para informes e imprime a PDF. Trae precargado el plan de **Renovaciones
FAP 2027** con sus cifras agregadas; el detalle contrato por contrato no está aquí, por la misma
razón que en el resto del repositorio.

## Estructura

- **`/planificador/`** — Planificador adaptativo: planes por rutas alternas, con señales,
  disparadores y tiempos de preparación. Independiente del resto; los planes se guardan en el
  navegador y se exportan a JSON.
- **`/centro/`** — Centro de mando diario, herramienta personal (independiente del resto).
- **`/crm/`** — CRM de Contratos para Administradoras Contadoras (ACs). Publicado en GitHub Pages.
  Se actualiza automáticamente cada día vía Power Automate, que sobrescribe `crm/contratos_export.json`
  con los datos del Excel maestro. La app lo consulta automáticamente al abrirse.
- **`/generador/`** — La Mágica: generador de documentos precontractuales para las ACs
  (`generador/index.html`, con las plantillas Word embebidas). Cubre captura del proceso por
  momentos, generación de documentos y registro central vía Power Automate.
  Cuando un proceso **no se puede resolver con orden de compra/servicio** (va por contrato:
  garantías de anticipo/fiel cumplimiento o plazo mayor a 30 días), la vista **Documentos**
  habilita el botón **"Enviar a la Unidad Operativa"**, que abre un formulario ya prellenado
  con los datos del proceso para adjuntar los archivos y subirlos a un flujo de Power Automate
  (subida de documentos a revisión). La URL de ese flujo se configura en la constante
  `FLOW_DOCS_URL` dentro de `generador/index.html`.

## URL pública

Cada herramienta tiene su propio enlace en GitHub Pages:

- **CLM (plataforma unificada):** https://[tu-usuario].github.io/fap-contratos/clm/
- Confirmación de renovaciones 2027 (para las ACs): https://[tu-usuario].github.io/fap-contratos/renovaciones/
- Planificador adaptativo: https://[tu-usuario].github.io/fap-contratos/planificador/
- Calificador de Ofertas: https://[tu-usuario].github.io/fap-contratos/calificacion/
- CRM directo: https://[tu-usuario].github.io/fap-contratos/crm/
- La Mágica: https://[tu-usuario].github.io/fap-contratos/generador/
- Centro de mando diario (personal): https://[tu-usuario].github.io/fap-contratos/centro/

La raíz (`https://[tu-usuario].github.io/fap-contratos/`) redirige automáticamente al CLM.

## Actualización de datos

El archivo `crm/contratos_export.json` NO se edita a mano. Lo sobrescribe el robot de GitHub Actions
(`scripts/actualizar_datos.py`) todas las mañanas a partir de la hoja "Export" del Excel maestro. Si el
flujo falla, la AC puede seguir usando el botón "Actualizar base desde Excel" dentro de la app como
respaldo manual.

## Seguridad de los datos (frase de acceso)

Como el sitio es estático y público, los datos NO se publican en claro: se cifran con **AES-256-GCM**
(clave derivada de una frase de acceso con PBKDF2-SHA256). Esto aplica al `contratos_export.json` diario
y a las copias embebidas (`seed-data` del CLM, `EMBEDDED` del CRM). Quien abra los archivos sin la frase
solo ve un bloque cifrado ilegible.

- **Al entrar**, el CLM/CRM piden la **frase de acceso** una sola vez; queda guardada en el navegador
  (`localStorage`) y el descifrado ocurre localmente con WebCrypto. Nada de servidores nuevos ni librerías externas.
- **El robot diario** cifra con el secreto **`DATA_KEY`** (repositorio → *Settings → Secrets and variables →
  Actions*). Debe valer **exactamente la misma frase** que usan las ACs. Sin ese secreto, el robot no publica
  (falla a propósito) para no exponer datos en claro.
- **Rotar la frase:** cambia el valor de `DATA_KEY`, vuelve a cifrar las copias embebidas y avisa la nueva
  frase al equipo.

> Alcance: la frase es compartida por el equipo (no es login por persona), así que protege contra
> quien encuentre los archivos, no contra quien tenga la frase.
>
> **Historial:** revisado el 2 de septiembre de 2026 commit por commit — ningún commit del
> repositorio contiene datos de contratos en claro, ni en `contratos_export.json` ni en las copias
> embebidas. La advertencia anterior sobre versiones en claro en el historial estaba desactualizada.
>
> **El punto débil real** es otro: el bloque cifrado es público, así que se puede atacar por fuerza
> bruta sin conexión y sin que nadie se entere. Los 250 000 ciclos de PBKDF2 encarecen cada intento,
> pero no salvan una frase corta o predecible. La frase debe ser larga —cuatro o cinco palabras al
> azar— y conviene rotarla cuando alguien deja el equipo.
