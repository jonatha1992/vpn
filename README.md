# Pasaporte para Chrome

Created by tecnofusion.it

## Corrección de conexión en 1.3.0

Se reemplazaron las conexiones directas inaccesibles por gateways IPv4 de `p.webshare.io` en el puerto 80, usando el usuario con el índice de proxy que corresponde a cada salida. Se usa un gateway distinto por país para que Chrome no reutilice la autenticación de otro destino en el mismo host y puerto.

Se verificaron las seis salidas con peticiones HTTPS a ipify: todas devolvieron HTTP 200 y la IP asignada en la lista del usuario. Los resultados están en `tests/gateway-results.json`. La ubicación de los países proviene de la lista del proveedor; no se verificó con una base de geolocalización independiente.

Al recargar la extensión y abrir el popup, la revisión 3 actualiza las rutas antiguas guardadas. Después hay que activar el país para aplicar su nueva ruta a Chrome. Las direcciones de gateway y la asignación de índices pueden cambiar en el proveedor; si eso sucede, hay que volver a comprobarlas. El popup compara la IP observada con `expectedIp`, no con la dirección del gateway.

Esta copia personal incluye un servidor por país: Alemania, España, Estados Unidos, Japón, Polonia y Reino Unido, tomados de la lista del usuario. Los límites y la disponibilidad dependen de su cuenta del proveedor.

## Instalación y actualización

1. Abrí `chrome://extensions`.
2. Si ya instalaste Pasaporte, pulsá su botón de recargar y aceptá los nuevos permisos si Chrome los solicita.
3. Para instalar desde cero, activá Modo de desarrollador, pulsá Cargar descomprimida y seleccioná esta carpeta.
4. Abrí Pasaporte: importa los servidores y credenciales automáticamente una sola vez.
5. Elegí un país disponible y pulsá Activar proxy. Desactivar libera la configuración y restaura la que corresponda al sistema u otras extensiones.

## Datos personales y permisos

`private-config.json` contiene credenciales personales y está excluido de Git. No compartas esta carpeta. Se importan a chrome.storage.local sin sincronización. Para modificar credenciales ya importadas, actualizá ese almacenamiento o reinstalá con el archivo actualizado.

El service worker usa webRequestAuthProvider para responder únicamente a desafíos de proxy cuyo host y puerto coincidan con el proxy activo controlado por Pasaporte. No entrega las credenciales a la autenticación de sitios. Cancela un segundo intento en la misma petición si la autenticación fue rechazada.

## Alcance y pruebas

- Configura el perfil regular de Chrome; no se ofrece soporte para incógnito.
- No es una VPN del dispositivo ni cambia GPS. WebRTC puede usar otra ruta.
- Los servidores precargados usan HTTP con autenticación. HTTP no cifra por sí mismo el enlace al proxy; las páginas HTTPS mantienen su TLS.
- El formulario permite editar host IPv4 o dominio, puerto y protocolo. Para otros servidores, usá autorización por IP; el formulario no edita contraseñas.
- Proxy configurado confirma la aplicación de ajustes, no la disponibilidad o ubicación del servidor. No hay bloqueo global del tráfico ante fallas.
- Se comprobó la sintaxis y se probaron los límites de entrega de credenciales con `node --test tests/auth.test.cjs`.
- Las conexiones de prueba desde el entorno de desarrollo no lograron acceder a los proxies. Falta verificar en Chrome: activar, consultar IP pública, cambiar de país, consultar de nuevo y desactivar.

Documentación oficial: https://developer.chrome.com/docs/extensions/reference/api/webRequest
