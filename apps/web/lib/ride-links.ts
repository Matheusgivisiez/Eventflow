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
    // mapUrl pode nao ser uma URL absoluta valida (ex: usuario colou so um trecho).
    // Seguimos para os padroes de regex abaixo antes de desistir.
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
 * Abre o app com o destino ja preenchido e a origem como localizacao atual.
 */
export function buildUberLink(event: EventLocationInput, nickname?: string): string {
  const { coords, address } = getEventLocation(event);

  // IMPORTANTE: os nomes dos parametros com colchetes (dropoff[formatted_address])
  // precisam ficar literais na query string. Se usarmos URLSearchParams aqui, ele
  // tambem faz percent-encode das CHAVES (vira dropoff%5Bformatted_address%5D=...),
  // e o app do Uber nao reconhece a chave codificada -- o destino chega em branco.
  // Por isso montamos a query manualmente: chave literal, valor com encodeURIComponent.
  const parts = ["action=setPickup", "pickup=my_location"];
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
 * navigate=yes inicia a navegacao imediatamente, sem precisar pesquisar.
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

/**
 * O 99 (99app / DiDi) nao publica um esquema de link universal que aceite
 * um endereco de destino (ao contrario de Uber e Waze). O que da para fazer,
 * de forma confiavel, e abrir o app pelo esquema customizado dele e, se nao
 * estiver instalado, cair para a loja certa pelo user agent.
 */
export const NINETYNINE_APP_SCHEME = "taxis99://";
export const NINETYNINE_ANDROID_STORE = "https://play.google.com/store/apps/details?id=com.taxis99";
export const NINETYNINE_IOS_STORE = "https://apps.apple.com/br/app/99-corridas-food-pay/id553663691";
export const NINETYNINE_WEB_FALLBACK = "https://99app.com/passageiro/";
