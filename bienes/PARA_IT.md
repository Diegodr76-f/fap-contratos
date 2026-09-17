# Solicitud a IT — un clic de consentimiento en Entra ID

> **Para quien recibe esto:** es una sola acción, de menos de un minuto, en el
> portal de Entra ID. No hay que instalar, configurar ni mantener nada. Abajo
> está el qué, el porqué y el detalle exacto.

## Qué se necesita

Conceder el **consentimiento de administrador** al permiso delegado
**Power Automate → User** en un registro de aplicación que ya existe en el
inquilino de FIAS.

## Cómo se hace

1. [entra.microsoft.com](https://entra.microsoft.com) → **Identidad** →
   **Aplicaciones** → **Registros de aplicaciones**.
2. Abrir la aplicación **`CLM FAP`**
   (Id. de cliente `f92458ed-0ad6-4f2a-882e-4c897b2ce53a`).
3. Menú izquierdo → **Permisos de API**.
4. Botón **«Conceder consentimiento de administrador para FONDO DE INVERSION
   AMBIENTAL SOSTENIBLE»** → confirmar.

El permiso ya está agregado; solo falta ese clic. Al terminar, la fila
`Power Automate / User` debe pasar de «No concedido» a «Concedido».

## Detalle del permiso

| Campo | Valor |
|---|---|
| Aplicación que lo pide | `CLM FAP` — `f92458ed-0ad6-4f2a-882e-4c897b2ce53a` |
| API de recursos | Power Automate — `7df0a125-d3be-4c96-aa54-591f83ff541c` |
| Permiso | `User` (delegado) — `44d8c55c-9ffc-4546-883e-9041b5bb0b01` |
| Scope OAuth | `https://service.flow.microsoft.com//user_impersonation` |
| Tipo | **Delegado**, no de aplicación |

## Por qué hace falta

La herramienta de bienes del FAP (activos fijos de las áreas protegidas)
consulta un flujo de Power Automate para saber **qué bienes le corresponden a
cada persona según su área**. Ese flujo está protegido con la opción
«Cualquier usuario de mi inquilino», que exige un token del servicio de Power
Automate. Sin este consentimiento, Microsoft rechaza la llamada antes de que
el flujo se ejecute, y la herramienta no puede aplicar el filtro por área.

## Qué implica conceder esto (alcance real)

- Es un permiso **delegado**: la aplicación solo puede actuar **en nombre de
  la persona que ya inició sesión**, y únicamente con los permisos que esa
  persona ya tiene. No otorga acceso de servicio ni permite actuar sin un
  usuario presente.
- No da acceso a correo, archivos, Teams ni al directorio.
- Es el permiso estándar y documentado por Microsoft para llamar a un
  disparador HTTP de Power Automate protegido con Azure AD.
  Ver [documentación de Microsoft sobre autenticación OAuth en Power
  Automate](https://learn.microsoft.com/es-es/power-automate/oauth-authentication).
- Es reversible: se retira desde la misma pantalla en cualquier momento.

## Si no se aprueba

La herramienta sigue funcionando para registrar bienes, pero cada persona
tiene que elegir su área de una lista en vez de que el sistema se la asigne
sola — es decir, se pierde la separación automática por área, que es
justamente el control que se quería.
