# Contexto — WordPress Maintenance Agent

Esta skill esta pensada para servicios de mantenimiento recurrente o soporte por incidente en sitios WordPress, especialmente con cPanel, Installatron/Softaculous, phpMyAdmin, Elementor, LiteSpeed, Wordfence, WooCommerce, WPForms y plugins comunes.

## Enfoque Comercial

- Vender diagnostico y mantenimiento como servicio semi-automatico.
- Mantener control humano en acciones de riesgo.
- Documentar cada intervencion para justificar valor al cliente.
- Convertir incidentes en planes preventivos: backup, monitoreo, actualizaciones y hardening.

## Fuentes de Verdad

Prioridad recomendada:

1. Logs reales y mensajes de error.
2. Archivos reales del document root.
3. phpMyAdmin/cPanel MySQL.
4. Estado visible del sitio y wp-admin.
5. Installatron/Softaculous como referencia auxiliar.

## Riesgos Frecuentes

- Password MySQL desincronizado entre cPanel, Installatron y `wp-config.php`.
- BD correcta con prefijo incorrecto en `wp-config.php`.
- Editar un clon o carpeta equivocada.
- Actualizar plugins sin backup.
- Cache ocultando el estado real.
- Debug activo exponiendo rutas internas.
