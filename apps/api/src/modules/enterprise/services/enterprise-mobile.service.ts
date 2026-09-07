import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CheckInStatus } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../../../prisma/prisma.service";
import { RequestUser } from "../../../common/types/request-user";
import { AnyRecord, EnterpriseDomainService } from "./enterprise-domain.service";
import { ValidateTicketUseCase } from "../../checkin/use-cases/validate-ticket.use-case";

@Injectable()
export class EnterpriseMobileService extends EnterpriseDomainService {
  constructor(prisma: PrismaService, private readonly validateTicket: ValidateTicketUseCase) {
    super(prisma);
  }

  registerMobileDevice(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    return this.db().mobileDevice.upsert({
      where: { id: this.string(body.id) ?? randomUUID() },
      create: {
        id: this.string(body.id) ?? undefined,
        tenantId,
        userId: user.id,
        platform: this.string(body.platform) ?? "unknown",
        deviceName: this.string(body.deviceName),
        appVersion: this.string(body.appVersion),
        publicKey: this.string(body.publicKey),
        isTrusted: Boolean(body.isTrusted)
      },
      update: {
        platform: this.string(body.platform) ?? "unknown",
        deviceName: this.string(body.deviceName),
        appVersion: this.string(body.appVersion),
        publicKey: this.string(body.publicKey),
        lastSyncAt: new Date()
      }
    });
  }

  async syncOfflineCheckins(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    const eventId = this.requiredString(body.eventId, "eventId");
    const scans = Array.isArray(body.scans) ? body.scans : [];
    if (!scans.length) throw new BadRequestException("Envie ao menos um scan offline.");

    const event = await this.prisma.event.findFirst({ where: { id: eventId, tenantId } });
    if (!event) throw new NotFoundException("Evento nao encontrado.");

    const entries: AnyRecord[] = [];
    let acceptedScans = 0;
    let rejectedScans = 0;
    let conflictScans = 0;

    for (const scan of scans) {
      const ticketUuid = this.requiredString(scan.ticketUuid ?? scan.uuid ?? scan.code, "ticketUuid");
      const rawPayload = this.requiredString(scan.rawPayload ?? scan.code, "rawPayload");
      let status: CheckInStatus = CheckInStatus.REFUSED;
      let reason: string | undefined = "Ingresso nao encontrado.";

      try {
        const result = await this.validateTicket.execute(eventId, tenantId, user.id, rawPayload, { requireSignedPayload: true });
        status = result.status;
        reason = result.status === CheckInStatus.ENTERED ? undefined : result.message;
      } catch (error) {
        reason = error instanceof Error ? error.message : "Falha ao validar ingresso.";
      }

      if (status === CheckInStatus.ENTERED) acceptedScans += 1;
      else if (status === CheckInStatus.DUPLICATED) conflictScans += 1;
      else rejectedScans += 1;

      entries.push({
        ticketUuid,
        scannedAt: scan.scannedAt ? new Date(String(scan.scannedAt)) : new Date(),
        status,
        reason,
        rawPayload: scan
      });
    }

    return this.db().offlineCheckinBatch.create({
        data: {
          tenantId,
          eventId,
          deviceId: this.string(body.deviceId),
          userId: user.id,
          startedAt: body.startedAt ? new Date(String(body.startedAt)) : undefined,
          finishedAt: body.finishedAt ? new Date(String(body.finishedAt)) : undefined,
          totalScans: scans.length,
          acceptedScans,
          rejectedScans,
          conflictScans,
          checksum: this.hash(JSON.stringify(scans)),
          entries: { create: entries }
        },
        include: { entries: true }
    });
  }
}
