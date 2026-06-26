-- Enterprise enums
ALTER TYPE "TeamPermission" ADD VALUE IF NOT EXISTS 'MANAGE_WHITE_LABEL';
ALTER TYPE "TeamPermission" ADD VALUE IF NOT EXISTS 'MANAGE_AFFILIATES';
ALTER TYPE "TeamPermission" ADD VALUE IF NOT EXISTS 'MANAGE_CRM';
ALTER TYPE "TeamPermission" ADD VALUE IF NOT EXISTS 'MANAGE_MARKETING';
ALTER TYPE "TeamPermission" ADD VALUE IF NOT EXISTS 'VIEW_ANALYTICS';
ALTER TYPE "TeamPermission" ADD VALUE IF NOT EXISTS 'MANAGE_PUBLIC_API';
ALTER TYPE "TeamPermission" ADD VALUE IF NOT EXISTS 'MANAGE_SEAT_MAPS';
ALTER TYPE "TeamPermission" ADD VALUE IF NOT EXISTS 'MANAGE_SECURITY';

CREATE TYPE "CampaignChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'PUSH', 'SMS');
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED');
CREATE TYPE "AffiliateCommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAYABLE', 'PAID', 'CANCELED');
CREATE TYPE "SeatStatus" AS ENUM ('AVAILABLE', 'HELD', 'RESERVED', 'SOLD', 'BLOCKED');
CREATE TYPE "ApiCredentialStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE "MarketplaceVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "FraudRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "AutomationTrigger" AS ENUM ('PURCHASE_CONFIRMED', 'ABANDONED_CART', 'EVENT_DATE', 'CUSTOMER_SEGMENT', 'LOW_SALES');
CREATE TYPE "IntegrationProvider" AS ENUM ('GOOGLE_ANALYTICS', 'META_PIXEL', 'WEBHOOK', 'AWS_S3', 'CLOUDFRONT', 'PROMETHEUS', 'GRAFANA', 'RABBITMQ');

-- Existing table expansion
ALTER TABLE "Tenant" ADD COLUMN "planMRRCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Tenant" ADD COLUMN "churnRisk" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN "isSponsored" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN "marketplaceRank" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Event" ADD COLUMN "analyticsJson" JSONB;
ALTER TABLE "Event" ADD COLUMN "seatMapEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "affiliateLinkId" TEXT;
ALTER TABLE "Order" ADD COLUMN "source" TEXT;
ALTER TABLE "Order" ADD COLUMN "device" TEXT;
ALTER TABLE "Order" ADD COLUMN "campaign" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "seatId" TEXT;

CREATE INDEX "Event_category_status_idx" ON "Event"("category", "status");
CREATE INDEX "Order_affiliateLinkId_idx" ON "Order"("affiliateLinkId");
CREATE INDEX "Ticket_seatId_idx" ON "Ticket"("seatId");

-- White label and mobile
CREATE TABLE "WhiteLabelSetting" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "customDomain" TEXT,
  "domainVerifiedAt" TIMESTAMP(3),
  "logoUrl" TEXT,
  "faviconUrl" TEXT,
  "primaryColor" TEXT NOT NULL DEFAULT '#111827',
  "secondaryColor" TEXT NOT NULL DEFAULT '#2563eb',
  "themeJson" JSONB,
  "senderName" TEXT,
  "senderEmail" TEXT,
  "emailTemplateJson" JSONB,
  "dnsInstructions" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WhiteLabelSetting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WhiteLabelSetting_tenantId_key" ON "WhiteLabelSetting"("tenantId");
CREATE UNIQUE INDEX "WhiteLabelSetting_customDomain_key" ON "WhiteLabelSetting"("customDomain");

CREATE TABLE "MobileDevice" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "deviceName" TEXT,
  "appVersion" TEXT,
  "lastSyncAt" TIMESTAMP(3),
  "publicKey" TEXT,
  "isTrusted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MobileDevice_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MobileDevice_tenantId_userId_idx" ON "MobileDevice"("tenantId", "userId");

CREATE TABLE "OfflineCheckinBatch" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "deviceId" TEXT,
  "userId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "totalScans" INTEGER NOT NULL DEFAULT 0,
  "acceptedScans" INTEGER NOT NULL DEFAULT 0,
  "rejectedScans" INTEGER NOT NULL DEFAULT 0,
  "conflictScans" INTEGER NOT NULL DEFAULT 0,
  "checksum" TEXT,
  CONSTRAINT "OfflineCheckinBatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OfflineCheckinBatch_tenantId_eventId_syncedAt_idx" ON "OfflineCheckinBatch"("tenantId", "eventId", "syncedAt");

CREATE TABLE "OfflineCheckinEntry" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "ticketUuid" TEXT NOT NULL,
  "scannedAt" TIMESTAMP(3) NOT NULL,
  "status" "CheckInStatus" NOT NULL,
  "reason" TEXT,
  "rawPayload" JSONB,
  CONSTRAINT "OfflineCheckinEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OfflineCheckinEntry_ticketUuid_idx" ON "OfflineCheckinEntry"("ticketUuid");
ALTER TABLE "OfflineCheckinEntry" ADD CONSTRAINT "OfflineCheckinEntry_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "OfflineCheckinBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Affiliates, CRM and marketing
CREATE TABLE "AffiliateProgram" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "name" TEXT NOT NULL, "defaultCommissionBps" INTEGER NOT NULL DEFAULT 1000, "cookieWindowDays" INTEGER NOT NULL DEFAULT 30, "minPayoutCents" INTEGER NOT NULL DEFAULT 5000, "isActive" BOOLEAN NOT NULL DEFAULT true, "termsUrl" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AffiliateProgram_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "AffiliateProgram_tenantId_key" ON "AffiliateProgram"("tenantId");
CREATE INDEX "AffiliateProgram_tenantId_isActive_idx" ON "AffiliateProgram"("tenantId", "isActive");

CREATE TABLE "AffiliateLink" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "eventId" TEXT, "affiliateName" TEXT NOT NULL, "affiliateEmail" TEXT, "code" TEXT NOT NULL, "commissionBps" INTEGER NOT NULL, "clicks" INTEGER NOT NULL DEFAULT 0, "conversions" INTEGER NOT NULL DEFAULT 0, "revenueCents" INTEGER NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AffiliateLink_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "AffiliateLink_code_key" ON "AffiliateLink"("code");
CREATE INDEX "AffiliateLink_tenantId_eventId_idx" ON "AffiliateLink"("tenantId", "eventId");
CREATE INDEX "AffiliateLink_code_isActive_idx" ON "AffiliateLink"("code", "isActive");

CREATE TABLE "AffiliateCommission" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "affiliateLinkId" TEXT NOT NULL, "orderId" TEXT, "amountCents" INTEGER NOT NULL, "status" "AffiliateCommissionStatus" NOT NULL DEFAULT 'PENDING', "payableAt" TIMESTAMP(3), "paidAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AffiliateCommission_pkey" PRIMARY KEY ("id"));
CREATE INDEX "AffiliateCommission_tenantId_status_idx" ON "AffiliateCommission"("tenantId", "status");
CREATE INDEX "AffiliateCommission_affiliateLinkId_idx" ON "AffiliateCommission"("affiliateLinkId");

CREATE TABLE "AffiliatePayout" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "affiliateEmail" TEXT NOT NULL, "amountCents" INTEGER NOT NULL, "status" "AffiliateCommissionStatus" NOT NULL DEFAULT 'PAYABLE', "providerRef" TEXT, "paidAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AffiliatePayout_pkey" PRIMARY KEY ("id"));
CREATE INDEX "AffiliatePayout_tenantId_status_idx" ON "AffiliatePayout"("tenantId", "status");

CREATE TABLE "CrmCustomer" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "email" TEXT NOT NULL, "name" TEXT NOT NULL, "document" TEXT, "phone" TEXT, "lifetimeValueCents" INTEGER NOT NULL DEFAULT 0, "ordersCount" INTEGER NOT NULL DEFAULT 0, "tags" TEXT[] DEFAULT ARRAY[]::TEXT[], "consentEmail" BOOLEAN NOT NULL DEFAULT false, "consentWhatsApp" BOOLEAN NOT NULL DEFAULT false, "consentPush" BOOLEAN NOT NULL DEFAULT false, "lastPurchaseAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "CrmCustomer_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "CrmCustomer_tenantId_email_key" ON "CrmCustomer"("tenantId", "email");
CREATE INDEX "CrmCustomer_tenantId_lastPurchaseAt_idx" ON "CrmCustomer"("tenantId", "lastPurchaseAt");

CREATE TABLE "CrmSegment" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "name" TEXT NOT NULL, "rulesJson" JSONB NOT NULL, "size" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "CrmSegment_pkey" PRIMARY KEY ("id"));
CREATE INDEX "CrmSegment_tenantId_name_idx" ON "CrmSegment"("tenantId", "name");

CREATE TABLE "CrmCampaign" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "segmentId" TEXT, "name" TEXT NOT NULL, "channel" "CampaignChannel" NOT NULL, "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT', "subject" TEXT, "content" TEXT NOT NULL, "scheduledAt" TIMESTAMP(3), "sentAt" TIMESTAMP(3), "metricsJson" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "CrmCampaign_pkey" PRIMARY KEY ("id"));
CREATE INDEX "CrmCampaign_tenantId_status_idx" ON "CrmCampaign"("tenantId", "status");

CREATE TABLE "CrmAutomation" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "name" TEXT NOT NULL, "trigger" "AutomationTrigger" NOT NULL, "channel" "CampaignChannel" NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT true, "rulesJson" JSONB NOT NULL, "stepsJson" JSONB NOT NULL, "lastRunAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "CrmAutomation_pkey" PRIMARY KEY ("id"));
CREATE INDEX "CrmAutomation_tenantId_isActive_idx" ON "CrmAutomation"("tenantId", "isActive");

CREATE TABLE "CustomerTimelineEvent" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "customerId" TEXT NOT NULL, "type" TEXT NOT NULL, "description" TEXT NOT NULL, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "CustomerTimelineEvent_pkey" PRIMARY KEY ("id"));
CREATE INDEX "CustomerTimelineEvent_tenantId_customerId_createdAt_idx" ON "CustomerTimelineEvent"("tenantId", "customerId", "createdAt");

CREATE TABLE "MarketingMessage" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "campaignId" TEXT, "channel" "CampaignChannel" NOT NULL, "recipient" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'queued', "providerRef" TEXT, "payload" JSONB NOT NULL, "sentAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "MarketingMessage_pkey" PRIMARY KEY ("id"));
CREATE INDEX "MarketingMessage_tenantId_channel_status_idx" ON "MarketingMessage"("tenantId", "channel", "status");

-- Analytics and public API
CREATE TABLE "AnalyticsEvent" ("id" TEXT NOT NULL, "tenantId" TEXT, "eventId" TEXT, "sessionId" TEXT, "type" TEXT NOT NULL, "source" TEXT, "medium" TEXT, "campaign" TEXT, "device" TEXT, "path" TEXT, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id"));
CREATE INDEX "AnalyticsEvent_tenantId_eventId_type_idx" ON "AnalyticsEvent"("tenantId", "eventId", "type");
CREATE INDEX "AnalyticsEvent_sessionId_createdAt_idx" ON "AnalyticsEvent"("sessionId", "createdAt");

CREATE TABLE "AnalyticsIntegration" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "provider" "IntegrationProvider" NOT NULL, "externalId" TEXT NOT NULL, "configJson" JSONB, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AnalyticsIntegration_pkey" PRIMARY KEY ("id"));
CREATE INDEX "AnalyticsIntegration_tenantId_provider_isActive_idx" ON "AnalyticsIntegration"("tenantId", "provider", "isActive");

CREATE TABLE "HeatmapSnapshot" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "eventId" TEXT, "page" TEXT NOT NULL, "pointsJson" JSONB NOT NULL, "sampleSize" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "HeatmapSnapshot_pkey" PRIMARY KEY ("id"));
CREATE INDEX "HeatmapSnapshot_tenantId_eventId_createdAt_idx" ON "HeatmapSnapshot"("tenantId", "eventId", "createdAt");

CREATE TABLE "ConversionFunnel" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "eventId" TEXT, "name" TEXT NOT NULL, "stepsJson" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ConversionFunnel_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ConversionFunnel_tenantId_eventId_idx" ON "ConversionFunnel"("tenantId", "eventId");

CREATE TABLE "PublicApiClient" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "name" TEXT NOT NULL, "clientId" TEXT NOT NULL, "clientSecretHash" TEXT, "redirectUris" TEXT[] DEFAULT ARRAY[]::TEXT[], "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[], "status" "ApiCredentialStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "PublicApiClient_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "PublicApiClient_clientId_key" ON "PublicApiClient"("clientId");
CREATE INDEX "PublicApiClient_tenantId_status_idx" ON "PublicApiClient"("tenantId", "status");

CREATE TABLE "ApiKey" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "name" TEXT NOT NULL, "keyHash" TEXT NOT NULL, "prefix" TEXT NOT NULL, "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[], "status" "ApiCredentialStatus" NOT NULL DEFAULT 'ACTIVE', "lastUsedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
CREATE INDEX "ApiKey_tenantId_status_idx" ON "ApiKey"("tenantId", "status");

CREATE TABLE "OAuthAuthorizationCode" ("id" TEXT NOT NULL, "clientId" TEXT NOT NULL, "userId" TEXT NOT NULL, "codeHash" TEXT NOT NULL, "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[], "redirectUri" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "usedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "OAuthAuthorizationCode_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "OAuthAuthorizationCode_codeHash_key" ON "OAuthAuthorizationCode"("codeHash");

CREATE TABLE "OAuthAccessToken" ("id" TEXT NOT NULL, "clientId" TEXT NOT NULL, "userId" TEXT, "tokenHash" TEXT NOT NULL, "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[], "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "OAuthAccessToken_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "OAuthAccessToken_tokenHash_key" ON "OAuthAccessToken"("tokenHash");

CREATE TABLE "SdkRelease" ("id" TEXT NOT NULL, "language" TEXT NOT NULL, "version" TEXT NOT NULL, "packageName" TEXT NOT NULL, "docsUrl" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "SdkRelease_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "SdkRelease_language_version_key" ON "SdkRelease"("language", "version");

-- Seat maps and marketplace
CREATE TABLE "SeatMap" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "eventId" TEXT NOT NULL, "name" TEXT NOT NULL, "layoutJson" JSONB NOT NULL, "version" INTEGER NOT NULL DEFAULT 1, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "SeatMap_pkey" PRIMARY KEY ("id"));
CREATE INDEX "SeatMap_tenantId_eventId_isActive_idx" ON "SeatMap"("tenantId", "eventId", "isActive");
CREATE TABLE "SeatSection" ("id" TEXT NOT NULL, "seatMapId" TEXT NOT NULL, "name" TEXT NOT NULL, "color" TEXT, "priceCents" INTEGER, "metadata" JSONB, CONSTRAINT "SeatSection_pkey" PRIMARY KEY ("id"));
CREATE INDEX "SeatSection_seatMapId_idx" ON "SeatSection"("seatMapId");
CREATE TABLE "Seat" ("id" TEXT NOT NULL, "seatMapId" TEXT NOT NULL, "sectionId" TEXT, "label" TEXT NOT NULL, "row" TEXT, "number" TEXT, "x" DOUBLE PRECISION NOT NULL DEFAULT 0, "y" DOUBLE PRECISION NOT NULL DEFAULT 0, "status" "SeatStatus" NOT NULL DEFAULT 'AVAILABLE', "metadata" JSONB, CONSTRAINT "Seat_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "Seat_seatMapId_label_key" ON "Seat"("seatMapId", "label");
CREATE INDEX "Seat_seatMapId_status_idx" ON "Seat"("seatMapId", "status");
CREATE TABLE "SeatHold" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "eventId" TEXT NOT NULL, "seatId" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "SeatHold_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "SeatHold_seatId_sessionId_key" ON "SeatHold"("seatId", "sessionId");
CREATE INDEX "SeatHold_tenantId_eventId_expiresAt_idx" ON "SeatHold"("tenantId", "eventId", "expiresAt");
CREATE TABLE "SeatReservation" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "eventId" TEXT NOT NULL, "seatId" TEXT NOT NULL, "orderId" TEXT, "status" "SeatStatus" NOT NULL DEFAULT 'RESERVED', "expiresAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "SeatReservation_pkey" PRIMARY KEY ("id"));
CREATE INDEX "SeatReservation_tenantId_eventId_status_idx" ON "SeatReservation"("tenantId", "eventId", "status");
CREATE INDEX "SeatReservation_seatId_idx" ON "SeatReservation"("seatId");

CREATE TABLE "MarketplaceProfile" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "displayName" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT, "logoUrl" TEXT, "verification" "MarketplaceVerificationStatus" NOT NULL DEFAULT 'PENDING', "ratingAverage" DOUBLE PRECISION NOT NULL DEFAULT 0, "ratingCount" INTEGER NOT NULL DEFAULT 0, "categories" TEXT[] DEFAULT ARRAY[]::TEXT[], "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "MarketplaceProfile_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "MarketplaceProfile_tenantId_key" ON "MarketplaceProfile"("tenantId");
CREATE UNIQUE INDEX "MarketplaceProfile_slug_key" ON "MarketplaceProfile"("slug");
CREATE TABLE "EventSponsorship" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "eventId" TEXT NOT NULL, "startsAt" TIMESTAMP(3) NOT NULL, "endsAt" TIMESTAMP(3) NOT NULL, "budgetCents" INTEGER NOT NULL, "impressions" INTEGER NOT NULL DEFAULT 0, "clicks" INTEGER NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "EventSponsorship_pkey" PRIMARY KEY ("id"));
CREATE INDEX "EventSponsorship_tenantId_eventId_isActive_idx" ON "EventSponsorship"("tenantId", "eventId", "isActive");
CREATE TABLE "FavoriteEvent" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "eventId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "FavoriteEvent_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "FavoriteEvent_userId_eventId_key" ON "FavoriteEvent"("userId", "eventId");
CREATE TABLE "EventReview" ("id" TEXT NOT NULL, "eventId" TEXT NOT NULL, "userId" TEXT, "rating" INTEGER NOT NULL, "comment" TEXT, "isPublic" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "EventReview_pkey" PRIMARY KEY ("id"));
CREATE INDEX "EventReview_eventId_isPublic_idx" ON "EventReview"("eventId", "isPublic");
CREATE TABLE "EventCategory" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "icon" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "EventCategory_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "EventCategory_slug_key" ON "EventCategory"("slug");

-- AI, executive, security and operations
CREATE TABLE "AiForecast" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "eventId" TEXT, "type" TEXT NOT NULL, "horizonDays" INTEGER NOT NULL DEFAULT 30, "inputJson" JSONB NOT NULL, "outputJson" JSONB NOT NULL, "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AiForecast_pkey" PRIMARY KEY ("id"));
CREATE INDEX "AiForecast_tenantId_eventId_type_idx" ON "AiForecast"("tenantId", "eventId", "type");
CREATE TABLE "AiInsight" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "eventId" TEXT, "title" TEXT NOT NULL, "summary" TEXT NOT NULL, "severity" TEXT NOT NULL DEFAULT 'info', "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AiInsight_pkey" PRIMARY KEY ("id"));
CREATE INDEX "AiInsight_tenantId_eventId_createdAt_idx" ON "AiInsight"("tenantId", "eventId", "createdAt");
CREATE TABLE "FraudSignal" ("id" TEXT NOT NULL, "tenantId" TEXT, "orderId" TEXT, "userId" TEXT, "riskLevel" "FraudRiskLevel" NOT NULL DEFAULT 'LOW', "score" INTEGER NOT NULL DEFAULT 0, "reasons" TEXT[] DEFAULT ARRAY[]::TEXT[], "metadata" JSONB, "reviewedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "FraudSignal_pkey" PRIMARY KEY ("id"));
CREATE INDEX "FraudSignal_tenantId_riskLevel_idx" ON "FraudSignal"("tenantId", "riskLevel");
CREATE INDEX "FraudSignal_orderId_idx" ON "FraudSignal"("orderId");
CREATE TABLE "ExecutiveMetricSnapshot" ("id" TEXT NOT NULL, "tenantId" TEXT, "period" TEXT NOT NULL, "mrrCents" INTEGER NOT NULL DEFAULT 0, "arrCents" INTEGER NOT NULL DEFAULT 0, "ltvCents" INTEGER NOT NULL DEFAULT 0, "cacCents" INTEGER NOT NULL DEFAULT 0, "churnRateBps" INTEGER NOT NULL DEFAULT 0, "revenueCents" INTEGER NOT NULL DEFAULT 0, "profitCents" INTEGER NOT NULL DEFAULT 0, "organizersCount" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ExecutiveMetricSnapshot_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ExecutiveMetricSnapshot_tenantId_period_idx" ON "ExecutiveMetricSnapshot"("tenantId", "period");
CREATE TABLE "TwoFactorSecret" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "secretHash" TEXT NOT NULL, "recoveryCodesHash" TEXT[] DEFAULT ARRAY[]::TEXT[], "enabledAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "TwoFactorSecret_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "TwoFactorSecret_userId_key" ON "TwoFactorSecret"("userId");
CREATE TABLE "ConsentRecord" ("id" TEXT NOT NULL, "tenantId" TEXT, "userId" TEXT, "email" TEXT, "purpose" TEXT NOT NULL, "granted" BOOLEAN NOT NULL, "ipAddress" TEXT, "userAgent" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ConsentRecord_tenantId_email_purpose_idx" ON "ConsentRecord"("tenantId", "email", "purpose");
CREATE TABLE "BackupJob" ("id" TEXT NOT NULL, "tenantId" TEXT, "scope" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'scheduled', "storageUrl" TEXT, "checksum" TEXT, "startedAt" TIMESTAMP(3), "finishedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "BackupJob_pkey" PRIMARY KEY ("id"));
CREATE INDEX "BackupJob_tenantId_status_idx" ON "BackupJob"("tenantId", "status");
CREATE TABLE "EncryptionKeyRecord" ("id" TEXT NOT NULL, "tenantId" TEXT, "alias" TEXT NOT NULL, "provider" TEXT NOT NULL DEFAULT 'aws-kms', "keyRef" TEXT NOT NULL, "rotatedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "EncryptionKeyRecord_pkey" PRIMARY KEY ("id"));
CREATE INDEX "EncryptionKeyRecord_tenantId_alias_idx" ON "EncryptionKeyRecord"("tenantId", "alias");
CREATE TABLE "PermissionPolicy" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "name" TEXT NOT NULL, "rulesJson" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "PermissionPolicy_pkey" PRIMARY KEY ("id"));
CREATE INDEX "PermissionPolicy_tenantId_name_idx" ON "PermissionPolicy"("tenantId", "name");
CREATE TABLE "DeploymentTarget" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "provider" TEXT NOT NULL, "region" TEXT NOT NULL, "configJson" JSONB NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "DeploymentTarget_pkey" PRIMARY KEY ("id"));
CREATE TABLE "ObservabilitySignal" ("id" TEXT NOT NULL, "service" TEXT NOT NULL, "level" TEXT NOT NULL, "message" TEXT NOT NULL, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ObservabilitySignal_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ObservabilitySignal_service_level_createdAt_idx" ON "ObservabilitySignal"("service", "level", "createdAt");
