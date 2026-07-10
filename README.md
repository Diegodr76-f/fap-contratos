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
  Genera contratos, convenios y actas en Word a partir de plantillas con variables
  `{{asi}}`. Está pensado para la campaña de inicio de año:
  - **Toma los datos del registro de contratos** (`crm/contratos_export.json`): se elige
    el contrato y se llenan solos número, proveedor, objeto, área, monto, plazo y fechas.
  - **Lote**: se marcan varios contratos del registro (o se pegan filas desde Excel) y se
    descargan todos los Word de una vez en un ZIP.
  - **Contrapartes**: directorio local de proveedores/instituciones (con validación de
    cédula/RUC) para no volver a tipear sus datos.
  - **Repositorio de variables**: diccionario único del ecosistema FAP, sembrado desde el
    Catálogo de Tags (los mismos tags docxtemplater de las 15 plantillas Word de La Mágica
    y los campos del CRM: `{area}`, `{proveedor}`, `{proveedorRuc}`, `{contratoNro}`,
    `{montoTotal}`…). Las variables se insertan siempre desde este repositorio (botón
    «{{ Variable }}», con buscador), cada una define su tipo (texto/número/fecha/letras),
    descripción y ejemplo que guían el formulario, y se pueden registrar nuevas. Las
    plantillas y cláusulas semilla usan estos nombres canónicos, así el registro del CRM
    las llena sin mapeos manuales.
  - **Repositorio de cláusulas**: cláusulas aprobadas organizadas por categoría, cada una
    con variantes (p. ej. garantía con letra de cambio vs. garantía técnica). Se insertan
    con 📋 en la plantilla o en el documento final (donde sus variables se llenan solas con
    los datos del formulario); 📌 guarda el texto seleccionado de cualquier documento como
    variante nueva, y 🔢 renumera las cláusulas (PRIMERA, SEGUNDA…) tras insertar o quitar.
  - **Editar documento final**: tras llenar el formulario se puede retocar a mano el texto
    exacto que se descargará, con barra completa de formato (tablas, sangrías, mayúsculas).
  - **Membrete institucional (🖼)**: se sube una vez la imagen con los logos (FAP/FIAS) y una
    línea de texto opcional con variables (p. ej. `CONTRATO-{{contratoNro}}`), y todos los
    Word —individuales y del lote— salen con un encabezado real de Word que se repite en
    todas las páginas, con el número propio de cada documento.
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
