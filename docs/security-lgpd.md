# Security and LGPD

Security is handled through layered controls: identity, tenant isolation, permissions, validation, audit, encryption, anti-fraud and operational monitoring.

## Identity and session security

- Passwords are hashed with bcrypt.
- Access tokens are signed JWTs.
- Refresh tokens are random values stored as SHA-256 hashes.
- Password reset tokens are random values stored as SHA-256 hashes.
- Refresh token rotation is mandatory on refresh.
- Two-factor authentication data is modeled in `TwoFactorSecret`.

Production requirements:

- Enforce strong `JWT_*_SECRET` values from a secrets manager.
- Enforce HTTPS and secure cookies where cookies are introduced.
- Add device/session revocation UI.
- Rate-limit login, refresh and password reset routes.
- Add step-up auth for finance, API keys, team permissions and payouts.

## Authorization

- User roles: `ADMIN`, `ORGANIZER`, `TEAM`, `CHECKIN`, `CUSTOMER`.
- Team permissions cover check-in, finance, event editing, sales viewing and enterprise capabilities.
- All tenant-owned data must be filtered by `tenantId`.
- Admin-only endpoints must never return secrets, hashes or payment credentials.

## Input validation

- DTOs use `class-validator`.
- Global validation pipe uses whitelist and `forbidNonWhitelisted`.
- Public ingestion endpoints such as analytics and webhooks should have provider-specific validation and quotas before high-volume production use.

## Audit

`AuditLog` stores:

- actor user id
- action
- entity
- entity id
- metadata
- timestamp

Recommended audited actions:

- login failures and suspicious access
- event publish/unpublish
- ticket cancellation/refund
- payout creation and approval
- role and permission changes
- API key and OAuth client creation
- white-label domain changes
- backup and restore operations

## Anti-fraud

`FraudSignal` supports risk level, score, reasons and metadata. A production fraud pipeline should evaluate:

- duplicate document or email velocity
- payment provider risk response
- chargeback history
- device fingerprint reuse
- IP geolocation mismatch
- excessive coupon usage
- repeated failed payment attempts
- abnormal checkout velocity on scarce inventory

High-risk orders should be held for review before ticket issuance.

## LGPD

Personal data processed by EventHub includes:

- name
- email
- phone
- document
- purchase history
- device/session analytics
- marketing consent

LGPD controls:

- `ConsentRecord` records purpose, status, timestamp and metadata.
- CRM consent flags split email, WhatsApp and push permissions.
- Audit logs support accountability.
- Buyer data export must include orders, tickets, consent and marketing history.
- Deletion/anonymization must preserve legally required financial records.

## Data retention

Recommended defaults:

- Audit logs: 1 to 5 years depending on contract and legal policy.
- Marketing events: 13 months unless consent requires shorter retention.
- Payment records: follow tax/accounting obligations.
- Raw analytics events: aggregate after 90 to 180 days.
- Backup retention: 30 daily, 12 monthly, 5 yearly for enterprise plans.

## Encryption

- TLS in transit for all public endpoints.
- PostgreSQL storage encrypted at rest in production.
- S3 buckets encrypted with KMS.
- Secrets stored in AWS Secrets Manager, SSM Parameter Store or equivalent.
- `EncryptionKeyRecord` tracks key aliases and rotation metadata.

## Security backlog before global launch

- Add webhook signature verification for each payment provider.
- Add API key guard and OAuth token exchange implementation.
- Add CSRF strategy if browser cookies replace bearer tokens.
- Add per-tenant configurable password/2FA policy.
- Add secret scanning and SAST in CI.
- Add dependency vulnerability gate.
- Add WAF rules for checkout and auth endpoints.
