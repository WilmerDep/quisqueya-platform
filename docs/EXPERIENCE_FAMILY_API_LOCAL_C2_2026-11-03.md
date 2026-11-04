# API de experiencias y modalidades — ciclo C2 local (03/11/2026)

**Estado:** implementación de lectura preparada y probada localmente; versionada en la rama aislada `feat/experience-family-api-local-20261103` para sincronizar con la copia local de Wilmer. No se han creado padres ni modificado datos. Este documento no constituye aprobación de staging.

## Fuente y alcance

- Decisión de Wilmer: la **API es la fuente de verdad**; la web consume experiencias, paquetes, tarifas y condiciones desde ella. El CRM administrará estos datos en su fase posterior.
- Referencia de negocio: documento de Breidy Solano, *Tercera parte excursiones descriptivos.docx*, páginas 6–14, con 13 modalidades de Bávaro Adventure Park, según la [issue #9](https://github.com/WilmerDep/quisqueya-platform/issues/9).
- Los 13 registros actuales del archivo `data/content/client-experiences-2026-09-bavaro-adventure-park.seed.json` tienen `familyKey` y `familyContextRef`. El importador específico conserva procedencia en `provenanceJson`; eso **no** reemplaza la relación comercial pública.
- Se preserva `GET /api/v1/public/experiences`, `GET /api/v1/public/experiences/:slug` y los datos existentes de `getSnapshot()` sin crear otro endpoint ni otro modelo Prisma.

## Representación canónica propuesta para C2

Un registro **padre publicado** de `Experience`, con identidad y elementos comunes propios, declara explícitamente su selección en `displayJson`:

```json
{
  "experienceFamily": {
    "version": 2,
    "mode": "multi_inquiry",
    "packageSlugs": [
      "bavaro-adventure-park-buggy-vip",
      "bavaro-adventure-park-zipline-mega-splash"
    ]
  }
}
```

**Ejemplo parcial de estructura, no un payload verificado en Postman.** La lista definitiva debe incluir los 13 slugs correctos y únicos según el seed y la revisión editorial. Los 13 hijos permanecen como registros `Experience` independientes para mantener datos específicos y las URL históricas; su pertenencia pública al padre la define la lista explícita `packageSlugs`, **no** el frontend ni `provenanceJson`.

Modos reconocidos por el lector: `single`, `multi_inquiry`, `addons`. Esta primera implementación resuelve referencias a **hijos `Experience` publicados**; no convierte todavía `pricing.ratePlans` o `addOns` embebidos de La Hacienda, Coco Bongo y El Dorado en el mismo esquema. Su integración necesitará adaptación por modalidad.

## Contrato de respuesta, retrocompatible

| Endpoint | Comportamiento cuando hay un padre con hijos publicados | Sin configuración v2 |
| --- | --- | --- |
| `GET /api/v1/public/experiences` | Una tarjeta del padre con `kind: "package_family"`, `packageCount` y `packageSelection`; oculta esas tarjetas hijas del **listado** | Exactamente la experiencia legacy |
| `GET /api/v1/public/experiences/:slug` (padre) | Campos actuales del padre + `packages[]` ordenados por `packageSlugs`, con todos los campos públicos de cada hijo publicado | Exactamente el detalle legacy |
| `GET /api/v1/public/experiences/:slug` (hijo) | Mantiene la respuesta individual y su slug | Sin cambios |
| Snapshot público | Usa el mismo listado normalizado | Sin cambios |

Ejemplo **esquemático**, sin importes, inclusiones ni reglas comerciales supuestas:

```json
{
  "slug": "bavaro-adventure-park",
  "kind": "package_family",
  "packageCount": 13,
  "packageSelection": { "version": 2, "mode": "multi_inquiry" },
  "packages": [
    {
      "slug": "bavaro-adventure-park-buggy-vip",
      "title": "Buggy VIP – Bávaro Adventure Park",
      "pricingMode": "fixed",
      "pricing": { "currency": "USD", "basis": "person", "from": 99 },
      "included": [],
      "excluded": []
    }
  ]
}
```

El ejemplo incluye únicamente una modalidad abreviada por legibilidad. `included`/`excluded` vacíos son marcadores de ejemplo, **no valores del producto**. El resultado real conserva los campos existentes que proporciona cada hijo, su propia media, duración, precios y restricciones. `packages[]` no aparece en la respuesta del listado para evitar payloads duplicados.

## Reglas de seguridad incorporadas

1. La configuración requiere `version: 2`, modo reconocido, slugs válidos, únicos, sin autorreferencia y un máximo de 100 referencias. Las configuraciones inválidas no activan agrupación.
2. Solo se resuelven hijos `PUBLISHED`. Si ninguno lo está, el padre permanece como ficha normal, sin selector vacío ni desaparición accidental.
3. Si dos padres reclaman el mismo slug, o se detecta anidación en el catálogo, no se ocultan fichas de esas relaciones conflictivas. La validación editorial de relaciones únicas es requisito previo a publicación de datos.
4. El detalle de un hijo sigue accesible con su slug existente; no hay redirecciones SEO automáticas.
5. El precio «desde» del padre se calcula **solo** cuando todos los hijos publicados tienen `pricingMode: fixed`, `from` finito no negativo, y la misma moneda/base. En otro caso, el padre pasa a `on_request` y no publica un precio heredado incierto.
6. `multi_inquiry` indica **consulta por combinación**, sin sumar actividades, alimentación, descuentos infantiles ni generar tarifas de infantes o Polaris.
7. No se copian inclusiones, itinerarios o condiciones de un hijo al contenido común del padre.

## Estado de implementación y pruebas locales

| Componente | Cambio |
| --- | --- |
| `server/src/modules/content/content.types.ts` | Campos v2 opcionales y tipados en `PublicExperience` |
| `server/src/modules/content/experience-families.ts` | Validación y resolución pura de familias, listado y precio orientativo |
| `server/src/modules/content/content.service.ts` | Lectura adicional de hijos publicados para detalle y agrupación de catálogo |
| `server/src/modules/content/experience-families.test.ts` | Pruebas unitarias de casos normales y errores |
| `server/src/modules/content/content-family.service.test.ts` | Pruebas del servicio y consultas Prisma simuladas |

Pruebas a ejecutar/cerrar: Vitest específico de familias, ESLint de archivos tocados, `tsc` de servidor y revisión local. **No existe todavía prueba contra la base de staging ni contra la colección Postman mencionada por Wilmer.**

## Qué falta antes de conectar la web o pasar a staging

1. **C0 pendiente:** contrastar la estructura vista en Postman con el backend de `main` y este contrato. No afirmar equivalencia sin el JSON o la colección.
2. **C3 pendiente:** preparar script *dry-run* idempotente para crear/verificar el padre `bavaro-adventure-park` y sus 13 referencias, validar colisiones, medios y publicación, además del plan de reversión. No ejecutar mutaciones todavía.
3. **C4 pendiente:** adaptar `quisqueya-web` PR #12 a `packages[]` con fallback transitorio, guardando toda la información de cada paquete (incluidos/excluidos, preguntas, restricciones, GSAP, WhatsApp/email) y sin duplicar tarifas.
4. **C5 pendiente:** revisar en local el listado y la single, selector acorde a la experiencia, combinaciones y móvil de 390 px, antes de proponer staging.
5. **Aprobación requerida:** los cambios a datos, publicación en staging, merge y actualización de CRM quedan fuera de este ciclo local.

Se documenta así un primer lector de API útil sin migraciones, pero el catálogo real **no se unificará** hasta que exista y se publique un padre con `displayJson.experienceFamily` validado. La compatibilidad con La Hacienda/Coco Bongo/El Dorado continúa como trabajo separado, sin asumir que todos usan 13 registros hijos.
