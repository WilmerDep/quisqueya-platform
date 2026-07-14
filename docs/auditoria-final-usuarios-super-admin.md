# Auditoría final visual, funcional y responsive - Usuarios Super Admin

**Fecha:** 2026-07-13  
**Módulo auditado:** Usuarios del Super Admin  
**Ruta principal:** `/super-admin/usuarios`  
**Referencia visual:** Clientes del Admin Empresa  
**Fuente de verdad documental:** `docs/analisis-plataforma-abundra-handoff.md`

## Errores críticos

- No se detectaron errores críticos de compilación, typecheck, tests o build en el módulo Usuarios del Super Admin.
- La auditoría visual en navegador no pudo completarse con captura real por un fallo interno del runtime de browser automation: `codex/sandbox-state-meta: missing field sandboxPolicy`. La validación responsive queda basada en revisión estática de código y patrones implementados.
- Las acciones críticas de sesiones, roles, invitaciones y permisos todavía no tienen validación backend completa visible para todos los flujos. Esto no rompe la UI, pero impide considerar el módulo listo para producción operativa completa.

## Errores visuales

- Persisten textos con mojibake en el módulo Super Admin, por ejemplo símbolos tipo `â†‘` / `â†“` en tendencias y textos que pueden aparecer como `ConfiguraciÃ³n`, `facturaciÃ³n` o similares si el archivo no se normaliza completamente a UTF-8.
- La escala visual general ya se acerca a Admin Empresa, pero hay restos de bloques antiguos ocultos con `hidden` dentro de `SuperAdminPage.tsx`. No afectan la vista actual, pero aumentan el riesgo de estilos inconsistentes o deuda visual.
- La subvista Equipo SaaS usa un buscador más simple que el patrón completo de FilterBar de Clientes. Es aceptable por alcance, pero no es 100% simétrica con Usuarios de Empresas, Invitaciones y Sesiones.
- La matriz de Roles y Permisos conserva una estructura más densa que el listado tipo Admin. Visualmente ya está mejor organizada, pero sigue siendo el área con más riesgo de sentirse distinta si crece la cantidad de permisos.

## Errores funcionales

- Las rutas de tabs están correctamente conectadas a la URL: Equipo SaaS, Usuarios de Empresas, Invitaciones, Roles y Permisos, Sesiones.
- La recarga conserva el tab activo mediante mapeo de pathname.
- Query params, debounce y filtros están implementados en las subvistas principales con barra de filtros.
- Usuarios de Empresas tiene paginación y sorting real en frontend; otras subvistas todavía trabajan como listados completos.
- Varias acciones avanzadas siguen siendo de intención UI o simulación controlada: revocar sesiones, endurecer políticas, acciones completas de invitaciones, edición profunda de roles y permisos.
- La auditoría de acciones críticas no está persistida de punta a punta para todos los casos.
- El drawer de detalle de Usuario Tenant existe con secciones de identidad, empresa/sucursal, rol/permisos, seguridad, actividad, sesiones y auditoría, pero depende de datos ya disponibles en frontend.

## Errores responsive

- El módulo usa patrones responsive correctos: tabs con scroll horizontal en móvil, filtros con drawer/bottom sheet, tablas convertidas a cards móviles y grids adaptativos.
- En 1440px o superior, el layout debe percibirse amplio y alineado con Admin Empresa.
- En 1280px, Sesiones y Roles pueden sentirse más apretados por el panel lateral. La tabla tiene prioridad razonable, pero conviene validarlo visualmente en navegador.
- En 1024px, los paneles laterales pasan debajo o se reorganizan según breakpoints; no se detecta dependencia crítica de ancho fijo.
- En 768px, filtros y tabs deberían conservar navegación usable con scroll horizontal.
- En 390px, las tablas principales pasan a cards móviles, pero falta validación real por captura debido al fallo del browser automation.

## Errores de accesibilidad

- Los tabs tienen roles ARIA básicos (`tablist`, `tab`, `tabpanel`) y estado activo accesible.
- Hay botones de acciones con `aria-label` en menús contextuales principales.
- Falta focus trap formal en `ModalFrame`.
- Falta cierre con Escape y restauración de foco documentada en modales/drawers.
- Algunos botones de paginación o acciones antiguas pueden depender solo del contenido visual y deberían revisarse con lector de pantalla.
- Los dropdowns/filtros no muestran una implementación completa de navegación con flechas de teclado.
- El focus visible existe parcialmente por estilos del navegador y clases de foco en algunos componentes, pero no está normalizado en todo el módulo.

## Errores de seguridad

- La separación visual y lógica SaaS/Tenant está implementada en frontend: Equipo SaaS filtra `user_scope = SAAS` y `empresa_id = null`; Usuarios de Empresas excluye usuarios SaaS y requiere contexto tenant.
- El frontend no debe ser la fuente de verdad para permisos. Las acciones críticas necesitan validación backend antes de producción.
- No se verificó endpoint backend completo para revocar sesiones, bloquear IP, endurecer políticas, administrar matriz de roles o persistir invitaciones avanzadas.
- La acción de acceso como soporte está protegida por permiso en UI, pero falta validar flujo completo de impersonación, trazabilidad y salida segura.
- La manipulación de `empresa_id` por query params no debe confiarse al frontend; el backend debe validar scope y permisos en cada endpoint.
- La auditoría de acciones críticas está planteada en UI, pero no queda confirmada como registro persistente para todos los flujos.

## Correcciones realizadas

- Se creó este reporte de auditoría final en Markdown.
- No se realizaron cambios funcionales ni visuales en el código productivo durante esta fase.
- No se agregaron nuevas funciones.
- No se tocaron archivos sensibles como `Layout.tsx`, `AuthContext.tsx`, `types.ts`, `dataService.ts` o `apiClient.ts` durante esta auditoría.

## Pendientes

- Normalizar encoding del archivo `pages/SuperAdminPage.tsx` a UTF-8 y corregir todos los textos con mojibake.
- Eliminar o extraer los bloques legacy ocultos dentro de `SuperAdminPage.tsx` cuando ya no sean necesarios.
- Implementar backend real para acciones críticas de sesiones, invitaciones, roles y permisos.
- Persistir auditoría para acciones sensibles.
- Agregar focus trap, Escape close y restauración de foco en `ModalFrame`.
- Validar visualmente en navegador los breakpoints 1440px, 1280px, 1024px, 768px y 390px cuando el runtime de browser automation esté disponible.
- Añadir pruebas específicas de navegación por tabs, query params, filtros, paginación, sorting y permisos.
- Revisar si Equipo SaaS debe adoptar FilterBar completo o mantener buscador simple por alcance reducido.

## Resultado de lint

`npm run lint -- --quiet` falló con 13 errores heredados fuera del módulo Usuarios Super Admin:

- `pages/ClientProfile.tsx`: asignaciones no usadas.
- `pages/CollectTodayPage.tsx`: asignación no usada.
- `pages/Reports.tsx`: expresiones constantes.
- `pages/RoutesPage.tsx`: asignación no usada.
- `services/pdfBuilder.ts`: escapes innecesarios, asignaciones no usadas, condición constante y `prefer-const`.
- `tests/e2e/api-backed.spec.ts`: patrón de objeto vacío.

No apareció un error de lint específico en `pages/SuperAdminPage.tsx` en esta ejecución.

## Resultado de typecheck

`npm run typecheck` pasó correctamente.

Resultado:

```text
tsc --noEmit && tsc -p server/tsconfig.json --noEmit
Exit code: 0
```

## Resultado de tests

`npm run test` pasó correctamente.

Resultado:

```text
Test Files  3 passed (3)
Tests       10 passed (10)
Exit code: 0
```

Validación adicional:

```text
npm run build
Exit code: 0
```

El build completó frontend y backend. Quedaron advertencias no bloqueantes de Vite sobre tamaño de chunks y doble import dinámico/estático de `services/dataService.ts`.
