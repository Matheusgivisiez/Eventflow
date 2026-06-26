# EventHub Enterprise Platform

This expansion adds enterprise capabilities without removing existing MVP flows.

## Product modules

- White label: custom domain, DNS instructions, logos, theme colors and custom sender templates.
- Mobile: React Native/Expo app for Android and iOS with SQLite offline check-in and batch sync.
- Affiliates: exclusive links, commissions, payout records and dashboard counters.
- CRM: customers, segments, campaigns, automation rules and timeline events.
- Marketing: email, WhatsApp, push and SMS message queue records.
- Analytics: heatmaps, funnels, conversion, sales origin, devices, campaigns, GA and Meta Pixel integrations.
- Public API: OAuth clients, API keys, SDK and public docs.
- Seat maps: numbered seats, temporary holds, reservations and checkout attribution.
- Marketplace: verified organizers, sponsored events, search, categories, favorites and reviews.
- AI: sales forecast, batch timing, price suggestions, behavior analysis and fraud signals.
- Executive dashboard: MRR, ARR, LTV, CAC, churn, revenue and profit.
- Security: 2FA, anti-fraud, LGPD consent records, audit, backups, encryption keys and advanced permissions.

## Scale profile

- Stateless API pods behind Kubernetes HPA.
- Redis Cluster for hot dashboards, rate limits, sessions and seat holds.
- RabbitMQ/BullMQ workers for checkout, notification, fraud and sync workloads.
- PostgreSQL tenant-aware indexes and read replicas.
- CloudFront + S3 for white-label assets and public pages.
- Prometheus, Grafana and Loki for metrics, dashboards and centralized logs.
