# Tags de las plantillas del acta

El botón **Acta Word** del Calificador rellena la plantilla que corresponde al esquema,
con `docxtemplater`. Para cambiar el formato: edita el `.docx` en Word conservando los
`{tags}` y reemplaza el archivo en esta carpeta (GitHub) — igual que las plantillas de La
Mágica. Un tag que agregues sin que la herramienta lo envíe queda en blanco (no rompe nada).

## Reglas de oro (bucles)

1. **Repetir una fila de tabla**: `{#lista}` al inicio de la primera celda y `{/lista}` al
   final de la última celda de esa misma fila. Word repite la fila por cada elemento.
2. **Repetir un bloque** (título + tabla + párrafos): `{#lista}` y `{/lista}` cada uno solo
   en su párrafo, antes y después del bloque.
3. **Word no repite columnas dinámicamente.** Por eso la tabla de puntaje por miembro usa
   **4 columnas fijas** (m1..m4 = los 4 primeros miembros con voz y voto). Si hay menos de 4,
   las columnas sobrantes quedan vacías; si hay más de 4, usa la versión **Imprimir → PDF**.
   Por la misma razón, las **firmas** ahora van en una tabla de 4 columnas fijas por grupo
   (`v1..v4` con voz y voto, `s1..s4` sin voto) en vez de una lista apilada — así salen en
   fila, igual que en la vista previa. Cada columna es `{v1nom}` `{v1rol}` `{v1cargo}` (y
   `v2`, `v3`, `v4` / `s1..s4` igual). Si hay más de 4 en un grupo, usa **Imprimir → PDF**.

---

## Plantilla `Acta_de_adjudicacion.docx` — Bienes / Servicios (Cumple/No cumple)

Datos simples: `{objeto}` `{area}` `{modalidad}` `{presupuesto}` `{presupuestoLetras}`
`{partida}` `{lineaNombre}` (= `{lineaCod}`+`{lineaNom}`) `{fechaInvitacion}` `{fechaLimite}`
`{fechaAdj}` `{horaSesion}` (hora de inicio) `{horaCierre}` (hora de cierre) `{lugarSesion}`
`{memoNro}` `{fechaInicio}` `{jefe}` (Presidente) `{ac}` (Secretario) `{proveedor}` `{proveedorRuc}`
`{montoLetras}`.

Bucles: `{#items}{miembros}{cargo}{rol}{/items}` (miembros del quórum, sin Presidente/
Secretario — variante antigua) · `{#votM}{nombre}{cargo}{rol}{/votM}` (quórum: voz y voto) ·
`{#sinVoto}{nombre}{cargo}{rol}{/sinVoto}` (quórum: voz sin voto y Secretaría) ·
`{#comision}{nombre}{rol}{cargo}{/comision}` (firmas) · `{#provs}{razon}{fof}{hof}{/provs}`
(ofertas recibidas — `{fof}` fecha de entrega, `{hof}` hora de entrega) · `{#tecnicos}{razon}{resultado}{#reqs}{req}{res}{/reqs}{/tecnicos}`
(bloque técnico por oferente) · `{#economicos}{razon}{total}{difPresupuesto}{enPresupuesto}{/economicos}`
· `{#prelacion}{orden}{razon}{tec}{eco}{totalPts}{/prelacion}`.

Nota: la plantilla admite el quórum en formato antiguo (`{#items}`, una sola lista) o en el
formato FO-AD-ABC-009 (`{#votM}`/`{#sinVoto}`, separado por si tiene voto). La herramienta
envía datos para los dos a la vez, así que puedes usar cualquiera de las dos formas en Word.

---

## Plantilla `Acta_de_adjudicacion_puntos.docx` — Consultoría (por puntos, formato FO-AD-ABC-009)

Cada miembro con voz y voto califica y se promedia. Datos simples: `{codigoProc}` `{actaNo}`
`{objeto}` `{area}` `{modalidad}` `{presupuestoLetras}` `{fuente}` `{fechaInvitacion}`
`{fechaLimite}` `{fechaAdj}` `{horaSesion}` `{horaCierre}` `{lugarSesion}` `{memoNro}` `{fechaInicio}`
`{umbral}` `{tecMax}` `{puntosTotal}` · nombres de columnas de miembros `{m1nom}` `{m2nom}`
`{m3nom}` `{m4nom}` · adjudicación `{decisionUnica}` `{proveedor}` `{proveedorRuc}`
`{montoAdjLetras}` `{totalAdj}`.

Bucles:

- **Quórum / firmas** — `{#votM}{nombre}{cargo}{rol}{/votM}` (voz y voto) y
  `{#sinVoto}{nombre}{cargo}{rol}{/sinVoto}` (voz sin voto y Secretaría).
- **Ofertas recibidas** — `{#provs}{razon}{fof}{hof}{/provs}` (`{fof}` fecha, `{hof}` hora).
- **Matriz de documentos** — `{#docs}{formulario}{detalle}{res}{/docs}`. Solo se envían filas
  cuando el proceso califica los documentos como Cumple/No cumple (panel 2, selector
  "Documentos habilitantes"). Si se eligió "Con puntaje", `docs` llega vacío — el encabezado
  fijo "Matriz Cumple o No cumple — entrega de documentos" queda en la plantilla pero sin
  filas; si molesta visualmente, hay que quitar ese título a mano en Word para ese caso.
- **Evaluación técnica por oferente** (bloque) — `{#tecOfs}` … `{razon}`, tabla con
  `{#rows}{criterio}{max}{n1}{n2}{n3}{n4}{promedio}{/rows}`, fila total `{t1}{t2}{t3}{t4}`
  `{tecMax}` `{tecProm}`, y `{resultadoTec}` … `{/tecOfs}`.
- **Evaluación económica por oferente** (bloque) — `{#ecoOfs}` … `{razon}` `{ruc}`, la misma
  tabla `{#rows}…{/rows}`, la fila de oferta económica `{e}` `{ecoMax}`, la fila Total
  `{tt1}{tt2}{tt3}{tt4}` `{puntosTotal}` `{totProm}`, `{montoLetras}` `{ahorroTxt}` … `{/ecoOfs}`.

Donde `n1..n4` son las notas de los miembros 1..4 en cada criterio, `t1..t4` sus totales
técnicos, `tt1..tt4` sus totales con la económica, y `{promedio}`/`{tecProm}`/`{totProm}` los
promedios que calcula la herramienta.
