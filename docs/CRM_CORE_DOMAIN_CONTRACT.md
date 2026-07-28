# Quisqueya Platform — CRM Core Domain Contract

Status: **Phase 0.3 / frozen before client migration**

## Purpose

The inherited `Client` model is a lending customer record. It cannot be renamed blindly into a travel customer because it currently carries credit approval, blocking, credit rating, collector assignment, loan relations and collection-route semantics.

This document freezes the minimum travel-domain contract that must exist before the active `/clients` route is migrated.

## Core principle

A person is not automatically a customer, and a customer is not automatically a traveler.

```text
Contact
  -> may become Customer
  -> may participate in TravelRequest / Opportunity / Quote
  -> may or may not travel

Customer
  -> commercial relationship / purchaser / account holder
  -> can book for self or for other travelers

Traveler
  -> person attached to a concrete trip / booking / operation
  -> travel-specific personal/document data belongs here
```

No financial-credit behavior from PrestaFacil is carried into these concepts.

## Entity contracts

### Contact

Primary CRM person record.

Minimum fields:

- `id`
- `companyId`
- `ownerUserId?`
- `firstName`
- `lastName`
- `email?`
- `phone?`
- `whatsapp?`
- `countryCode?`
- `preferredLanguage?`
- `source?`
- `notes?`
- `status`
- `createdAt`
- `updatedAt`

Allowed status intent:

- `ACTIVE`
- `INACTIVE`
- `ARCHIVED`

A Contact must not contain:

- credit rating;
- lending approval status;
- mora state;
- blocked-for-credit flags;
- loan balance;
- collector assignment;
- collection route relations.

### Customer

Commercial/account role attached to a Contact or Organization.

Minimum fields:

- `id`
- `companyId`
- `contactId?`
- `organizationId?`
- `customerType` (`PERSON` or `ORGANIZATION`)
- `billingName?`
- `taxId?`
- `billingEmail?`
- `billingPhone?`
- `billingAddress?`
- `createdAt`
- `updatedAt`

Rules:

- A Contact may exist without a Customer record.
- A Customer may represent a person or an organization/agency.
- Dominican `cedula` or `RNC` may be stored as tax/identity information when legitimately needed, but is not a universal required field for all contacts.
- Customer status is commercial/administrative, never a credit-scoring status inherited from lending.

### Traveler

Trip-scoped passenger/guest record.

Minimum fields:

- `id`
- `companyId`
- `bookingId` or future operation/trip relation
- `contactId?`
- `firstName`
- `lastName`
- `dateOfBirth?`
- `nationality?`
- `documentType?`
- `documentNumber?`
- `documentExpiry?`
- `specialRequirements?`
- `createdAt`
- `updatedAt`

Rules:

- Traveler data is not stored on the generic Contact unless it is truly contact-level information.
- Passport/document fields are optional at the CRM contact stage and become relevant when an operation requires them.
- A customer can purchase a trip for travelers who are not the customer.

## Organization / Agency

Agencies, corporate clients and suppliers must not be squeezed into a person `Contact` record.

Future minimum entity:

- `Organization`
- organization contacts can link through explicit relations rather than duplicated free-text fields.

This is important for B2B/DMC workflows.

## Funnel relations

The intended commercial flow remains:

```text
Contact / Organization
  -> TravelRequest
  -> Lead
  -> Opportunity
  -> Quote
  -> Booking
  -> Traveler(s)
  -> Operation
```

The exact Lead/TravelRequest ordering may be refined when the CRM module is implemented, but no inherited lending entity may stand in for these concepts.

## Inherited Client mapping

The current Prisma `Client` is **legacy lending compatibility only**.

Potentially reusable source data:

- `firstName` -> Contact.firstName
- `lastName` -> Contact.lastName
- `phone` -> Contact.phone
- `address` -> Customer.billingAddress only if semantically valid; otherwise import note/review
- `cedula` -> Customer.taxId / identity field only when appropriate and with explicit migration provenance
- `photo` -> future Media relation only if retained with consent/purpose
- `createdAt` -> provenance/reference, not blindly reused as CRM lifecycle date if semantics differ

Do **not** map:

- `creditRating`
- `isBlocked`
- lending `status` (`Pendiente/Aprobado/Rechazado`)
- `assignedUserId` when it means collector assignment
- loan relations
- route/visit/payment-promise relations

Any ambiguous field must be marked for review rather than guessed.

## API boundary for the active CRM contacts surface

Target public/internal CRM API naming:

```text
GET    /api/v1/contacts
POST   /api/v1/contacts
GET    /api/v1/contacts/:id
PATCH  /api/v1/contacts/:id
```

Customer/traveler endpoints should be separate when those models are introduced.

The active frontend must eventually consume `contactsService`, not `dataService.ts` and not the inherited `/clients` adapter.

## Migration rule for `/clients`

Do not rewrite `/clients` against the inherited Prisma `Client` and call it finished.

Required order:

1. freeze this contract;
2. introduce Prisma `Contact` (and minimal relations/provenance needed for safe migration);
3. add Nest contacts API;
4. add frontend `contactsService`;
5. replace active `/clients` with a neutral Contacts surface;
6. redirect legacy `/clients/:id` only after a Contact detail route exists;
7. quarantine/remove the inherited Client API and model only after no active consumers remain.

The route label can remain `Clientes` temporarily for user-facing continuity, but the domain object underneath must be Contact/Customer-aware.

## WordPress/content boundary

CRM contacts are independent from WordPress content migration.

WordPress remains a source for commercial content/media, not a source of CRM people unless a separate, explicit customer-data migration is later authorized.

## Non-negotiable safeguards

- no guessed mappings;
- no credit/lending semantics in new CRM models;
- no localStorage authority;
- no new `dataService.ts` dependency;
- preserve source provenance when migrating inherited records;
- personal/document data must only be added where operationally required.
