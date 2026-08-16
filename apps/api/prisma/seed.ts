import { PrismaClient, EventFormat, EventStatus, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("EventFlow@123", 12);

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
    update: {},
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
      startsAt: new Date("2026-09-12T18:00:00.000Z"),
      endsAt: new Date("2026-09-12T23:00:00.000Z"),
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
    update: {},
    create: {
      id: "seed-ticket-early",
      eventId: event.id,
      name: "Primeiro lote",
      description: "Entrada inteira com preco promocional.",
      quantity: 250,
      sold: 37,
      priceCents: 7900,
      startsAt: new Date("2026-06-01T00:00:00.000Z"),
      endsAt: new Date("2026-08-20T23:59:59.000Z"),
      limitPerBuy: 5
    }
  });

  await prisma.ticketType.upsert({
    where: { id: "seed-ticket-vip" },
    update: {},
    create: {
      id: "seed-ticket-vip",
      eventId: event.id,
      name: "VIP",
      description: "Acesso antecipado e area reservada.",
      quantity: 80,
      sold: 12,
      priceCents: 15900,
      startsAt: new Date("2026-06-01T00:00:00.000Z"),
      endsAt: new Date("2026-09-01T23:59:59.000Z"),
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
