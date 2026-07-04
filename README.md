# FAP Contratos — FIAS

Herramientas internas del Fondo de Áreas Protegidas (FAP / FIAS) para la gestión del ciclo de vida de contratos.

## Estructura

- **`/crm/`** — CRM de Contratos para Administradoras Contadoras (ACs). Publicado en GitHub Pages.
  Se actualiza automáticamente cada día vía Power Automate, que sobrescribe `crm/contratos_export.json`
  con los datos del Excel maestro. La app lo consulta automáticamente al abrirse.
- **`/generador/`** — (reservado) Migración futura de La Mágica (generador de documentos precontractuales)
  al mismo sitio, para que todo el ciclo de vida del contrato viva en un solo lugar.

## URL pública

https://[tu-usuario].github.io/fap-contratos/crm/

## Actualización de datos

El archivo `crm/contratos_export.json` NO se edita a mano. Lo sobrescribe el flujo de Power Automate
todas las mañanas a partir de la hoja "Export" del Excel maestro. Si el flujo falla, la AC puede seguir
usando el botón "Actualizar base desde Excel" dentro de la app como respaldo manual.
