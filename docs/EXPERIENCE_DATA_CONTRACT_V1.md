# Experience Data Contract v1

**Estado:** base técnica inicial para Fase 1  
**Caso piloto:** Saona Regular  
**Fuente funcional:** `docs/EXPERIENCE_SAONA_FUNCTIONAL_SPEC_2026-08-21.md`  
**Objetivo:** definir una forma estable, reusable y retrocompatible de almacenar y exponer información enriquecida de experiencias usando el modelo `Experience` actual, sin rediseñar Prisma ni adelantar funcionalidades administrativas de Fase 2.

---

## 1. Principios

1. `Experience` sigue siendo la entidad principal.
2. Se reutilizan los campos JSON existentes del Content Core.
3. Los contratos aquí definidos son opcionales y deben tolerar registros antiguos o incompletos.
4. Ningún componente del frontend debe interpretar reglas internas a partir de texto libre.
5. Las reglas operativas privadas no deben exponerse automáticamente en la API pública.
6. Las políticas generales no se duplican dentro de cada experiencia.
7. Saona define un caso de estrés del modelo, no una plantilla rígida que obligue a todas las experiencias a poseer los mismos datos.

---

## 2. Mapeo sobre `Experience`

| Responsabilidad | Campo existente |
|---|---|
| Identidad | `title`, `slug`, `excerpt`, `description`, `featuredText` |
| Duración | `duration`, `durationValue`, `durationUnit` |
| Precio y edades | `pricingMode`, `pricingJson` |
| Reglas de reserva | `bookingJson` |
| Días / mínimos / disponibilidad | `availabilityJson` |
| Incluye | `includedItemsJson` |
| No incluye | `excludedItemsJson` |
| Itinerario | `itineraryJson` |
| Recomendaciones / pickup / accesibilidad pública | `practicalInfoJson` |
| Presentación | `displayJson` |
| Banderas editoriales | `editorialFlagsJson` |
| Trazabilidad | `sourceProvider`, `sourceId`, `sourceUrl`, `provenanceJson` |

No se agregan columnas específicas como `adultPrice`, `childPrice`, `minimumPassengers`, `pregnancyAllowed` o equivalentes en esta etapa.

---

## 3. `pricingJson` v1

Forma recomendada:

```json
{
  "version": 1,
  "currency": "USD",
  "taxIncluded": true,
  "tiers": [
    {
      "key": "adult",
      "label": "Adulto",
      "minAge": 11,
      "maxAge": null,
      "price": 85
    },
    {
      "key": "child",
      "label": "Niño",
      "minAge": 3,
      "maxAge": 10,
      "price": 50
    },
    {
      "key": "infant",
      "label": "Menor de 3 años",
      "minAge": 0,
      "maxAge": 2,
      "price": 0
    }
  ]
}
```

### Reglas

- `currency` usa código ISO cuando sea posible.
- `price` es numérico.
- `taxIncluded` comunica si impuestos/tasas están contemplados.
- `tiers` puede estar ausente en experiencias con precio único o bajo consulta.
- El frontend no debe inferir rangos de edad que no estén presentes.

---

## 4. `availabilityJson` v1

```json
{
  "version": 1,
  "operatingDays": [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY"
  ],
  "minimumParticipants": 2,
  "singlePassengerRequiresConfirmation": true,
  "shortNoticeRequiresConfirmation": true,
  "shortNoticeThresholdHours": 18
}
```

### Reglas

- `operatingDays` contiene únicamente días confirmados.
- `minimumParticipants` no implica que una reserva por debajo del mínimo sea rechazada automáticamente; la regla específica se expresa con flags de confirmación.
- La API pública puede exponer la necesidad de confirmación, pero no el nombre/rol interno de quien autoriza.

---

## 5. `bookingJson` v1

```json
{
  "version": 1,
  "confirmation": {
    "pickupDetailsConfirmedBeforeExperience": true,
    "shortNoticeSubjectToAvailability": true
  },
  "pickup": {
    "zones": [
      {
        "key": "santo-domingo",
        "label": "Santo Domingo",
        "standardMeetingPoint": "Parque Colón, frente a Pizzarelli",
        "hotelPickup": false,
        "privatePickupAvailable": true,
        "privatePickupSupplementApplies": true,
        "requiresCoordinatorConfirmation": true
      },
      {
        "key": "boca-chica",
        "label": "Boca Chica",
        "hotelPickup": true,
        "requiresCoordinatorConfirmation": false
      },
      {
        "key": "juan-dolio",
        "label": "Juan Dolio",
        "hotelPickup": true,
        "requiresCoordinatorConfirmation": false
      },
      {
        "key": "nueva-romana",
        "label": "Nueva Romana",
        "requiresCoordinatorConfirmation": true
      },
      {
        "key": "bavaro-punta-cana",
        "label": "Bávaro / Punta Cana",
        "requiresCoordinatorConfirmation": true
      }
    ]
  }
}
```

### Reglas

- El contrato separa zona tarifaria de modalidad real de pickup.
- `requiresCoordinatorConfirmation` puede existir en dominio/CRM; la representación pública debe transformarse a lenguaje comercial neutral.
- No publicar nombres de responsables internos ni procesos de cierre de ventas.

---

## 6. `practicalInfoJson` v1

```json
{
  "version": 1,
  "recommendations": [
    "Toalla",
    "Segundo cambio de ropa",
    "Calzado fácil de retirar",
    "Repelente de insectos",
    "Protector solar"
  ],
  "accessibility": {
    "reducedMobility": {
      "recommended": false,
      "caseByCaseEvaluationAvailable": true
    },
    "pregnancy": {
      "regularRouteRecommended": false,
      "alternativeAvailable": true,
      "alternativeLabel": "Catamarán - Catamarán",
      "requiresEvaluation": true
    }
  },
  "publicNotes": []
}
```

### Reglas

- Evitar etiquetas absolutas de discapacidad.
- Las recomendaciones son información pública.
- Las notas médicas o evaluaciones individuales no se almacenan aquí.

---

## 7. `itineraryJson` v1

Forma base:

```json
{
  "version": 1,
  "items": [
    {
      "order": 1,
      "time": "06:45-07:40",
      "title": "Recogida",
      "description": "Horario aproximado según punto de encuentro."
    },
    {
      "order": 2,
      "time": "09:30",
      "title": "Llegada a Bayahíbe",
      "description": "Inicio del proceso de embarque."
    }
  ],
  "timesAreApproximate": true
}
```

El contenido completo debe provenir de la ficha funcional validada; este ejemplo define estructura, no sustituye el itinerario editorial final.

---

## 8. `includedItemsJson` / `excludedItemsJson`

Forma recomendada:

```json
{
  "version": 1,
  "items": [
    {
      "key": "round-trip-transport",
      "label": "Transporte ida y vuelta"
    }
  ]
}
```

Se mantiene una estructura mínima para permitir futuros metadatos sin convertir los componentes en parsers de texto libre.

---

## 9. Política de cancelación

La política general de Quisqueya Travel **no debe duplicarse dentro de `Experience`**.

Contrato funcional confirmado:

- más de 24 horas antes: reembolso 100%;
- 24 horas o menos: no reembolsable / penalidad 100%;
- no-show: penalidad 100%;
- fenómeno atmosférico que impide operar: reembolso 100% o reprogramación acordada;
- cancelación del operador: reembolso 100%;
- cambio de fecha solicitado: no genera devolución.

Excepciones conocidas:

- Bávaro Adventure Park;
- Hacienda Park;
- El Dorado Water Park;
- Scape Park;
- Coco Bongo.

En Fase 1, la web debe poder enlazar a una página de política general y mostrar una nota/estado de excepción cuando aplique. La administración de políticas reutilizables pertenece a la evolución del dominio/CRM de Fase 2.

---

## 10. Variantes de Saona

### Variantes de `Saona Regular`

- Almuerzo VIP.
- Transporte VIP.
- Transporte VIP + Almuerzo VIP.

Estas variantes heredan el recorrido base y modifican únicamente las capacidades confirmadas de cada upgrade.

### Experiencia independiente

`Saona 4 Playas` es una experiencia separada porque cambia el recorrido. No debe heredar automáticamente precio, incluidos, excluidos, pickup ni itinerario de Saona Regular mientras esos datos no hayan sido confirmados.

---

## 11. Compatibilidad y normalización

Todo consumidor debe soportar simultáneamente:

1. registros legacy sin `version`;
2. registros con JSON parcial;
3. registros v1 completos;
4. `null` en cualquiera de los campos opcionales.

La normalización debe ocurrir antes de la presentación. Los componentes visuales reciben un shape estable y no deben conocer diferencias entre datos legacy y v1.

---

## 12. Límites de Fase 1

Este contrato autoriza estructurar y presentar datos ya validados, pero **no** implica construir en Fase 1:

- editor de experiencias;
- gestor de políticas;
- workflow de coordinadores;
- autorización de excepciones;
- motor transaccional de reembolsos;
- gestión operacional interna;
- sistema completo de variantes del CRM.

Esas capacidades deben construirse cuando el alcance correspondiente de Fase 2 sea autorizado.

---

## 13. Criterio de aceptación para Saona Regular

Antes de considerar integrada la ficha piloto:

- el API puede representar precios por edad sin perder la información legacy;
- operación diaria y mínimos quedan estructurados;
- pickup queda diferenciado por zona;
- recomendaciones y accesibilidad quedan representadas;
- itinerario mantiene horarios aproximados;
- incluidos/excluidos permanecen estructurados;
- política general se referencia, no se duplica como regla hardcodeada;
- ninguna de las demás experiencias falla por ausencia de los nuevos shapes;
- `Saona 4 Playas` no hereda datos no confirmados;
- no se expone información operativa privada.

---

## 14. Próximo paso técnico

Auditar y adaptar el serializer/DTO de `Experience` y el normalizador de `quisqueya-web` para aceptar progresivamente este contrato v1. La implementación debe ser aditiva y mantener los fallbacks actuales hasta que el catálogo completo esté normalizado.
