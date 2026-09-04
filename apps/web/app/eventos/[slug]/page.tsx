import { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { HeroBanner } from "@/components/event-page/hero-banner";
import { PhotoGallery } from "@/components/event-page/photo-gallery";
import { LocationMap } from "@/components/event-page/location-map";
import { EventAgenda } from "@/components/event-page/event-agenda";
import { EventFaq } from "@/components/event-page/event-faq";
import { OrganizerInfo } from "@/components/event-page/organizer-info";
import { EventDetailClient } from "./event-detail-client";
import { getApiUrl } from "@/lib/api-url";
import type { EventFlowEvent } from "@/types/eventflow";

// Helper function to fetch the event from the API directly.
// We use fetch since this is a server component.
async function getEvent(slug: string): Promise<EventFlowEvent | null> {
  const API_URL = getApiUrl();
  try {
    const res = await fetch(`${API_URL}/events/public/${slug}`, {
      next: { revalidate: 60 } // Cache for 60 seconds
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// Generate dynamic metadata for SEO
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEvent(slug);

  if (!event) {
    return {
      title: "Evento nao encontrado | Event Flow",
      description: "O evento procurado nao existe ou nao esta mais disponivel."
    };
  }

  const title = event.seoTitle || `${event.title} | Event Flow`;
  const description = event.seoDescription || event.description.substring(0, 160);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: event.bannerUrl ? [event.bannerUrl] : []
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: event.bannerUrl ? [event.bannerUrl] : []
    }
  };
}

export default async function PublicEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEvent(slug);

  if (!event) {
    notFound();
  }

  const organizerName = event.tenant?.name || "Organizador do Evento";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description,
    startDate: event.startsAt,
    endDate: event.endsAt,
    image: event.bannerUrl,
    location: event.format === "IN_PERSON" ? {
      "@type": "Place",
      name: event.address,
      address: {
        "@type": "PostalAddress",
        streetAddress: event.address,
        addressLocality: event.city,
        addressRegion: event.state,
        postalCode: event.zipCode
      }
    } : {
      "@type": "VirtualLocation",
      url: event.onlineUrl
    },
    offers: event.ticketTypes.length > 0 ? {
      "@type": "Offer",
      price: (Math.min(...event.ticketTypes.map((t) => t.priceCents)) / 100).toFixed(2),
      priceCurrency: "BRL",
      availability: "https://schema.org/InStock",
      url: `${getApiUrl().replace("/api", "")}/eventos/${slug}`
    } : undefined,
    organizer: {
      "@type": "Organization",
      name: organizerName
    }
  };

  return (
    <main className="min-h-screen bg-background pb-32 sm:pb-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero: nav + banner + título */}
      <HeroBanner event={event} />

      {/* Conteúdo principal: detalhes + ingressos (client-side) */}
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-5 lg:px-8">
        <div className="grid min-w-0 grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-12">
          {/* Coluna esquerda: informações */}
          <div className="min-w-0 space-y-10 sm:space-y-12">
            {/* Sobre o evento */}
            <section className="space-y-4 animate-fade-in">
              <h2 className="text-xl font-bold tracking-tight">Sobre o Evento</h2>
              <p className="whitespace-pre-line break-words text-base leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                {event.description}
              </p>
            </section>

            {/* Galeria de fotos */}
            <PhotoGallery urls={event.galleryUrls} title={event.title} />

            {/* Mapa */}
            <LocationMap event={event} />

            {/* Agenda */}
            <EventAgenda agendaJson={event.agendaJson} />

            {/* FAQ */}
            <EventFaq faqJson={event.faqJson} />

            {/* Organizador */}
            <OrganizerInfo
              name={organizerName}
              description="Produtora responsavel por organizar eventos, ingressos e experiencias memoraveis."
            />
          </div>

          {/* Coluna direita: seletor de ingressos + share (client) */}
          <div className="relative min-w-0">
            <EventDetailClient event={event} />
          </div>
        </div>
      </div>
    </main>
  );
}
