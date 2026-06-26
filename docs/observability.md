# Observability

Observability must answer three questions quickly: is the system healthy, which tenant/event is impacted, and what changed recently.

## Signals

- Metrics: Prometheus text endpoint at `/api/metrics`.
- Logs: structured request logs through API middleware.
- Audit: domain actions in `AuditLog`.
- Operational signals: `ObservabilitySignal`.
- Dashboards: Grafana.
- Central logs: Loki or equivalent.

## Recommended metrics

API:

- request count by route/status
- request latency p50/p95/p99
- error rate by module
- auth failures
- rate-limit blocks

Checkout:

- checkout created
- payment pending/paid/refunded/canceled
- ticket issue latency
- inventory conflict count
- coupon validation failures

Check-in:

- scans per minute
- accepted/refused/duplicated count
- offline sync batch size
- sync conflict rate

Database:

- connection pool usage
- slow queries
- transaction duration
- locks and deadlocks
- replication lag

Queues:

- queue depth
- processing latency
- retries
- dead-letter count

## Logs

Every API request log should include:

- request id
- method
- path
- status code
- duration
- user id if authenticated
- tenant id if available
- IP/user agent

Never log:

- passwords
- JWTs
- refresh tokens
- API keys
- payment card data
- 2FA secrets

## Alerts

Critical:

- API error rate above 2 percent for 5 minutes.
- Checkout creation failures above threshold.
- Payment webhook failures.
- Database unavailable.
- Redis unavailable.
- Queue dead-letter growth.
- Backup failure.

Warning:

- p95 latency above target.
- check-in duplicate spike.
- fraud high-risk spike.
- Redis memory pressure.
- RDS CPU or connection saturation.

## SLOs

Suggested initial targets:

- Public event page availability: 99.95 percent.
- Checkout API availability: 99.95 percent.
- Dashboard API availability: 99.9 percent.
- Check-in validation p95 latency: under 300 ms online.
- Offline sync successful processing: 99.9 percent within 5 minutes.

## Incident process

1. Declare incident and owner.
2. Identify impacted tenants/events.
3. Check recent deploys and migrations.
4. Check API, DB, Redis and queue dashboards.
5. Mitigate first, root cause second.
6. Create postmortem within 48 hours.
7. Add regression test or monitor for the failure mode.
