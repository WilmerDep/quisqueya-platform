# Experience practical information

## Purpose

Define the API-first contract for the public **Antes de viajar** section and its future CRM editor without inventing editorial content.

## Audit result

### Already available

- `location.address`, `location.latitude`, `location.longitude`, `location.zoom`
- `booking` and `availability` source metadata
- `included`, `excluded`, `faqs`, `itinerary`
- provenance and editorial flags

These values may help validate practical information, but they must not be presented as a practical policy unless the source explicitly supports that interpretation.

### Needs normalization

Tourfic/WordPress metadata may contain pickup notes, booking notice, cancellation text, meeting point or restrictions under provider-specific keys. Importers must map only recognized keys and preserve the original field path in provenance.

### Not formally modeled before this change

- what to bring
- restrictions
- accessibility
- minimum age
- physical level
- meeting point instructions
- pickup availability, zones and details
- cancellation policy
- booking notice
- required documents

## Public contract

```ts
type PublicExperiencePracticalInfo = {
  whatToBring: string[];
  restrictions: string[];
  accessibility?: {
    available?: boolean;
    details?: string;
  };
  minimumAge?: number;
  physicalLevel?: 'low' | 'moderate' | 'high' | 'not_specified';
  meetingPoint?: {
    label?: string;
    address?: string;
    instructions?: string;
    latitude?: number;
    longitude?: number;
  };
  pickupInformation?: {
    available?: boolean;
    details?: string;
    zones: string[];
  };
  cancellationPolicy?: string;
  bookingNotice?: string;
  requiredDocuments: string[];
};
```

The database stores this structure in `experiences.practical_info_json`. Arrays must be emitted as empty arrays when the practical object exists. Empty practical objects should be treated as unpublished.

## Rendering rules

- Render only populated values.
- Never show empty cards or placeholder policy text.
- Do not infer accessibility, age limits, cancellation rules or required documents.
- `meetingPoint` may reuse the experience coordinates only when the source explicitly identifies them as the meeting point.
- Unknown physical level stays absent or `not_specified`; it must not be inferred from itinerary wording.
- Provider-specific raw values remain in provenance and are normalized by importers before public exposure.

## Future CRM behavior

The CRM should edit this object through typed controls rather than a raw JSON field:

- repeaters for lists;
- tri-state accessibility and pickup availability;
- controlled physical-level select;
- numeric minimum age;
- structured meeting point with optional coordinates;
- text areas for cancellation policy, booking notice and pickup details.
