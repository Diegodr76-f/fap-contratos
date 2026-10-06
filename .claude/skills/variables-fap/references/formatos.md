# Formatos: lo que cada variable imprime de verdad

El nombre de la variable no basta. Dos herramientas pueden rellenar `{montoTotalLetras}` y
producir textos distintos, y el documento se firma igual.

**La fuente del formato es el campo `ejemplo` de cada variable en el catálogo.** Si está lleno,
manda. Si está vacío, mira aquí.

---

## Montos en letras — la trampa

Las variables de tipo `letras` (`montoLetras`, `montoTotalLetras`, `presupuestoLetras`,
`montoAumentoLetras`, `montoOriginalLetras`, `consumoEjecutadoLetras`…) **no son solo las
palabras en algunas herramientas**. Hoy conviven tres formatos:

| quién rellena | qué sale para 1.150,00 |
|---|---|
| **La Mágica** (`generador/index.html`) | `USD 1.150,00 (Mil ciento cincuenta con 00/100 dólares de los Estados Unidos de América) incluidos impuestos` |
| **Calificador** (`calificacion/index.html`) | `USD 1.150,00 (Mil ciento cincuenta…)` — con cifra, **sin** «incluidos impuestos» |
| **CRM y CLM** (`crm/index.html`, `clm/index.html`) | `Mil ciento cincuenta con 00/100 dólares de los Estados Unidos de América` — **solo las palabras** |

Cada plantilla está escrita para su herramienta, y eso es lo que las hace incompatibles cruzadas:

- Las 18 plantillas de La Mágica ponen `{montoLetras}` **sola**, porque ya trae la cifra dentro.
- Las del CRM ponen `USD {montoAumento} ({montoAumentoLetras})`, porque la suya **no** la trae.

### Los dos errores que esto produce

**1 · La cifra duplicada.** Escribir, en una plantilla de La Mágica:

```
USD {montoTotal} ({montoTotalLetras})
```

imprime `USD 1.150,00 (USD 1.150,00 (Mil ciento cincuenta…) incluidos impuestos)`. Es el error
natural de quien viene del generador de instrumentos jurídicos, donde esa variable sí son solo
las palabras.

**2 · La coletilla duplicada.** Pasó de verdad, en `crm/plantillas/14_Informe_adenda.docx`,
cláusula novena, hasta septiembre de 2026:

```
El valor del presente contrato es de {montoTotal} ({montoTotalLetras} con 00/100 dólares de
los Estados Unidos de América)
```

`montoEnLetras()` del CRM **ya termina** en «con 00/100 dólares de los Estados Unidos de
América», así que el documento salía con la frase dos veces, en un informe que se firma. Lo
usaban el CRM, el CLM y el generador de instrumentos jurídicos, que lleva una copia embebida.
Hoy dice `({montoTotalLetras})`. Si la corriges en una plantilla, busca sus copias.

### Antes de escribir un monto en letras

1. Mira el `ejemplo` de la variable en el catálogo. Si empieza por `USD `, **la variable ya trae
   la cifra**: va sola, sin `USD {monto} (` delante ni `)` detrás.
2. Si el ejemplo son solo palabras, la cifra la pone la plantilla.
3. No escribas nunca a mano «con NN/100 dólares…» ni «incluidos impuestos» detrás de una de estas
   variables sin comprobar antes si ya viene dentro.

---

## Dinero en cifra

Punto de miles y coma decimal, siempre dos decimales (`es-EC`): `9.120,45`, `850,00`.

El prefijo `USD` lo pone la plantilla, no la variable —salvo en las de tipo `letras` de La Mágica
y del Calificador, que lo traen dentro, como se ha dicho arriba.

## Fechas

Las variables de tipo `fecha` se imprimen **largas y en español**: `4 de septiembre de 2026`.
Nunca `2026-09-04` ni `04/09/2026`, que es el formato de pantalla.

La hora, cuando hace falta, va **dentro** de la fecha: el ejemplo de `fechaLimite` es
`15 de julio de 2026, 16h00`. Las excepciones son `horaSesion` y `horaCierre`, que son dos horas
distintas del mismo acto y no caben en una sola fecha.

## Cantidades en letras que no son dinero

Hay variables `letras` que no son montos —un plazo, por ejemplo—. Ahí no se escribe «dólares»
ni «/100»: son la cantidad en palabras y nada más.

---

## Si tocas una de las funciones

`montoEnLetras()` está copiada en `generador/index.html`, `crm/index.html` y `clm/index.html`, y
el Calificador tiene la suya, `numeroALetras()`. No hay módulos en este repositorio, así que la
única forma de tener una sola implementación es tener varias copias y mantenerlas iguales
a conciencia: **si cambias una, cambia las cuatro**, y revisa qué plantillas dependían del texto
anterior antes de hacerlo.
