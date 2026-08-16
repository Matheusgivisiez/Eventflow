import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CheckInStatus, TicketStatus } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../../../prisma/prisma.service";
import { RequestUser } from "../../../common/types/request-user";
import { AnyRecord, EnterpriseDomainService } from "./enterprise-domain.service";

@Injectable()
export class EnterpriseMobileService extends EnterpriseDomainService {
  constructor(prisma: PrismaService) {
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

    const db = this.db();
    return this.prisma.$transaction(async (tx) => {
      const entries: AnyRecord[] = [];
      let acceptedScans = 0;
      let rejectedScans = 0;
      let conflictScans = 0;

      for (const scan of scans) {
        const ticketUuid = this.requiredString(scan.ticketUuid ?? scan.uuid ?? scan.code, "ticketUuid");
        const ticket = await tx.ticket.findFirst({ where: { uuid: ticketUuid, eventId, event: { tenantId } } });
        let status: CheckInStatus = CheckInStatus.REFUSED;
        let reason = "Ingresso nao encontrado.";

        if (ticket?.status === TicketStatus.AVAILABLE) {
          status = CheckInStatus.ENTERED;
          reason = undefined as unknown as string;
          acceptedScans += 1;
          await tx.ticket.update({
            where: { id: ticket.id },
            data: {
              status: TicketStatus.USED,
              usedAt: scan.scannedAt ? new Date(String(scan.scannedAt)) : new Date(),
              checkIns: { create: { userId: user.id, status: CheckInStatus.ENTERED } }
            }
          });
        } else if (ticket?.status === TicketStatus.USED) {
          status = CheckInStatus.DUPLICATED;
          reason = "Ingresso ja utilizado antes da sincronizacao.";
          conflictScans += 1;
          await tx.checkInLog.create({ data: { ticketId: ticket.id, userId: user.id, status, reason } });
        } else {
          rejectedScans += 1;
          if (ticket) await tx.checkInLog.create({ data: { ticketId: ticket.id, userId: user.id, status, reason: "Ingresso indisponivel." } });
        }

        entries.push({
          ticketUuid,
          scannedAt: scan.scannedAt ? new Date(String(scan.scannedAt)) : new Date(),
          status,
          reason,
          rawPayload: scan
        });
      }

      return db.offlineCheckinBatch.create({
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
    });
  }
}
