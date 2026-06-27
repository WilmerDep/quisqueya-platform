# Ejemplos — WordPress Maintenance Agent

## Error de BD

Solicitud: "El sitio dice error al establecer conexion con la base de datos."

Respuesta esperada:

- Revisar `wp-config.php`, BD, usuario, permisos y logs.
- Si aparece `Access denied`, restablecer password MySQL y actualizar `wp-config.php`.
- Confirmar carga del sitio y quitar debug publico.

## Actualizacion Mensual

Solicitud: "Actualiza plugins y revisa que el sitio quede bien."

Respuesta esperada:

- Crear backup.
- Listar plugins/theme/core.
- Actualizar por grupos.
- Probar paginas criticas.
- Reportar versiones y riesgos.

## Sitio Roto Despues de Plugin

Solicitud: "Actualice un plugin y ahora sale 500."

Respuesta esperada:

- Revisar `error_log`.
- Desactivar plugin sospechoso sin borrar.
- Probar sitio.
- Recomendar update/rollback controlado.
