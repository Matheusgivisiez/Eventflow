import { getApiUrl } from "@/lib/api-url";
import type { EventFlowEvent, Paginated } from "@/types/eventflow";
import CatalogPage from "./catalog-client";

export const revalidate = 60;

type InitialEvents = { events: Paginated<EventFlowEvent>; fetchedAt: number };

// Se a API estiver lenta ou fora, a home volta ao comportamento antigo:
// chega sem eventos e o navegador busca sozinho.
async function getInitialEvents(): Promise<InitialEvents | undefined> {
  try {
    const response = await fetch(`${getApiUrl()}/events/public?page=1&perPage=12`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
      console.error("Home: API de eventos respondeu", response.status);
      return undefined;
    }

    const events = (await response.json()) as Paginated<EventFlowEvent>;
    return { events, fetchedAt: Date.now() };
  } catch (error) {
    console.error("Home: falha ao buscar eventos no servidor", error);
    return undefined;
  }
}

export default async function HomePage() {
  const initial = await getInitialEvents();
  return <CatalogPage initialEvents={initial?.events} initialEventsFetchedAt={initial?.fetchedAt} />;
}
