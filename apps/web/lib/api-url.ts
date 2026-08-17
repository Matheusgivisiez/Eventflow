const DEFAULT_API_URL = "http://localhost:3001/api";

export function getApiUrl() {
  return process.env.NEXT_PUBLIC_API_URL?.trim() || DEFAULT_API_URL;
}

