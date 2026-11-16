# C16 — Recuperación editorial de itinerarios de Bávaro y La Hacienda

**Fecha:** 16 de noviembre de 2026  
**Estado:** PROPUESTA PARA REVISIÓN; SIN CAMBIOS EN MYSQL NI STAGING

## Diagnóstico confirmado

En el MySQL de staging consultado por Wilmer (`u424080957_quisqueya_core`) aparecen **28 experiencias**: **17 sin entradas en `itinerary_json`** (14 PUBLISHED y 3 DRAFT). De las 14 publicadas sin itinerario, **13 pertenecen a las modalidades individuales de Bávaro Adventure Park** y **una es La Hacienda Park – 7 Aventuras**. Las otras tres sin pasos son las fichas padre DRAFT `bavaro-adventure-park`, `altos-de-chavon` y `el-dorado-water-park-cap-cana`.

Las semillas existentes `client-experiences-2026-09-bavaro-adventure-park.seed.json` y `client-experiences-2026-09-la-hacienda-park.seed.json` tampoco definen `itinerary`. Los importadores transforman `undefined` en arreglo vacío. Esto explica el faltante de **datos** en los 14 registros: no es solo CSS.

## Fuente inspeccionada

**Breidy Solano / Quisqueya Travel — `Tercera parte excursiones descriptivos.docx`, 36 páginas** (biblioteca del proyecto).

- Páginas **6–14**: catálogo de 13 modalidades, duraciones, descripción e inclusiones de Bávaro Adventure Park.
- Páginas **21–28**: condiciones de La Hacienda, 7 aventuras, diferencias entre Standard, Standard + Almuerzo, Solo Admisión, VIP y residentes, transporte y recogidas.
- El documento **no presenta un itinerario con horarios/orden confirmado para cada paquete**. Describe actividades y secuencias parciales, por ejemplo, recorridos de buggy y almuerzo posterior, o trayecto hotel → parque → hotel para Standard en La Hacienda. No elevar una lista de inclusiones a programa cronometrado o contractual.

**Propuesta editable:** `data/content/itinerary-proposals-2026-11-bavaro-hacienda.json`: 14 correspondencias exactas y 55 bloques editoriales, con `time/title/desc` compatibles con la web. Todos están marcados `operatorSequenceConfirmed=false`, `reviewStatus=editorial_proposal` y `status=PROPOSED_NOT_APPLIED`.

## Protección comercial

- **No clonar itinerarios entre paquetes**. Las 13 modalidades diurnas/nocturnas/combinadas tienen entradas diferenciadas. En Polaris solo mencionar acceso a actividades, no tarifas infantiles ni requisitos que faltan por confirmar. 
- **La Hacienda**: la ficha padre tiene cinco modalidades de precio; nunca decir que toda la experiencia incluye traslado ni almuerzo. Standard/solo admisión tienen almuerzo opcional con suplemento; VIP y residentes indican alimentación incluida en la fuente. Transporte propio aplica a Solo Admisión y residentes.
- **Sacred River + Zipline** y **Full Access Polaris**: evitar almuerzo no confirmado en su semilla.
- No inventar horas, secuencia invariable, punto de recogida, suplemento, gratuidad, tiempo total por paso o disponibilidad de las actividades.
- En la UI, titular **«Recorrido orientativo»** hasta confirmación operacional; mostrar aviso de que el proveedor define orden y horarios.
- **Altos de Chavón**: las variantes hijas ya tienen 6 y 8 pasos en staging; la web de familias usa `experience.itinerary` (padre) en vez del itinerario del paquete seleccionado. Requiere ajuste visual propio, **no copiar los pasos al padre**.

## Preflight SQL de staging, únicamente lectura (preparado)

`scripts/audit-staging-itinerary-preflight-c16.mjs` emite una consulta `SELECT` que coteja **ID y slug al mismo tiempo** para las 14 experiencias PUBLISHED/MANUAL, e incluye `updated_at`, `JSON_LENGTH(itinerary_json)` y `c16_preflight`. El script **no conecta a MySQL ni emite UPDATE**.

```powershell
node scripts/verify-editorial-itineraries-2026-11.mjs
node scripts/audit-staging-itinerary-preflight-c16.mjs
```

Ejecutar el SQL devuelto en phpMyAdmin con la base **u424080957_quisqueya_core** seleccionada, sin alterar credenciales ni datos. Debe devolver **14 filas** con `c16_preflight=C16_CANDIDATE`, `status=PUBLISHED`, `source_provider=MANUAL` e `itinerary_steps=0`. Si hay menos, diferencias de IDs, más de 0 pasos o cualquier otra discrepancia, **detener**.

El archivo de propuestas sigue siendo **editorial y no aprobado**. Un resultado positivo del SELECT **no autoriza** modificaciones de los registros hasta revisar contenidos, exportar el respaldo e implementar la transacción de actualización con controles y rollback.

## Nota de UI sobre las cinco modalidades de La Hacienda

La Hacienda es **una sola fila** en la BD y sus cinco rate plans son opciones **virtuales** en la vista. El nuevo adaptador en [Web PR #23](https://github.com/WilmerDep/quisqueya-web/pull/23) propone derivar de los **cuatro pasos generales C16** un recorrido por modalidad cuando `itinerary_json` esté presente, usando únicamente los flags del plan ya guardados en `pricing_json` (`transportIncluded`, `transportMode`, `mealIncluded`, `mealAddOnPrice`, `drinksIncluded`). Si la estructura de los pasos no coincide exactamente o no existe, **no inventa itinerario**. Esto no afecta el diseño original de las single ni crea nuevos registros ni modifica tarifas.

## Validación automatizada / prueba

```powershell
node scripts/verify-editorial-itineraries-2026-11.mjs
```

Verifica 14 slugs únicos contra los dos seeds (13+1), estructura `time/title/desc`, fuentes por página, ausencia de horas absolutas, marca no confirmada y sin pasos previos en semillas. Es una prueba pura, **sin consultas a MySQL ni escritura**.

## Plan de implementación sobre registros publicados (NO EJECUTADO)

1. Breidy/operador revisa los 14 recorridos orientativos y confirma en qué casos se puede publicar con `orden sujeto a coordinación`; precisa lo que deba ser horario real.
2. Hacer backup de `itinerary_json` por ID+slug junto con `updated_at` y `status` de los 14 registros remotos; exportarlo fuera de la BD.
3. Generar dry-run read-only contra **la BD real de staging** (no confundir `quisqueya_core` de Windows con `u424080957_quisqueya_core` de Hostinger). Confirmar que son las 14 identidades esperadas, `source_provider=MANUAL`, `status=PUBLISHED`, sin itinerarios previos ni cambios concurrentes.
4. Preparar transacción estrecha: actualizar **solo `itinerary_json`** con coincidencia exacta por ID/slug/status, respaldar antes, detenerse ante cualquier divergencia, y validar 14/14 registros; nunca ejecutar importadores `upsert` que reescriban precios, medios y relaciones.
5. Probar API y web por paquete con estado PUBLISHED, conservar reglas comerciales/URLs; PR aislado de web para itinerario de **modalidad seleccionada** si es familia.
6. Reversión mediante snapshot por ID/slug, si QA detecta divergencias. **No tocar otros registros**.

**Advertencia:** no ejecutar `UPDATE` en staging desde este PR ni publicar ningún contenido sin revisión y autorización. Esta rama es un artefacto editorial y de QA, no una migración ejecutada.

Relacionado: [Issue #14 — Itinerarios faltantes](https://github.com/WilmerDep/quisqueya-platform/issues/14); [Platform PR #15 — Prisma/MariaDB QA](https://github.com/WilmerDep/quisqueya-platform/pull/15).
