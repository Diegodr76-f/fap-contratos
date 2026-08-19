**Asunto:** Consentimiento de administrador para permiso de Power Automate — app "CLM FAP"

---

Estimados,

Como conversamos, les detallo el requerimiento para que lo revisen antes de la reunión de mañana con Fernando.

**Qué necesito:** que un administrador de Microsoft 365 conceda el **consentimiento de administrador** a un permiso delegado que ya está agregado (falta solo ese clic) en un registro de aplicación existente en Entra ID.

**Cómo hacerlo:**

1. Entrar a [entra.microsoft.com](https://entra.microsoft.com) → **Identidad** → **Aplicaciones** → **Registros de aplicaciones**.
2. Abrir la aplicación **`CLM FAP`** (Id. de cliente `f92458ed-0ad6-4f2a-882e-4c897b2ce53a`).
3. Menú izquierdo → **Permisos de API**.
4. Ahí va a aparecer el permiso `Power Automate / User` con estado "No concedido". Clic en el botón **"Conceder consentimiento de administrador para FONDO DE INVERSION AMBIENTAL SOSTENIBLE"** → confirmar.

Con ese clic, el permiso pasa a "Concedido" y no hace falta nada más.

**Detalle técnico del permiso, por si lo necesitan para su revisión:**

| Campo | Valor |
|---|---|
| Aplicación que lo pide | `CLM FAP` — `f92458ed-0ad6-4f2a-882e-4c897b2ce53a` |
| API de recursos | Power Automate (Microsoft Flow Service) — `7df0a125-d3be-4c96-aa54-591f83ff541c` |
| Permiso | `User` (delegado) — `44d8c55c-9ffc-4546-883e-9041b5bb0b01` |
| Scope OAuth | `https://service.flow.microsoft.com//user_impersonation` |
| Tipo | **Delegado** (no es permiso de aplicación/servicio) |

**Para qué es:** estamos construyendo una herramienta interna para el registro y consulta de activos fijos y bienes de control de las áreas protegidas del FAP. La herramienta usa un flujo de Power Automate para decidir, según la cuenta de Microsoft de cada persona, qué bienes le corresponde ver (cada administradora de contrato ve solo los de su área). Ese flujo está protegido con la opción "Cualquier usuario de mi inquilino" de Power Automate, que exige que quien lo llama presente un token de este permiso específico del servicio de Power Automate — es el mecanismo que documenta Microsoft para este caso (referencia: [learn.microsoft.com/es-es/power-automate/oauth-authentication](https://learn.microsoft.com/es-es/power-automate/oauth-authentication)).

**Alcance real del permiso, para la evaluación de riesgo:**

- Es **delegado**: la aplicación solo puede actuar en nombre de la persona que ya inició sesión con su propia cuenta, y únicamente dentro de lo que esa persona ya podría hacer. No es un permiso de servicio ni permite actuar sin que haya alguien conectado.
- No da acceso a correo, OneDrive, Teams, SharePoint ni al directorio — es exclusivo del servicio de Power Automate.
- Es reversible: se puede revocar desde la misma pantalla en cualquier momento.

**Si por algún motivo no se puede aprobar:** la herramienta sigue funcionando igual para registrar bienes nuevos; lo único que se pierde es que cada persona vea automáticamente solo los de su área — mientras tanto lo elige de una lista a mano.

Quedo atento para lo que necesiten antes de la reunión de mañana.

Saludos,
Diego

---
*(Nota para ti, Diego, no para el correo: este mismo detalle está guardado en `bienes/PARA_IT.md` del repositorio, por si necesitas reenviarlo de nuevo más adelante.)*
