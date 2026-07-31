# Quisqueya Platform — Public DMC Content Slice

## Purpose

Provide a minimal, real API bridge for DMC commercial content while the full CRM editor and specialized DMC operations domain remain scheduled for later phases.

This slice follows the existing project rule:

```text
Prisma / MySQL Content Core
        -> NestJS public API
        -> quisqueya-web content service
        -> typed presentation components
```

WordPress is not a runtime dependency of the commercial web.

## Persistence boundary

The first DMC payload is stored as JSON in the existing published `ContentPage` record with slug:

```text
dmc-services
```

This avoids a premature Prisma expansion while preserving a stable public contract. When the CRM requires specialized DMC editing, the backing persistence may move to dedicated models without changing the public response consumed by `quisqueya-web`.

## Public endpoint

```http
GET /api/v1/public/services
```

Only a published `dmc-services` page is read. Missing, malformed, or incomplete content returns an empty list instead of breaking the API.

## Payload shape

```json
{
  "services": [
    {
      "id": "dmc-events",
      "slug": "eventos",
      "title": "Eventos",
      "shortDescription": "...",
      "order": 2,
      "showcase": {
        "items": [
          {
            "id": "event-corporate",
            "slug": "eventos-corporativos",
            "label": "Eventos corporativos",
            "eyebrow": "Encuentros empresariales",
            "title": "...",
            "description": "...",
            "fallbackImage": "/media/dmc/incentives/experiencia-corporativa.jpg",
            "imageAlt": "...",
            "badge": "Operación personalizada",
            "facts": ["Formato a medida"],
            "benefits": ["Planificación personalizada del programa"],
            "cta": {
              "label": "Solicitar propuesta corporativa",
              "href": "/#solicitud"
            },
            "order": 0
          }
        ],
        "secondaryCta": {
          "label": "Solicitar propuesta",
          "href": "/#solicitud"
        }
      }
    }
  ]
}
```

## Responsibility split

Dynamic/API-managed:

- service title and description;
- showcase modalities;
- labels, editorial copy, facts and benefits;
- media references;
- CTA labels and destinations;
- ordering and publication state.

Static in `quisqueya-web`:

- accordion and tab behavior;
- layout and responsive rules;
- GSAP motion;
- accessibility structure;
- design tokens and Lucide icon treatment;
- empty and fallback presentation.

## Current fallback rule

`quisqueya-web` consumes the API first. Until the `dmc-services` record is populated in each environment, structured local fallback data keeps the approved Home composition available. API data takes priority over migrated and fallback content.

## Future CRM extension

The later CRM phase may add:

- DMC service editor;
- media selection and uploads;
- preview and publication workflow;
- permissions and audit history;
- dedicated Prisma models if operational requirements justify them.

Those additions must preserve the public endpoint contract or introduce a versioned migration path.
