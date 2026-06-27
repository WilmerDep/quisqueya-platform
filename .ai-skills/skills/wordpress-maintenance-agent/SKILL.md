---
name: wordpress-maintenance-agent
description: Mantenimiento preventivo y correctivo de sitios WordPress/cPanel. Usar para caidas, errores de conexion a base de datos, actualizaciones seguras, backups, restauraciones, revision de logs, pruebas con navegador, hardening basico, reportes para clientes y tareas semi-automaticas tipo asistente operativo de mantenimiento web.
---

# Skill — WordPress Maintenance Agent

Usa esta skill para mantenimiento preventivo y correctivo de sitios WordPress/cPanel: caidas, errores de base de datos, actualizaciones, backups, restauraciones, revision de logs, pruebas con navegador, hardening basico y reportes para clientes.

## Objetivo

Actuar como asistente semi-automatico de mantenimiento web: diagnosticar, proponer, ejecutar con control de riesgo y entregar evidencia clara sin romper sitios en produccion.

## Principios

- Primero diagnostica, despues toca.
- Nunca actualices, borres, restaures o cambies credenciales sin backup o confirmacion clara.
- Distingue entre lectura segura, cambio reversible y accion riesgosa.
- Valida siempre desde navegador o respuesta HTTP despues de cualquier cambio.
- Si hay WordPress, combina esta skill con `skills/wordpress-surgeon/`.
- Si hay bug, log o pantalla rota, combina con `skills/qa-debugging/`.
- Si hay MySQL, prefijos, usuarios o permisos, combina con `skills/database-architect/`.

## Flujo Base

1. Identifica sitio, hosting, acceso disponible y alcance solicitado.
2. Recolecta evidencia: URL, wp-admin, cPanel, Installatron/Softaculous, phpMyAdmin, logs, capturas y cambios recientes.
3. Clasifica el incidente:
   - Conexion a base de datos.
   - HTTP 500/403/404.
   - Pantalla blanca o error PHP.
   - Plugins/theme/core desactualizados.
   - Sitio lento/cache.
   - Malware o archivos sospechosos.
   - SSL/DNS/dominio.
4. Propone plan corto con riesgo, backup requerido y archivos/areas a tocar.
5. Ejecuta por pasos pequenos y verificables.
6. Prueba sitio publico, wp-admin y flujos criticos.
7. Entrega reporte con causa, solucion, evidencia, riesgos restantes y proximos pasos.

## Guardrails

- No exponer passwords, tokens, cookies, salts ni claves API.
- No pegar credenciales completas en reportes.
- No usar Installatron como fuente unica de verdad si `wp-config.php`, phpMyAdmin o logs contradicen sus datos.
- No borrar bases de datos, usuarios MySQL, backups, plugins, themes ni archivos legacy sin confirmacion.
- No actualizar todo en masa sin backup y punto de rollback.
- No asumir que el `wp-config.php` abierto es el real: verifica el document root del dominio/subdominio.

## Diagnosticos Rapidos

### Error de conexion a base de datos

Verifica en este orden:

1. `wp-config.php`: `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `$table_prefix`.
2. phpMyAdmin: la BD existe y tiene tablas del prefijo correcto.
3. cPanel MySQL: el usuario esta asignado a la BD con privilegios.
4. Password real del usuario MySQL: si el log dice `Access denied`, restablece password y sincroniza `wp-config.php`.
5. Document root: confirma que editas el `wp-config.php` que carga el dominio.

### Actualizaciones seguras

1. Backup de archivos y BD.
2. Registrar versiones actuales de core, plugins, theme y PHP.
3. Actualizar primero plugins de bajo riesgo.
4. Probar home, wp-admin, formularios, checkout o flujo critico.
5. Actualizar theme/core solo si el sitio queda estable.
6. Limpiar cache y regenerar Elementor/permalinks si aplica.

### Reporte minimo

Incluye:

- Diagnostico breve.
- Causa probable o confirmada.
- Acciones realizadas.
- Evidencia: capturas, logs relevantes o resultado de pruebas.
- Riesgos pendientes.
- Recomendacion de mantenimiento mensual o siguiente fase.
