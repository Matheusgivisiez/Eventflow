import type { MetadataRoute } from "next";
import { getApiUrl } from "@/lib/api-url";
import type { EventFlowEvent, Paginated } from "@/types/eventflow";

const siteUrl = "https://eventflowtickets.com.br";
const PAGE_SIZE = 100;
const MAX_EVENT_PAGES = 499; // Keep the sitemap below Google's 50,000 URL limit.

export const revalidate = 3600;

async function getPublicEventPages(): Promise<MetadataRoute.Sitemap> {
  const urls: MetadataRoute.Sitemap = [];

  try {
    const firstPage = await fetchPublicEvents(1);
    if (!firstPage) return urls;

    const totalPages = Math.min(firstPage.meta.totalPages, MAX_EVENT_PAGES);
    const pages = [firstPage];

    for (let firstPageNumber = 2; firstPageNumber <= totalPages; firstPageNumber += 20) {
      const pageNumbers = Array.from(
        { length: Math.min(20, totalPages - firstPageNumber + 1) },
        (_, index) => firstPageNumber + index
      );
      const results = await Promise.all(pageNumbers.map(fetchPublicEvents));
      pages.push(...results.filter((result): result is Paginated<EventFlowEvent> => Boolean(result)));
    }

    const slugs = new Set<string>();
    for (const page of pages) {
      for (const event of page.data) {
        if (event.slug && event.status === "PUBLISHED" && !event.isPrivate) {
          slugs.add(event.slug);
        }
      }
    }

    for (const slug of slugs) {
      urls.push({ url: `${siteUrl}/eventos/${encodeURIComponent(slug)}` });
    }
  } catch (error) {
    // Keep the static sitemap available if the event API is temporarily down.
    console.error("Sitemap: falha ao buscar eventos", error);
  }

  return urls;
}

async function fetchPublicEvents(page: number) {
  const response = await fetch(
    `${getApiUrl()}/events/public?page=${page}&perPage=${PAGE_SIZE}`,
    { next: { revalidate: 3600 }, signal: AbortSignal.timeout(10000) }
  );

  if (!response.ok) {
    console.error("Sitemap: API de eventos respondeu", response.status);
    return undefined;
  }
  return response.json() as Promise<Paginated<EventFlowEvent>>;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/termos-de-uso`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/politica-de-privacidade`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/politica-de-cookies`, changeFrequency: "yearly", priority: 0.2 }
  ];

  return [...staticPages, ...(await getPublicEventPages())];
}
