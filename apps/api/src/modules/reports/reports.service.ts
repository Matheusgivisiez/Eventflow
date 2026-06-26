import { Injectable } from "@nestjs/common";
import { CheckInStatus, PaymentStatus, Prisma } from "@prisma/client";
import { CacheService } from "../cache/cache.service";
import { PrismaReadService } from "../../prisma/prisma-read.service";
import { PrismaService } from "../../prisma/prisma.service";

type ReportQuery = {
  from?: string;
  to?: string;
  eventId?: string;
};

type ReportSummary = {
  revenueCents: number;
  discountsCents: number;
  feesCents: number;
  paidOrders: number;
  ticketsSold: number;
  checkIns: number;
  conversionRate: number;
  revenueByPeriod: { period: string; totalCents: number }[];
  participants: any[];
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaRead: PrismaReadService,
    private readonly cache: CacheService
  ) {}

  async summary(tenantId: string, query: ReportQuery): Promise<ReportSummary> {
    const cacheKey = `reports:summary:${tenantId}:${JSON.stringify(query)}`;
    const cached = await this.cache.get<ReportSummary>(cacheKey);
    if (cached) return cached;

    const dateFilter = this.dateFilter(query);
    const eventFilter = { tenantId, id: query.eventId || undefined };
    const [orders, checkIns, tickets, participants] = await Promise.all([
      this.prismaRead.order.findMany({
        where: { event: eventFilter, status: PaymentStatus.PAID, createdAt: dateFilter },
        select: { id: true, createdAt: true, subtotalCents: true, discountCents: true, feeCents: true, totalCents: true }
      }),
      this.prismaRead.checkInLog.count({
        where: { status: CheckInStatus.ENTERED, ticket: { event: eventFilter }, createdAt: dateFilter }
      }),
      this.prismaRead.ticket.count({ where: { event: eventFilter, createdAt: dateFilter } }),
      this.prismaRead.ticket.findMany({
        where: { event: eventFilter, createdAt: dateFilter },
        include: { event: { select: { title: true } }, ticketType: { select: { name: true, priceCents: true } }, order: true }
      })
    ]);

    const revenueByPeriod = orders.reduce<Record<string, number>>((acc, order) => {
      const key = order.createdAt.toISOString().slice(0, 10);
      acc[key] = (acc[key] ?? 0) + order.totalCents;
      return acc;
    }, {});
    const visitorsEstimate = orders.length + Math.max(25, Math.round(orders.length * 1.8));
    const report = {
      revenueCents: orders.reduce((sum, order) => sum + order.totalCents, 0),
      discountsCents: orders.reduce((sum, order) => sum + order.discountCents, 0),
      feesCents: orders.reduce((sum, order) => sum + order.feeCents, 0),
      paidOrders: orders.length,
      ticketsSold: tickets,
      checkIns,
      conversionRate: visitorsEstimate ? Math.round((orders.length / visitorsEstimate) * 100) : 0,
      revenueByPeriod: Object.entries(revenueByPeriod).map(([period, totalCents]) => ({ period, totalCents })),
      participants
    };

    await this.cache.set(cacheKey, report, 45);
    return report;
  }

  async export(tenantId: string, query: ReportQuery & { format?: "csv" | "excel" | "pdf"; type?: "sales" | "participants" }) {
    const report = await this.summary(tenantId, query);
    const rows =
      query.type === "participants"
        ? report.participants.map((ticket: any) => ({
            participante: ticket.attendeeName,
            email: ticket.attendeeEmail,
            evento: ticket.event.title,
            lote: ticket.ticketType.name,
            status: ticket.status,
            pedido: ticket.order.id
          }))
        : report.revenueByPeriod.map((item: any) => ({
            periodo: item.period,
            receita: item.totalCents,
            pedidosPagos: report.paidOrders,
            checkIns: report.checkIns,
            conversao: `${report.conversionRate}%`
          }));

    const format = query.format ?? "csv";
    if (format === "pdf") {
      return {
        fileName: `eventhub-${query.type ?? "sales"}.pdf`,
        contentType: "application/pdf",
        buffer: this.toPdf(rows)
      };
    }
    if (format === "excel") {
      return {
        fileName: `eventhub-${query.type ?? "sales"}.xls`,
        contentType: "application/vnd.ms-excel",
        buffer: Buffer.from(this.toExcelXml(rows), "utf8")
      };
    }
    return {
      fileName: `eventhub-${query.type ?? "sales"}.csv`,
      contentType: "text/csv; charset=utf-8",
      buffer: Buffer.from(this.toCsv(rows), "utf8")
    };
  }

  private dateFilter(query: ReportQuery): Prisma.DateTimeFilter | undefined {
    if (!query.from && !query.to) return undefined;
    return {
      gte: query.from ? new Date(query.from) : undefined,
      lte: query.to ? new Date(query.to) : undefined
    };
  }

  private toCsv(rows: Record<string, unknown>[]) {
    if (!rows.length) return "";
    const headers = Object.keys(rows[0]);
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
  }

  private toExcelXml(rows: Record<string, unknown>[]) {
    const headers = rows[0] ? Object.keys(rows[0]) : ["sem_dados"];
    const rowXml = [headers, ...rows.map((row) => headers.map((header) => row[header]))]
      .map((row) => `<Row>${row.map((cell) => `<Cell><Data ss:Type="String">${this.xml(String(cell ?? ""))}</Data></Cell>`).join("")}</Row>`)
      .join("");
    return `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Relatorio"><Table>${rowXml}</Table></Worksheet></Workbook>`;
  }

  private toPdf(rows: Record<string, unknown>[]) {
    const text = this.toCsv(rows).replace(/[()\\]/g, "");
    const stream = `BT /F1 10 Tf 40 780 Td (${text.slice(0, 3500).replace(/\n/g, ") Tj 0 -14 Td (")}) Tj ET`;
    const objects = [
      "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
      "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
      "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
      "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
      `5 0 obj << /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream endobj`
    ];
    const body = objects.join("\n");
    return Buffer.from(`%PDF-1.4\n${body}\ntrailer << /Root 1 0 R >>\n%%EOF`, "utf8");
  }

  private xml(value: string) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}
