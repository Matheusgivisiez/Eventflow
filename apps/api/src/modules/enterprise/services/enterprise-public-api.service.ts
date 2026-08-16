import { Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "../../../prisma/prisma.service";
import { RequestUser } from "../../../common/types/request-user";
import { AnyRecord, EnterpriseDomainService } from "./enterprise-domain.service";

@Injectable()
export class EnterprisePublicApiService extends EnterpriseDomainService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  createApiClient(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    const clientSecret = randomBytes(32).toString("hex");
    return this.db().publicApiClient
      .create({
        data: {
          tenantId,
          name: this.requiredString(body.name, "name"),
          clientId: `eh_${randomBytes(12).toString("hex")}`,
          clientSecretHash: this.hash(clientSecret),
          redirectUris: Array.isArray(body.redirectUris) ? body.redirectUris.map(String) : [],
          scopes: Array.isArray(body.scopes) ? body.scopes.map(String) : ["events:read", "orders:read"],
          status: "ACTIVE"
        }
      })
      .then((client: AnyRecord) => ({ ...client, clientSecret }));
  }

  createApiKey(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    const rawKey = `ehk_${randomBytes(24).toString("hex")}`;
    return this.db().apiKey
      .create({
        data: {
          tenantId,
          name: this.requiredString(body.name, "name"),
          keyHash: this.hash(rawKey),
          prefix: rawKey.slice(0, 10),
          scopes: Array.isArray(body.scopes) ? body.scopes.map(String) : ["events:read"],
          status: "ACTIVE",
          expiresAt: body.expiresAt ? new Date(String(body.expiresAt)) : undefined
        }
      })
      .then((apiKey: AnyRecord) => ({ ...apiKey, key: rawKey }));
  }

  publicApiDocs() {
    return {
      openapi: "/docs-json",
      baseUrl: "/api/public/v1",
      auth: {
        apiKey: "Authorization: Bearer ehk_...",
        oauth: "Authorization Code + Client Credentials with scoped clients"
      },
      sdk: [
        { language: "TypeScript", packageName: "@eventhub/sdk", status: "planned in packages/sdk" },
        { language: "React Native", packageName: "@eventhub/mobile-sdk", status: "planned in packages/sdk" }
      ],
      endpoints: [
        "GET /events",
        "GET /events/:id/orders",
        "POST /checkins/offline-sync",
        "POST /webhooks",
        "GET /analytics"
      ]
    };
  }
}
