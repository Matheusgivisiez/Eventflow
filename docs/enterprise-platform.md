# Event Flow Enterprise Platform

This document is an enterprise capability inventory. It does not mean every module is production-ready.

Use [Product Maturity](./product-maturity.md) as the source of truth for what is ready, partial or planned.

## Product modules

| Module | Status | Current capability | Main gap |
| --- | --- | --- | --- |
| White label | `partial` | Custom domain fields, DNS instructions, logos, theme colors and custom sender templates. | Automated DNS/CDN provisioning and domain verification. |
| Mobile offline | `partial` | React Native/Expo app with SQLite offline check-in and batch sync endpoint. | Login, secure token storage and environment selection. |
| Affiliates | `partial` | Links, commission records, payout records and dashboard counters. | Payout workflow, fraud checks and promoter-facing polish. |
| CRM | `partial` | Customers, segments and timeline-ready model. | Import/export, dedupe and consent operations. |
| Marketing | `partial` | Campaigns, automation rules and queued message records. | Real providers for email, WhatsApp, push and SMS. |
| Analytics | `partial` | Internal events, heatmaps, funnels and integration records. | Consistent frontend collection and real dashboards/alerts. |
| Public API | `partial` | OAuth client records, API keys, SDK package and public docs. | API key guard, OAuth exchange and generated SDK release process. |
| Seat maps | `partial` | Numbered seats, holds, reservations and checkout attribution model. | Visual editor and load-tested distributed locking. |
| Marketplace | `partial` | Search, categories, organizer profile, favorites and reviews. | Verification workflow, moderation and sponsorship operations. |
| AI | `prototype` | Forecast, insight and fraud signal records. | Real model/service, governance and explainability. |
| Executive dashboard | `partial` | MRR, ARR, LTV, CAC, churn, revenue and profit summaries. | Production financial reconciliation and real SaaS subscription data. |
| Security | `partial` | 2FA records, anti-fraud signals, LGPD consent records, backups, encryption keys and advanced permissions. | Real 2FA enrollment, restore tests and key rotation. |

## Scale profile

- Stateless API pods behind Kubernetes HPA: blueprint/manifests exist; staging proof is still required.
- Redis Cluster for hot dashboards, rate limits, sessions and seat holds: local Redis is configured; cluster operation is planned.
- RabbitMQ/BullMQ workers for checkout, notification, fraud and sync workloads: queue foundations exist; workload-specific production workers need validation.
- PostgreSQL tenant-aware indexes and read replicas: schema/indexes exist; production-like migration/load validation is required.
- CloudFront + S3 for white-label assets and public pages: documented target, not fully wired as default upload path.
- Prometheus, Grafana and Loki for metrics, dashboards and centralized logs: local/infra foundation exists; business alerts still need implementation.
