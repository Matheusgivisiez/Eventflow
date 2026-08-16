# Technical Governance

This document defines engineering standards for keeping Event Flow maintainable as it grows into an enterprise SaaS platform.

## Engineering principles

- Keep tenant isolation explicit.
- Prefer small modules with clear ownership.
- Keep controllers thin.
- Keep business rules in services or domain-oriented helpers.
- Prefer DTOs for all external inputs.
- Keep persistence details behind Prisma services or repositories.
- Measure before optimizing, but design checkout and check-in for contention.
- Document every externally visible API change.

## Clean Architecture target

Current pragmatic structure:

```text
controller -> dto -> service -> prisma/repository
```

Enterprise target:

```text
interface/http -> application/use-case -> domain -> infrastructure/persistence
```

Recommended migration path:

1. Split broad modules by bounded context.
2. Extract use-case classes for checkout, check-in, payment reconciliation and seat reservation.
3. Add repository interfaces for high-risk domains.
4. Keep Prisma types at infrastructure boundaries.
5. Add domain tests before refactors.

## Bounded contexts

- Identity and Access
- Organizer/Tenant
- Event Catalog
- Ticket Inventory
- Checkout
- Payments
- Ticketing and Check-in
- Finance
- CRM and Marketing
- Analytics
- Marketplace
- Public API
- Security and Compliance
- Operations

## Pull request checklist

- Does every organizer query include tenant scope?
- Are request bodies validated with DTOs?
- Are secrets excluded from logs and responses?
- Are new routes represented in Swagger?
- Are database changes indexed for expected access patterns?
- Are migrations backward compatible?
- Are cache invalidation rules documented?
- Are unit or integration tests added for the changed behavior?
- Is the user-facing flow accessible on mobile and desktop?
- Is operational impact documented when queues, jobs or providers are involved?

## API design standards

- Use nouns for resources.
- Use plural paths where possible.
- Keep public API versions stable.
- Return deterministic error shapes.
- Use pagination for list endpoints.
- Avoid exposing database IDs when public opaque IDs are better.
- Use idempotency keys for checkout, payment and webhook operations.
- Include request IDs in logs and responses for support.

## Database design standards

- Store money in integer cents.
- Use UTC timestamps.
- Use tenant-aware indexes.
- Avoid destructive migrations in the same deploy as application changes.
- Backfill large tables asynchronously.
- Prefer append-only logs for financial and audit data.

## Release readiness gates

Minimum for staging:

- Build passes.
- Prisma generate and validate pass.
- Migrations apply to empty and existing database.
- Unit tests pass.
- Integration tests pass for checkout, payment and check-in.
- Web smoke tests pass.
- API Swagger is generated.

Minimum for production:

- Staging bake period completed.
- Rollback plan reviewed.
- Database backup verified.
- Observability dashboards ready.
- Alert routing ready.
- Security review completed for auth, payment and public API changes.

## Ownership model

Suggested team ownership:

- Core Platform: auth, tenants, API, infra, observability.
- Commerce: checkout, payments, tickets, finance.
- Experience: web, mobile, buyer, organizer UX.
- Growth: CRM, marketing, affiliates, marketplace, analytics.
- Trust: LGPD, audit, fraud, security, compliance.

## Documentation policy

Update docs when changing:

- public endpoints
- environment variables
- database schema
- deployment topology
- security controls
- operational runbooks
- external provider contracts
