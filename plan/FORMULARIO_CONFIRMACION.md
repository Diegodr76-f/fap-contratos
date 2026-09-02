# Recoger las respuestas de las administradoras sin transcribir nada a mano

El problema práctico de la Fase 1: son **128 contratos repartidos entre 20 administradoras**, y si
cada una responde por correo con texto libre, alguien tiene que leer 20 correos y teclear 128 filas
en un Excel. Eso ya pasó y es donde se pierden los datos.

La solución que sirve con el **Microsoft 365 básico**, sin conectores premium, sin disparadores HTTP
y sin pedirle nada a IT: **Microsoft Forms, con un enlace propio por contrato**.

## Por qué así y no de otra manera

| Opción | ¿Sirve con el plan básico? | Por qué se descartó / se eligió |
|---|---|---|
| **Forms con enlace prellenado por contrato** | **Sí** | Elegida. Forms viene en el plan; el enlace lleva el número de contrato ya escrito, así que la AC nunca lo teclea y el cruce es exacto |
| Microsoft Lists con las 128 filas cargadas | Sí | Buena alternativa si prefieren editar en rejilla. Pero no hay permisos por fila sin premium: todos pueden editar todo |
| Excel compartido en Teams | Sí | Funciona, pero se rompe: la gente inserta filas, pega formatos y pierde las validaciones |
| Flujo con disparador HTTP, como los actuales | **No** | Es el que topó con el permiso `service.flow.microsoft.com` y quedó esperando a IT |
| Power Apps / Dataverse | **No** | Premium |

---

## 1. Crear el formulario

En **forms.office.com → Nuevo formulario**, título *Confirmación de contratos 2027 · FAP*.

Estas once preguntas, **en este orden** (las cuatro primeras las rellena el enlace, la AC no las
escribe):

| # | Pregunta | Tipo | Opciones | Obligatoria |
|---|---|---|---|---|
| 1 | Número de contrato | Texto | — | Sí |
| 2 | Área protegida | Texto | — | Sí |
| 3 | Detalle del servicio | Texto | — | No |
| 4 | Administradora de contrato | Texto | — | No |
| 5 | ¿Qué corresponde para 2027? | Texto | — | No |
| 6 | ¿El área necesita mantener este servicio en 2027? | Opción | `Sí, continúa` · `Sí, pero con cambios` · `No, no se requiere` | Sí |
| 7 | Si continúa, ¿con el mismo proveedor? | Opción | `Sí, el mismo` · `No, hay que cambiar` · `Todavía no se sabe` | No |
| 8 | Consumo ejecutado 2026 (USD) | Número | — | No |
| 9 | Monto estimado para 2027 (USD) | Número | — | No |
| 10 | ¿Este contrato tiene cláusula de renovación? | Opción | `Sí` · `No` · `No lo sé` | No |
| 11 | Observaciones | Texto largo | — | No |

Las preguntas 1 a 5 son las que viajan en el enlace. Conviene ponerles como descripción
*«Ya viene rellenado, no lo cambies»*.

**Configuración** (⋯ → Configuración):

- **Solo pueden responder las personas de mi organización** y **registrar el nombre** — así cada
  respuesta trae el correo de quien la envió y no hay que preguntarlo.
- **Aceptar respuestas múltiples**: imprescindible. Cada AC envía una respuesta **por contrato**,
  no una en total.

## 2. Sacar el enlace de pre-relleno

En el formulario, **Recopilar respuestas → obtener un vínculo para rellenar previamente las
respuestas** (en algunas versiones está bajo *Compartir*). Se abre el formulario en blanco: escribe
en cada campo, **exactamente estas palabras**, sin espacios ni acentos:

| Pregunta | Qué escribir |
|---|---|
| Número de contrato | `NROCONTRATO` |
| Área protegida | `AREAPROTEGIDA` |
| Detalle del servicio | `DETALLESERVICIO` |
| Administradora de contrato | `ADMINISTRADORA` |
| ¿Qué corresponde para 2027? | `TIPO2027` |

Pulsa **Obtener vínculo** y copia la URL. Queda algo así:

```
https://forms.office.com/Pages/ResponsePage.aspx?id=XXXX&r1a2b3c=NROCONTRATO&r4d5e6f=AREAPROTEGIDA&...
```

> Si tu versión de Forms no ofrece el pre-relleno, no se cae el plan: manda el formulario sin
> enlaces personalizados y deja la pregunta 1 obligatoria. El cruce sigue funcionando porque la AC
> escribe el número de contrato, solo que con más riesgo de erratas.

## 3. Generar los correos con un botón por contrato

```bash
python3 scripts/plan_renovaciones.py <Sistema_Alertas.xlsx> <salida> --form "<la URL que copiaste>"
```

Escribe `correos/<Administradora>.txt` y `correos/<Administradora>.html`. **Envía el HTML**: cada
contrato aparece en una tarjeta con su botón **Confirmar**, que abre el formulario con los datos ya
puestos. Se abre el `.html` en el navegador, se selecciona todo (`Ctrl+A`, `Ctrl+C`) y se pega en
Outlook — los botones y el formato viajan.

## 4. Que las respuestas caigan solas en Excel

Dos caminos, los dos sin premium:

**A · El más simple.** En el formulario, pestaña **Respuestas → Abrir en Excel**. Descarga el
libro con una fila por respuesta. Sirve, pero hay que volver a descargarlo cada vez.

**B · Que se actualice solo** (recomendado). Un flujo en **Power Automate gratuito**, con dos
conectores estándar — ninguno premium:

1. Disparador: **Microsoft Forms · «Cuando se envía una respuesta nueva»** → elige el formulario.
2. Acción: **Microsoft Forms · «Obtener los detalles de la respuesta»** → Id. de respuesta.
3. Acción: **Excel Online (Business) · «Agregar una fila a una tabla»** → apunta a un libro en
   OneDrive o en la biblioteca del equipo, con una tabla cuyas columnas se llamen igual que las
   preguntas.

Así el libro queda vivo y no hay que descargar nada. Si el libro vive en la misma carpeta del
*Sistema de Alertas*, todo el seguimiento queda en un solo sitio.

## 5. Cruzar las respuestas con el plan

```bash
python3 scripts/plan_renovaciones.py <Sistema_Alertas.xlsx> <salida> --respuestas <respuestas.xlsx>
```

El script reconoce las columnas por el texto de la pregunta —así que sobreviven los cambios de
redacción— y se queda con la última respuesta de cada contrato, para que una corrección mande sobre
la primera. Con eso:

- El **Maestro** gana seis columnas: si respondió, si continúa, consumo 2026, monto 2027, cláusula
  de renovación y observaciones.
- Aparece la hoja **Respuestas**: por administradora, cuántos contratos confirmó, cuántos le
  faltan y cuántos no continúan.
- En pantalla sale la lista de pendientes, ordenada por quién debe más — que es exactamente lo que
  necesita la regla de escalamiento a los tres días hábiles.

## Lo que este montaje evita

- **Nadie transcribe nada.** La AC hace clic, responde cinco preguntas y la fila aparece sola.
- **No hay ambigüedad de emparejamiento.** El número de contrato viaja en el enlace; no depende de
  que alguien escriba bien `FIAS-FAP-2026-137`.
- **Se puede medir la cobertura.** En cualquier momento se sabe qué porcentaje del portafolio está
  confirmado y quién falta, sin abrir 20 correos.
- **No necesita a IT.** Ni conectores premium, ni disparadores HTTP, ni consentimiento de
  administrador.
