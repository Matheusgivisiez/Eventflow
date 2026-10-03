const PRODUCTION_ORIGINS = [
  "https://eventflowtickets.com.br",
  "https://www.eventflowtickets.com.br"
];

/** Keep the buyer's host-scoped session without exposing order tokens to arbitrary sites. */
export function checkoutReturnOrigin(appUrl: string, requested?: string): string {
  const configured = new URL(appUrl).origin;
  const allowed = new Set([configured]);
  if (PRODUCTION_ORIGINS.includes(configured)) {
    for (const origin of PRODUCTION_ORIGINS) allowed.add(origin);
  }
  // Require an exact origin, not a URL prefix, path, userinfo or arbitrary subdomain.
  return requested && allowed.has(requested) ? requested : configured;
}
