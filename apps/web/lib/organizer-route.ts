import type { AuthUser } from "@/stores/auth-store";

export function getOrganizerCtaHref(role?: AuthUser["role"]) {
  if (!role) return "/organizador/register";
  if (role === "CUSTOMER") return "/me/organizador";
  return "/events/new";
}
