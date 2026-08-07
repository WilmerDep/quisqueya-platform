# Quisqueya Travels — Platform Project Audit & Handoff

**Fecha de auditoría:** 2026-08-06 (America/Santo_Domingo)  
**Repositorio:** `WilmerDep/quisqueya-platform`  
**Rama de trabajo:** `main`  
**HEAD auditado:** `b3bc0d05f5d25c029ac5e180c609b5305f64a16d`  
**Rol del repositorio:** API/Core + CRM/admin + operaciones futuras.

---

## 1. Propósito de este documento

Este archivo resume el estado actual de la plataforma para permitir continuidad entre sesiones sin depender del historial de chat. Debe leerse junto con:

```text
docs/QUISQUEYA_MIGRATION_PLAN.md
```

y, para tareas que crucen el frontend público:

```text
WilmerDep/quisqueya-web
docs/audits/2026-08-06_PROJECT_AUDIT_HANDOFF.md
```

---

## 2. Arquitectura vigente y dirección

El repositorio proviene de la base PrestaFacil y se está transformando de manera controlada en la plataforma Quisqueya Travels.

Baseline histórico protegido:

```text
archive/pre-quisqueya-sanitization
```

No reescribir ni eliminar esa rama.

Stack / infraestructura retenida:

- NestJS API
- Prisma 7
- MySQL/MariaDB
- React/Vite para CRM/admin
- JWT / auth foundation
- roles/guards
- auditoría
- validación y manejo de excepciones
- Vitest
- Playwright
- TypeScript

Arquitectura objetivo:

```text
quisqueya-web
Public Next.js site
      |
      | HTTP API
      v
quisqueya-platform
NestJS / Prisma / MySQL
      |
      +-- Content Core
      +-- CRM
      +-- Operations
```

Dominios objetivo:

```text
quisqueyatravel.com.do      -> web pública
app.quisqueyatravel.com.do  -> CRM/admin
api.quisqueyatravel.com.do  -> NestJS API
```

Entornos provisionales usados durante desarrollo:

```text
https://quisqueya.pholiodev.com
https://apiquisqueya.pholiodev.com
https://crmquisquya.pholiodev.com
```

---

## 3. Estado de migración de arquitectura

Plan autoritativo existente:

```text
docs/QUISQUEYA_MIGRATION_PLAN.md
```

La dirección se mantiene:

1. sanitización del repositorio
2. Identity Core / seguridad
3. eliminación del dominio lending heredado
4. Content Core + Media
5. importación WordPress
6. CRM foundation
7. Operations

Regla fundamental:

- no convertir WordPress en dependencia runtime permanente;
- no eliminar infraestructura heredada útil sin comprobar dependencias;
- no introducir prematuramente complejidad SaaS que no corresponde a Phase 1;
- conservar provenance de contenido importado.

---

## 4. Content Core / Editorial API — estado implementado

Existe una API editorial protegida para experiencias.

Endpoints:

```text
GET   /api/v1/experiences/:experienceId/editorial
PATCH /api/v1/experiences/:experienceId/editorial
```

Campos editoriales gestionados:

```text
faqs
itinerary
included
excluded
practicalInfo
availability
contact
```

Metadata editorial:

```text
assistedByAi
reviewStatus
```

Seguridad:

- AuthGuard
- RolesGuard
- roles utilizados en este flujo: Super Admin, Administrador, Supervisor

Commits relevantes:

```text
694ebb198548d0efd5edd269b6a6398cbbe3c623 feat(content): add experience editorial API service
ac8d69e07316b4cb1fc5767552037edf4c185eef feat(content): expose protected experience editorial endpoints
736d19ad0433de14737abd0c5e8e570aa2b23293 feat(content): register experience editorial API
219be4a3a3885f8982a053a53efad6545c4beccd fix(content): allow editorial metadata-only updates
```

El fix `219be4a...` es importante: permite PATCH de metadata aunque no cambie contenido gestionado y preserva los flags administrados.

---

## 5. FAQs editoriales provisionales

Se añadió un flujo provisional de sincronización de FAQs para experiencias.

Commits:

```text
b985b75b95f5034fa63256e193d65f774488e887 feat(content): add provisional experience FAQ sync
8b0a7bffb4e6bb0ccd74c994cb8793eb189b0764 chore(content): register provisional FAQ sync command
b3bc0d05f5d25c029ac5e180c609b5305f64a16d fix(content): clear resolved cloned FAQ warning
```

Estado auditado:

- el mecanismo existe y el warning de FAQ clonada previamente detectado quedó marcado como resuelto en el último commit.
- sigue siendo un flujo **provisional**; no asumir que sustituye el modelo editorial final.
- próxima verificación funcional pendiente en este frente: confirmar comportamiento real de PATCH metadata-only y continuar revisión de FAQs de las experiencias objetivo cuando esa tarea se retome.

---

## 6. WordPress migration / contenido

Dirección aprobada:

- WordPress actual es fuente de migración.
- CRM/API será futura fuente de verdad.
- no reconstruir la extracción desde cero si ya existe conocimiento de `quisqueya-content-migration-v0.1/v0.2`.

Estado conocido del trabajo de migración:

### v0.1

Incluyó, entre otros:

- RAW `/wp-json/`
- namespaces y tipos relevantes
- CPT `tf_tours`
- taxonomías de tours
- WooCommerce product/taxonomies
- destinos
- experiencias destacadas
- transporte
- contratos TypeScript
- manifest/checksums

### v0.2

Fortaleció:

- extractor REST real
- timeout/reintentos
- validación de relaciones
- trazabilidad
- detección de inconsistencias
- endpoints de tours/taxonomías confirmados

Regla: **no asumir datos dudosos**; preservar provenance y marcar incertidumbres.

---

## 7. Deployment / staging — estado trabajado

Se documentó y preparó una dirección de despliegue con dos aplicaciones Node principales y proxy para CRM/API.

Commits recientes relevantes:

```text
07f32a4c... docs(deploy): add production environment template
95ab7ca6... chore(deploy): add PM2 process definition
14f79bed... chore(deploy): add production build and migration commands
78947e02... docs(deploy): add Nginx API reverse proxy template
a1808f44... docs(deploy): add repeatable production deployment guide
80e45968... docs(deploy): add provisional environment template
84872bad... docs(deploy): document provisional domain cutover
aed287f4... docs(deploy): configure PholioDev staging domains
6715b96b... docs(deploy): add PholioDev staging API proxy
92088166... docs(deploy): define two Node application architecture
5c36e95f... test(deploy): verify CRM static build
1e9de510... fix(deploy): include CRM static build in production pipeline
56f1f4f2... docs(deploy): add CRM staging proxy on shared platform process
```

No exponer secretos en documentación ni commits.

---

## 8. Seguridad y saneamiento — puntos aún relevantes

Del plan de migración siguen siendo requisitos antes de producción completa:

1. secretos JWT obligatorios por environment y fail-fast en producción;
2. revisar/eliminar lógica legacy de passwords PrestaFacil cuando deje de ser necesaria;
3. CORS restringido por environment;
4. sesiones persistentes / revocación de refresh tokens antes del rollout CRM real;
5. matriz de roles/permissions final de Quisqueya;
6. ningún demo credential en docs principales;
7. seeds de producción no deben crear usuarios demo accidentalmente;
8. revisar `relationMode = "prisma"` frente a FKs nativas.

No marcar estos ítems como resueltos sin evidencia concreta en código/configuración.

---

## 9. CRM / Operations — alcance actual

La plataforma se orienta a:

```text
Contact
 -> Lead
 -> TravelRequest
 -> Opportunity
 -> Quote
 -> Booking / Operation
```

Dirección CRM prevista:

- Contact
- Organization / Agency
- Lead
- TravelRequest
- Opportunity
- Quote / QuoteItem
- Task
- Note
- Interaction

Operations, para una fase posterior:

- Booking
- Traveler
- Supplier
- Transfer
- Vehicle assignment
- Operation
- Document

No adelantar Operations antes de que Content Core y CRM foundation estén suficientemente estables.

---

## 10. Integración con la web comercial — frontera actual

La web pública ya tiene UI de contacto/formulario, pero el envío real **no está conectado todavía**.

Esto es intencional.

Hasta autorización explícita de fase:

- NO crear endpoint de envío solo porque el formulario visual existe.
- NO conectar automáticamente leads/contactos desde `quisqueya-web`.
- mantener desacoplamiento y contrato claro cuando llegue esa fase.

Cuando se autorice la integración, diseñar el contrato primero y decidir si entra como:

```text
Contact + TravelRequest
```

o flujo equivalente del CRM definitivo.

---

## 11. Pasarela de pago

Decisión comercial vigente:

- Azul es la pasarela prevista para República Dominicana.
- pertenece a una fase futura (Fase 7 del alcance mencionado en documentación comercial).
- NO integrar ahora.
- se contempla una pasarela; una adicional como PayPal se cotiza aparte.

No confundir preparación arquitectónica con autorización de implementación.

---

## 12. Riesgos detectados

### R1 — coexistencia temporal de legado

El repositorio nació de PrestaFacil. No asumir que todo módulo heredado es parte del producto final.

### R2 — Content Core todavía evolutivo

Los endpoints editoriales existen, pero no implican que todo el modelo de contenido/CRM esté congelado.

### R3 — scripts provisionales

FAQ sync es provisional. Evitar convertirlo silenciosamente en fuente autoritativa sin decisión explícita.

### R4 — frontera web/API

La web puede adelantarse visualmente al backend. No usar esto como justificación para implementar procesos comerciales fuera de fase.

### R5 — seguridad producción

Las tareas del plan de sanitización deben reevaluarse con evidencia antes de considerar plataforma production-ready.

---

## 13. Próximas acciones recomendadas — orden

Cuando se retome plataforma/API:

1. Verificar estado limpio de `main` y leer este audit + `QUISQUEYA_MIGRATION_PLAN.md`.
2. Confirmar metadata-only PATCH con un caso real si aún no se validó end-to-end.
3. Continuar revisión editorial/FAQs solo sobre experiencias autorizadas.
4. Auditar cuánto del Content Core está ya modelado y qué parte sigue provisional.
5. Mantener seguridad/sanitización como gate antes de expansión CRM.
6. Cuando el usuario autorice integración del formulario web, diseñar primero contrato/API y pipeline CRM.
7. No iniciar Azul/pagos hasta la fase correspondiente.

---

## 14. Regla de ejecución para el siguiente agente/chat

- Trabajar sobre `WilmerDep/quisqueya-platform`, rama `main`, salvo instrucción distinta.
- Leer este documento y `docs/QUISQUEYA_MIGRATION_PLAN.md` antes de cambios estructurales.
- No reconstruir módulos existentes sin auditar su implementación.
- Preservar `archive/pre-quisqueya-sanitization`.
- Hacer commits pequeños y trazables.
- No introducir secretos en repositorio.
- No afirmar build/tests ejecutados si no se ejecutaron realmente.
- Distinguir siempre entre: implementado, provisional, pendiente de validación y futuro/no autorizado.

---

## 15. Referencia cruzada de web

La auditoría de la web comercial está en:

```text
WilmerDep/quisqueya-web
docs/audits/2026-08-06_PROJECT_AUDIT_HANDOFF.md
```

Leer ambas cuando una tarea involucre formularios, contenido público, experiencias, media, SEO, CRM o endpoints compartidos.
