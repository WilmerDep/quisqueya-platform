# Analisis de Plataforma ABUNDRA

**Fecha:** 2026-06-30  
**Proyecto:** ABUNDRA / base actual `prestafacil-rd`  
**Objetivo del documento:** dejar un mapa tecnico real de la plataforma para delegar trabajo entre equipos sin pisar layout, logica ni contratos.

## 1. Diagnostico breve

La plataforma ya tiene una base funcional amplia en frontend y backend:

- Panel web en `React + Vite + TypeScript`.
- API en `NestJS + TypeScript`.
- Persistencia objetivo en `Prisma + MySQL`.
- Fallback local importante en `services/dataService.ts`.
- Sistema multirol con foco en `Admin Empresa`, `Supervisor`, `Cobrador` y `Super Admin`.

El estado actual no es de proyecto vacio ni de MVP crudo. Ya existe una arquitectura navegable y varios modulos operativos estan montados. El principal reto ya no es "construir desde cero", sino **alinear visualmente, consolidar componentes, cerrar brechas entre modo local y API, y ordenar la ejecucion por frentes**.

## 2. Causa probable del estado actual

La plataforma evoluciono en paralelo por varios frentes:

- Se construyo una experiencia visual moderna para el panel Admin Empresa.
- El modulo `Super Admin` quedo funcional, pero con una identidad visual distinta y mas pesada.
- Conviven dos fuentes de verdad:
  - API real para varios flujos.
  - almacenamiento local/demo en `dataService.ts`.
- Hay mucha logica reutilizable centralizada, pero todavia no todos los modulos comparten el mismo sistema visual.

Resultado: la plataforma ya funciona como producto, pero todavia necesita una fase clara de **unificacion, reparto por ownership y endurecimiento tecnico**.

## 3. Solucion recomendada

La mejor estrategia no es rehacer nada, sino trabajar por capas:

1. Mantener rutas, contratos y logica funcional existente.
2. Separar ownership por area para evitar choques.
3. Reutilizar layout y patrones ya buenos del Admin Empresa.
4. Tratar `Super Admin` como frente visual/control global, no como modulo operativo.
5. Documentar claramente que archivos son compartidos y requieren coordinacion.

## 4. Stack real encontrado

### Frontend

- `React 19`
- `Vite`
- `TypeScript`
- `react-router-dom`
- `Tailwind v4`
- `lucide-react`
- `recharts`
- `gsap`

### Backend

- `NestJS 11`
- modulos por dominio en `server/src/modules/*`
- `ValidationPipe`
- filtro global de excepciones
- prefijo API `api/v1`

### Datos

- `Prisma`
- `MySQL` como base oficial
- migraciones SQL en `server/migrations/`
- esquema principal en [prisma/schema.prisma](/abs/path/C:/Users/UserGPC/OneDrive/Escritorio/REACT%20PROYECT/APPs/prestafacil-rd/prisma/schema.prisma:1)

### Calidad

- `Vitest`
- `Playwright`
- `ESLint`
- scripts de `typecheck`, `build`, `test` y `test:e2e`

## 5. Arquitectura actual resumida

### 5.1 Shell de la app

La app entra por [App.tsx](/abs/path/C:/Users/UserGPC/OneDrive/Escritorio/REACT%20PROYECT/APPs/prestafacil-rd/App.tsx:1).

Puntos clave:

- usa `HashRouter`
- separa rutas publicas y privadas
- envuelve rutas privadas con `Layout`
- redirige `Super Admin` a `/master`

### 5.2 Layout compartido

El layout principal esta en [components/Layout.tsx](/abs/path/C:/Users/UserGPC/OneDrive/Escritorio/REACT%20PROYECT/APPs/prestafacil-rd/components/Layout.tsx:1).

Hoy este archivo ya resuelve mucho:

- sidebar claro
- topbar clara
- buscador global
- notificaciones
- selector de empresa/sucursal
- menu por rol
- modal critico global
- blocking states
- toasts
- mobile nav

Conclusión: **el Admin Empresa ya tiene el lenguaje visual correcto y el shell mas maduro del sistema**.

### 5.3 Autenticacion

La sesion vive en [context/AuthContext.tsx](/abs/path/C:/Users/UserGPC/OneDrive/Escritorio/REACT%20PROYECT/APPs/prestafacil-rd/context/AuthContext.tsx:1).

Modo actual:

- intenta login/API primero
- si la API falla, cae a modo local
- mantiene sesion persistida
- soporta `switchUser` local para demo/simulacion

Esto es util para desarrollo, pero tambien implica que cualquier cambio de flujos debe respetar ambos escenarios.

### 5.4 Backend modular

La API carga estos modulos principales desde [server/src/app.module.ts](/abs/path/C:/Users/UserGPC/OneDrive/Escritorio/REACT%20PROYECT/APPs/prestafacil-rd/server/src/app.module.ts:1):

- `auth`
- `companies`
- `branches`
- `users`
- `clients`
- `loans`
- `payments`
- `cash`
- `routes`
- `reports`
- `audit`
- `sync`

Conclusión: el backend ya esta organizado por dominios y soporta una evolucion seria.

## 6. Modulos funcionales detectados

### Publico

- landing
- auth/login

### Admin Empresa / Supervisor / Cobrador

- dashboard
- actividad
- cobrar hoy
- clientes
- perfil cliente
- prestamos
- crear prestamo
- rutas
- caja
- usuarios
- reportes
- configuracion

### Super Admin

- dashboard/monitor global
- empresas
- planes
- kernel/configuracion global
- auditoria

Nota importante: a nivel de documento maestro del producto existen mas vistas definidas que las actualmente implementadas en UI. O sea, **el mapa funcional del producto va mas adelante que la cobertura real del frontend**.

## 7. Roles y alcance

Roles detectados en [types.ts](/abs/path/C:/Users/UserGPC/OneDrive/Escritorio/REACT%20PROYECT/APPs/prestafacil-rd/types.ts:1):

- `Super Admin`
- `Administrador`
- `Supervisor`
- `Cobrador`

### Regla de negocio vigente

- `Super Admin` opera el SaaS global.
- `Admin Empresa` opera su tenant.
- `Supervisor` opera con alcance controlado por sucursal/equipo.
- `Cobrador` opera solo su flujo y cartera asignada.

El alcance por sucursal y permisos ya aparece implementado tanto en frontend como en backend:

- frontend: `services/viewScope.ts`
- backend: `server/src/shared/scope.ts`

## 8. Fuente de verdad y madurez tecnica

### Lo bueno

- ya existe contrato API usable en [services/apiClient.ts](/abs/path/C:/Users/UserGPC/OneDrive/Escritorio/REACT%20PROYECT/APPs/prestafacil-rd/services/apiClient.ts:1)
- ya existe esquema Prisma amplio
- ya existe semilla/demo local para avanzar sin bloquear frontend
- hay documentacion de producto, arquitectura funcional y BD

### Lo delicado

- `services/dataService.ts` es muy grande y mezcla seed, reglas, fallback, simulacion y operaciones de negocio
- varias pantallas pueden seguir dependiendo parcialmente de localStorage
- el `Super Admin` actual todavia no consume un sistema visual compartido con el resto del panel

## 9. Evaluacion por area

### 9.1 Frontend shell

**Estado:** fuerte  
**Comentario:** el layout general ya tiene una direccion premium y reutilizable.

### 9.2 Dashboard Admin

**Estado:** fuerte  
**Comentario:** visualmente es la referencia correcta del producto.

### 9.3 Super Admin

**Estado:** funcional, pero desacoplado visualmente  
**Comentario:** es el frente mas claro para intervenir sin alterar la operacion central.

### 9.4 Operacion diaria

**Estado:** medio-alto  
**Comentario:** existen modulos de clientes, prestamos, cobros, rutas y caja, pero hay que seguir validando que todos usen API y estados consistentes.

### 9.5 Backend

**Estado:** medio-alto  
**Comentario:** la base esta bien orientada, aunque no todo el frontend parece completamente desacoplado del fallback local.

### 9.6 Design system

**Estado:** parcial  
**Comentario:** hay componentes y patrones buenos, pero todavia no parece existir una libreria UI interna completamente consolidada.

## 10. Riesgos tecnicos reales

### Riesgo 1: tocar archivos compartidos sin ownership

Archivos como `Layout.tsx`, `types.ts`, `apiClient.ts` y `dataService.ts` afectan muchos frentes a la vez.

### Riesgo 2: romper compatibilidad entre API y fallback local

Si un frente cambia una forma de datos sin revisar el modo local, puede romper demos o rutas secundarias.

### Riesgo 3: duplicar componentes visuales

Si `Super Admin` se rehace con componentes propios, se agranda la deuda en vez de reducirla.

### Riesgo 4: mezclar alcance de producto

El `Super Admin` no debe heredar modulos operativos de empresa como `Cobrar Hoy`, `Clientes`, `Prestamos`, `Rutas` o `Caja`.

### Riesgo 5: editar UI mientras otro frente toca shell compartido

Si otro equipo modifica `Layout.tsx` al mismo tiempo que se adapta `Super Admin`, hay alto riesgo de conflictos.

## 11. Archivos y modulos mas sensibles

### Compartidos de alto impacto

- [components/Layout.tsx](/abs/path/C:/Users/UserGPC/OneDrive/Escritorio/REACT%20PROYECT/APPs/prestafacil-rd/components/Layout.tsx:1)
- [context/AuthContext.tsx](/abs/path/C:/Users/UserGPC/OneDrive/Escritorio/REACT%20PROYECT/APPs/prestafacil-rd/context/AuthContext.tsx:1)
- [types.ts](/abs/path/C:/Users/UserGPC/OneDrive/Escritorio/REACT%20PROYECT/APPs/prestafacil-rd/types.ts:1)
- [services/dataService.ts](/abs/path/C:/Users/UserGPC/OneDrive/Escritorio/REACT%20PROYECT/APPs/prestafacil-rd/services/dataService.ts:1)
- [services/apiClient.ts](/abs/path/C:/Users/UserGPC/OneDrive/Escritorio/REACT%20PROYECT/APPs/prestafacil-rd/services/apiClient.ts:1)

### Pantallas de referencia visual

- [pages/Dashboard.tsx](/abs/path/C:/Users/UserGPC/OneDrive/Escritorio/REACT%20PROYECT/APPs/prestafacil-rd/pages/Dashboard.tsx:1)
- [pages/Reports.tsx](/abs/path/C:/Users/UserGPC/OneDrive/Escritorio/REACT%20PROYECT/APPs/prestafacil-rd/pages/Reports.tsx:1)
- [pages/UsersManagement.tsx](/abs/path/C:/Users/UserGPC/OneDrive/Escritorio/REACT%20PROYECT/APPs/prestafacil-rd/pages/UsersManagement.tsx:1)

### Frente Super Admin

- [pages/SuperAdminPage.tsx](/abs/path/C:/Users/UserGPC/OneDrive/Escritorio/REACT%20PROYECT/APPs/prestafacil-rd/pages/SuperAdminPage.tsx:1)

## 12. Division recomendada del trabajo

## Codex

**Ownership recomendado:** `Super Admin`

Alcance recomendado:

- unificacion visual completa del modulo `Super Admin`
- migrar `pages/SuperAdminPage.tsx` al mismo lenguaje del `Admin Empresa`
- extraer/reutilizar componentes compartidos solo si ya existe duplicacion clara
- mantener intacta la logica funcional actual
- documentar `TODOs` donde aun falte API real

No deberia tocar:

- flujos operativos de cobrador
- dashboard operativo de empresa salvo para tomar referencia visual
- reglas de negocio de pagos, prestamos, caja o rutas

## Antigravity

**Ownership recomendado:** `Dashboard Admin`, `Supervisor`, `Cobrador`

Alcance recomendado:

- evolucion de pantallas operativas
- ajustes de UX en dashboard y flujos de gestion diaria
- mejoras de rutas, cobrar hoy, actividad o modulos ligados a operacion real
- validacion de estados de carga, vacio, error y exito por rol

No deberia tocar:

- identidad global del `Super Admin`
- estructura funcional del SaaS global

## 13. Regla de coordinacion entre equipos

Si ambos frentes avanzan al mismo tiempo, conviene fijar esta regla:

- `Layout.tsx` solo se toca si es estrictamente necesario.
- Si el cambio es solo visual de `Super Admin`, debe resolverse primero dentro de `pages/SuperAdminPage.tsx`.
- Si hay que extraer componentes compartidos, hacerlo en piezas nuevas y pequeñas, no reescribiendo el shell completo.
- `types.ts`, `apiClient.ts` y `dataService.ts` requieren coordinacion previa porque son archivos de alto radio de impacto.

## 14. Plan recomendado por fases

### Fase 1

- congelar ownership por modulo
- no tocar contratos compartidos sin acuerdo
- usar `Dashboard` como referencia visual oficial

### Fase 2

- Codex trabaja `Super Admin`
- Antigravity trabaja dashboards y flujos operativos

### Fase 3

- consolidar componentes comunes reales
- eliminar estilos duplicados
- revisar responsive global

### Fase 4

- cerrar brechas entre local fallback y API real
- endurecer QA por rol y por tenant

## 15. Backlog tecnico prioritario detectado

1. Unificar visualmente `Super Admin`.
2. Reducir dependencia visual a implementaciones aisladas por pantalla.
3. Revisar que las vistas mas importantes usen el mismo sistema de cards, tablas, filtros y topbars.
4. Seguir migrando flujos criticos hacia API real sin romper fallback local.
5. Partir `dataService.ts` a futuro por dominios cuando toque refactor tecnico, no durante cambios visuales.

## 16. Conclusion operativa

La plataforma **ya tiene base real de producto** y no deberia tratarse como prototipo. El shell principal y el dashboard Admin ya marcan una direccion fuerte. El mayor desacople visible hoy esta en `Super Admin`, que es justamente el frente mas limpio para delegar.

La division recomendada queda asi:

- **Codex:** `Super Admin`, unificacion visual SaaS global, componentes compartidos puntuales.
- **Antigravity:** dashboard admin, supervisor y cobrador, mas operacion diaria.

Eso permite avanzar en paralelo con bajo riesgo, siempre que se respete la frontera de archivos compartidos.

## 17. Archivos a tocar para este entregable

- [docs/analisis-plataforma-abundra-handoff.md](/abs/path/C:/Users/UserGPC/OneDrive/Escritorio/REACT%20PROYECT/APPs/prestafacil-rd/docs/analisis-plataforma-abundra-handoff.md:1)

## 18. Pruebas sugeridas

- Validar que el reparto por ownership quede aceptado antes de tocar componentes compartidos.
- Revisar visualmente el `Dashboard` y `SuperAdminPage` como punto de comparación principal.
- Cuando arranque la implementación, correr como mínimo:
  - `npm run typecheck`
  - `npm run build`
  - pruebas manuales por rol y por ruta impactada
