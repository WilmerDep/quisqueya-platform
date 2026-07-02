# Walkthrough: Consola GPS en Pantalla Completa Absoluta (Bypass Shell Layout)

He completado el desarrollo para desactivar el Shell del Layout general del sistema en PC y entregar el 100% de la ventana del navegador al monitoreo GPS de Rutas, imitando exactamente la experiencia inmersiva del PDF Builder.

## Cambios Realizados

### 1. Ocultamiento del Layout General (Bypass)
* **[MODIFY] [Layout.tsx](file:///c:/Users/UserGPC/OneDrive/Escritorio/REACT%20PROYECT/APPs/prestafacil-rd/components/Layout.tsx)**:
  * Agregada lógica para detectar si la URL actual apunta al subview de monitoreo (`/routes?view=tracking`) o al constructor de plantillas (`/settings/templates`).
  * Si la condición se cumple, el sidebar de navegación del sistema ("Escritorio, Cobrar Hoy...") y el header superior de la app se omiten por completo, renderizando los componentes a pantalla completa absoluta (`h-screen w-screen overflow-hidden`).

### 2. Sincronización de Rutas en la URL
* **[MODIFY] [RoutesPage.tsx](file:///c:/Users/UserGPC/OneDrive/Escritorio/REACT%20PROYECT/APPs/prestafacil-rd/pages/RoutesPage.tsx)**:
  * Reemplazado el estado local `isTrackingLive` por la lectura directa de parámetros de búsqueda (`?view=tracking`).
  * Al hacer clic en "Abrir consola", la app navega a `/routes?view=tracking`, activando el bypass del Shell. Al hacer clic en "Volver", la app retorna a `/routes`, restableciendo la barra de navegación del sistema de manera instantánea.

## Validación
* **Compilación**: Ejecutado `npm run typecheck` confirmando que todos los archivos compilan de forma limpia sin errores de tipos o rutas.
