# EventHub Technical Documentation

EventHub is a multi-tenant SaaS platform for event discovery, ticket sales, payments, QR tickets, check-in, finance, CRM, marketplace and enterprise organizer operations.

This documentation is the source of truth for engineering, product operations, security reviews and deployment planning.

## Documentation map

- [Architecture](./architecture.md): system boundaries, module map, request flows and DDD guidelines.
- [Database](./database.md): Prisma schema, tenancy model, indexes, data ownership and migration guidance.
- [API Reference](./api-reference.md): HTTP modules, authentication, public/private endpoints and Swagger/OpenAPI.
- [Security and LGPD](./security-lgpd.md): authentication, RBAC, audit, anti-fraud, privacy and data lifecycle.
- [Infrastructure and Deploy](./infrastructure-deploy.md): Docker, Kubernetes, AWS, Redis, RabbitMQ and CI/CD.
- [Observability](./observability.md): metrics, logs, traces, dashboards, alerts and SLOs.
- [Testing and Quality](./testing-quality.md): unit, integration, E2E, performance and release gates.
- [Frontend and Mobile](./frontend-mobile.md): web UX/UI architecture and React Native offline check-in.
- [Operations Runbooks](./operations-runbooks.md): incident, backup, payment, check-in and migration procedures.
- [Technical Governance](./technical-governance.md): engineering standards, release gates and ownership model.
- [Public API](./public-api.md): SDK usage, auth modes and partner API guidelines.
- [Enterprise Platform](./enterprise-platform.md): enterprise module inventory.

## Repository layout

```text
apps/
  api/        NestJS API, Prisma schema, migrations and backend modules
  web/        Next.js dashboard, public event pages and checkout
  mobile/     React Native/Expo check-in app with SQLite offline queue
packages/
  config/     shared Tailwind/design config
  sdk/        TypeScript SDK for public API consumers
infra/
  k8s/        Kubernetes manifests
  monitoring/ Prometheus config
  aws/        AWS deployment notes
docs/         technical documentation
```

## Local developer quickstart

```bash
cp .env.example .env
docker compose up -d postgres redis rabbitmq
pnpm install
pnpm --filter @eventhub/api prisma:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Services:

- Web: `http://localhost:3000`
- API: `http://localhost:3001/api`
- Swagger UI: `http://localhost:3001/docs`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3002`
- RabbitMQ management: `http://localhost:15672`

## Recent enterprise upgrades

### Architecture & DDD (Fase 1)
- Value Objects (`Email`, `Money`, `Document`) in `packages/domain/src/`
- Use Case pattern for checkout (`CreateCheckoutUseCase`) and check-in (`ValidateTicketUseCase`)
- Repository interfaces (`IEventsRepository`, `IOrdersRepository`) in `common/repositories/`
- Full Swagger documentation (`@ApiProperty`, `@ApiOperation`) on all DTOs and controllers
- Global rate limiting via `@nestjs/throttler` with Redis storage (120 req/min)

### Database, Cache & Performance (Fase 2)
- Critical composite indexes added: `Event(slug, status)`, `Order(status, createdAt)`, `Ticket(eventId, uuid)`, `Payment(eventId, status)`, `CheckInLog(ticketId, createdAt)`, `TicketType(eventId, startsAt, endsAt)`
- Redis Redlock service (`RedlockService`) for distributed seat reservation locks
- Intelligent caching with invalidation on public event endpoints (30s TTL)
- Read Replica pattern via `PrismaReadService` (uses `DATABASE_READ_URL` env var)
- SEO/JSON-LD structured data on public event pages

### Security & LGPD (Fase 3)
- Stricter rate limits on auth endpoints: register (5/min), login (10/min), forgot-password (3/min)
- LGPD anonymization worker (`LgpdProcessor`) via BullMQ queue
- Secrets via environment variables in docker-compose (no plain text passwords)
- Enhanced Helmet (CSP, HSTS, frameguard, noSniff) and strict CORS configuration

### Testing (Fase 4)
- Jest configured for unit tests (`jest.config.ts`, test examples in `packages/domain/src/__tests__/`)
- Playwright configured for E2E tests (`playwright.config.ts`, example in `apps/web/e2e/`)

### CI/CD & Infra (Fase 5)
- Multi-stage Dockerfiles with non-root users and healthchecks for API and Web
- docker-compose with healthchecks and resource limits on all services
- CI pipeline split into lint → typecheck → test → build → docker stages
- OpenTelemetry instrumentation (`opentelemetry.ts`) with Prometheus exporter (opt-in via `OTEL_ENABLED=true`)

## Production readiness status

The repository contains the product and infrastructure foundations for an enterprise SaaS. Before a real global launch, the following gates must be passed in a staging environment:

- Prisma migrations applied against a production-like PostgreSQL cluster.
- API, web and mobile builds passing in CI.
- Payment webhooks validated with provider signatures.
- Object storage, CDN, email, WhatsApp, push and fraud providers configured.
- Backup restore tested, not only backup creation.
- Load test executed for checkout, public event pages and check-in sync.
- Legal review of LGPD terms, data processing agreements and consent text.
