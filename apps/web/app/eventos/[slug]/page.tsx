import { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { HeroBanner } from "@/components/event-page/hero-banner";
import { PhotoGallery } from "@/components/event-page/photo-gallery";
import { LocationMap } from "@/components/event-page/location-map";
import { EventAgenda } from "@/components/event-page/event-agenda";
import { EventFaq } from "@/components/event-page/event-faq";
import { TicketSelector } from "@/components/event-page/ticket-selector";
import { OrganizerInfo } from "@/components/event-page/organizer-info";
import type { EventHubEvent } from "@/types/eventhub";

// Helper function to fetch the event from the API directly.
// We use fetch since this is a server component.
async function getEvent(slug: string): Promise<EventHubEvent | null> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
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
      title: "Evento nao encontrado | EventHub",
      description: "O evento procurado nao existe ou nao esta mais disponivel."
    };
  }

  const title = event.seoTitle || `${event.title} | EventHub`;
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

  const minPrice = event.ticketTypes.length 
    ? Math.min(...event.ticketTypes.map((ticket) => ticket.priceCents)) 
    : 0;

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
    offers: {
      "@type": "Offer",
      price: (minPrice / 100).toFixed(2),
      priceCurrency: "BRL",
      availability: "https://schema.org/InStock",
      url: `${process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") ?? "http://localhost:3000"}/eventos/${slug}`
    },
    organizer: {
      "@type": "Organization",
      name: organizerName
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HeroBanner event={event} minPrice={minPrice} />
      
      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-12 lg:grid-cols-[1fr_400px] lg:px-8">
        <div className="space-y-16">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight">Sobre o Evento</h2>
            <p className="whitespace-pre-line text-lg leading-relaxed text-muted-foreground">{event.description}</p>
          </div>
          
          <PhotoGallery urls={event.galleryUrls} title={event.title} />
          
          <LocationMap event={event} />
          
          <EventAgenda agendaJson={event.agendaJson} />
          
          <EventFaq faqJson={event.faqJson} />
          
          <OrganizerInfo name={organizerName} description="Produtora responsavel por organizar eventos, ingressos e experiencias memoraveis." />
        </div>
        
        <div className="relative">
          <TicketSelector event={event} />
        </div>
      </section>
    </main>
  );
}
