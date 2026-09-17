**Asunto:** Detalle técnico — CLM/Bienes FAP y permiso pendiente de Power Automate

---

Estimados,

Les amplío el contexto técnico completo para que lleguen con todo claro a la reunión de mañana con Fernando.

## Qué estamos construyendo

Estamos armando un sistema único — lo llamamos **CLM** (Contract Lifecycle Management) — para que cada administradora de contrato (AC) entre a **una sola página** y ahí vea únicamente lo suyo: sus contratos y ahora también sus activos fijos y bienes de control. Nada de lo de otras áreas. En cambio, la Unidad Operativa, Catalina Tapia (administradora de bienes), Fernanda Coello y yo necesitamos ver todo, de todas las áreas, desde la misma herramienta.

Es un reemplazo directo de cómo se trabajaba hasta ahora: matrices de Excel sueltas, compartidas por correo o carpetas, sin control real de quién ve qué ni aviso automático cuando algo cambia.

## Cómo está armado técnicamente

**1. Es una aplicación web estática**, sin servidor propio: son archivos HTML con JavaScript, publicados como página en GitHub Pages (`https://diegodr76-f.github.io/fap-contratos/`). No hay backend que mantener ni licencias de Power Apps de por medio.

**2. El módulo de Bienes vive dentro del CLM.** Técnicamente son dos páginas (`clm/index.html` y `bienes/index.html`), pero desde el CLM hay una pestaña "Bienes" que carga la herramienta de bienes empotrada adentro (un `iframe`), así que para quien la usa es una sola aplicación con un solo login — nunca sale de la página del CLM.

**3. El login es con la cuenta de Microsoft 365 de cada persona (Entra ID), no una clave compartida.** Registramos una aplicación en Entra ID (**`CLM FAP`**, Id. de cliente `f92458ed-0ad6-4f2a-882e-4c897b2ce53a`) usando MSAL.js (la librería oficial de Microsoft para este tipo de login en aplicaciones web). Cuando alguien entra, el navegador pide un token de Azure AD — es el mismo mecanismo que usa cualquier aplicación de Microsoft 365, no algo inventado por nosotros.

**4. La matriz de datos se queda en Excel, en OneDrive** — no la migramos a Listas de SharePoint (lo intentamos, pero la importación masiva de +1.200 filas no era confiable). Sobre ese mismo Excel se conectan dos flujos de **Power Automate**:

   - **Flujo de alta:** cuando una AC llena el formulario de "Registrar un bien" y le da enviar, este flujo escribe la fila directamente en la tabla de Excel correspondiente (Activos o Bienes control, según el valor) y le manda un correo a Catalina avisándole que hay un bien nuevo para revisar. Este flujo **solo escribe**, nunca devuelve datos de nadie.

   - **Flujo de consulta ("Obtener mis bienes"):** este es el que decide qué ve cada persona. Recibe la llamada del navegador con el token de Azure AD de quien inició sesión, identifica su correo, lo busca en una lista de Accesos (correo → área), y devuelve solo los bienes de esa área — o todos, si la persona está marcada como acceso total. **El navegador nunca decide esto por sí mismo**: si lo hiciera, bastaría con cambiar una línea de código para que cualquiera viera el área de otro. La verificación de identidad tiene que pasar por el servidor de Microsoft, no por el cliente.

## Dónde está el punto pendiente

Ese segundo flujo (el de consulta) está protegido en Power Automate con la opción **"Cualquier usuario de mi inquilino"**, que exige que quien lo llama presente un token de Azure AD válido — así Power Automate garantiza que solo cuentas reales de FIAS pueden pedir datos, y además le entrega al flujo la identidad verificada de quien pregunta (no algo que el navegador pueda falsificar).

Lo que descubrimos, verificado contra la documentación oficial de Microsoft ([learn.microsoft.com/es-es/power-automate/oauth-authentication](https://learn.microsoft.com/es-es/power-automate/oauth-authentication)), es que ese tipo de disparador protegido **no acepta un token de nuestra propia aplicación** (`CLM FAP`): exige uno del propio servicio de Power Automate, identificado por el permiso delegado `Power Automate → User` (recurso `https://service.flow.microsoft.com/`). Sin el consentimiento de administrador para ese permiso específico, Microsoft rechaza la llamada antes de que llegue al flujo.

**Es un solo clic, ya con todo preparado:**

1. [entra.microsoft.com](https://entra.microsoft.com) → **Identidad** → **Aplicaciones** → **Registros de aplicaciones**.
2. Abrir **`CLM FAP`** (`f92458ed-0ad6-4f2a-882e-4c897b2ce53a`).
3. **Permisos de API** → el permiso `Power Automate / User` ya está agregado, con estado "No concedido".
4. Botón **"Conceder consentimiento de administrador para FONDO DE INVERSION AMBIENTAL SOSTENIBLE"** → confirmar.

| Campo | Valor |
|---|---|
| Aplicación que lo pide | `CLM FAP` — `f92458ed-0ad6-4f2a-882e-4c897b2ce53a` |
| API de recursos | Power Automate (Microsoft Flow Service) — `7df0a125-d3be-4c96-aa54-591f83ff541c` |
| Permiso | `User` (delegado) — `44d8c55c-9ffc-4546-883e-9041b5bb0b01` |
| Scope OAuth | `https://service.flow.microsoft.com//user_impersonation` |
| Tipo | **Delegado** — no es un permiso de servicio ni de aplicación |

## Alcance real, para la evaluación de riesgo

- Es **delegado**: la aplicación solo actúa en nombre de la persona que ya inició sesión con su propia cuenta, y dentro de lo que esa persona ya podría hacer. No es un permiso de fondo ni permite actuar sin nadie conectado.
- No toca correo, OneDrive, Teams, SharePoint ni el directorio — es exclusivo del servicio de Power Automate.
- Es reversible: se retira desde la misma pantalla en cualquier momento.

## Si no se puede aprobar por ahora

La herramienta sigue funcionando igual para registrar bienes nuevos (eso ya no depende de este permiso). Lo único que queda pendiente es que cada persona vea automáticamente solo los bienes de su área al iniciar sesión — mientras tanto, cada quien la elige de una lista a mano al momento de registrar.

Quedo atento a lo que necesiten revisar antes de mañana.

Saludos,
Diego

---
*(Nota para ti, Diego, no para el correo: este mismo detalle técnico está guardado en `bienes/PARA_IT.md` del repositorio, por si necesitas reenviarlo o repasarlo en la reunión.)*
