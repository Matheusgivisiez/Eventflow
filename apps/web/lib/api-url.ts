const DEFAULT_API_URL = "https://eventflow-api-283790508777.us-east1.run.app/api";

export function getApiUrl() {
  if (typeof window !== "undefined") {
    return "/api/backend";
  }
  return process.env.NEXT_PUBLIC_API_URL?.trim() || DEFAULT_API_URL;
}
