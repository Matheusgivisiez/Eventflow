# API Reference

The API is implemented with NestJS and uses the global prefix `/api`. Swagger is available at `/docs` when the API is running.

## Authentication

- Private endpoints use JWT bearer tokens.
- `Authorization: Bearer <accessToken>`.
- Access token lifetime is controlled by `JWT_ACCESS_EXPIRES_IN`.
- Refresh tokens are stored hashed in `RefreshToken`.
- Team permission checks are implemented through guards and decorators.

## Public endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Service health check |
| `GET` | `/api/metrics` | Prometheus text metrics |
| `GET` | `/api/events/public` | Public event list |
| `GET` | `/api/events/public/:slug` | Public event detail |
| `POST` | `/api/checkout/:slug` | Create checkout order |
| `POST` | `/api/webhooks/mercado-pago` | Mercado Pago webhook |
| `POST` | `/api/webhooks/stripe` | Stripe webhook placeholder |
| `POST` | `/api/webhooks/asaas` | Asaas webhook placeholder |
| `GET` | `/api/enterprise/marketplace` | Marketplace search |
| `GET` | `/api/enterprise/marketplace/categories` | Marketplace categories |
| `POST` | `/api/enterprise/analytics/track` | Public analytics ingest |
| `GET` | `/api/enterprise/public-api/docs` | Public API metadata |
| `GET` | `/api/enterprise/white-label/resolve` | Resolve custom domain |

## Auth endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create user and optional organizer tenant |
| `POST` | `/api/auth/login` | Issue access and refresh tokens |
| `POST` | `/api/auth/refresh` | Rotate refresh token |
| `POST` | `/api/auth/forgot-password` | Create password reset token |
| `POST` | `/api/auth/reset-password` | Reset password |
| `GET` | `/api/auth/me` | Current user |
| `POST` | `/api/auth/become-organizer` | Convert customer to organizer |

## Organizer endpoints

| Module | Paths |
| --- | --- |
| Dashboard | `GET /api/dashboard` |
| Events | `GET/POST /api/events`, `GET/PATCH/DELETE /api/events/:id` |
| Ticket types | `GET/POST /api/events/:eventId/ticket-types`, `PATCH/DELETE /api/events/:eventId/ticket-types/:id` |
| Coupons | `GET/POST /api/coupons`, `PATCH/DELETE /api/coupons/:id` |
| Check-in | `POST /api/check-in/events/:eventId/validate`, `GET /api/check-in/events/:eventId/logs` |
| Participants | `GET /api/participants` |
| Finance | `GET /api/finance/summary`, `GET /api/finance/statement`, `POST /api/finance/withdrawals` |
| Payments | `GET /api/payments`, `POST /api/payments/orders/:orderId/preference`, `PATCH /api/payments/:id/status` |
| Reports | `GET /api/reports`, `GET /api/reports/export` |
| Team | `GET/POST /api/team`, `PATCH/DELETE /api/team/:id` |
| Profile | `PATCH /api/profile`, `PATCH /api/profile/password`, `GET /api/profile/tickets` |
| Notifications | `GET/POST /api/notifications` |
| Audit | `GET /api/audit` |

## Buyer endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/buyer/tickets` | Buyer ticket wallet |
| `POST` | `/api/buyer/tickets/:id/refund` | Request ticket refund |
| `GET` | `/api/buyer/tickets/:id/pdf` | Ticket PDF |
| `GET` | `/api/buyer/tickets/:id/google-wallet` | Google Wallet payload |
| `GET` | `/api/buyer/tickets/:id/apple-wallet` | Apple Wallet payload |

## Enterprise endpoints

| Capability | Paths |
| --- | --- |
| Overview | `GET /api/enterprise/overview` |
| White label | `GET/PATCH /api/enterprise/white-label` |
| Mobile offline | `POST /api/enterprise/mobile/devices`, `POST /api/enterprise/mobile/checkin-sync` |
| Affiliates | `GET /api/enterprise/affiliates`, `PATCH /api/enterprise/affiliates/program`, `POST /api/enterprise/affiliates/links` |
| CRM | `GET/POST /api/enterprise/crm/customers`, `POST /api/enterprise/crm/segments`, `POST /api/enterprise/crm/campaigns`, `POST /api/enterprise/crm/automations` |
| Marketing | `GET /api/enterprise/marketing`, `POST /api/enterprise/marketing/messages` |
| Analytics | `GET /api/enterprise/analytics`, `POST /api/enterprise/analytics/integrations` |
| Public API | `POST /api/enterprise/api/clients`, `POST /api/enterprise/api/keys` |
| Seat maps | `GET/POST /api/enterprise/seat-maps/:eventId`, `POST /api/enterprise/seat-maps/:eventId/hold`, `POST /api/enterprise/seat-maps/:eventId/reserve` |
| Marketplace | `PATCH /api/enterprise/marketplace/profile`, `POST /api/enterprise/marketplace/reviews`, `POST /api/enterprise/marketplace/favorites` |
| AI | `GET /api/enterprise/ai`, `POST /api/enterprise/ai/forecast` |
| Executive | `GET /api/enterprise/executive` |
| Security | `GET /api/enterprise/security`, `POST /api/enterprise/security/2fa`, `POST /api/enterprise/security/backups` |
| Infrastructure | `GET /api/enterprise/infrastructure` |

## OpenAPI process

- Controllers must use `@ApiTags`.
- Authenticated routes must use `@ApiBearerAuth`.
- DTOs should use class-validator decorators.
- Public request/response schemas should be represented with DTO classes before external publication.
- CI should export `/docs-json` and publish the generated OpenAPI artifact for SDK generation.

## Error format

The global exception filter normalizes errors. API clients should expect:

```json
{
  "statusCode": 400,
  "message": "Erro validado",
  "timestamp": "2026-06-26T00:00:00.000Z",
  "path": "/api/..."
}
```
