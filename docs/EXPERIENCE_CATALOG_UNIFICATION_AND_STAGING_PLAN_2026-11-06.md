# Quisqueya Travels — consolidación de experiencias y preparación de staging

Fecha: 2026-11-06  
Estado: diagnóstico y plan de ejecución. **No constituye publicación ni aprobación de datos en staging.**

## Decisiones confirmadas por Wilmer

1. Se aprueba la composición responsive y las animaciones de la vista privada C4 de Bávaro Adventure Park, incluida la navegación de escritorio y móvil. La aceptación visual del usuario no sustituye lint, build ni QA contra el catálogo real.
2. La web comercial mostrará una **experiencia principal por familia** y, dentro de ella, los paquetes o modalidades que realmente correspondan. No se eliminarán URLs históricas ni registros para conseguir ese resultado.
3. Las experiencias **nuevas** aprobadas deben ocupar las primeras posiciones de `/experiencias`, comenzando por la incorporación más reciente; las experiencias **antiguas migradas desde WordPress** deben quedar después de las nuevas. Se mantienen todas las fichas y sus enlaces a las singles.
4. La API NestJS y MySQL son la fuente de verdad; la web consume la información y el CRM administrará el catálogo en su fase correspondiente.
5. Después de consolidar datos y UI se preparará una publicación supervisada en **staging**, antes de cualquier cambio en producción.
6. Para experiencias sin imágenes propias suficientes, se utilizará una **carpeta común** de Drive `PAGINA WEB / Experiencias / Imágenes externas / <nombre de experiencia>`. Cada subcarpeta identificará una experiencia (por ejemplo, Coco Bongo), con imágenes temporales procedentes preferentemente de páginas oficiales y derechos de uso comprobados. **Bávaro Adventure Park queda fuera** de esta búsqueda porque ya dispone de abundante material; no se crearán carpetas externas dentro de su árbol ni dentro de las carpetas propias de otras experiencias.

## Fuentes revisadas y nivel de certeza

- `docs/EXPERIENCE_FAMILY_API_LOCAL_C2_2026-11-03.md`: contrato v2 para familias con hijos `Experience` publicados.
- `docs/BAVARO_EDITORIAL_RECONCILIATION_C3_2026-11-04.md`: cotejo de 13 modalidades Bávaro con el documento editorial de Breidy; el seed fue corregido, **no necesariamente la base MySQL**.
- Seeds `data/content/client-experiences-2026-09*.seed.json`: inventario local de experiencias, tarifas y adicionales descritos abajo.
- `server/src/modules/content/content.service.ts`: el listado público filtra `PUBLISHED`, ordena por `sortOrder` ascendente y después por título; `resolveExperienceCatalog` oculta hijos solo cuando la relación publicada es válida.
- `docs/MEDIA_STORAGE_GOOGLE_DRIVE.md` y anexo `BAVARO_FAMILY_MEDIA_C3_DRIVE_RUNBOOK_2026-11-05.md`: Drive se integra por API/`MediaAsset`; MySQL guarda referencias, no imágenes.
- Web C4 `ExperienceDetailView.tsx` y `experience-preview.service.ts`: el selector aprobado usa la familia Bávaro; la adaptación genérica de otras modalidades no está validada.

**Límite de la inspección:** estos archivos no demuestran el inventario actual de staging, las relaciones efectivamente publicadas en su MySQL ni la disponibilidad real de imágenes y OAuth. Conciliar con los endpoints y la base del entorno antes de aplicar escrituras.

## Inventario y estrategia de agrupación

| Experiencia / slug actual del seed | Datos encontrados | Tratamiento previsto | Estado |
| --- | --- | --- | --- |
| Bávaro Adventure Park, padre propuesto `bavaro-adventure-park` | 13 experiencias hijas con slugs separados | Una ficha padre y 13 paquetes mediante `displayJson.experienceFamily` v2; preservar ficha y datos propios de cada hijo | C4 visual aprobado por Wilmer; falta conciliación MySQL/API, publicación y QA real |
| `la-hacienda-park-7-aventuras` | Una experiencia con 5 `pricing.ratePlans` (Solo Admisión, Standard, Standard + Almuerzo, VIP, Dominicanos/Residentes) | **Primera siguiente implementación:** una single con cinco modalidades seleccionables, sin crear cinco registros duplicados por defecto | Requiere contrato/adapter seguro y comprobación de tarifas/condiciones |
| `coco-bongo-punta-cana-show-disco` | Una experiencia con 5 `pricing.ratePlans` (Drink Pack, Regular/Open Bar, Premium, Gold Member VIP, Front Row VIP) | Una single con cinco modalidades, respetando las tarifas o consultas según datos confirmados | No inventar precios ni beneficios entre planes |
| `el-dorado-water-park-cap-cana` | Una experiencia con 2 `pricing.ratePlans` y 6 `pricing.addOns` | Una single: **tipo de entrada** y **adicionales** en controles diferentes | No sumar automáticamente adicionales ni equipararlos a entradas |
| `scape-park-full-admission-cap-cana` | Una experiencia con 3 `pricing.addOns` (Buggy, Party Boat, Juanillo VIP) | Conservar experiencia base y mostrar complementos separados | No crear paquetes independientes sin fuente editorial |
| `santo-domingo-city-tour` y `santo-domingo-city-tour-altos-de-chavon` | Dos productos con itinerarios diferentes; el primero contiene tarifas por zona | Mantener productos independientes; el segundo incluye dos destinos y no debe pertenecer automáticamente a dos padres | Relación editorial/cross-sell pendiente; zona de recogida no es paquete |
| `altos-de-chavon-medio-dia` y `altos-de-chavon-cueva-de-las-maravillas` | Dos excursiones nuevas con salida desde Bávaro/Punta Cana y visita central a Altos; varían duración, almuerzo y visita a la Cueva | **Familia candidata `altos-de-chavon` con exactamente 2 hijos**, siguiendo `experienceFamily` v2 y conservando los slugs individuales | Cotejadas con Formulario 2; falta revisar colisiones, publicación de hijos y medios en staging |
| `aventura-en-buggies-y-altos-de-chavon` (WordPress) | Excursión antigua de buggies (ruta todoterreno y visita a Altos de Chavón), no equivalente a las 2 visitas culturales nuevas | Mantener producto histórico independiente y ordenar después de las nuevas; ofrecer enlace relacionado si procede | Existencia verificada en web WordPress; estado de staging pendiente |
| Isla Saona clásica/regular frente a Isla Saona heredada de WordPress | Los dos formularios del cliente parecen describir una misma excursión regular; WordPress ya contiene otra ficha de Saona | Conciliar contenidos y procedencia antes de decidir una familia; no crear paquetes ficticios ni suprimir la ficha vieja | Candidato de revisión, **no confirmado como familia** |

### Altos de Chavón — cotejo editorial del 6 de noviembre

Se revisaron `Formulario 2 descriptivos de experiencias e informacion general.docx`, `Segunda parte excursiones descriptivos(1).docx`, la semilla local de septiembre, la auditoría histórica `auditoria-altos-medio-dia.json` y la página antigua de WordPress. **Propuesta de agrupación para validar contra MySQL/staging:**

| Experiencia | Duración | Adulto / niño de 4–11 años | Almuerzo | Relación propuesta |
| --- | --- | --- | --- | --- |
| `altos-de-chavon-medio-dia` | 6–7 horas | US$69 / US$35 | No incluido | Hijo 1 de `altos-de-chavon` |
| `altos-de-chavon-cueva-de-las-maravillas` | 10–11 horas | US$125 / US$65 | Almuerzo dominicano y una bebida incluidos | Hijo 2 de `altos-de-chavon` |
| `santo-domingo-city-tour-altos-de-chavon` | Aproximadamente 11 horas | US$145 / US$70 | Buffet incluido | Ficha independiente con vínculo contextual: incluye Santo Domingo y Altos |
| `aventura-en-buggies-y-altos-de-chavon` | Jornada completa en WordPress | Precio vigente sin verificar | Almuerzo típico en la ficha antigua | Ficha histórica independiente; no reutilizar tarifas nuevas |

No se ha creado el padre, vinculado hijos ni modificado filas en MySQL. Antes de ello, confirmar que `altos-de-chavon` no colisiona con otra experiencia, que los dos registros hijos corresponden a las fichas revisadas y que ninguno pertenece ya a otra familia. La familia debe heredar **solo la navegación/selección**, no mezclar itinerarios, edades, alimentación, tarifas ni condiciones; cada ficha y URL original permanece disponible. La vinculación propuesta sería `displayJson.experienceFamily = {version: 2, mode: 'multi_inquiry', packageSlugs: ['altos-de-chavon-medio-dia', 'altos-de-chavon-cueva-de-las-maravillas']}` en el eventual padre.

**Imágenes ya existentes:** Drive `Experiencias / Altos de Chavon` contiene tres archivos con nombre de villa colonial que requieren selección visual. Incluye además fotografías cuyos nombres identifican Funchal/Madeira y Fortaleza San Felipe/Puerto Plata: **no asociarlas a Altos**. La auditoría histórica de octubre también advierte que `Isla-Catalina-2.png` no debe usarse sin revisión editorial.

**Límite de evidencia:** el endpoint `https://crmquisqueya.pholiodev.com/api/v1/public/experiences` no fue accesible desde la conexión de comprobación el 6/11/2026. Ni los conteos históricos de octubre ni la web WordPress prueban el estado presente de staging. La clasificación anterior es una propuesta editorial, no una mutación ya aplicada.

### Regla funcional

- **Familia con hijos reales:** usar el contrato público v2 `packages[]` y `packageSelection`, con `packageSlugs` explícitos, como Bávaro. Los hijos conservan su slug y detalle individual.
- **Modalidades dentro de una experiencia:** conservar `ratePlans` y construir una presentación normalizada desde la API o un adaptador contractual; no presentar cada tarifa como un hijo `Experience` sin decisión de modelo.
- **Adicionales:** conservar `addOns` como opciones secundarias. Nunca sumar ni prometer inclusiones, alimentación, transporte, descuentos o disponibilidad sin evidencia por modalidad.
- **Variaciones por zona:** `zonePricing` es una regla de precio/recogida y no justifica crear tarjetas de experiencias nuevas.
- La portada, galería y texto común pertenecen a la experiencia padre; las condiciones particulares siguen en la opción seleccionada. La web no importa directamente seeds de migración.

## Orden de ejecución

### U0 — Conciliación sin escrituras

1. Obtener inventario real de experiencias publicadas y borradores en MySQL local y staging, con slugs, IDs, `sortOrder`, `displayJson`, media y estado. **Priorizar la familia candidata Altos de Chavón solicitada por Wilmer** y descartar colisiones/doble pertenencia.
2. Comparar los seeds revisados con la API pública y las respuestas de detalle, incluido Bávaro. Registrar colisiones y diferencias sin sobreescribir datos reales.
3. Validar scripts C3 de Bávaro en modo `--database` solo lectura, el estado del padre y los 13 hijos, y las 44 referencias Drive C3 cuando haya OAuth autorizado.
4. Cerrar el mapa editorial definitivo de modalidad frente a adicional para cada experiencia antes de mutar datos.

### U1 — La Hacienda como primera plantilla reutilizable

1. Normalizar las cinco opciones a un contrato tipado y retrocompatible en la API; conservar la información original, `ratePlans`, precios y restricciones.
2. Conectar la single de `quisqueya-web` a ese contrato con selector, precio informativo y CTA de consulta acorde al plan seleccionado.
3. Verificar que no aparecen cinco tarjetas duplicadas en el listado, que la URL actual funciona y que el formulario comunica la selección real.
4. Ejecutar pruebas unitarias y QA visual de desktop/móvil sin alterar el diseño C4 ya aprobado.

### U2 — Coco Bongo, El Dorado y Scape Park

1. Reutilizar la plantilla para las cinco modalidades de Coco Bongo; cuando falte importe, mostrar consulta y no `US$0`.
2. Separar admisión (dos planes) de adicionales (seis) en El Dorado.
3. Mostrar los tres complementos de Scape Park aparte de su entrada base.
4. Confirmar con Breidy las opciones comercialmente seleccionables que no sean inequívocas en los documentos.

### U3 — Orden editorial y catálogo

1. Publicar una tarjeta por experiencia/familia en `/experiencias` y enlazar a la single correspondiente.
2. Definir **posición editorial explícita** en `sortOrder`: primero las experiencias nuevas aprobadas, ordenadas entre sí de la más reciente a la anterior; después las experiencias antiguas provenientes de WordPress. El backend actual ordena `sortOrder` ascendente y luego título, **no** por fecha. No basta con marcar una experiencia `PUBLISHED`.
3. Utilizar `sourceProvider` (`MANUAL` / `WORDPRESS`, declarado en Prisma) como evidencia de procedencia para conciliar el catálogo, pero no asumir que todo registro `MANUAL` es automáticamente reciente: confirmar la prioridad editorial real y evitar reordenar indiscriminadamente contenido preexistente.
4. No ocultar fichas aisladas, borrar slugs existentes ni cambiar URL/canonical/SEO sin revisión de enlaces históricos.

### U4 — Staging supervisado

1. Cerrar pruebas de API/TypeScript/lint/build y QA en 390, 768, 1280 y 1440 px, incluyendo Safari, dropdowns, sticky de precios, GSAP y `prefers-reduced-motion`.
2. Preparar un inventario de cambios y rollback preciso de datos/servicios; verificar credenciales OAuth de Drive **del entorno staging** y rutas `/api/v1/media/:id/content`.
3. Publicar primero API/datos compatibles, verificar endpoints y luego web, sin asumir que un preview `DRAFT` es una publicación pública.
4. Confirmar estado final, URLs, orden y contenido editorial. Producción permanece fuera de alcance.

## Trabajo posterior de multimedia externa

Cuando las familias estén conciliadas, comprobar primero la suficiencia del material propio de cada experiencia. Para las que carezcan de fotos adecuadas, usar el **árbol común de externos**:

`PAGINA WEB / Experiencias / Imágenes externas / <nombre de la experiencia>`

La carpeta común **ya está creada y verificada** en [Drive: Imágenes externas](https://drive.google.com/drive/folders/1h9oB1BlhIcQsxxzy1H0V4iwZI_X5B5EB). Dentro se creó [Coco Bongo Punta Cana](https://drive.google.com/drive/folders/1cE8O2W59bOPQdfIsORYpcHQPji5x143F), todavía vacía. La creación de otras subcarpetas se hará tras identificar faltantes reales. No se importará material adicional para Bávaro.

Buscar candidatas de cada experiencia, preferentemente fotografías de proveedores y fuentes oficiales autorizadas, y descargarlas a su subcarpeta común **solo cuando su reutilización esté permitida**. Por cada candidata documentar: URL original, página del proveedor, autor/titular si consta, licencia o permiso verificable, fecha de consulta, descripción, experiencia y modalidad correctas, atribución exigida, condición de **recurso externo temporal** y nombre/ID de Drive. **Que una imagen tenga crédito o diga «no propia» no concede permiso para reutilizarla comercialmente.** Si no se comprueban derechos, dejarla pendiente y no publicarla.

Después de la aprobación editorial y de uso, registrar la referencia en `MediaAsset` y vincularla mediante `featuredMediaId` o `galleryMediaIds`. El frontend consumirá el proxy de la API. Cuando Breidy suministre la foto original aprobada, se actualizará la asociación del `MediaAsset` correspondiente y se conservará el registro de procedencia/reemplazo para poder auditar qué recurso temporal se sustituyó. No subir binarios al repositorio, crear enlaces directos improvisados de Drive ni mezclar imágenes externas con las propias en una misma subcarpeta.

## Criterios mínimos para considerar cerrada una unificación

- Un producto comercial principal por familia; opciones del documento sin pérdidas ni duplicaciones.
- Precio, unidad, alimentación, transporte, menores y restricciones conservados **por opción**; incertidumbre visible como consulta.
- API como fuente única; frontend sin datos ficticios ni acoplamiento directo al seed.
- Slugs previos y enlaces existentes funcionales.
- Lista de experiencias con nuevas incorporaciones primero y contenido histórico de WordPress después, en el orden editorial verificado, y cada tarjeta enlazando a la single correcta.
- Pruebas de integridad, build, responsive y reversión aprobadas antes de staging.

## Próxima tarea ejecutable

**U0 (solo lectura):** conciliar primero los cuatro productos relacionados con Altos de Chavón contra MySQL/staging. Si la propuesta de **dos paquetes culturales** supera las verificaciones de slugs, estado, destinos y familias existentes, preparar su padre `DRAFT` y la single reutilizable; mantener City Tour + Altos y Buggies + Altos independientes. Después continuar con La Hacienda y el mapa general `padre -> modalidades -> adicionales`. No crear, publicar, borrar ni modificar filas de catálogo hasta superar la conciliación.
