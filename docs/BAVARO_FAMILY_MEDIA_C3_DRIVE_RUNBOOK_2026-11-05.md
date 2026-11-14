# Bávaro Adventure Park — multimedia C3 en Google Drive

Fecha: 2026-11-05. Estado: importador preparado y probado sin conexión real a MySQL/Google Drive en el entorno de desarrollo remoto. Pendiente: verificación operativa en el equipo local de Wilmer.

**Documento base:** `docs/MEDIA_STORAGE_GOOGLE_DRIVE.md`. Conservar sus decisiones sobre OAuth, permisos, proxy público, staging/producción y futura sustitución del proveedor. Este anexo no las reemplaza.

## Decisión confirmada

Las imágenes aprobadas ya existen en la estructura compartida **PAGINA WEB / Experiencias** de Drive. Google Cloud Console proporciona acceso OAuth a la API NestJS. `GoogleDriveStorageProvider` usa el ID del archivo como clave y verifica que sea descendiente de `GOOGLE_DRIVE_ROOT_FOLDER_ID`. `MediaAsset` en MySQL guarda la referencia, metadatos y `/api/v1/media/:id/content` como ruta de entrega; el frontend consume esa URL desde la API. No se suben ni convierten los archivos durante C3 y **no se guarda contenido binario en MySQL ni en la carpeta local del proyecto**.

La selección editorial versionada está en `data/content/bavaro-family-media-reviewed-c3-2026-11-05.json`:

- 13 modalidades Bávaro Adventure Park, todas pendientes de publicación (`DRAFT`).
- 13 portadas y 31 fotografías de galería (44 referencias Drive únicas).
- Cinco fotografías descartadas por parecido visual, conforme a la revisión de Wilmer; la exclusión se verifica en tests.
- Multimedia específica de Party Boat **sin confirmar**; se conserva la advertencia, sin atribuirle otras fotografías como si fueran de esa actividad.

El `fileName` `.webp` del manifiesto es la etiqueta editorial que permite rastrear la selección; no ordena renombrar, descargar ni convertir un archivo. El importador registra el nombre y MIME reales de Drive y conserva esa etiqueta en `provenanceJson.reviewedFileName`. Si Drive ya entrega WebP, se conserva WebP. El proxy entrega los bytes de la fuente sin conversión.

## Flujo local acotado

En la rama `feat/experience-family-api-local-20261103`, desde la raíz del proyecto:

```powershell
git pull --ff-only origin feat/experience-family-api-local-20261103
node --test scripts/preview-bavaro-family-media-c3.test.mjs scripts/register-bavaro-family-media-c3.test.mjs
node --env-file=.env.local scripts/preview-bavaro-family-media-c3.mjs --database
node --env-file=.env.local scripts/register-bavaro-family-media-c3.mjs --verify-drive
```

`--verify-drive` es exclusivamente de lectura. Comprueba los 44 archivos con OAuth, valida el límite de **PAGINA WEB** y verifica sus formatos MIME, sin descargar bytes ni tocar MySQL. Depende de que `.env.local` disponga de `STORAGE_PROVIDER=google-drive`, `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN` y `GOOGLE_DRIVE_ROOT_FOLDER_ID` correspondientes al acceso de la API. Ningún valor secreto debe compartirse en la conversación, el repositorio o el reporte.

Solo cuando la verificación devuelva `drive.status=VERIFIED` y el preflight SQL siga mostrando 13 modalidades en DRAFT sin conflictos, la aplicación local explícita será:

```powershell
node --env-file=.env.local scripts/register-bavaro-family-media-c3.mjs --apply --confirm=BAVARO_C3_44_DRAFT_LOCAL
node --env-file=.env.local scripts/preview-bavaro-family-media-c3.mjs --database
```

La escritura exige `NODE_ENV=development`, MySQL local (`127.0.0.1`, `localhost` o `::1`), base `quisqueya_core` y prohíbe `APP_ENV=staging/production`. El script verifica nuevamente Drive antes de empezar; crea o reutiliza los 44 `MediaAsset`, enlaza las 13 modalidades y no cambia su estado editorial. Toda la operación MySQL se ejecuta en una transacción con controles de conflicto; si falla, revierte el lote completo. Reejecutar tras éxito debe generar cero assets duplicados y cero asociaciones nuevas.

## No confundir ambientes

El `APP_URL` configurado al registrar determina el origen guardado en `MediaAsset.publicUrl`. **No se deben copiar directamente las URLs de `localhost` a staging.** Cuando se autorice esa fase, registrar o reconciliar las referencias contra el `APP_URL` de staging y verificar la conexión OAuth del servidor Hostinger. Que la integración de Drive haya funcionado anteriormente no demuestra que las credenciales o el token sigan vigentes en otro entorno.

La web comercial, staging y producción no reciben cambios con este paso. Las 13 modalidades siguen sin publicarse hasta la aprobación editorial correspondiente.
