# FAP Contratos — FIAS

Herramientas internas del Fondo de Áreas Protegidas (FAP / FIAS) para la gestión del ciclo de vida de contratos.

## Contract Lifecycle Management (portada única)

**`/index.html`** es el punto de entrada unificado: una portada que **aúna todas las
herramientas** en un solo lugar. Presenta el ciclo de vida completo del contrato en seis
fases y enruta cada una a la herramienta responsable, además de mostrar un **tablero en
vivo** (KPIs y alertas) calculado desde `crm/contratos_export.json`.

| Fase | Herramienta |
|------|-------------|
| 1 · Precontractual | La Mágica (`/generador/`) |
| 2 · Contratación y formalización | La Mágica → Unidad Operativa |
| 3 · Ejecución y seguimiento | CRM (`/crm/`) |
| 4 · Modificaciones (adendas) | CRM |
| 5 · Terminación y liquidación | CRM |
| 6 · Calificación del proveedor | CRM |

Se publica en la raíz de GitHub Pages, así que la URL del proyecto abre directamente
esta portada; desde ahí se navega a cada herramienta.

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

Portada (Contract Lifecycle Management): https://[tu-usuario].github.io/fap-contratos/
CRM directo: https://[tu-usuario].github.io/fap-contratos/crm/

## Actualización de datos

El archivo `crm/contratos_export.json` NO se edita a mano. Lo sobrescribe el flujo de Power Automate
todas las mañanas a partir de la hoja "Export" del Excel maestro. Si el flujo falla, la AC puede seguir
usando el botón "Actualizar base desde Excel" dentro de la app como respaldo manual.
