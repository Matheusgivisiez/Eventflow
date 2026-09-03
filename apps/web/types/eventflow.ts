export type EventStatus = "DRAFT" | "PUBLISHED" | "CLOSED";
export type EventFormat = "ONLINE" | "IN_PERSON";
export type PaymentStatus = "PENDING" | "PAID" | "CANCELED" | "REFUNDED";
export type PaymentMethod = "PIX" | "CREDIT_CARD";

export type TicketType = {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  sold: number;
  priceCents: number;
  startsAt: string;
  endsAt: string;
  salesEndQuantity?: number;
  limitPerBuy: number;
  isActive: boolean;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type AgendaItem = {
  time: string;
  title: string;
  speaker?: string;
  description?: string;
};

export type EventFlowEvent = {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  bannerUrl?: string;
  galleryUrls: string[];
  startsAt: string;
  endsAt?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  address?: string;
  mapUrl?: string;
  format: EventFormat;
  status: EventStatus;
  onlineUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  faqJson?: FaqItem[];
  agendaJson?: AgendaItem[];
  ticketTypes: TicketType[];
  tenant?: { name: string; logoUrl?: string };
  allowTicketTransfer?: boolean;
  ticketTransferLockTime?: string;
  qrCodeReleaseMinutesBeforeStart?: number;
  qrCodeReleaseAt?: string;
};

export type Paginated<T> = {
  data: T[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
};

export type CouponType = {
  id: string;
  code: string;
  discountPercent?: number;
  discountFixedCents?: number;
  validFrom: string;
  validUntil: string;
  maxUses: number;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
};
