export type LatLng = { lat: number; lng: number };

type EventLocationInput = {
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  mapUrl?: string;
};

/**
 * Tenta extrair uma coordenada (lat, lng) de um link do Google Maps colado
 * pelo organizador. Cobre os formatos mais comuns:
 *  - https://maps.google.com/?q=-19.123,-42.456
 *  - https://www.google.com/maps/@-19.123,-42.456,17z
 *  - https://www.google.com/maps/place/.../@-19.123,-42.456,17z/data=!...!3d-19.123!4d-42.456
 */
function parseLatLngFromMapUrl(mapUrl?: string): LatLng | null {
  if (!mapUrl) return null;

  try {
    const url = new URL(mapUrl);
    const q = url.searchParams.get("q") ?? url.searchParams.get("query");
    if (q) {
      const match = q.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
      if (match) {
        return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
      }
    }
  } catch {
    // mapUrl pode não ser uma URL absoluta válida (ex: usuário colou só um trecho).
    // Seguimos para os padrões de regex abaixo antes de desistir.
  }

  const placeDataMatch = mapUrl.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (placeDataMatch) {
    return { lat: parseFloat(placeDataMatch[1]), lng: parseFloat(placeDataMatch[2]) };
  }

  const atMatch = mapUrl.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  }

  return null;
}

export function getFullAddress(event: EventLocationInput): string {
  const cityState = [event.city, event.state].filter(Boolean).join(" - ");
  return [event.address, cityState, event.zipCode ? `CEP ${event.zipCode}` : undefined]
    .filter(Boolean)
    .join(", ");
}

export function getEventLocation(event: EventLocationInput): { coords: LatLng | null; address: string } {
  return {
    coords: parseLatLngFromMapUrl(event.mapUrl),
    address: getFullAddress(event),
  };
}

/** URL do Google Maps embutido (iframe) sem precisar de API key. */
export function buildMapEmbedSrc(event: EventLocationInput): string {
  const { coords, address } = getEventLocation(event);
  if (coords) {
    return `https://www.google.com/maps?q=${coords.lat},${coords.lng}&z=16&output=embed`;
  }
  if (address) {
    return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
  }
  return "";
}

/** Link "abrir no Google Maps" (app no celular, web no desktop). */
export function buildGoogleMapsLink(event: EventLocationInput): string {
  const { coords, address } = getEventLocation(event);
  if (coords) {
    return `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
  }
  if (address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }
  return event.mapUrl || "https://maps.google.com";
}

/**
 * Deep link oficial do Uber (m.uber.com/ul). Documentado em
 * https://developer.uber.com/docs/riders/ride-requests/tutorials/deep-links/introduction
 * Abre o app com o destino já preenchido e a origem como localização atual.
 *
 * client_id: a documentação oficial da Uber lista esse parâmetro como
 * obrigatório em TODOS os exemplos de deep link (inclusive os que só
 * preenchem pickup/dropoff, sem nenhuma chamada de API). Sem ele o link
 * pode abrir o app "vazio", sem o destino preenchido -- e o motivo mais
 * provável do botão não estar registrando o endereço corretamente.
 * Como conseguir: crie um app de graca em https://developer.uber.com
 * (dashboard > "Create App"), copie o Client ID gerado e coloque em
 * NEXT_PUBLIC_UBER_CLIENT_ID no .env do app web.
 */
export function buildUberLink(event: EventLocationInput, nickname?: string): string {
  const { coords, address } = getEventLocation(event);
  const clientId = process.env.NEXT_PUBLIC_UBER_CLIENT_ID;

  // IMPORTANTE: os nomes dos parâmetros com colchetes (dropoff[formatted_address])
  // precisam ficar literais na query string. Se usarmos URLSearchParams aqui, ele
  // também faz percent-encode das CHAVES (vira dropoff%5Bformatted_address%5D=...),
  // e o app do Uber não reconhece a chave codificada -- o destino chega em branco.
  // Por isso montamos a query manualmente: chave literal, valor com encodeURIComponent.
  const parts = ["action=setPickup", "pickup=my_location"];
  if (clientId) {
    parts.unshift(`client_id=${encodeURIComponent(clientId)}`);
  }
  if (coords) {
    parts.push(`dropoff[latitude]=${encodeURIComponent(String(coords.lat))}`);
    parts.push(`dropoff[longitude]=${encodeURIComponent(String(coords.lng))}`);
  }
  if (address) {
    parts.push(`dropoff[formatted_address]=${encodeURIComponent(address)}`);
  }
  if (nickname) {
    parts.push(`dropoff[nickname]=${encodeURIComponent(nickname)}`);
  }
  return `https://m.uber.com/ul/?${parts.join("&")}`;
}

/**
 * Deep link oficial do Waze (waze.com/ul). Documentado em
 * https://developers.google.com/waze/deeplinks
 * navigate=yes inicia a navegação imediatamente, sem precisar pesquisar.
 */
export function buildWazeLink(event: EventLocationInput): string {
  const { coords, address } = getEventLocation(event);
  const params = new URLSearchParams();
  params.set("navigate", "yes");
  if (coords) {
    params.set("ll", `${coords.lat},${coords.lng}`);
  }
  if (address) {
    params.set("q", address);
  }
  return `https://waze.com/ul?${params.toString()}`;
}
