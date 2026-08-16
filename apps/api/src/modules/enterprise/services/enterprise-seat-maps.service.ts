import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../../../prisma/prisma.service";
import { RequestUser } from "../../../common/types/request-user";
import { AnyRecord, EnterpriseDomainService } from "./enterprise-domain.service";

@Injectable()
export class EnterpriseSeatMapsService extends EnterpriseDomainService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  seatMaps(user: RequestUser, eventId: string) {
    const tenantId = this.requireTenant(user);
    return this.db().seatMap.findMany({ where: { tenantId, eventId }, orderBy: { version: "desc" } });
  }

  async createSeatMap(user: RequestUser, eventId: string, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    await this.ensureEvent(tenantId, eventId);
    const db = this.db();
    const seats = Array.isArray(body.seats) ? body.seats : [];
    const seatMap = await db.seatMap.create({
      data: {
        tenantId,
        eventId,
        name: this.string(body.name) ?? "Mapa principal",
        layoutJson: body.layoutJson ?? { sections: body.sections ?? [], seats },
        version: Number(body.version ?? 1),
        isActive: body.isActive !== false
      }
    });
    if (seats.length) {
      await db.seat.createMany({
        data: seats.map((seat: AnyRecord) => ({
          seatMapId: seatMap.id,
          sectionId: this.string(seat.sectionId),
          label: this.requiredString(seat.label, "seat.label"),
          row: this.string(seat.row),
          number: this.string(seat.number),
          x: Number(seat.x ?? 0),
          y: Number(seat.y ?? 0),
          status: this.string(seat.status) ?? "AVAILABLE",
          metadata: seat.metadata ?? {}
        })),
        skipDuplicates: true
      });
    }
    await this.prisma.event.update({ where: { id: eventId }, data: { seatMapEnabled: true } as AnyRecord });
    return seatMap;
  }

  async holdSeats(user: RequestUser, eventId: string, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    await this.ensureEvent(tenantId, eventId);
    const seatIds = this.stringArray(body.seatIds);
    const sessionId = this.string(body.sessionId) ?? randomUUID();
    const expiresAt = new Date(Date.now() + Number(body.ttlSeconds ?? 600) * 1000);
    const db = this.db();

    await db.seatHold.createMany({
      data: seatIds.map((seatId) => ({ tenantId, eventId, seatId, sessionId, expiresAt })),
      skipDuplicates: true
    });
    await db.seat.updateMany({ where: { id: { in: seatIds }, status: "AVAILABLE" }, data: { status: "HELD" } });
    return { sessionId, expiresAt, seatIds };
  }

  async reserveSeats(user: RequestUser, eventId: string, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    await this.ensureEvent(tenantId, eventId);
    const seatIds = this.stringArray(body.seatIds);
    const db = this.db();
    await db.seatReservation.createMany({
      data: seatIds.map((seatId) => ({
        tenantId,
        eventId,
        seatId,
        orderId: this.string(body.orderId),
        status: "RESERVED",
        expiresAt: body.expiresAt ? new Date(String(body.expiresAt)) : undefined
      })),
      skipDuplicates: true
    });
    await db.seat.updateMany({ where: { id: { in: seatIds } }, data: { status: "RESERVED" } });
    return { reserved: seatIds.length, seatIds };
  }
}
