# Publicar el Generador de Instrumentos como sitio privado

Esta carpeta es **autosuficiente**: se puede servir sola, sin el resto del repo
`fap-contratos`. Sirve igual abierta como archivo local (`file://`) que publicada
en un sitio web.

El objetivo de este despliegue es tener una **URL propia, protegida con login**,
separada del CLM (que es la puerta de entrada compartida de la oficina). El sitio
no se enlaza desde el CLM ni desde la raíz del repo público.

---

## 1. Repo privado

En GitHub: **New repository** → nombre p. ej. `instrumentos-legales` →
**Private** → crear (sin README, queda vacío).

Luego, parado en una copia de esta carpeta:

```bash
# Desde la raíz de fap-contratos
cp -r instrumentos /ruta/donde/quieras/instrumentos-legales
cd /ruta/donde/quieras/instrumentos-legales

git init -b main
git add .
git commit -m "Generador de Instrumentos Legales, sitio independiente"
git remote add origin https://github.com/<tu-usuario>/instrumentos-legales.git
git push -u origin main
```

El `index.html` queda en la **raíz** del repo privado: eso hace que la URL final
sea limpia y que la configuración de Cloudflare no tenga que apuntar a
subcarpetas.

## 2. Cloudflare Pages

1. Crear cuenta gratuita en <https://dash.cloudflare.com>.
2. **Workers & Pages → Create → Pages → Connect to Git**.
3. Autorizar GitHub y elegir el repo **privado** `instrumentos-legales`.
4. Configuración de compilación:
   - *Framework preset*: **None**
   - *Build command*: **vacío**
   - *Build output directory*: **`/`**
5. **Save and Deploy**. Queda en `https://<proyecto>.pages.dev`.

No hay compilación: son archivos estáticos, se publican tal cual. Cada `git push`
al repo privado vuelve a publicar solo.

## 3. Cerrarlo con login (Cloudflare Access)

Sin este paso la URL es pública. Es el paso que da la privacidad real.

1. En el panel: **Zero Trust** → **Access** → **Applications** → **Add an
   application** → **Self-hosted**.
2. *Application domain*: el dominio del sitio, `<proyecto>.pages.dev`.
3. Crear una **policy**: *Action* **Allow**, regla **Emails** → tu correo
   (añade ahí a quien quieras dar acceso, y a nadie más).
4. Guardar.

Desde ese momento, entrar a la URL pide un código de un solo uso enviado al
correo autorizado. Quien no esté en la lista no pasa, aunque tenga el link.

El plan gratuito de Zero Trust cubre hasta 50 usuarios. Los nombres exactos de
los menús cambian de vez en cuando; lo que no cambia es la idea: *una aplicación
self-hosted apuntando al dominio del sitio, con una policy que permita solo tus
correos*.

---

## De dónde salen los datos del registro

`RUTAS_REGISTRO` (en `index.html`) prueba tres orígenes **en orden** y se queda
con el primero que responda:

| # | Origen | Cuándo aplica |
|---|--------|---------------|
| 1 | `../crm/contratos_export.json` | Solo cuando la carpeta vive dentro de `fap-contratos`. En el sitio independiente da 404 y sigue de largo. |
| 2 | `https://diegodr76-f.github.io/fap-contratos/crm/contratos_export.json` | **Fuente viva.** La reescribe el flujo diario, así el sitio independiente ve los contratos del día. |
| 3 | `./datos/contratos_export.json` | Copia incluida aquí. Respaldo para trabajar sin internet. Es una foto: puede estar desactualizada. |

**Dependencia a tener presente:** el origen 2 funciona porque el repo
`fap-contratos` es **público**. Si algún día se vuelve privado, esa URL deja de
responder y el sitio se queda con la copia local (origen 3), que envejece. En ese
caso hay que refrescar la copia de vez en cuando:

```bash
curl -o datos/contratos_export.json \
  https://raw.githubusercontent.com/<usuario>/fap-contratos/main/crm/contratos_export.json
git commit -am "Actualiza la copia local del registro" && git push
```

## Sin conexión

`sw.js` guarda en caché la página, los iconos, el manifiesto y la copia local de
datos, así que el sitio abre sin internet igual que el archivo suelto. La página
usa *red primero*: al publicar una versión nueva se ve enseguida.

El registro del CRM (origen 2, otro dominio) **nunca** se sirve de caché: el
service worker deja pasar de largo todo lo que no sea del mismo origen, para que
los contratos no queden congelados.

## Lo que este despliegue NO hace

La biblioteca (plantillas, cláusulas, carpetas, variables, contrapartes,
historial) vive en `localStorage`, es decir **por navegador**. Abrir la URL en
otra computadora arranca con las semillas, no con lo tuyo. El puente sigue siendo
**Exportar / Importar biblioteca**. Sincronizar de verdad entre equipos requiere
un backend y es un trabajo aparte.
