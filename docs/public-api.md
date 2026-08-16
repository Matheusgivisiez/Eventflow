# Event Flow Public API

The public API is designed for organizers, partners and white-label storefronts.

## Authentication

- API Keys: send `Authorization: Bearer ehk_...`.
- OAuth: use scoped clients created at `POST /api/enterprise/api/clients`.
- Scopes: `events:read`, `orders:read`, `checkins:write`, `analytics:write`, `crm:write`.

## Core endpoints

- `GET /api/events/public`
- `GET /api/events/public/:slug`
- `POST /api/enterprise/analytics/track`
- `POST /api/enterprise/mobile/checkin-sync`
- `POST /api/enterprise/api/keys`
- `POST /api/enterprise/api/clients`

## SDK

```ts
import { EventFlowClient } from "@eventflow/sdk";

const eventflow = new EventFlowClient({
  baseUrl: "https://api.seudominio.com/api",
  apiKey: "ehk_..."
});

const events = await eventflow.listEvents({ category: "shows" });
await eventflow.track({ type: "page_view", source: "meta", campaign: "lote-2" });
```
