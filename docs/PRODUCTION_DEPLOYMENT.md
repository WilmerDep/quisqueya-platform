# Quisqueya Platform — Production Deployment

Updated: 2026-10-03

## Current target architecture

Quisqueya Platform is one Hostinger-managed Node application containing:

- NestJS API under `/api/v1`;
- compiled Vite/React CRM served from the same runtime artifact;
- Prisma + MySQL/MariaDB;
- Google Drive as the current temporary media storage provider behind `MediaAsset`.

Production host:

```text
https://app.quisqueyatravel.com.do
├── /              CRM
├── /api/v1        Nest API
└── /healthz       health check
```

The public Next.js site is the second Node application at `https://quisqueyatravel.com.do`.

A separate `api.quisqueyatravel.com.do` application is not part of the current deployment target.

## 1. Production environment

Real values belong only in Hostinger environment settings or another approved secrets store.

Required core values include:

```env
NODE_ENV=production
APP_ENV=production
PORT=3000
APP_URL=https://app.quisqueyatravel.com.do
VITE_API_URL=/api/v1
CORS_ORIGINS=https://quisqueyatravel.com.do,https://www.quisqueyatravel.com.do,https://app.quisqueyatravel.com.do
```

Database and JWT variables must use production credentials/secrets.

Google Drive media variables:

```env
STORAGE_PROVIDER=google-drive
GOOGLE_DRIVE_CLIENT_ID=
GOOGLE_DRIVE_CLIENT_SECRET=
GOOGLE_DRIVE_REFRESH_TOKEN=
GOOGLE_DRIVE_ROOT_FOLDER_ID=
GOOGLE_DRIVE_PICKER_API_KEY=
GOOGLE_DRIVE_APP_ID=
GOOGLE_DRIVE_REDIRECT_URI=https://app.quisqueyatravel.com.do/api/v1/integrations/google-drive/callback
```

Never commit the real values.

## 2. Google Cloud before cutover

Before production authorization:

1. Register the exact production OAuth callback shown above.
2. Allow the production CRM origin in the restricted Picker API key/browser configuration.
3. Keep the same approved **PAGINA WEB** root unless a deliberate storage migration is being performed.
4. Confirm the OAuth consent/publishing strategy so production does not rely on short-lived Testing refresh tokens.

## 2A. Runbook operativo: Google Drive Testing → OAuth en producción → multimedia

**Preparado el 2026-10-13; propuesta de puesta en marcha, no confirmación de despliegue.**
Fuente de arquitectura: `docs/MEDIA_STORAGE_GOOGLE_DRIVE.md` y `docs/ENVIRONMENT_TOPOLOGY.md`.
El CRM/Nest API es la autoridad para `MediaAsset`, estados `DRAFT/PUBLISHED` y relaciones;
Drive contiene archivos, **no** decide qué experiencia se publica.

### A. Qué sucede ahora (staging con OAuth Testing)

- La cuenta autorizada es la de **Brady / Quisqueya Travel**, no la cuenta de Drive conectada al asistente. El límite configurado es la carpeta `PAGINA WEB`; `Experiencias` y sus subcarpetas son descendientes, no una raíz alternativa.
- Un refresh token OAuth de una aplicación *External* en estado *Testing*, con scopes de Drive, expira normalmente a los **7 días**. Si el CRM muestra `Token has been expired or revoked`, un Picker con ese token no puede completar la verificación de raíz.
- No se borran fotos ni `MediaAsset` por ese error. Evitar cambiar `GOOGLE_DRIVE_ROOT_FOLDER_ID`, duplicar archivos, crear otra integración o promover `DRAFT`.
- Para QA opcional en staging se puede obtener un nuevo refresh token mediante el flujo **ya existente** `GET /api/v1/integrations/google-drive/connect` → callback. Guardar el valor **solo** en Hostinger y reiniciar; la autorización de Testing puede volver a caducar. No diseñar un cron para reautorizar la cuenta.

### B. Puertas de decisión antes de publicar OAuth

**B1. Alcance y revisión por Google (bloqueante).**
El backend solicita `https://www.googleapis.com/auth/drive` para navegar archivos preexistentes bajo la raíz autorizada. Ese scope está clasificado **Restricted** por Google, aunque nuestra API restrinja técnicamente la operación a `PAGINA WEB`.
- Revisar los requisitos de verificación OAuth, elegibilidad para scope restringido y, según uso/almacenamiento/transmisión de datos, evaluación de seguridad. **Cambiar Publishing status a In production no equivale a pasar la verificación.**
- Revisar si puede funcionar `drive.file` con Google Picker **sin perder la navegación de los descendientes preexistentes**. La prueba del 2026-10-03 documentó que con ese scope la navegación no funcionaba de forma suficiente. No reducir el scope ni revocar el permiso funcional sin un experimento y QA independientes.
- Documentar el resultado de Google Cloud (estado de publicación/verificación y permisos autorizados) **sin credenciales**. Hasta resolver esta puerta, no prometer conectividad OAuth permanente.

**B2. Entrega de archivos públicos (bloqueante antes de lanzamiento).**
Google Drive API Terms prohíben usar Drive como reemplazo de una CDN a gran escala. El proxy de bytes de `/api/v1/media/:id/content` se validó funcionalmente, pero **esa prueba no equivale a aprobación de uso como CDN para la web pública**.
- Definir y validar el proveedor de entrega pública autorizado. Si el uso previsto excede el uso permitido de Drive, emplear un almacenamiento de objetos/CDN apropiado (R2/S3 ya contemplados como futuros `StorageProvider`) **sin rehacer `Experience`, el CRM ni las relaciones lógicas `MediaAsset`**.
- Documentar costo, cuota, rendimiento, accesibilidad y derechos de uso de las fotografías. Si hay cambio de proveedor, hacer migración controlada y prueba de lectura **antes** del go-live; no asumir que basta con cambiar `STORAGE_PROVIDER`.

Referencias oficiales: [Google OAuth audience / publishing](https://support.google.com/cloud/answer/15549945?hl=en), [Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Drive API Terms](https://developers.google.com/workspace/drive/api/terms).

### C. Puesta en producción de la autorización (después de B1/B2)

1. Confirmar el proyecto Google Cloud y la cuenta de Brady como titular/autorizada. Completar pantalla de consentimiento, identidad, scopes y verificaciones exigibles; configurar `In production` cuando corresponda.
2. Registrar callback **exacto** `https://app.quisqueyatravel.com.do/api/v1/integrations/google-drive/callback`; mantener el de staging únicamente mientras se necesite. Autorizar el origen `https://app.quisqueyatravel.com.do` en las restricciones de la Picker API key.
3. En Hostinger, establecer `APP_ENV=production`, `APP_URL=https://app.quisqueyatravel.com.do`, `VITE_API_URL=/api/v1`, `GOOGLE_DRIVE_REDIRECT_URI` anterior y secretos privados del ambiente. Conservar el ID de raíz `PAGINA WEB` **si se conserva el proveedor y árbol**.
4. Completar OAuth usando exclusivamente la cuenta autorizada. El callback devuelve `refreshToken`: guardarlo en la configuración **privada** de Hostinger, no en GitHub, capturas, chat, logs ni documentos. Reiniciar la aplicación.
5. En el CRM (Super Admin/Administrador), ir a **Configuración → Google Drive → Verificar**. Confirmar estado real de la raíz con `GET /api/v1/integrations/google-drive/root`; una marca verde por variable configurada no basta. Abrir Picker, confirmar la misma `PAGINA WEB` y recorrer `Experiencias` mediante `GET /api/v1/media/storage/objects?parentKey=...`.
6. Verificar la lectura/entrega autorizada de al menos un recurso conocido según el proveedor finalmente aprobado. No actualizar `main` hasta pasar QA: en este proyecto el merge activa despliegue de Hostinger.

### D. Cómo se utilizará la biblioteca con el CRM (flujo diario)

1. **Auditar primero `PUBLISHED`.** Leer las experiencias reales de MySQL por la API; contrastar título, actividades, imágenes ya vinculadas y contenido editorial. Conservar las portadas/galerías que correspondan. Las pruebas locales previas de Altos de Chavón y Haitises + Isla Bacardi son evidencia de funcionamiento, no revisión completa de staging.
2. **Revisar después `DRAFT`.** Obtener el número real desde MySQL; los datasets versionados (p. ej. 13 Bávaro Adventure Park) no demuestran por sí solos qué existe hoy en staging. Verificar fotografías y pendientes editoriales por excursión/paquete, sin inferir actividades por un nombre de carpeta.
3. **Identificar el archivo exacto.** Navegar la carpeta ya autorizada con `GET /api/v1/media/storage/objects` y conservar su `storageKey`. Consultar el `MediaAsset` actual; reutilizarlo cuando `storageProvider + storageKey` coincidan. El nombre o parecido visual solo sirve como candidatura, no como clave estable.
4. **Registrar únicamente lo necesario:** `POST /api/v1/media/register` solo cuando falta el asset. La operación reutiliza el registro de la misma clave de proveedor. No repetir uploads.
5. **Asociar tras revisión editorial:** `PATCH /api/v1/media/experiences/:experienceId` con `featuredMediaId` y/o `galleryMediaIds` verificados. Preservar relaciones ya aprobadas; al mandar `galleryMediaIds` se sustituye el array completo, por lo que hay que incluir las imágenes existentes que se quieren conservar.
6. **Validar antes de publicar:** previews protegidos para `DRAFT`, endpoints públicos y `quisqueya-web` para `PUBLISHED`, imágenes HTTP correctas, orden, responsive y fallback heredado solo cuando no hay galería administrada. No publicar automáticamente ni tocar precios, slugs o disponibilidad por una asociación multimedia.
7. **Aprobar y publicar:** solo con validación de contenido e imágenes y aprobación del responsable editorial/cliente. Registrar fecha, responsable y cambios aplicados para rollback.

### E. Condiciones de cierre y recuperación

- OAuth y acceso a raíz comprobados por operaciones **reales**, no solo variables presentes.
- Requisitos de Google para scope y entrega pública evaluados y resueltos; sin dependencia del ciclo de 7 días de Testing.
- Backups de MySQL, commit conocido y estado previo de los `galleryMediaIds` preservados.
- `MediaAsset.publicUrl` reconciliados cuando cambia `APP_URL` o el proveedor; no dejar URLs locales/staging en producción.
- Sin duplicados por clave de proveedor; sin imágenes de excursiones ajenas; todos los `DRAFT` permanecen privados hasta aprobación.
- Si falla la autenticación: detener registro y asociación, mostrar el error, y recuperar OAuth con la cuenta autorizada; **no** cambiar de raíz, volver a cargar la biblioteca ni hacer seeds destructivos.
- Rollback de despliegue según sección 8 y restauración de relaciones multimedia desde respaldo si fuese necesario.

---

## 3. Build and release

The approved release must come from the production branch after local and staging QA.

Hostinger build command:

```bash
npm run deploy:prepare
```

The build must remain self-contained and include the compiled CRM within the server artifact.

Do not bypass Prisma, production-readiness or CRM packaging checks to force a deployment green.

## 4. Content and media

WordPress remains a migration/fallback source, not the final authority.

For experience galleries:

- when `galleryMediaIds` contains managed MediaAsset IDs, the public API uses that managed gallery;
- when no managed gallery exists, legacy WordPress/Tourfic media may remain as fallback.

Provider-managed media is delivered through:

```text
https://app.quisqueyatravel.com.do/api/v1/media/{mediaAssetId}/content
```

If MediaAsset records were created under localhost or staging, reconcile any persisted `publicUrl` after changing `APP_URL`.

## 5. Commercial web production environment

After the platform is healthy:

```env
QUISQUEYA_API_URL=https://app.quisqueyatravel.com.do/api/v1
NEXT_PUBLIC_SITE_URL=https://quisqueyatravel.com.do
NEXT_PUBLIC_INDEXABLE=true
```

Redeploy the web after changing these values.

## 6. Production validation

Platform:

```bash
npm run verify:production
npm run prisma:migrate:deploy
npm run build:production
npm run verify:public-api
```

Runtime checks:

```text
GET https://app.quisqueyatravel.com.do/healthz
GET https://app.quisqueyatravel.com.do/api/v1/public/experiences
GET https://app.quisqueyatravel.com.do/api/v1/media/{knownMediaAssetId}/content
```

Also validate:

- CRM login and refresh;
- Google Drive integration status/root traversal;
- featured media and galleries on approved experience singles;
- commercial forms;
- canonical/SEO URLs;
- responsive desktop/mobile behavior.

## 7. Initial population vs routine deployment

Do not rerun destructive WordPress imports or forced seed operations during a routine release.

Initial population/intentional refresh operations must be treated separately, backed up and audited.

## 8. Rollback baseline

Before every release:

1. record the known-good Git commit;
2. back up the database;
3. keep the prior deployment/release available until health, API, CRM and media checks pass.

Database rollback must use the pre-release backup. Prisma rollback must not be improvised on production data.
