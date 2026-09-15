# Rotar la firma de un flujo de Power Automate

Cuando una URL firmada se publica por error, quitarla del código no basta: lo que
estuvo en un sitio público hay que darlo por copiado, y la firma vieja sigue
abriendo. Hay que **rotarla**.

**No hay que tocar el flujo.** Ni recrearlo, ni copiarlo, ni borrarlo. Microsoft
tiene un procedimiento oficial que solo regenera la llave: el flujo conserva su
identificador, sus pasos, sus conexiones y su historial de ejecuciones, y lo único
que cambia es el `sig=` de la URL. La firma vieja queda invalidada en el acto.

El procedimiento oficial está en
[Regenerate the SAS key used in HTTP trigger flows](https://learn.microsoft.com/en-us/power-automate/regenerate-sas-key).
No hay botón en la interfaz: se hace con una llamada desde la consola del
navegador. Lo de abajo es ese mismo procedimiento, con el paso pesado hecho una
sola vez para los cuatro flujos en lugar de cuatro veces.

## Los flujos con firma

| Identificador del flujo | Qué hace | Lo usa |
|---|---|---|
| `d9ab249e-f28a-41c6-9d9b-b7a5ee32a00e` | Documentos a la Unidad Operativa | La Mágica, CRM, CLM |
| `9416db77-1667-4cf2-a630-1654593a6267` | Registro central (Microsoft List) | La Mágica |
| `b1ce5454-c953-41b6-b63a-7a1926e87f93` | Decisiones de renovación | Contratos 2027 |
| `1fcaa33f-545a-4660-829f-e6440e9372c4` | Fila nueva de la matriz | Bienes |

El quinto flujo, `0c2c203a-4997-4e86-8580-adc866bcc66e` («Mis bienes»), **no lleva
firma**: está protegido con Entra ID y no hay nada que rotar. Es el modelo al que
deberían pasar los otros cuatro (ver `bienes/PARA_IT.md`).

## Antes de empezar

- **Rota primero, reparte después.** En cuanto rotas, la URL vieja deja de
  funcionar para todo el mundo. Mientras las administradoras no tengan la nueva,
  cada herramienta cae a su respaldo —CSV, descarga, envío preparado sin subir— y
  no se pierde nada, pero conviene que el hueco sea corto.
- **Comprueba que nadie más llame a estos flujos.** Si algún Power App, Forms u
  otro flujo usa una de estas URLs, también hay que darle la nueva.

## Paso 1 · Apunta la firma actual

[flow.microsoft.com](https://flow.microsoft.com) → abre el flujo en el diseñador →
abre el disparador **Cuando se recibe una solicitud HTTP** y copia la URL. Guarda
el trozo que empieza por `sig=`: al final lo comparas para confirmar que cambió.

## Paso 2 · Saca el token y la dirección (una sola vez)

En Edge o Chrome, sobre la página de **Detalles** del flujo (no el diseñador):

1. **F12** → pestaña **Red** / **Network**.
2. **Ctrl+L** para limpiar, **Ctrl+E** para grabar, **Ctrl+R** para recargar.
3. Filtra por `api.flow` y busca la petición que empieza por **`runs?api-version=`**.
4. En **Encabezados** / **Headers**, copia dos cosas a un bloc de notas:
   - la **URL de la petición**, y en ella cambia la palabra `runs` por
     `regenerateAccessKey`;
   - el encabezado **Authorization** entero (empieza por `Bearer eyJ…`), sin
     arrastrar el encabezado siguiente.

## Paso 3 · Rota los cuatro de una vez

Pega esto en la pestaña **Consola**, rellenando las dos primeras líneas con lo que
copiaste, y pulsa Enter:

```js
// Pega aquí lo del paso 2 ↓
const AUTH   = 'Bearer eyJ0…';                       // el encabezado Authorization entero
const MODELO = 'https://api.flow.microsoft.com/…/flows/…/regenerateAccessKey?api-version=…';

const FLUJOS = {
  'documentos a la Unidad Operativa': 'd9ab249e-f28a-41c6-9d9b-b7a5ee32a00e',
  'registro central':                 '9416db77-1667-4cf2-a630-1654593a6267',
  'decisiones de renovación':         'b1ce5454-c953-41b6-b63a-7a1926e87f93',
  'matriz de bienes':                 '1fcaa33f-545a-4660-829f-e6440e9372c4',
};

for (const [nombre, id] of Object.entries(FLUJOS)) {
  const url = MODELO.replace(/\/flows\/[^/]+\//, '/flows/' + id + '/');
  try {
    const r = await fetch(url, { method: 'POST', headers: {
      'Content-type': 'application/json; charset=UTF-8', 'Authorization': AUTH } });
    console.log((r.ok ? '✓ ' : '✗ ') + nombre + ' — HTTP ' + r.status);
  } catch (e) { console.log('✗ ' + nombre + ' — ' + e.message); }
}
```

El `MODELO` puede ser la dirección de cualquiera de los cuatro flujos: el bucle le
cambia el identificador. El token vale para los cuatro porque es el de tu sesión.

> Si alguna línea sale **Rejected** o con error, no des por hecho que falló: la
> documentación de Microsoft avisa de que la llave puede haberse regenerado igual.
> Compruébalo siempre en el paso 4.

## Paso 4 · Confirma, una por una

Vuelve al diseñador de cada flujo, abre el disparador y mira la URL: el `sig=`
tiene que ser **distinto** del que apuntaste en el paso 1. Si sigue igual, esa no
se rotó — repite el paso 3 solo con ese identificador.

## Paso 5 · Reparte las URLs nuevas

Cada administradora pega la suya una vez, cuando la herramienta se la pida. Por
canal privado (correo interno, Teams): **nunca en el repositorio, ni en un ticket,
ni en un chat de grupo abierto**.

## Que no haya que volver a hacer esto

Rotar arregla la fuga de hoy, no la de mañana: la llave sigue siendo una llave, y
sigue viviendo en veinte navegadores. Lo que cierra el tema es cambiar el
disparador a **«Cualquier usuario de mi inquilino»**, que valida la cuenta de quien
llama y no usa `sig` ninguna. Es un cambio de desplegable en cada flujo, pero
necesita que IT conceda antes un permiso delegado —está pedido, con el detalle
exacto, en [`bienes/PARA_IT.md`](../bienes/PARA_IT.md)—. Sin ese consentimiento las
herramientas reciben 401 y dejan de enviar.
