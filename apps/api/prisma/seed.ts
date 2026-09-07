import { PrismaClient, EventFormat, EventStatus, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("EventFlow@123", 12);
  const now = new Date();
  const eventStartsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const eventEndsAt = new Date(eventStartsAt.getTime() + 5 * 60 * 60 * 1000);
  const salesStartsAt = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const salesEndsAt = new Date(eventStartsAt.getTime() - 60 * 60 * 1000);
  const checkInOpensAt = new Date(now.getTime() - 60 * 60 * 1000);

  const tenant = await prisma.tenant.upsert({
    where: { id: "seed-tenant-eventflow" },
    update: {},
    create: {
      id: "seed-tenant-eventflow",
      name: "Event Flow Demo",
      legalName: "Event Flow Demo LTDA",
      document: "00.000.000/0001-00",
      logoUrl: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622"
    }
  });

  await prisma.user.upsert({
    where: { email: "admin@eventflow.local" },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Admin Event Flow",
      email: "admin@eventflow.local",
      passwordHash,
      role: UserRole.ADMIN
    }
  });

  const organizer = await prisma.user.upsert({
    where: { email: "organizador@eventflow.local" },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Organizador Demo",
      email: "organizador@eventflow.local",
      passwordHash,
      role: UserRole.ORGANIZER
    }
  });

  const event = await prisma.event.upsert({
    where: { slug: "summit-eventflow-2026" },
    update: {
      startsAt: eventStartsAt,
      endsAt: eventEndsAt,
      checkInOpensAt,
      checkInClosesAt: eventEndsAt,
      qrCodeReleaseAt: checkInOpensAt,
      status: EventStatus.PUBLISHED
    },
    create: {
      tenantId: tenant.id,
      ownerId: organizer.id,
      title: "Summit Event Flow 2026",
      slug: "summit-eventflow-2026",
      description:
        "Um encontro para criadores, produtores e empresas que querem vender ingressos com controle financeiro e check-in profissional.",
      category: "Tecnologia",
      bannerUrl: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678",
      galleryUrls: [
        "https://images.unsplash.com/photo-1540575467063-178a50c2df87",
        "https://images.unsplash.com/photo-1511578314322-379afb476865"
      ],
      startsAt: eventStartsAt,
      endsAt: eventEndsAt,
      checkInOpensAt,
      checkInClosesAt: eventEndsAt,
      qrCodeReleaseAt: checkInOpensAt,
      city: "Sao Paulo",
      state: "SP",
      zipCode: "01310-100",
      address: "Avenida Paulista, 1000",
      mapUrl: "https://maps.google.com/?q=Avenida+Paulista+1000+Sao+Paulo",
      format: EventFormat.IN_PERSON,
      status: EventStatus.PUBLISHED,
      seoTitle: "Summit Event Flow 2026",
      seoDescription: "Evento demo de tecnologia com checkout e check-in por QR Code."
    }
  });

  await prisma.ticketType.upsert({
    where: { id: "seed-ticket-early" },
    update: {
      startsAt: salesStartsAt,
      endsAt: salesEndsAt,
      isActive: true
    },
    create: {
      id: "seed-ticket-early",
      eventId: event.id,
      name: "Primeiro lote",
      description: "Entrada inteira com preco promocional.",
      quantity: 250,
      sold: 37,
      priceCents: 7900,
      startsAt: salesStartsAt,
      endsAt: salesEndsAt,
      limitPerBuy: 5
    }
  });

  await prisma.ticketType.upsert({
    where: { id: "seed-ticket-vip" },
    update: {
      startsAt: salesStartsAt,
      endsAt: salesEndsAt,
      isActive: true
    },
    create: {
      id: "seed-ticket-vip",
      eventId: event.id,
      name: "VIP",
      description: "Acesso antecipado e area reservada.",
      quantity: 80,
      sold: 12,
      priceCents: 15900,
      startsAt: salesStartsAt,
      endsAt: salesEndsAt,
      limitPerBuy: 2
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
