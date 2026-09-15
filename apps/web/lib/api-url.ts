const DEFAULT_API_URL = "https://api.eventflowtickets.com.br/api";

export function getApiUrl() {
  if (typeof window !== "undefined") {
    return "/api/backend";
  }
  return process.env.NEXT_PUBLIC_API_URL?.trim() || DEFAULT_API_URL;
}
