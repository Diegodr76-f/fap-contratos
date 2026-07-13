# FAP Contratos — FIAS

Herramientas internas del Fondo de Áreas Protegidas (FAP / FIAS) para la gestión del ciclo de vida de contratos.

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
- **`/instrumentos/`** — Generador de Instrumentos Legales para la Unidad Legal
  (`instrumentos/index.html`, funciona también abierto como archivo local, sin conexión).
  Genera contratos, convenios y actas en Word. **El modo principal son plantillas Word
  reales** (.docx etiquetados con `{tags}`, mismo motor docxtemplater que La Mágica): el
  formato —colores, listas a/b/c, numeración, membrete, tablas, estilos— se edita en Word
  y la herramienta solo rellena los tags. Incluye como semillas los .docx etiquetados del
  repositorio (informe de adenda y acta de terminación); se suben nuevas plantillas con
  «⬆ Plantilla Word» y se actualizan con descarga → edición en Word → subida. Soporta
  secciones opcionales `{#tag}…{/tag}` (casilleros al generar, para cláusulas con
  variantes) y tablas repetibles `{#items}` con subtotal/IVA/total automáticos, con vista
  previa del Word renderizada en pantalla. Las plantillas HTML (editor integrado, formato
  limitado) siguen disponibles como modo secundario para documentos rápidos.
  Está pensado para la campaña de inicio de año:
  - **Toma los datos del registro de contratos** (`crm/contratos_export.json`): se elige
    el contrato y se llenan solos número, proveedor, objeto, área, monto, plazo y fechas.
  - **Lote**: se marcan varios contratos del registro (o se pegan filas desde Excel) y se
    descargan todos los Word de una vez en un ZIP.
  - **Contrapartes**: directorio local de proveedores/instituciones (con validación de
    cédula/RUC) para no volver a tipear sus datos, con buscador por nombre, RUC/cédula,
    representante o correo.
  - **Repositorio de variables**: diccionario único del ecosistema FAP, sembrado desde el
    Catálogo de Tags (los mismos tags docxtemplater de las 15 plantillas Word de La Mágica
    y los campos del CRM: `{area}`, `{proveedor}`, `{proveedorRuc}`, `{contratoNro}`,
    `{montoTotal}`…). Las variables se insertan siempre desde este repositorio (botón
    «{{ Variable }}», con buscador por palabras que también está en la pestaña
    Variables), cada una define su tipo (texto/número/fecha/letras),
    descripción y ejemplo que guían el formulario, y se pueden registrar nuevas. Las
    plantillas y cláusulas semilla usan estos nombres canónicos, así el registro del CRM
    las llena sin mapeos manuales.
  - **Grupos de concordancia (cuadros combinados)**: una sola elección al llenar gobierna
    varias palabras a la vez en todo el documento. P. ej. al indicar si el/la contratista
    es persona natural masculino, femenino o empresa, cambian juntas todas las apariciones
    de `{{elLaContratista}}`, `{{contratistaTrato}}` (señor/señora/compañía),
    `{{contratistaDomiciliado}}`… (el «cambio uno → cambian todos» que Word no da por
    interfaz). Vienen sembrados grupos base (contratista, administrador/a del contrato,
    oferente) editables, y se crean nuevos desde la pestaña **Variables → Grupos de
    concordancia** (defines las opciones y, por cada tag, la palabra en cada opción). Los
    tags gobernados quedan en el repositorio para insertarlos con «{{ Variable }}».
  - **Repositorio de cláusulas**: cláusulas aprobadas organizadas por categoría, cada una
    con variantes (p. ej. garantía con letra de cambio vs. garantía técnica). Se insertan
    con 📋 en la plantilla o en el documento final (donde sus variables se llenan solas con
    los datos del formulario); 📌 guarda el texto seleccionado de cualquier documento como
    variante nueva, y 🔢 renumera las cláusulas (PRIMERA, SEGUNDA…) tras insertar o quitar.
    Las cláusulas insertadas con 📋 en una plantilla quedan **vinculadas**: si la cláusula
    se corrige en el repositorio, la herramienta ofrece actualizarla en todas las plantillas
    que la usan (y si en alguna fue editada a mano, pregunta si reemplazar o conservar esa
    versión). Los valores rellenados heredan el formato de la plantilla (negrita solo si la
    variable estaba en negrita) y los montos salen con formato de miles (USD 1.000,00).
  - **Editar documento final**: tras llenar el formulario se puede retocar a mano el texto
    exacto que se descargará, con barra completa de formato (tablas, sangrías, mayúsculas).
  - **Motor nativo de Word**: los instrumentos redactados con plantillas HTML se
    construyen con las piezas reales de Word (párrafos, numeración `numbering.xml`,
    tablas y estilos OOXML), no traduciendo HTML. Las viñetas y numeraciones del
    documento descargado son listas de Word de verdad: se pueden mover, dar Enter y
    continúa la numeración, igual que en las plantillas de La Mágica. Estilo
    institucional: Titillium Web 10pt negro, justificado, cláusulas en negrita.
  - **Papel membretado oficial (🖼)**: los instrumentos salen **sobre el papel
    membretado oficial** del FIAS/FAP. Se sube una vez el `.docx` con el membrete ya
    montado (logos, pie de página con numeración y márgenes reales) — viene sembrado el
    «Formato de contrato FIAS-FAP» y activo por defecto — y el contenido se vierte
    dentro de su cuerpo conservando encabezado, pie y márgenes. Aplica a los Word
    individuales y a los del lote. Como alternativa para casos rápidos se conserva el
    **membrete simple**: una imagen de logos y una línea de texto opcional con variables
    (p. ej. `CONTRATO-{{contratoNro}}`), con alineación y tamaño ajustables.
  - **Datos fijos** (representante FIAS, lugar…) que se escriben una sola vez, sugerencia
    automática del siguiente número correlativo y montos en letras calculados solos.
  Las rutas donde busca el registro se configuran en la constante `RUTAS_REGISTRO`
  dentro de `instrumentos/index.html`.

## URL pública

https://[tu-usuario].github.io/fap-contratos/crm/

## Actualización de datos

El archivo `crm/contratos_export.json` NO se edita a mano. Lo sobrescribe el flujo de Power Automate
todas las mañanas a partir de la hoja "Export" del Excel maestro. Si el flujo falla, la AC puede seguir
usando el botón "Actualizar base desde Excel" dentro de la app como respaldo manual.
