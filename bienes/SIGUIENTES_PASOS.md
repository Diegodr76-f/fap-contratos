# Siguientes pasos

Lista de lo que falta, en orden, escrita para retomarla en cualquier momento.

**Cambió el plan y quedó más corto.** Antes había que pasar 1.256 bienes a
una Lista de SharePoint, y esa migración fue la que se atascó. Ahora la
matriz **se queda en el Excel** y encima se le montan los flujos que avisan a
Cata. No hay nada que migrar.

Ya está hecho: el login con Microsoft, la herramienta de bienes, el CLM con
Bienes integrado adentro, el código QR, la corrección del Excel nuevo, y la
lectura del archivo desde la herramienta (funciona hoy, sin flujos ni
SharePoint: botón «Abre tu matriz .xlsx» en la pantalla de acceso).

---

## 1. Probar la herramienta con el archivo corregido

Es lo primero porque no depende de nadie ni de ningún permiso, y sirve para
ver de una vez si el camino va bien.

1. Abre `bienes/index.html`.
2. En la pantalla de acceso, botón para abrir la matriz `.xlsx`.
3. Elige `MATRIZ_CONTROL_INVENTARIO_FIAS.xlsx`.

Debe mostrar el panel con los bienes, el valor en libros recalculado a hoy, y
los QR al abrir cada ficha. El archivo no se sube a ningún lado.

## 2. Subir el Excel corregido a SharePoint

A un **sitio de equipo**, no a tu OneDrive personal — si queda en tu carpeta
personal, los flujos de los demás dependen de que tu cuenta siga activa.

Si todavía no hay sitio de equipo, se puede empezar en el personal y moverlo
después; solo hay que volver a apuntar los flujos.

## 3. Armar el flujo que escribe el bien nuevo y avisa a Cata

Todo el paso a paso está en [`AVISAR_A_CATA.md`](AVISAR_A_CATA.md), flujo 1.

Al terminar te da una URL. Se pega en `bienes/index.html`, en la línea
`var FLOW_BIENES_URL = '';`, entre las comillas.

Desde ese momento el circuito ya sirve: la AC llena el formulario → la fila
entra sola al Excel → a Cata le llega el correo. **Eso es lo que se pidió al
principio de todo**, y no necesita nada de lo que sigue.

## 4. Armar la ronda diaria

[`AVISAR_A_CATA.md`](AVISAR_A_CATA.md), flujo 2. Avisa a Cata si alguien
editó el archivo a mano, sin pasar por el formulario. Es un flujo de cuatro
pasos.

## 5. Crear la lista «Accesos»

Una lista de SharePoint con dos columnas:

| Columna | Tipo | Ejemplo |
|---|---|---|
| Correo | Una línea de texto | `jperez@fias.org.ec` |
| Área | Una línea de texto | `FIAS` o `TODAS` |

- Cada AC lleva una fila con su correo y su área — el mismo texto que va en
  la columna `ÁREA (AC)` del Excel.
- Unidad Operativa, Cata, tú y Fernanda llevan `TODAS`.

**Pendiente:** los correos de Cata y de Fernanda. Sin esos dos no se puede
terminar de llenar.

Esta misma lista sirve después para contratos (CLM), no hay que duplicarla.

## 6. Flujo de lectura: que cada AC vea solo lo suyo

[`CONECTAR.md`](CONECTAR.md), parte 4, con el cambio que está explicado en
[`AVISAR_A_CATA.md`](AVISAR_A_CATA.md): se lee del Excel con «Enumerar filas
presentes en una tabla» (con **paginación activada**, umbral 5000) en vez de
una Lista.

La URL que resulte se pega en `bienes/index.html`:
`var API_MIS_BIENES_URL = '';`

## 7. Lo mismo para contratos

[`CONECTAR.md`](CONECTAR.md), partes 5 y 6. Reutiliza la misma aplicación de
Microsoft que ya creaste, agregando el permiso `Contratos.Leer`. La URL va en
`clm/index.html` y `crm/index.html`, en `API_MIS_CONTRATOS_URL`.

## 8. Publicar

Cuando el paso 3 esté andando, vale la pena publicar el sitio para que las
AC entren desde el navegador en vez de abrir archivos. Con los pasos 6 y 7
listos, cada quien entra con su cuenta de Microsoft y ve solo lo de su área.

---

### Si tienes poco tiempo

Los pasos **1, 2 y 3** son los que dan resultado visible: el formulario
funcionando y Cata enterándose. Los demás son mejoras encima de eso.
