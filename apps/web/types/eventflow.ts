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
  /** Quando o lote ficou à venda pela primeira vez; null/ausente = ainda não abriu. */
  openedAt?: string | null;
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

export type Artist = { id: string; stageName: string; imageUrl?: string; instagramUrl?: string; spotifyUrl?: string; bio?: string; genre?: string };
export type EventArtist = { artistId?: string; position: number; artist: Artist };

export type EventFlowEvent = {
  id: string;
  ownerId?: string;
  accessRole?: "OWNER" | "GESTOR" | "EDITOR" | "OPERACAO" | "ADMIN";
  title: string;
  slug: string;
  description: string;
  category: string;
  bannerUrl?: string;
  shareImageUrl?: string;
  galleryUrls: string[];
  /** Imagem do mapa do evento (setores/camarotes). Opcional. */
  venueMapUrl?: string | null;
  /** Arte do topo da página no celular (vertical 9:16). Sem ela, usa o banner. */
  heroMobileUrl?: string | null;
  /** Arte do topo da página no computador (16:10). Sem ela, usa o banner. */
  heroDesktopUrl?: string | null;
  startsAt: string;
  endsAt?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  address?: string;
  mapUrl?: string;
  format: EventFormat;
  status: EventStatus;
  isPrivate?: boolean;
  onlineUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  faqJson?: FaqItem[];
  agendaJson?: AgendaItem[];
  ticketTypes: TicketType[];
  artists?: EventArtist[];
  tenant?: { name: string; logoUrl?: string };
  allowTicketTransfer?: boolean;
  ticketTransferLockTime?: string;
  feeAbsorbedByOrganizer?: boolean;
  allowTicketRefund?: boolean;
  ticketRefundLockHours?: number | null;
  /** Both null = QR Code liberado já na compra. */
  qrCodeReleaseMinutesBeforeStart?: number | null;
  qrCodeReleaseAt?: string | null;
  checkInOpensAt?: string;
  checkInClosesAt?: string;
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
  // Vazio/ausente = vale para todos os eventos criados pelo dono do cupom.
  events?: { eventId: string; event: { id: string; title: string } }[];
};
