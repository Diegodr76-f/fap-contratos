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
  (botón *Acta Word*), que rellena la plantilla oficial `plantillas/Acta_de_adjudicacion.docx` con el
  mismo motor docxtemplater que usa La Mágica. Presupuesto y monto adjudicado se expresan también en letras.
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
| **Bitácora** | Registro de auditoría de cada acción (autor, fecha, contrato) |
| **La Mágica / CRM clásico** | Las herramientas originales embebidas, completas y funcionales |

**Acciones del ciclo de vida** (desde el detalle del contrato, con las plantillas
oficiales): modificación con reglas 25 % (adenda) / 50 % (bloqueo) e informe
FAP-2026-11; terminación con causal y acta FAP-2026-12; calificación de proveedor
FO-AD-ABC-017 (13 criterios, 40/30/5/25) con CSV para el banco de calificaciones;
y envío a la Unidad Operativa por el mismo flujo de Power Automate
(`FLOW_DOCS_URL`) que usan La Mágica y el CRM.

**Roles de ingreso:** Administradora (AC), Área protegida o Unidad Operativa
(portafolio completo). El estado propio del CLM (solicitudes, terminaciones,
calificaciones, bitácora) se guarda en el navegador (`localStorage`).

## Estructura

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
- Calificador de Ofertas: https://[tu-usuario].github.io/fap-contratos/calificacion/
- CRM directo: https://[tu-usuario].github.io/fap-contratos/crm/
- La Mágica: https://[tu-usuario].github.io/fap-contratos/generador/

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

> Alcance: la frase es compartida por el equipo (no es login por persona). Protege los datos *publicados*
> de aquí en adelante; el historial de git anterior a esta protección aún contiene versiones en claro.
