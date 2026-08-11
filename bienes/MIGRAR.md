# Pasar la matriz histórica a la Lista de SharePoint (flujo de Power Automate)

Esto se hace **una sola vez**: mover los 502 activos fijos y los 754 bienes de
control que ya existen en el Excel hacia la Lista de SharePoint. De ahí en
adelante los bienes nuevos entran solos por el formulario (eso es
[`CONECTAR.md`](CONECTAR.md), parte 2).

Se usa un flujo en vez del botón «importar desde Excel» porque ese botón, con
tablas grandes, **se detiene en la primera fila que no le cuadra** y deja el
resto afuera (en la prueba real entraron 197 de 502). El flujo, en cambio, va
fila por fila: si una falla, sigue con las demás y al final se ve cuáles
quedaron.

> **Archivo a usar:** `MATRIZ_BIENES_TODO_TEXTO.xlsx`. Todo va como texto y las
> fechas en formato `AAAA-MM-DD`, que es justo lo que la herramienta sabe leer.
> Así no hay ningún valor que SharePoint pueda rechazar por tipo. Súbelo a
> OneDrive antes de empezar.

---

## Antes de empezar: vaciar lo que quedó a medias

La lista `Activos FAP` tiene 197 filas de la importación que se cortó. Si no se
borran, el flujo agrega las 502 encima y quedan duplicados.

1. Abre la lista → cambia a la vista de **lista** (no cuadrícula).
2. Marca la casilla del encabezado (selecciona todos los de la página).
3. **Eliminar**. Repite hasta vaciarla — SharePoint borra de a 100, así que son
   dos o tres vueltas.

---

## 1. Crear el flujo

[make.powerautomate.com](https://make.powerautomate.com) → **Crear** → **Flujo
de nube instantáneo** → disparador **«Desencadenar manualmente un flujo»** →
**Crear**.

## 2. Leer las filas del Excel

**+ Nuevo paso** → busca **«Enumerar filas presentes en una tabla»** (Excel
Online para empresas).

- **Ubicación**: OneDrive de la empresa
- **Biblioteca de documentos**: OneDrive
- **Archivo**: `MATRIZ_BIENES_TODO_TEXTO.xlsx`
- **Tabla**: `TActivos`

### ⚠️ El paso que más se olvida: la paginación

Sin esto, el flujo lee **solo las primeras 256 filas** y parece que funcionó.

1. En ese mismo paso, clic en los **tres puntos (…)** de la esquina superior derecha.
2. **Configuración**.
3. Activa **«Paginación»**.
4. En **«Umbral»** escribe `5000`.
5. **Listo**.

## 3. Crear un elemento por fila

**+ Nuevo paso** → **«Crear elemento»** (SharePoint).

- **Dirección del sitio**: `https://fiasec-my.sharepoint.com/personal/administrativofap_fias_org_ec`
  (solo el sitio — **sin** `/Lists/...` al final)
- **Nombre de lista**: `Activos FAP`

Al agregar este paso, Power Automate lo mete solo dentro de un **«Aplicar a cada
uno»**. Eso está bien, es lo que se busca.

### Que no se detenga si una fila falla

1. Clic en los **tres puntos (…)** del paso **«Crear elemento»**.
2. **Configurar ejecución después** (*Configure run after*).
3. Marca también **«ha fallado»** y **«se ha omitido»**.

Así una fila con un problema no tumba las otras 501.

### Que no tarde una eternidad

1. Clic en los **tres puntos (…)** del **«Aplicar a cada uno»** (el contenedor).
2. **Configuración** → activa **«Control de simultaneidad»** → mueve el
   deslizador a **20**.

Sin esto va de una en una (unos 10 minutos); con esto baja a uno o dos.

## 4. Mapear las columnas

En **«Crear elemento»** aparecen las columnas de la lista. A cada una se le
asigna el contenido dinámico del **mismo nombre** — por eso conviene ir en
orden, es mecánico: buscas el nombre en el panel de contenido dinámico y lo
insertas.

| # | Columna | # | Columna |
|---|---|---|---|
| 1 | CODIGO | 23 | ASEGURADO (SI/NO) |
| 2 | DESCRIPCIÓN | 24 | INICIO SEGURO |
| 3 | DESCRIPCIÓN(ADICIONAL) | 25 | FIN SEGURO |
| 4 | CANTIDAD | 26 | ASEGURADORA |
| 5 | TIPO DE BIEN SEGUROS | 27 | NRO DE POLIZA |
| 6 | TIPO DE BIEN  SISTEMA CONTABLE | 28 | GARANTIA TECNICA (SI-NO-N/A) |
| 7 | PROYECTO (FIAS-FEIG-…) | 29 | INICIO GARANTIA (FECHA) |
| 8 | FECHA DE COMPRA (DD/MM/AAA) | 30 | FIN DE GARANTIA (FECHA) |
| 9 | DONANTE | 31 | ESTADO DE GARANTIA (VIGENTE-CADUCADA-NA) |
| 10 | PROVEEDOR | 32 | Estado físico detallado (BUENO-MALO-REGULAR) |
| 11 | RUC DE PROVEEDOR | 33 | Vida útil estimada (AÑOS) |
| 12 | N° Factura *001-001-0001*/ACTA DE DON ACIÓN | 34 | Depreciación Lineal Anual (Campo Automatico) |
| 13 | FACTURA DIGITAL | 35 | Depreciación Acumulada (Campo Automatico) |
| 14 | VALOR DEL BIEN(INC.IMP) | 36 | Depreciación Acumulada Diciembre |
| 15 | MARCA | 37 | Depreciación Mensual (Campo Automatico) |
| 16 | MODELO | 38 | Valor residual (Campo Automatico) |
| 17 | NUMERO DE SERIE | 39 | Valor residual diciembre 2025 |
| 18 | CEDULA CUSTODIO | 40 | Fecha de baja (SI APLICA) |
| 19 | NOMBRES Y APELLIDOS CUSTODIO | 41 | Motivo de baja (SI APLICA) |
| 20 | INSTITUCIÓN | 42 | OBSERVACIONES |
| 21 | UBICACIÓN | 43 | Fotografía del bien (link en share point) |
| 22 | ACTA ENTREGA  (link de share point) | 44 | **sigla** |

> **Las columnas de depreciación (34 a 39) se pueden dejar vacías** si se quiere
> ahorrar seis mapeos: la herramienta las recalcula sola cada vez que se abre,
> con corte del día. En el Excel esos números están congelados a fechas
> distintas (ver [`MATRIZ.md`](MATRIZ.md), sección 4), así que no se pierde nada
> bueno.

> **`sigla` es la que hace que cada AC vea solo lo suyo.** Esa no se puede saltar.

## 5. Ejecutar

**Guardar** → **Probar** → **Manualmente** → **Probar** → **Ejecutar flujo**.

Cuando termine, abre la lista y revisa el conteo: deben ser **502**. Si alguna
fila falló, en el historial del flujo («Ejecuciones») se ve cuál y por qué.

## 6. Repetir para bienes de control

Lo mismo, cambiando dos cosas:

- En «Enumerar filas», **Tabla**: `TBienescontrol`
- En «Crear elemento», la lista de bienes de control (hay que crearla primero,
  igual que se creó `Activos FAP`)

Deben quedar **754**.

---

## Después de migrar

Vale la pena revisar dos columnas en la configuración de la lista:

- **`DESCRIPCIÓN(ADICIONAL)`** debería ser *varias líneas de texto*: hay 37
  bienes con descripciones de más de 255 caracteres (una llega a 1.022) y una
  columna de una línea las corta.
- **`Código QR`**: se puede borrar. La herramienta genera el QR sola, en el
  navegador; el del Excel nunca funcionó.

Y quedan **5 fechas** que no se pudieron reparar porque eran ambiguas
(`31/12/202`, `31/07/206`, `5/11/206`, `27/08/219`, `04/0-2020`). Están vacías;
son cinco celdas para corregir a mano cuando haya tiempo.
