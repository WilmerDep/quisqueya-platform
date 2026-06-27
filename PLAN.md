# Plan Actual: Web + API + App Movil PrestaFacil RD

## Resumen

PrestaFacil RD avanza como una plataforma fullstack de un solo proyecto Node para Hostinger. NestJS sirve la API y tambien el frontend React/Vite compilado. La futura app Android/iOS se hara con React Native/Expo y consumira la misma API versionada.

Decision actualizada:

- Prisma sera la capa oficial de acceso a datos sobre MySQL/Laragon. El codigo actual usa `mysql2` directo y debe migrarse por fases para mejorar seguridad, relaciones, transacciones y compatibilidad futura con la app movil.
- Los layouts actuales se consideran base funcional temporal. La UI definitiva debe reconstruirse contra `docs/docs-systems/01_mapa_completo_pantallas_loanops_rd.md` y las referencias visuales en `docs/docs-systems/PANTALLAS WEBS Y APPS/`.

El detalle tecnico estable esta en `docs/system-architecture.md`.
La bitacora de continuidad esta en `docs/continuation-note.md`.
El checklist de salida a produccion esta en `docs/production-readiness.md`.

## Estado Actual

Completado:

1. Frontend React/Vite.
2. Backend NestJS bajo `/api/v1`.
3. MySQL local con Laragon.
4. Auth real con access/refresh token.
5. API para empresas, sucursales, usuarios, clientes, prestamos, pagos, caja, rutas, reportes, auditoria y sync inicial.
6. Web conectada progresivamente a API con fallback local.
7. Validacion de flujos principales contra MySQL.
8. Correcciones de reglas criticas:
   - Cobrador solo cobra prestamos de clientes asignados.
   - Liquidacion de ruta registra caja y no permite cierres duplicados.
9. Tests e2e API-backed para pagos, rutas y permisos.
10. Caja MVP funcional completada:
   - Resumen, movimientos, cierre de caja e historial.
   - Registro manual de entradas y salidas.
   - Cierre de caja persistido en MySQL.
   - Historial de cierres guardados por sucursal.
   - Ajustes visuales y estructurales alineados al nuevo sistema UI.

## Siguiente Orden De Trabajo

1. Base Prisma + MySQL
   - Agregar `prisma/schema.prisma` alineado al esquema real de `server/migrations/001_initial_schema.sql`.
   - Agregar `PrismaService` en NestJS.
   - Mantener `mysql2` temporalmente mientras se migra modulo por modulo.
   - Migrar primero operaciones financieras criticas: prestamos, cuotas, pagos, caja y auditoria.
   - Usar transacciones Prisma para pagos, anulaciones, cierres de ruta y cierres de caja.

2. Rediseño de layout y sistema visual
   - Rehacer shell principal: sidebar, topbar, mobile nav, estados globales y super admin.
   - Remover identidad temporal tipo Nexus/Kernel/Ghost de las pantallas operativas.
   - Crear componentes base reutilizables: page header, KPI cards, filtros, tablas, tabs, modales, empty/loading/error states.
   - Alinear desktop y movil con el UI Kit documentado.

3. Validacion UI con API real
   - Login real.
   - Crear cliente desde pantalla.
   - Crear prestamo desde pantalla.
   - Registrar pago desde pantalla.
   - Crear/liquidar ruta desde pantalla.
   - Refrescar navegador y confirmar persistencia desde MySQL.

4. Reportes
   - Cuadrar `/reports/summary` contra datos reales.
   - Validar filtros por fecha, sucursal y cobrador.
   - Reducir calculos locales cuando exista resumen API confiable.

5. Sync movil
   - Mantener `sync/pull`.
   - Fortalecer `sync/push`.
   - Procesar `sync_queue` aplicando acciones al dominio.
   - Retornar resultado por accion.
   - Cubrir idempotencia y conflictos.

6. Produccion
   - Script/checklist Hostinger.
   - Backups MySQL y prueba de restore.
   - Limites de payload para fotos/logos.
   - Secretos fuertes en `.env`.
   - Monitoreo basico y healthcheck.

## Segunda Fase: Caja

Pendiente para una segunda fase, sin bloquear el avance actual a `Reportes`:

1. Apertura formal de caja
   - Crear flujo de apertura por sucursal/usuario o turno.
   - Definir estado operativo abierto/cerrado.

2. Sesion operativa de caja
   - Evolucionar de cierre snapshot a sesion completa de apertura/cierre.
   - Bloquear movimientos cuando la caja este cerrada, salvo permisos especiales.

3. Reglas de cierre mas estrictas
   - Mejor feedback visual para cierre duplicado del mismo dia.
   - Validaciones adicionales por diferencia, observaciones y permisos.

4. Historial avanzado
   - Separar mejor historial de movimientos vs historial de cierres.
   - Mejorar filtros, lectura temporal y navegacion entre ambos contextos.

5. Operaciones sobre movimientos
   - Evaluar ver detalle, anular o corregir movimientos manuales autorizados.

6. Reportes de caja
   - Exportar cierres por fecha, sucursal y responsable.
   - Integrar cierres de caja a reportes administrativos y operativos.

7. QA integral de caja
   - Probar flujo completo cuando todas las areas del panel esten completas.
   - Validar consistencia entre pagos, rutas, caja y reportes.

## Comandos Base

```bash
npm run dev
npm run dev:server
npm run typecheck
npm run test
npm run test:e2e -- --project=chromium
npm run build
```
