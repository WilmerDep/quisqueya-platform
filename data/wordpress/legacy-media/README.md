# Respaldo temporal de imágenes heredadas — Altos de Chavón

Estado: **MAPEADO — ARCHIVOS BINARIOS AÚN NO RECUPERADOS**. Fecha de referencia: 2026-10-19.

Este directorio documenta las referencias originales procedentes de WordPress. **Los registros `MediaAsset` NO son copias binarias de las fotos**: sus `publicUrl` enlazan a WordPress y `storageProvider=external`. Estos PNG no aparecen como archivos físicos en el árbol actual de los repositorios comerciales. No afirmar que el respaldo existe hasta verificar los bytes y sus hashes.

| MediaAsset | Archivo WordPress | URL fuente | Estado de respaldo |
| --- | --- | --- | --- |
| `wp-media-307` | `La-Romana.png` | https://quisqueyatravel.com.do/wp-content/uploads/2025/06/La-Romana.png | PENDIENTE (no descargable desde el entorno de auditoría) |
| `wp-media-308` | `Pueblo-Altos-de-Chavon.png` | https://quisqueyatravel.com.do/wp-content/uploads/2025/06/Pueblo-Altos-de-Chavon.png | PENDIENTE |
| `wp-media-208` | `Isla-Catalina-2.png` | https://quisqueyatravel.com.do/wp-content/uploads/2025/06/Isla-Catalina-2.png | PENDIENTE; pertinencia editorial sin verificar |
| `wp-media-305` | `Anfiteatro-altos-de-chavon.png` | https://quisqueyatravel.com.do/wp-content/uploads/2025/06/Anfiteatro-altos-de-chavon.png | PENDIENTE; pertinencia editorial sin verificar |

## Procedimiento pendiente, no bloqueante

1. Recuperar los archivos desde WordPress/cPanel/backup, cuando estén accesibles, **sin bloquear** el trabajo actual de las experiencias.
2. Verificar que los bytes corresponden a una imagen real y registrar el `SHA-256`, dimensiones y origen; no almacenar HTML de error bajo extensión PNG.
3. Si se decide conservarlos, colocar copias dentro de `data/wordpress/legacy-media/altos-de-chavon-medio-dia/` en una rama no desplegable y actualizar esta tabla a `RESPALDADO` con checksums. **No convertirlas en assets productivos ni subirlas al frontend automáticamente**.
4. Mantener WordPress/uploads hasta que cualquier imagen que realmente siga en uso se sirva desde un proveedor independiente.

## Medios modernos que ya existen

`PAGINA WEB/Experiencias/Altos de Chavon`: tres `MediaAsset` activos en Google Drive, ya registrados y reutilizables:
- `e7533bf9-81e6-48e3-8ac6-7b802e511b71`
- `f3d5cae4-eb76-4e6f-9c7f-d0ae2069afb4`
- `171f63b8-29e5-4096-a045-1f3fd06ccd33`

Estas tres imágenes muestran variantes de una misma iglesia; sirven como provisionales. Excluir de Altos las fotos nombradas Funchal/Madeira y Fortaleza San Felipe/Puerto Plata.

**Experiencia**: `altos-de-chavon-medio-dia` sigue DRAFT con portada heredada `wp-media-307`, galería heredada `[307,308,208,305]`. Toda modificación de relaciones y portada requiere un preflight y aprobación específicos. No publicar borradores. Nota: `santo-domingo-city-tour` PUBLISHED conserva seis medios WordPress adicionales y necesita su propio plan de independencia antes de retirar WordPress.
