# Testing and Quality Strategy

The repository should use a testing pyramid: fast unit tests, focused integration tests and a smaller number of E2E tests for critical revenue paths.

## Unit tests

Targets:

- auth token rotation
- password reset
- coupon discount calculation
- checkout totals and fee absorption
- QR code signature parsing
- check-in duplicate/refused/accepted states
- affiliate commission calculation
- AI forecast deterministic logic
- tenant permission guards

Recommended tools:

- Jest for NestJS modules.
- React Testing Library for web components.
- TypeScript typecheck for SDK and mobile.

## Integration tests

Targets:

- Prisma repositories and migrations.
- Checkout transaction with inventory update.
- Payment status update and ticket issuance.
- Offline check-in sync transaction.
- Seat hold/reservation concurrency.
- CRM customer upsert and campaign creation.

Use a disposable PostgreSQL database in CI. Tests must seed only what they need.

## E2E tests

Critical paths:

- organizer registers and creates event
- ticket type is created
- public user buys ticket
- payment is marked paid
- buyer sees ticket
- check-in validates QR code
- duplicate check-in is refused
- organizer sees dashboard revenue

Recommended tool:

- Playwright for web E2E.
- API smoke tests against staging after deploy.

## Performance tests

Scenarios:

- public event page traffic spike
- checkout on scarce ticket inventory
- check-in scan burst at gate opening
- dashboard analytics over large tenant history
- marketplace search with filters

Baseline targets:

- Public event page p95 under 500 ms cached.
- Checkout p95 under 800 ms excluding provider latency.
- Check-in validation p95 under 300 ms online.
- Offline sync 5,000 scans per batch without timeout.

## Code quality gates

Every pull request should pass:

- `pnpm lint`
- `pnpm --filter @eventflow/api test`
- `pnpm --filter @eventflow/api build`
- `pnpm --filter @eventflow/web test`
- `pnpm --filter @eventflow/web build`
- `pnpm --filter @eventflow/mobile test`
- `pnpm --filter @eventflow/mobile typecheck`
- `pnpm --filter @eventflow/domain build`
- `pnpm --filter @eventflow/sdk build`
- Prisma schema validation through the API build, plus explicit migration review
- migration review
- dependency audit
- Docker build for API and web

Current critical regression coverage:

- Web API client refreshes the access token once and retries concurrent 401 responses without hanging.
- Online check-in claims a ticket with a conditional `AVAILABLE -> USED` update so duplicate concurrent scans do not both enter.
- AbacatePay webhooks require the configured secret and a valid HMAC signature before payment state changes.
- Payment webhooks remain idempotent and do not emit duplicate buyer notifications for already processed events.

Environment notes:

- Local sandboxed runners can block `tsx --test` IPC pipes. In CI, run web and mobile tests in a normal Node environment.
- Playwright checkout E2E should run after a disposable PostgreSQL/Redis/API/web stack is available.

## Clean Code and DDD rules

- Controllers translate HTTP only.
- Services express use cases.
- Repositories own complex queries.
- DTOs own request validation.
- Domain invariants stay near the use case, not in UI code.
- Avoid cross-module imports that bypass public services.
- Keep tenant isolation visible in method signatures.
- Prefer small explicit DTOs over `Record<string, unknown>` for public stable APIs.

## Known quality gaps

- Enterprise endpoints currently need dedicated DTO classes before external API publication.
- Public API keys and OAuth models exist, but guards/token exchange must be completed before production partner access.
- Prisma validation was blocked by local `node_modules` link issues in the current Windows environment; CI should validate from a clean install.
