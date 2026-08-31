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
  visitors: number;
  conversionRate: number;
  revenueByPeriod: { period: string; totalCents: number }[];
  participants: ReportParticipant[];
};

type ReportParticipant = {
  attendeeName: string | null;
  attendeeEmail: string | null;
  status: string;
  event: { title: string };
  ticketType: { name: string; priceCents: number };
  order: { id: string };
};

type ExportRow = Record<string, string | number | null>;

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
    const [orders, checkIns, tickets, participants, visitorSessions] = await Promise.all([
      this.prismaRead.order.findMany({
        where: { event: eventFilter, status: PaymentStatus.PAID, createdAt: dateFilter },
        select: { createdAt: true, discountCents: true, feeCents: true, totalCents: true }
      }),
      this.prismaRead.checkInLog.count({
        where: { status: CheckInStatus.ENTERED, ticket: { event: eventFilter }, createdAt: dateFilter }
      }),
      this.prismaRead.ticket.count({ where: { event: eventFilter, createdAt: dateFilter } }),
      this.prismaRead.ticket.findMany({
        where: { event: eventFilter, createdAt: dateFilter },
        include: { event: { select: { title: true } }, ticketType: { select: { name: true, priceCents: true } }, order: { select: { id: true } } },
        take: 5000
      }),
      this.prismaRead.analyticsEvent.findMany({
        where: { tenantId, eventId: query.eventId || undefined, type: "page_view", createdAt: dateFilter },
        select: { sessionId: true },
        distinct: ["sessionId"]
      })
    ]);

    let revenueCents = 0;
    let discountsCents = 0;
    let feesCents = 0;
    const revenueByPeriod = orders.reduce<Record<string, number>>((acc, order) => {
      const key = order.createdAt.toISOString().slice(0, 10);
      revenueCents += order.totalCents;
      discountsCents += order.discountCents;
      feesCents += order.feeCents;
      acc[key] = (acc[key] ?? 0) + order.totalCents;
      return acc;
    }, {});
    const visitors = visitorSessions.filter((visitor) => visitor.sessionId).length;
    const report = {
      revenueCents,
      discountsCents,
      feesCents,
      paidOrders: orders.length,
      ticketsSold: tickets,
      checkIns,
      visitors,
      conversionRate: visitors ? Math.round((orders.length / visitors) * 100) : 0,
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
        ? report.participants.map((ticket): ExportRow => ({
            participante: ticket.attendeeName,
            email: ticket.attendeeEmail,
            evento: ticket.event.title,
            lote: ticket.ticketType.name,
            status: ticket.status,
            pedido: ticket.order.id
          }))
        : report.revenueByPeriod.map((item): ExportRow => ({
            periodo: item.period,
            receita: item.totalCents,
            pedidosPagos: report.paidOrders,
            checkIns: report.checkIns,
            conversao: `${report.conversionRate}%`
          }));

    const format = query.format ?? "csv";
    if (format === "pdf") {
      return {
        fileName: `eventflow-${query.type ?? "sales"}.pdf`,
        contentType: "application/pdf",
        buffer: this.toPdf(rows)
      };
    }
    if (format === "excel") {
      return {
        fileName: `eventflow-${query.type ?? "sales"}.xls`,
        contentType: "application/vnd.ms-excel",
        buffer: Buffer.from(this.toExcelXml(rows), "utf8")
      };
    }
    return {
      fileName: `eventflow-${query.type ?? "sales"}.csv`,
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
    const headers = rows[0] ? Object.keys(rows[0]) : ["sem_dados"];
    const values = rows.length ? rows.map((row) => headers.map((header) => String(row[header] ?? ""))) : [["Nenhum dado encontrado"]];
    const lines = [headers, ...values].map((row) => row.join(" | ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 115));
    const pageSize = 48;
    const pages: string[] = [];
    for (let offset = 0; offset < lines.length || offset === 0; offset += pageSize) {
      const pageLines = lines.slice(offset, offset + pageSize);
      pages.push(["BT", "/F1 9 Tf", "40 800 Td", ...pageLines.map((line) => `(${this.pdfEscape(line)}) Tj 0 -15 Td`), "ET"].join(" "));
    }
    const pageObjects = pages.map((_, index) => `${3 + index} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${3 + pages.length} 0 R >> >> /Contents ${4 + pages.length + index} 0 R >> endobj`);
    const contentObjects = pages.map((stream, index) => `${4 + pages.length + index} 0 obj << /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream endobj`);
    const objects = [
      "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
      `2 0 obj << /Type /Pages /Kids [${pages.map((_, index) => `${3 + index} 0 R`).join(" ")}] /Count ${pages.length} >> endobj`,
      ...pageObjects,
      `${3 + pages.length} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`,
      ...contentObjects
    ];
    const body = objects.join("\n");
    return Buffer.from(`%PDF-1.4\n${body}\ntrailer << /Root 1 0 R >>\n%%EOF`, "utf8");
  }

  private pdfEscape(value: string) {
    return value.replace(/[()\\]/g, "\\$&");
  }

  private xml(value: string) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}
