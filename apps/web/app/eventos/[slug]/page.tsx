import { Metadata } from "next";
import { notFound } from "next/navigation";
import { HERO_SPLIT_PAGE_GRID, HeroBanner } from "@/components/event-page/hero-banner";
import { VenueMap } from "@/components/event-page/venue-map";
import { PhotoGallery } from "@/components/event-page/photo-gallery";
import { LocationMap } from "@/components/event-page/location-map";
import { EventAgenda } from "@/components/event-page/event-agenda";
import { EventFaq } from "@/components/event-page/event-faq";
import { OrganizerInfo } from "@/components/event-page/organizer-info";
import { EventDetailClient } from "./event-detail-client";
import { getApiUrl } from "@/lib/api-url";
import { getCurrentTicketLots } from "@/lib/ticket-lots";
import { publicAssetUrl } from "@/lib/public-asset-url";
import { cn } from "@/lib/utils";
import type { EventFlowEvent } from "@/types/eventflow";

const siteUrl = "https://eventflowtickets.com.br";

function socialImageUrl(value?: string) {
  if (!value) return undefined;
  try {
    const base = value.startsWith("/uploads/") ? getApiUrl() : siteUrl;
    return new URL(value, base).toString();
  } catch {
    return undefined;
  }
}

// Helper function to fetch the event from the API directly.
// We use fetch since this is a server component.
async function getEvent(slug: string, invite?: string): Promise<EventFlowEvent | null> {
  const API_URL = getApiUrl();
  try {
    const query = invite ? `?invite=${encodeURIComponent(invite)}` : "";
    const res = await fetch(`${API_URL}/events/public/${slug}${query}`, {
      ...(invite ? { cache: "no-store" as const } : { next: { revalidate: 60 } })
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// Generate dynamic metadata for SEO
export async function generateMetadata(
  { params, searchParams }: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ invite?: string }>;
  }
): Promise<Metadata> {
  const { slug } = await params;
  const { invite } = await searchParams;
  const event = await getEvent(slug, invite);

  if (!event) {
    return {
      title: "Evento não encontrado | Event Flow",
      description: "O evento procurado não existe ou não está mais disponível.",
      ...(invite ? { robots: { index: false, follow: false } } : {})
    };
  }

  const title = event.seoTitle || `${event.title} | Event Flow`;
  const description = event.seoDescription || event.description.replace(/\s+/g, " ").trim().substring(0, 160);
  const imageUrl = socialImageUrl(event.shareImageUrl || event.bannerUrl);
  const image = imageUrl && (event.shareImageUrl
    ? { url: imageUrl, width: 1200, height: 630, alt: `Capa de ${event.title}` }
    : { url: imageUrl, alt: `Banner de ${event.title}` });

  return {
    title,
    description,
    ...(!invite ? { alternates: { canonical: `/eventos/${encodeURIComponent(slug)}` } } : {}),
    ...(invite ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title,
      description,
      type: "website",
      locale: "pt_BR",
      siteName: "Event Flow",
      ...(!invite ? { url: `/eventos/${encodeURIComponent(slug)}` } : {}),
      images: image ? [image] : []
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: imageUrl ? [imageUrl] : []
    }
  };
}

function refundPolicyText(event: EventFlowEvent) {
  if (!event.allowTicketRefund) {
    return "este evento não oferece reembolso pelo site. Em caso de cancelamento ou adiamento, fale com o organizador.";
  }
  const hours = event.ticketRefundLockHours ?? 0;
  if (hours === 0) {
    return "você pode solicitar pelo site até o início do evento.";
  }
  return `você pode solicitar pelo site até ${hours}h antes do início do evento.`;
}

export default async function PublicEventPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ invite?: string }> }) {
  const { slug } = await params;
  const { invite } = await searchParams;
  const event = await getEvent(slug, invite);

  if (!event) {
    notFound();
  }

  const organizerName = event.tenant?.name;
  const eventUrl = `${siteUrl}/eventos/${encodeURIComponent(slug)}`;
  const eventImage = socialImageUrl(event.shareImageUrl || event.bannerUrl);
  const currentTicket = getCurrentTicketLots(event.ticketTypes ?? [])[0]?.ticket;
  const heroArt = {
    mobileUrl: publicAssetUrl(event.heroMobileUrl ?? undefined),
    desktopUrl: publicAssetUrl(event.heroDesktopUrl ?? undefined)
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    url: eventUrl,
    name: event.title,
    description: event.description,
    startDate: event.startsAt,
    ...(event.endsAt ? { endDate: event.endsAt } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: event.format === "IN_PERSON"
      ? "https://schema.org/OfflineEventAttendanceMode"
      : "https://schema.org/OnlineEventAttendanceMode",
    ...(eventImage ? { image: [eventImage] } : {}),
    location: event.format === "IN_PERSON" ? {
      "@type": "Place",
      name: event.address || event.city || event.title,
      address: {
        "@type": "PostalAddress",
        ...(event.address ? { streetAddress: event.address } : {}),
        ...(event.city ? { addressLocality: event.city } : {}),
        ...(event.state ? { addressRegion: event.state } : {}),
        ...(event.zipCode ? { postalCode: event.zipCode } : {})
      }
    } : {
      "@type": "VirtualLocation",
      ...(event.onlineUrl ? { url: event.onlineUrl } : {})
    },
    offers: currentTicket ? {
      "@type": "Offer",
      price: (currentTicket.priceCents / 100).toFixed(2),
      priceCurrency: "BRL",
      availability: "https://schema.org/InStock",
      url: eventUrl
    } : undefined,
    ...(organizerName ? { organizer: {
      "@type": "Organization",
      name: organizerName,
      ...(event.tenant?.logoUrl ? { logo: event.tenant.logoUrl } : {})
    } } : {})
  };

  // No desktop, hero e conteúdo compartilham um grid: ingressos logo abaixo dos dados.
  return (
    <main className={cn("min-h-screen bg-background pb-32 sm:pb-24", HERO_SPLIT_PAGE_GRID)}>
      <script
        type="application/ld+json"
        // JSON.stringify does not escape "</", so an event title/description
        // containing "</script><script>" would otherwise close this tag and
        // run attacker HTML as a script in every visitor's session.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      {/* Hero: nav + banner + título */}
      <HeroBanner event={event} art={heroArt} />

      {/* Conteúdo principal: detalhes + ingressos (client-side cuida da ordem mobile/desktop) */}
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-5 lg:contents">
        <EventDetailClient
          event={event}
          invite={invite}
          aboutSection={
            <section className="space-y-4 animate-fade-in">
              <h2 className="text-2xl font-bold tracking-tight">Sobre o Evento</h2>
              <div className="glass-card rounded-3xl p-5 sm:p-6">
                <p className="whitespace-pre-line break-words text-base leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                  {event.description}
                </p>
              </div>
              <p className="glass-card rounded-2xl p-4 text-sm leading-relaxed text-muted-foreground sm:p-5">
                <span className="font-semibold text-foreground">Reembolso: </span>
                {refundPolicyText(event)}
              </p>
            </section>
          }
          venueMapSection={event.venueMapUrl ? <VenueMap url={event.venueMapUrl} title={event.title} /> : null}
          gallerySection={<PhotoGallery urls={event.galleryUrls} title={event.title} />}
          locationSection={<LocationMap event={event} />}
          agendaSection={<EventAgenda agendaJson={event.agendaJson} />}
          faqSection={<EventFaq faqJson={event.faqJson} />}
          organizerSection={
            <OrganizerInfo
              name={organizerName ?? "Organizador do Evento"}
              logoUrl={event.tenant?.logoUrl}
              description="Produtora responsável por organizar eventos, ingressos e experiências memoráveis."
            />
          }
        />
      </div>
    </main>
  );
}
