# Database Documentation

EventHub uses PostgreSQL through Prisma ORM. The data model is intentionally tenant-aware and optimized around organizer isolation, event sales, checkout throughput and operational analytics.

## Tenancy model

- `Tenant` represents an organizer account or organization.
- Most organizer-owned records carry `tenantId`.
- Public buyer identity can exist as `User` with `CUSTOMER` role or as `BuyerProfile`.
- All authenticated organizer queries must filter by `tenantId`.
- Cross-tenant reads are allowed only for `ADMIN` modules and public marketplace endpoints.

## Core domain tables

- Identity: `User`, `RefreshToken`, `PasswordResetToken`, `TeamMember`.
- Organizer and subscription: `Tenant`, `Subscription`.
- Events and ticket inventory: `Event`, `TicketType`, `Ticket`.
- Checkout and payments: `Order`, `OrderItem`, `Payment`.
- Check-in: `CheckInLog`, `OfflineCheckinBatch`, `OfflineCheckinEntry`.
- Finance: `LedgerEntry`, `Withdrawal`.
- Coupons and promotions: `Coupon`.
- Notifications: `NotificationLog`, `MarketingMessage`.
- Audit: `AuditLog`.

## Enterprise tables

- White label: `WhiteLabelSetting`.
- Mobile: `MobileDevice`.
- Affiliates: `AffiliateProgram`, `AffiliateLink`, `AffiliateCommission`, `AffiliatePayout`.
- CRM: `CrmCustomer`, `CrmSegment`, `CrmCampaign`, `CrmAutomation`, `CustomerTimelineEvent`.
- Analytics: `AnalyticsEvent`, `AnalyticsIntegration`, `HeatmapSnapshot`, `ConversionFunnel`.
- Public API: `PublicApiClient`, `ApiKey`, `OAuthAuthorizationCode`, `OAuthAccessToken`, `SdkRelease`.
- Seats: `SeatMap`, `SeatSection`, `Seat`, `SeatHold`, `SeatReservation`.
- Marketplace: `MarketplaceProfile`, `EventSponsorship`, `FavoriteEvent`, `EventReview`, `EventCategory`.
- AI and fraud: `AiForecast`, `AiInsight`, `FraudSignal`.
- Executive metrics: `ExecutiveMetricSnapshot`.
- Security and operations: `TwoFactorSecret`, `ConsentRecord`, `BackupJob`, `EncryptionKeyRecord`, `PermissionPolicy`, `DeploymentTarget`, `ObservabilitySignal`.

## Critical indexes

Existing and added indexes target the highest-volume paths:

- `Event(tenantId, status)` for organizer dashboards.
- `Event(startsAt)` and `Event(category, status)` for marketplace/search.
- `TicketType(eventId, isActive)` for checkout inventory lookup.
- `Order(eventId, status)` for sales reports and payment reconciliation.
- `Order(buyerEmail)`, `Order(buyerDocument)` for CRM and buyer history.
- `Ticket(eventId, status)` for check-in screens.
- `Ticket(uuid)` unique for QR validation.
- `LedgerEntry(tenantId, createdAt)` for finance statements.
- `AuditLog(entity, createdAt)` and `AuditLog(userId, createdAt)` for investigations.
- `AnalyticsEvent(tenantId, eventId, type)` and `AnalyticsEvent(sessionId, createdAt)` for funnels.
- `Seat(seatMapId, status)` and `SeatHold(tenantId, eventId, expiresAt)` for reserved seating.

## Query rules

- Always include `tenantId` in organizer-scoped queries.
- Use pagination on every list endpoint.
- Avoid loading nested arrays without `take`, `select` or aggregation.
- Use transactions for checkout, ticket issue, seat reservation and offline sync.
- Use Redis locks for high-concurrency inventory and seat holds in production.
- Store money as integer cents.
- Store provider references as opaque strings and never as trusted state.

## Migration policy

1. Create Prisma schema change.
2. Generate migration locally.
3. Review generated SQL for table locks, default values and backfills.
4. Run against staging with production-like data volume.
5. For large tables, split into expand/backfill/contract migrations.
6. Deploy backward-compatible API first.
7. Run migration.
8. Enable feature flags or traffic.

## Backup and retention

- Full PostgreSQL backups: daily.
- WAL/PITR: enabled for production.
- Backup storage: encrypted S3 bucket with lifecycle policy.
- Restore drill: at least monthly.
- Audit logs and consent records: retain according to legal policy.
- Payment records: retain as required by tax and financial regulations.
