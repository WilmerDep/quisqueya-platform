# Checklist — WordPress Maintenance Agent

## Antes de Tocar

- Confirmar dominio y document root.
- Identificar si es produccion, staging o clon.
- Revisar backup disponible o crear uno.
- Revisar errores visibles y logs.
- Confirmar acceso a wp-admin/cPanel/phpMyAdmin si aplica.

## Durante

- Cambiar una cosa por vez.
- Registrar valores antes/despues sin exponer secretos.
- Probar despues de cada cambio relevante.
- Mantener rollback claro.

## Despues

- Verificar home, wp-admin y paginas criticas.
- Desactivar debug publico.
- Limpiar cache si aplica.
- Generar reporte.
- Recomendar backup nuevo y monitoreo.
