# Tags de las plantillas del acta de adjudicación

El botón **Acta Word** del Calificador rellena estas plantillas con `docxtemplater`.
**Las dos actas reciben exactamente los mismos datos**, así que cualquier tag de esta
lista sirve en cualquiera de las dos plantillas (o en una que armes tú en Word).

Para cambiar el formato: edita el `.docx` en Word conservando los tags y reemplaza el
archivo en esta carpeta (GitHub) — igual que las plantillas de La Mágica.

## Reglas de oro (bucles)

1. **Repetir una fila de tabla** (una fila por oferente/miembro): el tag de apertura
   `{#lista}` va al **inicio de la primera celda** y el de cierre `{/lista}` al **final
   de la última celda de esa misma fila**. Word repite la fila completa por cada elemento.
2. **Repetir un bloque** (título + tabla + párrafos): `{#lista}` y `{/lista}` van cada
   uno **solos en su propio párrafo**, antes y después del bloque. Todo lo que quede en
   medio se repite.
3. **Word no puede agregar columnas dinámicamente** (solo filas y bloques). Por eso las
   tablas por oferente van con **una fila por oferente**, no una columna.

## Datos del proceso (tags simples)

| Tag | Contenido |
|-----|-----------|
| `{actaNo}` | Número de acta |
| `{objeto}` | Objeto de la contratación |
| `{area}` | Área protegida / instancia beneficiaria |
| `{modalidad}` | Modalidad de selección |
| `{presupuesto}` / `{presupuestoLetras}` | Presupuesto referencial en cifras / en letras |
| `{partida}` | Fuente de financiamiento (PAG/subcuenta/componente) |
| `{lineaNombre}` | Línea presupuestaria compuesta: código + nombre (p. ej. "2.2 Adquisición de motores y canoas") — se arma sola a partir de `lineaCod`+`lineaNom` |
| `{lineaCod}` / `{lineaNom}` | Línea presupuestaria por separado — código (p. ej. "2.2") y nombre, igual que en La Mágica |
| `{fechaInvitacion}` / `{fechaLimite}` | Fechas de invitación y límite de ofertas |
| `{fechaSesion}` (= `{fechaAdj}`) / `{horaSesion}` / `{lugarSesion}` | Sesión de la Comisión |
| `{memoNro}` / `{fechaInicio}` | Memorando/resolución de inicio y su fecha |
| `{umbral}` / `{tecMax}` | Umbral técnico y máximo técnico (por puntos) |
| `{pesoEco}` / `{puntosTotal}` | Puntos de la oferta económica / total del proceso |
| `{jefe}` / `{ac}` | Nombre del Presidente/a y del Secretario/a (AC) |

## Bucles (listas)

### `{#comision}…{/comision}` — todos los miembros
Campos: `{nombre}`, `{cargo}`, `{rol}`.

### `{#items}…{/items}` — solo los miembros intermedios (sin Presidente ni Secretario)
Campos: `{miembros}` (nombre), `{cargo}`, `{rol}`. Es la fila del quórum del formato
oficial: Presidente y Secretario tienen su fila fija con `{jefe}` y `{ac}`, y esta fila
se repite por cada miembro adicional agregado en la herramienta.

### `{#provs}…{/provs}` — ofertas recibidas
Campos: `{razon}` (razón social), `{fof}` (fecha de entrega, vacío para llenar a mano).

### `{#tecnicos}…{/tecnicos}` — evaluación técnica (una entrada por oferente)
- Acta **por puntos**: `{razon}`, `{tecnico}` (puntaje), `{umbralRes}` (Pasa / No pasa).
- Acta **Cumple/No cumple**: `{razon}`, `{resultado}` (CALIFICA / NO CALIFICA) y el bucle
  anidado `{#reqs}…{/reqs}` con `{req}` (requisito) y `{res}` (Cumple / No cumple / —).

### `{#economicos}…{/economicos}` — solo oferentes calificados
Campos: `{razon}`, `{sinIva}`, `{iva}`, `{total}`, `{difPresupuesto}` (diferencia con el
referencial), `{enPresupuesto}` (Sí / No), `{puntajeEco}`, `{puntajeTotal}`.

### `{#prelacion}…{/prelacion}` — orden de prelación (ya ordenado)
Campos: `{orden}`, `{razon}`, `{tec}`, `{eco}`, `{totalPts}`.
Por puntos: puntajes y total; Cumple/No cumple: ordenado por menor precio.

## Adjudicación

| Tag | Contenido |
|-----|-----------|
| `{proveedor}` / `{proveedorRuc}` | Adjudicatario y su RUC |
| `{montoTotal}` / `{montoLetras}` | Monto adjudicado en cifras / en letras |

## Compatibilidad con el formato anterior

`{monto1}`, `{monto2}`, `{monto3}` (precios de los 3 primeros oferentes) se siguen
enviando por si alguna plantilla vieja los usa, pero conviene migrar a `{#economicos}`.
