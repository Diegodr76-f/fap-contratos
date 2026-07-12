# FAP Contratos — FIAS

Herramientas internas del Fondo de Áreas Protegidas (FAP / FIAS) para la gestión del ciclo de vida de contratos.

## Estructura

- **`/crm/`** — CRM de Contratos para Administradoras Contadoras (ACs). Publicado en GitHub Pages.
  Se actualiza automáticamente cada día vía Power Automate, que sobrescribe `crm/contratos_export.json`
  con los datos del Excel maestro. La app lo consulta automáticamente al abrirse.
  Incluye la pestaña **Proveedores**: directorio armado a partir de los contratos de la base
  (contratos, montos acumulados, áreas y categorías por proveedor), con ficha por proveedor,
  historial de calificaciones (FO-AD-ABC-017) y marca de **no elegible** cuando la última
  calificación es menor a 70/100. Las calificaciones se guardan en el navegador de la AC
  (`localStorage`) y la fila CSV exportada alimenta el Registro de Calificaciones compartido.
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

https://[tu-usuario].github.io/fap-contratos/crm/

## Actualización de datos

El archivo `crm/contratos_export.json` NO se edita a mano. Lo sobrescribe el flujo de Power Automate
todas las mañanas a partir de la hoja "Export" del Excel maestro. Si el flujo falla, la AC puede seguir
usando el botón "Actualizar base desde Excel" dentro de la app como respaldo manual.
