const DEFAULT_API_URL = "http://localhost:3001/api";

export function getApiUrl() {
  if (typeof window !== "undefined") {
    return "/api/backend";
  }
  return process.env.NEXT_PUBLIC_API_URL?.trim() || DEFAULT_API_URL;
}
