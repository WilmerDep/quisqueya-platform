# Altos de Chavón — rótulos de modalidades (ciclo U2)

Fecha: 2026-11-06  
Ámbito: Quisqueya Platform, rama `feat/experience-family-api-local-20261103`.

## Estado confirmado

El 6 de noviembre Wilmer ejecutó U1 sobre MySQL local `quisqueya_core`: el padre
`manual-exp-altos-de-chavon-family` quedó `DRAFT` y una segunda comprobación
respondió `NOOP_ALREADY_PREPARED`, sin nuevas escrituras.

Los hijos conservan sus identificadores y estados de origen:

| Slug original | Origen | Estado local U1 | Rótulo en el selector |
| --- | --- | --- | --- |
| `altos-de-chavon-medio-dia` | MANUAL | DRAFT | Altos de Chavón – Medio Día |
| `altos-de-chavon-cueva-de-las-maravillas` | MANUAL | DRAFT | Altos de Chavón + Cueva de las Maravillas |
| `santo-domingo-city-tour-altos-de-chavon` | MANUAL | DRAFT | Altos de Chavón + Santo Domingo City Tour |
| `aventura-en-buggies-y-altos-de-chavon` | WORDPRESS | PUBLISHED | Altos de Chavón + Aventura en Buggies |

## Contrato de presentación

La membresía permanece en `displayJson.experienceFamily` (v2, `multi_inquiry`,
`packageSlugs`). Para no tocar títulos antiguos, enlaces, URL canónicas ni SEO,
los rótulos de presentación se guardan en otra propiedad del padre:

```json
{
  "displayJson": {
    "experienceFamily": {
      "version": 2,
      "mode": "multi_inquiry",
      "packageSlugs": ["altos-de-chavon-medio-dia", "altos-de-chavon-cueva-de-las-maravillas", "santo-domingo-city-tour-altos-de-chavon", "aventura-en-buggies-y-altos-de-chavon"]
    },
    "experiencePackageLabels": {
      "altos-de-chavon-medio-dia": "Altos de Chavón – Medio Día",
      "altos-de-chavon-cueva-de-las-maravillas": "Altos de Chavón + Cueva de las Maravillas",
      "santo-domingo-city-tour-altos-de-chavon": "Altos de Chavón + Santo Domingo City Tour",
      "aventura-en-buggies-y-altos-de-chavon": "Altos de Chavón + Aventura en Buggies"
    }
  }
}
```

La API solo sustituye el `title` de cada elemento **en el arreglo `packages[]`
de la respuesta del padre**. Las consultas directas al slug histórico conservan
el título original, el contenido, los precios y `sourceProvider`. Las etiquetas
inválidas se ignoran sin deshacer la familia.

## Comando de aplicación local

En el worktree existente `quisqueya-platform-c2`, después de sincronizar la rama:

```powershell
node --test scripts/label-altos-family-u2.test.mjs
node scripts/label-altos-family-u2.mjs
# Solo si el dry-run indica ADD_PRESENTATION_LABELS y no hay errores:
node scripts/label-altos-family-u2.mjs --apply
node scripts/label-altos-family-u2.mjs
```

El último comando debe devolver `NOOP_LABELS_READY` y `writesPerformed: false`.
El script solo acepta MySQL local `quisqueya_core` y rechaza `APP_ENV` de staging
o producción. Usa una transacción y no crea, publica ni modifica hijos.

## Pendientes antes de staging

1. Ejecutar y verificar U2 en el MySQL local del desarrollador.
2. Revisar editorialmente imagen, textos y UX de la familia en la web.
3. Conciliar publicación de los tres hijos DRAFT, padre DRAFT, medios y orden
   editorial por separado. El contrato público actual solo incluye registros
   `PUBLISHED`; crear/etiquetar el padre no lo publica.
4. Ejecutar QA y un plan de rollback explícito antes de tocar staging.

No se modifican Bávaro, City Tour sin Altos, la carpeta Drive ni los registros
WordPress existentes.
