import { Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "../../../prisma/prisma.service";
import { RequestUser } from "../../../common/types/request-user";
import { AnyRecord, EnterpriseDomainService } from "./enterprise-domain.service";

@Injectable()
export class EnterpriseSecurityService extends EnterpriseDomainService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async securityDashboard(user: RequestUser) {
    const tenantId = this.requireTenant(user);
    const db = this.db();
    const [policies, backups, consents, fraud, keys] = await Promise.all([
      db.permissionPolicy.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } }),
      db.backupJob.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 20 }),
      db.consentRecord.count({ where: { tenantId, granted: true } }),
      db.fraudSignal.count({ where: { tenantId, riskLevel: { in: ["HIGH", "CRITICAL"] } } }),
      db.encryptionKeyRecord.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } })
    ]);
    return {
      twoFactorRequired: true,
      lgpd: { consentRecords: consents, dataExport: true, deletionWorkflow: true, auditTrail: true },
      antiFraud: { highRiskSignals: fraud, rules: ["velocity", "duplicate_document", "chargeback_history", "device_fingerprint"] },
      policies,
      backups,
      encryptionKeys: keys
    };
  }

  async enableTwoFactor(user: RequestUser) {
    const secret = randomBytes(20).toString("hex");
    const record = await this.db().twoFactorSecret.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        secretHash: this.hash(secret),
        recoveryCodesHash: Array.from({ length: 8 }, () => this.hash(randomBytes(6).toString("hex"))),
        enabledAt: new Date()
      },
      update: { secretHash: this.hash(secret), enabledAt: new Date() }
    });
    await this.prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } as AnyRecord });
    return { ...record, provisioningSecret: secret };
  }

  scheduleBackup(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    return this.db().backupJob.create({
      data: {
        tenantId,
        scope: this.string(body.scope) ?? "tenant",
        status: "scheduled",
        storageUrl: this.string(body.storageUrl) ?? `s3://eventhub-backups/${tenantId}/${Date.now()}.dump`
      }
    });
  }
}
