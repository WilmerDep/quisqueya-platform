# Conciliación multimedia — experiencias públicas y borradores

Estado: **propuesta editorial / NO APLICADA A STAGING**. Fecha de elaboración: 2026-10-14.

## Contrato y fuentes

- El CRM y `NestJS API` administran las relaciones `Experience.featuredMediaId` / `galleryMediaIds`, y `MediaAsset` guarda `storageProvider + storageKey` (ID del archivo en Google Drive). No mover archivos, no volver a cargar ZIP, no recrear la integración.
- En `main` están operativos `GET /media/storage/objects`, `POST /media/register`, `PATCH /media/experiences/:id` y las consultas públicas. El acceso OAuth/raíz `PAGINA WEB` fue restaurado en Hostinger por el administrador.
- `data/content/drive-ready-media-candidates-2026-10-14.json` recoge **40 imágenes seleccionadas en 12 carpetas** de los materiales entregados por el usuario (12 portadas, 28 galerías). Contiene solo nombres relativos, NO IDs reales. Las demás fotografías originales siguen en Drive: estas 40 no representan el inventario total.
- `data/content/client-experiences-2026-09-bavaro-adventure-park.seed.json`: 13 borradores propuestos, sus nombres, componentes y flags. La presencia del dataset **no prueba** los estados o asociaciones actuales de MySQL.
- `docs/MEDIA_STORAGE_GOOGLE_DRIVE.md`: dos flujos validados a 2026-10-03. La captura posterior de la web muestra una galería de cinco fotos cargada correctamente. No sustituir relaciones ya correctas.

## A. Publicadas: conservar primero

| Experiencia | Decisión inicial | Motivo |
|---|---|---|
| Aventura en Buggies y Altos de Chavón | **KEEP — revisar solo propuestas adicionales** | Flujo Drive/API validado. Conservar la galería propia de Altos de Chavón. Las fotos de `Buggy VIP` proceden de otra oferta y **no** deben reemplazar la portada o mezclarse sin revisión visual/editorial explícita. |
| Haitises + Isla Bacardi | **KEEP** | Flujo Drive/API validado con carpeta `Cayo Levantado`. Galería de cinco fotos visible; no sustituirlas por fondos genéricos o fotos de Bávaro. |
| Las demás `PUBLISHED` reales | **AUDIT** | Consultar todas las filas reales de MySQL. No asumir que solamente existen dos `PUBLISHED` ni que seis registros locales coinciden con staging. Conservar cualquier foto pertinente antes de proponer reemplazo. |

## B. DRAFT: correspondencias de actividad documentadas

**Las siguientes son candidaturas editoriales; ninguna asociación está aprobada ni aplicada.**
El archivo fuente define una portada candidata por grupo y sus galería(s) seleccionadas; se deben localizar los IDs reales mediante la auditoría.

| Draft (slug abreviado) | Grupo para portada candidata | Grupos de apoyo si el contenido lo justifica | Precaución |
|---|---|---|---|
| `explorer-adventure-catamaran` | Catamaran Adventure | mismo grupo | No agregar fotos de Party Boat por parecido. |
| `buggy-vip` | Buggy VIP | Blue Lagoon Cenote, Dominican Village, Maze Garden, Waterfall Pool | Confirmar que representen las actividades de este paquete. |
| `zipline-mega-splash` | Zipline Mega Splash | Blue Lagoon Cenote, Maze Garden, Waterfall Pool | Conservar el circuito/tirolesa como identidad principal. |
| `sacred-river` | Sacred River | Blue Lagoon Cenote, Jungle River, Dominican Village | Candidata de portada específica: `sacred-river-68.webp`. |
| `buggy-zipline` | Buggy VIP | Zipline Mega Splash | Composición combinada; no duplicar el mismo ID en la galería. |
| `sacred-river-zipline` | Sacred River | Zipline Mega Splash | Mantener relevancia de ambos componentes. |
| `buggy-party-boat` | Buggy VIP | **Party Boat sin imágenes verificadas** | No sustituir `Party Boat` por `Catamaran Adventure` sin evidencia de que sea la misma actividad. |
| `polaris-vip` | Polaris VIP | mismo grupo | Fotografías de Polaris, no de buggy. |
| `polaris-zipline` | Polaris VIP | Zipline Mega Splash | Reutilizar IDs de componentes correctos. |
| `full-access-buggy` | Buggy VIP | **Solo actividades incluidas comprobadas** | La denominación Full Access no demuestra que incluya todo el parque. |
| `sacred-river-de-noche` | Sacred River at night | mismo grupo | No usar portada diurna en lugar de nocturna sin aprobación. |
| `polaris-de-noche` | Polaris At Night | **Galería nocturna por verificar** | Portada `polaris-night-01.webp` es candidata; otros archivos del grupo pueden estar en hold. |
| `full-access-polaris` | Polaris VIP | **Solo actividades incluidas comprobadas** | No inferir beneficios de Full Access ni representar buggy como Polaris. |

Todos los slugs de la tabla se deben interpretar con prefijo `bavaro-adventure-park-`, tal como aparecen en el dataset existente.

En la selección compartida no hay imágenes marcadas como definitivas para `HorseBack Riding` ni `PaintBall`; aunque existan archivos originales, no debemos dar por aprobada su publicación.

Los flags comerciales y editoriales pendientes (menores, infantes, cobertura de traslado, modalidades, etc.) **no se resuelven por asociar fotos**. Mantener `DRAFT` hasta aprobación del cliente.

## C. Obtención del inventario real dentro del CRM

Se ha ampliado el PR de inventario de solo lectura, no desplegado. Tras QA y un merge autorizado en `main` (que activa Hostinger):

1. Iniciar sesión como administrador en `crmquisqueya.pholiodev.com` → Configuración → Google Drive.
2. Con la raíz `PAGINA WEB` validada, pulsar **Exportar auditoría**. Este botón consulta el endpoint protegido **`GET /api/v1/media/inventory`** y recorre **`PAGINA WEB/Experiencias`** con el endpoint de listado **ya existente**. No llama a `POST`, `PATCH` ni elimina nada.
3. El navegador descarga `quisqueya-media-inventory-YYYY-MM-DD.json` que incluye todos los `DRAFT` y `PUBLISHED` de staging, referencias `MediaAsset`, título, extracto, descripción, actividades, alertas y la lista de archivos con **ID de Drive** + ruta. **No exporta tokens, contraseñas ni Picker access tokens**.
4. Confirmar `driveAudit.complete === true`. Si es falso, revisar `driveAudit.issues`: el inventario puede ser parcial; no aplicar relaciones basándose en información incompleta.
5. Cruzar cada archivo `storageProvider:'google-drive'` + `storageKey` con `mediaAssets`; para cada combinación seleccionar `KEEP` / `REUSE` / `ADD` / `REPLACE_AFTER_REVIEW` / `HOLD`. Las coincidencias por nombre son **propuestas, no identidad**.
6. Tras revisión visual de las imágenes, registrar únicamente claves faltantes con `POST /api/v1/media/register`, operación existente que **reutiliza el asset** cuando la clave ya existe. Asociar por `PATCH /api/v1/media/experiences/:id` pasando **todos** los `galleryMediaIds` que deben conservarse: enviar el campo sustituye el array completo.
7. Volver a consultar inventario, estado de las experiencias, preview protegido `DRAFT` y `GET /public/experiences/:slug` + web comercial para `PUBLISHED`. Registrar estado anterior y nuevo para rollback. No publicar por defecto.

**Protección importante de datos:** algunos scripts `stage:...` / `--apply` existentes, especialmente los de Bávaro Adventure Park, incluyen `featuredMediaId: null` o refrescan contenido mutable. No volver a ejecutarlos después de asignar medios sin comparar el diff de campos y preservar manualmente las relaciones actuales.

## D. Alcance de esta entrega

- Código/API/UI de lectura y exportación en rama de PR; **ningún cambio en MySQL ni Google Drive**.
- 40 nombres candidatos disponibles en `data/content` para inspección editorial. No convertir automáticamente nombres en `storageKey` o `MediaAsset.id`.
- **No fusionar a `main` sin pruebas** de `npm run typecheck`, `npm test`, `npm run build` y comprobación de los casos públicos existentes. El merge activa un deployment real en Hostinger.
- El trabajo de relacionar imágenes definitivas sigue condicionado al inventario real, revisión visual y aprobación editorial, pero no requiere una arquitectura nueva.
