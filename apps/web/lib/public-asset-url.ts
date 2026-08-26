import { getApiUrl } from "./api-url";

export function publicAssetUrl(value?: string) {
  if (!value) return undefined;
  if (/^(data|blob):/i.test(value)) return value;

  try {
    const url = /^https?:\/\//i.test(value) ? new URL(value) : new URL(value, apiOrigin());
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return `/api/image-proxy?url=${encodeURIComponent(`${apiOrigin()}${url.pathname}${url.search}`)}`;
    }
    return `/api/image-proxy?url=${encodeURIComponent(url.toString())}`;
  } catch {
    return value;
  }
}

function apiOrigin() {
  const apiUrl = getApiUrl();
  if (/^https?:\/\//i.test(apiUrl)) {
    return new URL(apiUrl).origin;
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:3000";
}
